// lib/utils.ts - Funções utilitárias para a Dashboard ORNE™

import { PriorityLevel, PROBLEM_KEYWORDS, ABNORMAL_STATUSES, TrackingEvent } from '@/types';

// =============================================
// FERIADOS NACIONAIS BRASILEIROS 2024-2026
// =============================================
const BRAZILIAN_HOLIDAYS: string[] = [
  // 2024
  '2024-01-01', // Confraternização Universal
  '2024-02-12', // Carnaval
  '2024-02-13', // Carnaval
  '2024-03-29', // Sexta-feira Santa
  '2024-04-21', // Tiradentes
  '2024-05-01', // Dia do Trabalho
  '2024-05-30', // Corpus Christi
  '2024-09-07', // Independência
  '2024-10-12', // Nossa Senhora Aparecida
  '2024-11-02', // Finados
  '2024-11-15', // Proclamação da República
  '2024-11-20', // Consciência Negra
  '2024-12-25', // Natal
  
  // 2025
  '2025-01-01', // Confraternização Universal
  '2025-03-03', // Carnaval
  '2025-03-04', // Carnaval
  '2025-04-18', // Sexta-feira Santa
  '2025-04-21', // Tiradentes
  '2025-05-01', // Dia do Trabalho
  '2025-06-19', // Corpus Christi
  '2025-09-07', // Independência
  '2025-10-12', // Nossa Senhora Aparecida
  '2025-11-02', // Finados
  '2025-11-15', // Proclamação da República
  '2025-11-20', // Consciência Negra
  '2025-12-25', // Natal
  
  // 2026
  '2026-01-01', // Confraternização Universal
  '2026-02-16', // Carnaval
  '2026-02-17', // Carnaval
  '2026-04-03', // Sexta-feira Santa
  '2026-04-21', // Tiradentes
  '2026-05-01', // Dia do Trabalho
  '2026-06-04', // Corpus Christi
  '2026-09-07', // Independência
  '2026-10-12', // Nossa Senhora Aparecida
  '2026-11-02', // Finados
  '2026-11-15', // Proclamação da República
  '2026-11-20', // Consciência Negra
  '2026-12-25', // Natal
];

// =============================================
// VERIFICAR SE É DIA ÚTIL
// =============================================
function isBusinessDay(date: Date): boolean {
  const dayOfWeek = date.getDay();
  
  // Sábado (6) ou Domingo (0) = não é dia útil
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  
  // Verificar se é feriado
  const dateString = date.toISOString().split('T')[0];
  if (BRAZILIAN_HOLIDAYS.includes(dateString)) {
    return false;
  }
  
  return true;
}

// =============================================
// CALCULAR DIAS ÚTEIS ENTRE DUAS DATAS
// =============================================
export function calculateBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const currentDate = new Date(startDate);
  
  // Ajustar para início do dia
  currentDate.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  
  while (currentDate < end) {
    currentDate.setDate(currentDate.getDate() + 1);
    if (isBusinessDay(currentDate)) {
      count++;
    }
  }
  
  return count;
}

// =============================================
// CALCULAR DIAS CORRIDOS ENTRE DUAS DATAS
// =============================================
export function calculateDaysBetween(startDate: Date, endDate: Date): number {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

// =============================================
// DETERMINAR PRIORIDADE DO PEDIDO
// =============================================
export function determinePriority(
  businessDays: number,
  hasAbnormalStatus: boolean
): PriorityLevel {
  // Se tem status anormal, é crítico (independente do tempo)
  if (hasAbnormalStatus) {
    return 'critical';
  }
  
  // 15+ dias úteis = prioridade ALTA (vermelho)
  if (businessDays >= 15) {
    return 'high';
  }
  
  // 10-14 dias úteis = prioridade MÉDIA (amarelo)
  if (businessDays >= 10) {
    return 'medium';
  }
  
  // Menos de 10 dias úteis = normal (verde)
  return 'normal';
}

// =============================================
// VERIFICAR SE TEM STATUS ANORMAL
// =============================================
export function checkAbnormalStatus(
  trackingStatus: string | null,
  trackingEvents: TrackingEvent[]
): { hasAbnormal: boolean; reason: string | null } {
  // Verificar status principal
  if (trackingStatus && ABNORMAL_STATUSES.includes(trackingStatus as any)) {
    return {
      hasAbnormal: true,
      reason: getAbnormalReasonFromStatus(trackingStatus),
    };
  }
  
  // Verificar eventos de rastreamento por palavras-chave
  for (const event of trackingEvents) {
    const description = event.description.toLowerCase();
    
    for (const keyword of PROBLEM_KEYWORDS) {
      if (description.includes(keyword)) {
        return {
          hasAbnormal: true,
          reason: getAbnormalReasonFromKeyword(keyword, event.description),
        };
      }
    }
  }
  
  return { hasAbnormal: false, reason: null };
}

// =============================================
// OBTER DESCRIÇÃO DO MOTIVO ANORMAL
// =============================================
function getAbnormalReasonFromStatus(status: string): string {
  const reasons: Record<string, string> = {
    'Exception': '⚠️ Exceção no rastreamento',
    'AvailableForPickup': '📦 Aguardando retirada no ponto',
    'Expired': '⏰ Rastreamento expirado',
  };
  return reasons[status] || '⚠️ Status anormal detectado';
}

function getAbnormalReasonFromKeyword(keyword: string, fullDescription: string): string {
  // Categorizar por tipo de problema
  if (['alfândega', 'customs', 'aduana', 'desembaraço', 'tributação', 'taxa', 'imposto', 'documento', 'documentação', 'rfb', 'receita federal'].includes(keyword)) {
    return '🛃 Problema na alfândega/tributação';
  }
  
  if (['falha', 'tentativa', 'ausente', 'não entregue'].includes(keyword)) {
    return '❌ Falha na tentativa de entrega';
  }
  
  if (['endereço incorreto', 'endereço insuficiente'].includes(keyword)) {
    return '📍 Problema com endereço';
  }
  
  if (['recusado', 'devolvido', 'retorno'].includes(keyword)) {
    return '↩️ Pedido recusado/devolvido';
  }
  
  if (['aguardando retirada', 'disponível para retirada', 'ponto de coleta', 'locker'].includes(keyword)) {
    return '📦 Aguardando retirada pelo cliente';
  }
  
  if (['extraviado', 'perdido'].includes(keyword)) {
    return '🚨 Possível extravio';
  }
  
  if (['danificado', 'avariado'].includes(keyword)) {
    return '💥 Pacote possivelmente danificado';
  }
  
  return `⚠️ Atenção: ${fullDescription.slice(0, 50)}...`;
}

// =============================================
// FORMATAR DATA PARA EXIBIÇÃO
// =============================================
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// =============================================
// FORMATAR VALOR MONETÁRIO
// =============================================
export function formatCurrency(value: string | number, currency: string = 'BRL'): string {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency,
  }).format(numValue);
}

