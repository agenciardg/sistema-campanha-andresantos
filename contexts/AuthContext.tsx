/**
 * AUTH CONTEXT - Gerenciamento de Autenticação com Supabase
 *
 * Usa o sistema de autenticação nativo do Supabase para:
 * - Login com email/senha
 * - Monitoramento de estado de autenticação
 * - Logout
 * - Proteção de rotas
 */

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import logger from '../lib/logger';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, metadata?: { nome?: string }) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      logger.warn('AuthContext: Supabase não configurado - modo desenvolvimento');
      setLoading(false);
      return;
    }

    // onAuthStateChange é a única fonte de verdade para o estado de autenticação.
    // getSession() dispara INITIAL_SESSION/SIGNED_IN no callback abaixo.
    // NÃO chamar getUser() aqui para evitar race condition com o callback.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      logger.info('AuthContext: Estado de autenticação mudou', { event });

      setSession(newSession);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
        // Usar dados da sessão imediatamente para não bloquear a UI
        setUser(newSession?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_IN') {
          logger.auth('Usuário fez login', { userId: newSession?.user?.id });
        }

        // Atualizar app_metadata em background (único local que chama getUser)
        if (newSession?.user) {
          supabase.auth.getUser().then(({ data: { user: freshUser } }) => {
            if (freshUser) setUser(freshUser);
          }).catch(() => {});
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
        logger.auth('Usuário fez logout');
      } else {
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    });

    // getSession() dispara o callback acima com INITIAL_SESSION
    supabase.auth.getSession().then(({ error }) => {
      if (error) {
        logger.error('AuthContext: Erro ao obter sessão', error);
        setLoading(false);
      }
    }).catch(() => {
      setLoading(false);
    });

    // Cleanup
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<{ error: Error | null }> => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase não está configurado. Configure as variáveis de ambiente.') };
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        logger.warn('AuthContext: Falha no login', { email, error: error.message });
        return { error };
      }

      logger.auth('Login bem-sucedido', { userId: data.user?.id, email });
      return { error: null };
    } catch (error) {
      logger.error('AuthContext: Erro inesperado no login', error);
      return { error: error as Error };
    } finally {
      setLoading(false);
    }
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
    metadata?: { nome?: string }
  ): Promise<{ error: Error | null }> => {
    if (!isSupabaseConfigured) {
      return { error: new Error('Supabase não está configurado. Configure as variáveis de ambiente.') };
    }

    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: metadata,
        },
      });

      if (error) {
        logger.warn('AuthContext: Falha no cadastro', { email, error: error.message });
        return { error };
      }

      logger.auth('Cadastro bem-sucedido', { userId: data.user?.id, email });
      return { error: null };
    } catch (error) {
      logger.error('AuthContext: Erro inesperado no cadastro', error);
      return { error: error as Error };
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(async (): Promise<void> => {
    if (!isSupabaseConfigured) {
      setUser(null);
      setSession(null);
      return;
    }

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        logger.error('AuthContext: Erro no logout', error);
      } else {
        logger.auth('Logout realizado com sucesso');
      }
    } catch (error) {
      logger.error('AuthContext: Erro inesperado no logout', error);
    }
  }, []);

  const value = useMemo<AuthContextType>(() => ({
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    isAuthenticated: !!user,
  }), [user, session, loading, signIn, signUp, signOut]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Hook para usar o contexto de autenticação
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);

  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }

  return context;
};

export default AuthContext;
