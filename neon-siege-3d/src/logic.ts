/**
 * Pure rules of Neon Siege 3D: weapon, player health, the wave director, drone steering,
 * enemy bolts and pickups. No three.js and no DOM, so the unit tests run in plain Node.
 * Every function returns a new value; nothing here mutates its arguments.
 */

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** A block in the arena, as plain numbers: bolts stop on it and drones fly around it. */
export interface Cover {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly height: number;
}

export const ARENA_SIZE = 44;
export const ARENA_LIMIT = ARENA_SIZE / 2 - 1.5;
export const PLAYER_MAX_HEALTH = 100;
export const PLAYER_RADIUS = 0.55;
export const PLAYER_EYE = 1.7;
export const HIT_GRACE_SECONDS = 0.35;

export const MAG_SIZE = 30;
export const START_RESERVE = 90;
export const MAX_RESERVE = 150;
export const RELOAD_SECONDS = 1.35;
export const FIRE_INTERVAL = 0.11;
export const RIFLE_DAMAGE = 20;

export const FIRST_BREAK = 3;
export const WAVE_BREAK = 4.5;
export const TELEGRAPH_SECONDS = 0.5;
export const BOLT_RADIUS = 0.25;
export const BOLT_LIFETIME = 4;
export const PICKUP_LIFETIME = 20;
export const PICKUP_RADIUS = 1.7;
export const HEALTH_PICKUP = 35;
export const AMMO_PICKUP = 30;

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

export const distance2D = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);

/** Seeded random source (mulberry32): the same seed replays the same run. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- Weapon: magazine and reload -------------------------------------------------------

export interface Weapon {
  readonly mag: number;
  readonly reserve: number;
  /** Seconds until the reload in progress finishes, 0 when not reloading. */
  readonly reloadLeft: number;
}

export const newWeapon = (): Weapon => ({ mag: MAG_SIZE, reserve: START_RESERVE, reloadLeft: 0 });

export const canShoot = (w: Weapon): boolean => w.mag > 0 && w.reloadLeft <= 0;

export const shoot = (w: Weapon): Weapon => (canShoot(w) ? { ...w, mag: w.mag - 1 } : w);

export const canReload = (w: Weapon): boolean => w.reloadLeft <= 0 && w.mag < MAG_SIZE && w.reserve > 0;

export const startReload = (w: Weapon): Weapon => (canReload(w) ? { ...w, reloadLeft: RELOAD_SECONDS } : w);

/** Advances a reload; when it completes the magazine is topped up from the reserve. */
export function tickWeapon(w: Weapon, dt: number): Weapon {
  if (w.reloadLeft <= 0) return w;
  const left = w.reloadLeft - dt;
  if (left > 0) return { ...w, reloadLeft: left };
  const take = Math.min(MAG_SIZE - w.mag, w.reserve);
  return { mag: w.mag + take, reserve: w.reserve - take, reloadLeft: 0 };
}

export const addAmmo = (w: Weapon, amount: number): Weapon => ({ ...w, reserve: Math.min(MAX_RESERVE, w.reserve + amount) });

/** True when there is nothing left to shoot and nothing to reload with. */
export const isDry = (w: Weapon): boolean => w.mag <= 0 && w.reserve <= 0 && w.reloadLeft <= 0;

// --- Player health ----------------------------------------------------------------------

export interface Player {
  readonly health: number;
  /** Seconds of protection left after a hit, so a burst of bolts cannot erase the bar. */
  readonly grace: number;
}

export const newPlayer = (): Player => ({ health: PLAYER_MAX_HEALTH, grace: 0 });

export const isDead = (p: Player): boolean => p.health <= 0;

export function damagePlayer(p: Player, amount: number): Player {
  if (isDead(p) || p.grace > 0 || amount <= 0) return p;
  return { health: Math.max(0, p.health - amount), grace: HIT_GRACE_SECONDS };
}

export const healPlayer = (p: Player, amount: number): Player =>
  isDead(p) ? p : { ...p, health: Math.min(PLAYER_MAX_HEALTH, p.health + amount) };

export const tickPlayer = (p: Player, dt: number): Player => (p.grace > 0 ? { ...p, grace: Math.max(0, p.grace - dt) } : p);

// --- Waves ------------------------------------------------------------------------------

export interface WaveConfig {
  readonly count: number;
  readonly hp: number;
  readonly speed: number;
  readonly fireInterval: number;
  readonly boltSpeed: number;
  readonly boltDamage: number;
  readonly maxAlive: number;
  readonly spawnInterval: number;
}

