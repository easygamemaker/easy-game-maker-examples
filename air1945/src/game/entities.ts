import type { RectShape } from 'easy-game-maker';
import type { Group } from 'easy-game-maker';

export type EnemyType   = 'fighter' | 'bomber' | 'gunship';
export type PowerUpKind = 'double' | 'triple' | 'shield' | 'bomb';
export type WeaponType  = 'single' | 'double' | 'triple';

// ── Canvas constants ──────────────────────────────────────────────────────────
export const W  = 420;
export const H  = 680;
export const PH = H;   // play height (full canvas)

// ── Game constants ────────────────────────────────────────────────────────────
export const PLAYER_SPEED           = 290;
export const PLAYER_SHOOT_INTERVAL  = 0.15;   // seconds
export const PLAYER_INVINCIBLE_TIME = 2.2;
export const PLAYER_HITBOX_W        = 16;
export const PLAYER_HITBOX_H        = 16;

export const PLAYER_BULLET_SPEED = -560;
export const ENEMY_BULLET_SPEED  =  250;

export const BOSS_HP = 100;

export const SCORE_FIGHTER  = 100;
export const SCORE_BOMBER   = 300;
export const SCORE_GUNSHIP  = 600;
export const SCORE_BOSS     = 5000;
export const SCORE_POWERUP  =  50;

// ── Entity types ──────────────────────────────────────────────────────────────

export interface BulletEnt {
  active: boolean;
  x: number; y: number;
  vx: number; vy: number;
  damage: number;
  display: RectShape;
}

export interface EnemyEnt {
  active: boolean;
  type: EnemyType;
  x: number; y: number;
  baseX: number;           // for sine movement
  vx: number; vy: number;
  width: number; height: number;
  hp: number; maxHp: number;
  shootTimer: number;
  shootInterval: number;
  useSine: boolean;
  sineT: number;
  sineAmp: number;
  sineFreq: number;
  scoreValue: number;
  display: Group;
}

export interface PowerUpEnt {
  active: boolean;
  kind: PowerUpKind;
  x: number; y: number;
  vy: number;
  rotTimer: number;
  display: RectShape;
}

export interface ShardEnt {
  active: boolean;
  x: number; y: number;
  vx: number; vy: number;
  timer: number;
  maxTimer: number;
  display: RectShape;
}

export interface BossState {
  active: boolean;
  phase: number;        // 1, 2, 3
  x: number; y: number;
  targetX: number; targetY: number;
  width: number; height: number;
  hp: number; maxHp: number;
  shootTimer: number;
  shootPhase: number;   // sub-pattern counter
  moveTimer: number;
  display: Group | null;
  hpBarFill: RectShape | null;
}

export interface PlayerState {
  x: number; y: number;
  lives: number;
  bombs: number;
  weapon: WeaponType;
  weaponTimer: number;
  shield: boolean;
  invincible: boolean;
  invTimer: number;
  flashTimer: number;
  shootTimer: number;
  score: number;
  highScore: number;
  display: Group | null;
  shieldDisplay: RectShape | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function aabb(
  ax: number, ay: number, aw: number, ah: number,
  bx: number, by: number, bw: number, bh: number,
): boolean {
  return (
    Math.abs(ax - bx) < (aw + bw) / 2 &&
    Math.abs(ay - by) < (ah + bh) / 2
  );
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
