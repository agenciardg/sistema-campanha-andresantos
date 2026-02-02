/// <reference types="vite/client" />

/**
 * Tipos para variáveis de ambiente do Vite
 * As variáveis devem começar com VITE_ para serem expostas ao cliente
 */
interface ImportMetaEnv {
  // Supabase
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;

  // Geocoding APIs
  readonly VITE_TOMTOM_API_KEY: string;
  readonly VITE_HERE_API_KEY: string;

  // Environment
  readonly VITE_ENVIRONMENT: 'development' | 'production';

  // Vite built-in
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly SSR: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
