import { WebSocket } from 'ws';
import { randomUUID } from 'crypto';
import { isWallAt } from '../game/ServerMap';

const PLAYER_COLORS = ['#ff4d4d', '#4d9fff', '#4dff88', '#ffb84d', '#cc66ff', '#4dffee'];
const MAX_HP = 3;
const MAX_AMMO = 8;
const AMMO_PICKUP_AMOUNT = 4;
const BULLET_SPEED = 400;
const BULLET_MAX_RANGE = 580;
const PLAYER_RADIUS = 14;
const BULLET_HIT_RADIUS = 18;
const PICKUP_RADIUS = 22;
const GAME_DURATION = 90;
const COUNTDOWN_SEC = 3;
const RESPAWN_SEC = 3000;
const BROADCAST_HZ = 20;
const PHYSICS_HZ = 30;

const SPAWN_POINTS = [
  { x: 60, y: 60 }, { x: 740, y: 60 }, { x: 60, y: 540 }, { x: 740, y: 540 },
  { x: 140, y: 300 }, { x: 660, y: 300 },
];

const AMMO_CANDIDATE_POSITIONS = [
  { x: 180, y: 140 }, { x: 620, y: 140 }, { x: 340, y: 260 },
  { x: 460, y: 340 }, { x: 180, y: 460 }, { x: 620, y: 460 },
  { x: 400, y: 300 }, { x: 300, y: 200 }, { x: 500, y: 400 },
  { x: 260, y: 380 }, { x: 540, y: 220 }, { x: 380, y: 500 },
];

interface PlayerData {
  sessionId: string; playerName: string; color: string;
  x: number; y: number; angle: number;
  hp: number; ammo: number; kills: number; deaths: number;
  ready: boolean; alive: boolean; respawnAt: number;
  spawnIndex: number;
}

interface BulletData {
  id: string; ownerId: string;
  x: number; y: number; vx: number; vy: number;
  distanceTraveled: number;
}

interface PickupData {
  id: string; x: number; y: number; active: boolean;
}

export class MissionRoom {
  readonly id: string;
  private _players = new Map<string, PlayerData>();
  private _clients = new Map<string, WebSocket>();
  private _bullets: BulletData[] = [];
  private _pickups: PickupData[] = [];
  private _status: 'waiting' | 'countdown' | 'playing' | 'finished' = 'waiting';
  private _colorIdx = 0;
  private _spawnIdx = 0;
  private _gameTimer = GAME_DURATION;
  private _bcastTimer: ReturnType<typeof setInterval> | null = null;
  private _physicsTimer: ReturnType<typeof setInterval> | null = null;
  private _lastPhysicsTick = 0;

  constructor(id: string) {
    this.id = id;
    this._initPickups();
    this._bcastTimer = setInterval(() => {
      if (this._status === 'playing') this._broadcastState();
    }, 1000 / BROADCAST_HZ);
    this._physicsTimer = setInterval(() => {
      if (this._status === 'playing') this._physicsTick();
    }, 1000 / PHYSICS_HZ);
    this._lastPhysicsTick = Date.now();
  }

  get clientCount(): number { return this._clients.size; }
  get status(): string { return this._status; }

  addClient(ws: WebSocket, sessionId: string, playerName: string): void {
    const sp = SPAWN_POINTS[this._spawnIdx % SPAWN_POINTS.length]!;
    const player: PlayerData = {
      sessionId, playerName,
      color: PLAYER_COLORS[this._colorIdx % PLAYER_COLORS.length]!,
      x: sp.x, y: sp.y, angle: 0,
      hp: MAX_HP, ammo: MAX_AMMO, kills: 0, deaths: 0,
      ready: false, alive: true, respawnAt: 0,
      spawnIndex: this._spawnIdx % SPAWN_POINTS.length,
    };
    this._colorIdx++;
    this._spawnIdx++;
    this._players.set(sessionId, player);
    this._clients.set(sessionId, ws);

    const allPlayers: Record<string, unknown> = {};
    this._players.forEach((p, id) => { allPlayers[id] = this._serializePlayer(p); });

    this._send(ws, 'room:joined', {
      sessionId,
      roomState: {
        status: this._status,
        players: allPlayers,
        pickups: this._pickups,
      },
    });

    this._broadcastExcept(sessionId, 'player:joined', {
      sessionId, playerName: player.playerName, color: player.color,
      x: player.x, y: player.y,
    });
    console.log(`[Room ${this.id}] ${playerName} joined (${this._players.size})`);
  }

  removeClient(sessionId: string): void {
    this._players.delete(sessionId);
    this._clients.delete(sessionId);
    this._broadcast('player:left', { sessionId });
    console.log(`[Room ${this.id}] ${sessionId} left`);
    if (this._status === 'playing' && this._players.size < 1) this._endGame();
  }

