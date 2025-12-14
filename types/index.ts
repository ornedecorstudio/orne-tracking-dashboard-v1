// types/index.ts - Tipos TypeScript para a Dashboard ORNE™

export type PriorityLevel = 
  | 'normal'    // Menos de 10 dias úteis
  | 'medium'    // 10-14 dias úteis (amarelo)
  | 'high'      // 15+ dias úteis (vermelho)
  | 'critical'; // Status anormal (vermelho piscando)

export type TrackingStatus =
  | 'NotFound'
  | 'InfoReceived'
  | 'InTransit'
  | 'OutForDelivery'
  | 'Delivered'
  | 'AvailableForPickup'
  | 'Exception'
  | 'Expired';

export const ABNORMAL_STATUSES = [
  'Exception',
  'AvailableForPickup',
  'Expired',
] as const;

export const PROBLEM_KEYWORDS = [
  'alfândega', 'customs', 'aduana', 'desembaraço', 'tributação',
  'taxa', 'imposto', 'documento', 'documentação', 'rfb', 'receita federal',
  'falha', 'tentativa', 'ausente', 'não entregue',
  'endereço incorreto', 'endereço insuficiente',
  'recusado', 'devolvido', 'retorno',
  'aguardando retirada', 'disponível para retirada', 'ponto de coleta', 'locker',
  'extraviado', 'perdido', 'danificado', 'avariado',
] as const;

export interface Order {
  id: string;
  orderNumber: string;
  orderName: string;
  createdAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrierName: string | null;
  shippedAt: string | null;
  
  priority: PriorityLevel;
  daysSinceOrder: number;
  daysInTransit: number;
  businessDaysSinceOrder: number;
  
  trackingStatus: TrackingStatus | null;
  trackingEvents: TrackingEvent[];
  lastTrackingUpdate: string | null;
  hasAbnormalStatus: boolean;
  abnormalReason: string | null;
  
  totalPrice: string;
  currency: string;
}

export interface TrackingEvent {
  date: string;
  time: string;
  description: string;
  location: string;
  status: string;
}

export interface DashboardMetrics {
  totalInTransit: number;
  withProblems: number;
  critical: number;
  mediumPriority: number;
  highPriority: number;
  averageTransitDays: number;
  oldestOrderDays: number;
}

export interface DashboardFilters {
  search: string;
  priority: 'all' | 'normal' | 'medium' | 'high' | 'critical';
  sortBy: 'daysSinceOrder' | 'daysInTransit' | 'lastTrackingUpdate' | 'orderNumber';
  sortOrder: 'asc' | 'desc';
}
