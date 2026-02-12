import { createClient } from '@supabase/supabase-js';
import logger from './logger';

/**
 * SUPABASE CLIENT - Configuração Segura
 *
 * SEGURANÇA:
 * - Credenciais movidas para variáveis de ambiente (.env.local)
 * - Validação de credenciais na inicialização
 * - Paginação implementada para prevenir DoS
 */

// Carregar credenciais das variáveis de ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Flag para indicar se o Supabase está configurado
export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

// Validar que as credenciais foram fornecidas (apenas aviso, não quebra a app)
if (!isSupabaseConfigured) {
  const warning = 'AVISO: Credenciais do Supabase não configuradas!\n' +
    'Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env.local\n' +
    'A aplicação funcionará em modo de demonstração com dados vazios.';

  logger.warn(warning);
  console.warn(warning);
}

// Criar cliente apenas se as credenciais estiverem configuradas
let supabaseClient: ReturnType<typeof createClient> | null = null;

if (isSupabaseConfigured) {
  // Validar formato da URL
  try {
    new URL(supabaseUrl);
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    logger.info('Supabase Client inicializado', {
      url: supabaseUrl.substring(0, 30) + '...', // Log parcial da URL
    });
  } catch {
    logger.error('ERRO: VITE_SUPABASE_URL não é uma URL válida');
  }
}

export const supabase = supabaseClient!;

/**
 * Configuração de paginação padrão
 * Previne queries massivas que podem causar DoS ou custos altos
 */
export const DEFAULT_PAGE_SIZE = 100;
export const MAX_PAGE_SIZE = 1000;

