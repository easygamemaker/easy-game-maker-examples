import { defineConfig } from 'vite';
import { resolve } from 'path';
export default defineConfig({
  resolve: {
    alias: [
      { find: 'easy-game-maker', replacement: resolve(__dirname, '../../easy-game-maker/src/engine/index.ts') },
    ],
  },
});