/**
 * How hard a wave is. `level` (0..1) is the engine's `createDifficulty` curve over the run
 * time, so a wave that drags on gets meaner on top of the wave number.
 */
export function waveConfig(wave: number, level = 0): WaveConfig {
  const w = Math.max(1, wave);
  return {
    count: Math.min(30, 3 + 2 * w),
    hp: 40 + 10 * Math.floor((w - 1) / 2) * 2,
    speed: 3 + Math.min(3.2, 0.25 * w + 1.2 * level),
    fireInterval: Math.max(1.05, 3.1 - 0.16 * w - 0.7 * level),
    boltSpeed: 15 + Math.min(9, 0.6 * w),
    boltDamage: 8 + Math.min(10, Math.floor(w / 2)),
    maxAlive: Math.min(9, 3 + Math.ceil(w / 2)),
    spawnInterval: Math.max(0.7, 2.2 - 0.12 * w),
  };
}

export type WavePhase = 'break' | 'active';
export type WaveEvent = 'started' | 'cleared' | null;

export interface Waves {
  readonly wave: number;
  readonly phase: WavePhase;
  readonly breakLeft: number;
  readonly toSpawn: number;
  readonly spawnTimer: number;
}

export const newWaves = (): Waves => ({ wave: 0, phase: 'break', breakLeft: FIRST_BREAK, toSpawn: 0, spawnTimer: 0 });

export interface WaveTick {
  readonly waves: Waves;
  /** Drones to add this frame (0 or 1). */
  readonly spawn: number;
  readonly event: WaveEvent;
}

/** The director: counts down the break, releases the wave one drone at a time, and notices when it is cleared. */
export function tickWaves(waves: Waves, dt: number, alive: number, level = 0): WaveTick {
  if (waves.phase === 'break') {
    const left = waves.breakLeft - dt;
    if (left > 0) return { waves: { ...waves, breakLeft: left }, spawn: 0, event: null };
    const wave = waves.wave + 1;
    const cfg = waveConfig(wave, level);
    return { waves: { wave, phase: 'active', breakLeft: 0, toSpawn: cfg.count, spawnTimer: 0 }, spawn: 0, event: 'started' };
  }
  if (waves.toSpawn === 0 && alive === 0) {
    return { waves: { ...waves, phase: 'break', breakLeft: WAVE_BREAK, spawnTimer: 0 }, spawn: 0, event: 'cleared' };
  }
  const timer = waves.spawnTimer - dt;
  const cfg = waveConfig(waves.wave, level);
  if (waves.toSpawn > 0 && alive < cfg.maxAlive && timer <= 0) {
    return { waves: { ...waves, toSpawn: waves.toSpawn - 1, spawnTimer: cfg.spawnInterval }, spawn: 1, event: null };
  }
  return { waves: { ...waves, spawnTimer: Math.max(0, timer) }, spawn: 0, event: null };
}

// --- Score ------------------------------------------------------------------------------

export interface Run {
  readonly kills: number;
  readonly score: number;
  readonly shots: number;
  readonly hits: number;
}

export const newRun = (): Run => ({ kills: 0, score: 0, shots: 0, hits: 0 });

export const killPoints = (wave: number): number => 100 + 10 * Math.max(1, wave);

export const registerShot = (r: Run, hit: boolean): Run => ({ ...r, shots: r.shots + 1, hits: r.hits + (hit ? 1 : 0) });

export const registerKill = (r: Run, wave: number): Run => ({ ...r, kills: r.kills + 1, score: r.score + killPoints(wave) });

export const accuracy = (r: Run): number => (r.shots === 0 ? 0 : Math.round((r.hits / r.shots) * 100));

// --- Drones -----------------------------------------------------------------------------

export interface Drone {
  readonly id: number;
  readonly pos: Vec3;
  readonly vel: Vec3;
  readonly hp: number;
  readonly maxHp: number;
  readonly hover: number;
  readonly phase: number;
  readonly fireTimer: number;
  /** True in the last moments before a shot, so the drone can glow and the player can react. */
  readonly telegraph: boolean;
}

/** Where a new drone appears: on a ring near the arena wall, away from the player. */
export function spawnPoint(rng: () => number, player: Vec3): Vec3 {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const angle = rng() * Math.PI * 2;
    const radius = ARENA_LIMIT - 1 + rng();
    const point = { x: Math.cos(angle) * radius, y: 2 + rng() * 2, z: Math.sin(angle) * radius };
    if (distance2D(point, player) >= 14) return point;
  }
  return { x: -player.x, y: 3, z: -player.z };
}

