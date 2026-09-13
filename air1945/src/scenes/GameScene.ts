import { Scene, RectShape, Text, type SceneParams, type App } from 'easy-game-maker';
import { isTouchDevice } from '../helpers/TouchHelper';
import {
  W, H, PLAYER_SPEED, PLAYER_SHOOT_INTERVAL, PLAYER_INVINCIBLE_TIME,
  PLAYER_HITBOX_W, PLAYER_HITBOX_H, PLAYER_BULLET_SPEED, ENEMY_BULLET_SPEED,
  BOSS_HP, SCORE_FIGHTER, SCORE_BOMBER, SCORE_GUNSHIP, SCORE_BOSS, SCORE_POWERUP,
  aabb, clamp,
  type BulletEnt, type EnemyEnt, type PowerUpEnt, type ShardEnt, type BossState,
  type PlayerState, type WeaponType, type EnemyType, type PowerUpKind,
} from '../game/entities';
import {
  createPlayerDisplay, createFighterDisplay, createBomberDisplay,
  createGunshipDisplay, createBossDisplay,
  createPlayerBulletDisplay, createEnemyBulletDisplay,
  createPowerUpDisplay, createShardDisplay,
} from '../game/display';
import { ParallaxBG } from '../game/background';
import { cloneWaves, type WaveDef } from '../game/waves';

// ── Game state types ──────────────────────────────────────────────────────────

type GamePhase =
  | 'playing'
  | 'wave_clear'
  | 'boss_intro'
  | 'boss_fight'
  | 'level_clear'
  | 'player_die'
  | 'game_over'
  | 'paused';

// ── Sizes ─────────────────────────────────────────────────────────────────────

const ENEMY_SIZES: Record<EnemyType, [number, number]> = {
  fighter: [20, 20],
  bomber:  [28, 22],
  gunship: [28, 32],
};

const ENEMY_HP: Record<EnemyType, number> = { fighter: 1, bomber: 3, gunship: 7 };
const ENEMY_SCORE: Record<EnemyType, number> = {
  fighter:  SCORE_FIGHTER,
  bomber:   SCORE_BOMBER,
  gunship:  SCORE_GUNSHIP,
};

export class GameScene extends Scene {
  private _app!: App;

  // ── Display pools ─────────────────────────────────────────────────────────
  private _bg!: ParallaxBG;
  private _shards:       ShardEnt[]  = [];
  private _powerUps:     PowerUpEnt[] = [];
  private _enemyBullets: BulletEnt[]  = [];
  private _playerBullets: BulletEnt[] = [];
  private _fighters:  EnemyEnt[] = [];
  private _bombers:   EnemyEnt[] = [];
  private _gunships:  EnemyEnt[] = [];

  // ── Boss ──────────────────────────────────────────────────────────────────
  private _boss: BossState = {
    active: false, phase: 1, x: W / 2, y: -80, targetX: W / 2, targetY: 150,
    width: 96, height: 58, hp: BOSS_HP, maxHp: BOSS_HP,
    shootTimer: 0, shootPhase: 0, moveTimer: 0,
    display: null, hpBarFill: null,
  };

  // ── Player ────────────────────────────────────────────────────────────────
  private _p: PlayerState = {
    x: W / 2, y: H - 100, lives: 3, bombs: 2,
    weapon: 'single', weaponTimer: 0,
    shield: false, invincible: true, invTimer: 2.0,
    flashTimer: 0, shootTimer: 0, score: 0, highScore: 0,
    display: null, shieldDisplay: null,
  };

  // ── Wave management ───────────────────────────────────────────────────────
  private _waves: WaveDef[] = [];
  private _currentWave = 0;
  private _waveTimer = 0;
  private _phaseTimer = 0;
  private _phase: GamePhase = 'playing';

  // ── Flash overlay ─────────────────────────────────────────────────────────
  private _flashRect!: RectShape;

  // ── HUD ───────────────────────────────────────────────────────────────────
  private _scoreTxt!:    Text;
  private _livesTxt!:    Text;
  private _bombsTxt!:    Text;
  private _weaponTxt!:   Text;
  private _messageTxt!:  Text;
  private _subMsgTxt!:   Text;

  // ── Touch ─────────────────────────────────────────────────────────────────
  private _touch = false;
  /** Bomb button centre (canvas coords) — shown only on touch devices. */
  private readonly _bombBtnX = W - 45;
  private readonly _bombBtnY = H - 55;
  private readonly _bombBtnR = 36; // radius (half-size)

