import {
  Scene, Group, Sprite, RectShape, Text, TransitionManager, Easing,
  PhysicsWorld, WebGLRenderer,
  type SceneParams, type App, type Texture, type PointerEvent2D,
} from 'easy-game-maker';
import { loadTexture } from '../helpers/loadTexture';
import { GameCamera } from '../game/GameCamera';
import { Catapult } from '../game/Catapult';
import { SoundManager } from '../game/SoundManager';
import { ZumbiNormal } from '../game/zombies/ZumbiNormal';
import { ZumbiVelho } from '../game/zombies/ZumbiVelho';
import { ZumbiGordo } from '../game/zombies/ZumbiGordo';
import { ZumbiKid } from '../game/zombies/ZumbiKid';
import { ZumbiMulher } from '../game/zombies/ZumbiMulher';
import { ZumbiFortao } from '../game/zombies/ZumbiFortao';
import { MelanciaFruit } from '../game/fruits/MelanciaFruit';
import { MacaFruit } from '../game/fruits/MacaFruit';
import { LaranjaFruit } from '../game/fruits/LaranjaFruit';
import { AbacaxyFruit } from '../game/fruits/AbacaxyFruit';
import { CocoFruit } from '../game/fruits/CocoFruit';
import { MelaoFruit } from '../game/fruits/MelaoFruit';
import type { ZombieActor } from '../game/ZombieActor';
import type { FruitActor } from '../game/FruitActor';
import { SeedProjectile, SEED_HIT_RADIUS } from '../game/SeedProjectile';
import {
  LEVELS, CANVAS_W, CANVAS_H, WORLD_W,
  isLevelDual,
  type LevelConfig, type FruitType, type ZombieType,
} from '../config/levels';

type LevelState = 'intro' | 'playing' | 'paused' | 'specialKill' | 'win' | 'lose';

export class LevelScene extends Scene {
  private _app!: App;
  private _cfg!: LevelConfig;
  private _camera!: GameCamera;
  private _physics!: PhysicsWorld;
  private _catapult!: Catapult;
  private _sounds!: SoundManager;
  private _transitions!: TransitionManager;
  private _zombies: ZombieActor[] = [];
  private _fruits: FruitActor[] = [];
  private _fruitIndex = 0;
  private _activeFruit: FruitActor | null = null;
  private _state: LevelState = 'intro';
  private _overlay: Group | null = null;
  private _pauseBtn: Sprite | null = null;
  private _score = 0;
  private _scoreText!: Text;
  private _fruitLandTimer = 0;
  private _fruitLanding = false;
  private _activeFruitType: FruitType = 'melancia';
  private _seeds: SeedProjectile[] = [];
  // Result/pause button actions — set when overlay shown, cleared on navigate
  private _resultBtns: Array<{ x: number; y: number; action: () => void }> = [];

  override async onCreate(params?: SceneParams): Promise<void> {
    this._app = params?.['app'] as App;
    const levelId = (params?.['level'] as number | undefined) ?? 1;
    this._cfg = LEVELS.find(l => l.id === levelId) ?? LEVELS[0]!;
    this._transitions = new TransitionManager();
    this._sounds = new SoundManager(this._app);
    this._physics = new PhysicsWorld({ gravity: { x: 0, y: 9.8 } });
    this._camera = new GameCamera(WORLD_W, CANVAS_W);

    this._sounds.playMusic(this._cfg.music);

    await this._buildLevel();
    this._startIntro();
    this._setupSpecialTap();
    this._setupOverlayInput();
  }

  // Single handler for ALL overlay buttons (result + pause) — registered once, synchronously
  private _setupOverlayInput(): void {
    const BTN_R = 40;  // hit radius in px (generous for 64×64 buttons)
    this._app.input.on<PointerEvent2D>('pointerdown', (e) => {
      if (this._state !== 'win' && this._state !== 'lose' && this._state !== 'paused') return;
      for (const btn of this._resultBtns) {
        if (Math.abs(e.x - btn.x) < BTN_R && Math.abs(e.y - btn.y) < BTN_R) {
          this._sounds.button();
          this._resultBtns = [];  // prevent double-fire
          btn.action();
          return;
        }
      }
    });
  }

