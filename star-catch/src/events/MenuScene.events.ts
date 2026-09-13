import type { SceneEvents, VisualScene, App } from 'easy-game-maker';
import { RectShape, Text } from 'easy-game-maker';

let _bestScore = 0;

export function setBestScore(v: number): void {
  _bestScore = Math.max(_bestScore, v);
}

export default {
  onInit(scene: VisualScene, app: App) {
    const best  = scene.getById<Text>('bestScore');
    const title = scene.getById<Text>('title');
    const prompt = scene.getById<Text>('prompt');

    if (best)  best.text = `Best: ${_bestScore}`;

    // Fade title in from 0
    if (title) {
      title.alpha = 0;
      app.transitions.to(title as unknown as Record<string, number>, {
        alpha: 1,
        duration: 700,
        easing: (t: number) => t * t,
      });
    }

    // Blink prompt
    if (prompt) {
      app.timers.every(0.6, () => {
        if (prompt) prompt.alpha = prompt.alpha > 0.5 ? 0.2 : 1;
      });
    }
  },

  onUpdate(scene: VisualScene, app: App, dt: number) {
    const starDecor = scene.getById<RectShape>('starDecor');
    const starGlow  = scene.getById<RectShape>('starGlow');

    if (starDecor) starDecor.rotation += dt * 2.4;
    if (starGlow)  starGlow.rotation  -= dt * 1.7;

    // Navigate on space, enter, or tap
    if (
      app.input.isKeyDown(' ') ||
      app.input.isKeyDown('Enter') ||
      app.input.pointer.isDown
    ) {
      void app.goto('GameScene', { params: { app } });
    }
  },

  onResume(scene: VisualScene, app: App) {
    const best = scene.getById<Text>('bestScore');
    if (best) best.text = `Best: ${_bestScore}`;
  },

  onDestroy(_scene: VisualScene, app: App) {
    app.timers.cancelAll();
  },
} satisfies SceneEvents;
