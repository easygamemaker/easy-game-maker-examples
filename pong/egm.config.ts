import { defineConfig } from 'easy-game-maker';

export default defineConfig({
  app: {
    name: 'Pong',
    version: '1.0.0',
    bundleId: 'com.egm.pong',
  },
  display: {
    width: 800,
    height: 500,
    orientation: 'landscape',
    backgroundColor: '#0a0a1a',
  },
  build: {
    ios: {
      deploymentTarget: '16.0',
    },
    android: {
      minSdkVersion: 26,
      targetSdkVersion: 34,
    },
    desktop: {
      targets: ['dmg', 'msi', 'appimage'],
      width: 800,
      height: 500,
    },
  },
});