  private get _renderer(): WebGLRenderer {
    return this._app.renderer as WebGLRenderer;
  }

  private async _tex(url: string): Promise<Texture> {
    return loadTexture(this._renderer, url);
  }

  private async _buildLevel(): Promise<void> {
    // Background
    const bgTex = await this._tex(this._cfg.background).catch(() => null);
    if (bgTex) {
      const bg = new Sprite({ texture: bgTex, x: WORLD_W / 2, y: CANVAS_H / 2, width: WORLD_W, height: CANVAS_H });
      bg.anchorX = 0.5; bg.anchorY = 0.5;
      this._camera.group.add(bg);
    } else {
      const bg = new RectShape({ x: 0, y: 0, width: WORLD_W, height: CANVAS_H, fill: '#2d5a27' });
      bg.anchorX = 0; bg.anchorY = 0;
      this._camera.group.add(bg);
    }

    // Floor physics at visual grass level so fruit lands where zombies stand
    // zombieY=235 center, height=86 → bottom ≈ y=278; floor at y=280 to match
    const FLOOR_Y = 280;
    const floorRect = new RectShape({ x: WORLD_W / 2, y: FLOOR_Y, width: WORLD_W, height: 20, fill: '#00000000' });
    floorRect.anchorX = 0.5; floorRect.anchorY = 0.5;
    this._camera.group.add(floorRect);
    this._physics.addBody(floorRect, { type: 'static', shape: 'rect' });

    // Catapult
    const [forkLTex, forkRTex] = await Promise.all([
      this._tex('assets/images/objetos/catapulta_esquerda.png').catch(() => null),
      this._tex('assets/images/objetos/catapulta_direita.png').catch(() => null),
    ]);
    if (forkLTex && forkRTex) {
      this._catapult = new Catapult(this._app, this._physics, this._camera, forkLTex, forkRTex);
      this._camera.group.add(this._catapult);
    }

    // Fruits (built in order, consumed from end → start)
    for (const ft of this._cfg.fruits ?? []) {
      const fruit = await this._createFruit(ft);
      fruit.alpha = 0;
      this._camera.group.add(fruit);
      this._fruits.push(fruit);
    }
    this._fruitIndex = this._fruits.length - 1;

    // Zombies
    let zx = this._cfg.zombieStartX ?? 700;
    for (const zt of this._cfg.zombies ?? []) {
      const zombie = await this._createZombie(zt, zx, this._cfg.zombieY ?? 235);
      zombie.onDead = (z) => this._onZombieDead(z);
      this._camera.group.add(zombie);
      this._zombies.push(zombie);
      zx += this._cfg.zombieSpacing ?? 150;
    }

    this.add(this._camera.group);

    // HUD fixed on top
    this._buildHUD();
    this._scoreText = new Text({ text: 'Score: 0', x: CANVAS_W / 2, y: 14, fontSize: 13, color: '#fff' });
    this._scoreText.anchorX = 0.5; this._scoreText.anchorY = 0.5;
    this.add(this._scoreText);
  }

  private _buildHUD(): void {
    // pause-button.png 32×32, top-right corner
    void loadTexture(this._renderer, 'assets/images/objetos/pause-button.png')
      .then((tex) => {
        const btn = new Sprite({ texture: tex, x: CANVAS_W - 24, y: 16, width: 32, height: 32 });
        btn.anchorX = 0.5; btn.anchorY = 0.5; btn.alpha = 0;
        this.add(btn);
        this._pauseBtn = btn;
      })
      .catch(() => {
        const btn = new RectShape({ x: CANVAS_W - 24, y: 16, width: 32, height: 32, fill: '#ffffff33' });
        btn.anchorX = 0.5; btn.anchorY = 0.5;
        this.add(btn);
      });

    this._app.input.on<PointerEvent2D>('pointerdown', (e) => {
      if (Math.abs(e.x - (CANVAS_W - 24)) < 20 && Math.abs(e.y - 16) < 20) {
        if (this._state === 'playing') this._togglePause();
        else if (this._state === 'paused') this._togglePause();
      }
    });
  }

  private _startIntro(): void {
    this._state = 'intro';
    // Pan right to show zombies, then back
    this._camera.panTo(WORLD_W - CANVAS_W, 1.5, undefined, () => {
      void this._showReady();
    });
  }

