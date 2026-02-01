import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Charge les variables d'environnement
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    build: {
      outDir: 'dist', // Standard pour Cloudflare Pages
    },
    define: {
      'process.env': {
         API_KEY: env.API_KEY,
         // Pas de DATABASE_URL ici, c'est pour le backend Cloudflare uniquement.
      }
    }
  };
});