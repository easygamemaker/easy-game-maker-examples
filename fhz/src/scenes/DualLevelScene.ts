/**
 * DualLevelScene — two independent catapult lanes stacked vertically.
 *
 * Layout (568×320 canvas):
 *   ┌────────────────────────────────────┐  y=0
 *   │  TOP LANE  🏹 ──→ 🧟🧟🧟           │  155px
 *   ├────────────────────────────────────┤  y=155 (10px black divider)
 *   │  BOT LANE  🏹 ──→ 🧟🧟🧟           │  155px
 *   └────────────────────────────────────┘  y=320
 *
 * Background: ONE full 1136×320 image shared by both lanes.
 * Physics:    Each lane has its own PhysicsWorld (fully isolated).
 *             Floor  at y=LANE_FLOOR_Y  (bottom boundary).
 *             Ceiling at y=-10           (top boundary — prevents fruit
 *             from flying into the other lane's visual area).
 */
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
import { SeedProjectile, SEED_HIT_RADIUS } from '../game/SeedProjectile';
import type { ZombieActor } from '../game/ZombieActor';
import type { FruitActor } from '../game/FruitActor';
import {
  LEVELS, CANVAS_W, CANVAS_H, WORLD_W,
  LANE_H, LANE_GAP, LANE_BOT_Y,
  LANE_CAT_Y, LANE_ZOMBIE_Y, LANE_FLOOR_Y,
  CATAPULT_X, isLevelDual,
  type LevelConfig, type FruitType, type ZombieType, type LaneConfig,
} from '../config/levels';

type SceneState = 'intro' | 'playing' | 'paused' | 'win' | 'lose';

interface Lane {
  camera: GameCamera;
  physics: PhysicsWorld;
  catapult: Catapult;
  zombies: ZombieActor[];
  fruits: FruitActor[];
  fruitIndex: number;
  activeFruit: FruitActor | null;
  fruitLanding: boolean;
  fruitLandTimer: number;
  seeds: SeedProjectile[];
}

export class DualLevelScene extends Scene {
  private _app!: App;
  private _cfg!: LevelConfig;
  private _sounds!: SoundManager;
  private _transitions!: TransitionManager;
  private _top!: Lane;
  private _bot!: Lane;
  private _state: SceneState = 'intro';
  private _score = 0;
  private _scoreText!: Text;
  private _overlay: Group | null = null;
  private _resultBtns: Array<{ x: number; y: number; action: () => void }> = [];
  // Shared background group — scrolls with average camera x
  private _bgGroup: Group = new Group();

  override async onCreate(params?: SceneParams): Promise<void> {
    this._app = params?.['app'] as App;
    const levelId = (params?.['level'] as number | undefined) ?? 5;
    this._cfg = LEVELS.find(l => l.id === levelId) ?? LEVELS[4]!;
    this._sounds = new SoundManager(this._app);
    this._transitions = new TransitionManager();
    this._sounds.playMusic(this._cfg.music);

    if (!isLevelDual(this._cfg)) return;

    // ── Background: ONE full image spanning the entire canvas height ──────────
    // Rendered behind both lanes — scrolls with average camera x
    const bgTex = await loadTexture(this._renderer, this._cfg.background).catch(() => null);
    if (bgTex) {
      const bg = new Sprite({ texture: bgTex, x: WORLD_W / 2, y: CANVAS_H / 2, width: WORLD_W, height: CANVAS_H });
      bg.anchorX = 0.5; bg.anchorY = 0.5;
      this._bgGroup.add(bg);
    } else {
      const bg = new RectShape({ x: 0, y: 0, width: WORLD_W, height: CANVAS_H, fill: '#1a1a2e' });
      bg.anchorX = 0; bg.anchorY = 0;
      this._bgGroup.add(bg);
    }
    this.add(this._bgGroup);

    // ── Black divider strip ───────────────────────────────────────────────────
    const divider = new RectShape({ x: 0, y: LANE_H, width: CANVAS_W, height: LANE_GAP, fill: '#000000' });
    divider.anchorX = 0; divider.anchorY = 0;
    this.add(divider);

    // ── Load catapult textures once ───────────────────────────────────────────
    const [forkLTex, forkRTex] = await Promise.all([
      loadTexture(this._renderer, 'assets/images/objetos/catapulta_esquerda.png').catch(() => null),
      loadTexture(this._renderer, 'assets/images/objetos/catapulta_direita.png').catch(() => null),
    ]);

    // ── Build lanes (no background inside — it's shared above) ───────────────
    this._top = await this._buildLane(this._cfg.dual.topLane, 0, forkLTex, forkRTex);
    this._bot = await this._buildLane(this._cfg.dual.bottomLane, LANE_BOT_Y, forkLTex, forkRTex);

    this._buildHUD();
    this._setupOverlayInput();
    this._startIntro();
  }

