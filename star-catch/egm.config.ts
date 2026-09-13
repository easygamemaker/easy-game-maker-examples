import { defineConfig } from 'easy-game-maker';

export default defineConfig({
  app: {
    name: 'Star Catch',
    version: '1.0.0',
    bundleId: 'com.egm.starcatch',
  },
  display: {
    width: 360,
    height: 640,
    orientation: 'portrait',
    backgroundColor: '#0a0e1a',
  },
  visualEditor: true,
  build: {
    ios: { deploymentTarget: '16.0' },
    android: { minSdkVersion: 26, targetSdkVersion: 34 },
  },
});
