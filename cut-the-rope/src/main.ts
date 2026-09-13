import { App } from 'easy-game-maker';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';

export default function createApp(canvas?: HTMLCanvasElement): App {
  const app = new App({ width: 360, height: 640, backgroundColor: '#1a1f3a' });
  app.init(canvas);

  app.scenes.add('menu', MenuScene);
  app.scenes.add('game', GameScene);

  void app.scenes.go('menu', { params: { app } });
  app.run();

  return app;
}

if (!window.__EGM_SIMULATOR__) createApp();

declare global {
  interface Window { __EGM_SIMULATOR__?: boolean; }
}
