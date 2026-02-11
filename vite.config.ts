import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    // Base URL - use '/' para desenvolvimento local ou './' para deploy em cPanel
    base: './',

    server: {
      port: 3000,
      host: '0.0.0.0',
    },

    plugins: [react()],

    // REMOVIDO: Nunca expor API keys no bundle do frontend
    // Se precisar de Gemini AI, use via Edge Function no servidor
    define: {},

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },

    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      sourcemap: false,
      minify: 'esbuild', // Usar esbuild (mais rápido e já incluso)
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
            maps: ['leaflet', 'react-leaflet'],
          }
        }
      }
    }
  };
});
