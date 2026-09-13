import { defineConfig } from 'easy-game-maker';

export default defineConfig({
  app: { name: 'Cut the Rope', version: '1.0.0', bundleId: 'com.egm.cuttherope', icon: 'public/assets/icon.png' },
  display: { width: 360, height: 640, orientation: 'portrait', backgroundColor: '#1a1f3a', scaling: 'fit' },
  build: {
    ios: { deploymentTarget: '16.0' },
    android: { minSdkVersion: 26, targetSdkVersion: 34 },
    desktop: { width: 360, height: 640 },
  },
});