  private async _showReady(): Promise<void> {
    const tex = await loadTexture(this._renderer, 'assets/images/menuprincipal/new/ready.fw.png').catch(() => null);
    let readyObj: Sprite | Text;
    if (tex) {
      const s = new Sprite({ texture: tex, x: CANVAS_W / 2, y: CANVAS_H / 2, width: 270, height: 100 });
      s.anchorX = 0.5; s.anchorY = 0.5; this.add(s); readyObj = s;
    } else {
      const t = new Text({ text: 'READY!', x: CANVAS_W / 2, y: CANVAS_H / 2, fontSize: 36, color: '#ffe600' });
      t.anchorX = 0.5; t.anchorY = 0.5; this.add(t); readyObj = t;
    }

    this._camera.panTo(0, 3.0, undefined, () => {
      this.remove(readyObj);
      void this._showGo();
    });
  }

  private async _showGo(): Promise<void> {
    const tex = await loadTexture(this._renderer, 'assets/images/menuprincipal/new/go.fw.png').catch(() => null);
    let goObj: Sprite | Text;
    if (tex) {
      const s = new Sprite({ texture: tex, x: CANVAS_W / 2, y: CANVAS_H / 2, width: 270, height: 100 });
      s.anchorX = 0.5; s.anchorY = 0.5; this.add(s); goObj = s;
    } else {
      const t = new Text({ text: 'GO!', x: CANVAS_W / 2, y: CANVAS_H / 2, fontSize: 44, color: '#ff4500' });
      t.anchorX = 0.5; t.anchorY = 0.5; this.add(t); goObj = t;
    }

    this._state = 'playing';
    if (this._catapult) this._catapult.markStarted();
    if (this._pauseBtn) this._pauseBtn.alpha = 1;
    for (const z of this._zombies) z.walk();
    this._loadNextFruit();

    setTimeout(() => this.remove(goObj), 1000);
  }

  private async _createFruit(type: FruitType): Promise<FruitActor> {
    const base = 'assets/images/personagens/frutas/';
    const fallback = 'assets/images/menuprincipal/new/melancia.fw.png';
    const pad = (n: number) => String(n).padStart(4, '0');
    const safe = (url: string) => this._tex(url).catch(() => this._tex(fallback));

    type FruitMeta = {
      dir: string; normalPfx: string; specialPfx: string; colPfx: string;
      nCount: number; sCount: number; cCount: number; w: number; h: number;
    };

    const meta: Record<FruitType, FruitMeta> = {
      // Actual PNG dimensions: melancia/abacaxy/coco/melao = 86×86, maca/laranja = 54×54
      melancia: { dir: 'melancia', normalPfx: 'normal/watermelon normal',   specialPfx: 'especial/watermelonspecial',  colPfx: 'colisao/watermeloncollision', nCount: 12, sCount: 12, cCount: 5,  w: 86, h: 86 },
      maca:     { dir: 'maca',     normalPfx: 'maca_normal/apple normal',   specialPfx: 'especial/apple specia',      colPfx: 'maca_normal/apple normal',    nCount: 12, sCount: 14, cCount: 1,  w: 54, h: 54 },
      laranja:  { dir: 'laranja',  normalPfx: 'normal/orange normal',       specialPfx: 'noar/orange throwing',       colPfx: 'normal/orange normal',        nCount: 12, sCount: 12, cCount: 1,  w: 54, h: 54 },
      abacaxy:  { dir: 'abacaxy',  normalPfx: 'normal/pineaple normal',     specialPfx: 'especial/pineaplespecial',   colPfx: 'colisao/pineaplecollision',   nCount: 12, sCount: 12, cCount: 4,  w: 86, h: 86 },
      coco:     { dir: 'coco',     normalPfx: 'normal/coconut normal',      specialPfx: 'especial/coconutspecial',    colPfx: 'colisao/coconutcollision',    nCount: 12, sCount: 12, cCount: 4,  w: 86, h: 86 },
      melao:    { dir: 'melao',    normalPfx: 'normal/melao normal',        specialPfx: 'especial/melaospecial',      colPfx: 'colisao/melaocollision',      nCount: 12, sCount: 12, cCount: 1,  w: 86, h: 86 },
    };

    const m = meta[type];
    const frames: Texture[] = [];

    for (let i = 1; i <= m.nCount; i++) frames.push(await safe(`${base}${m.dir}/${m.normalPfx}${pad(i)}.png`));
    for (let i = 1; i <= m.sCount; i++) frames.push(await safe(`${base}${m.dir}/${m.specialPfx}${pad(i)}.png`));
    for (let i = 1; i <= m.cCount; i++) frames.push(await safe(`${base}${m.dir}/${m.colPfx}${pad(i)}.png`));

    const opts = { frames, width: m.w, height: m.h };
    switch (type) {
      case 'melancia': return new MelanciaFruit(opts);
      case 'maca':     return new MacaFruit(opts);
      case 'laranja':  return new LaranjaFruit(opts);
      case 'abacaxy':  return new AbacaxyFruit(opts);
      case 'coco':     return new CocoFruit(opts);
      case 'melao':    return new MelaoFruit(opts);
    }
  }

