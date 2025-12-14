// lib/shopify.ts - Integração com Shopify Admin API

// =============================================
// TIPOS INTERNOS DA SHOPIFY
// =============================================
interface ShopifyOrder {
  id: number;
  name: string;
  order_number: number;
  created_at: string;
  financial_status: string;
  fulfillment_status: string | null;
  total_price: string;
  currency: string;
  customer: {
    id: number;
    email: string;
    first_name: string;
    last_name: string;
  } | null;
  fulfillments: Array<{
    id: number;
    status: string;
    created_at: string;
    tracking_number: string | null;
    tracking_url: string | null;
    tracking_company: string | null;
  }>;
  shipping_address?: {
    city: string;
    province: string;
    country: string;
  };
}

// =============================================
// BUSCAR PEDIDOS EM TRÂNSITO DA SHOPIFY
// =============================================
export async function fetchShopifyOrders(): Promise<ShopifyOrder[]> {
  const shopDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;

  if (!shopDomain || !accessToken) {
    throw new Error('Credenciais Shopify não configuradas. Verifique SHOPIFY_STORE_DOMAIN e SHOPIFY_ACCESS_TOKEN.');
  }

  // Buscar pedidos dos últimos 60 dias que foram enviados mas NÃO entregues
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const dateFilter = sixtyDaysAgo.toISOString();

  // URL da API Shopify Admin REST
  // fulfillment_status=shipped = enviados mas não entregues
  const url = `https://${shopDomain}/admin/api/2024-01/orders.json?` + 
    `status=any&` +
    `fulfillment_status=shipped&` +
    `created_at_min=${dateFilter}&` +
    `limit=250&` +
    `fields=id,name,order_number,created_at,financial_status,fulfillment_status,total_price,currency,customer,fulfillments,shipping_address`;

  console.log('[Shopify] Buscando pedidos em trânsito...');

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-Shopify-Access-Token': accessToken,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[Shopify] Erro na API:', response.status, errorText);
    throw new Error(`Erro na API Shopify: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const orders: ShopifyOrder[] = data.orders || [];

  console.log(`[Shopify] Encontrados ${orders.length} pedidos em trânsito`);

  // Filtrar apenas pedidos que têm código de rastreamento
  const ordersWithTracking = orders.filter(order => {
    const hasTracking = order.fulfillments?.some(f => f.tracking_number);
    return hasTracking;
  });

  console.log(`[Shopify] ${ordersWithTracking.length} pedidos com código de rastreamento`);

  return ordersWithTracking;
}

// =============================================
// TRANSFORMAR PEDIDO SHOPIFY PARA FORMATO INTERNO
// =============================================
export function transformShopifyOrder(shopifyOrder: ShopifyOrder) {
  // Pegar o primeiro fulfillment com tracking
  const fulfillment = shopifyOrder.fulfillments?.find(f => f.tracking_number);

  return {
    id: String(shopifyOrder.id),
    orderNumber: String(shopifyOrder.order_number),
    orderName: shopifyOrder.name,
    createdAt: shopifyOrder.created_at,
    customerName: shopifyOrder.customer
      ? `${shopifyOrder.customer.first_name} ${shopifyOrder.customer.last_name}`.trim()
      : 'Cliente não identificado',
    customerEmail: shopifyOrder.customer?.email || '',
    trackingNumber: fulfillment?.tracking_number || null,
    trackingUrl: fulfillment?.tracking_url || null,
    carrierName: fulfillment?.tracking_company || null,
    shippedAt: fulfillment?.created_at || null,
    totalPrice: shopifyOrder.total_price,
    currency: shopifyOrder.currency,
    // Campos que serão preenchidos depois pela 17TRACK
    trackingStatus: null,
    trackingEvents: [],
    lastTrackingUpdate: null,
    hasAbnormalStatus: false,
    abnormalReason: null,
    // Campos calculados (serão preenchidos depois)
    priority: 'normal' as const,
    daysSinceOrder: 0,
    daysInTransit: 0,
    businessDaysSinceOrder: 0,
  };
}
