import {
  Scene, Text, RectShape, Group, TransitionManager,
  type SceneParams, type App, type PointerEvent2D,
} from 'easy-game-maker';
import { SoundManager } from '../game/SoundManager';
import { CANVAS_W, CANVAS_H, LEVELS } from '../config/levels';

export class LevelSelectScene extends Scene {
  private _app!: App;
  private _sounds!: SoundManager;
  private _transitions!: TransitionManager;

  override onCreate(params?: SceneParams): void {
    this._app = params?.['app'] as App;
    this._sounds = new SoundManager(this._app);
    this._transitions = new TransitionManager();
    this._build();
  }

  private _build(): void {
    const bg = new RectShape({ x: 0, y: 0, width: CANVAS_W, height: CANVAS_H, fill: '#0f172a' });
    bg.anchorX = 0; bg.anchorY = 0;
    this.add(bg);

    const title = new Text({ text: 'SELECT LEVEL', x: CANVAS_W / 2, y: 44, fontSize: 28, color: '#ffe600' });
    title.anchorX = 0.5; title.anchorY = 0.5;
    this.add(title);

    const cardW = 108;
    const cardH = 100;
    const gap = 18;
    const totalW = LEVELS.length * (cardW + gap) - gap;
    const startX = (CANVAS_W - totalW) / 2 + cardW / 2;

    for (let i = 0; i < LEVELS.length; i++) {
      const level = LEVELS[i]!;
      const cx = startX + i * (cardW + gap);
      const cy = CANVAS_H / 2 + 20;

      const card = new Group();
      card.x = cx; card.y = cy;

      const cardBg = new RectShape({ x: 0, y: 0, width: cardW, height: cardH, fill: '#1e3a5f' });
      cardBg.anchorX = 0.5; cardBg.anchorY = 0.5;
      card.add(cardBg);

      const num = new Text({ text: `${level.id}`, x: 0, y: -20, fontSize: 34, color: '#ffe600' });
      num.anchorX = 0.5; num.anchorY = 0.5;
      card.add(num);

      const name = new Text({ text: level.name, x: 0, y: 16, fontSize: 11, color: '#94a3b8' });
      name.anchorX = 0.5; name.anchorY = 0.5;
      card.add(name);

      const zCount = level.dual ? (level.dual.topLane.zombies.length + level.dual.bottomLane.zombies.length) : (level.zombies?.length ?? 0);
      const info = new Text({ text: `${zCount} zombies`, x: 0, y: 30, fontSize: 10, color: '#ef4444' });
      info.anchorX = 0.5; info.anchorY = 0.5;
      card.add(info);

      this.add(card);

      const lid = level.id;
      this._app.input.on<PointerEvent2D>('pointerdown', (e) => {
        if (Math.abs(e.x - cx) < cardW / 2 && Math.abs(e.y - cy) < cardH / 2) {
          this._sounds.button();
          void this._app.scenes.go('level', { params: { app: this._app, level: lid } });
        }
      });
    }

    const back = new Text({ text: '← Back', x: 40, y: CANVAS_H - 22, fontSize: 14, color: '#94a3b8' });
    back.anchorX = 0.5; back.anchorY = 0.5;
    this.add(back);

    this._app.input.on<PointerEvent2D>('pointerdown', (e) => {
      if (e.x < 100 && e.y > CANVAS_H - 44) {
        this._sounds.button();
        void this._app.scenes.go('menu', { params: { app: this._app } });
      }
    });
  }

  override onUpdate(dt: number): void {
    this._transitions.update(dt);
  }
}
