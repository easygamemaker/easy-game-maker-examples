import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: [
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
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['src/__tests__/setup.ts'],
    include: ['src/__tests__/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/main.ts', 'src/__tests__/**'],
      thresholds: { lines: 60, functions: 60 },
    },
  },
});
