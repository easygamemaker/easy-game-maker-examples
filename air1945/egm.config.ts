import { defineConfig } from 'easy-game-maker';

export default defineConfig({
  app: { name: '1945 Air Force', version: '1.0.0', bundleId: 'com.egm.air1945' },
  display: { width: 420, height: 680, orientation: 'portrait', backgroundColor: '#030810' },
  build: {
    ios: { deploymentTarget: '16.0' },
    android: { minSdkVersion: 26, targetSdkVersion: 34 },
    desktop: { width: 420, height: 680 },
  },
});
