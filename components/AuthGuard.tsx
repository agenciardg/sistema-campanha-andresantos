/**
 * AUTH GUARD COMPONENT - Proteção de Rotas
 *
 * Este componente protege rotas privadas verificando autenticação via Supabase.
 * Se o usuário não estiver autenticado, redireciona para /login
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredPermission?: string;
}

/**
 * Componente de Loading durante verificação de autenticação
 */
const LoadingScreen: React.FC = () => (
  <div className="min-h-screen bg-[#0a0e13] flex items-center justify-center">
    <div className="flex flex-col items-center gap-4">
      <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      <p className="text-[#92adc9] text-sm">Verificando autenticação...</p>
    </div>
  </div>
);

/**
 * Componente AuthGuard
 * Protege rotas que requerem autenticação e verifica permissões
 */
const AuthGuard: React.FC<AuthGuardProps> = ({ children, requiredPermission }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  // Mostrar loading enquanto verifica autenticação
  if (loading) {
    return <LoadingScreen />;
  }

  // Redirecionar para login se não autenticado
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Verificar permissão de página (se requiredPermission foi definido)
  if (requiredPermission && user) {
    const role = (user as any).app_metadata?.role;
    // Superadmin sempre tem acesso total
    if (role !== 'superadmin') {
      const permissions: string[] = (user as any).app_metadata?.permissions || [];
      if (!permissions.includes(requiredPermission)) {
        return <Navigate to="/dashboard" replace />;
      }
    }
  }

  // Usuário autenticado e autorizado - renderizar children
  return <>{children}</>;
};

export default AuthGuard;

/**
 * Hook customizado para verificar autenticação (re-exportado do contexto)
 * Use em componentes que precisam do usuário atual
 */
export { useAuth } from '../contexts/AuthContext';
