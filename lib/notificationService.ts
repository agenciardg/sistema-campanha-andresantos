/**
 * Notification Service
 * Serviço de alto nível para enviar notificações via WhatsApp (Evolution API)
 */

import {
  getEvolutionConfig,
  sendTextMessage,
  sendImageMessage,
  formatPhoneNumber,
  EvolutionConfig,
} from './evolutionApi';
import { getConfig } from './configService';
import QRCode from 'qrcode';

// ==================== TIPOS ====================

export interface Lideranca {
  id?: string;
  nome: string;
  telefone: string;
  codigo_unico?: string;
  equipe_nome?: string;
}

export interface Coordenador {
  id?: string;
  nome: string;
  telefone: string;
  codigo_unico?: string;
}

export interface TarefaNotificacao {
  titulo: string;
  descricao?: string;
  prioridade: 'alta' | 'media' | 'baixa';
  data_vencimento?: string;
  responsavel_nome: string;
  responsavel_telefone: string;
}

export interface NotificationResult {
  success: boolean;
  error?: string;
}

// ==================== TEMPLATES DE MENSAGEM ====================

/**
 * Gera a mensagem de boas-vindas para uma nova Liderança
 * Lê template do banco (Configurações > WhatsApp) ou usa padrão
 */
async function gerarMensagemLideranca(nome: string, linkCadastro: string, equipeNome?: string): Promise<string> {
  const template = await getConfig('whatsapp.msg_lideranca');
  const equipeTexto = equipeNome ? `\n👥 *Equipe:* ${equipeNome}` : '';

  return template
    .replace(/\{nome\}/g, nome)
    .replace(/\{link\}/g, linkCadastro)
    .replace(/\{equipe\}/g, equipeTexto);
}

/**
 * Gera a mensagem de boas-vindas para um novo Coordenador
 * Lê template do banco (Configurações > WhatsApp) ou usa padrão
 */
async function gerarMensagemCoordenador(nome: string, linkCadastro: string): Promise<string> {
  const template = await getConfig('whatsapp.msg_coordenador');

  return template
    .replace(/\{nome\}/g, nome)
    .replace(/\{link\}/g, linkCadastro);
}

/**
 * Gera a mensagem de notificação para uma nova Tarefa
 * Lê template do banco (Configurações > WhatsApp) ou usa padrão
 */
async function gerarMensagemTarefa(tarefa: TarefaNotificacao): Promise<string> {
  const template = await getConfig('whatsapp.msg_tarefa');

  const prioridadeEmoji: Record<string, string> = { alta: '🔴', media: '🟡', baixa: '🟢' };
  const prioridadeTexto: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' };
  const prioridadeStr = `${prioridadeEmoji[tarefa.prioridade]} *Prioridade:* ${prioridadeTexto[tarefa.prioridade]}`;
  const prazoStr = tarefa.data_vencimento
    ? new Date(tarefa.data_vencimento).toLocaleDateString('pt-BR')
    : 'Sem prazo definido';

  return template
    .replace(/\{nome\}/g, tarefa.responsavel_nome)
    .replace(/\{titulo\}/g, tarefa.titulo)
    .replace(/\{descricao\}/g, tarefa.descricao || 'Sem descrição')
    .replace(/\{prioridade\}/g, prioridadeStr)
    .replace(/\{prazo\}/g, prazoStr);
}

// ==================== QR CODE ====================

/**
 * Gera um QR code como base64 data URL (png) a partir de uma URL
 */
async function gerarQRCodeBase64(url: string): Promise<string | null> {
  try {
    const dataUrl = await QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    });
    return dataUrl;
  } catch (error) {
    console.error('Erro ao gerar QR Code base64:', error);
    return null;
  }
}

// ==================== FUNÇÕES DE NOTIFICAÇÃO ====================

/**
 * Verifica se a Evolution API está configurada e conectada
 */
async function verificarEvolutionConectada(): Promise<EvolutionConfig | null> {
  try {
    const config = await getEvolutionConfig();
    if (!config) {
      console.log('Evolution API não configurada');
      return null;
    }
    if (config.status !== 'connected') {
      console.log('Evolution API não conectada:', config.status);
      return null;
    }
    return config;
  } catch (error) {
    console.error('Erro ao verificar Evolution API:', error);
    return null;
  }
}

/**
 * Gera o link de cadastro para uma liderança
 * Lê a URL base da configuração do banco de dados
 */
export async function gerarLinkCadastroLideranca(codigoUnico: string): Promise<string> {
  const baseUrl = (await getConfig('links.url_base_cadastro')).replace(/\/+$/, '');
  return `${baseUrl}/c/${codigoUnico}`;
}

/**
 * Gera o link de cadastro para um coordenador
 * Lê a URL base da configuração do banco de dados
 */
export async function gerarLinkCadastroCoordenador(codigoUnico: string): Promise<string> {
  const baseUrl = (await getConfig('links.url_base_cadastro')).replace(/\/+$/, '');
  return `${baseUrl}/c/${codigoUnico}`;
}

/**
 * Envia notificação de boas-vindas para uma nova Liderança
 *
 * @param lideranca - Dados da liderança criada
 * @returns Resultado da notificação
 *
 * @example
 * ```typescript
 * const result = await notificarNovaLideranca({
 *   nome: 'João Silva',
 *   telefone: '(85) 99999-9999',
 *   codigo_unico: 'ABC123'
 * });
 * ```
 */
