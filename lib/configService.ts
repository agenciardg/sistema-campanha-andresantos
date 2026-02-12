/**
 * CONFIG SERVICE - Serviço centralizado de configurações do sistema
 *
 * Todas as configurações são armazenadas na tabela andresantos_configuracoes
 * como key-value pairs. Chaves são prefixadas por setor para organização.
 *
 * Setores: branding, links, lgpd, api, whatsapp
 */

import { configuracoesService } from './supabase';
import { sanitizeText, sanitizeUrl, sanitizeEmail } from './security';

// ==================== TIPOS ====================

export interface ConfigKey {
  chave: string;
  label: string;
  descricao: string;
  tipo: 'text' | 'url' | 'email' | 'color' | 'password' | 'info' | 'textarea';
  padrao: string;
  sensivel?: boolean;
}

export interface ConfigSetor {
  id: string;
  nome: string;
  descricao: string;
  icone: string;
  cor: string;
  campos: ConfigKey[];
}

// ==================== DEFINIÇÃO DOS SETORES ====================

export const SETORES_CONFIG: ConfigSetor[] = [
  {
    id: 'branding',
    nome: 'Branding & Sistema',
    descricao: 'Identidade visual e nomes do sistema',
    icone: 'palette',
    cor: '#8b5cf6',
    campos: [
      { chave: 'branding.app_nome', label: 'Nome do App', descricao: 'Nome exibido na sidebar e cabeçalhos', tipo: 'text', padrao: 'ANDRE' },
      { chave: 'branding.app_subtitulo', label: 'Subtítulo do App', descricao: 'Texto abaixo do nome na sidebar', tipo: 'text', padrao: 'SANTOS' },
      { chave: 'branding.candidato_nome', label: 'Nome do Candidato', descricao: 'Nome do candidato/político', tipo: 'text', padrao: 'André Santos' },
      { chave: 'branding.login_titulo', label: 'Título do Login', descricao: 'Título na tela de login', tipo: 'text', padrao: 'André Santos' },
      { chave: 'branding.login_subtitulo', label: 'Subtítulo do Login', descricao: 'Texto abaixo do título na tela de login', tipo: 'text', padrao: 'Acesso seguro para coordenadores e equipe' },
      { chave: 'branding.rodape_texto', label: 'Texto do Rodapé', descricao: 'Texto exibido no rodapé do login', tipo: 'text', padrao: 'André Santos - Sistema de Campanha' },
      { chave: 'branding.cor_primaria', label: 'Cor Primária', descricao: 'Cor principal do tema (hex)', tipo: 'color', padrao: '#1e5a8d' },
    ],
  },
  {
    id: 'links',
    nome: 'Links & URLs',
    descricao: 'URLs de cadastro e links do sistema',
    icone: 'link',
    cor: '#3b82f6',
    campos: [
      { chave: 'links.url_base_cadastro', label: 'URL Base de Cadastro', descricao: 'Domínio base para links de cadastro de apoiadores', tipo: 'url', padrao: 'https://apoiadores.andresantosoficial.com.br/#' },
    ],
  },
  {
    id: 'lgpd',
    nome: 'LGPD & Contato',
    descricao: 'Dados de contato e conformidade LGPD',
    icone: 'shield',
    cor: '#10b981',
    campos: [
      { chave: 'lgpd.email_contato', label: 'Email de Contato LGPD', descricao: 'Email para exercício de direitos LGPD', tipo: 'email', padrao: 'contato@andresantosoficial.com.br' },
      { chave: 'lgpd.nome_controlador', label: 'Nome do Controlador', descricao: 'Nome do controlador de dados (LGPD)', tipo: 'text', padrao: 'André Santos' },
      { chave: 'lgpd.texto_copyright', label: 'Texto de Copyright', descricao: 'Texto de copyright exibido na página pública', tipo: 'text', padrao: '' },
    ],
  },
  {
    id: 'api',
    nome: 'APIs & Integrações',
    descricao: 'Chaves de API e configurações de integrações',
    icone: 'cloud',
    cor: '#f59e0b',
    campos: [
      { chave: 'api.google_maps_key', label: 'Google Maps API Key', descricao: 'Chave da API Google Maps (lida pela Edge Function via banco de dados - nunca exposta no frontend)', tipo: 'password', padrao: '', sensivel: true },
      { chave: 'api.edge_function_admin', label: 'Edge Function Admin', descricao: 'Nome da Edge Function de gerenciamento de admins', tipo: 'text', padrao: 'smooth-responder' },
    ],
  },
  {
    id: 'whatsapp',
    nome: 'WhatsApp & Notificações',
    descricao: 'Configuração do WhatsApp e mensagens automáticas',
    icone: 'send',
    cor: '#22c55e',
    campos: [
      { chave: 'whatsapp.numero_padrao', label: 'Número WhatsApp Padrão', descricao: 'Número usado para links de WhatsApp', tipo: 'text', padrao: '' },
      { chave: 'whatsapp.msg_lideranca', label: 'Mensagem - Nova Liderança', descricao: 'Variáveis: {nome}, {link}, {equipe}', tipo: 'textarea', padrao: '🎉 *Parabéns, {nome}!*\n\nVocê foi cadastrado(a) como *Liderança* no sistema de campanha.{equipe}\n\n📋 *Seu link de cadastro:*\n{link}\n\nUse este link para cadastrar seus apoiadores. Cada cadastro será vinculado automaticamente a você.\n\nBom trabalho! 💪' },
      { chave: 'whatsapp.msg_coordenador', label: 'Mensagem - Novo Coordenador', descricao: 'Variáveis: {nome}, {link}', tipo: 'textarea', padrao: '🎉 *Parabéns, {nome}!*\n\nVocê foi cadastrado(a) como *Coordenador(a)* no sistema de campanha.\n\n📋 *Seu link de cadastro:*\n{link}\n\nUse este link para cadastrar apoiadores diretamente ou compartilhe com suas lideranças.\n\nBom trabalho! 💪' },
      { chave: 'whatsapp.msg_tarefa', label: 'Mensagem - Nova Tarefa', descricao: 'Variáveis: {nome}, {titulo}, {descricao}, {prioridade}, {prazo}', tipo: 'textarea', padrao: '📋 *Nova Tarefa Atribuída!*\n\nOlá, *{nome}*!\n\nVocê recebeu uma nova tarefa:\n\n📌 *Título:* {titulo}\n📝 *Descrição:* {descricao}\n{prioridade}\n📅 *Prazo:* {prazo}\n\nAcesse o sistema para mais detalhes. Bom trabalho! 💪' },
      { chave: 'whatsapp.msg_lembrete_tarefa', label: 'Mensagem - Lembrete de Tarefa', descricao: 'Variáveis: {nome}, {titulo}, {descricao}, {prioridade}, {horario}', tipo: 'textarea', padrao: '⏰ *Lembrete de Tarefa!*\n\nOlá, *{nome}*!\n\nSua tarefa começa em *30 minutos*:\n\n📌 *{titulo}*\n📝 {descricao}\n{prioridade}\n🕐 *Horário:* {horario}\n\nPrepare-se! 💪' },
    ],
  },
];

