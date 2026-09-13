import {
  Scene, Group, RectShape, CircleShape, Text, type SceneParams, type App,
} from 'easy-game-maker';
import { MissionClient, type MissionResult } from '../network/MissionClient';
import { MapRenderer } from '../game/MapRenderer';
import { Player } from '../game/Player';
import { BulletRenderer } from '../game/Bullet';
import { AmmoPickup } from '../game/AmmoPickup';
import { isCircleInWallX, isCircleInWallY, SPAWN_POINTS } from '../config/maps';

const W = 800, H = 600;
const SEND_HZ     = 20;
const PLAYER_SPEED = 160;
const PLAYER_RADIUS = 14;
const PICKUP_CHECK_RADIUS = 28;

export class GameScene extends Scene {
  private _app!: App;
  private _client!: MissionClient;
  private _playerName = '';

  // World
  private _world!: Group;
  private _hud!: Group;

  // Local player
  private _localPlayer!: Player;
  private _mouseX = W / 2;
  private _mouseY = H / 2;
  private _keys = { up: false, down: false, left: false, right: false };
  private _myHp = 3;
  private _myAmmo = 8;
  private _myKills = 0;
  private _myDeaths = 0;
  private _alive = true;
  private _respawnAt = 0;

  // Remote entities
  private _remotePlayers: Map<string, Player> = new Map();
  private _bullets: Map<string, BulletRenderer> = new Map();
  private _pickups: Map<string, AmmoPickup> = new Map();

  // HUD elements
  private _timerText!: Text;
  private _kdText!: Text;
  private _ammoText!: Text;
  private _respawnOverlay!: Group;
  private _respawnCountText!: Text;
  private _countdownOverlay!: Group;
  private _countdownText!: Text;
  private _feedText!: Text;

  // Timers
  private _sendTimer = 0;
  private _gameTimer = 90;
  private _playing = false;
  private _shootCooldown = 0;
  private _feedTimeout: ReturnType<typeof setTimeout> | null = null;

  override async onCreate(params?: SceneParams): Promise<void> {
    this._app        = params?.['app'] as App;
    this._client     = params?.['client'] as MissionClient;
    this._playerName = params?.['playerName'] as string ?? 'Soldier';

    this._world = new Group();
    this.add(this._world);
    this._hud = new Group();
    this.add(this._hud);

    this._world.add(new MapRenderer());

    // Build local player from initial state
    const initial = this._client.initialState;
    const myData = initial?.players?.[this._client.sessionId];
    const spawnPt = SPAWN_POINTS[myData?.spawnIndex ?? 0]!;

    this._localPlayer = new Player({
      sessionId:  this._client.sessionId,
      playerName: this._playerName,
      color:      myData?.color ?? '#4dff88',
      x: spawnPt.x, y: spawnPt.y,
      isLocal: true,
    });
    this._world.add(this._localPlayer);

    // Build remote players from two sources merged:
    // 1. initialState.players — full data but only for players present at join time
    // 2. lobbyPlayers — up-to-date list from Lobby (includes latecomers whose
    //    player:joined event was already consumed by LobbyScene)
    type LobbyEntry = { name: string; color: string; ready: boolean };
    const lobbyPlayers = params?.['lobbyPlayers'] as Map<string, LobbyEntry> | undefined;

    const toCreate = new Map<string, { name: string; color: string; x: number; y: number }>();

    // From initialState
    if (initial?.players) {
      Object.values(initial.players).forEach((p) => {
        if (p.sessionId === this._client.sessionId) return;
        toCreate.set(p.sessionId, { name: p.playerName, color: p.color, x: p.x, y: p.y });
      });
    }

    // From lobbyPlayers — add any not covered by initialState
    if (lobbyPlayers) {
      lobbyPlayers.forEach((p, sid) => {
        if (sid === this._client.sessionId) return;
        if (!toCreate.has(sid)) {
          // Position unknown yet — state:sync will correct it within one tick
          toCreate.set(sid, { name: p.name, color: p.color, x: W / 2, y: H / 2 });
        }
      });
    }

    toCreate.forEach((data, sid) => {
      const rp = new Player({
        sessionId: sid, playerName: data.name,
        color: data.color, x: data.x, y: data.y, isLocal: false,
      });
      this._remotePlayers.set(sid, rp);
      this._world.add(rp);
    });

    // Build pickups
    if (initial?.pickups) {
      initial.pickups.forEach((pk) => {
        const pickup = new AmmoPickup({ id: pk.id, x: pk.x, y: pk.y });
        if (!pk.active) pickup.collect();
        this._pickups.set(pk.id, pickup);
        this._world.add(pickup);
      });
    }

    this._buildHUD();
    this._bindNetwork();
    // Clear all input listeners from previous scenes before binding ours
    this._app.input.removeAllListeners();
    this._bindInput();
    // Game is already running — we only navigate here after game:start
    this._playing = true;
  }

