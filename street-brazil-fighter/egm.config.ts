import { defineConfig } from 'easy-game-maker';

export default defineConfig({
  app: { name: 'Street Brazil Fighter', version: '1.0.0', bundleId: 'com.egm.streetbrazilfighter' },
  display: { width: 1300, height: 700, orientation: 'landscape', backgroundColor: '#10131f' },
  build: {
    ios: { deploymentTarget: '16.0' },
    android: { minSdkVersion: 26, targetSdkVersion: 34 },
    desktop: { targets: ['mac', 'windows', 'linux'], width: 1300, height: 700 },
  },
});
