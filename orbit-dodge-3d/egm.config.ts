import { defineConfig } from 'easy-game-maker';

export default defineConfig({
  app: {
    name: 'Orbit Dodge 3D',
    version: '1.0.0',
    bundleId: 'com.egm.orbitdodge3d',
  },
  mode: '3d',
  display: {
    width: 1280,
    height: 720,
    orientation: 'landscape',
    backgroundColor: '#050816',
  },
  build: {
    ios: { deploymentTarget: '16.0' },
    android: { minSdkVersion: 26, targetSdkVersion: 34 },
    desktop: { targets: ['mac', 'windows', 'linux'] },
  },
});
