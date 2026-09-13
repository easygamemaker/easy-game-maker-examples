import { App } from 'easy-game-maker';
import type { SceneEvents } from 'easy-game-maker';

const app = new App({ width: 360, height: 640, backgroundColor: '#0a0e1a' });
app.init();

// Auto-discover scenes: each events/*.events.ts maps to public/views/*.view.json
const eventsModules = import.meta.glob('./events/*.events.ts');

for (const path in eventsModules) {
  const name = path.replace('./events/', '').replace('.events.ts', '');
  app.scenes.addVisual(name, eventsModules[path] as () => Promise<{ default: SceneEvents }>);
}

// Start loop immediately; VisualScene loads view.json async and becomes current when ready
void app.goto('MenuScene', { params: { app } });
app.run();

declare global {
  interface Window { __EGM_SIMULATOR__?: boolean; }
}