  private get _renderer(): WebGLRenderer { return this._app.renderer as WebGLRenderer; }

  private async _buildLane(
    cfg: LaneConfig,
    canvasOffsetY: number,
    forkLTex: Texture | null,
    forkRTex: Texture | null,
  ): Promise<Lane> {
    const camera = new GameCamera(WORLD_W, CANVAS_W);
    camera.group.y = canvasOffsetY;  // y-offset positions lane on canvas
    this.add(camera.group);

    const physics = new PhysicsWorld({ gravity: { x: 0, y: 9.8 } });

    // ── Floor (visible grass / ground — bottom boundary of lane) ─────────────
    const floorRect = new RectShape({
      x: WORLD_W / 2, y: LANE_FLOOR_Y, width: WORLD_W, height: 20, fill: '#00000000',
    });
    floorRect.anchorX = 0.5; floorRect.anchorY = 0.5;
    camera.group.add(floorRect);
    physics.addBody(floorRect, { type: 'static', shape: 'rect' });

    // ── Ceiling (invisible — top boundary, prevents fruit entering other lane) ─
    const ceilRect = new RectShape({
      x: WORLD_W / 2, y: -10, width: WORLD_W, height: 20, fill: '#00000000',
    });
    ceilRect.anchorX = 0.5; ceilRect.anchorY = 0.5;
    camera.group.add(ceilRect);
    physics.addBody(ceilRect, { type: 'static', shape: 'rect' });

    // ── Catapult ──────────────────────────────────────────────────────────────
    let catapult!: Catapult;
    if (forkLTex && forkRTex) {
      catapult = new Catapult(this._app, physics, camera, forkLTex, forkRTex, CATAPULT_X, LANE_CAT_Y);
      camera.group.add(catapult);
    }

    // ── Fruits ────────────────────────────────────────────────────────────────
    const fruits: FruitActor[] = [];
    for (const ft of cfg.fruits) {
      const fruit = await this._createFruit(ft);
      fruit.alpha = 0;
      camera.group.add(fruit);
      fruits.push(fruit);
    }

    // ── Zombies ───────────────────────────────────────────────────────────────
    const zombies: ZombieActor[] = [];
    let zx = cfg.zombieStartX;
    for (const zt of cfg.zombies) {
      const z = await this._createZombie(zt, zx, LANE_ZOMBIE_Y);
      z.onDead = () => this._onZombieDead();
      camera.group.add(z);
      zombies.push(z);
      zx += cfg.zombieSpacing;
    }

    return {
      camera, physics, catapult,
      zombies, fruits,
      fruitIndex: fruits.length - 1,
      activeFruit: null,
      fruitLanding: false, fruitLandTimer: 0,
      seeds: [],
    };
  }

  private _buildHUD(): void {
    this._scoreText = new Text({ text: 'Score: 0', x: CANVAS_W / 2, y: 8, fontSize: 12, color: '#fff' });
    this._scoreText.anchorX = 0.5; this._scoreText.anchorY = 0;
    this.add(this._scoreText);

    void loadTexture(this._renderer, 'assets/images/objetos/pause-button.png')
      .then((tex) => {
        const btn = new Sprite({ texture: tex, x: CANVAS_W - 24, y: 16, width: 32, height: 32 });
        btn.anchorX = 0.5; btn.anchorY = 0.5;
        this.add(btn);
      }).catch(() => {});

    this._app.input.on<PointerEvent2D>('pointerdown', (e) => {
      if (Math.abs(e.x - (CANVAS_W - 24)) < 20 && Math.abs(e.y - 16) < 20) {
        if (this._state === 'playing') this._togglePause();
        else if (this._state === 'paused') this._togglePause();
      }
    });
  }

