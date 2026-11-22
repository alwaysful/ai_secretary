import react from '@vitejs/plugin-react';
import { createReadStream, cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** 공부 집중: MediaPipe wasm을 node_modules에서 /mediapipe-wasm 으로 제공 (개발) + dist 복사 (빌드) */
const WASM_DIR = resolve(__dirname, 'node_modules/@mediapipe/tasks-vision/wasm');
function mediapipeWasm(): Plugin {
  let outDir = 'dist';
  return {
    name: 'mediapipe-wasm',
    configResolved(c) {
      outDir = resolve(c.root, c.build.outDir);
    },
    configureServer(server) {
      server.middlewares.use('/mediapipe-wasm', (req, res, next) => {
        const name = (req.url ?? '').split('?')[0].replace(/^\//, '');
        if (!/^[\w.-]+$/.test(name)) return next();
        res.setHeader('Content-Type', name.endsWith('.wasm') ? 'application/wasm' : 'text/javascript');
        createReadStream(join(WASM_DIR, name)).on('error', () => next()).pipe(res);
      });
    },
    closeBundle() {
      cpSync(WASM_DIR, join(outDir, 'mediapipe-wasm'), { recursive: true });
    },
  };
}

/** /api/* → 백엔드(127.0.0.1:3000). 브라우저 입장에서 same-origin이라 CORS 불필요. */
export default defineConfig({
  plugins: [react(), mediapipeWasm()],
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
