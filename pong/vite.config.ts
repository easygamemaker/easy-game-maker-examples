import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Point directly to the engine TypeScript source — no build step needed
      'easy-game-maker': resolve(__dirname, '../../easy-game-maker/src/engine/index.ts'),
    },
  },
});
