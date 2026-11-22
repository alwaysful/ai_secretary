import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** /api/* → 백엔드(127.0.0.1:3000). 브라우저 입장에서 same-origin이라 CORS 불필요. */
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.AURA_API ?? 'http://127.0.0.1:3000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
});
