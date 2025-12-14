// lib/tracking.ts - Integração com 17TRACK API

import { TrackingEvent } from '@/types';
import { detectCarrier } from './utils';

const API_BASE_URL = 'https://api.17track.net/track/v2.2';

// =============================================
// REGISTRAR CÓDIGO NA 17TRACK (GASTA 1 CRÉDITO)
// CORRIGIDO: Força código correto da transportadora
// =============================================
export async function registerTracking(trackingNumber: string): Promise<boolean> {
  const apiKey = process.env.TRACKING_API_KEY;
  if (!apiKey) {
    console.error('[17TRACK] API Key não configurada');
    return false;
  }

  // Detectar transportadora ANTES de registrar
  const carrier = detectCarrier(trackingNumber);
  console.log(`[17TRACK] Registrando ${trackingNumber} → ${carrier.name} (código: ${carrier.code})`);

  try {
    const payload = [{
      number: trackingNumber,
      // IMPORTANTE: Sempre enviar o código da transportadora quando conhecido
      // Isso evita o problema de "auto-detect" falhar
      ...(carrier.code > 0 && { carrier: carrier.code }),
    }];

    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        '17token': apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`[17TRACK] Erro ao registrar: ${response.status}`);
      return false;
    }

    const data = await response.json();
    
    if (data.data?.accepted?.length > 0) {
      console.log(`[17TRACK] ✓ Registrado: ${trackingNumber}`);
      return true;
    }
    
    if (data.data?.rejected?.length > 0) {
      const rejection = data.data.rejected[0];
      // -18010011 = já registrado (não é erro)
      if (rejection.error?.code === -18010011) {
        console.log(`[17TRACK] ℹ Já registrado: ${trackingNumber}`);
        return true;
      }
      console.warn(`[17TRACK] Rejeitado: ${trackingNumber}`, rejection.error);
    }

    return false;
  } catch (error) {
    console.error(`[17TRACK] Erro:`, error);
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
  if (!apiKey) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/gettrackinfo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        '17token': apiKey,
      },
      body: JSON.stringify([{ number: trackingNumber }]),
    });

    if (!response.ok) return null;

    const data = await response.json();
    
    if (!data.data?.accepted || data.data.accepted.length === 0) {
      return null;
    }

    const trackInfo = data.data.accepted[0];
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

    return { status, events, lastUpdate };
  } catch (error) {
    console.error(`[17TRACK] Erro ao buscar status:`, error);
    return null;
  }
}

// =============================================
// REGISTRAR MÚLTIPLOS CÓDIGOS EM LOTE
// =============================================
export async function registerTrackingBatch(trackingNumbers: string[]): Promise<{
  registered: string[];
  failed: string[];
}> {
  const apiKey = process.env.TRACKING_API_KEY;
  
  if (!apiKey) {
    return { registered: [], failed: trackingNumbers };
  }

  const batches = [];
  for (let i = 0; i < trackingNumbers.length; i += 40) {
    batches.push(trackingNumbers.slice(i, i + 40));
  }

  const registered: string[] = [];
  const failed: string[] = [];

  for (const batch of batches) {
    try {
      // Montar payload com código da transportadora para cada item
      const payload = batch.map(number => {
        const carrier = detectCarrier(number);
        return {
          number,
          ...(carrier.code > 0 && { carrier: carrier.code }),
        };
      });

      console.log(`[17TRACK] Batch: ${batch.length} códigos`);

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

      for (const item of data.data?.accepted || []) {
        registered.push(item.number);
      }

      for (const item of data.data?.rejected || []) {
        if (item.error?.code === -18010011) {
          registered.push(item.number);
        } else {
          failed.push(item.number);
        }
      }
    } catch (error) {
      console.error(`[17TRACK] Erro de rede:`, error);
      failed.push(...batch);
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  console.log(`[17TRACK] Total: ${registered.length} registrados, ${failed.length} falharam`);
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
  
  if (!apiKey) return results;

  const batches = [];
  for (let i = 0; i < trackingNumbers.length; i += 40) {
    batches.push(trackingNumbers.slice(i, i + 40));
  }

  for (const batch of batches) {
    try {
      const response = await fetch(`${API_BASE_URL}/gettrackinfo`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          '17token': apiKey,
        },
        body: JSON.stringify(batch.map(number => ({ number }))),
      });

      if (!response.ok) continue;

      const data = await response.json();

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
      console.error(`[17TRACK] Erro ao buscar batch:`, error);
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return results;
}
