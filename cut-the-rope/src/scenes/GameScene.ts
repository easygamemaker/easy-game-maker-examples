import {
  Scene, Group, Sprite, RectShape, Text, CircleShape, TransitionManager, Easing,
  PhysicsWorld, WebGLRenderer,
  type SceneParams, type App, type Texture, type PointerEvent2D,
} from 'easy-game-maker';
import { loadTexture } from '../helpers/loadTexture';
import { Rope } from '../game/Rope';
import { Hook } from '../game/Hook';
import { Candy, CANDY_RADIUS_PX } from '../game/Candy';
import { OmNom } from '../game/OmNom';
import { CutDetector } from '../game/CutDetector';

const W = 360, H = 640;

// ── Level configurations ──────────────────────────────────────────────────────
interface LevelConfig {
  bg: string;
  hooks: Array<{ x: number; y: number }>;
  candy: { x: number; y: number };
  onnomY: number;
}

const LEVELS: LevelConfig[] = [
  {
    bg: 'assets/images/levelbg1.jpg',
    hooks: [{ x: W/2,  y: 80 }, { x: W-55, y: 240 }, { x: W/2, y: 355 }],
    candy: { x: W/2+100, y: 110 },
    onnomY: H - 65,
  },
  {
    bg: 'assets/images/levelbg2.jpg',
    hooks: [{ x: 80,  y: 120 }, { x: W-80, y: 120 }, { x: W/2, y: 280 }],
    candy: { x: W/2, y: 80 },
    onnomY: H - 65,
  },
  {
    bg: 'assets/images/levelbg3.jpg',
    hooks: [{ x: W/2, y: 60 }, { x: 70, y: 310 }, { x: W-70, y: 310 }],
    candy: { x: W/2+80, y: 90 },
    onnomY: H - 65,
  },
];

const EAT_RADIUS = 55;
const OPEN_MOUTH_DIST = EAT_RADIUS * 2.8;
type State = 'playing' | 'eating' | 'lost' | 'restarting';

export class GameScene extends Scene {
  private _app!: App;
  private _physics!: PhysicsWorld;
  private _transitions!: TransitionManager;
  private _world!: Group;
  private _hooks: Hook[] = [];
  private _candy!: Candy;
  private _omnom!: OmNom;
  private _state: State = 'playing';
  private _levelIndex = 0;
  private _cfg!: LevelConfig;
  private _overlay: Group | null = null;

  override async onCreate(params?: SceneParams): Promise<void> {
    this._app = params?.['app'] as App;
    this._levelIndex = (params?.['level'] as number | undefined) ?? 0;
    this._cfg = LEVELS[this._levelIndex] ?? LEVELS[0]!;
    this._transitions = new TransitionManager();
    this._physics = new PhysicsWorld({ gravity: { x: 0, y: 20 } });
    await this._build();
    void this._startMusic();
  }

  private get _r(): WebGLRenderer { return this._app.renderer as WebGLRenderer; }

  private async _build(): Promise<void> {
    this._world = new Group();
    this.add(this._world);

    // Background
    const bgTex = await loadTexture(this._r, this._cfg.bg).catch(() => null);
    if (bgTex) {
      const bg = new Sprite({ texture: bgTex, x: W/2, y: H/2, width: W, height: H });
      bg.anchorX = 0.5; bg.anchorY = 0.5; this._world.add(bg);
    }

    // Hooks
    const hookTex = await loadTexture(this._r, 'assets/images/hook_big.png').catch(() =>
      loadTexture(this._r, 'assets/images/hook.png'),
    );
    for (const def of this._cfg.hooks) {
      const hook = new Hook(hookTex, def.x, def.y);
      hook.initPhysics(this._physics);
      this._world.add(hook);
      this._hooks.push(hook);
    }

    // OmNom
    const omNomFrames = await this._loadOmNomFrames();
    this._omnom = new OmNom(omNomFrames, W/2, this._cfg.onnomY);
    this._world.add(this._omnom);

    // Candy
    const candyTex = await loadTexture(this._r, 'assets/images/candy.png');
    this._candy = new Candy(candyTex);
    this._candy.initPhysics(this._physics, this._cfg.candy.x, this._cfg.candy.y);
    this._candy.onFellOffScreen = () => this._onLose();
    this._world.add(this._candy);

    // Initial rope: Hook 0 → Candy
    const h0 = this._hooks[0]!;
    const rope = new Rope(
      this._physics, this._world,
      h0.hookX, h0.hookY,
      this._cfg.candy.x, this._cfg.candy.y,
      18,
    );
    rope.attachToHook(h0.anchorBody);
    rope.attachToCandy(this._candy.physicsBody!);
    h0.setRope(rope);

    // Cut detector
    new CutDetector(this._app, () =>
      this._hooks.filter(h => h.rope && !h.rope.cut).map(h => h.rope!),
    );

    // Level indicator
    const lvlTxt = new Text({
      text: `Level ${this._levelIndex + 1} / ${LEVELS.length}`,
      x: 12, y: 14, fontSize: 13, color: '#ffffff99',
    });
    lvlTxt.anchorX = 0; lvlTxt.anchorY = 0;
    this.add(lvlTxt);

    // (overlay built on demand via _showWinOverlay / _showLoseOverlay)

    this._buildButtons();
  }

