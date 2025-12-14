// lib/utils.ts - Funções utilitárias para a Dashboard ORNE™

import { PriorityLevel, PROBLEM_KEYWORDS, ABNORMAL_STATUSES, TrackingEvent } from '@/types';

// =============================================
// FERIADOS NACIONAIS BRASILEIROS 2024-2026
// =============================================
const BRAZILIAN_HOLIDAYS: string[] = [
  // 2024
  '2024-01-01', '2024-02-12', '2024-02-13', '2024-03-29', '2024-04-21',
  '2024-05-01', '2024-05-30', '2024-09-07', '2024-10-12', '2024-11-02',
  '2024-11-15', '2024-11-20', '2024-12-25',
  // 2025
  '2025-01-01', '2025-03-03', '2025-03-04', '2025-04-18', '2025-04-21',
  '2025-05-01', '2025-06-19', '2025-09-07', '2025-10-12', '2025-11-02',
  '2025-11-15', '2025-11-20', '2025-12-25',
  // 2026
  '2026-01-01', '2026-02-16', '2026-02-17', '2026-04-03', '2026-04-21',
  '2026-05-01', '2026-06-04', '2026-09-07', '2026-10-12', '2026-11-02',
  '2026-11-15', '2026-11-20', '2026-12-25',
];

// =============================================
// VERIFICAR SE É DIA ÚTIL
// =============================================
function isBusinessDay(date: Date): boolean {
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;
  const dateString = date.toISOString().split('T')[0];
  if (BRAZILIAN_HOLIDAYS.includes(dateString)) return false;
  return true;
}

// =============================================
// CALCULAR DIAS ÚTEIS ENTRE DUAS DATAS
// =============================================
export function calculateBusinessDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const currentDate = new Date(startDate);
  currentDate.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);
  
  while (currentDate < end) {
    currentDate.setDate(currentDate.getDate() + 1);
    if (isBusinessDay(currentDate)) count++;
  }
  return count;
}

// =============================================
// CALCULAR DIAS CORRIDOS ENTRE DUAS DATAS
// =============================================
export function calculateDaysBetween(startDate: Date, endDate: Date): number {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// =============================================
// DETERMINAR PRIORIDADE DO PEDIDO
// =============================================
export function determinePriority(
  businessDays: number,
  hasAbnormalStatus: boolean
): PriorityLevel {
  if (hasAbnormalStatus) return 'critical';
  if (businessDays >= 15) return 'high';
  if (businessDays >= 10) return 'medium';
  return 'normal';
}

// =============================================
// VERIFICAR SE TEM STATUS ANORMAL
// =============================================
export function checkAbnormalStatus(
  trackingStatus: string | null,
  trackingEvents: TrackingEvent[]
): { hasAbnormal: boolean; reason: string | null } {
  if (trackingStatus && ABNORMAL_STATUSES.includes(trackingStatus as any)) {
    return {
      hasAbnormal: true,
      reason: getAbnormalReasonFromStatus(trackingStatus),
    };
  }
  
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

function getAbnormalReasonFromStatus(status: string): string {
  const reasons: Record<string, string> = {
    'Exception': '⚠️ Exceção no rastreamento',
    'AvailableForPickup': '📦 Aguardando retirada no ponto',
    'Expired': '⏰ Rastreamento expirado',
  };
  return reasons[status] || '⚠️ Status anormal detectado';
}

function getAbnormalReasonFromKeyword(keyword: string, fullDescription: string): string {
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
// CÓDIGO LOGGI CORRETO: 100457 (Loggi Express BR)
// =============================================
export function detectCarrier(trackingNumber: string): { name: string; code: number } {
  const tracking = trackingNumber.toUpperCase().trim();
  
  // =============================================
  // CORREIOS BRASIL - Códigos com 13 caracteres terminando em BR
  // Exemplos: NM985773507BR, AA123456789BR
  // Padrão: 2 letras + 9 números + BR
  // =============================================
  if (/^[A-Z]{2}\d{9}BR$/.test(tracking)) {
    return { name: 'Correios', code: 2151 }; // Correios Brazil código oficial
  }
  
  // =============================================
  // LOGGI - Códigos de 8 caracteres alfanuméricos
  // CÓDIGO CORRETO: 100457 (Loggi Express BR)
  // Exemplos: GBEFUWCT, GNTUMZCG, GVFHSTCE
  // =============================================
  if (/^[A-Z0-9]{8}$/.test(tracking) && !tracking.endsWith('BR')) {
    return { name: 'Loggi', code: 100457 }; // CÓDIGO CORRETO!
  }
  
  // =============================================
  // JADLOG - 14 dígitos numéricos
  // Exemplo: 10000000000000
  // =============================================
  if (/^\d{14}$/.test(tracking)) {
    return { name: 'Jadlog', code: 100013 };
  }
  
  // =============================================
  // TOTAL EXPRESS - 3 letras + 11 números
  // =============================================
  if (/^[A-Z]{3}\d{11}$/.test(tracking)) {
    return { name: 'Total Express', code: 190232 };
  }
  
  // =============================================
  // CAINIAO / ALIEXPRESS
  // Exemplos: LP00123456789CN, CAINIAO...
  // =============================================
  if (/^LP\d{14}/.test(tracking) || /^CAINIAO/.test(tracking)) {
    return { name: 'Cainiao', code: 190008 };
  }
  
  // =============================================
  // YANWEN - Começa com YT + 16 dígitos
  // =============================================
  if (/^YT\d{16}$/.test(tracking)) {
    return { name: 'Yanwen', code: 190012 };
  }
  
  // =============================================
  // 4PX - Começa com 4PX
  // =============================================
  if (/^4PX/.test(tracking)) {
    return { name: '4PX', code: 190002 };
  }
  
  // =============================================
  // CÓDIGOS INTERNACIONAIS - 2 letras + 9 números + 2 letras (país)
  // Exemplo: LP123456789CN (China)
  // =============================================
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(tracking) && !tracking.endsWith('BR')) {
    const countryCode = tracking.slice(-2);
    if (countryCode === 'CN') {
      return { name: 'China Post', code: 3011 };
    }
    return { name: 'Internacional', code: 0 };
  }
  
  // Não identificado - deixar 17TRACK detectar
  return { name: 'Auto', code: 0 };
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

// =============================================
// FORMATAR TELEFONE PARA WHATSAPP
// Remove caracteres especiais e adiciona código do país
// =============================================
export function formatPhoneForWhatsApp(phone: string | null): string | null {
  if (!phone) return null;
  
  // Remove tudo que não for número
  let cleaned = phone.replace(/\D/g, '');
  
  // Se começar com 0, remove
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }
  
  // Se não tiver código do país (55), adiciona
  if (!cleaned.startsWith('55') && cleaned.length <= 11) {
    cleaned = '55' + cleaned;
  }
  
  // Retorna apenas se tiver tamanho válido (12-13 dígitos: 55 + DDD + número)
  if (cleaned.length >= 12 && cleaned.length <= 13) {
    return cleaned;
  }
  
  return null;
}

// =============================================
// GERAR LINK DO WHATSAPP
// =============================================
export function getWhatsAppLink(phone: string | null, message?: string): string | null {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  if (!formattedPhone) return null;
  
  const baseUrl = 'https://wa.me/';
  const encodedMessage = message ? `?text=${encodeURIComponent(message)}` : '';
  
  return `${baseUrl}${formattedPhone}${encodedMessage}`;
}
