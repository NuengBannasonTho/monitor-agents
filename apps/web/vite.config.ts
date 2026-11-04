import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const SERVER_PORT = 4777;

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    // The dev server forwards the WebSocket, skin API and sprites to the Fastify server.
    proxy: {
      '/ws': { target: `ws://127.0.0.1:${SERVER_PORT}`, ws: true },
      '/api': { target: `http://127.0.0.1:${SERVER_PORT}` },
      '/skins': { target: `http://127.0.0.1:${SERVER_PORT}` },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Served from 127.0.0.1 only, so a single ~200 kB (gzip) bundle is fine; no need to split.
    chunkSizeWarningLimit: 800,
  },
});
