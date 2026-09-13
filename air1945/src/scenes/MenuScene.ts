import {
  Scene, RectShape, Text, TransitionManager, Easing,
  type SceneParams, type App,
} from 'easy-game-maker';
import { W, H } from '../game/entities';
import { createPlayerDisplay, createFighterDisplay, createBomberDisplay } from '../game/display';

export class MenuScene extends Scene {
  private _app!: App;
  private _transitions!: TransitionManager;
  private _blinkText!: Text;
  private _ready = false;
  private _demoTime = 0;

  // Decorative demo ships
  private _demoPlayer!: import('easy-game-maker').Group;
  private _demoF1!: import('easy-game-maker').Group;
  private _demoF2!: import('easy-game-maker').Group;
  private _demoB1!: import('easy-game-maker').Group;

  private _go = (): void => {
    if (this._ready) return;
    this._ready = true;
    this._app.input.off('keydown', this._onKey);
    this._app.input.off('pointerdown', this._go);
    void this._app.scenes.go('game', {
      transition: 'fade', duration: 350,
      params: { app: this._app },
    });
  };

  private _onKey = (e: unknown): void => {
    const ev = e as { key: string };
    if (ev.key === ' ') this._go();
  };

  override onCreate(params?: SceneParams): void {
    this._app = params?.['app'] as App;
    this._transitions = new TransitionManager();
    this._build();
  }

  override onResume(): void {
    this._ready = false;
    this._demoTime = 0;
    this._app.input.off('keydown', this._onKey);
    this._app.input.off('pointerdown', this._go);
    this._app.input.on('keydown', this._onKey);
    this._app.input.on('pointerdown', this._go);  // tap-to-start on touch
    this._startBlink();
  }

  override onPause(): void { this._transitions.cancelAll(); }

  override onDestroy(): void {
    this._app.input.off('keydown', this._onKey);
    this._app.input.off('pointerdown', this._go);
  }

  override onUpdate(dt: number): void {
    this._transitions.update(dt);
    this._demoTime += dt;

    // Animate demo ships
    const t = this._demoTime;
    this._demoPlayer.x = W / 2 + Math.sin(t * 0.6) * 60;
    this._demoPlayer.y = H - 140 + Math.sin(t * 1.2) * 12;

    this._demoF1.x = 80 + Math.sin(t * 0.8 + 1) * 30;
    this._demoF1.y = 300 + Math.sin(t * 1.1) * 20;

    this._demoF2.x = W - 80 + Math.sin(t * 0.9 + 2) * 30;
    this._demoF2.y = 260 + Math.sin(t * 1.3 + 1) * 22;

    this._demoB1.x = W / 2 + Math.sin(t * 0.5 + 0.5) * 80;
    this._demoB1.y = 180 + Math.sin(t * 0.7) * 16;
  }

  private _build(): void {
    // BG
    this._r(W / 2, H / 2, W, H, '#030810');

    // Star field
    for (let i = 0; i < 60; i++) {
      const s = new RectShape({ x: Math.random() * W, y: Math.random() * H, width: 2, height: 2, fill: '#ffffff' });
      s.alpha = 0.1 + Math.random() * 0.5; s.anchorX = 0.5; s.anchorY = 0.5;
      this.add(s);
    }

    // Top accent bar
    this._r(W / 2, 2, W, 4, '#2244aa', 0.5);
    this._r(W / 2, 6, W, 2, '#4466cc', 0.3);

    // Demo ships (live, animated in onUpdate)
    this._demoB1 = createBomberDisplay();
    this._demoB1.x = W / 2; this._demoB1.y = 180; this._demoB1.alpha = 0.7;
    this.add(this._demoB1);

    this._demoF1 = createFighterDisplay();
    this._demoF1.x = 80; this._demoF1.y = 300; this._demoF1.alpha = 0.75;
    this.add(this._demoF1);

    this._demoF2 = createFighterDisplay();
    this._demoF2.x = W - 80; this._demoF2.y = 260; this._demoF2.alpha = 0.75;
    this.add(this._demoF2);

    // Title
    const t1 = new Text({ text: '1945', x: W / 2, y: 340, fontSize: 72, color: '#ffe040', fontFamily: 'monospace' });
    t1.anchorX = 0.5; t1.anchorY = 0.5; this.add(t1);

    const t2 = new Text({ text: 'A I R  F O R C E', x: W / 2, y: 396, fontSize: 20, color: '#aaccff', fontFamily: 'monospace' });
    t2.anchorX = 0.5; t2.anchorY = 0.5; this.add(t2);

    this._r(W / 2, 418, 220, 1, '#2244aa');

    // Demo player ship (on top of everything)
    const { group: pg } = createPlayerDisplay();
    pg.x = W / 2; pg.y = H - 140;
    this.add(pg);
    this._demoPlayer = pg;

    // Controls card
    this._r(W / 2, 490, 320, 88, '#0a1428', 0.85);
    this._r(W / 2, 490, 322, 90, '#2244aa', 0.2);

    this._txt('↑ ↓ ← →  /  W A S D  —  MOVE',      W / 2, 464, '#8aaccc', 10);
    this._txt('Z / X  —  USE BOMB',                  W / 2, 480, '#8aaccc', 10);
    this._txt('P  —  PAUSE',                         W / 2, 496, '#8aaccc', 10);
    this._txt('Auto-fire • Collect power-ups',        W / 2, 512, '#667799', 10);

    this._r(W / 2, 525, 200, 1, '#1a2a44');

    // Blink
    this._blinkText = new Text({
      text: '—  PRESS  SPACE  TO  FLY  —',
      x: W / 2, y: 548, fontSize: 14, color: '#ffe040', fontFamily: 'monospace',
    });
    this._blinkText.anchorX = 0.5; this._blinkText.anchorY = 0.5;
    this.add(this._blinkText);

    // Wave info
    this._txt('5 WAVES + BOSS FIGHT', W / 2, 572, '#446688', 9);
    this._txt('Easy Game Maker  v0.1.0', W / 2, 600, '#222a3a', 9);

    // Bottom accent
    this._r(W / 2, H - 4, W, 4, '#2244aa', 0.4);
  }

  private _startBlink(): void {
    this._transitions.cancelAll();
    this._blinkText.alpha = 1;
    const pulse = (): void => {
      this._transitions.to(this._blinkText as unknown as Record<string, number>, {
        alpha: 0.1, duration: 750, easing: Easing.inOutSine,
        onComplete: () => this._transitions.to(
          this._blinkText as unknown as Record<string, number>,
          { alpha: 1, duration: 750, easing: Easing.inOutSine, onComplete: pulse },
        ),
      });
    };
    pulse();
  }

  private _r(x: number, y: number, w: number, h: number, fill: string, alpha = 1): RectShape {
    const r = new RectShape({ x, y, width: w, height: h, fill });
    r.anchorX = 0.5; r.anchorY = 0.5; r.alpha = alpha; this.add(r); return r;
  }

  private _txt(text: string, x: number, y: number, color: string, size: number): Text {
    const t = new Text({ text, x, y, fontSize: size, color, fontFamily: 'monospace' });
    t.anchorX = 0.5; t.anchorY = 0.5; this.add(t); return t;
  }
}
