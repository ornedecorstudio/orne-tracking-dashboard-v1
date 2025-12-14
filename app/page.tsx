'use client';

import { useState, useEffect, useCallback } from 'react';
import { Order, DashboardMetrics, DashboardFilters } from '@/types';
import { formatDate, formatDateTime, formatCurrency, getPriorityStyles, detectCarrier, getWhatsAppLink } from '@/lib/utils';

// =============================================
// ÍCONES SVG
// =============================================
const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

const WhatsAppIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
    <polyline points="15 3 21 3 21 9"></polyline>
    <line x1="10" y1="14" x2="21" y2="3"></line>
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

// =============================================
// COMPONENTE PRINCIPAL
// =============================================
export default function Dashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({
    search: '',
    priority: 'all',
    sortBy: 'daysSinceOrder',
    sortOrder: 'desc',
  });

  // Buscar pedidos
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/orders');
      if (!response.ok) throw new Error(`Erro ${response.status}`);
      const data = await response.json();
      
      setOrders(data.orders || []);
      setMetrics(data.metrics || null);
      setLastUpdate(data.lastUpdate || new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Copiar e-mail
  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      setCopiedEmail(email);
      setTimeout(() => setCopiedEmail(null), 2000);
    } catch (err) {
      console.error('Erro ao copiar:', err);
    }
  };

  // Filtrar pedidos
  const filteredOrders = orders
    .filter(order => {
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const matches = 
          order.orderName.toLowerCase().includes(search) ||
          order.customerName.toLowerCase().includes(search) ||
          order.trackingNumber?.toLowerCase().includes(search) ||
          order.customerEmail.toLowerCase().includes(search);
        if (!matches) return false;
      }
      if (filters.priority !== 'all' && order.priority !== filters.priority) return false;
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'daysSinceOrder':
          comparison = a.daysSinceOrder - b.daysSinceOrder;
          break;
        case 'daysInTransit':
          comparison = a.daysInTransit - b.daysInTransit;
          break;
        case 'lastTrackingUpdate':
          const dateA = a.lastTrackingUpdate ? new Date(a.lastTrackingUpdate).getTime() : 0;
          const dateB = b.lastTrackingUpdate ? new Date(b.lastTrackingUpdate).getTime() : 0;
          comparison = dateA - dateB;
          break;
        case 'orderNumber':
          comparison = parseInt(a.orderNumber) - parseInt(b.orderNumber);
          break;
      }
      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

  // Obter domínio Shopify das variáveis de ambiente
  const shopifyDomain = process.env.NEXT_PUBLIC_SHOPIFY_STORE_DOMAIN || 'ornedecor.myshopify.com';

  return (
    <div className="min-h-screen">
      {/* HEADER */}
      <header className="bg-black text-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight">ORNE™</h1>
            <span className="text-gray-400 text-sm hidden sm:block">Tracking Dashboard</span>
          </div>
          <div className="flex items-center gap-4">
            {lastUpdate && (
              <span className="text-xs text-gray-400 hidden md:block">
                Atualizado: {formatDateTime(lastUpdate)}
              </span>
            )}
            <button
              onClick={fetchOrders}
              disabled={loading}
              className="btn bg-white/10 text-white hover:bg-white/20 disabled:opacity-50"
            >
              <span className={loading ? 'animate-spin' : ''}><RefreshIcon /></span>
              <span className="ml-2 hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* ERRO */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-700 font-medium">Erro ao carregar pedidos</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
            <button onClick={fetchOrders} className="mt-3 text-sm text-red-700 underline">
              Tentar novamente
            </button>
          </div>
        )}

        {/* MÉTRICAS */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <MetricCard label="Em trânsito" value={metrics.totalInTransit} sublabel="pedidos ativos" />
            <MetricCard label="Atenção" value={metrics.mediumPriority} color="yellow" sublabel="+10 dias úteis" />
            <MetricCard label="Atrasados" value={metrics.highPriority} color="red" sublabel="+15 dias úteis" />
            <MetricCard label="Críticos" value={metrics.critical} color="red" sublabel="com problemas" />
            <MetricCard label="Média trânsito" value={`${metrics.averageTransitDays}d`} sublabel="dias em média" />
            <MetricCard label="Mais antigo" value={`${metrics.oldestOrderDays}d`} sublabel="desde o pedido" />
          </div>
        )}

        {/* FILTROS */}
        <div className="card p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-gray-400">
                <SearchIcon />
              </div>
              <input
                type="text"
                placeholder="Buscar por pedido, cliente, rastreio..."
                className="input pl-10"
                value={filters.search}
                onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              />
            </div>
            <select
              className="input select w-full md:w-48"
              value={filters.priority}
              onChange={(e) => setFilters(f => ({ ...f, priority: e.target.value as any }))}
            >
              <option value="all">Todos os pedidos</option>
              <option value="critical">🚨 Críticos</option>
              <option value="high">⚠️ Atrasados (+15d)</option>
              <option value="medium">⚡ Atenção (+10d)</option>
              <option value="normal">✓ Normais</option>
            </select>
            <select
              className="input select w-full md:w-48"
              value={filters.sortBy}
              onChange={(e) => setFilters(f => ({ ...f, sortBy: e.target.value as any }))}
            >
              <option value="daysSinceOrder">Data do pedido</option>
              <option value="daysInTransit">Dias em trânsito</option>
              <option value="lastTrackingUpdate">Última atualização</option>
              <option value="orderNumber">Número do pedido</option>
            </select>
            <button
              className="btn btn-secondary"
              onClick={() => setFilters(f => ({ ...f, sortOrder: f.sortOrder === 'desc' ? 'asc' : 'desc' }))}
            >
              {filters.sortOrder === 'desc' ? '↓' : '↑'}
            </button>
          </div>
          <div className="mt-3 text-xs text-gray-500">
            Mostrando {filteredOrders.length} de {orders.length} pedidos
          </div>
        </div>

        {/* LISTA DE PEDIDOS */}
        <div>
          {loading && orders.length === 0 ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card p-4 mb-3 animate-pulse">
                <div className="h-6 w-32 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 w-48 bg-gray-200 rounded mb-2"></div>
                <div className="h-4 w-64 bg-gray-200 rounded"></div>
              </div>
            ))
          ) : filteredOrders.length === 0 ? (
            <div className="card p-8 text-center">
              <p className="text-gray-500">
                {filters.search || filters.priority !== 'all'
                  ? 'Nenhum pedido encontrado com os filtros'
                  : 'Nenhum pedido em trânsito'}
              </p>
            </div>
          ) : (
            filteredOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                shopifyDomain={shopifyDomain}
                onCopyEmail={copyEmail}
                copiedEmail={copiedEmail}
              />
            ))
          )}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-gray-200 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-xs text-gray-400">
          ORNE™ Tracking Dashboard • Shopify + 17TRACK
        </div>
      </footer>
    </div>
  );
}

