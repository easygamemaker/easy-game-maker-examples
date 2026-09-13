import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  resolve: {
    alias: {
      'easy-game-maker': resolve(__dirname, '../../easy-game-maker/src/engine/index.ts'),
    },
  },
  build: {
    outDir: 'dist',
    rollupOptions: { input: 'index.html' },
  },
});
