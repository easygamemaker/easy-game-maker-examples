import {
  Scene, Sprite, Text, RectShape, Group, TransitionManager, Easing, WebGLRenderer,
  type SceneParams, type App, type PointerEvent2D,
} from 'easy-game-maker';
import { loadTexture } from '../helpers/loadTexture';
import { SoundManager } from '../game/SoundManager';
import { CANVAS_W, CANVAS_H } from '../config/levels';

const CX = CANVAS_W / 2;
const CY = CANVAS_H / 2;

export class FinalScene extends Scene {
  private _app!: App;
  private _sounds!: SoundManager;
  private _transitions!: TransitionManager;
  private _score = 0;

  override async onCreate(params?: SceneParams): Promise<void> {
    this._app = params?.['app'] as App;
    this._score = (params?.['score'] as number | undefined) ?? 0;
    this._sounds = new SoundManager(this._app);
    this._transitions = new TransitionManager();
    this._sounds.play('assets/audio/geral/final.ogg');
    await this._build();
  }

  private get _r(): WebGLRenderer { return this._app.renderer as WebGLRenderer; }

  private async _build(): Promise<void> {
    // Background — same splash as menu
    const splashTex = await loadTexture(this._r, 'assets/images/menuprincipal/new/splash2.fw.png').catch(() => null);
    if (splashTex) {
      const bg = new Sprite({ texture: splashTex, x: CX, y: CY, width: CANVAS_W, height: CANVAS_H });
      bg.anchorX = 0.5; bg.anchorY = 0.5;
      this.add(bg);
    } else {
      const bg = new RectShape({ x: 0, y: 0, width: CANVAS_W, height: CANVAS_H, fill: '#1a1a2e' });
      bg.anchorX = 0; bg.anchorY = 0;
      this.add(bg);
    }

    // Dark overlay to darken background slightly
    const overlay = new RectShape({ x: 0, y: 0, width: CANVAS_W, height: CANVAS_H, fill: '#00000055' });
    overlay.anchorX = 0; overlay.anchorY = 0;
    this.add(overlay);

    // Watermelon + zombie decorations (same as menu but static)
    const melTex = await loadTexture(this._r, 'assets/images/menuprincipal/new/melancia.fw.png').catch(() => null);
    if (melTex) {
      const mel = new Sprite({ texture: melTex, x: 55, y: 55, width: 108, height: 127 });
      mel.anchorX = 0.5; mel.anchorY = 0.5;
      this.add(mel);
    }

    const zombieTex = await loadTexture(this._r, 'assets/images/menuprincipal/new/zumbi.fw.png').catch(() => null);
    if (zombieTex) {
      const z = new Sprite({ texture: zombieTex, x: CANVAS_W - 90, y: CANVAS_H - 90, width: 192, height: 186 });
      z.anchorX = 0.5; z.anchorY = 0.5;
      this.add(z);
    }

    // FHZ logo fades in at top
    const fhzTex = await loadTexture(this._r, 'assets/images/menuprincipal/new/fhz.fw.png').catch(() => null);
    if (fhzTex) {
      const logo = new Sprite({ texture: fhzTex, x: CX, y: CY - 95, width: 292, height: 234 });
      logo.anchorX = 0.5; logo.anchorY = 0.5; logo.alpha = 0;
      logo.scaleX = 0.55; logo.scaleY = 0.55;
      this.add(logo);
      this._transitions.to(logo as unknown as Record<string, number>, { alpha: 1, duration: 600, easing: Easing.outQuad });
    }

    // "YOU ROCK!" banner
    const youRockTex = await loadTexture(this._r, 'assets/images/comum/yourock.fw.png').catch(() => null);
    if (youRockTex) {
      const banner = new Sprite({ texture: youRockTex, x: CX, y: CY - 15, width: 244, height: 71 });
      banner.anchorX = 0.5; banner.anchorY = 0.5; banner.alpha = 0;
      this.add(banner);
      this._transitions.to(banner as unknown as Record<string, number>, { alpha: 1, duration: 500, easing: Easing.outQuad });
    } else {
      const txt = new Text({ text: 'YOU ROCK!', x: CX, y: CY - 15, fontSize: 36, color: '#22c55e' });
      txt.anchorX = 0.5; txt.anchorY = 0.5;
      this.add(txt);
    }

    // Score
    const scoreTxt = new Text({ text: `Final Score: ${this._score}`, x: CX, y: CY + 40, fontSize: 20, color: '#ffe600' });
    scoreTxt.anchorX = 0.5; scoreTxt.anchorY = 0.5; scoreTxt.alpha = 0;
    this.add(scoreTxt);
    this._transitions.to(scoreTxt as unknown as Record<string, number>, { alpha: 1, duration: 500, easing: Easing.outQuad });

    // "Congratulations — you defeated all zombies!"
    const congrats = new Text({ text: 'Você derrotou todos os zumbis!', x: CX, y: CY + 68, fontSize: 13, color: '#ffffff99' });
    congrats.anchorX = 0.5; congrats.anchorY = 0.5; congrats.alpha = 0;
    this.add(congrats);
    this._transitions.to(congrats as unknown as Record<string, number>, { alpha: 1, duration: 700, easing: Easing.outQuad });

    // Menu button (btn-exit.fw.png) — centered at bottom
    const exitBtnY = CY + 108;
    const exitTex = await loadTexture(this._r, 'assets/images/comum/btn-exit.fw.png').catch(() => null);
    if (exitTex) {
      const btn = new Sprite({ texture: exitTex, x: CX, y: exitBtnY, width: 64, height: 64 });
      btn.anchorX = 0.5; btn.anchorY = 0.5; btn.alpha = 0;
      this.add(btn);
      this._transitions.to(btn as unknown as Record<string, number>, { alpha: 1, duration: 500 });
    }

    // Label under button
    const menuLabel = new Text({ text: 'Menu', x: CX, y: exitBtnY + 38, fontSize: 12, color: '#ffffff88' });
    menuLabel.anchorX = 0.5; menuLabel.anchorY = 0.5;
    this.add(menuLabel);

    // Click anywhere (or on button) → go to menu
    this._app.input.on<PointerEvent2D>('pointerdown', () => {
      this._sounds.button();
      this._app.scenes.destroyScene('final');
      this._app.scenes.destroyScene('level');
      this._app.scenes.destroyScene('menu');
      void this._app.scenes.go('menu', { params: { app: this._app } });
    });
  }

  override onUpdate(dt: number): void {
    this._transitions.update(dt);
  }
}