  private _setupOverlayInput(): void {
    const BTN_R = 40;
    this._app.input.on<PointerEvent2D>('pointerdown', (e) => {
      if (this._state !== 'win' && this._state !== 'lose' && this._state !== 'paused') return;
      for (const btn of this._resultBtns) {
        if (Math.abs(e.x - btn.x) < BTN_R && Math.abs(e.y - btn.y) < BTN_R) {
          this._sounds.button();
          this._resultBtns = [];
          btn.action();
          return;
        }
      }
    });
  }

  // ── Intro ─────────────────────────────────────────────────────────────────

  private _startIntro(): void {
    this._state = 'intro';
    this._top.camera.panTo(WORLD_W - CANVAS_W, 1.5);
    this._bot.camera.panTo(WORLD_W - CANVAS_W, 1.5, undefined, () => void this._showReady());
  }

  private async _showReady(): Promise<void> {
    const tex = await loadTexture(this._renderer, 'assets/images/menuprincipal/new/ready.fw.png').catch(() => null);
    let obj: Sprite | Text;
    if (tex) {
      obj = new Sprite({ texture: tex, x: CANVAS_W / 2, y: CANVAS_H / 2, width: 270, height: 100 });
      (obj as Sprite).anchorX = 0.5; (obj as Sprite).anchorY = 0.5;
    } else {
      obj = new Text({ text: 'READY!', x: CANVAS_W / 2, y: CANVAS_H / 2, fontSize: 34, color: '#ffe600' });
      (obj as Text).anchorX = 0.5; (obj as Text).anchorY = 0.5;
    }
    this.add(obj);
    this._transitions.to(obj as unknown as Record<string, number>, { alpha: 0, duration: 2000, easing: Easing.linear });
    this._top.camera.panTo(0, 3.0);
    this._bot.camera.panTo(0, 3.0, undefined, () => { this.remove(obj); void this._showGo(); });
  }

  private async _showGo(): Promise<void> {
    const tex = await loadTexture(this._renderer, 'assets/images/menuprincipal/new/go.fw.png').catch(() => null);
    let obj: Sprite | Text;
    if (tex) {
      obj = new Sprite({ texture: tex, x: CANVAS_W / 2, y: CANVAS_H / 2, width: 270, height: 100 });
      (obj as Sprite).anchorX = 0.5; (obj as Sprite).anchorY = 0.5;
    } else {
      obj = new Text({ text: 'GO!', x: CANVAS_W / 2, y: CANVAS_H / 2, fontSize: 42, color: '#ff4500' });
      (obj as Text).anchorX = 0.5; (obj as Text).anchorY = 0.5;
    }
    this.add(obj);
    this._state = 'playing';
    this._top.catapult?.markStarted();
    this._bot.catapult?.markStarted();
    for (const z of [...this._top.zombies, ...this._bot.zombies]) z.walk();
    this._loadNextFruit(this._top);
    this._loadNextFruit(this._bot);
    setTimeout(() => this.remove(obj), 1000);
  }

  // ── Lane logic ────────────────────────────────────────────────────────────

  private _loadNextFruit(lane: Lane): void {
    if (lane.fruitIndex < 0) { this._checkLose(); return; }
    const laneConfig = lane === this._top ? this._cfg.dual!.topLane : this._cfg.dual!.bottomLane;
    const fruit = lane.fruits[lane.fruitIndex];
    const fruitType = laneConfig.fruits[lane.fruitIndex];
    if (!fruit || !fruitType) return;
    lane.fruitIndex--;
    lane.activeFruit = fruit;
    fruit.alpha = 1; fruit.playNormal();
    if (fruitType === 'melancia') {
      fruit.onSpecialActivated = (f) => this._spawnSeeds(lane, f);
    }
    lane.catapult?.loadFruit(fruit);
    lane.camera.panTo(0, 0.8);
  }

  private _onZombieDead(): void {
    this._score += 100;
    this._scoreText.text = `Score: ${this._score}`;
    this._sounds.collision();
    if (this._top.zombies.every(z => !z.alive) && this._bot.zombies.every(z => !z.alive)) {
      this._showWin();
    }
  }

