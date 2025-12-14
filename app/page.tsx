'use client';

// app/page.tsx - Interface principal da Dashboard ORNE™

import { useState, useEffect, useCallback } from 'react';
import { Order, DashboardMetrics, DashboardFilters, PriorityLevel } from '@/types';
import { formatDate, formatDateTime, formatCurrency, getPriorityStyles, detectCarrier } from '@/lib/utils';

// =============================================
// ÍCONES SVG (para não depender de biblioteca externa)
// =============================================
const RefreshIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>
);

const SearchIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"></circle>
    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
  </svg>
);

const PackageIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16.5 9.4 7.55 4.24"></path>
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
    <polyline points="3.29 7 12 12 20.71 7"></polyline>
    <line x1="12" y1="22" x2="12" y2="12"></line>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
    <polyline points="15 3 21 3 21 9"></polyline>
    <line x1="10" y1="14" x2="21" y2="3"></line>
  </svg>
);

// =============================================
// COMPONENTE PRINCIPAL DA DASHBOARD
// =============================================
export default function Dashboard() {
  // Estados
  const [orders, setOrders] = useState<Order[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [filters, setFilters] = useState<DashboardFilters>({
    search: '',
    priority: 'all',
    sortBy: 'daysSinceOrder',
    sortOrder: 'desc',
  });
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  // =============================================
  // BUSCAR PEDIDOS DA API
  // =============================================
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/orders');
      
      if (!response.ok) {
        throw new Error(`Erro ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      setOrders(data.orders || []);
      setMetrics(data.metrics || null);
      setLastUpdate(data.lastUpdate || new Date().toISOString());
    } catch (err) {
      console.error('Erro ao buscar pedidos:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  // Carregar ao montar componente
  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // =============================================
  // FILTRAR E ORDENAR PEDIDOS
  // =============================================
  const filteredOrders = orders
    .filter(order => {
      // Filtro de busca
      if (filters.search) {
        const search = filters.search.toLowerCase();
        const matchesSearch = 
          order.orderName.toLowerCase().includes(search) ||
          order.customerName.toLowerCase().includes(search) ||
          order.trackingNumber?.toLowerCase().includes(search) ||
          order.customerEmail.toLowerCase().includes(search);
        if (!matchesSearch) return false;
      }
      
      // Filtro de prioridade
      if (filters.priority !== 'all' && order.priority !== filters.priority) {
        return false;
      }
      
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

  // =============================================
  // RENDERIZAÇÃO
  // =============================================
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
              <span className={loading ? 'animate-spin' : ''}>
                <RefreshIcon />
              </span>
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
            <button 
              onClick={fetchOrders}
              className="mt-3 text-sm text-red-700 underline hover:no-underline"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* MÉTRICAS */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
            <MetricCard 
              label="Em trânsito" 
              value={metrics.totalInTransit} 
              sublabel="pedidos ativos"
            />
            <MetricCard 
              label="Atenção" 
              value={metrics.mediumPriority} 
              color="yellow"
              sublabel="+10 dias úteis"
            />
            <MetricCard 
              label="Atrasados" 
              value={metrics.highPriority} 
              color="red"
              sublabel="+15 dias úteis"
            />
            <MetricCard 
              label="Críticos" 
              value={metrics.critical} 
              color="red"
              sublabel="com problemas"
            />
            <MetricCard 
              label="Média trânsito" 
              value={`${metrics.averageTransitDays}d`}
              sublabel="dias em média"
            />
            <MetricCard 
              label="Mais antigo" 
              value={`${metrics.oldestOrderDays}d`} 
              sublabel="desde o pedido"
            />
          </div>
        )}

        {/* FILTROS */}
        <div className="card p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Busca */}
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

            {/* Filtro de prioridade */}
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

            {/* Ordenação */}
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

            {/* Direção da ordenação */}
            <button
              className="btn btn-secondary"
              onClick={() => setFilters(f => ({ 
                ...f, 
                sortOrder: f.sortOrder === 'desc' ? 'asc' : 'desc' 
              }))}
              title={filters.sortOrder === 'desc' ? 'Maior para menor' : 'Menor para maior'}
            >
              {filters.sortOrder === 'desc' ? '↓' : '↑'}
            </button>
          </div>

          <div className="flex items-center gap-2 mt-3 text-xs text-gray-500">
            <span>Mostrando {filteredOrders.length} de {orders.length} pedidos</span>
          </div>
        </div>

        {/* LISTA DE PEDIDOS */}
        <div>
          {loading && orders.length === 0 ? (
            // Skeleton loading
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card p-4 mb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="skeleton h-6 w-32 mb-2"></div>
                    <div className="skeleton h-4 w-48 mb-2"></div>
                    <div className="skeleton h-4 w-64"></div>
                  </div>
                  <div className="skeleton h-16 w-24"></div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-100">
                  <div className="skeleton h-10 w-full"></div>
                  <div className="skeleton h-10 w-full"></div>
                  <div className="skeleton h-10 w-full"></div>
                </div>
              </div>
            ))
          ) : filteredOrders.length === 0 ? (
            <div className="card p-8 text-center">
              <PackageIcon />
              <p className="text-gray-500 mt-4">
                {filters.search || filters.priority !== 'all'
                  ? 'Nenhum pedido encontrado com os filtros aplicados'
                  : 'Nenhum pedido em trânsito no momento'}
              </p>
            </div>
          ) : (
            filteredOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                isExpanded={expandedOrder === order.id}
                onToggle={() => setExpandedOrder(
                  expandedOrder === order.id ? null : order.id
                )}
              />
            ))
          )}
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-gray-200 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-xs text-gray-400">
          ORNE™ Tracking Dashboard • Dados do Shopify + 17TRACK
        </div>
      </footer>
    </div>
  );
}

// =============================================
// COMPONENTE: CARD DE MÉTRICA
// =============================================
function MetricCard({ 
  label, 
  value, 
  sublabel,
  color = 'default' 
}: { 
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
      <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-1">
        {label}
      </p>
      <p className="text-3xl font-bold text-black">{value}</p>
      {sublabel && (
        <p className="text-xs text-gray-400 mt-1">{sublabel}</p>
      )}
    </div>
  );
}

// =============================================
// COMPONENTE: CARD DO PEDIDO
// =============================================
function OrderCard({ 
  order, 
  isExpanded, 
  onToggle 
}: { 
  order: Order; 
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const priorityStyles = getPriorityStyles(order.priority);
  const carrier = order.trackingNumber ? detectCarrier(order.trackingNumber) : null;

  return (
    <div className={`card mb-3 overflow-hidden border-l-4 ${priorityStyles.borderColor}`}>
      {/* Cabeçalho do pedido (sempre visível) */}
      <div 
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            {/* Nome do pedido e badges */}
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-lg">{order.orderName}</h3>
              
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

            {/* Informações do cliente */}
            <p className="text-sm text-gray-600">{order.customerName}</p>
            <p className="text-xs text-gray-400">{order.customerEmail}</p>

            {/* Motivo de problema (se houver) */}
            {order.hasAbnormalStatus && order.abnormalReason && (
              <p className="text-sm text-red-600 font-medium mt-2">
                {order.abnormalReason}
              </p>
            )}
          </div>

          {/* Métricas rápidas */}
          <div className="text-right">
            <p className="text-2xl font-bold">{order.businessDaysSinceOrder}</p>
            <p className="text-xs text-gray-500">dias úteis</p>
          </div>
        </div>

        {/* Grid de informações resumidas */}
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
            <p className="text-sm font-medium font-mono">
              {order.trackingNumber || 'Não disponível'}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Status</p>
            <p className="text-sm font-medium">
              {order.trackingStatus || 'Aguardando'}
            </p>
          </div>
        </div>
      </div>

      {/* Detalhes expandidos */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50">
          {/* Links úteis */}
          <div className="flex gap-4 py-3">
            {order.trackingUrl && (
              <a
                href={order.trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                Rastrear no site <ExternalLinkIcon />
              </a>
            )}
            {order.trackingNumber && (
              <a
                href={`https://t.17track.net/en#nums=${order.trackingNumber}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                Ver no 17TRACK <ExternalLinkIcon />
              </a>
            )}
          </div>

          {/* Eventos de rastreamento */}
          {order.trackingEvents && order.trackingEvents.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-3">Histórico de Rastreamento</h4>
              <div className="space-y-2">
                {order.trackingEvents.slice(0, 5).map((event, index) => (
                  <div 
                    key={index} 
                    className="flex gap-3 text-sm p-2 rounded bg-white"
                  >
                    <div className="text-gray-400 whitespace-nowrap">
                      {event.date} {event.time}
                    </div>
                    <div className="flex-1">
                      <p className="text-gray-700">{event.description}</p>
                      {event.location && (
                        <p className="text-xs text-gray-400">{event.location}</p>
                      )}
                    </div>
                  </div>
                ))}
                {order.trackingEvents.length > 5 && (
                  <p className="text-xs text-gray-400 text-center">
                    + {order.trackingEvents.length - 5} eventos anteriores
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
