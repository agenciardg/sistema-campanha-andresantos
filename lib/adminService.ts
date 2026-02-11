/**
 * ADMIN SERVICE - Gerenciamento de Administradores
 *
 * Serviço para criar, listar, atualizar e excluir administradores do sistema.
 * Usa a Edge Function admin-manager para operações privilegiadas.
 */

import { supabase } from './supabase';

export const PAGINAS_PERMISSOES = [
  { id: 'dashboard', nome: 'Dashboard', icone: 'dashboard' },
  { id: 'registrations', nome: 'Cadastros', icone: 'person_add' },
  { id: 'teams', nome: 'Equipes', icone: 'groups' },
  { id: 'leaders', nome: 'Líderes', icone: 'person' },
  { id: 'coordinators', nome: 'Coordenadores', icone: 'badge' },
  { id: 'organizations', nome: 'Organizações', icone: 'business' },
  { id: 'tasks', nome: 'Tarefas', icone: 'task_alt' },
  { id: 'maps', nome: 'Mapa Eleitoral', icone: 'map' },
] as const;

export type PaginaPermissao = typeof PAGINAS_PERMISSOES[number]['id'];

export interface Admin {
  id: string;
  email: string;
  nome: string;
  telefone: string;
  role: 'superadmin' | 'admin';
  permissions: PaginaPermissao[];
  ativo: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface CreateAdminData {
  email: string;
  password: string;
  nome?: string;
  telefone?: string;
  role?: 'superadmin' | 'admin';
  permissions?: PaginaPermissao[];
}

async function callAdminFunction(action: string, data?: any): Promise<any> {
  const { data: result, error } = await supabase.functions.invoke('admin-manager', {
    body: { action, data },
  });

  if (error) {
    throw new Error(error.message || 'Erro ao processar requisição');
  }

  return result;
}

/**
 * Lista todos os administradores do sistema
 */
export async function listarAdmins(): Promise<Admin[]> {
  const result = await callAdminFunction('list');
  return result.admins || [];
}

/**
 * Cria um novo administrador
 */
export async function criarAdmin(data: CreateAdminData): Promise<Admin> {
  const result = await callAdminFunction('create', data);
  return result.user;
}

/**
 * Atualiza dados de um administrador
 */
export async function atualizarAdmin(userId: string, data: {
  nome?: string;
  telefone?: string;
  role?: 'superadmin' | 'admin';
  permissions?: PaginaPermissao[];
}): Promise<void> {
  await callAdminFunction('update', { userId, ...data });
}

/**
 * Ativa ou desativa um administrador
 */
export async function toggleAdmin(userId: string, ativo: boolean): Promise<void> {
  await callAdminFunction('toggle', { userId, ativo });
}

/**
 * Exclui um administrador
 */
export async function excluirAdmin(userId: string): Promise<void> {
  await callAdminFunction('delete', { userId });
}

export const adminService = {
  listar: listarAdmins,
  criar: criarAdmin,
  atualizar: atualizarAdmin,
  toggle: toggleAdmin,
  excluir: excluirAdmin,
};

export default adminService;