  private _buildHUD(): void {
    // Top strip
    const strip = new RectShape({ x: 0, y: 0, width: W, height: 44, fill: '#000000bb' });
    strip.anchorX = 0; strip.anchorY = 0;
    this._hud.add(strip);

    const strip2 = new RectShape({ x: 0, y: 44, width: W, height: 1, fill: '#4dff8844' });
    strip2.anchorX = 0; strip2.anchorY = 0;
    this._hud.add(strip2);

    // Player name + color dot
    const myColor = this._localPlayer.color;
    const dot = new CircleShape({ x: 24, y: 22, radius: 7, fill: myColor });
    dot.anchorX = 0.5; dot.anchorY = 0.5;
    this._hud.add(dot);

    const nameText = new Text({ text: this._playerName.substring(0, 10), x: 38, y: 22, fontSize: 14, color: '#ffffffcc' });
    nameText.anchorX = 0; nameText.anchorY = 0.5;
    this._hud.add(nameText);

    // Timer
    this._timerText = new Text({ text: '1:30', x: W / 2, y: 22, fontSize: 22, color: '#4dff88' });
    this._timerText.anchorX = 0.5; this._timerText.anchorY = 0.5;
    this._hud.add(this._timerText);

    // K/D
    this._kdText = new Text({ text: 'K:0  D:0', x: W - 160, y: 22, fontSize: 14, color: '#ffffffcc' });
    this._kdText.anchorX = 0; this._kdText.anchorY = 0.5;
    this._hud.add(this._kdText);

    // Ammo counter
    this._ammoText = new Text({ text: 'AMMO: 8', x: W - 20, y: 22, fontSize: 14, color: '#ffd700' });
    this._ammoText.anchorX = 1; this._ammoText.anchorY = 0.5;
    this._hud.add(this._ammoText);

    // Kill feed (top right, below strip)
    this._feedText = new Text({ text: '', x: W - 16, y: 64, fontSize: 11, color: '#ff6644cc' });
    this._feedText.anchorX = 1; this._feedText.anchorY = 0;
    this._hud.add(this._feedText);

    // Respawn overlay
    this._respawnOverlay = new Group();
    const respawnBg = new RectShape({ x: W / 2, y: H / 2, width: 320, height: 100, fill: '#000000cc' });
    respawnBg.anchorX = 0.5; respawnBg.anchorY = 0.5;
    this._respawnOverlay.add(respawnBg);
    const respawnBorder = new RectShape({ x: W / 2, y: H / 2, width: 320, height: 100, fill: 'transparent', stroke: '#ff4444', strokeWidth: 2 });
    respawnBorder.anchorX = 0.5; respawnBorder.anchorY = 0.5;
    this._respawnOverlay.add(respawnBorder);
    const respawnTitle = new Text({ text: 'KIA — RESPAWNING', x: W / 2, y: H / 2 - 22, fontSize: 16, color: '#ff4444' });
    respawnTitle.anchorX = 0.5; respawnTitle.anchorY = 0.5;
    this._respawnOverlay.add(respawnTitle);
    this._respawnCountText = new Text({ text: '3', x: W / 2, y: H / 2 + 18, fontSize: 32, color: '#ffffff' });
    this._respawnCountText.anchorX = 0.5; this._respawnCountText.anchorY = 0.5;
    this._respawnOverlay.add(this._respawnCountText);
    this._respawnOverlay.visible = false;
    this._hud.add(this._respawnOverlay);

    // Countdown overlay
    this._countdownOverlay = new Group();
    this._countdownText = new Text({ text: '', x: W / 2, y: H / 2 - 30, fontSize: 100, color: '#4dff88' });
    this._countdownText.anchorX = 0.5; this._countdownText.anchorY = 0.5;
    this._countdownOverlay.add(this._countdownText);
    this._hud.add(this._countdownOverlay);

    // Controls hint
    const ctrl = new Text({ text: 'WASD: move  •  Mouse: aim  •  Click / Space: shoot', x: W / 2, y: H - 12, fontSize: 11, color: '#ffffff33' });
    ctrl.anchorX = 0.5; ctrl.anchorY = 0.5;
    this._hud.add(ctrl);
  }