  private _buildButtons(): void {
    const br = new CircleShape();
    br.radius = 26; br.x = W-34; br.y = 34;
    br.fillColor = [0.88, 0.42, 0.06, 0.92];
    const bt = new Text({ text: '↺', x: W-34, y: 34, fontSize: 22, color: '#fff' });
    bt.anchorX = 0.5; bt.anchorY = 0.5;
    this.add(br); this.add(bt);

    const bm = new CircleShape();
    bm.radius = 26; bm.x = W-34; bm.y = 94;
    bm.fillColor = [0.25, 0.52, 0.82, 0.92];
    const bmt = new Text({ text: '⌂', x: W-34, y: 94, fontSize: 20, color: '#fff' });
    bmt.anchorX = 0.5; bmt.anchorY = 0.5;
    this.add(bm); this.add(bmt);

    this._app.input.on<PointerEvent2D>('pointerdown', (e) => {
      if (Math.abs(e.x - (W-34)) < 30 && Math.abs(e.y - 34) < 30) this._restartLevel();
      if (Math.abs(e.x - (W-34)) < 30 && Math.abs(e.y - 94) < 30) this._goMenu();
      if (this._state === 'playing' &&
          Math.hypot(e.x - W/2, e.y - this._cfg.onnomY) < 100) this._omnom.tilt();
    });
  }

  private _onEat(): void {
    if (this._state !== 'playing') return;
    this._state = 'eating';
    this._candy.eat();
    this._omnom.chew();
    this._playSound('assets/sounds/monster_chewing.mp3');
    const nextIndex = this._levelIndex + 1;
    const hasNext = nextIndex < LEVELS.length;
    this._showWinOverlay(hasNext, nextIndex);
  }

  private _showWinOverlay(hasNext: boolean, nextIndex: number): void {
    const g = new Group();
    this._overlay = g;

    // Card layout — vertically centered
    const CY = H / 2;      // card center y
    const CW = W - 56;     // card width = 304px
    const CH = 300;        // card height

    // Backdrop
    const backdrop = new RectShape({ x: 0, y: 0, width: W, height: H, fill: '#00000088' });
    backdrop.anchorX = 0; backdrop.anchorY = 0;
    g.add(backdrop);

    // Card border (orange)
    const border = new RectShape({ x: W/2, y: CY, width: CW, height: CH, fill: '#f7a800' });
    border.anchorX = 0.5; border.anchorY = 0.5;
    g.add(border);

    // Card face (cream)
    const face = new RectShape({ x: W/2, y: CY, width: CW - 10, height: CH - 10, fill: '#fffbe8' });
    face.anchorX = 0.5; face.anchorY = 0.5;
    g.add(face);

    // "NOM NOM!" — top of card
    const title = new Text({ text: 'NOM NOM!', x: W/2, y: CY - 100, fontSize: 32, color: '#e05000' });
    title.anchorX = 0.5; title.anchorY = 0.5;
    g.add(title);

    // Level subtitle
    const sub = new Text({
      text: hasNext ? `Level ${this._levelIndex + 1} complete!` : 'All levels complete!',
      x: W/2, y: CY - 60, fontSize: 17, color: '#6b4000',
    });
    sub.anchorX = 0.5; sub.anchorY = 0.5;
    g.add(sub);

    // 3 stars — spaced 50px apart
    for (let i = 0; i < 3; i++) {
      const star = new Text({ text: '★', x: W/2 - 50 + i * 50, y: CY - 14, fontSize: 32, color: '#f7a800' });
      star.anchorX = 0.5; star.anchorY = 0.5;
      g.add(star);
    }

    // Primary button (Next Level / Play Again) — 52px tall
    const BTN_Y = CY + 48;
    const btnColor = hasNext ? '#4caf50' : '#2196f3';
    const btnBg = new RectShape({ x: W/2, y: BTN_Y, width: 200, height: 52, fill: btnColor });
    btnBg.anchorX = 0.5; btnBg.anchorY = 0.5;
    g.add(btnBg);
    const btnTxt = new Text({
      text: hasNext ? 'Next Level  ▶' : '▶  Play Again',
      x: W/2, y: BTN_Y, fontSize: 18, color: '#fff',
    });
    btnTxt.anchorX = 0.5; btnTxt.anchorY = 0.5;
    g.add(btnTxt);

    // Menu button — 36px tall, 76px below primary button
    const MENU_Y = BTN_Y + 64;
    const menuBg = new RectShape({ x: W/2, y: MENU_Y, width: 140, height: 36, fill: '#8d6e63' });
    menuBg.anchorX = 0.5; menuBg.anchorY = 0.5;
    g.add(menuBg);
    const menuTxt = new Text({ text: 'Main Menu', x: W/2, y: MENU_Y, fontSize: 15, color: '#fff' });
    menuTxt.anchorX = 0.5; menuTxt.anchorY = 0.5;
    g.add(menuTxt);

    // Fade in
    g.alpha = 0;
    this._transitions.to(g as unknown as Record<string, number>, { alpha: 1, duration: 380, easing: Easing.outQuad });
    this.add(g);

    // Input — FIX: do NOT set state before calling _goToLevel (it checks state itself)
    this._app.input.on<PointerEvent2D>('pointerdown', (e) => {
      if (this._state !== 'eating') return;
      if (Math.abs(e.x - W/2) < 100 && Math.abs(e.y - BTN_Y) < 26) {
        if (hasNext) this._goToLevel(nextIndex); else this._restartLevel();
      }
      if (Math.abs(e.x - W/2) < 70 && Math.abs(e.y - MENU_Y) < 18) {
        this._goMenu();
      }
    });
  }

