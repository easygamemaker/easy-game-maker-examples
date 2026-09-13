import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: [
      // E2E sub-path MUST come before the base path
      {
        find: 'easy-game-maker/e2e',
        replacement: resolve(__dirname, '../../easy-game-maker/src/testing/e2e/index.ts'),
      },
      {
        find: 'easy-game-maker/testing',
        replacement: resolve(__dirname, '../../easy-game-maker/src/testing/index.ts'),
      },
      {
        find: 'easy-game-maker',
        replacement: resolve(__dirname, '../../easy-game-maker/src/engine/index.ts'),
      },
    ],
  },
});
