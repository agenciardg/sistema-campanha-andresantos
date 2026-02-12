/**
 * Evolution API Service
 * Serviço para integração com a Evolution API (WhatsApp)
 * Usa Supabase Edge Function como proxy para evitar problemas de CORS
 *
 * Documentação: https://doc.evolution-api.com/
 */

import { supabase } from './supabase';

// ==================== TIPOS ====================

export interface EvolutionConfig {
  id?: string;
  servidor_url: string;
  api_key: string;
  instance_name: string;
  instance_token?: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'qr_pending';
  ultimo_check?: string;
  criado_em?: string;
  atualizado_em?: string;
}

export interface QRCodeResponse {
  pairingCode?: string;
  code?: string;
  base64?: string;
  qr?: string;
}

export interface InstanceStatus {
  instanceName: string;
  state: 'connected' | 'disconnected' | 'connecting' | 'qr_error';
}

export interface SendMessageResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: string;
  messageTimestamp: number;
}

// ==================== CONFIGURAÇÃO ====================

// URL da Edge Function do Supabase (SEM FALLBACK HARDCODED por segurança)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const EDGE_FUNCTION_URL = SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/evolution-proxy` : '';

/**
 * Chama a Edge Function do Supabase (proxy para Evolution API)
 */
async function callEvolutionProxy(
  action: string,
  instanceName?: string,
  data?: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  try {
    console.log(`🔄 [Evolution Proxy] Chamando: ${action}`, { instanceName, data });

    const { data: responseData, error } = await supabase.functions.invoke('evolution-proxy', {
      body: {
        action,
        instanceName,
        data,
      },
    });

    if (error) {
      console.error('📡 [Evolution Proxy] Erro na função:', error);

      // Tentar extrair uma mensagem amigável do erro
      let msg = error.message;
      if (msg.includes('non-2xx status code') || !msg) {
        msg = 'Falha na comunicação com a Evolution API (Erro 401/Unauthorized). Verifique se a URL do servidor e a API Key estão corretas.';
      }

      return {
        success: false,
        error: msg,
      };
    }

    console.log(`📡 [Evolution Proxy] Resposta:`, responseData);

    return {
      success: true,
      data: responseData,
    };
  } catch (error) {
    console.error('❌ [Evolution Proxy] Erro inesperado:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro de conexão',
    };
  }
}

/**
 * Busca a configuração da Evolution API do Supabase
 */
export async function getEvolutionConfig(): Promise<EvolutionConfig | null> {
  try {
    const { data, error } = await supabase
      .from('andresantos_evolution_config')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar config Evolution:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Erro ao buscar config Evolution:', error);
    return null;
  }
}

/**
 * Salva a configuração da Evolution API no Supabase
 */