// Tipos para as tabelas
export interface CoordinatorMaster {
  id: string;
  nome: string;
  email: string;
  senha: string;
  telefone: string | null;
  ativo: boolean;
  ultimo_acesso: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface Organizacao {
  id: string;
  nome: string;
  tipo: string;
  tipo_personalizado: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  latitude: number | null;
  longitude: number | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Equipe {
  id: string;
  nome: string;
  cor: string;
  organizacao_id: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  latitude: number | null;
  longitude: number | null;
  meta: number;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Coordenador {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  regiao: string | null;
  organizacao_id: string | null;
  codigo_unico: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  latitude: number | null;
  longitude: number | null;
  meta: number;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Lideranca {
  id: string;
  equipe_id: string;
  organizacao_id: string | null;
  nome: string;
  telefone: string | null;
  email: string | null;
  codigo_unico: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  latitude: number | null;
  longitude: number | null;
  meta: number;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Cadastro {
  id: string;
  lideranca_id: string | null;
  coordenador_id: string | null;
  nome: string;
  data_nascimento: string | null;
  telefone: string | null;
  email: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  latitude: number | null;
  longitude: number | null;
  aceite_politica: boolean;
  origem: string;
  criado_em: string;
}

export interface Configuracao {
  id: string;
  chave: string;
  valor: string | null;
  descricao: string | null;
  atualizado_em: string;
}

// Funções para Coordenadores Master
export const coordenadoresMasterService = {
  // Listar todos (com paginação segura)
  async listar(page: number = 0, pageSize: number = DEFAULT_PAGE_SIZE): Promise<CoordinatorMaster[]> {
    // Limitar pageSize ao máximo permitido
    const safePageSize = Math.min(pageSize, MAX_PAGE_SIZE);
    const start = page * safePageSize;
    const end = start + safePageSize - 1;

    const { data, error } = await supabase
      .from('pltdataandrebueno_coordenadores_master')
      .select('*')
      .order('criado_em', { ascending: false })
      .range(start, end);

    if (error) {
      logger.error('Erro ao listar coordenadores master', error);
      throw error;
    }
    return data || [];
  },

  // Listar TODOS (use com cautela, apenas quando realmente necessário)
  async listarTodos(): Promise<CoordinatorMaster[]> {
    logger.warn('coordenadoresMasterService.listarTodos() chamado - pode ser lento');

    const { data, error } = await supabase
      .from('pltdataandrebueno_coordenadores_master')
      .select('*')
      .order('criado_em', { ascending: false });

    if (error) {
      logger.error('Erro ao listar todos coordenadores master', error);
      throw error;
    }
    return data || [];
  },

  // Buscar por ID
  async buscarPorId(id: string): Promise<CoordinatorMaster | null> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_coordenadores_master')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return data;
  },

  // Buscar por email (para login)
  async buscarPorEmail(email: string): Promise<CoordinatorMaster | null> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_coordenadores_master')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  // Criar novo
  async criar(dados: Omit<CoordinatorMaster, 'id' | 'criado_em' | 'atualizado_em' | 'ultimo_acesso'>): Promise<CoordinatorMaster> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_coordenadores_master')
      .insert([{
        ...dados,
        ativo: dados.ativo ?? true,
      }])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Atualizar
  async atualizar(id: string, dados: Partial<CoordinatorMaster>): Promise<CoordinatorMaster> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_coordenadores_master')
      .update({
        ...dados,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Excluir
  async excluir(id: string): Promise<void> {
    const { error } = await supabase
      .from('pltdataandrebueno_coordenadores_master')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Atualizar último acesso
  async atualizarUltimoAcesso(id: string): Promise<void> {
    const { error } = await supabase
      .from('pltdataandrebueno_coordenadores_master')
      .update({ ultimo_acesso: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  // Toggle ativo
  async toggleAtivo(id: string, ativo: boolean): Promise<void> {
    const { error } = await supabase
      .from('pltdataandrebueno_coordenadores_master')
      .update({
        ativo,
        atualizado_em: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) throw error;
  },
};

// Serviço de Organizações
export const organizacoesService = {
  async listar(page: number = 0, pageSize: number = DEFAULT_PAGE_SIZE): Promise<Organizacao[]> {
    const safePageSize = Math.min(pageSize, MAX_PAGE_SIZE);
    const start = page * safePageSize;
    const end = start + safePageSize - 1;

    const { data, error } = await supabase
      .from('pltdataandrebueno_organizacoes')
      .select('*')
      .order('criado_em', { ascending: false })
      .range(start, end);

    if (error) {
      logger.error('Erro ao listar organizações', error);
      throw error;
    }
    return data || [];
  },

  async listarTodos(): Promise<Organizacao[]> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_organizacoes')
      .select('*')
      .order('criado_em', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async buscarPorId(id: string): Promise<Organizacao | null> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_organizacoes')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async criar(dados: Omit<Organizacao, 'id' | 'criado_em' | 'atualizado_em'>): Promise<Organizacao> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_organizacoes')
      .insert([dados])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async atualizar(id: string, dados: Partial<Organizacao>): Promise<Organizacao> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_organizacoes')
      .update({ ...dados, atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async excluir(id: string): Promise<void> {
    const { error } = await supabase
      .from('pltdataandrebueno_organizacoes')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// Serviço de Equipes
export const equipesService = {
  async listar(page: number = 0, pageSize: number = DEFAULT_PAGE_SIZE): Promise<Equipe[]> {
    const safePageSize = Math.min(pageSize, MAX_PAGE_SIZE);
    const start = page * safePageSize;
    const end = start + safePageSize - 1;

    const { data, error } = await supabase
      .from('pltdataandrebueno_equipes')
      .select('*')
      .order('criado_em', { ascending: false })
      .range(start, end);

    if (error) {
      logger.error('Erro ao listar equipes', error);
      throw error;
    }
    return data || [];
  },

  async listarTodos(): Promise<Equipe[]> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_equipes')
      .select('*')
      .order('criado_em', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async buscarPorId(id: string): Promise<Equipe | null> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_equipes')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async criar(dados: Omit<Equipe, 'id' | 'criado_em' | 'atualizado_em'>): Promise<Equipe> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_equipes')
      .insert([dados])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async atualizar(id: string, dados: Partial<Equipe>): Promise<Equipe> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_equipes')
      .update({ ...dados, atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async verificarDependencias(id: string): Promise<{ liderancas: number; coordenadores: number; cadastros: number }> {
    // Contar lideranças vinculadas
    const { count: liderancasCount } = await supabase
      .from('pltdataandrebueno_liderancas')
      .select('*', { count: 'exact', head: true })
      .eq('equipe_id', id);

    // Contar coordenadores vinculados (via junction table)
    const { count: coordenadoresCount } = await supabase
      .from('pltdataandrebueno_equipe_coordenadores')
      .select('*', { count: 'exact', head: true })
      .eq('equipe_id', id);

    // Contar cadastros vinculados via lideranças desta equipe
    const { data: liderancaIds } = await supabase
      .from('pltdataandrebueno_liderancas')
      .select('id')
      .eq('equipe_id', id);
    let cadastrosCount = 0;
    if (liderancaIds && liderancaIds.length > 0) {
      const { count } = await supabase
        .from('pltdataandrebueno_cadastros')
        .select('*', { count: 'exact', head: true })
        .in('lideranca_id', liderancaIds.map(l => l.id));
      cadastrosCount = count || 0;
    }

    return {
      liderancas: liderancasCount || 0,
      coordenadores: coordenadoresCount || 0,
      cadastros: cadastrosCount,
    };
  },

  async excluir(id: string): Promise<void> {
    // 1. Desvincular lideranças da equipe (set equipe_id = null)
    const { error: unlinkError } = await supabase
      .from('pltdataandrebueno_liderancas')
      .update({ equipe_id: null, atualizado_em: new Date().toISOString() })
      .eq('equipe_id', id);
    if (unlinkError) throw unlinkError;

    // 2. equipe_coordenadores tem CASCADE DELETE, então é auto-removido
    // 3. Deletar a equipe
    const { error } = await supabase
      .from('pltdataandrebueno_equipes')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async contarLiderancas(equipeId: string): Promise<number> {
    const { count, error } = await supabase
      .from('pltdataandrebueno_liderancas')
      .select('*', { count: 'exact', head: true })
      .eq('equipe_id', equipeId);
    if (error) throw error;
    return count || 0;
  },

  async contarCadastros(equipeId: string): Promise<number> {
    const { data: liderancas } = await supabase
      .from('pltdataandrebueno_liderancas')
      .select('id')
      .eq('equipe_id', equipeId);

    if (!liderancas || liderancas.length === 0) return 0;

    const liderancaIds = liderancas.map(l => l.id);
    const { count, error } = await supabase
      .from('pltdataandrebueno_cadastros')
      .select('*', { count: 'exact', head: true })
      .in('lideranca_id', liderancaIds);
    if (error) throw error;
    return count || 0;
  },
};

// Serviço de Coordenadores
export const coordenadoresService = {
  async listar(page: number = 0, pageSize: number = DEFAULT_PAGE_SIZE): Promise<Coordenador[]> {
    const safePageSize = Math.min(pageSize, MAX_PAGE_SIZE);
    const start = page * safePageSize;
    const end = start + safePageSize - 1;

    const { data, error } = await supabase
      .from('pltdataandrebueno_coordenadores')
      .select('*')
      .order('criado_em', { ascending: false })
      .range(start, end);

    if (error) {
      logger.error('Erro ao listar coordenadores', error);
      throw error;
    }
    return data || [];
  },

  async listarTodos(): Promise<Coordenador[]> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_coordenadores')
      .select('*')
      .order('criado_em', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async buscarPorId(id: string): Promise<Coordenador | null> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_coordenadores')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async buscarPorCodigo(codigo: string): Promise<Coordenador | null> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_coordenadores')
      .select('*')
      .eq('codigo_unico', codigo)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async criar(dados: Omit<Coordenador, 'id' | 'criado_em' | 'atualizado_em'>): Promise<Coordenador> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_coordenadores')
      .insert([dados])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async atualizar(id: string, dados: Partial<Coordenador>): Promise<Coordenador> {
    // PROTEÇÃO: codigo_unico NUNCA pode ser alterado após criação
    const { codigo_unico, id: _id, criado_em, ...dadosSeguros } = dados as any;

    const { data, error } = await supabase
      .from('pltdataandrebueno_coordenadores')
      .update({ ...dadosSeguros, atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async verificarDependencias(id: string): Promise<{ cadastros: number; equipes: number }> {
    // Contar cadastros vinculados diretamente ao coordenador
    const { count: cadastrosCount } = await supabase
      .from('pltdataandrebueno_cadastros')
      .select('*', { count: 'exact', head: true })
      .eq('coordenador_id', id);

    // Contar equipes vinculadas (via junction table)
    const { count: equipesCount } = await supabase
      .from('pltdataandrebueno_equipe_coordenadores')
      .select('*', { count: 'exact', head: true })
      .eq('coordenador_id', id);

    return {
      cadastros: cadastrosCount || 0,
      equipes: equipesCount || 0,
    };
  },

  async excluir(id: string): Promise<void> {
    // Desvincular cadastros do coordenador antes de excluir (FK com NO ACTION)
    const { error: unlinkError } = await supabase
      .from('pltdataandrebueno_cadastros')
      .update({ coordenador_id: null })
      .eq('coordenador_id', id);
    if (unlinkError) throw unlinkError;

    // equipe_coordenadores tem CASCADE DELETE, então é auto-removido

    const { error } = await supabase
      .from('pltdataandrebueno_coordenadores')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};

// Serviço de Lideranças
export const liderancasService = {
  async listar(page: number = 0, pageSize: number = DEFAULT_PAGE_SIZE): Promise<Lideranca[]> {
    const safePageSize = Math.min(pageSize, MAX_PAGE_SIZE);
    const start = page * safePageSize;
    const end = start + safePageSize - 1;

    const { data, error } = await supabase
      .from('pltdataandrebueno_liderancas')
      .select('*')
      .order('criado_em', { ascending: false })
      .range(start, end);

    if (error) {
      logger.error('Erro ao listar lideranças', error);
      throw error;
    }
    return data || [];
  },

  async listarTodos(): Promise<Lideranca[]> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_liderancas')
      .select('*')
      .order('criado_em', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async listarTodosPorEquipe(equipeId: string): Promise<Lideranca[]> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_liderancas')
      .select('*')
      .eq('equipe_id', equipeId)
      .order('criado_em', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async listarPorEquipe(equipeId: string, page: number = 0, pageSize: number = DEFAULT_PAGE_SIZE): Promise<Lideranca[]> {
    const safePageSize = Math.min(pageSize, MAX_PAGE_SIZE);
    const start = page * safePageSize;
    const end = start + safePageSize - 1;

    const { data, error } = await supabase
      .from('pltdataandrebueno_liderancas')
      .select('*')
      .eq('equipe_id', equipeId)
      .order('criado_em', { ascending: false })
      .range(start, end);

    if (error) {
      logger.error('Erro ao listar lideranças por equipe', error);
      throw error;
    }
    return data || [];
  },

  async buscarPorId(id: string): Promise<Lideranca | null> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_liderancas')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async buscarPorCodigo(codigo: string): Promise<Lideranca | null> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_liderancas')
      .select('*')
      .eq('codigo_unico', codigo)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async criar(dados: Omit<Lideranca, 'id' | 'criado_em' | 'atualizado_em'>): Promise<Lideranca> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_liderancas')
      .insert([dados])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async atualizar(id: string, dados: Partial<Lideranca>): Promise<Lideranca> {
    // PROTEÇÃO: codigo_unico NUNCA pode ser alterado após criação
    const { codigo_unico, id: _id, criado_em, ...dadosSeguros } = dados as any;

    const { data, error } = await supabase
      .from('pltdataandrebueno_liderancas')
      .update({ ...dadosSeguros, atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async verificarDependencias(id: string): Promise<{ cadastros: number }> {
    const { count: cadastrosCount } = await supabase
      .from('pltdataandrebueno_cadastros')
      .select('*', { count: 'exact', head: true })
      .eq('lideranca_id', id);

    return { cadastros: cadastrosCount || 0 };
  },

  async excluir(id: string): Promise<void> {
    // Desvincular cadastros da liderança antes de excluir (FK com NO ACTION)
    const { error: unlinkError } = await supabase
      .from('pltdataandrebueno_cadastros')
      .update({ lideranca_id: null })
      .eq('lideranca_id', id);
    if (unlinkError) throw unlinkError;

    const { error } = await supabase
      .from('pltdataandrebueno_liderancas')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async contarCadastros(liderancaId: string): Promise<number> {
    const { count, error } = await supabase
      .from('pltdataandrebueno_cadastros')
      .select('*', { count: 'exact', head: true })
      .eq('lideranca_id', liderancaId);
    if (error) throw error;
    return count || 0;
  },
};

// Serviço de Cadastros
export const cadastrosService = {
  async listar(page: number = 0, pageSize: number = DEFAULT_PAGE_SIZE): Promise<Cadastro[]> {
    const safePageSize = Math.min(pageSize, MAX_PAGE_SIZE);
    const start = page * safePageSize;
    const end = start + safePageSize - 1;

    const { data, error } = await supabase
      .from('pltdataandrebueno_cadastros')
      .select('*')
      .order('criado_em', { ascending: false })
      .range(start, end);

    if (error) {
      logger.error('Erro ao listar cadastros', error);
      throw error;
    }
    return data || [];
  },

  async listarTodos(): Promise<Cadastro[]> {
    logger.warn('cadastrosService.listarTodos() chamado - pode ser muito lento com muitos cadastros');

    const { data, error } = await supabase
      .from('pltdataandrebueno_cadastros')
      .select('*')
      .order('criado_em', { ascending: false });

    if (error) {
      logger.error('Erro ao listar todos cadastros', error);
      throw error;
    }
    return data || [];
  },

  async listarDesde(dataInicial: string): Promise<Cadastro[]> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_cadastros')
      .select('*')
      .gte('criado_em', dataInicial)
      .order('criado_em', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async listarPorEquipe(equipeId: string): Promise<Cadastro[]> {
    const { data: liderancas } = await supabase
      .from('pltdataandrebueno_liderancas')
      .select('id')
      .eq('equipe_id', equipeId);
    if (!liderancas || liderancas.length === 0) return [];
    const ids = liderancas.map(l => l.id);
    const { data, error } = await supabase
      .from('pltdataandrebueno_cadastros')
      .select('*')
      .in('lideranca_id', ids)
      .order('criado_em', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async listarPorCoordenador(coordenadorId: string): Promise<Cadastro[]> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_cadastros')
      .select('*')
      .eq('coordenador_id', coordenadorId)
      .order('criado_em', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async listarPorLideranca(liderancaId: string, page: number = 0, pageSize: number = DEFAULT_PAGE_SIZE): Promise<Cadastro[]> {
    const safePageSize = Math.min(pageSize, MAX_PAGE_SIZE);
    const start = page * safePageSize;
    const end = start + safePageSize - 1;

    const { data, error } = await supabase
      .from('pltdataandrebueno_cadastros')
      .select('*')
      .eq('lideranca_id', liderancaId)
      .order('criado_em', { ascending: false })
      .range(start, end);

    if (error) {
      logger.error('Erro ao listar cadastros por liderança', error);
      throw error;
    }
    return data || [];
  },

  async buscarPorId(id: string): Promise<Cadastro | null> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_cadastros')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async criar(dados: Omit<Cadastro, 'id' | 'criado_em'>): Promise<Cadastro> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_cadastros')
      .insert([dados])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** Verifica se já existe cadastro com o mesmo telefone ou email (via RPC seguro) */
  async verificarDuplicidade(telefone: string, email: string): Promise<{ duplicado: boolean; campo: 'telefone' | 'email' | null }> {
    const { data, error } = await supabase.rpc('check_cadastro_duplicidade', {
      p_telefone: telefone || '',
      p_email: email || '',
    });
    if (error) {
      console.error('Erro ao verificar duplicidade:', error);
      return { duplicado: false, campo: null };
    }
    return { duplicado: data?.duplicado ?? false, campo: data?.campo ?? null };
  },

  /** Insert sem .select() — para uso público (anon) que não tem permissão SELECT */
  async criarPublico(dados: Omit<Cadastro, 'id' | 'criado_em'>): Promise<void> {
    const { error } = await supabase
      .from('pltdataandrebueno_cadastros')
      .insert([dados] as any);
    if (error) throw error;
  },

  async atualizar(id: string, dados: Partial<Cadastro>): Promise<Cadastro> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_cadastros')
      .update(dados)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async excluir(id: string): Promise<void> {
    const { error } = await supabase
      .from('pltdataandrebueno_cadastros')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },

  async contar(): Promise<number> {
    const { count, error } = await supabase
      .from('pltdataandrebueno_cadastros')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count || 0;
  },
};

// Serviço de Configurações
export const configuracoesService = {
  async buscar(chave: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_configuracoes')
      .select('valor')
      .eq('chave', chave)
      .maybeSingle();
    if (error) throw error;
    return data?.valor || null;
  },

  async salvar(chave: string, valor: string): Promise<void> {
    const { error } = await supabase
      .from('pltdataandrebueno_configuracoes')
      .upsert({
        chave,
        valor,
        atualizado_em: new Date().toISOString()
      }, {
        onConflict: 'chave'
      });
    if (error) throw error;
  },

  async salvarMuitos(configuracoes: { chave: string, valor: string }[]): Promise<void> {
    if (!configuracoes || configuracoes.length === 0) return;

    const { error } = await supabase
      .from('pltdataandrebueno_configuracoes')
      .upsert(
        configuracoes.map(c => ({
          ...c,
          atualizado_em: new Date().toISOString()
        })),
        { onConflict: 'chave' }
      );

    if (error) throw error;
  },

  async listarTodas(): Promise<{ chave: string, valor: string }[]> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_configuracoes')
      .select('chave, valor');
    if (error) throw error;
    return data || [];
  },
};

// Função para gerar código único
export const gerarCodigoUnico = (): string => {
  const caracteres = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let codigo = '';
  for (let i = 0; i < 8; i++) {
    codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
  }
  return codigo;
};

// ==================== RESPONSAVEIS ====================

export interface Responsavel {
  id: string;
  nome: string;
  cargo: string | null;
  telefone: string | null;
  email: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

// Serviço de Responsáveis
export const responsaveisService = {
  async listarTodos(): Promise<Responsavel[]> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_responsaveis')
      .select('*')
      .eq('ativo', true)
      .order('nome');
    if (error) throw error;
    return data || [];
  },

  async buscarPorId(id: string): Promise<Responsavel | null> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_responsaveis')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async criar(dados: Omit<Responsavel, 'id' | 'criado_em' | 'atualizado_em'>): Promise<Responsavel> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_responsaveis')
      .insert([dados])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async atualizar(id: string, dados: Partial<Responsavel>): Promise<Responsavel> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_responsaveis')
      .update({ ...dados, atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async excluir(id: string): Promise<void> {
    const { error } = await supabase
      .from('pltdataandrebueno_responsaveis')
      .update({ ativo: false, atualizado_em: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },
};

// ==================== TAREFAS E AGENDAMENTOS ====================

// Tipos para Tarefas
export type TarefaStatus = 'pendente' | 'em_progresso' | 'concluida' | 'cancelada';
export type TarefaPrioridade = 'alta' | 'media' | 'baixa';

export interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  status: TarefaStatus;
  prioridade: TarefaPrioridade;
  data_vencimento: string | null;
  data_lembrete: string | null;
  data_conclusao: string | null;
  responsavel_id: string | null;
  coordenador_id: string | null;
  lideranca_id: string | null;
  equipe_id: string | null;
  criado_por: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface TarefaComRelacoes extends Tarefa {
  responsavel?: Responsavel | null;
  coordenador?: Coordenador | null;
  lideranca?: Lideranca | null;
  equipe?: Equipe | null;
}

// Serviço de Tarefas
export const tarefasService = {
  async listar(page: number = 0, pageSize: number = DEFAULT_PAGE_SIZE): Promise<Tarefa[]> {
    const safePageSize = Math.min(pageSize, MAX_PAGE_SIZE);
    const start = page * safePageSize;
    const end = start + safePageSize - 1;

    const { data, error } = await supabase
      .from('pltdataandrebueno_tarefas')
      .select('*')
      .eq('ativo', true)
      .order('data_vencimento', { ascending: true, nullsFirst: false })
      .range(start, end);

    if (error) {
      logger.error('Erro ao listar tarefas', error);
      throw error;
    }
    return data || [];
  },

  async listarTodos(): Promise<Tarefa[]> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_tarefas')
      .select('*')
      .eq('ativo', true)
      .order('data_vencimento', { ascending: true, nullsFirst: false });
    if (error) throw error;
    return data || [];
  },

  async buscarPorId(id: string): Promise<Tarefa | null> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_tarefas')
      .select('*')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') throw error;
    return data;
  },

  async criar(dados: Omit<Tarefa, 'id' | 'criado_em' | 'atualizado_em'>): Promise<Tarefa> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_tarefas')
      .insert([dados])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async atualizar(id: string, dados: Partial<Tarefa>): Promise<Tarefa> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_tarefas')
      .update({ ...dados, atualizado_em: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async atualizarStatus(id: string, status: TarefaStatus): Promise<Tarefa> {
    const updateData: Partial<Tarefa> = {
      status,
      atualizado_em: new Date().toISOString(),
    };
    if (status === 'concluida') {
      updateData.data_conclusao = new Date().toISOString();
    }
    const { data, error } = await supabase
      .from('pltdataandrebueno_tarefas')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async excluir(id: string): Promise<void> {
    const { error } = await supabase
      .from('pltdataandrebueno_tarefas')
      .update({ ativo: false, atualizado_em: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async contarPorStatus(): Promise<Record<TarefaStatus, number>> {
    const { data, error } = await supabase
      .from('pltdataandrebueno_tarefas')
      .select('status')
      .eq('ativo', true);
    if (error) throw error;

    const counts: Record<TarefaStatus, number> = {
      pendente: 0,
      em_progresso: 0,
      concluida: 0,
      cancelada: 0,
    };
    (data || []).forEach(item => {
      counts[item.status as TarefaStatus]++;
    });
    return counts;
  },

  async listarAtrasadas(): Promise<Tarefa[]> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('pltdataandrebueno_tarefas')
      .select('*')
      .eq('ativo', true)
      .in('status', ['pendente', 'em_progresso'])
      .lt('data_vencimento', now)
      .order('data_vencimento');
    if (error) throw error;
    return data || [];
  },

  async listarParaHoje(): Promise<Tarefa[]> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

    const { data, error } = await supabase
      .from('pltdataandrebueno_tarefas')
      .select('*')
      .eq('ativo', true)
      .in('status', ['pendente', 'em_progresso'])
      .gte('data_vencimento', startOfDay)
      .lte('data_vencimento', endOfDay)
      .order('data_vencimento');
    if (error) throw error;
    return data || [];
  },
};
