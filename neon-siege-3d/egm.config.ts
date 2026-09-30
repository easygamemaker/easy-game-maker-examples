import { defineConfig } from 'easy-game-maker';

export default defineConfig({
  app: {
    name: 'Neon Siege 3D',
    version: '1.0.0',
    bundleId: 'com.egm.neonsiege3d',
  },
  mode: '3d',
  display: {
    width: 1280,
    height: 720,
    orientation: 'landscape',
    backgroundColor: '#04030c',
  },
  build: {
    ios: { deploymentTarget: '16.0' },
    android: { minSdkVersion: 26, targetSdkVersion: 34 },
    desktop: { targets: ['mac', 'windows', 'linux'] },
  },
});
