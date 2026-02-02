/**
 * ADMIN SERVICE - Gerenciamento de Administradores
 *
 * Serviço para criar, listar, atualizar e excluir administradores do sistema.
 * Usa a Edge Function admin-manager para operações privilegiadas.
 */

import { supabase } from './supabase';

const FUNCTION_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/smooth-responder`;

export interface Admin {
  id: string;
  email: string;
  nome: string;
  telefone: string;
  role: 'superadmin' | 'user';
  ativo: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface CreateAdminData {
  email: string;
  password: string;
  nome?: string;
  telefone?: string;
  role?: 'superadmin' | 'user';
}

async function getAuthToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error('Usuário não autenticado');
  }
  return session.access_token;
}

async function callAdminFunction(action: string, data?: any): Promise<any> {
  const token = await getAuthToken();

  const response = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ action, data }),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.error || 'Erro ao processar requisição');
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
  role?: 'superadmin' | 'user';
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
