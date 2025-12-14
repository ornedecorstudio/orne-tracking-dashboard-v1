// lib/tracking.ts - Integração com 17TRACK API (otimizada para economizar créditos)

import { TrackingEvent, Track17StatusResponse } from '@/types';
import { detectCarrier } from './utils';

// =============================================
// CONFIGURAÇÃO DA API 17TRACK
// =============================================
const API_BASE_URL = 'https://api.17track.net/track/v2.2';

// =============================================
// REGISTRAR CÓDIGO NA 17TRACK (GASTA 1 CRÉDITO)
// =============================================
export async function registerTracking(trackingNumber: string): Promise<boolean> {
  const apiKey = process.env.TRACKING_API_KEY;
  
  if (!apiKey) {
    console.error('[17TRACK] API Key não configurada');
    return false;
  }

  const carrier = detectCarrier(trackingNumber);
  console.log(`[17TRACK] Registrando ${trackingNumber} (${carrier.name})`);

  try {
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        '17token': apiKey,
      },
      body: JSON.stringify([
        {
          number: trackingNumber,
          carrier: carrier.code > 0 ? carrier.code : undefined, // Se 0, deixa auto-detectar
        },
      ]),
    });

    if (!response.ok) {
      console.error(`[17TRACK] Erro ao registrar: ${response.status}`);
      return false;
    }

    const data = await response.json();
    
    // Verificar se foi aceito
    if (data.data?.accepted?.length > 0) {
      console.log(`[17TRACK] ✓ Registrado com sucesso: ${trackingNumber}`);
      return true;
    }
    
    // Verificar se foi rejeitado (pode já estar registrado)
    if (data.data?.rejected?.length > 0) {
      const rejection = data.data.rejected[0];
      // Código -18010011 = já registrado (não conta como erro)
      if (rejection.error?.code === -18010011) {
        console.log(`[17TRACK] ℹ Já estava registrado: ${trackingNumber}`);
        return true;
      }
      console.warn(`[17TRACK] Rejeitado: ${trackingNumber}`, rejection.error);
    }

    return false;
  } catch (error) {
    console.error(`[17TRACK] Erro de rede ao registrar:`, error);
    return false;
  }
}

