import {
  Scene, Sprite, Text, RectShape, Group, TransitionManager, Easing, WebGLRenderer,
  type SceneParams, type App, type PointerEvent2D,
} from 'easy-game-maker';
import { loadTexture } from '../helpers/loadTexture';
import { SoundManager } from '../game/SoundManager';
import { CANVAS_W, CANVAS_H } from '../config/levels';

const CX = CANVAS_W / 2;  // 284
const CY = CANVAS_H / 2;  // 160
const MUSIC = 'assets/audio/menuprincipal/menuprincipal.ogg';

export class MenuScene extends Scene {
  private _app!: App;
  private _sounds!: SoundManager;
  private _transitions!: TransitionManager;
  private _clicking = false;

  override async onCreate(params?: SceneParams): Promise<void> {
    this._app = params?.['app'] as App;
    this._sounds = new SoundManager(this._app);
    this._transitions = new TransitionManager();
    // Start loading music immediately — plays as soon as AudioContext unlocks
    this._sounds.playMusic(MUSIC);
    await this._build();
  }

  private get _r(): WebGLRenderer { return this._app.renderer as WebGLRenderer; }

  private async _build(): Promise<void> {
    // Background — shows immediately
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

    // Animation starts automatically after 1 second (matches original Lua timer)
    setTimeout(() => void this._step1Melancia(), 1000);
  }

  // Step 1: Watermelon slides in from x=-55 to x=55, y=55, in 100ms
  private async _step1Melancia(): Promise<void> {
    const tex = await loadTexture(this._r, 'assets/images/menuprincipal/new/melancia.fw.png').catch(() => null);
    if (tex) {
      const mel = new Sprite({ texture: tex, x: -55, y: 55, width: 108, height: 127 });
      mel.anchorX = 0.5; mel.anchorY = 0.5;
      this.add(mel);
      this._transitions.to(mel as unknown as Record<string, number>, {
        x: 55, duration: 100, easing: Easing.linear,
        onComplete: () => void this._step2Zombie(),
      });
    } else {
      void this._step2Zombie();
    }
  }

  // Step 2: Zombie slides in from right
  private async _step2Zombie(): Promise<void> {
    const tex = await loadTexture(this._r, 'assets/images/menuprincipal/new/zumbi.fw.png').catch(() => null);
    if (tex) {
      const z = new Sprite({ texture: tex, x: CANVAS_W + 190, y: CANVAS_H - 90, width: 192, height: 186 });
      z.anchorX = 0.5; z.anchorY = 0.5;
      this.add(z);
      this._transitions.to(z as unknown as Record<string, number>, {
        x: CANVAS_W - 90, duration: 100, easing: Easing.linear,
        onComplete: () => void this._step3Logo(),
      });
    } else {
      void this._step3Logo();
    }
  }

  // Step 3: Logo fades in, then show buttons
  private async _step3Logo(): Promise<void> {
    const tex = await loadTexture(this._r, 'assets/images/menuprincipal/new/logo.fw.png').catch(() => null);
    if (tex) {
      const logo = new Sprite({ texture: tex, x: CX, y: CY - 30, width: 334, height: 261 });
      logo.anchorX = 0.5; logo.anchorY = 0.5; logo.alpha = 0;
      this.add(logo);
      this._transitions.to(logo as unknown as Record<string, number>, {
        alpha: 1, duration: 500, easing: Easing.linear,
        onComplete: () => void this._showButtons(),
      });
    } else {
      void this._showButtons();
    }
  }

  // btn-play.png (113×53) + btn-about-us.png (113×53)
  private async _showButtons(): Promise<void> {
    const [playTex, aboutTex] = await Promise.all([
      loadTexture(this._r, 'assets/images/menuprincipal/new/btn-play.png').catch(() => null),
      loadTexture(this._r, 'assets/images/menuprincipal/new/btn-about-us.png').catch(() => null),
    ]);

    if (playTex) {
      const btn = new Sprite({ texture: playTex, x: CX, y: CY + 80, width: 113, height: 53 });
      btn.anchorX = 0.5; btn.anchorY = 0.5; btn.alpha = 0;
      this.add(btn);
      this._transitions.to(btn as unknown as Record<string, number>, { alpha: 1, duration: 500 });
    }

    if (aboutTex) {
      const btn = new Sprite({ texture: aboutTex, x: CX, y: CY + 130, width: 113, height: 53 });
      btn.anchorX = 0.5; btn.anchorY = 0.5; btn.alpha = 0;
      this.add(btn);
      this._transitions.to(btn as unknown as Record<string, number>, { alpha: 1, duration: 500 });
    }

    // Play button hit area: CX ± 56px, CY+80 ± 26px
    this._app.input.on<PointerEvent2D>('pointerdown', (e) => {
      if (this._clicking) return;
      if (Math.abs(e.x - CX) < 56 && Math.abs(e.y - (CY + 80)) < 26) {
        this._clicking = true;
        this._sounds.button();
        // Fade out, stop music, go to level 1
        this._transitions.to(this as unknown as Record<string, number>, {
          alpha: 0, duration: 2000, easing: Easing.linear,
          onComplete: () => {
            this._sounds.stopMusic();
            this._app.scenes.destroyScene('level');
            this._app.scenes.destroyScene('dualLevel');
            this._app.scenes.destroyScene('menu');
            void this._app.scenes.go('level', { params: { app: this._app, level: 1 } });
          },
        });
      }
    });
  }

  override onUpdate(dt: number): void {
    this._transitions.update(dt);
  }
}