  private async _createZombie(type: ZombieType, x: number, y: number): Promise<ZombieActor> {
    const base = 'assets/images/personagens/zumbis/';
    const fallback = 'assets/images/menuprincipal/new/zumbi.fw.png';
    const pad = (n: number) => String(n).padStart(4, '0');
    const safe = (url: string) => this._tex(url).catch(() => this._tex(fallback));

    type ZombMeta = { dir: string; walkPfx: string; colPfx: string; runPfx: string; detPfx: string; w: number; h: number };

    const meta: Record<ZombieType, ZombMeta> = {
      // All zombie frames are 86×86px (confirmed by inspection)
      zumbiNormal:  { dir: 'zumbi_normal',  walkPfx: 'normal/manwalks',             colPfx: 'colisao/mancollision',       runPfx: 'normal/manwalks',            detPfx: 'deteriorar/desintegration', w: 86, h: 86 },
      zumbiVelho:   { dir: 'zumbi_velho',   walkPfx: 'normal/oldwalks',             colPfx: 'colisao/old collision',      runPfx: 'correndo/oldman running',     detPfx: 'deteriorar/desintegration', w: 86, h: 86 },
      zumbiGordo:   { dir: 'zumbi_gordao',  walkPfx: 'normal/fatwalks',             colPfx: 'colisao/fatcollision',       runPfx: 'correndo/fat running',        detPfx: 'deteriorar/desintegration', w: 86, h: 86 },
      zumbiKid:     { dir: 'zumbi_kid',     walkPfx: 'normal/kidwalks',             colPfx: 'colisao/kidcollision',       runPfx: 'correndo/kid running',        detPfx: 'deteriorar/desintegration', w: 86, h: 86 },
      zumbiMulher:  { dir: 'zumbi_mulher',  walkPfx: 'normal/zombie girl walks',    colPfx: 'colisao/girlcollision',      runPfx: 'correndo/girl running',       detPfx: 'deteriorar/desintegration', w: 86, h: 86 },
      zumbiFortao:  { dir: 'zumbi_fortao',  walkPfx: 'normal/strongwalks',          colPfx: 'colisao/strongcollision',    runPfx: 'correndo/strong man running', detPfx: 'deteriorar/desintegration', w: 86, h: 86 },
    };

    const m = meta[type];
    const frames: Texture[] = [];

    for (let i = 1; i <= 12; i++) frames.push(await safe(`${base}${m.dir}/${m.walkPfx}${pad(i)}.png`));
    for (let i = 1; i <= 10; i++) frames.push(await safe(`${base}${m.dir}/${m.colPfx}${pad(i)}.png`));
    for (let i = 1; i <= 12; i++) frames.push(await safe(`${base}${m.dir}/${m.runPfx}${pad(i)}.png`));
    for (let i = 1; i <= 8;  i++) frames.push(await safe(`${base}${m.dir}/${m.detPfx}${pad(i)}.png`));

    const opts = { x, y, frames, width: m.w, height: m.h };
    switch (type) {
      case 'zumbiNormal': return new ZumbiNormal(opts);
      case 'zumbiVelho':  return new ZumbiVelho(opts);
      case 'zumbiGordo':  return new ZumbiGordo(opts);
      case 'zumbiKid':    return new ZumbiKid(opts);
      case 'zumbiMulher': return new ZumbiMulher(opts);
      case 'zumbiFortao': return new ZumbiFortao(opts);
    }
  }

