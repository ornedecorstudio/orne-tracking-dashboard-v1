// app/api/orders/route.ts - API que busca e processa pedidos

import { NextResponse } from 'next/server';
import { fetchShopifyOrders, transformShopifyOrder } from '@/lib/shopify';
import { registerTrackingBatch, getTrackingStatusBatch } from '@/lib/tracking';
import { 
  calculateBusinessDays, 
  calculateDaysBetween, 
  determinePriority, 
  checkAbnormalStatus 
} from '@/lib/utils';
import { Order, DashboardMetrics } from '@/types';

// =============================================
// GET /api/orders - Retorna pedidos em trânsito
// =============================================
export async function GET() {
  try {
    console.log('=== INICIANDO BUSCA DE PEDIDOS ===');
    
    // PASSO 1: Buscar pedidos da Shopify
    const shopifyOrders = await fetchShopifyOrders();
    
    if (shopifyOrders.length === 0) {
      return NextResponse.json({
        orders: [],
        metrics: getEmptyMetrics(),
        message: 'Nenhum pedido em trânsito encontrado',
      });
    }

    // PASSO 2: Transformar pedidos para formato interno
    const orders: Order[] = shopifyOrders.map(transformShopifyOrder);
    
    // PASSO 3: Coletar códigos de rastreamento únicos
    const trackingNumbers = orders
      .filter(o => o.trackingNumber)
      .map(o => o.trackingNumber as string);
    
    console.log(`[API] ${trackingNumbers.length} códigos para rastrear`);

    // PASSO 4: Registrar códigos novos na 17TRACK
    // IMPORTANTE: Isso gasta créditos apenas para códigos NOVOS
    if (trackingNumbers.length > 0) {
      const { registered, failed } = await registerTrackingBatch(trackingNumbers);
      console.log(`[API] 17TRACK: ${registered.length} registrados, ${failed.length} falharam`);
    }

    // PASSO 5: Buscar status de todos os códigos (não gasta créditos)
    const trackingStatuses = await getTrackingStatusBatch(trackingNumbers);

    // PASSO 6: Processar cada pedido com dados de tracking
    const now = new Date();
    
    for (const order of orders) {
      // Calcular dias desde o pedido
      const orderDate = new Date(order.createdAt);
      order.daysSinceOrder = calculateDaysBetween(orderDate, now);
      order.businessDaysSinceOrder = calculateBusinessDays(orderDate, now);
      
      // Calcular dias em trânsito (desde o envio)
      if (order.shippedAt) {
        const shipDate = new Date(order.shippedAt);
        order.daysInTransit = calculateDaysBetween(shipDate, now);
      }
      
      // Adicionar dados do rastreamento
      if (order.trackingNumber && trackingStatuses.has(order.trackingNumber)) {
        const tracking = trackingStatuses.get(order.trackingNumber)!;
        order.trackingStatus = tracking.status as any;
        order.trackingEvents = tracking.events;
        order.lastTrackingUpdate = tracking.lastUpdate;
        
        // Verificar status anormal
        const abnormalCheck = checkAbnormalStatus(tracking.status, tracking.events);
        order.hasAbnormalStatus = abnormalCheck.hasAbnormal;
        order.abnormalReason = abnormalCheck.reason;
      }
      
      // Determinar prioridade final
      order.priority = determinePriority(
        order.businessDaysSinceOrder,
        order.hasAbnormalStatus
      );
    }

    // PASSO 7: Ordenar por prioridade (críticos primeiro)
    const priorityOrder = { critical: 0, high: 1, medium: 2, normal: 3 };
    orders.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      // Se mesma prioridade, ordenar por dias (mais antigo primeiro)
      return b.businessDaysSinceOrder - a.businessDaysSinceOrder;
    });

    // PASSO 8: Calcular métricas
    const metrics = calculateMetrics(orders);

    console.log('=== BUSCA CONCLUÍDA ===');
    console.log(`Total: ${orders.length} pedidos`);
    console.log(`Críticos: ${metrics.critical}, Alta: ${metrics.highPriority}, Média: ${metrics.mediumPriority}`);

    return NextResponse.json({
      orders,
      metrics,
      lastUpdate: now.toISOString(),
    });

  } catch (error) {
    console.error('[API] Erro:', error);
    return NextResponse.json(
      { 
        error: 'Erro ao buscar pedidos', 
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}

// =============================================
// CALCULAR MÉTRICAS DA DASHBOARD
// =============================================
function calculateMetrics(orders: Order[]): DashboardMetrics {
  const totalInTransit = orders.length;
  const withProblems = orders.filter(o => o.hasAbnormalStatus).length;
  const critical = orders.filter(o => o.priority === 'critical').length;
  const mediumPriority = orders.filter(o => o.priority === 'medium').length;
  const highPriority = orders.filter(o => o.priority === 'high').length;
  
  // Média de dias em trânsito
  const transitDays = orders
    .filter(o => o.daysInTransit > 0)
    .map(o => o.daysInTransit);
  const averageTransitDays = transitDays.length > 0
    ? Math.round(transitDays.reduce((a, b) => a + b, 0) / transitDays.length)
    : 0;
  
  // Pedido mais antigo
  const oldestOrderDays = orders.length > 0
    ? Math.max(...orders.map(o => o.daysSinceOrder))
    : 0;

  return {
    totalInTransit,
    withProblems,
    critical,
    mediumPriority,
    highPriority,
    averageTransitDays,
    oldestOrderDays,
  };
}

// =============================================
// MÉTRICAS VAZIAS (quando não há pedidos)
// =============================================
function getEmptyMetrics(): DashboardMetrics {
  return {
    totalInTransit: 0,
    withProblems: 0,
    critical: 0,
    mediumPriority: 0,
    highPriority: 0,
    averageTransitDays: 0,
    oldestOrderDays: 0,
  };
}