export async function saveEvolutionConfig(config: Partial<EvolutionConfig>): Promise<EvolutionConfig | null> {
  try {
    const existingConfig = await getEvolutionConfig();

    if (existingConfig?.id) {
      // Atualizar existente
      const { data, error } = await supabase
        .from('andresantos_evolution_config')
        .update({
          ...config,
          atualizado_em: new Date().toISOString(),
        })
        .eq('id', existingConfig.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } else {
      // Criar novo
      const { data, error } = await supabase
        .from('andresantos_evolution_config')
        .insert([{
          ...config,
          status: config.status || 'disconnected',
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  } catch (error) {
    console.error('Erro ao salvar config Evolution:', error);
    throw error;
  }
}

// ==================== INSTANCE MANAGEMENT ====================

/**
 * Cria uma nova instância na Evolution API
 */
export async function createInstance(
  config: EvolutionConfig
): Promise<{ success: boolean; qrcode?: QRCodeResponse; error?: string }> {
  const result = await callEvolutionProxy('create', config.instance_name);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const data = result.data as Record<string, unknown>;
  const qrcode = (data.qrcode || data) as QRCodeResponse;

  // Atualizar config local
  await saveEvolutionConfig({
    ...config,
    instance_token: (data.hash as string) || null,
    status: 'qr_pending',
  });

  return {
    success: true,
    qrcode: qrcode,
  };
}

/**
 * Busca o QR Code para conexão
 */
export async function getQRCode(
  config: EvolutionConfig
): Promise<{ success: boolean; qrcode?: QRCodeResponse; error?: string }> {
  const result = await callEvolutionProxy('connect', config.instance_name);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    qrcode: result.data as QRCodeResponse,
  };
}

/**
 * Verifica o status de conexão da instância
 */
export async function getConnectionStatus(
  config: EvolutionConfig
): Promise<{ success: boolean; status?: InstanceStatus; error?: string }> {
  const result = await callEvolutionProxy('status', config.instance_name);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const data = result.data as Record<string, unknown>;
  const instanceData = data.instance as Record<string, unknown> | undefined;
  const state = (instanceData?.state || data.state || 'disconnected') as string;
  const newStatus = state === 'open' || state === 'connected' ? 'connected' : 'disconnected';

  // Recarregar config do banco (foi atualizada pela Edge Function)
  const updatedConfig = await getEvolutionConfig();

  return {
    success: true,
    status: {
      instanceName: config.instance_name,
      state: newStatus as InstanceStatus['state'],
    },
  };
}

/**
 * Reinicia a instância
 */
export async function restartInstance(
  config: EvolutionConfig
): Promise<{ success: boolean; error?: string }> {
  const result = await callEvolutionProxy('restart', config.instance_name);
  return { success: result.success, error: result.error };
}

/**
 * Desconecta (logout) da instância
 */
export async function logoutInstance(
  config: EvolutionConfig
): Promise<{ success: boolean; error?: string }> {
  const result = await callEvolutionProxy('logout', config.instance_name);

  if (result.success) {
    await saveEvolutionConfig({
      ...config,
      status: 'disconnected',
    });
  }

  return { success: result.success, error: result.error };
}

/**
 * Deleta a instância
 */
export async function deleteInstance(
  config: EvolutionConfig
): Promise<{ success: boolean; error?: string }> {
  const result = await callEvolutionProxy('delete', config.instance_name);

  if (result.success) {
    await saveEvolutionConfig({
      ...config,
      status: 'disconnected',
    });
  }

  return { success: result.success, error: result.error };
}

// ==================== ENVIO DE MENSAGENS ====================

/**
 * Envia uma mensagem de texto via WhatsApp
 */
export async function sendTextMessage(
  config: EvolutionConfig,
  number: string,
  text: string
): Promise<{ success: boolean; data?: SendMessageResponse; error?: string }> {
  const cleanNumber = number.replace(/\D/g, '');

  const result = await callEvolutionProxy('sendText', config.instance_name, {
    number: cleanNumber,
    text: text,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: result.data as SendMessageResponse,
  };
}

/**
 * Envia uma imagem via WhatsApp (base64 ou URL)
 */
export async function sendImageMessage(
  config: EvolutionConfig,
  number: string,
  media: string,
  caption?: string,
  fileName?: string
): Promise<{ success: boolean; data?: SendMessageResponse; error?: string }> {
  const cleanNumber = number.replace(/\D/g, '');

  // Remover prefixo data URL se presente (ex: "data:image/png;base64,...")
  const cleanMedia = media.includes(',') ? media.split(',')[1] : media;

  const result = await callEvolutionProxy('sendMedia', config.instance_name, {
    number: cleanNumber,
    mediatype: 'image',
    mimetype: 'image/png',
    media: cleanMedia,
    caption: caption || '',
    fileName: fileName || 'qrcode.png',
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  return {
    success: true,
    data: result.data as SendMessageResponse,
  };
}

// ==================== UTILITÁRIOS ====================

/**
 * Formata número de telefone brasileiro para formato internacional
 * Entrada: (85) 99999-9999 ou 85999999999
 * Saída: 5585999999999
 */
export function formatPhoneNumber(phone: string): string {
  let cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('55')) {
    return cleaned;
  }

  return `55${cleaned}`;
}

/**
 * Verifica se a Evolution API está configurada e conectada
 */
export async function isEvolutionConnected(): Promise<boolean> {
  try {
    const config = await getEvolutionConfig();
    if (!config || config.status !== 'connected') {
      return false;
    }

    const { success, status } = await getConnectionStatus(config);
    return success && status?.state === 'connected';
  } catch {
    return false;
  }
}