// =============================================
// DETECTAR TRANSPORTADORA PELO CÓDIGO
// =============================================
export function detectCarrier(trackingNumber: string): { name: string; code: number } {
  const tracking = trackingNumber.toUpperCase().trim();
  
  // Correios Brasil (códigos com 13 caracteres terminando em BR)
  if (/^[A-Z]{2}\d{9}BR$/.test(tracking)) {
    return { name: 'Correios', code: 100023 }; // Código 17TRACK para Correios
  }
  
  // Loggi (8 caracteres alfanuméricos)
  if (/^[A-Z0-9]{8}$/.test(tracking) && !tracking.endsWith('BR')) {
    return { name: 'Loggi', code: 190271 }; // Código 17TRACK para Loggi
  }
  
  // Jadlog (14 dígitos)
  if (/^\d{14}$/.test(tracking)) {
    return { name: 'Jadlog', code: 100013 }; // Código 17TRACK para Jadlog
  }
  
  // Total Express
  if (/^[A-Z]{3}\d{11}$/.test(tracking)) {
    return { name: 'Total Express', code: 190232 };
  }
  
  // Códigos internacionais (China Post, Yanwen, etc)
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(tracking) && !tracking.endsWith('BR')) {
    // Determinar país de origem
    const countryCode = tracking.slice(-2);
    if (countryCode === 'CN') {
      return { name: 'China Post', code: 3011 };
    }
    return { name: 'Internacional', code: 0 }; // Auto-detect
  }
  
  // Cainiao / AliExpress
  if (/^LP\d{14}$/.test(tracking) || /^CAINIAO/.test(tracking)) {
    return { name: 'Cainiao', code: 190008 };
  }
  
  // Yanwen
  if (/^YT\d{16}$/.test(tracking)) {
    return { name: 'Yanwen', code: 190012 };
  }
  
  // 4PX
  if (/^4PX/.test(tracking)) {
    return { name: '4PX', code: 190002 };
  }
  
  // Não identificado - deixar 17TRACK detectar automaticamente
  return { name: 'Auto-detectar', code: 0 };
}

// =============================================
// CORES E ESTILOS POR PRIORIDADE
// =============================================
export function getPriorityStyles(priority: PriorityLevel): {
  bgColor: string;
  textColor: string;
  borderColor: string;
  label: string;
  icon: string;
} {
  const styles = {
    normal: {
      bgColor: 'bg-green-50',
      textColor: 'text-green-700',
      borderColor: 'border-green-200',
      label: 'Normal',
      icon: '✓',
    },
    medium: {
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-700',
      borderColor: 'border-yellow-300',
      label: 'Atenção',
      icon: '⚡',
    },
    high: {
      bgColor: 'bg-red-50',
      textColor: 'text-red-700',
      borderColor: 'border-red-300',
      label: 'Atrasado',
      icon: '⚠️',
    },
    critical: {
      bgColor: 'bg-red-100',
      textColor: 'text-red-800',
      borderColor: 'border-red-400',
      label: 'Crítico',
      icon: '🚨',
    },
  };
  
  return styles[priority];
}