  // ── Key handler ───────────────────────────────────────────────────────────
  private _onKey = (e: unknown): void => {
    const ev = e as { key: string };
    if (ev.key === 'p' || ev.key === 'P') {
      if (this._phase === 'paused') {
        this._phase = 'playing';
        this._messageTxt.text = '';
      } else if (this._phase === 'playing' || this._phase === 'boss_fight') {
        this._phase = 'paused';
        this._messageTxt.text = 'PAUSED';
        this._subMsgTxt.text = 'P to resume';
      }
    }
    if (ev.key === 'z' || ev.key === 'Z' || ev.key === 'x' || ev.key === 'X') {
      this._useBomb();
    }
    if ((ev.key === 'n' || ev.key === 'N') &&
        (this._phase === 'game_over' || this._phase === 'level_clear')) {
      void this._app.scenes.go('menu', { transition: 'fade', duration: 300, params: { app: this._app } });
    }
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  override onCreate(params?: SceneParams): void {
    this._app = params?.['app'] as App;
    this._p.highScore = (params?.['highScore'] as number) ?? 0;
    this._touch = isTouchDevice();
    this._buildScene();
    if (this._touch) this._buildTouchUI();
    this._app.input.on('keydown', this._onKey);
    this._resetGame();
  }

  override onResume(): void {
    this._p.highScore = Math.max(this._p.highScore, this._p.score);
    this._resetGame();
  }

  override onDestroy(): void {
    this._app.input.off('keydown', this._onKey);
  }

  override onUpdate(dt: number): void {
    this._bg.update(dt);
    this._updateFlash(dt);

    if (this._phase === 'paused') return;

    if (this._phase === 'player_die') {
      this._phaseTimer -= dt;
      if (this._phaseTimer <= 0) this._respawn();
      return;
    }

    if (this._phase === 'game_over' || this._phase === 'level_clear') return;

    if (this._phase === 'wave_clear' || this._phase === 'boss_intro') {
      this._phaseTimer -= dt;
      if (this._phaseTimer <= 0) {
        if (this._phase === 'wave_clear') this._startNextWave();
        if (this._phase === 'boss_intro') this._startBossFight();
      }
    }

    // Always update existing entities even during transitions
    this._updatePlayer(dt);
    this._updatePlayerBullets(dt);
    this._updateEnemies(dt);
    this._updateEnemyBullets(dt);
    this._updatePowerUps(dt);
    this._updateShards(dt);
    this._updateBoss(dt);

    if (this._phase === 'playing') this._updateWave(dt);

    this._checkCollisions();
    this._syncHUD();
  }

  // ── Build scene ───────────────────────────────────────────────────────────

  private _buildScene(): void {
    // BG (layer 1 — rendered below everything)
    this._bg = new ParallaxBG(this);

    // Flash overlay (screen hit effect)
    this._flashRect = new RectShape({ x: W / 2, y: H / 2, width: W, height: H, fill: '#ffffff' });
    this._flashRect.alpha = 0;
    this.add(this._flashRect);

    // Explosion shards (48)
    for (let i = 0; i < 48; i++) {
      const d = createShardDisplay();
      d.visible = false;
      this.add(d);
      this._shards.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, timer: 0, maxTimer: 0.5, display: d });
    }

    // Power-ups (8)
    const puKinds: PowerUpKind[] = ['double', 'triple', 'shield', 'bomb', 'double', 'triple', 'shield', 'bomb'];
    for (const kind of puKinds) {
      const d = createPowerUpDisplay(kind);
      d.visible = false;
      this.add(d);
      this._powerUps.push({ active: false, kind, x: 0, y: 0, vy: 90, rotTimer: 0, display: d });
    }

    // Enemy bullets (140)
    for (let i = 0; i < 140; i++) {
      const d = createEnemyBulletDisplay();
      d.visible = false;
      this.add(d);
      this._enemyBullets.push({ active: false, x: 0, y: 0, vx: 0, vy: ENEMY_BULLET_SPEED, damage: 1, display: d });
    }

    // Player bullets (80)
    for (let i = 0; i < 80; i++) {
      const d = createPlayerBulletDisplay();
      d.visible = false;
      this.add(d);
      this._playerBullets.push({ active: false, x: 0, y: 0, vx: 0, vy: PLAYER_BULLET_SPEED, damage: 1, display: d });
    }

    // Enemy pools
    for (let i = 0; i < 12; i++) { const g = createFighterDisplay();  g.visible = false; this.add(g); this._fighters.push(this._mkEnemy('fighter', g)); }
    for (let i = 0; i < 6;  i++) { const g = createBomberDisplay();   g.visible = false; this.add(g); this._bombers.push(this._mkEnemy('bomber', g));  }
    for (let i = 0; i < 4;  i++) { const g = createGunshipDisplay();  g.visible = false; this.add(g); this._gunships.push(this._mkEnemy('gunship', g)); }

    // Boss
    const { group: bg, hpBarFill } = createBossDisplay();
    bg.visible = false;
    this.add(bg);
    this._boss.display = bg;
    this._boss.hpBarFill = hpBarFill;

    // Player
    const { group: pg, shield: sd } = createPlayerDisplay();
    this.add(pg);
    this._p.display = pg;
    this._p.shieldDisplay = sd;

