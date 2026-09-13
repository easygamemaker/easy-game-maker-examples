import { defineConfig } from 'easy-game-maker';

export default defineConfig({
  app: { name: 'Fruits Hate Zombies', version: '1.0.0', bundleId: 'com.egm.fhz', icon: 'public/assets/icon.png' },
  display: { width: 568, height: 320, orientation: 'landscape', backgroundColor: '#1a1a2e', scaling: 'fit' },
  build: {
    ios: { deploymentTarget: '16.0' },
    android: { minSdkVersion: 26, targetSdkVersion: 34 },
    desktop: { width: 1136, height: 640 },
  },
});
