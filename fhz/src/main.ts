import { App } from 'easy-game-maker';
import { MenuScene } from './scenes/MenuScene';
import { LevelScene } from './scenes/LevelScene';
import { DualLevelScene } from './scenes/DualLevelScene';
import { FinalScene } from './scenes/FinalScene';

export default function createApp(canvas?: HTMLCanvasElement): App {
  const app = new App({ width: 568, height: 320, backgroundColor: '#1a1a2e' });
  app.init(canvas);

  app.scenes.add('menu', MenuScene);
  app.scenes.add('level', LevelScene);
  app.scenes.add('dualLevel', DualLevelScene);
  app.scenes.add('final', FinalScene);

  void app.scenes.go('menu', { params: { app } });
  app.run();

  return app;
}

if (!window.__EGM_SIMULATOR__) createApp();

declare global {
  interface Window { __EGM_SIMULATOR__?: boolean; }
}