  private _bindNetwork(): void {
    this._client.onStateSyncCb = (players, timer) => {
      this._gameTimer = timer;
      Object.entries(players).forEach(([sid, data]) => {
        if (sid === this._client.sessionId) return;
        const rp = this._remotePlayers.get(sid);
        if (rp) {
          if (data.alive !== rp.alive && data.alive) {
            rp.setRespawn(data.x, data.y, 3);
          }
          rp.setRemoteTarget(data.x, data.y, data.angle);
          if (!data.alive && rp.alive) rp.setDead();
        }
      });
    };

    this._client.onPlayerJoinedCb = (info) => {
      if (this._remotePlayers.has(info.sessionId)) return;
      const rp = new Player({
        sessionId: info.sessionId, playerName: info.playerName,
        color: info.color, x: info.x, y: info.y, isLocal: false,
      });
      this._remotePlayers.set(info.sessionId, rp);
      this._world.add(rp);
    };

    this._client.onPlayerLeftCb = (sid) => {
      const rp = this._remotePlayers.get(sid);
      if (rp) { this._world.remove(rp); this._remotePlayers.delete(sid); }
    };

    this._client.onBulletFiredCb = (d) => {
      const bullet = new BulletRenderer({ id: d.id, ownerId: d.ownerId, x: d.x, y: d.y, angle: d.angle });
      this._bullets.set(d.id, bullet);
      this._world.add(bullet);
    };

    this._client.onBulletDestroyedCb = (d) => {
      const b = this._bullets.get(d.id);
      if (b) { b.destroy(); this._world.remove(b); this._bullets.delete(d.id); }
    };

    this._client.onPlayerHitCb = (d) => {
      if (d.sessionId === this._client.sessionId) {
        this._myHp = d.hp;
        this._localPlayer.setHp(d.hp);
        this._localPlayer.flashHit();
      } else {
        const rp = this._remotePlayers.get(d.sessionId);
        if (rp) { rp.setHp(d.hp); rp.flashHit(); }
      }
    };

    this._client.onPlayerDeadCb = (d) => {
      this._showFeed(`${d.killerName} eliminated ${d.sessionId === this._client.sessionId ? 'you' : this._remotePlayers.get(d.sessionId)?.playerName ?? '?'}`);
      if (d.sessionId === this._client.sessionId) {
        this._alive = false;
        this._respawnAt = Date.now() + d.respawnIn;
        this._localPlayer.setDead();
        this._respawnOverlay.visible = true;
      } else {
        const rp = this._remotePlayers.get(d.sessionId);
        if (rp) rp.setDead(d.respawnIn / 1000);
      }
    };

    this._client.onPlayerRespawnCb = (d) => {
      if (d.sessionId === this._client.sessionId) {
        this._alive = true;
        this._myHp = d.hp;
        this._myAmmo = d.ammo;
        this._respawnAt = 0;
        this._localPlayer.setRespawn(d.x, d.y, d.hp);
        this._respawnOverlay.visible = false;
        this._ammoText.text = `AMMO: ${d.ammo}`;
      } else {
        const rp = this._remotePlayers.get(d.sessionId);
        if (rp) rp.setRespawn(d.x, d.y, d.hp);
      }
    };

    this._client.onAmmoUpdateCb = (ammo) => {
      this._myAmmo = ammo;
      this._ammoText.text = `AMMO: ${ammo}`;
      this._ammoText.color = ammo === 0 ? '#ff4444' : '#ffd700';
    };

    this._client.onPickupTakenCb = (d) => {
      const pk = this._pickups.get(d.pickupId);
      if (pk) pk.collect();
    };

    this._client.onPickupSpawnCb = (pickups) => {
      // Remove old pickups
      this._pickups.forEach((pk) => { this._world.remove(pk); });
      this._pickups.clear();
      pickups.forEach((p) => {
        const pickup = new AmmoPickup({ id: p.id, x: p.x, y: p.y });
        this._pickups.set(p.id, pickup);
        this._world.add(pickup);
      });
    };

    this._client.onScoresUpdateCb = (scores) => {
      const mine = scores[this._client.sessionId];
      if (mine) {
        this._myKills  = mine.kills;
        this._myDeaths = mine.deaths;
        this._kdText.text = `K:${mine.kills}  D:${mine.deaths}`;
      }
    };

    this._client.onCountdownCb = (sec) => {
      this._countdownText.text  = sec > 0 ? String(sec) : 'GO!';
      this._countdownText.color = sec > 0 ? '#4dff88' : '#ffffff';
      setTimeout(() => {
        if (this._countdownText.text === 'GO!' || sec > 0) this._countdownText.text = '';
      }, sec > 0 ? 800 : 1200);
    };

    this._client.onGameEndCb = (results: MissionResult[]) => {
      setTimeout(() => {
        void this._app.scenes.go('results', {
          params: { app: this._app, results, client: this._client },
        });
      }, 2000);
    };
  }

