import { App } from 'easy-game-maker';
import { DemoScene } from './scenes/DemoScene';

const app = new App({ width: 800, height: 600, backgroundColor: '#070d1a' });
app.init();
app.scenes.add('demo', DemoScene);
void app.scenes.go('demo', { params: { app } });
app.run();