export async function notificarNovaLideranca(
  lideranca: Lideranca
): Promise<NotificationResult> {
  try {
    // Verificar se Evolution está configurada e conectada
    const config = await verificarEvolutionConectada();
    if (!config) {
      return {
        success: false,
        error: 'Evolution API não está configurada ou conectada',
      };
    }

    // Verificar se tem telefone
    if (!lideranca.telefone) {
      return {
        success: false,
        error: 'Liderança não possui telefone cadastrado',
      };
    }

    // Verificar se tem código único
    if (!lideranca.codigo_unico) {
      return {
        success: false,
        error: 'Liderança não possui código único',
      };
    }

    // Gerar link de cadastro
    const linkCadastro = await gerarLinkCadastroLideranca(lideranca.codigo_unico);

    // Gerar mensagem (incluindo equipe se disponível)
    const mensagem = await gerarMensagemLideranca(lideranca.nome, linkCadastro, lideranca.equipe_nome);

    // Formatar telefone
    const telefoneFormatado = formatPhoneNumber(lideranca.telefone);

    // Enviar mensagem de texto
    const result = await sendTextMessage(config, telefoneFormatado, mensagem);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Erro ao enviar mensagem',
      };
    }

    // Enviar QR Code da página de cadastro
    const qrBase64 = await gerarQRCodeBase64(linkCadastro);
    if (qrBase64) {
      const qrResult = await sendImageMessage(
        config,
        telefoneFormatado,
        qrBase64,
        `QR Code - Cadastro de apoiadores de ${lideranca.nome}`
      );
      if (!qrResult.success) {
        console.warn('QR Code não enviado (texto já foi):', qrResult.error);
      }
    }

    console.log(`✅ Notificação enviada para liderança: ${lideranca.nome}`);
    return { success: true };
  } catch (error) {
    console.error('Erro ao notificar liderança:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Envia notificação de boas-vindas para um novo Coordenador
 *
 * @param coordenador - Dados do coordenador criado
 * @returns Resultado da notificação
 *
 * @example
 * ```typescript
 * const result = await notificarNovoCoordenador({
 *   nome: 'Maria Santos',
 *   telefone: '(85) 98888-8888',
 *   codigo_unico: 'XYZ789'
 * });
 * ```
 */
export async function notificarNovoCoordenador(
  coordenador: Coordenador
): Promise<NotificationResult> {
  try {
    // Verificar se Evolution está configurada e conectada
    const config = await verificarEvolutionConectada();
    if (!config) {
      return {
        success: false,
        error: 'Evolution API não está configurada ou conectada',
      };
    }

    // Verificar se tem telefone
    if (!coordenador.telefone) {
      return {
        success: false,
        error: 'Coordenador não possui telefone cadastrado',
      };
    }

    // Verificar se tem código único
    if (!coordenador.codigo_unico) {
      return {
        success: false,
        error: 'Coordenador não possui código único',
      };
    }

    // Gerar link de cadastro
    const linkCadastro = await gerarLinkCadastroCoordenador(coordenador.codigo_unico);

    // Gerar mensagem
    const mensagem = await gerarMensagemCoordenador(coordenador.nome, linkCadastro);

    // Formatar telefone
    const telefoneFormatado = formatPhoneNumber(coordenador.telefone);

    // Enviar mensagem de texto
    const result = await sendTextMessage(config, telefoneFormatado, mensagem);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Erro ao enviar mensagem',
      };
    }

    // Enviar QR Code da página de cadastro
    const qrBase64 = await gerarQRCodeBase64(linkCadastro);
    if (qrBase64) {
      const qrResult = await sendImageMessage(
        config,
        telefoneFormatado,
        qrBase64,
        `QR Code - Cadastro de apoiadores de ${coordenador.nome}`
      );
      if (!qrResult.success) {
        console.warn('QR Code não enviado (texto já foi):', qrResult.error);
      }
    }

    console.log(`✅ Notificação enviada para coordenador: ${coordenador.nome}`);
    return { success: true };
  } catch (error) {
    console.error('Erro ao notificar coordenador:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Envia notificação para o responsável de uma nova Tarefa
 *
 * @param tarefa - Dados da tarefa criada
 * @returns Resultado da notificação
 *
 * @example
 * ```typescript
 * const result = await notificarNovaTarefa({
 *   titulo: 'Fazer visitas',
 *   descricao: 'Visitar 10 casas no bairro',
 *   prioridade: 'alta',
 *   data_vencimento: '2025-02-15',
 *   responsavel_nome: 'João Silva',
 *   responsavel_telefone: '(85) 99999-9999'
 * });
 * ```
 */
export async function notificarNovaTarefa(
  tarefa: TarefaNotificacao
): Promise<NotificationResult> {
  try {
    // Verificar se Evolution está configurada e conectada
    const config = await verificarEvolutionConectada();
    if (!config) {
      return {
        success: false,
        error: 'Evolution API não está configurada ou conectada',
      };
    }

    // Verificar se tem telefone do responsável
    if (!tarefa.responsavel_telefone) {
      return {
        success: false,
        error: 'Responsável não possui telefone cadastrado',
      };
    }

    // Gerar mensagem
    const mensagem = await gerarMensagemTarefa(tarefa);

    // Formatar telefone
    const telefoneFormatado = formatPhoneNumber(tarefa.responsavel_telefone);

    // Enviar mensagem
    const result = await sendTextMessage(config, telefoneFormatado, mensagem);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Erro ao enviar mensagem',
      };
    }

    console.log(`✅ Notificação enviada para responsável da tarefa: ${tarefa.responsavel_nome}`);
    return { success: true };
  } catch (error) {
    console.error('Erro ao notificar tarefa:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    };
  }
}

/**
 * Verifica se o serviço de notificação está disponível
 * (Evolution API configurada e conectada)
 */
export async function isNotificationServiceAvailable(): Promise<boolean> {
  const config = await verificarEvolutionConectada();
  return config !== null;
}
