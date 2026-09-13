import { defineConfig } from 'easy-game-maker';

export default defineConfig({
  app: { name: 'Chess', version: '1.0.0', bundleId: 'com.egm.chess' },
  display: { width: 560, height: 620, orientation: 'portrait', backgroundColor: '#1a1510' },
  build: {
    ios: { deploymentTarget: '16.0' },
    android: { minSdkVersion: 26, targetSdkVersion: 34 },
    desktop: { width: 560, height: 620 },
  },
});