  private _loadNextFruit(): void {
    if (this._fruitIndex < 0) {
      this._showLose();
      return;
    }
    const fruit = this._fruits[this._fruitIndex];
    const fruitType = (this._cfg.fruits ?? [])[this._fruitIndex];
    if (!fruit || !fruitType) return;
    this._fruitIndex--;
    this._activeFruit = fruit;
    this._activeFruitType = fruitType;
    fruit.alpha = 1;
    fruit.playNormal();

    // Watermelon special: spawn 3 seeds when activated in air
    if (fruitType === 'melancia') {
      fruit.onSpecialActivated = (f) => this._spawnMelanciaSeeds(f);
    }

    if (this._catapult) this._catapult.loadFruit(fruit);
    this._camera.panTo(0, 0.8);
  }

  private _spawnMelanciaSeeds(fruit: FruitActor): void {
    const pb = fruit.physicsBody;
    if (!pb) return;
    const vel = pb.getVelocity();
    const seeds = SeedProjectile.spawnFan(fruit.x, fruit.y, vel.x, vel.y, this._physics);
    for (const seed of seeds) {
      this._camera.group.add(seed.shape);
      this._seeds.push(seed);
    }
  }

  private _updateSeeds(dt: number): void {
    if (this._seeds.length === 0) return;

    const toRemove: SeedProjectile[] = [];

    for (const seed of this._seeds) {
      if (!seed.active) { toRemove.push(seed); continue; }

      seed.syncFromPhysics();

      // Out of bounds
      if (seed.y > CANVAS_H + 100 || seed.x < -100 || seed.x > WORLD_W + 100) {
        this._camera.group.remove(seed.shape);
        seed.destroy(this._physics);
        toRemove.push(seed);
        continue;
      }

      // Seed-zombie collision
      for (const z of this._zombies) {
        if (!z.alive) continue;
        const dx = seed.x - z.x;
        const dy = seed.y - z.y;
        if (Math.hypot(dx, dy) < SEED_HIT_RADIUS + 30) {
          this._camera.group.remove(seed.shape);
          seed.destroy(this._physics);
          toRemove.push(seed);
          z.hit();  // kills zombie (seeds do 1-hit kill via existing hit logic)
          break;
        }
      }
    }

    this._seeds = this._seeds.filter(s => !toRemove.includes(s));
  }

  private _setupSpecialTap(): void {
    this._app.input.on<PointerEvent2D>('pointerdown', (e) => {
      if (this._state !== 'playing') return;
      const f = this._activeFruit;
      if (!f || !f.inAir) return;
      if (e.x > CANVAS_W - 50 && e.y < 40) return;
      f.activateSpecial();
    });
  }

  private _onZombieDead(_zombie: ZombieActor): void {
    this._score += 100;
    this._scoreText.text = `Score: ${this._score}`;
    this._sounds.collision();

    // Special cutscene already played before last zombie was killed
    // Just check if all are dead and show win
    const allDead = this._zombies.every(z => !z.alive);
    if (allDead) this._showWin();
  }