  private _checkLose(): void {
    const topOut = this._top.fruitIndex < 0 && !(this._top.activeFruit?.inAir);
    const botOut = this._bot.fruitIndex < 0 && !(this._bot.activeFruit?.inAir);
    if (topOut && botOut) {
      const anyAlive = [...this._top.zombies, ...this._bot.zombies].some(z => z.alive);
      if (anyAlive) this._showLose();
    }
  }

  private _spawnSeeds(lane: Lane, fruit: FruitActor): void {
    const pb = fruit.physicsBody;
    if (!pb) return;
    const vel = pb.getVelocity();
    const seeds = SeedProjectile.spawnFan(fruit.x, fruit.y, vel.x, vel.y, lane.physics);
    for (const s of seeds) { lane.camera.group.add(s.shape); lane.seeds.push(s); }
  }

  // ── Per-lane update ───────────────────────────────────────────────────────

  private _updateLane(lane: Lane, dt: number): void {
    lane.camera.update(dt);
    lane.physics.step(dt);
    for (const z of lane.zombies) z.update(dt);
    if (lane.activeFruit) lane.activeFruit.anim.update(dt);

    this._checkSeedsLane(lane);
    this._checkFruitZombieCollision(lane);
    this._checkFruitLanded(lane);

    if (lane.fruitLanding) {
      lane.fruitLandTimer -= dt;
      if (lane.fruitLandTimer <= 0) {
        lane.fruitLanding = false;
        if (lane.activeFruit?.physicsBody) {
          lane.physics.removeBody(lane.activeFruit.physicsBody);
          lane.activeFruit.physicsBody = null;
          lane.activeFruit.alpha = 0;
        }
        lane.activeFruit = null;
        if (!lane.zombies.every(z => !z.alive)) this._loadNextFruit(lane);
        else this._checkWin();
      }
    }
  }

  private _checkFruitLanded(lane: Lane): void {
    const f = lane.activeFruit;
    if (!f || !f.launched || !f.inAir || lane.fruitLanding) return;
    if (!f.physicsBody) return;
    const vel = f.physicsBody.getVelocity();
    const speed = Math.hypot(vel.x, vel.y);
    // out-of-bounds within the lane (below floor or off the sides)
    const outOfBounds = f.y > LANE_H + 40 || f.x > WORLD_W + 100 || f.x < -100;
    if (speed < 0.5 || outOfBounds) {
      f.inAir = false; f.land();
      lane.fruitLanding = true; lane.fruitLandTimer = 1.5;
    }
    if (f.inAir && f.x > CANVAS_W * 0.5) lane.camera.follow(f.x);
  }

  private _checkFruitZombieCollision(lane: Lane): void {
    const f = lane.activeFruit;
    if (!f || !f.launched || !f.inAir || lane.fruitLanding) return;
    if (this._state !== 'playing') return;
    for (const z of lane.zombies) {
      if (!z.alive) continue;
      // Both f.x/y and z.x/y are lane-local (relative to same camera group)
      if (Math.hypot(f.x - z.x, f.y - z.y) < 55) {
        f.inAir = false; lane.fruitLanding = true;
        z.hit(); f.land(); lane.fruitLandTimer = 2.0;
        break;
      }
    }
  }

  private _checkSeedsLane(lane: Lane): void {
    const toRemove: SeedProjectile[] = [];
    for (const s of lane.seeds) {
      if (!s.active) { toRemove.push(s); continue; }
      s.syncFromPhysics();
      if (s.y > LANE_H + 60 || s.x < -100 || s.x > WORLD_W + 100) {
        lane.camera.group.remove(s.shape); s.destroy(lane.physics); toRemove.push(s); continue;
      }
      for (const z of lane.zombies) {
        if (!z.alive) continue;
        if (Math.hypot(s.x - z.x, s.y - z.y) < SEED_HIT_RADIUS + 30) {
          lane.camera.group.remove(s.shape); s.destroy(lane.physics); toRemove.push(s);
          z.hit(); break;
        }
      }
    }
    lane.seeds = lane.seeds.filter(s => !toRemove.includes(s));
  }

