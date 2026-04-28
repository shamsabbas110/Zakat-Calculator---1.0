import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load .env file so we can read VITE_API_URL inside the config itself
  const env = loadEnv(mode, process.cwd(), '');

  // Backend origin for the dev-server proxy
  // Falls back to http://localhost:5000 if VITE_API_URL is not set
  const backendTarget = env.VITE_API_URL || 'http://localhost:5000';

  return {
    plugins: [react()],
    server: {
      proxy: {
        // All /api/* requests are forwarded to the Express backend
        '/api': {
          target:       backendTarget,
          changeOrigin: true,
          secure:       false,
        },
      },
    },
  };
});