  private _showLoseOverlay(): void {
    const g = new Group();
    this._overlay = g;

    const CY = H / 2;
    const CW = W - 56;
    const CH = 240;

    const backdrop = new RectShape({ x: 0, y: 0, width: W, height: H, fill: '#00000077' });
    backdrop.anchorX = 0; backdrop.anchorY = 0;
    g.add(backdrop);

    const border = new RectShape({ x: W/2, y: CY, width: CW, height: CH, fill: '#e53935' });
    border.anchorX = 0.5; border.anchorY = 0.5;
    g.add(border);
    const face = new RectShape({ x: W/2, y: CY, width: CW - 10, height: CH - 10, fill: '#fff3f3' });
    face.anchorX = 0.5; face.anchorY = 0.5;
    g.add(face);

    const title = new Text({ text: 'OH NO!', x: W/2, y: CY - 72, fontSize: 34, color: '#c62828' });
    title.anchorX = 0.5; title.anchorY = 0.5;
    g.add(title);

    const sub = new Text({ text: 'The candy fell...', x: W/2, y: CY - 30, fontSize: 16, color: '#7b1a1a' });
    sub.anchorX = 0.5; sub.anchorY = 0.5;
    g.add(sub);

    const BTN_Y = CY + 36;
    const btnBg = new RectShape({ x: W/2, y: BTN_Y, width: 180, height: 52, fill: '#f7a800' });
    btnBg.anchorX = 0.5; btnBg.anchorY = 0.5;
    g.add(btnBg);
    const btnTxt = new Text({ text: 'Try Again  ↺', x: W/2, y: BTN_Y, fontSize: 18, color: '#fff' });
    btnTxt.anchorX = 0.5; btnTxt.anchorY = 0.5;
    g.add(btnTxt);

    const MENU_Y = BTN_Y + 64;
    const menuBg = new RectShape({ x: W/2, y: MENU_Y, width: 130, height: 34, fill: '#8d6e63' });
    menuBg.anchorX = 0.5; menuBg.anchorY = 0.5;
    g.add(menuBg);
    const menuTxt = new Text({ text: 'Main Menu', x: W/2, y: MENU_Y, fontSize: 14, color: '#fff' });
    menuTxt.anchorX = 0.5; menuTxt.anchorY = 0.5;
    g.add(menuTxt);

    g.alpha = 0;
    this._transitions.to(g as unknown as Record<string, number>, { alpha: 1, duration: 350, easing: Easing.outQuad });
    this.add(g);

    this._app.input.on<PointerEvent2D>('pointerdown', (e) => {
      if (this._state !== 'lost') return;
      if (Math.abs(e.x - W/2) < 90 && Math.abs(e.y - BTN_Y) < 26) this._restartLevel();
      if (Math.abs(e.x - W/2) < 65 && Math.abs(e.y - MENU_Y) < 17) this._goMenu();
    });
  }