  private _checkWin(): void {
    if (this._top.zombies.every(z => !z.alive) && this._bot.zombies.every(z => !z.alive)) {
      this._showWin();
    }
  }

  // ── Win / Lose / Pause ────────────────────────────────────────────────────

  private _showWin(): void {
    if (this._state === 'win') return;
    this._state = 'win'; this._sounds.success();
    void this._showResultOverlay(true);
  }

  private _showLose(): void {
    if (this._state === 'lose') return;
    this._state = 'lose'; this._sounds.failed();
    void this._showResultOverlay(false);
  }

  private async _showResultOverlay(win: boolean): Promise<void> {
    if (this._overlay) { this.remove(this._overlay); this._overlay = null; }
    const g = new Group();
    this._overlay = g;
    const btnY = CANVAS_H / 2 + 58;
    const hasNext = win && this._cfg.nextLevel != null;
    const b1x = hasNext ? CANVAS_W / 2 - 72 : CANVAS_W / 2 - 48;
    const b2x = hasNext ? CANVAS_W / 2 : CANVAS_W / 2 + 48;
    const b3x = CANVAS_W / 2 + 72;
    this._resultBtns = [];
    if (hasNext) this._resultBtns.push({ x: b1x, y: btnY, action: () => this._goToLevel(this._cfg.nextLevel!) });
    this._resultBtns.push({ x: b2x, y: btnY, action: () => this._goToLevel(this._cfg.id) });
    if (hasNext) this._resultBtns.push({ x: b3x, y: btnY, action: () => this._goMenu() });
    else this._resultBtns.push({ x: CANVAS_W / 2 + 48, y: btnY, action: () => this._goMenu() });
    const bg = new RectShape({ x: 0, y: 0, width: CANVAS_W, height: CANVAS_H, fill: '#000000bb' });
    bg.anchorX = 0; bg.anchorY = 0; g.add(bg);
    const score = new Text({ text: `Score: ${this._score}`, x: CANVAS_W / 2, y: CANVAS_H / 2 - 5, fontSize: 18, color: '#ffe600' });
    score.anchorX = 0.5; score.anchorY = 0.5; g.add(score);
    this.add(g);
    const bannerPath = win ? 'assets/images/comum/verygood.fw.png' : 'assets/images/comum/youlose.fw.png';
    const [bannerTex, nextTex, reloadTex, exitTex] = await Promise.all([
      loadTexture(this._renderer, bannerPath).catch(() => null),
      hasNext ? loadTexture(this._renderer, 'assets/images/comum/btn-next.fw.png').catch(() => null) : Promise.resolve(null),
      loadTexture(this._renderer, 'assets/images/comum/btn-reload.fw.png').catch(() => null),
      loadTexture(this._renderer, 'assets/images/comum/btn-exit.fw.png').catch(() => null),
    ]);
    if (this._overlay !== g) return;
    if (bannerTex) { const b = new Sprite({ texture: bannerTex, x: CANVAS_W/2, y: CANVAS_H/2-50, width: 271, height: 73 }); b.anchorX=0.5;b.anchorY=0.5;g.add(b); }
    const addBtn = (tex: Texture | null, x: number) => { if (!tex) return; const s=new Sprite({texture:tex,x,y:btnY,width:64,height:64});s.anchorX=0.5;s.anchorY=0.5;g.add(s); };
    if (hasNext) addBtn(nextTex, b1x);
    addBtn(reloadTex, b2x);
    addBtn(exitTex, hasNext ? b3x : CANVAS_W/2+48);
  }

  private _togglePause(): void {
    if (this._state === 'paused') {
      this._state = 'playing'; this._resultBtns = [];
      for (const z of [...this._top.zombies, ...this._bot.zombies]) z.resume();
      if (this._overlay) { this.remove(this._overlay); this._overlay = null; }
    } else {
      this._state = 'paused';
      for (const z of [...this._top.zombies, ...this._bot.zombies]) z.pause();
      this._resultBtns = [
        { x: CANVAS_W/2-48, y: CANVAS_H/2+30, action: () => this._goToLevel(this._cfg.id) },
        { x: CANVAS_W/2+48, y: CANVAS_H/2+30, action: () => this._goMenu() },
      ];
      void this._showPauseOverlay();
    }
  }

