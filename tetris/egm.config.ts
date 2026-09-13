import { defineConfig } from 'easy-game-maker';

export default defineConfig({
  app: {
    name: 'Tetris',
    version: '1.0.0',
    bundleId: 'com.egm.tetris',
  },
  display: {
    width: 500,
    height: 660,
    orientation: 'portrait',
    backgroundColor: '#0d0d1a',
  },
  build: {
    ios: { deploymentTarget: '16.0' },
    android: { minSdkVersion: 26, targetSdkVersion: 34 },
    desktop: { width: 500, height: 660, targets: ['dmg', 'msi', 'appimage'] },
  },
});