// ==================== CACHE ====================

const cache = new Map<string, { valor: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

function getCached(chave: string): string | null {
  const entry = cache.get(chave);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    cache.delete(chave);
    return null;
  }
  return entry.valor;
}

function setCache(chave: string, valor: string): void {
  cache.set(chave, { valor, timestamp: Date.now() });
}

export function invalidateCache(chave?: string): void {
  if (chave) {
    cache.delete(chave);
  } else {
    cache.clear();
  }
}

// ==================== FUNÇÕES PRINCIPAIS ====================

/** Obter valor padrão de uma configuração */
export function getDefaultValue(chave: string): string {
  for (const setor of SETORES_CONFIG) {
    const campo = setor.campos.find(c => c.chave === chave);
    if (campo) return campo.padrao;
  }
  return '';
}

/** Buscar uma configuração (com cache e fallback para padrão) */
export async function getConfig(chave: string): Promise<string> {
  // Verificar cache
  const cached = getCached(chave);
  if (cached !== null) return cached;

  try {
    const valor = await configuracoesService.buscar(chave);
    const resultado = valor ?? getDefaultValue(chave);
    setCache(chave, resultado);
    return resultado;
  } catch {
    return getDefaultValue(chave);
  }
}

/** Buscar múltiplas configurações de um setor */
export async function getConfigsBySetor(setorId: string): Promise<Record<string, string>> {
  const setor = SETORES_CONFIG.find(s => s.id === setorId);
  if (!setor) return {};

  // getAllConfigs agora é otimizado e alimenta o cache
  const allConfigs = await getAllConfigs();
  const resultado: Record<string, string> = {};

  setor.campos.forEach(campo => {
    resultado[campo.chave] = allConfigs[campo.chave] || campo.padrao;
  });

  return resultado;
}

