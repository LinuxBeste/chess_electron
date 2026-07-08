import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const serverUrl = env.CHESS_SERVER_URL || 'http://localhost:3000';

  return {
    root: 'src/renderer',
    base: './',
    plugins: [react()],
    publicDir: path.resolve(__dirname, 'assets'),
    build: {
      outDir: path.resolve(__dirname, 'dist/renderer'),
      emptyOutDir: true,
    },
    server: {
      port: 3000,
      proxy: {
        '/auth': serverUrl,
        '/players': serverUrl,
        '/games': serverUrl,
        '/tournaments': serverUrl,
        '/admin': serverUrl,
        '/avatars': serverUrl,
        '/health': serverUrl,
        '/leaderboard': serverUrl,
        '/friends': serverUrl,
        '/chess-ws': {
          target: serverUrl.replace(/^http/, 'ws'),
          ws: true,
        },
      },
    },
  };
});
