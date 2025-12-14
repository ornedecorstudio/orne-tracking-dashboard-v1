// types/index.ts - Tipos TypeScript para a Dashboard ORNE™

// =============================================
// NÍVEIS DE PRIORIDADE DO PEDIDO
// =============================================
export type PriorityLevel = 
  | 'normal'    // Menos de 10 dias úteis - tudo OK
  | 'medium'    // 10-14 dias úteis - atrasado mas não muito (amarelo)
  | 'high'      // 15+ dias úteis - atrasado (vermelho)
  | 'critical'; // Status anormal detectado (vermelho piscando)

// =============================================
// STATUS DE RASTREAMENTO 17TRACK
// =============================================
// Códigos oficiais da 17TRACK API
export type TrackingStatus =
  | 'NotFound'           // Não encontrado
  | 'InfoReceived'       // Informação recebida
  | 'InTransit'          // Em trânsito
  | 'OutForDelivery'     // Saiu para entrega
  | 'Delivered'          // Entregue
  | 'AvailableForPickup' // Disponível para retirada (ALERTA!)
  | 'Exception'          // Exceção/problema (ALERTA!)
  | 'Expired';           // Expirado

// =============================================
// STATUS ANORMAIS QUE GERAM ALERTA
// =============================================
export const ABNORMAL_STATUSES = [
  'Exception',           // Qualquer exceção
  'AvailableForPickup',  // Pronto para retirada (cliente precisa buscar)
  'Expired',             // Rastreamento expirado
] as const;

// Sub-status problemáticos (verificados no texto do evento)
export const PROBLEM_KEYWORDS = [
  // Alfândega
  'alfândega',
  'customs',
  'aduana',
  'desembaraço',
  'tributação',
  'taxa',
  'imposto',
  'documento',
  'documentação',
  'rfb',
  'receita federal',
  
  // Falha na entrega
  'falha',
  'tentativa',
  'ausente',
  'não entregue',
  'endereço incorreto',
  'endereço insuficiente',
  'recusado',
  'devolvido',
  'retorno',
  
  // Aguardando ação
  'aguardando retirada',
  'disponível para retirada',
  'ponto de coleta',
  'locker',
  
  // Problemas
  'extraviado',
  'perdido',
  'danificado',
  'avariado',
] as const;

// =============================================
// ESTRUTURA DO PEDIDO
// =============================================
export interface Order {
  // Dados do Shopify
  id: string;
  orderNumber: string;
  orderName: string;          // Ex: "#1234"
  createdAt: string;          // Data do pedido
  customerName: string;
  customerEmail: string;
  
  // Dados de envio
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrierName: string | null; // Correios, Loggi, etc
  shippedAt: string | null;   // Data de envio
  
  // Status calculados
  priority: PriorityLevel;
  daysSinceOrder: number;     // Dias desde o pedido
  daysInTransit: number;      // Dias desde o envio
  businessDaysSinceOrder: number; // Dias ÚTEIS desde o pedido
  
  // Dados do rastreamento (17TRACK)
  trackingStatus: TrackingStatus | null;
  trackingEvents: TrackingEvent[];
  lastTrackingUpdate: string | null;
  hasAbnormalStatus: boolean;
  abnormalReason: string | null;
  
  // Valores
  totalPrice: string;
  currency: string;
}

// =============================================
// EVENTO DE RASTREAMENTO
// =============================================
export interface TrackingEvent {
  date: string;
  time: string;
  description: string;
  location: string;
  status: string;
}

// =============================================
// RESPOSTA DA API 17TRACK
// =============================================
export interface Track17Response {
  code: number;
  data: {
    accepted: Array<{
      number: string;
      carrier: number;
    }>;
    rejected: Array<{
      number: string;
      error: {
        code: number;
        message: string;
      };
    }>;
  };
}

export interface Track17StatusResponse {
  code: number;
  data: {
    number: string;
    carrier: number;
    param: string | null;
    tag: string;
    track_info: {
      shipping_info: {
        shipper_address: {
          country: string;
          state: string;
          city: string;
        };
        recipient_address: {
          country: string;
          state: string;
          city: string;
        };
      };
      latest_status: {
        status: string;
        sub_status: string;
      };
      latest_event: {
        time_iso: string;
        time_utc: string;
        description: string;
        location: string;
      };
      tracking: {
        providers: Array<{
          provider: {
            name: string;
            country: string;
          };
          events: Array<{
            time_iso: string;
            time_utc: string;
            description: string;
            location: string;
            stage: string;
            sub_status: string;
          }>;
        }>;
      };
      time_metrics: {
        days_after_order: number;
        days_of_transit: number;
        days_of_transit_done: number;
        days_after_last_update: number;
      };
    };
  };
}

// =============================================
// MÉTRICAS DA DASHBOARD
// =============================================
export interface DashboardMetrics {
  totalInTransit: number;
  withProblems: number;
  critical: number;
  mediumPriority: number;
  highPriority: number;
  averageTransitDays: number;
  oldestOrderDays: number;
}

// =============================================
// FILTROS DA DASHBOARD
// =============================================
export interface DashboardFilters {
  search: string;
  priority: 'all' | 'normal' | 'medium' | 'high' | 'critical';
  sortBy: 'daysSinceOrder' | 'daysInTransit' | 'lastTrackingUpdate' | 'orderNumber';
  sortOrder: 'asc' | 'desc';
}