// =============================================
// BUSCAR STATUS DO RASTREAMENTO (NÃO GASTA CRÉDITO)
// =============================================
export async function getTrackingStatus(trackingNumber: string): Promise<{
  status: string | null;
  events: TrackingEvent[];
  lastUpdate: string | null;
} | null> {
  const apiKey = process.env.TRACKING_API_KEY;
  
  if (!apiKey) {
    console.error('[17TRACK] API Key não configurada');
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/gettrackinfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        '17token': apiKey,
      },
      body: JSON.stringify([
        { number: trackingNumber },
      ]),
    });

    if (!response.ok) {
      console.error(`[17TRACK] Erro ao buscar status: ${response.status}`);
      return null;
    }

    const data = await response.json();
    
    // Verificar se encontrou dados
    if (!data.data?.accepted || data.data.accepted.length === 0) {
      return null;
    }

    const trackInfo = data.data.accepted[0];
    
    // Extrair status principal
    const status = trackInfo.track_info?.latest_status?.status || null;
    
    // Extrair eventos de rastreamento
    const events: TrackingEvent[] = [];
    const providers = trackInfo.track_info?.tracking?.providers || [];
    
    for (const provider of providers) {
      for (const event of provider.events || []) {
        events.push({
          date: event.time_iso?.split('T')[0] || '',
          time: event.time_iso?.split('T')[1]?.substring(0, 5) || '',
          description: event.description || '',
          location: event.location || '',
          status: event.sub_status || '',
        });
      }
    }

    // Ordenar eventos do mais recente para o mais antigo
    events.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.time || '00:00'}`);
      const dateB = new Date(`${b.date}T${b.time || '00:00'}`);
      return dateB.getTime() - dateA.getTime();
    });

    // Última atualização
    const lastUpdate = trackInfo.track_info?.latest_event?.time_iso || null;

    return {
      status,
      events,
      lastUpdate,
    };
  } catch (error) {
    console.error(`[17TRACK] Erro ao buscar status:`, error);
    return null;
  }
}

// =============================================
// REGISTRAR MÚLTIPLOS CÓDIGOS EM LOTE
// (mais eficiente para economizar requisições)
// =============================================
export async function registerTrackingBatch(trackingNumbers: string[]): Promise<{
  registered: string[];
  failed: string[];
}> {
  const apiKey = process.env.TRACKING_API_KEY;
  
  if (!apiKey) {
    console.error('[17TRACK] API Key não configurada');
    return { registered: [], failed: trackingNumbers };
  }

  // Limitar a 40 por requisição (limite da 17TRACK)
  const batches = [];
  for (let i = 0; i < trackingNumbers.length; i += 40) {
    batches.push(trackingNumbers.slice(i, i + 40));
  }

  const registered: string[] = [];
  const failed: string[] = [];

  for (const batch of batches) {
    try {
      const payload = batch.map(number => {
        const carrier = detectCarrier(number);
        return {
          number,
          carrier: carrier.code > 0 ? carrier.code : undefined,
        };
      });

      const response = await fetch(`${API_BASE_URL}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          '17token': apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`[17TRACK] Erro no batch: ${response.status}`);
        failed.push(...batch);
        continue;
      }

      const data = await response.json();

      // Processar aceitos
      for (const item of data.data?.accepted || []) {
        registered.push(item.number);
      }

      // Processar rejeitados
      for (const item of data.data?.rejected || []) {
        // Já registrado não é erro
        if (item.error?.code === -18010011) {
          registered.push(item.number);
        } else {
          failed.push(item.number);
        }
      }
    } catch (error) {
      console.error(`[17TRACK] Erro de rede no batch:`, error);
      failed.push(...batch);
    }

    // Pequena pausa entre batches para não sobrecarregar
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`[17TRACK] Batch: ${registered.length} registrados, ${failed.length} falharam`);
  return { registered, failed };
}

// =============================================
// BUSCAR STATUS DE MÚLTIPLOS CÓDIGOS EM LOTE
// =============================================
export async function getTrackingStatusBatch(trackingNumbers: string[]): Promise<Map<string, {
  status: string | null;
  events: TrackingEvent[];
  lastUpdate: string | null;
}>> {
  const apiKey = process.env.TRACKING_API_KEY;
  const results = new Map();
  
  if (!apiKey) {
    console.error('[17TRACK] API Key não configurada');
    return results;
  }

  // Limitar a 40 por requisição
  const batches = [];
  for (let i = 0; i < trackingNumbers.length; i += 40) {
    batches.push(trackingNumbers.slice(i, i + 40));
  }

  for (const batch of batches) {
    try {
      const payload = batch.map(number => ({ number }));

      const response = await fetch(`${API_BASE_URL}/gettrackinfo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          '17token': apiKey,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`[17TRACK] Erro no batch de status: ${response.status}`);
        continue;
      }

      const data = await response.json();

      // Processar resultados
      for (const trackInfo of data.data?.accepted || []) {
        const number = trackInfo.number;
        const status = trackInfo.track_info?.latest_status?.status || null;
        
        const events: TrackingEvent[] = [];
        const providers = trackInfo.track_info?.tracking?.providers || [];
        
        for (const provider of providers) {
          for (const event of provider.events || []) {
            events.push({
              date: event.time_iso?.split('T')[0] || '',
              time: event.time_iso?.split('T')[1]?.substring(0, 5) || '',
              description: event.description || '',
              location: event.location || '',
              status: event.sub_status || '',
            });
          }
        }

        events.sort((a, b) => {
          const dateA = new Date(`${a.date}T${a.time || '00:00'}`);
          const dateB = new Date(`${b.date}T${b.time || '00:00'}`);
          return dateB.getTime() - dateA.getTime();
        });

        const lastUpdate = trackInfo.track_info?.latest_event?.time_iso || null;

        results.set(number, { status, events, lastUpdate });
      }
    } catch (error) {
      console.error(`[17TRACK] Erro ao buscar status em batch:`, error);
    }

    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return results;
}
