import { defineConfig } from 'easy-game-maker';

export default defineConfig({
  app: {
    name: 'Small Mission EGM',
    version: '1.0.0',
    bundleId: 'com.egm.smallmission',
    icon: 'public/icon.png',
  },
  display: {
    width: 800,
    height: 600,
    orientation: 'landscape',
    backgroundColor: '#1a1f1a',
    scaling: 'fit',
  },
  build: {
    desktop: { width: 1200, height: 900 },
  },
});
