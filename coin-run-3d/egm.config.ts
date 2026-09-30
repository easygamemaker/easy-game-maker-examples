import { defineConfig } from 'easy-game-maker';

export default defineConfig({
  app: {
    name: 'Coin Run 3D',
    version: '1.0.0',
    bundleId: 'com.egm.coinrun3d',
  },
  mode: '3d',
  display: {
    width: 1280,
    height: 720,
    orientation: 'landscape',
    backgroundColor: '#0b1d33',
  },
  build: {
    ios: { deploymentTarget: '16.0' },
    android: { minSdkVersion: 26, targetSdkVersion: 34 },
    desktop: { targets: ['mac', 'windows', 'linux'] },
  },
});