// =============================================
// CARD DE MÉTRICA
// =============================================
function MetricCard({ label, value, sublabel, color = 'default' }: { 
  label: string; 
  value: string | number; 
  sublabel?: string;
  color?: 'default' | 'yellow' | 'red';
}) {
  const colorClasses = {
    default: 'bg-white',
    yellow: 'bg-yellow-50 border-yellow-200',
    red: 'bg-red-50 border-red-200',
  };

  return (
    <div className={`card p-5 border ${colorClasses[color]}`}>
      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">{label}</p>
      <p className="text-3xl font-bold text-black">{value}</p>
      {sublabel && <p className="text-xs text-gray-400 mt-1">{sublabel}</p>}
    </div>
  );
}

// =============================================
// CARD DO PEDIDO
// =============================================
function OrderCard({ order, shopifyDomain, onCopyEmail, copiedEmail }: { 
  order: Order; 
  shopifyDomain: string;
  onCopyEmail: (email: string) => void;
  copiedEmail: string | null;
}) {
  const priorityStyles = getPriorityStyles(order.priority);
  const carrier = order.trackingNumber ? detectCarrier(order.trackingNumber) : null;
  const whatsappLink = getWhatsAppLink(order.customerPhone, `Olá ${order.customerName.split(' ')[0]}! Aqui é da ORNE™. `);
  
  // Link para o pedido na Shopify
  const shopifyOrderUrl = `https://${shopifyDomain}/admin/orders/${order.id}`;
  
  // Link para rastreamento no 17TRACK
  const trackingUrl = order.trackingNumber 
    ? `https://t.17track.net/en#nums=${order.trackingNumber}`
    : null;

  // Últimas 3 atualizações de rastreamento
  const lastThreeEvents = order.trackingEvents.slice(0, 3);

  return (
    <div className={`card mb-3 overflow-hidden border-l-4 ${priorityStyles.borderColor}`}>
      <div className="p-4">
        {/* CABEÇALHO */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Número do pedido (CLICÁVEL → SHOPIFY) */}
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <a 
                href={shopifyOrderUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-lg hover:text-blue-600 hover:underline flex items-center gap-1"
                title="Abrir pedido na Shopify"
              >
                {order.orderName}
                <ExternalLinkIcon />
              </a>
              
              {/* Badge de prioridade */}
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${priorityStyles.bgColor} ${priorityStyles.textColor}`}>
                {priorityStyles.icon} {priorityStyles.label}
              </span>
              
              {/* Badge da transportadora */}
              {carrier && (
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                  {carrier.name}
                </span>
              )}
            </div>

            {/* Nome do cliente */}
            <p className="text-sm text-gray-700 font-medium">{order.customerName}</p>
            
            {/* E-mail com botão de copiar */}
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-gray-500">{order.customerEmail}</span>
              <button
                onClick={() => onCopyEmail(order.customerEmail)}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Copiar e-mail"
              >
                {copiedEmail === order.customerEmail ? (
                  <span className="text-green-600"><CheckIcon /></span>
                ) : (
                  <span className="text-gray-400"><CopyIcon /></span>
                )}
              </button>
            </div>
            
            {/* Telefone com botão WhatsApp */}
            {order.customerPhone && (
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-500">{order.customerPhone}</span>
                {whatsappLink && (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 hover:bg-green-50 rounded transition-colors text-green-600"
                    title="Abrir WhatsApp"
                  >
                    <WhatsAppIcon />
                  </a>
                )}
              </div>
            )}

            {/* Motivo de problema */}
            {order.hasAbnormalStatus && order.abnormalReason && (
              <p className="text-sm text-red-600 font-medium mt-2">{order.abnormalReason}</p>
            )}
          </div>

          {/* Dias úteis */}
          <div className="text-right">
            <p className="text-2xl font-bold">{order.businessDaysSinceOrder}</p>
            <p className="text-xs text-gray-500">dias úteis</p>
          </div>
        </div>

        {/* GRID DE INFORMAÇÕES */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-500">Data do pedido</p>
            <p className="text-sm font-medium">{formatDate(order.createdAt)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Valor</p>
            <p className="text-sm font-medium">{formatCurrency(order.totalPrice, order.currency)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Rastreio</p>
            {order.trackingNumber && trackingUrl ? (
              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium font-mono text-blue-600 hover:underline flex items-center gap-1"
                title="Rastrear no 17TRACK"
              >
                {order.trackingNumber}
                <ExternalLinkIcon />
              </a>
            ) : (
              <p className="text-sm font-medium font-mono text-gray-400">Não disponível</p>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500">Status</p>
            <p className="text-sm font-medium">{order.trackingStatus || 'Aguardando'}</p>
          </div>
        </div>

        {/* ÚLTIMAS 3 ATUALIZAÇÕES DE RASTREAMENTO */}
        {lastThreeEvents.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500 font-semibold mb-2">Últimas atualizações</p>
            <div className="space-y-2">
              {lastThreeEvents.map((event, index) => (
                <div key={index} className="flex gap-3 text-sm bg-gray-50 p-2 rounded">
                  <span className="text-gray-400 whitespace-nowrap text-xs">
                    {event.date} {event.time}
                  </span>
                  <div className="flex-1">
                    <p className="text-gray-700 text-xs">{event.description}</p>
                    {event.location && (
                      <p className="text-xs text-gray-400">{event.location}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