/** Buscar todas as configurações */
export async function getAllConfigs(): Promise<Record<string, string>> {
  const resultado: Record<string, string> = {};

  // Iniciar com padrões
  SETORES_CONFIG.forEach(setor => {
    setor.campos.forEach(campo => {
      resultado[campo.chave] = campo.padrao;
    });
  });

  try {
    const allRows = await configuracoesService.listarTodas();
    console.log('[ConfigService] listarTodas retornou', allRows.length, 'registros:', allRows.map(r => r.chave));

    // Sobrescrever com valores do banco e alimentar cache
    allRows.forEach(row => {
      resultado[row.chave] = row.valor;
      setCache(row.chave, row.valor);
    });

    console.log('[ConfigService] links.url_base_cadastro =', resultado['links.url_base_cadastro']);
    return resultado;
  } catch (error) {
    console.error('[ConfigService] ERRO ao buscar todas as configs:', error);
    return resultado; // Retorna com padrões em caso de erro
  }
}

/** Salvar uma configuração com sanitização */
export async function saveConfig(chave: string, valor: string): Promise<void> {
  // Buscar definição do campo para sanitização adequada
  let sanitizedValue = valor;

  for (const setor of SETORES_CONFIG) {
    const campo = setor.campos.find(c => c.chave === chave);
    if (campo) {
      switch (campo.tipo) {
        case 'email':
          sanitizedValue = sanitizeEmail(valor);
          break;
        case 'url':
          sanitizedValue = valor ? sanitizeUrl(valor) || valor : '';
          break;
        case 'info':
          return; // Campos info-only não são salvos
        default:
          sanitizedValue = sanitizeText(valor);
          break;
      }
      break;
    }
  }

  await configuracoesService.salvar(chave, sanitizedValue);
  setCache(chave, sanitizedValue);
}

/** Salvar múltiplas configurações de forma eficiente (batch) */
export async function saveConfigs(configs: Record<string, string>): Promise<void> {
  // Obter valores atuais (do cache) para comparar o que mudou
  const entriesToSave: { chave: string, valor: string }[] = [];

  for (const [chave, valor] of Object.entries(configs)) {
    const currentValue = getCached(chave);

    // Só salvar se o valor for diferente do que já temos em cache
    // ou se não estiver em cache
    if (currentValue === null || currentValue !== valor) {
      // Aplicar sanitização antes de salvar
      let sanitizedValue = valor;
      const setorFound = SETORES_CONFIG.find(s => s.campos.find(c => c.chave === chave));
      const campo = setorFound?.campos.find(c => c.chave === chave);

      if (campo) {
        if (campo.tipo === 'info') continue;
        if (campo.tipo === 'password') { /* API keys/secrets: não sanitizar */ }
        else if (campo.tipo === 'email') sanitizedValue = sanitizeEmail(valor);
        else if (campo.tipo === 'url') sanitizedValue = valor ? sanitizeUrl(valor) || valor : '';
        else sanitizedValue = sanitizeText(valor);
      }

      entriesToSave.push({ chave, valor: sanitizedValue });
    }
  }

  if (entriesToSave.length === 0) return;

  // Salvar tudo em uma única requisição (upsert batch)
  await configuracoesService.salvarMuitos(entriesToSave);

  // Atualizar cache
  for (const entry of entriesToSave) {
    setCache(entry.chave, entry.valor);
  }
}

/** Mascarar valor sensível (mostra apenas últimos 4 caracteres) */
export function maskSensitiveValue(valor: string): string {
  if (!valor || valor.length <= 4) return '****';
  return '*'.repeat(valor.length - 4) + valor.slice(-4);
}
