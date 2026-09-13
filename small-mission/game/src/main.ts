import { App } from 'easy-game-maker';
import { MenuScene }    from './scenes/MenuScene';
import { LobbyScene }   from './scenes/LobbyScene';
import { GameScene }    from './scenes/GameScene';
import { ResultsScene } from './scenes/ResultsScene';

export default function createApp(canvas?: HTMLCanvasElement): App {
  const app = new App({ width: 800, height: 600, backgroundColor: '#1a1f1a' });
  app.init(canvas);

  app.scenes.add('menu',    MenuScene);
  app.scenes.add('lobby',   LobbyScene);
  app.scenes.add('game',    GameScene);
  app.scenes.add('results', ResultsScene);

  void app.scenes.go('menu', { params: { app } });
  app.run();
  return app;
}

if (!window.__EGM_SIMULATOR__) createApp();

declare global {
  interface Window { __EGM_SIMULATOR__?: boolean; }
}