  private _onLose(): void {
    if (this._state !== 'playing') return;
    this._state = 'lost';
    this._omnom.sad();
    this._playSound('assets/sounds/sad.mp3');
    setTimeout(() => this._showLoseOverlay(), 800);
  }

  private _goToLevel(index: number): void {
    // Guard against double-trigger — restarting state is set HERE, not by callers
    if (this._state === 'restarting') return;
    const prevState = this._state;
    this._state = 'restarting';
    this._transitions.to(this as unknown as Record<string, number>, {
      alpha: 0, duration: 300, easing: Easing.linear,
      onComplete: () => {
        this._app.scenes.destroyScene('game');
        void this._app.scenes.go('game', { params: { app: this._app, level: index } });
      },
    });
  }

  private _restartLevel(): void { this._goToLevel(this._levelIndex); }

  private _goMenu(): void {
    this._app.audio.stop('assets/sounds/game_music.mp3');
    this._app.scenes.destroyScene('game');
    this._app.scenes.destroyScene('menu');
    void this._app.scenes.go('menu', { params: { app: this._app } });
  }

  private async _loadOmNomFrames(): Promise<Texture[]> {
    const r = this._r;
    const fb = 'assets/images/candy.png';
    const safe = (url: string) => loadTexture(r, url).catch(() => loadTexture(r, fb));
    const p = (n: number) => String(n).padStart(2, '0');
    const frames: Texture[] = [];
    for (let i=1;i<=10;i++) frames.push(await safe(`assets/images/animations/idle/idle${p(i)}.png`));
    for (let i=1;i<=14;i++) frames.push(await safe(`assets/images/animations/tilt/tilt${p(i)}.png`));
    for (let i=1;i<=8; i++) frames.push(await safe(`assets/images/animations/open_mouth/open${p(i)}.png`));
    for (let i=1;i<=11;i++) frames.push(await safe(`assets/images/animations/chew/chew${p(i)}.png`));
    for (let i=1;i<=13;i++) frames.push(await safe(`assets/images/animations/sad/sad${p(i)}.png`));
    return frames;
  }

  private async _startMusic(): Promise<void> {
    try {
      const path = 'assets/sounds/game_music.mp3';
      const res = await fetch(path);
      const buf = await res.arrayBuffer();
      await this._app.audio.loadBuffer(path, buf);
      const ctx = (this._app.audio as unknown as { ctx: AudioContext|null }).ctx;
      if (ctx?.state === 'suspended') await ctx.resume();
      this._app.audio.play(path, { loop: true, volume: 0.4 });
    } catch { /* ok */ }
  }

  private _playSound(path: string): void {
    void fetch(path)
      .then(r => r.arrayBuffer())
      .then(b => this._app.audio.loadBuffer(path, b))
      .then(() => this._app.audio.play(path, { volume: 0.85 }))
      .catch(() => {});
  }

  // Fixed physics timestep accumulator — keeps planck.js stable across platforms.
  // WKWebView (macOS Desktop) can produce large dt values on the first frame after
  // scene activation, causing rope constraints to blow up if stepped with the full dt.
  private _physAcc = 0;
  private static readonly PHYSICS_STEP = 1 / 60; // 16.67 ms fixed step

  override onUpdate(dt: number): void {
    if (!this._candy || !this._omnom) return;
    this._transitions.update(dt);
    if (this._state === 'restarting') return;

    // Step physics in fixed 16.67 ms increments (max 5 steps per frame)
    this._physAcc += dt;
    let safety = 5;
    while (this._physAcc >= GameScene.PHYSICS_STEP && safety-- > 0) {
      this._physics.step(GameScene.PHYSICS_STEP);
      this._physAcc -= GameScene.PHYSICS_STEP;
    }

    // Update hooks + ropes
    for (const hook of this._hooks) {
      hook.update(dt);
      if (this._state === 'playing' && !hook.hasRope) {
        hook.tryAutoAttach(this._candy, this._physics, this._world);
      }
    }

    // OmNom
    this._omnom.update(dt);

    if (this._state === 'playing') {
      this._candy.checkFell(H);
      const dist = Math.hypot(this._candy.x - W/2, this._candy.y - this._cfg.onnomY);
      if (dist < EAT_RADIUS) {
        this._onEat();  // ← called once, state set inside _onEat
      } else if (dist < OPEN_MOUTH_DIST) {
        this._omnom.openMouth();
      } else {
        this._omnom.closeMouth();
      }
    }
  }
}