    // HUD (last = on top)
    this._scoreTxt = this._txt('SCORE  000000', W / 2, 20, '#c8e8ff', 12);
    this._livesTxt = this._txt('♥ ♥ ♥', 28, 20, '#ff6666', 12);
    this._bombsTxt = this._txt('✦ ✦', W - 30, 20, '#ffaa44', 12);
    this._weaponTxt = this._txt('', W / 2, 36, '#ffe040', 10);

    this._messageTxt = this._txt('', W / 2, H / 2 - 20, '#ffffff', 26);
    this._subMsgTxt  = this._txt('', W / 2, H / 2 + 18, '#aaccee', 13);
  }

  // ── Game reset ────────────────────────────────────────────────────────────

  private _resetGame(): void {
    this._p.x = W / 2; this._p.y = H - 100;
    this._p.lives = 3; this._p.bombs = 2;
    this._p.weapon = 'single'; this._p.weaponTimer = 0;
    this._p.shield = false;
    this._p.invincible = true; this._p.invTimer = 1.8;
    this._p.flashTimer = 0; this._p.shootTimer = 0; this._p.score = 0;

    this._deactivateAll();
    this._waves = cloneWaves();
    this._currentWave = 0;
    this._waveTimer = 0;
    this._phase = 'playing';

    this._boss.active = false;
    this._boss.hp = BOSS_HP;
    if (this._boss.display) this._boss.display.visible = false;

    this._messageTxt.text = `WAVE 1`;
    this._subMsgTxt.text = 'GET READY!';
    this._phaseTimer = 1.5;
    this._phase = 'wave_clear';
  }

  private _deactivateAll(): void {
    for (const e of [...this._fighters, ...this._bombers, ...this._gunships]) {
      e.active = false; e.display.visible = false;
    }
    for (const b of [...this._playerBullets, ...this._enemyBullets]) {
      b.active = false; b.display.visible = false;
    }
    for (const s of this._shards) { s.active = false; s.display.visible = false; }
    for (const p of this._powerUps) { p.active = false; p.display.visible = false; }
  }

  // ── Wave management ───────────────────────────────────────────────────────

  private _updateWave(dt: number): void {
    if (this._currentWave >= this._waves.length) return;
    this._waveTimer += dt;

    const wave = this._waves[this._currentWave];
    if (!wave) return;

    for (const cmd of wave.spawns) {
      if (!cmd.spawned && this._waveTimer >= cmd.t) {
        cmd.spawned = true;
        this._spawnEnemy(cmd.type, cmd.x, cmd.vy, cmd.useSine, cmd.sineAmp, cmd.sineFreq, cmd.shootInterval);
      }
    }

    // Check if wave is complete
    const allSpawned = wave.spawns.every((s) => s.spawned);
    const anyActive = [...this._fighters, ...this._bombers, ...this._gunships].some((e) => e.active);
    if (allSpawned && !anyActive) {
      if (this._currentWave === this._waves.length - 1) {
        // Boss time!
        this._phase = 'boss_intro';
        this._phaseTimer = 2.5;
        this._messageTxt.text = '⚠  BOSS  INCOMING  ⚠';
        this._subMsgTxt.text = '';
      } else {
        this._phase = 'wave_clear';
        this._phaseTimer = 2.0;
        this._messageTxt.text = `WAVE ${this._currentWave + 1} CLEAR!`;
        this._subMsgTxt.text = `WAVE ${this._currentWave + 2} INCOMING`;
      }
    }
  }

  private _startNextWave(): void {
    this._currentWave++;
    this._waveTimer = 0;
    this._phase = 'playing';
    this._messageTxt.text = '';
    this._subMsgTxt.text = '';
  }

  private _startBossFight(): void {
    this._phase = 'boss_fight';
    this._messageTxt.text = '';
    this._subMsgTxt.text = '';
    this._boss.active = true;
    this._boss.x = W / 2;
    this._boss.y = -80;
    this._boss.hp = BOSS_HP;
    this._boss.phase = 1;
    this._boss.shootTimer = 1.5;
    this._boss.moveTimer = 0;
    if (this._boss.display) this._boss.display.visible = true;
    if (this._boss.hpBarFill) this._boss.hpBarFill.width = 88;
  }

  // ── Player update ─────────────────────────────────────────────────────────

  private _updatePlayer(dt: number): void {
    const p = this._p;
    const input = this._app.input;

    // ── Movement: keyboard (desktop) ─────────────────────────────────────────
    if (input.isKeyDown('ArrowLeft')  || input.isKeyDown('a') || input.isKeyDown('A')) p.x -= PLAYER_SPEED * dt;
    if (input.isKeyDown('ArrowRight') || input.isKeyDown('d') || input.isKeyDown('D')) p.x += PLAYER_SPEED * dt;
    if (input.isKeyDown('ArrowUp')    || input.isKeyDown('w') || input.isKeyDown('W')) p.y -= PLAYER_SPEED * dt;
    if (input.isKeyDown('ArrowDown')  || input.isKeyDown('s') || input.isKeyDown('S')) p.y += PLAYER_SPEED * dt;

    // ── Movement: touch (drag to move) ───────────────────────────────────────
    if (this._touch && input.pointer.isDown) {
      const ptr = input.pointer;
      // Ignore taps on the bomb button
      const onBomb = Math.abs(ptr.x - this._bombBtnX) < this._bombBtnR &&
                     Math.abs(ptr.y - this._bombBtnY) < this._bombBtnR;
      if (!onBomb) {
        const dx = ptr.x - p.x;
        const dy = ptr.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 4) {
          const speed = Math.min(PLAYER_SPEED, dist * 10);
          p.x += (dx / dist) * speed * dt;
          p.y += (dy / dist) * speed * dt;
        }
      }
    }

    p.x = clamp(p.x, 28, W - 28);
    p.y = clamp(p.y, 55, H - 44);

    // Weapon timer
    if (p.weapon !== 'single') {
      p.weaponTimer -= dt;
      if (p.weaponTimer <= 0) { p.weapon = 'single'; this._updateWeaponHUD(); }
    }

    // Auto-shoot
    p.shootTimer -= dt;
    if (p.shootTimer <= 0) {
      p.shootTimer = PLAYER_SHOOT_INTERVAL;
      this._firePlayer();
    }

    // Invincibility
    if (p.invincible) {
      p.invTimer -= dt;
      p.flashTimer += dt;
      if (p.display) p.display.alpha = Math.sin(p.flashTimer * 18) > 0 ? 1 : 0.25;
      if (p.invTimer <= 0) {
        p.invincible = false;
        if (p.display) p.display.alpha = 1;
      }
    }

    // Power-up shield visual pulse
    if (p.shieldDisplay) {
      if (p.shield) {
        p.shieldDisplay.alpha = 0.22 + Math.sin(p.flashTimer * 4) * 0.08;
      } else {
        p.shieldDisplay.alpha = 0;
      }
    }

    // Sync display
    if (p.display) { p.display.x = p.x; p.display.y = p.y; }
  }

  private _firePlayer(): void {
    switch (this._p.weapon) {
      case 'single': this._spawnPlayerBullet(this._p.x, this._p.y - 22, 0); break;
      case 'double':
        this._spawnPlayerBullet(this._p.x - 8, this._p.y - 18, 0);
        this._spawnPlayerBullet(this._p.x + 8, this._p.y - 18, 0);
        break;
      case 'triple':
        this._spawnPlayerBullet(this._p.x, this._p.y - 22, 0);
        this._spawnPlayerBullet(this._p.x - 10, this._p.y - 14, -80);
        this._spawnPlayerBullet(this._p.x + 10, this._p.y - 14, 80);
        break;
    }
  }

  private _useBomb(): void {
    if (this._p.bombs <= 0 || this._phase !== 'playing' && this._phase !== 'boss_fight') return;
    this._p.bombs--;
    this._triggerFlash('#aaddff', 0.4);

    // Kill/damage all enemies
    for (const enemies of [this._fighters, this._bombers, this._gunships]) {
      for (const e of enemies) {
        if (!e.active) continue;
        this._spawnExplosion(e.x, e.y, 1.5);
        this._addScore(e.scoreValue);
        e.active = false; e.display.visible = false;
      }
    }
    // Damage boss
    if (this._boss.active) {
      this._boss.hp = Math.max(this._boss.hp - 30, 0);
      this._updateBossHP();
      if (this._boss.hp <= 0) this._killBoss();
    }
    // Clear enemy bullets
    for (const b of this._enemyBullets) { if (b.active) { b.active = false; b.display.visible = false; } }
  }

  // ── Enemy update ──────────────────────────────────────────────────────────

  private _updateEnemies(dt: number): void {
    for (const enemies of [this._fighters, this._bombers, this._gunships]) {
      for (const e of enemies) {
        if (!e.active) continue;

        // Move
        e.y += e.vy * dt;
        if (e.useSine) {
          e.sineT += dt;
          e.x = e.baseX + Math.sin(e.sineT * e.sineFreq) * e.sineAmp;
        } else {
          e.x += e.vx * dt;
        }

        // Off-screen → deactivate
        if (e.y > H + 60) { e.active = false; e.display.visible = false; continue; }

        // Shoot
        if (e.y > 30) {
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            e.shootTimer = e.shootInterval;
            this._enemyShoot(e);
          }
        }

        // Sync display
        e.display.x = e.x; e.display.y = e.y;
      }
    }
  }

  private _enemyShoot(e: EnemyEnt): void {
    if (e.type === 'fighter') {
      this._spawnEnemyBullet(e.x, e.y + 14, 0, ENEMY_BULLET_SPEED);
    } else if (e.type === 'bomber') {
      const s = ENEMY_BULLET_SPEED * 0.9;
      const vx = 90;
      this._spawnEnemyBullet(e.x, e.y + 12, -vx, s);
      this._spawnEnemyBullet(e.x, e.y + 12,   0, s + 20);
      this._spawnEnemyBullet(e.x, e.y + 12,  vx, s);
    } else if (e.type === 'gunship') {
      const s = ENEMY_BULLET_SPEED * 0.85;
      for (let i = -2; i <= 2; i++) {
        const angle = i * (Math.PI / 11);
        this._spawnEnemyBullet(e.x, e.y + 18, Math.sin(angle) * 200, Math.cos(angle) * s);
      }
    }
  }

  // ── Boss update ───────────────────────────────────────────────────────────

  private _updateBoss(dt: number): void {
    if (!this._boss.active || this._phase !== 'boss_fight') return;
    const boss = this._boss;

    // Slide in
    if (boss.y < boss.targetY) {
      boss.y = Math.min(boss.y + 120 * dt, boss.targetY);
      if (boss.display) { boss.display.x = boss.x; boss.display.y = boss.y; }
      return;
    }

    // Phase based on HP
    boss.phase = boss.hp > boss.maxHp * 0.6 ? 1 : boss.hp > boss.maxHp * 0.3 ? 2 : 3;

    // Movement
    boss.moveTimer += dt;
    const speed = boss.phase === 3 ? 80 : boss.phase === 2 ? 55 : 35;
    boss.x = W / 2 + Math.sin(boss.moveTimer * speed * 0.015) * (W / 2 - 60);
    boss.y = boss.targetY + Math.sin(boss.moveTimer * 0.4) * 18;

    if (boss.display) { boss.display.x = boss.x; boss.display.y = boss.y; }

    // Shoot
    boss.shootTimer -= dt;
    const shootRate = boss.phase === 3 ? 0.75 : boss.phase === 2 ? 1.1 : 1.6;
    if (boss.shootTimer <= 0) {
      boss.shootTimer = shootRate;
      this._bossShoot();
    }
  }

  private _bossShoot(): void {
    const boss = this._boss;
    const bx = boss.x, by = boss.y + 30;

    if (boss.phase === 1) {
      // 3-way spread
      const angles = [-0.35, 0, 0.35];
      for (const a of angles) {
        this._spawnEnemyBullet(bx, by, Math.sin(a) * 200, Math.cos(a) * ENEMY_BULLET_SPEED);
      }
    } else if (boss.phase === 2) {
      // 5-way spread
      for (let i = -2; i <= 2; i++) {
        const a = i * (Math.PI / 9);
        this._spawnEnemyBullet(bx, by, Math.sin(a) * 220, Math.cos(a) * ENEMY_BULLET_SPEED);
      }
      // Aimed shot
      const dx = this._p.x - bx;
      const dy = this._p.y - by;
      const dist = Math.hypot(dx, dy) || 1;
      const sp = 300;
      this._spawnEnemyBullet(bx, by, (dx / dist) * sp, (dy / dist) * sp);
    } else {
      // Phase 3: spiral + aimed
      boss.shootPhase++;
      const spiralCount = 8;
      for (let i = 0; i < spiralCount; i++) {
        const a = (i / spiralCount) * Math.PI * 2 + boss.shootPhase * 0.4;
        this._spawnEnemyBullet(bx, by, Math.cos(a) * 200, Math.sin(a) * 200 + 60);
      }
    }
  }

  private _updateBossHP(): void {
    if (!this._boss.hpBarFill) return;
    this._boss.hpBarFill.width = Math.max(0, 88 * (this._boss.hp / this._boss.maxHp));
  }

  private _killBoss(): void {
    this._boss.active = false;
    if (this._boss.display) this._boss.display.visible = false;
    this._addScore(SCORE_BOSS);
    this._spawnExplosion(this._boss.x, this._boss.y, 4.0);
    this._spawnExplosion(this._boss.x - 20, this._boss.y - 10, 2.0);
    this._spawnExplosion(this._boss.x + 20, this._boss.y + 10, 2.0);
    this._triggerFlash('#ffaa44', 0.6);
    this._phase = 'level_clear';
    this._messageTxt.text = 'VICTORY!';
    this._subMsgTxt.text = `FINAL SCORE: ${this._p.score}  —  N to menu`;
  }

  // ── Bullet updates ────────────────────────────────────────────────────────

  private _updatePlayerBullets(dt: number): void {
    for (const b of this._playerBullets) {
      if (!b.active) continue;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < -20) { b.active = false; b.display.visible = false; continue; }
      b.display.x = b.x; b.display.y = b.y;
    }
  }

  private _updateEnemyBullets(dt: number): void {
    for (const b of this._enemyBullets) {
      if (!b.active) continue;
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y > H + 20 || b.x < -10 || b.x > W + 10) {
        b.active = false; b.display.visible = false; continue;
      }
      b.display.x = b.x; b.display.y = b.y;
    }
  }

  // ── Power-up update ───────────────────────────────────────────────────────

  private _updatePowerUps(dt: number): void {
    for (const pu of this._powerUps) {
      if (!pu.active) continue;
      pu.y += pu.vy * dt;
      pu.rotTimer += dt;
      pu.display.y = pu.y;
      pu.display.x = pu.x;
      pu.display.rotation = Math.PI / 4 + pu.rotTimer * 1.5;
      pu.display.alpha = 0.75 + Math.sin(pu.rotTimer * 4) * 0.25;
      if (pu.y > H + 30) { pu.active = false; pu.display.visible = false; }
    }
  }

  // ── Shard update ──────────────────────────────────────────────────────────

  private _updateShards(dt: number): void {
    for (const s of this._shards) {
      if (!s.active) continue;
      s.timer -= dt;
      if (s.timer <= 0) { s.active = false; s.display.visible = false; continue; }
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.vx *= 0.92; s.vy *= 0.92;
      s.display.x = s.x; s.display.y = s.y;
      s.display.alpha = s.timer / s.maxTimer;
    }
  }

  // ── Flash overlay ─────────────────────────────────────────────────────────

  private _updateFlash(dt: number): void {
    if (this._flashRect.alpha > 0) {
      this._flashRect.alpha = Math.max(0, this._flashRect.alpha - dt * 5);
    }
  }

  // ── Collision ─────────────────────────────────────────────────────────────

  private _checkCollisions(): void {
    // Player bullets vs enemies
    for (const pb of this._playerBullets) {
      if (!pb.active) continue;
      for (const enemies of [this._fighters, this._bombers, this._gunships]) {
        for (const e of enemies) {
          if (!e.active) continue;
          if (aabb(pb.x, pb.y, 4, 14, e.x, e.y, e.width, e.height)) {
            pb.active = false; pb.display.visible = false;
            e.hp -= pb.damage;
            if (e.hp <= 0) {
              this._killEnemy(e);
            } else {
              // Hit flash
              e.display.alpha = 0.4;
              this._app.timers.after(0.06, () => { if (e.active) e.display.alpha = 1; });
            }
          }
        }
      }

      // Player bullets vs boss
      if (this._boss.active && pb.active) {
        if (aabb(pb.x, pb.y, 4, 14, this._boss.x, this._boss.y, this._boss.width, this._boss.height)) {
          pb.active = false; pb.display.visible = false;
          this._boss.hp -= pb.damage;
          this._updateBossHP();
          if (this._boss.hp <= 0) this._killBoss();
        }
      }
    }

    // Enemy bullets vs player
    if (!this._p.invincible) {
      for (const eb of this._enemyBullets) {
        if (!eb.active) continue;
        if (aabb(eb.x, eb.y, 5, 10, this._p.x, this._p.y, PLAYER_HITBOX_W, PLAYER_HITBOX_H)) {
          eb.active = false; eb.display.visible = false;
          this._hitPlayer();
        }
      }
    }

    // Enemies vs player (collision damage)
    if (!this._p.invincible) {
      for (const enemies of [this._fighters, this._bombers, this._gunships]) {
        for (const e of enemies) {
          if (!e.active) continue;
          if (aabb(e.x, e.y, e.width * 0.7, e.height * 0.7, this._p.x, this._p.y, PLAYER_HITBOX_W, PLAYER_HITBOX_H)) {
            this._killEnemy(e);
            this._hitPlayer();
          }
        }
      }
    }

    // Power-ups vs player
    for (const pu of this._powerUps) {
      if (!pu.active) continue;
      if (aabb(pu.x, pu.y, 24, 24, this._p.x, this._p.y, 32, 32)) {
        this._collectPowerUp(pu);
      }
    }
  }

  // ── Player hit / die ──────────────────────────────────────────────────────

  private _hitPlayer(): void {
    if (this._p.shield) {
      this._p.shield = false;
      if (this._p.shieldDisplay) this._p.shieldDisplay.alpha = 0;
      this._triggerFlash('#4444ff', 0.3);
      this._p.invincible = true; this._p.invTimer = 0.8;
      return;
    }

    this._triggerFlash('#ff2244', 0.45);
    this._spawnExplosion(this._p.x, this._p.y, 1.0);
    this._p.lives--;
    this._syncHUD();

    if (this._p.lives <= 0) {
      if (this._p.display) this._p.display.visible = false;
      this._phase = 'game_over';
      this._messageTxt.text = 'GAME OVER';
      this._subMsgTxt.text = `SCORE: ${this._p.score}   N = MENU`;
      return;
    }

    // Die and respawn
    if (this._p.display) this._p.display.visible = false;
    this._phase = 'player_die';
    this._phaseTimer = 1.2;
  }

  private _respawn(): void {
    this._p.x = W / 2; this._p.y = H - 100;
    this._p.invincible = true; this._p.invTimer = PLAYER_INVINCIBLE_TIME;
    this._p.flashTimer = 0;
    this._p.weapon = 'single'; this._p.weaponTimer = 0;
    this._p.shield = false;
    if (this._p.display) this._p.display.visible = true;
    this._phase = this._boss.active ? 'boss_fight' : 'playing';
  }

  // ── Kill enemy ────────────────────────────────────────────────────────────

  private _killEnemy(e: EnemyEnt): void {
    this._addScore(e.scoreValue);
    this._spawnExplosion(e.x, e.y, e.type === 'gunship' ? 1.6 : e.type === 'bomber' ? 1.2 : 0.8);
    // Random power-up drop
    if (Math.random() < 0.18) this._dropPowerUp(e.x, e.y);
    e.active = false; e.display.visible = false;
  }

  // ── Power-up collect ──────────────────────────────────────────────────────

  private _collectPowerUp(pu: PowerUpEnt): void {
    this._addScore(SCORE_POWERUP);
    pu.active = false; pu.display.visible = false;

    switch (pu.kind) {
      case 'double': this._p.weapon = 'double'; this._p.weaponTimer = 14; this._updateWeaponHUD(); break;
      case 'triple': this._p.weapon = 'triple'; this._p.weaponTimer = 12; this._updateWeaponHUD(); break;
      case 'shield': this._p.shield = true; break;
      case 'bomb':   this._p.bombs = Math.min(this._p.bombs + 1, 4); break;
    }
    this._syncHUD();
  }

  // ── Score ─────────────────────────────────────────────────────────────────

  private _addScore(pts: number): void {
    this._p.score += pts;
    if (this._p.score > this._p.highScore) this._p.highScore = this._p.score;
  }

  // ── HUD sync ──────────────────────────────────────────────────────────────

  private _syncHUD(): void {
    this._scoreTxt.text = `SCORE  ${String(this._p.score).padStart(6, '0')}`;
    this._livesTxt.text = '♥ '.repeat(this._p.lives).trim() || '—';
    this._bombsTxt.text = '✦ '.repeat(this._p.bombs).trim() || '—';
  }

  private _updateWeaponHUD(): void {
    if (this._p.weapon === 'double') this._weaponTxt.text = '★ DOUBLE SHOT';
    else if (this._p.weapon === 'triple') this._weaponTxt.text = '★ TRIPLE SHOT';
    else this._weaponTxt.text = '';
  }

  // ── Spawn helpers ─────────────────────────────────────────────────────────

  private _spawnPlayerBullet(x: number, y: number, vx: number): void {
    const b = this._playerBullets.find((b) => !b.active);
    if (!b) return;
    b.active = true; b.x = x; b.y = y; b.vx = vx; b.vy = PLAYER_BULLET_SPEED;
    b.display.x = x; b.display.y = y; b.display.visible = true;
  }

  private _spawnEnemyBullet(x: number, y: number, vx: number, vy: number): void {
    const b = this._enemyBullets.find((b) => !b.active);
    if (!b) return;
    b.active = true; b.x = x; b.y = y; b.vx = vx; b.vy = vy;
    b.display.x = x; b.display.y = y; b.display.visible = true;
  }

  private _spawnEnemy(
    type: EnemyType, x: number, vy: number,
    useSine: boolean, sineAmp: number, sineFreq: number, shootInterval: number,
  ): void {
    const pool = type === 'fighter' ? this._fighters : type === 'bomber' ? this._bombers : this._gunships;
    const e = pool.find((e) => !e.active);
    if (!e) return;

    const [w, h] = ENEMY_SIZES[type] ?? [20, 20];
    e.active = true;
    e.x = x; e.baseX = x; e.y = -40;
    e.vx = 0; e.vy = vy;
    e.width = w; e.height = h;
    e.hp = ENEMY_HP[type] ?? 1; e.maxHp = e.hp;
    e.useSine = useSine;
    e.sineT = Math.random() * Math.PI * 2;
    e.sineAmp = sineAmp; e.sineFreq = sineFreq;
    e.shootTimer = shootInterval * (0.5 + Math.random() * 0.5);
    e.shootInterval = shootInterval;
    e.scoreValue = ENEMY_SCORE[type] ?? 100;

    e.display.x = x; e.display.y = -40; e.display.alpha = 1; e.display.visible = true;
  }

  private _dropPowerUp(x: number, y: number): void {
    const pu = this._powerUps.find((p) => !p.active);
    if (!pu) return;
    const kinds: PowerUpKind[] = ['double', 'triple', 'shield', 'bomb', 'double', 'double'];
    pu.kind = kinds[Math.floor(Math.random() * kinds.length)] ?? 'double';
    pu.active = true; pu.x = x; pu.y = y; pu.rotTimer = 0;

    // Update color
    const colors: Record<PowerUpKind, [number, number, number, number]> = {
      double:  [1.0, 0.88, 0.25, 1],
      triple:  [0.25, 1.0, 0.93, 1],
      shield:  [0.27, 1.0, 0.53, 1],
      bomb:    [1.0,  0.4, 0.13, 1],
    };
    pu.display.fillColor = colors[pu.kind] ?? [1, 1, 1, 1];
    pu.display.x = x; pu.display.y = y; pu.display.visible = true;
  }

  private _spawnExplosion(x: number, y: number, size: number): void {
    const count = Math.min(8, Math.round(4 + size * 2));
    for (let i = 0; i < count; i++) {
      const s = this._shards.find((s) => !s.active);
      if (!s) return;
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.4;
      const speed = (50 + Math.random() * 100) * size;
      s.active = true;
      s.x = x + (Math.random() - 0.5) * 10;
      s.y = y + (Math.random() - 0.5) * 10;
      s.vx = Math.cos(angle) * speed;
      s.vy = Math.sin(angle) * speed;
      s.maxTimer = 0.35 + Math.random() * 0.3;
      s.timer = s.maxTimer;

      const dim = (3 + size * 2.5) | 0;
      s.display.width = dim; s.display.height = dim;
      s.display.fillColor = Math.random() > 0.4
        ? [1.0, 0.55, 0.1, 1]
        : [1.0, 0.9, 0.2, 1];
      s.display.x = s.x; s.display.y = s.y;
      s.display.alpha = 1; s.display.visible = true;
    }
  }

  // ── Misc helpers ──────────────────────────────────────────────────────────

  private _triggerFlash(color: string, alpha: number): void {
    this._flashRect.fillColor = RectShape.parseColor(color);
    this._flashRect.alpha = alpha;
  }

  private _mkEnemy(type: EnemyType, display: import('easy-game-maker').Group): EnemyEnt {
    const [w, h] = ENEMY_SIZES[type] ?? [20, 20];
    return {
      active: false, type, x: 0, y: -100, baseX: 0,
      vx: 0, vy: 0, width: w, height: h,
      hp: 1, maxHp: 1, shootTimer: 2, shootInterval: 2,
      useSine: false, sineT: 0, sineAmp: 0, sineFreq: 0,
      scoreValue: ENEMY_SCORE[type] ?? 100, display,
    };
  }

  private _txt(text: string, x: number, y: number, color: string, size: number): Text {
    const t = new Text({ text, x, y, fontSize: size, color, fontFamily: 'monospace' });
    t.anchorX = 0.5; t.anchorY = 0.5; this.add(t); return t;
  }

  // ── Touch UI ──────────────────────────────────────────────────────────────

  private _buildTouchUI(): void {
    const bx = this._bombBtnX;
    const by = this._bombBtnY;
    const br = this._bombBtnR;

    // Bomb button — bottom-right circle
    const bombBg = new RectShape({ x: bx, y: by, width: br*2, height: br*2, fill: '#ff6622' });
    bombBg.anchorX = 0.5; bombBg.anchorY = 0.5; bombBg.alpha = 0.75;
    this.add(bombBg);

    const bombInner = new RectShape({ x: bx, y: by, width: br*2-6, height: br*2-6, fill: '#ff4400' });
    bombInner.anchorX = 0.5; bombInner.anchorY = 0.5; bombInner.alpha = 0.9;
    this.add(bombInner);

    const bombLabel = new Text({ text: '💣', x: bx, y: by - 2, fontSize: 22, color: '#ffffff', fontFamily: 'monospace' });
    bombLabel.anchorX = 0.5; bombLabel.anchorY = 0.5;
    this.add(bombLabel);

    const bombHint = new Text({ text: 'BOMB', x: bx, y: by + br + 12, fontSize: 9, color: '#ff8844cc', fontFamily: 'monospace' });
    bombHint.anchorX = 0.5; bombHint.anchorY = 0.5;
    this.add(bombHint);

    // Movement hint — centre bottom
    const moveHint = new Text({ text: 'drag to fly', x: W/2 - 30, y: H - 16, fontSize: 9, color: '#ffffff40', fontFamily: 'monospace' });
    moveHint.anchorX = 0.5; moveHint.anchorY = 0.5;
    this.add(moveHint);

    // Tap bomb button → use bomb
    this._app.input.on('pointerdown', (e: unknown) => {
      const ev = e as { x: number; y: number };
      const onBomb = Math.abs(ev.x - bx) < br && Math.abs(ev.y - by) < br;
      if (onBomb) this._useBomb();

      // Tap to start / dismiss game-over on touch
      if (this._phase === 'game_over' || this._phase === 'level_clear') {
        void this._app.scenes.go('menu', { transition: 'fade', duration: 300, params: { app: this._app } });
      }
    });
  }
}