  private async _showPauseOverlay(): Promise<void> {
    if (this._overlay) { this.remove(this._overlay); this._overlay = null; }
    const g = new Group(); this._overlay = g;
    const bg = new RectShape({x:0,y:0,width:CANVAS_W,height:CANVAS_H,fill:'#000000aa'});bg.anchorX=0;bg.anchorY=0;g.add(bg);
    this.add(g);
    const [pauseTex,reloadTex,exitTex] = await Promise.all([
      loadTexture(this._renderer,'assets/images/comum/pause.fw.png').catch(()=>null),
      loadTexture(this._renderer,'assets/images/comum/btn-reload.fw.png').catch(()=>null),
      loadTexture(this._renderer,'assets/images/comum/btn-exit.fw.png').catch(()=>null),
    ]);
    if (this._overlay!==g) return;
    if (pauseTex){const b=new Sprite({texture:pauseTex,x:CANVAS_W/2,y:CANVAS_H/2-44,width:271,height:73});b.anchorX=0.5;b.anchorY=0.5;g.add(b);}
    const btnY=CANVAS_H/2+30;
    if (reloadTex){const r=new Sprite({texture:reloadTex,x:CANVAS_W/2-48,y:btnY,width:64,height:64});r.anchorX=0.5;r.anchorY=0.5;g.add(r);}
    if (exitTex){const e=new Sprite({texture:exitTex,x:CANVAS_W/2+48,y:btnY,width:64,height:64});e.anchorX=0.5;e.anchorY=0.5;g.add(e);}
  }

  private _goToLevel(id: number): void {
    this._resultBtns = []; this._sounds.stopMusic();
    this._app.scenes.destroyScene('level');
    this._app.scenes.destroyScene('dualLevel');
    this._app.scenes.destroyScene('menu');
    const cfg = LEVELS.find(l => l.id === id);
    void this._app.scenes.go(isLevelDual(cfg!) ? 'dualLevel' : 'level', { params: { app: this._app, level: id } });
  }

  private _goMenu(): void {
    this._resultBtns = []; this._sounds.stopMusic();
    this._app.scenes.destroyScene('level');
    this._app.scenes.destroyScene('dualLevel');
    this._app.scenes.destroyScene('menu');
    void this._app.scenes.go('menu', { params: { app: this._app } });
  }

  // ── Update loop ───────────────────────────────────────────────────────────

  override onUpdate(dt: number): void {
    if (!this._top || !this._bot) return;  // guard: still loading
    if (this._state === 'paused' || this._state === 'win' || this._state === 'lose') return;
    this._transitions.update(dt);
    // Scroll shared background with average of both lane cameras
    const avgCamX = (this._top.camera.x + this._bot.camera.x) / 2;
    this._bgGroup.x = -Math.round(avgCamX);
    if (this._state === 'playing') {
      this._updateLane(this._top, dt);
      this._updateLane(this._bot, dt);
    }
  }

  // ── Fruit / Zombie factories (identical to LevelScene) ────────────────────