  private _bindInput(): void {
    // e.code = physical key position (layout-independent, e.g. 'KeyD')
    // e.key  = printed character (layout-dependent, e.g. 'd', 'D')
    // We check BOTH so the mapping works regardless of keyboard layout or browser quirks
    type Keys = typeof this._keys;
    const byCode: Record<string, keyof Keys> = {
      KeyW: 'up',    ArrowUp: 'up',
      KeyS: 'down',  ArrowDown: 'down',
      KeyA: 'left',  ArrowLeft: 'left',
      KeyD: 'right', ArrowRight: 'right',
    };
    const byKey: Record<string, keyof Keys> = {
      w: 'up',  W: 'up',
      s: 'down', S: 'down',
      a: 'left', A: 'left',
      d: 'right', D: 'right',
    };
    const resolve = (code: string, key: string): keyof Keys | undefined =>
      byCode[code] ?? byKey[key];

    this._app.input.on('keydown', (e: { code: string; key: string }) => {
      const k = resolve(e.code, e.key);
      if (k) this._keys[k] = true;
      if (e.key === ' ' && this._playing) this._tryShoot();
    });
    this._app.input.on('keyup', (e: { code: string; key: string }) => {
      const k = resolve(e.code, e.key);
      if (k) this._keys[k] = false;
    });
    this._app.input.on('pointermove', (e: { x: number; y: number }) => {
      this._mouseX = e.x;
      this._mouseY = e.y;
    });
    this._app.input.on('pointerdown', (e: { x: number; y: number }) => {
      this._mouseX = e.x;
      this._mouseY = e.y;
      if (this._playing) this._tryShoot();
    });
  }

  override onUpdate(dt: number): void {
    if (!this._playing) return;

    this._shootCooldown = Math.max(0, this._shootCooldown - dt);

    // Update timer HUD
    const m = Math.floor(this._gameTimer / 60);
    const s = Math.floor(this._gameTimer % 60).toString().padStart(2, '0');
    this._timerText.text  = `${m}:${s}`;
    this._timerText.color = this._gameTimer <= 10 ? '#ff4444' : '#4dff88';

    // Move local player
    if (this._alive) {
      const dx = (this._keys.right ? 1 : 0) - (this._keys.left ? 1 : 0);
      const dy = (this._keys.down  ? 1 : 0) - (this._keys.up   ? 1 : 0);

      if (dx !== 0 || dy !== 0) {
        const len  = Math.sqrt(dx * dx + dy * dy);
        const nx   = this._localPlayer.x + (dx / len) * PLAYER_SPEED * dt;
        const ny   = this._localPlayer.y + (dy / len) * PLAYER_SPEED * dt;
        if (!isCircleInWallX(nx, this._localPlayer.y, PLAYER_RADIUS)) this._localPlayer.x = nx;
        if (!isCircleInWallY(this._localPlayer.x, ny, PLAYER_RADIUS)) this._localPlayer.y = ny;
      }

      // Face mouse cursor
      const dx2 = this._mouseX - this._localPlayer.x;
      const dy2 = this._mouseY - this._localPlayer.y;
      this._localPlayer.angle = Math.atan2(dy2, dx2);
      this._localPlayer.syncLocal();

      // Check ammo pickup proximity
      this._pickups.forEach((pk) => {
        if (!pk.active) return;
        const dist = Math.hypot(this._localPlayer.x - pk.x, this._localPlayer.y - pk.y);
        if (dist < PICKUP_CHECK_RADIUS) {
          this._client.sendPickup(pk.pickupId);
        }
      });

      // Send position to server
      this._sendTimer += dt;
      if (this._sendTimer >= 1 / SEND_HZ) {
        this._sendTimer = 0;
        this._client.sendMove(this._localPlayer.x, this._localPlayer.y, this._localPlayer.angle);
      }
    }

    // Update respawn countdown
    if (!this._alive && this._respawnAt > 0) {
      const secLeft = (this._respawnAt - Date.now()) / 1000;
      this._respawnCountText.text = Math.ceil(Math.max(0, secLeft)).toString();
    }

    // Update remote players
    this._remotePlayers.forEach((rp) => rp.updateRemote(dt));

    // Update bullets
    this._bullets.forEach((b, id) => {
      if (!b.update(dt)) {
        this._world.remove(b);
        this._bullets.delete(id);
      }
    });

    // Update pickups
    this._pickups.forEach((pk) => pk.update(dt));
  }

  private _tryShoot(): void {
    if (!this._alive || this._myAmmo <= 0 || this._shootCooldown > 0) return;
    this._shootCooldown = 0.15;
    const dx = this._mouseX - this._localPlayer.x;
    const dy = this._mouseY - this._localPlayer.y;
    const angle = Math.atan2(dy, dx);
    this._client.sendShoot(angle);
  }

  private _showFeed(msg: string): void {
    this._feedText.text = msg;
    if (this._feedTimeout) clearTimeout(this._feedTimeout);
    this._feedTimeout = setTimeout(() => { this._feedText.text = ''; }, 3000);
  }
}
