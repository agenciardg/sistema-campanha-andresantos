/**
 * Notification Service
 * Serviço de alto nível para enviar notificações via WhatsApp (Evolution API)
 */

import {
  getEvolutionConfig,
  sendTextMessage,
  formatPhoneNumber,
  EvolutionConfig,
} from './evolutionApi';

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
 */
function gerarMensagemLideranca(nome: string, linkCadastro: string, equipeNome?: string): string {
  const equipeTexto = equipeNome ? `\n👥 *Equipe:* ${equipeNome}` : '';

  return `🎉 *Parabéns, ${nome}!*

Você foi cadastrado(a) como *Liderança* no sistema de campanha.${equipeTexto}

📋 *Seu link de cadastro:*
${linkCadastro}

Use este link para cadastrar seus apoiadores. Cada cadastro será vinculado automaticamente a você.

Bom trabalho! 💪`;
}

/**
 * Gera a mensagem de boas-vindas para um novo Coordenador
 */
function gerarMensagemCoordenador(nome: string, linkCadastro: string): string {
  return `🎉 *Parabéns, ${nome}!*

Você foi cadastrado(a) como *Coordenador(a)* no sistema de campanha.

📋 *Seu link de cadastro:*
${linkCadastro}

Use este link para cadastrar apoiadores diretamente ou compartilhe com suas lideranças.

Bom trabalho! 💪`;
}

/**
 * Gera a mensagem de notificação para uma nova Tarefa
 */
function gerarMensagemTarefa(tarefa: TarefaNotificacao): string {
  const prioridadeEmoji = {
    alta: '🔴',
    media: '🟡',
    baixa: '🟢',
  };

  const prioridadeTexto = {
    alta: 'Alta',
    media: 'Média',
    baixa: 'Baixa',
  };

  let mensagem = `📋 *Nova Tarefa Atribuída!*

Olá, *${tarefa.responsavel_nome}*!

Você recebeu uma nova tarefa:

📌 *Título:* ${tarefa.titulo}`;

  if (tarefa.descricao) {
    mensagem += `\n📝 *Descrição:* ${tarefa.descricao}`;
  }

  mensagem += `\n${prioridadeEmoji[tarefa.prioridade]} *Prioridade:* ${prioridadeTexto[tarefa.prioridade]}`;

  if (tarefa.data_vencimento) {
    const dataFormatada = new Date(tarefa.data_vencimento).toLocaleDateString('pt-BR');
    mensagem += `\n📅 *Prazo:* ${dataFormatada}`;
  }

  mensagem += `\n\nAcesse o sistema para mais detalhes. Bom trabalho! 💪`;

  return mensagem;
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
 */
export function gerarLinkCadastroLideranca(codigoUnico: string): string {
  // Usa a URL base do sistema
  const baseUrl = window.location.origin;
  return `${baseUrl}/#/c/${codigoUnico}`;
}

/**
 * Gera o link de cadastro para um coordenador
 */
export function gerarLinkCadastroCoordenador(codigoUnico: string): string {
  // Usa a URL base do sistema
  const baseUrl = window.location.origin;
  return `${baseUrl}/#/c/${codigoUnico}`;
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
    const linkCadastro = gerarLinkCadastroLideranca(lideranca.codigo_unico);

    // Gerar mensagem (incluindo equipe se disponível)
    const mensagem = gerarMensagemLideranca(lideranca.nome, linkCadastro, lideranca.equipe_nome);

    // Formatar telefone
    const telefoneFormatado = formatPhoneNumber(lideranca.telefone);

    // Enviar mensagem
    const result = await sendTextMessage(config, telefoneFormatado, mensagem);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Erro ao enviar mensagem',
      };
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
    const linkCadastro = gerarLinkCadastroCoordenador(coordenador.codigo_unico);

    // Gerar mensagem
    const mensagem = gerarMensagemCoordenador(coordenador.nome, linkCadastro);

    // Formatar telefone
    const telefoneFormatado = formatPhoneNumber(coordenador.telefone);

    // Enviar mensagem
    const result = await sendTextMessage(config, telefoneFormatado, mensagem);

    if (!result.success) {
      return {
        success: false,
        error: result.error || 'Erro ao enviar mensagem',
      };
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
    const mensagem = gerarMensagemTarefa(tarefa);

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