  private async _createFruit(type: FruitType): Promise<FruitActor> {
    const base = 'assets/images/personagens/frutas/';
    const fallback = 'assets/images/menuprincipal/new/melancia.fw.png';
    const pad = (n: number) => String(n).padStart(4, '0');
    const safe = (url: string) => loadTexture(this._renderer, url).catch(() => loadTexture(this._renderer, fallback));
    type M = { dir: string; normalPfx: string; specialPfx: string; colPfx: string; nC: number; sC: number; cC: number; w: number; h: number };
    const meta: Record<FruitType, M> = {
      melancia: { dir:'melancia', normalPfx:'normal/watermelon normal',  specialPfx:'especial/watermelonspecial', colPfx:'colisao/watermeloncollision', nC:12,sC:12,cC:5, w:86,h:86 },
      maca:     { dir:'maca',     normalPfx:'maca_normal/apple normal',   specialPfx:'especial/apple specia',      colPfx:'maca_normal/apple normal',    nC:12,sC:14,cC:1, w:54,h:54 },
      laranja:  { dir:'laranja',  normalPfx:'normal/orange normal',       specialPfx:'noar/orange throwing',       colPfx:'normal/orange normal',        nC:12,sC:12,cC:1, w:54,h:54 },
      abacaxy:  { dir:'abacaxy',  normalPfx:'normal/pineaple normal',     specialPfx:'especial/pineaplespecial',   colPfx:'colisao/pineaplecollision',   nC:12,sC:12,cC:4, w:86,h:86 },
      coco:     { dir:'coco',     normalPfx:'normal/coconut normal',      specialPfx:'especial/coconutspecial',    colPfx:'colisao/coconutcollision',    nC:12,sC:12,cC:4, w:86,h:86 },
      melao:    { dir:'melao',    normalPfx:'normal/melao normal',        specialPfx:'especial/melaospecial',      colPfx:'colisao/melaocollision',      nC:12,sC:12,cC:1, w:86,h:86 },
    };
    const m = meta[type];
    const frames: Texture[] = [];
    for (let i=1;i<=m.nC;i++) frames.push(await safe(`${base}${m.dir}/${m.normalPfx}${pad(i)}.png`));
    for (let i=1;i<=m.sC;i++) frames.push(await safe(`${base}${m.dir}/${m.specialPfx}${pad(i)}.png`));
    for (let i=1;i<=m.cC;i++) frames.push(await safe(`${base}${m.dir}/${m.colPfx}${pad(i)}.png`));
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
    const safe = (url: string) => loadTexture(this._renderer, url).catch(() => loadTexture(this._renderer, fallback));
    type Z = { dir: string; walkPfx: string; colPfx: string; runPfx: string; detPfx: string };
    const meta: Record<ZombieType, Z> = {
      zumbiNormal:  { dir:'zumbi_normal',  walkPfx:'normal/manwalks',          colPfx:'colisao/mancollision',     runPfx:'normal/manwalks',           detPfx:'deteriorar/desintegration' },
      zumbiVelho:   { dir:'zumbi_velho',   walkPfx:'normal/oldwalks',          colPfx:'colisao/old collision',    runPfx:'correndo/oldman running',    detPfx:'deteriorar/desintegration' },
      zumbiGordo:   { dir:'zumbi_gordao',  walkPfx:'normal/fatwalks',          colPfx:'colisao/fatcollision',     runPfx:'correndo/fat running',       detPfx:'deteriorar/desintegration' },
      zumbiKid:     { dir:'zumbi_kid',     walkPfx:'normal/kidwalks',          colPfx:'colisao/kidcollision',     runPfx:'correndo/kid running',       detPfx:'deteriorar/desintegration' },
      zumbiMulher:  { dir:'zumbi_mulher',  walkPfx:'normal/zombie girl walks', colPfx:'colisao/girlcollision',    runPfx:'correndo/girl running',      detPfx:'deteriorar/desintegration' },
      zumbiFortao:  { dir:'zumbi_fortao',  walkPfx:'normal/strongwalks',       colPfx:'colisao/strongcollision',  runPfx:'correndo/strong man running', detPfx:'deteriorar/desintegration' },
    };
    const m = meta[type];
    const frames: Texture[] = [];
    for (let i=1;i<=12;i++) frames.push(await safe(`${base}${m.dir}/${m.walkPfx}${pad(i)}.png`));
    for (let i=1;i<=10;i++) frames.push(await safe(`${base}${m.dir}/${m.colPfx}${pad(i)}.png`));
    for (let i=1;i<=12;i++) frames.push(await safe(`${base}${m.dir}/${m.runPfx}${pad(i)}.png`));
    for (let i=1;i<=8; i++) frames.push(await safe(`${base}${m.dir}/${m.detPfx}${pad(i)}.png`));
    const opts = { x, y, frames, width: 86, height: 86 };
    switch (type) {
      case 'zumbiNormal': return new ZumbiNormal(opts);
      case 'zumbiVelho':  return new ZumbiVelho(opts);
      case 'zumbiGordo':  return new ZumbiGordo(opts);
      case 'zumbiKid':    return new ZumbiKid(opts);
      case 'zumbiMulher': return new ZumbiMulher(opts);
      case 'zumbiFortao': return new ZumbiFortao(opts);
    }
  }
}
