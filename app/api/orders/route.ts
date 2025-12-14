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

    // PASSO 2: Transformar pedidos
    let orders: Order[] = shopifyOrders.map(transformShopifyOrder);
    
    // PASSO 3: Coletar códigos de rastreamento
    const trackingNumbers = orders
      .filter(o => o.trackingNumber)
      .map(o => o.trackingNumber as string);
    
    console.log(`[API] ${trackingNumbers.length} códigos para rastrear`);

    // PASSO 4: Registrar códigos novos na 17TRACK
    if (trackingNumbers.length > 0) {
      await registerTrackingBatch(trackingNumbers);
    }

    // PASSO 5: Buscar status de todos os códigos
    const trackingStatuses = await getTrackingStatusBatch(trackingNumbers);

    // PASSO 6: Processar cada pedido
    const now = new Date();
    
    for (const order of orders) {
      const orderDate = new Date(order.createdAt);
      order.daysSinceOrder = calculateDaysBetween(orderDate, now);
      order.businessDaysSinceOrder = calculateBusinessDays(orderDate, now);
      
      if (order.shippedAt) {
        const shipDate = new Date(order.shippedAt);
        order.daysInTransit = calculateDaysBetween(shipDate, now);
      }
      
      if (order.trackingNumber && trackingStatuses.has(order.trackingNumber)) {
        const tracking = trackingStatuses.get(order.trackingNumber)!;
        order.trackingStatus = tracking.status as any;
        order.trackingEvents = tracking.events;
        order.lastTrackingUpdate = tracking.lastUpdate;
        
        const abnormalCheck = checkAbnormalStatus(tracking.status, tracking.events);
        order.hasAbnormalStatus = abnormalCheck.hasAbnormal;
        order.abnormalReason = abnormalCheck.reason;
      }
      
      order.priority = determinePriority(
        order.businessDaysSinceOrder,
        order.hasAbnormalStatus
      );
    }

    // =============================================
    // PASSO 7: FILTRAR PEDIDOS ENTREGUES
    // IMPORTANTE: Remove pedidos que já foram entregues
    // =============================================
    const ordersBeforeFilter = orders.length;
    orders = orders.filter(order => {
      // Se o status da 17TRACK for "Delivered", remove da lista
      if (order.trackingStatus === 'Delivered') {
        console.log(`[API] Removendo pedido entregue: ${order.orderName}`);
        return false;
      }
      
      // Também verifica nos eventos se tem "Entregue" ou "Delivered"
      const hasDeliveredEvent = order.trackingEvents.some(event => {
        const desc = event.description.toLowerCase();
        return desc.includes('entregue') || 
               desc.includes('delivered') || 
               desc.includes('entrega realizada') ||
               desc.includes('objeto entregue');
      });
      
      if (hasDeliveredEvent) {
        console.log(`[API] Removendo pedido com evento de entrega: ${order.orderName}`);
        return false;
      }
      
      return true;
    });
    
    console.log(`[API] Filtrados: ${ordersBeforeFilter} → ${orders.length} (removidos ${ordersBeforeFilter - orders.length} entregues)`);

    // PASSO 8: Ordenar por prioridade
    const priorityOrder = { critical: 0, high: 1, medium: 2, normal: 3 };
    orders.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return b.businessDaysSinceOrder - a.businessDaysSinceOrder;
    });

    // PASSO 9: Calcular métricas
    const metrics = calculateMetrics(orders);

    console.log('=== BUSCA CONCLUÍDA ===');
    console.log(`Total: ${orders.length} | Críticos: ${metrics.critical} | Alta: ${metrics.highPriority} | Média: ${metrics.mediumPriority}`);

    return NextResponse.json({
      orders,
      metrics,
      lastUpdate: now.toISOString(),
    });

  } catch (error) {
    console.error('[API] Erro:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar pedidos', details: error instanceof Error ? error.message : 'Erro' },
      { status: 500 }
    );
  }
}

function calculateMetrics(orders: Order[]): DashboardMetrics {
  const totalInTransit = orders.length;
  const withProblems = orders.filter(o => o.hasAbnormalStatus).length;
  const critical = orders.filter(o => o.priority === 'critical').length;
  const mediumPriority = orders.filter(o => o.priority === 'medium').length;
  const highPriority = orders.filter(o => o.priority === 'high').length;
  
  const transitDays = orders.filter(o => o.daysInTransit > 0).map(o => o.daysInTransit);
  const averageTransitDays = transitDays.length > 0
    ? Math.round(transitDays.reduce((a, b) => a + b, 0) / transitDays.length)
    : 0;
  
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