  private _playSpecialKillCutscene(onDone: () => void): void {
    this._sounds.special();
    // Zombies already paused by caller for the last-kill path

    // Dark overlay
    const overlay = new RectShape({ x: 0, y: 0, width: CANVAS_W, height: CANVAS_H, fill: '#000000' });
    overlay.anchorX = 0; overlay.anchorY = 0; overlay.alpha = 0;
    this.add(overlay);
    this._transitions.to(overlay as unknown as Record<string, number>, { alpha: 0.8, duration: 300 });

    // Yellow banner — fundo-amarelo.fw.png, 1136×113 in world → scale to screen
    const bannerObjs: Array<Sprite | RectShape> = [];
    void loadTexture(this._renderer, 'assets/images/especial/fundo-amarelo.fw.png').then((tex) => {
      const b = new Sprite({ texture: tex, x: CANVAS_W / 2, y: 80, width: CANVAS_W, height: 113 });
      b.anchorX = 0.5; b.anchorY = 0.5;
      this.add(b); bannerObjs.push(b);
    }).catch(() => {
      const b = new RectShape({ x: 0, y: 48, width: CANVAS_W, height: 64, fill: '#ffe600' });
      b.anchorX = 0; b.anchorY = 0.5;
      this.add(b); bannerObjs.push(b);
    });

    // Fruit special image slides in from left: especial/{name}.png
    const fruitImgPath = `assets/images/especial/${this._activeFruitType}.png`;
    const fruitW = this._activeFruitType === 'maca' ? 108 : 172;
    void loadTexture(this._renderer, fruitImgPath).then((tex) => {
      const img = new Sprite({ texture: tex, x: -fruitW / 2, y: 70, width: fruitW, height: fruitW });
      img.anchorX = 0.5; img.anchorY = 0.5;
      this.add(img);
      this._transitions.to(img as unknown as Record<string, number>, {
        x: 100, duration: 1000, easing: Easing.outQuad,
      });
      setTimeout(() => {
        this.remove(img);
        for (const b of bannerObjs) this.remove(b);
        this.remove(overlay);
        onDone();
      }, 1600);
    }).catch(() => {
      setTimeout(() => {
        for (const b of bannerObjs) this.remove(b);
        this.remove(overlay);
        onDone();
      }, 1600);
    });
  }

  private _showWin(): void {
    this._state = 'win';
    this._sounds.success();
    // Last level → go directly to final scene after a short delay
    if (!this._cfg.nextLevel) {
      setTimeout(() => {
        this._sounds.stopMusic();
        this._app.scenes.destroyScene('level');
        this._app.scenes.destroyScene('final');
        void this._app.scenes.go('final', { params: { app: this._app, score: this._score } });
      }, 1500);
      return;
    }
    void this._showResultOverlay(true);
  }

  private _showLose(): void {
    this._state = 'lose';
    this._sounds.failed();
    void this._showResultOverlay(false);
  }

  private async _showResultOverlay(win: boolean): Promise<void> {
    if (this._overlay) { this.remove(this._overlay); this._overlay = null; }
    const g = new Group();
    this._overlay = g;

    const btnY = CANVAS_H / 2 + 58;
    const hasNext = win && this._cfg.nextLevel != null;
    const btn1X = hasNext ? CANVAS_W / 2 - 72 : CANVAS_W / 2 - 48;
    const btn2X = hasNext ? CANVAS_W / 2       : CANVAS_W / 2 + 48;
    const btn3X = CANVAS_W / 2 + 72;

    // ── Register hit areas SYNCHRONOUSLY before any await ──────────────────
    this._resultBtns = [];
    if (hasNext) this._resultBtns.push({ x: btn1X, y: btnY, action: () => this._goToLevel(this._cfg.nextLevel!) });
    this._resultBtns.push({ x: btn2X, y: btnY, action: () => this._goToLevel(this._cfg.id) });
    if (hasNext) {
      this._resultBtns.push({ x: btn3X, y: btnY, action: () => this._goMenu() });
    } else {
      this._resultBtns.push({ x: CANVAS_W / 2 + 48, y: btnY, action: () => this._goMenu() });
    }

    // Dark background — add group immediately so overlay is interactive from now
    const bg = new RectShape({ x: 0, y: 0, width: CANVAS_W, height: CANVAS_H, fill: '#000000bb' });
    bg.anchorX = 0; bg.anchorY = 0;
    g.add(bg);
    const scoreTxt = new Text({ text: `Score: ${this._score}`, x: CANVAS_W / 2, y: CANVAS_H / 2 - 5, fontSize: 18, color: '#ffe600' });
    scoreTxt.anchorX = 0.5; scoreTxt.anchorY = 0.5;
    g.add(scoreTxt);
    this.add(g);

    // ── Load visuals async (buttons already clickable without textures) ─────
    const bannerPath = win ? 'assets/images/comum/verygood.fw.png' : 'assets/images/comum/youlose.fw.png';
    const [bannerTex, nextTex, reloadTex, exitTex] = await Promise.all([
      loadTexture(this._renderer, bannerPath).catch(() => null),
      hasNext ? loadTexture(this._renderer, 'assets/images/comum/btn-next.fw.png').catch(() => null) : Promise.resolve(null),
      loadTexture(this._renderer, 'assets/images/comum/btn-reload.fw.png').catch(() => null),
      loadTexture(this._renderer, 'assets/images/comum/btn-exit.fw.png').catch(() => null),
    ]);

    if (this._overlay !== g) return;  // navigated away during loading — abort

    if (bannerTex) {
      const banner = new Sprite({ texture: bannerTex, x: CANVAS_W / 2, y: CANVAS_H / 2 - 50, width: 271, height: 73 });
      banner.anchorX = 0.5; banner.anchorY = 0.5; g.add(banner);
    }

    const addSprite = (tex: typeof nextTex, x: number) => {
      if (!tex) return;
      const s = new Sprite({ texture: tex, x, y: btnY, width: 64, height: 64 });
      s.anchorX = 0.5; s.anchorY = 0.5; g.add(s);
    };
    if (hasNext) addSprite(nextTex, btn1X);
    addSprite(reloadTex, btn2X);
    addSprite(exitTex, hasNext ? btn3X : CANVAS_W / 2 + 48);
  }