  handleMessage(sessionId: string, type: string, data: Record<string, unknown>): void {
    if (type === 'ready')        { this._onReady(sessionId); return; }
    if (type === 'player:move')  { this._onPlayerMove(sessionId, data); return; }
    if (type === 'player:shoot') { this._onPlayerShoot(sessionId, data); return; }
    if (type === 'ammo:pickup')  { this._onAmmoPickup(sessionId, data); return; }
  }

  dispose(): void {
    if (this._bcastTimer) clearInterval(this._bcastTimer);
    if (this._physicsTimer) clearInterval(this._physicsTimer);
  }

  private _initPickups(): void {
    for (let i = 0; i < 6; i++) {
      const pos = AMMO_CANDIDATE_POSITIONS[i]!;
      this._pickups.push({ id: randomUUID().substring(0, 8), x: pos.x, y: pos.y, active: true });
    }
  }

  private _onReady(sid: string): void {
    const p = this._players.get(sid);
    if (!p || this._status !== 'waiting') return;
    p.ready = true;
    this._broadcast('player:ready', { sessionId: sid });
    const all = [...this._players.values()];
    if (all.length > 0 && all.every(p => p.ready)) this._startCountdown();
  }

  private _onPlayerMove(sid: string, data: Record<string, unknown>): void {
    if (this._status !== 'playing') return;
    const p = this._players.get(sid);
    if (!p || !p.alive) return;
    p.x = data.x as number;
    p.y = data.y as number;
    p.angle = data.angle as number;
  }

  private _onPlayerShoot(sid: string, data: Record<string, unknown>): void {
    if (this._status !== 'playing') return;
    const p = this._players.get(sid);
    if (!p || !p.alive || p.ammo <= 0) return;

    p.ammo--;
    const angle = data.angle as number;
    const bulletId = randomUUID().substring(0, 8);
    this._bullets.push({
      id: bulletId, ownerId: sid,
      x: p.x + Math.cos(angle) * (PLAYER_RADIUS + 6),
      y: p.y + Math.sin(angle) * (PLAYER_RADIUS + 6),
      vx: Math.cos(angle) * BULLET_SPEED,
      vy: Math.sin(angle) * BULLET_SPEED,
      distanceTraveled: 0,
    });

    this._broadcast('bullet:fired', {
      id: bulletId, ownerId: sid,
      x: p.x + Math.cos(angle) * (PLAYER_RADIUS + 6),
      y: p.y + Math.sin(angle) * (PLAYER_RADIUS + 6),
      angle,
    });
    this._sendTo(sid, 'ammo:update', { ammo: p.ammo });
  }

  private _onAmmoPickup(sid: string, data: Record<string, unknown>): void {
    const p = this._players.get(sid);
    if (!p || !p.alive) return;
    const pickupId = data.pickupId as string;
    const pickup = this._pickups.find(pk => pk.id === pickupId && pk.active);
    if (!pickup) return;

    const dist = Math.hypot(p.x - pickup.x, p.y - pickup.y);
    if (dist > PICKUP_RADIUS * 2) return;

    pickup.active = false;
    p.ammo = Math.min(MAX_AMMO, p.ammo + AMMO_PICKUP_AMOUNT);
    this._broadcast('pickup:taken', { pickupId, sessionId: sid });
    this._sendTo(sid, 'ammo:update', { ammo: p.ammo });

    if (this._pickups.every(pk => !pk.active)) this._respawnPickups();
  }

  private _respawnPickups(): void {
    const used = new Set(this._pickups.map(p => `${p.x},${p.y}`));
    const candidates = AMMO_CANDIDATE_POSITIONS.filter(c => !used.has(`${c.x},${c.y}`));
    const pool = candidates.length >= 6
      ? candidates.slice(0, 6)
      : [...AMMO_CANDIDATE_POSITIONS.slice(6), ...AMMO_CANDIDATE_POSITIONS.slice(0, 6)];

    this._pickups = pool.slice(0, 6).map(pos => ({
      id: randomUUID().substring(0, 8), x: pos.x, y: pos.y, active: true,
    }));
    this._broadcast('pickup:spawn', { pickups: this._pickups });
  }

  private _physicsTick(): void {
    const now = Date.now();
    const dt = Math.min((now - this._lastPhysicsTick) / 1000, 0.05);
    this._lastPhysicsTick = now;

    this._gameTimer -= dt;
    if (this._gameTimer <= 0) { this._endGame(); return; }

    // Respawn players
    const nowMs = Date.now();
    this._players.forEach(p => {
      if (!p.alive && p.respawnAt > 0 && nowMs >= p.respawnAt) {
        const sp = SPAWN_POINTS[p.spawnIndex]!;
        p.x = sp.x; p.y = sp.y;
        p.hp = MAX_HP; p.ammo = MAX_AMMO;
        p.alive = true; p.respawnAt = 0;
        this._broadcast('player:respawn', {
          sessionId: p.sessionId, x: p.x, y: p.y, hp: p.hp, ammo: p.ammo,
        });
      }
    });

    // Move bullets + collision detection
    const toRemove: string[] = [];
    for (const b of this._bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.distanceTraveled += BULLET_SPEED * dt;

      if (b.distanceTraveled > BULLET_MAX_RANGE || isWallAt(b.x, b.y)) {
        toRemove.push(b.id);
        this._broadcast('bullet:destroyed', { id: b.id, x: b.x, y: b.y });
        continue;
      }

      let hit = false;
      this._players.forEach(p => {
        if (hit || p.sessionId === b.ownerId || !p.alive) return;
        const dist = Math.hypot(p.x - b.x, p.y - b.y);
        if (dist < BULLET_HIT_RADIUS) {
          hit = true;
          p.hp--;
          toRemove.push(b.id);
          this._broadcast('player:hit', {
            sessionId: p.sessionId, attackerId: b.ownerId,
            hp: p.hp, x: b.x, y: b.y,
          });
          if (p.hp <= 0) this._killPlayer(p, b.ownerId);
        }
      });
    }
    this._bullets = this._bullets.filter(b => !toRemove.includes(b.id));
  }