export function newDrone(id: number, pos: Vec3, cfg: WaveConfig, rng: () => number): Drone {
  return {
    id,
    pos,
    vel: { x: 0, y: 0, z: 0 },
    hp: cfg.hp,
    maxHp: cfg.hp,
    hover: 1.9 + rng() * 1.5,
    phase: rng() * Math.PI * 2,
    fireTimer: cfg.fireInterval * (0.7 + rng() * 0.8),
    telegraph: false,
  };
}

export interface DroneStep {
  readonly drone: Drone;
  readonly fire: boolean;
}

const PREFERRED_RANGE = 10;
const COVER_CLEARANCE = 1;

/** Moves a point that ended up inside (or too near) a cover block out through the nearest side. */
export function pushOutOfCover(pos: Vec3, covers: readonly Cover[]): Vec3 {
  let out = pos;
  for (const c of covers) {
    if (out.y > c.height + 0.6) continue;
    const minX = c.minX - COVER_CLEARANCE;
    const maxX = c.maxX + COVER_CLEARANCE;
    const minZ = c.minZ - COVER_CLEARANCE;
    const maxZ = c.maxZ + COVER_CLEARANCE;
    if (out.x <= minX || out.x >= maxX || out.z <= minZ || out.z >= maxZ) continue;
    const exits = [
      { d: out.x - minX, x: minX, z: out.z },
      { d: maxX - out.x, x: maxX, z: out.z },
      { d: out.z - minZ, x: out.x, z: minZ },
      { d: maxZ - out.z, x: out.x, z: maxZ },
    ];
    const nearest = exits.reduce((best, e) => (e.d < best.d ? e : best));
    out = { x: clamp(nearest.x, -ARENA_LIMIT, ARENA_LIMIT), y: out.y, z: clamp(nearest.z, -ARENA_LIMIT, ARENA_LIMIT) };
  }
  return out;
}

/**
 * Approach to shooting range, circle-strafe, keep clear of other drones, bob in the air and
 * count down to the next shot. Velocity is smoothed, so a drone banks instead of snapping.
 */
export function stepDrone(drone: Drone, player: Vec3, others: readonly Vec3[], dt: number, cfg: WaveConfig, elapsed: number, covers: readonly Cover[] = []): DroneStep {
  const dx = player.x - drone.pos.x;
  const dz = player.z - drone.pos.z;
  const dist = Math.max(0.001, Math.hypot(dx, dz));
  const inX = dx / dist;
  const inZ = dz / dist;
  const radial = clamp((dist - PREFERRED_RANGE) / 4, -1, 1);
  const strafe = Math.sin(elapsed * 0.7 + drone.phase) * 0.6;

  let wantX = (inX * radial - inZ * strafe) * cfg.speed;
  let wantZ = (inZ * radial + inX * strafe) * cfg.speed;
  for (const other of others) {
    const ox = drone.pos.x - other.x;
    const oz = drone.pos.z - other.z;
    const gap = Math.hypot(ox, oz);
    if (gap > 0.001 && gap < 3) {
      const push = ((3 - gap) / 3) * cfg.speed;
      wantX += (ox / gap) * push;
      wantZ += (oz / gap) * push;
    }
  }
  const targetY = drone.hover + Math.sin(elapsed * 1.3 + drone.phase) * 0.45;
  const wantY = (targetY - drone.pos.y) * 2;

  const blend = 1 - Math.exp(-3 * dt);
  const vel = {
    x: drone.vel.x + (wantX - drone.vel.x) * blend,
    y: drone.vel.y + (wantY - drone.vel.y) * blend,
    z: drone.vel.z + (wantZ - drone.vel.z) * blend,
  };
  const pos = pushOutOfCover(
    {
      x: clamp(drone.pos.x + vel.x * dt, -ARENA_LIMIT, ARENA_LIMIT),
      y: clamp(drone.pos.y + vel.y * dt, 1.2, 5),
      z: clamp(drone.pos.z + vel.z * dt, -ARENA_LIMIT, ARENA_LIMIT),
    },
    covers,
  );

  const timer = drone.fireTimer - dt;
  if (timer <= 0) {
    const jitter = 0.85 + ((drone.id * 0.618) % 1) * 0.3;
    return { drone: { ...drone, pos, vel, fireTimer: cfg.fireInterval * jitter, telegraph: false }, fire: true };
  }
  return { drone: { ...drone, pos, vel, fireTimer: timer, telegraph: timer < TELEGRAPH_SECONDS }, fire: false };
}

