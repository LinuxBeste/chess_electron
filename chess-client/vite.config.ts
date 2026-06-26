import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
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
      '/auth': 'http://localhost:25565',
      '/players': 'http://localhost:25565',
      '/games': 'http://localhost:25565',
      '/tournaments': 'http://localhost:25565',
      '/admin': 'http://localhost:25565',
      '/avatars': 'http://localhost:25565',
      '/health': 'http://localhost:25565',
      '/leaderboard': 'http://localhost:25565',
      '/friends': 'http://localhost:25565',
      '/chess-ws': {
        target: 'ws://localhost:25565',
        ws: true,
      },
    },
  },
});
