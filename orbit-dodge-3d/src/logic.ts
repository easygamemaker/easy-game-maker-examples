/**
 * Pure rules of Orbit Dodge: lanes, obstacle rows, speed curve, lives and score.
 * No three.js and no DOM, so the unit tests run in plain Node.
 */

export const LANE_COUNT = 5;
export const LANE_WIDTH = 2.6;
/** The ship may drift a little past the outer lane centres. */
export const SHIP_LIMIT = ((LANE_COUNT - 1) / 2) * LANE_WIDTH + 0.4;
export const SHIP_Z = 0;
export const SPAWN_Z = -95;
export const OBSTACLE_RADIUS = 1.05;
export const SHIP_RADIUS = 0.75;
export const START_LIVES = 3;
export const INVULNERABLE_SECONDS = 1.6;
export const MIN_SPEED = 16;
export const MAX_SPEED = 38;
export const RAMP_SECONDS = 70;
export const DODGE_POINTS = 10;

export interface Obstacle {
  readonly id: number;
  /** Obstacles spawned together share a row, and a row counts as one dodge. */
  readonly row: number;
  readonly lane: number;
  readonly z: number;
}

export type RunStatus = 'ready' | 'playing' | 'over';

export interface Run {
  readonly status: RunStatus;
  readonly lives: number;
  readonly elapsed: number;
  readonly distance: number;
  readonly dodged: number;
  readonly invulnerable: number;
}

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

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

export function laneX(lane: number): number {
  return (lane - (LANE_COUNT - 1) / 2) * LANE_WIDTH;
}

export function nearestLane(x: number): number {
  return clamp(Math.round(x / LANE_WIDTH + (LANE_COUNT - 1) / 2), 0, LANE_COUNT - 1);
}

/** 0 at the start of a run, 1 once fully ramped. */
export function difficultyAt(elapsed: number): number {
  return clamp(elapsed / RAMP_SECONDS, 0, 1) ** 0.8;
}

export function speedAt(elapsed: number): number {
  return MIN_SPEED + (MAX_SPEED - MIN_SPEED) * difficultyAt(elapsed);
}

/** Distance between two rows: it closes as the run gets harder, but stays fair. */
export function rowSpacing(elapsed: number): number {
  return 26 - 12 * difficultyAt(elapsed);
}

/** How many lanes a row may block: one at first, up to three late in a run. */
export function maxBlocked(elapsed: number): number {
  return 1 + Math.round(2 * difficultyAt(elapsed));
}

/**
 * Picks the blocked lanes of the next row. At least one lane stays open, and one of
 * the open lanes is never more than two lanes away from an open lane of the previous
 * row, so the ship always has time to get there.
 */
export function nextRow(rng: () => number, previousOpen: readonly number[], elapsed: number): number[] {
  const count = clamp(1 + Math.floor(rng() * maxBlocked(elapsed)), 1, LANE_COUNT - 1);
  const lanes = Array.from({ length: LANE_COUNT }, (_, i) => i);
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const shuffled = [...lanes].sort(() => rng() - 0.5);
    const blocked = shuffled.slice(0, count).sort((a, b) => a - b);
    const open = lanes.filter((l) => !blocked.includes(l));
    const reachable = previousOpen.length === 0 || open.some((o) => previousOpen.some((p) => Math.abs(o - p) <= 2));
    if (open.length > 0 && reachable) return blocked;
  }
  return [Math.floor(rng() * LANE_COUNT)];
}

export function openLanes(blocked: readonly number[]): number[] {
  return Array.from({ length: LANE_COUNT }, (_, i) => i).filter((l) => !blocked.includes(l));
}

export interface StepResult {
  readonly obstacles: Obstacle[];
  /** Obstacles that just went past the ship without a hit. */
  readonly passed: Obstacle[];
}

/** Moves every obstacle toward the ship and drops the ones behind it. */
export function stepObstacles(obstacles: readonly Obstacle[], dt: number, speed: number): StepResult {
  const moved = obstacles.map((o) => ({ ...o, z: o.z + speed * dt }));
  const passed = moved.filter((o) => o.z > SHIP_Z + 2.5 && obstacles.find((p) => p.id === o.id)!.z <= SHIP_Z + 2.5);
  return { obstacles: moved.filter((o) => o.z <= SHIP_Z + 6), passed };
}

/** The first obstacle touching the ship, if any. */
export function findHit(obstacles: readonly Obstacle[], shipX: number): Obstacle | undefined {
  const reach = OBSTACLE_RADIUS + SHIP_RADIUS;
  return obstacles.find((o) => Math.hypot(laneX(o.lane) - shipX, o.z - SHIP_Z) < reach);
}

export function newRun(): Run {
  return { status: 'ready', lives: START_LIVES, elapsed: 0, distance: 0, dodged: 0, invulnerable: 0 };
}

export function startRun(run: Run): Run {
  return { ...run, status: 'playing' };
}

export function tickRun(run: Run, dt: number): Run {
  if (run.status !== 'playing') return run;
  return {
    ...run,
    elapsed: run.elapsed + dt,
    distance: run.distance + speedAt(run.elapsed) * dt,
    invulnerable: Math.max(0, run.invulnerable - dt),
  };
}

export function registerDodges(run: Run, count: number): Run {
  return count > 0 ? { ...run, dodged: run.dodged + count } : run;
}

/** A collision costs a life unless the ship is still flashing from the last one. */
export function hitRun(run: Run): Run {
  if (run.status !== 'playing' || run.invulnerable > 0) return run;
  const lives = run.lives - 1;
  return { ...run, lives, invulnerable: INVULNERABLE_SECONDS, status: lives <= 0 ? 'over' : 'playing' };
}

export function scoreOf(run: Run): number {
  return Math.floor(run.distance / 2) + run.dodged * DODGE_POINTS;
}
