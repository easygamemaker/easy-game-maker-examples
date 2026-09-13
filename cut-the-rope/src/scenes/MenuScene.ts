import {
  Scene, Sprite, Text, RectShape, TransitionManager, Easing, WebGLRenderer,
  type SceneParams, type App, type PointerEvent2D,
} from 'easy-game-maker';
import { loadTexture } from '../helpers/loadTexture';

const W = 360, H = 640;

export class MenuScene extends Scene {
  private _app!: App;
  private _transitions!: TransitionManager;
  private _musicBuf: AudioBuffer | null = null;

  override async onCreate(params?: SceneParams): Promise<void> {
    this._app = params?.['app'] as App;
    this._transitions = new TransitionManager();

    const r = this._app.renderer as WebGLRenderer;

    // Background (rotated 90° in original — we scale to fit portrait)
    const bgTex = await loadTexture(r, 'assets/images/menubg.jpg').catch(() => null);
    if (bgTex) {
      const bg = new Sprite({ texture: bgTex, x: W / 2, y: H / 2, width: W, height: H });
      bg.anchorX = 0.5; bg.anchorY = 0.5;
      this.add(bg);
    } else {
      const bg = new RectShape({ x: 0, y: 0, width: W, height: H, fill: '#2a3a6a' });
      bg.anchorX = 0; bg.anchorY = 0;
      this.add(bg);
    }

    // Logo
    const logoTex = await loadTexture(r, 'assets/images/logo.png').catch(() => null);
    if (logoTex) {
      const logo = new Sprite({ texture: logoTex, x: W / 2, y: H / 2 - 120, width: 280, height: 248 });
      logo.anchorX = 0.5; logo.anchorY = 0.5; logo.alpha = 0;
      this.add(logo);
      this._transitions.to(logo as unknown as Record<string, number>, { alpha: 1, duration: 600, easing: Easing.outQuad });
    }

    // Play button
    const btnBg = new RectShape({ x: W / 2, y: H / 2 + 150, width: 160, height: 58, fill: '#f7a800' });
    btnBg.anchorX = 0.5; btnBg.anchorY = 0.5; btnBg.alpha = 0;
    const btnTxt = new Text({ text: 'PLAY', x: W / 2, y: H / 2 + 150, fontSize: 28, color: '#fff' });
    btnTxt.anchorX = 0.5; btnTxt.anchorY = 0.5; btnTxt.alpha = 0;
    this.add(btnBg); this.add(btnTxt);
    this._transitions.to(btnBg as unknown as Record<string, number>, { alpha: 1, duration: 500 });
    this._transitions.to(btnTxt as unknown as Record<string, number>, { alpha: 1, duration: 500 });

    // Start background music
    void this._playMusic('assets/sounds/menu_music.mp3');

    // Play button click
    this._app.input.on<PointerEvent2D>('pointerdown', (e) => {
      if (Math.abs(e.x - W/2) < 80 && Math.abs(e.y - (H/2+150)) < 30) {
        this._stopMusic();
        this._app.scenes.destroyScene('menu');
        this._app.scenes.destroyScene('game');
        void this._app.scenes.go('game', { params: { app: this._app } });
      }
    });
  }

  private async _playMusic(path: string): Promise<void> {
    try {
      const res = await fetch(path);
      const buf = await res.arrayBuffer();
      await this._app.audio.loadBuffer(path, buf);
      const ctx = (this._app.audio as unknown as { ctx: AudioContext | null }).ctx;
      if (ctx?.state === 'suspended') await ctx.resume();
      this._app.audio.play(path, { loop: true, volume: 0.5 });
    } catch { /* no audio */ }
  }

  private _stopMusic(): void {
    try { this._app.audio.stop('assets/sounds/menu_music.mp3'); } catch { /* ok */ }
  }

  override onUpdate(dt: number): void {
    this._transitions.update(dt);
  }
}