  private _killPlayer(p: PlayerData, killerId: string): void {
    p.alive = false; p.deaths++;
    const killer = this._players.get(killerId);
    if (killer) killer.kills++;
    p.respawnAt = Date.now() + RESPAWN_SEC;

    this._broadcast('player:dead', {
      sessionId: p.sessionId, killerId,
      killerName: killer?.playerName ?? '?',
      respawnIn: RESPAWN_SEC,
    });

    const scores: Record<string, unknown> = {};
    this._players.forEach(pl => { scores[pl.sessionId] = { kills: pl.kills, deaths: pl.deaths }; });
    this._broadcast('scores:update', { scores });
  }

  private _startCountdown(): void {
    this._status = 'countdown';
    let n = COUNTDOWN_SEC;
    this._broadcast('game:countdown', { seconds: n });
    const t = setInterval(() => {
      n--;
      this._broadcast('game:countdown', { seconds: n });
      if (n <= 0) { clearInterval(t); this._startGame(); }
    }, 1000);
  }

  private _startGame(): void {
    this._status = 'playing';
    this._gameTimer = GAME_DURATION;
    this._lastPhysicsTick = Date.now();
    this._broadcast('game:start', { duration: GAME_DURATION });
    console.log(`[Room ${this.id}] game started`);
  }

  private _endGame(): void {
    if (this._status === 'finished') return;
    this._status = 'finished';
    const results = [...this._players.values()]
      .sort((a, b) => b.kills - a.kills || a.deaths - b.deaths)
      .map(p => ({
        sessionId: p.sessionId, playerName: p.playerName, color: p.color,
        kills: p.kills, deaths: p.deaths,
      }));
    this._broadcast('game:end', { results });
    console.log(`[Room ${this.id}] game ended`);
    setTimeout(() => this._reset(), 10_000);
  }

  private _reset(): void {
    this._status = 'waiting';
    this._gameTimer = GAME_DURATION;
    this._bullets = [];
    let si = 0;
    this._players.forEach(p => {
      const sp = SPAWN_POINTS[si % SPAWN_POINTS.length]!;
      p.x = sp.x; p.y = sp.y; p.angle = 0;
      p.hp = MAX_HP; p.ammo = MAX_AMMO;
      p.kills = 0; p.deaths = 0;
      p.ready = false; p.alive = true; p.respawnAt = 0;
      p.spawnIndex = si % SPAWN_POINTS.length;
      si++;
    });
    this._initPickups();
    this._broadcast('game:reset', {});
  }

  private _broadcastState(): void {
    const players: Record<string, unknown> = {};
    this._players.forEach(p => { players[p.sessionId] = { x: p.x, y: p.y, angle: p.angle, alive: p.alive }; });
    this._broadcast('state:sync', { players, timer: Math.ceil(this._gameTimer), timestamp: Date.now() });
  }

  private _serializePlayer(p: PlayerData): unknown {
    return {
      sessionId: p.sessionId, playerName: p.playerName, color: p.color,
      x: p.x, y: p.y, angle: p.angle,
      hp: p.hp, ammo: p.ammo, kills: p.kills, deaths: p.deaths,
      ready: p.ready, alive: p.alive, spawnIndex: p.spawnIndex,
    };
  }

  private _broadcast(type: string, data: unknown): void {
    const msg = JSON.stringify({ type, data });
    this._clients.forEach(ws => { if (ws.readyState === 1) ws.send(msg); });
  }

  private _broadcastExcept(excludeSid: string, type: string, data: unknown): void {
    const msg = JSON.stringify({ type, data });
    this._clients.forEach((ws, sid) => {
      if (sid !== excludeSid && ws.readyState === 1) ws.send(msg);
    });
  }

  private _sendTo(sid: string, type: string, data: unknown): void {
    const ws = this._clients.get(sid);
    if (ws?.readyState === 1) ws.send(JSON.stringify({ type, data }));
  }

  private _send(ws: WebSocket, type: string, data: unknown): void {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type, data }));
  }
}