  private _goToLevel(id: number): void {
    this._resultBtns = [];
    this._sounds.stopMusic();
    this._app.scenes.destroyScene('level');
    this._app.scenes.destroyScene('dualLevel');
    this._app.scenes.destroyScene('menu');
    const cfg = LEVELS.find(l => l.id === id);
    const name = isLevelDual(cfg!) ? 'dualLevel' : 'level';
    void this._app.scenes.go(name, { params: { app: this._app, level: id } });
  }

  private _goMenu(): void {
    this._resultBtns = [];
    this._sounds.stopMusic();
    this._app.scenes.destroyScene('level');
    this._app.scenes.destroyScene('dualLevel');
    this._app.scenes.destroyScene('menu');
    void this._app.scenes.go('menu', { params: { app: this._app } });
  }

  private _togglePause(): void {
    if (this._state === 'paused') {
      this._state = 'playing';
      this._resultBtns = [];  // clear so overlay handler doesn't fire
      for (const z of this._zombies) z.resume();
      if (this._overlay) { this.remove(this._overlay); this._overlay = null; }
      // Restore pause button
      if (this._pauseBtn) {
        void loadTexture(this._renderer, 'assets/images/objetos/pause-button.png')
          .then((tex) => { if (this._pauseBtn) this._pauseBtn.texture = tex; })
          .catch(() => {});
      }
    } else {
      this._state = 'paused';
      for (const z of this._zombies) z.pause();
      // Switch to continue button image
      if (this._pauseBtn) {
        void loadTexture(this._renderer, 'assets/images/objetos/continue-button.png')
          .then((tex) => { if (this._pauseBtn) this._pauseBtn.texture = tex; })
          .catch(() => {});
      }
      void this._showPauseOverlay();
    }
  }

  private async _showPauseOverlay(): Promise<void> {
    if (this._overlay) { this.remove(this._overlay); this._overlay = null; }
    const g = new Group();
    this._overlay = g;

    const btnY = CANVAS_H / 2 + 30;

    // ── Register hit areas SYNCHRONOUSLY before any await ──────────────────
    this._resultBtns = [
      { x: CANVAS_W / 2 - 48, y: btnY, action: () => this._goToLevel(this._cfg.id) },
      { x: CANVAS_W / 2 + 48, y: btnY, action: () => this._goMenu() },
    ];

    // Background + group added immediately so overlay is interactive right away
    const bg = new RectShape({ x: 0, y: 0, width: CANVAS_W, height: CANVAS_H, fill: '#000000aa' });
    bg.anchorX = 0; bg.anchorY = 0;
    g.add(bg);
    this.add(g);

    // ── Load visuals async (buttons already clickable without textures) ─────
    const [pauseTex, reloadTex, exitTex] = await Promise.all([
      loadTexture(this._renderer, 'assets/images/comum/pause.fw.png').catch(() => null),
      loadTexture(this._renderer, 'assets/images/comum/btn-reload.fw.png').catch(() => null),
      loadTexture(this._renderer, 'assets/images/comum/btn-exit.fw.png').catch(() => null),
    ]);

    if (this._overlay !== g) return;

    if (pauseTex) {
      const banner = new Sprite({ texture: pauseTex, x: CANVAS_W / 2, y: CANVAS_H / 2 - 44, width: 271, height: 73 });
      banner.anchorX = 0.5; banner.anchorY = 0.5; g.add(banner);
    }
    if (reloadTex) {
      const rb = new Sprite({ texture: reloadTex, x: CANVAS_W / 2 - 48, y: btnY, width: 64, height: 64 });
      rb.anchorX = 0.5; rb.anchorY = 0.5; g.add(rb);
    }
    if (exitTex) {
      const eb = new Sprite({ texture: exitTex, x: CANVAS_W / 2 + 48, y: btnY, width: 64, height: 64 });
      eb.anchorX = 0.5; eb.anchorY = 0.5; g.add(eb);
    }
  }

