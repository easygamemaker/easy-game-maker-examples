import { App } from 'easy-game-maker';
import { GameScene } from './scenes/GameScene';

const app = new App({
  width: 800,
  height: 500,
  backgroundColor: '#0a0a1a',
});

app.init();

app.scenes.add('game', GameScene);

// Pass the app reference to the scene via params
void app.scenes.go('game', { params: { app } });

app.run();
