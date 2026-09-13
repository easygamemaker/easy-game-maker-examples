import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: [
      {
        find: 'easy-game-maker/e2e',
        replacement: resolve(__dirname, '../../easy-game-maker/src/testing/e2e/index.ts'),
      },
      {
        find: 'easy-game-maker',
        replacement: resolve(__dirname, '../../easy-game-maker/src/engine/index.ts'),
      },
    ],
  },
});