export interface HurtResult {
  readonly drone: Drone;
  readonly killed: boolean;
}

export function hurtDrone(drone: Drone, damage: number): HurtResult {
  const hp = Math.max(0, drone.hp - damage);
  return { drone: { ...drone, hp }, killed: hp === 0 };
}

// --- Bolts (drone shots) ----------------------------------------------------------------

export interface Bolt {
  readonly id: number;
  readonly pos: Vec3;
  readonly vel: Vec3;
  readonly life: number;
  readonly damage: number;
}

/** A bolt from a drone toward the player's chest, with a little spread so it can be dodged. */
export function newBolt(id: number, from: Vec3, playerEye: Vec3, cfg: WaveConfig, rng: () => number): Bolt {
  const target = { x: playerEye.x + (rng() - 0.5) * 1.6, y: playerEye.y - 0.5 + (rng() - 0.5) * 0.8, z: playerEye.z + (rng() - 0.5) * 1.6 };
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  const dz = target.z - from.z;
  const len = Math.max(0.001, Math.hypot(dx, dy, dz));
  const k = cfg.boltSpeed / len;
  return { id, pos: from, vel: { x: dx * k, y: dy * k, z: dz * k }, life: BOLT_LIFETIME, damage: cfg.boltDamage };
}

export function stepBolt(b: Bolt, dt: number): Bolt {
  return {
    ...b,
    pos: { x: b.pos.x + b.vel.x * dt, y: b.pos.y + b.vel.y * dt, z: b.pos.z + b.vel.z * dt },
    life: b.life - dt,
  };
}

/** The player is a vertical capsule hanging from the eye: 1.7 m below it, 0.2 m above. */
export function boltHitsPlayer(b: Bolt, playerEye: Vec3): boolean {
  const horizontal = Math.hypot(b.pos.x - playerEye.x, b.pos.z - playerEye.z);
  return horizontal < PLAYER_RADIUS + BOLT_RADIUS && b.pos.y < playerEye.y + 0.2 && b.pos.y > playerEye.y - PLAYER_EYE;
}

/** A bolt dies on cover, on the floor and at the arena wall. */
export function boltBlocked(b: Bolt, covers: readonly Cover[]): boolean {
  const { x, y, z } = b.pos;
  if (y <= 0.05 || Math.abs(x) > ARENA_SIZE / 2 || Math.abs(z) > ARENA_SIZE / 2) return true;
  return covers.some((c) => y < c.height && x > c.minX && x < c.maxX && z > c.minZ && z < c.maxZ);
}

export const boltExpired = (b: Bolt): boolean => b.life <= 0;

// --- Pickups ----------------------------------------------------------------------------

export type PickupKind = 'health' | 'ammo';

export interface Pickup {
  readonly id: number;
  readonly kind: PickupKind;
  readonly pos: Vec3;
  readonly life: number;
}

/** What a destroyed drone leaves behind: more often what the player needs most. */
export function rollDrop(rng: () => number, p: Player, w: Weapon): PickupKind | null {
  const hurt = 1 - p.health / PLAYER_MAX_HEALTH;
  const low = 1 - Math.min(1, (w.mag + w.reserve) / (MAG_SIZE + START_RESERVE));
  const roll = rng();
  if (roll < 0.1 + 0.3 * hurt) return 'health';
  if (roll < 0.1 + 0.3 * hurt + 0.1 + 0.35 * low) return 'ammo';
  return null;
}

export function applyPickup(kind: PickupKind, p: Player, w: Weapon): { player: Player; weapon: Weapon } {
  return kind === 'health' ? { player: healPlayer(p, HEALTH_PICKUP), weapon: w } : { player: p, weapon: addAmmo(w, AMMO_PICKUP) };
}

export const pickupInReach = (pickup: Pickup, playerEye: Vec3): boolean => distance2D(pickup.pos, playerEye) < PICKUP_RADIUS;

/** Yaw and pitch (radians) that point the camera at a target, in the engine's convention (-Z forward, y up). */
export function aimAngles(from: Vec3, to: Vec3): { yaw: number; pitch: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  return { yaw: Math.atan2(-dx, -dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)) };
}