  private _checkFruitLanded(): void {
    const f = this._activeFruit;
    if (!f || !f.launched || !f.inAir || this._fruitLanding) return;

    if (f.physicsBody) {
      const vel = f.physicsBody.getVelocity();
      const speed = Math.hypot(vel.x, vel.y);

      // Landed: speed very low (fruit settled on floor)
      // No y-threshold — large fruits rest at y≈227 which was failing "> 230" check
      const settled = speed < 0.5;

      // Out of bounds: fell below screen or flew past world
      const outOfBounds = f.y > CANVAS_H + 80 || f.x > WORLD_W + 100 || f.x < -100;

      if ((settled || outOfBounds) && !this._fruitLanding) {
        f.inAir = false;
        f.land();
        this._fruitLanding = true;
        this._fruitLandTimer = 1.5;
      }

      // Camera follows fruit in flight
      if (f.inAir && f.x > CANVAS_W * 0.5) this._camera.follow(f.x);
    }
  }

  private _checkFruitZombieCollisions(): void {
    const f = this._activeFruit;
    if (!f || !f.launched || !f.inAir || this._fruitLanding) return;
    if (this._state !== 'playing') return;

    for (const z of this._zombies) {
      if (!z.alive) continue;
      const dx = f.x - z.x;
      const dy = f.y - z.y;
      if (Math.hypot(dx, dy) < 55) {
        f.inAir = false;
        this._fruitLanding = true;

        // Count alive zombies to determine if this is the last kill
        const aliveCount = this._zombies.filter(z2 => z2.alive).length;
        const isLastKill = aliveCount === 1 && z.hits <= 1;

        if (isLastKill) {
          // Street Fighter cutscene BEFORE the zombie death animation
          this._state = 'specialKill';
          this._fruitLandTimer = 999;
          for (const z2 of this._zombies) if (z2.alive) z2.pause();
          this._playSpecialKillCutscene(() => {
            // After cutscene → play zombie death animation → win via _onZombieDead
            z.hit();
          });
        } else {
          z.hit();
          f.land();
          this._fruitLandTimer = 2.2;
        }
        break;
      }
    }
  }

  override onUpdate(dt: number): void {
    if (this._state === 'paused' || this._state === 'win' || this._state === 'lose') return;

    this._transitions.update(dt);
    this._camera.update(dt);
    // PhysicsWorld.step calls syncToDisplay for all dynamic bodies → updates fruit.x/fruit.y directly
    this._physics.step(dt);

    for (const z of this._zombies) z.update(dt);

    if (this._activeFruit) {
      this._activeFruit.anim.update(dt);
      // fruit.x and fruit.y are already synced by physics.step (body added to fruit Group)
    }

    if (this._state === 'playing') {
      this._checkFruitZombieCollisions();
      this._checkFruitLanded();
      this._updateSeeds(dt);

      if (this._fruitLanding) {
        this._fruitLandTimer -= dt;
        if (this._fruitLandTimer <= 0) {
          this._fruitLanding = false;
          if (this._activeFruit?.physicsBody) {
            this._physics.removeBody(this._activeFruit.physicsBody);
            this._activeFruit.physicsBody = null;
            this._activeFruit.alpha = 0;
          }
          const allDead = this._zombies.every(z => !z.alive);
          if (!allDead) this._loadNextFruit();
        }
      }
    }
  }
}
