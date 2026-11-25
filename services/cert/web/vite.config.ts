import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** 개발: /app → 자격증 서비스(3100). 빌드 결과는 서비스가 직접 제공 */
export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5174,
    proxy: { '/app': { target: process.env.CERT_API ?? 'http://127.0.0.1:3100', changeOrigin: true } },
  },
});
