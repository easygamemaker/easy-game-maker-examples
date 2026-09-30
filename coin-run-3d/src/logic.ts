/**
 * Pure rules of Coin Run: no three.js, no DOM. The scene reads these functions,
 * which is what lets the unit tests run in plain Node.
 */

export const ROUND_SECONDS = 45;
export const ISLAND_RADIUS = 15;
/** How far from the centre the hero may walk (trees and rocks sit on the rim). */
export const WALK_RADIUS = ISLAND_RADIUS - 2.2;
/** Coins are placed a little inside the walkable disc. */
export const COIN_RADIUS = WALK_RADIUS - 1.5;
export const COIN_COUNT = 10;
/** Picking coins closer together than this keeps the streak alive. */
export const STREAK_WINDOW = 2;
export const MAX_STREAK = 5;
export const BASE_COIN_POINTS = 10;
export const STREAK_BONUS = 5;
export const LOW_TIME_SECONDS = 5;

export interface Vec2 {
  readonly x: number;
  readonly z: number;
}

export type RoundStatus = 'ready' | 'playing' | 'over';

export interface Round {
  readonly status: RoundStatus;
  readonly timeLeft: number;
  readonly score: number;
  readonly streak: number;
  /** Seconds since the last coin, or since the round began. */
  readonly sinceLast: number;
  readonly collected: number;
}

/** Small seeded random source (mulberry32), so a layout can be replayed in a test. */
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

export function newRound(duration: number = ROUND_SECONDS): Round {
  return { status: 'ready', timeLeft: duration, score: 0, streak: 0, sinceLast: 0, collected: 0 };
}

export function startRound(round: Round): Round {
  return { ...round, status: 'playing' };
}

/** Advances the clock. The streak breaks when too long passes between coins. */
export function tickRound(round: Round, dt: number): Round {
  if (round.status !== 'playing') return round;
  const timeLeft = Math.max(0, round.timeLeft - dt);
  const sinceLast = round.sinceLast + dt;
  const streak = sinceLast > STREAK_WINDOW ? 0 : round.streak;
  return { ...round, timeLeft, sinceLast, streak, status: timeLeft <= 0 ? 'over' : 'playing' };
}

/** What the next coin is worth given the streak it would extend. */
export function coinValue(streak: number): number {
  const level = Math.min(Math.max(streak, 1), MAX_STREAK);
  return BASE_COIN_POINTS + STREAK_BONUS * (level - 1);
}

export interface Pickup {
  readonly round: Round;
  readonly points: number;
}

export function collectCoin(round: Round): Pickup {
  if (round.status !== 'playing') return { round, points: 0 };
  const streak = round.sinceLast <= STREAK_WINDOW ? round.streak + 1 : 1;
  const points = coinValue(streak);
  return {
    round: { ...round, streak, sinceLast: 0, score: round.score + points, collected: round.collected + 1 },
    points,
  };
}

/** Keeps a point inside a disc centred on the origin. */
export function clampToDisc(p: Vec2, radius: number): Vec2 {
  const d = Math.hypot(p.x, p.z);
  if (d <= radius || d === 0) return p;
  const k = radius / d;
  return { x: p.x * k, z: p.z * k };
}

/** A random spot inside the coin disc that stays clear of `avoid`. Falls back to the best try. */
export function pickCoinSpot(rng: () => number, avoid: readonly Vec2[], minGap = 3, radius = COIN_RADIUS): Vec2 {
  let best: Vec2 = { x: 0, z: 0 };
  let bestGap = -1;
  for (let i = 0; i < 24; i += 1) {
    const angle = rng() * Math.PI * 2;
    const dist = Math.sqrt(rng()) * radius;
    const spot = { x: Math.cos(angle) * dist, z: Math.sin(angle) * dist };
    const gap = avoid.reduce((m, a) => Math.min(m, Math.hypot(a.x - spot.x, a.z - spot.z)), Infinity);
    if (gap >= minGap) return spot;
    if (gap > bestGap) {
      best = spot;
      bestGap = gap;
    }
  }
  return best;
}

export function rankFor(score: number): 'Bronze' | 'Silver' | 'Gold' | 'Champion' {
  if (score >= 700) return 'Champion';
  if (score >= 400) return 'Gold';
  if (score >= 200) return 'Silver';
  return 'Bronze';
}

/** Seconds as `m:ss`, rounding up so the clock reads 0:01 until the very end. */
export function clock(seconds: number): string {
  const whole = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(whole / 60);
  const s = whole % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
