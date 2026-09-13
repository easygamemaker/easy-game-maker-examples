import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'easy-game-maker': resolve(__dirname, '../../easy-game-maker/src/engine/index.ts'),
    },
  },
});
