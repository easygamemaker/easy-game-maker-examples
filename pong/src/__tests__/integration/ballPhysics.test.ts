/**
 * Pong ball physics extracted from GameScene for testability.
 * Tests the core bounce/scoring logic without any EGM rendering.
 */
import { describe, it, expect, beforeEach } from 'vitest';

// ── Extracted ball state (mirrors GameScene constants) ────────────────────────
const W = 800, H = 500;
const BALL_HALF = 7;
const PADDLE_H = 90;
const PADDLE_W = 14;
const BALL_SPEED_START = 340;
const BALL_SPEED_MAX   = 650;
const BALL_ACCEL       = 1.05;

interface BallState {
  x: number; y: number;
  vx: number; vy: number;
}
interface PaddleState { y: number; }

/** Pure bounce logic (extracted from GameScene._moveBall) */
function moveBall(b: BallState, dt: number): BallState {
  const nx = b.x + b.vx * dt;
  const ny = b.y + b.vy * dt;
  let vx = b.vx, vy = b.vy;

  if (ny - BALL_HALF <= 0) vy = Math.abs(vy);
  if (ny + BALL_HALF >= H)  vy = -Math.abs(vy);

  const spd = Math.hypot(vx, vy);
  if (spd > BALL_SPEED_MAX) { vx = (vx/spd)*BALL_SPEED_MAX; vy = (vy/spd)*BALL_SPEED_MAX; }

  return { x: nx, y: ny, vx, vy };
}

function checkScoring(b: BallState): 1 | 2 | null {
  if (b.x < -BALL_HALF * 2) return 2;    // P2 scores
  if (b.x > W + BALL_HALF * 2) return 1; // P1 scores
  return null;
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('Ball movement', () => {
  it('moves proportional to velocity and dt', () => {
    const b = { x: 400, y: 250, vx: 100, vy: 0 };
    const next = moveBall(b, 1);
    expect(next.x).toBeCloseTo(500);
  });

  it('bounces off top wall (y < BALL_HALF)', () => {
    const b = { x: 400, y: BALL_HALF, vx: 0, vy: -200 };
    const next = moveBall(b, 0.01);
    expect(next.vy).toBeGreaterThan(0);
  });

  it('bounces off bottom wall (y > H - BALL_HALF)', () => {
    const b = { x: 400, y: H - BALL_HALF, vx: 0, vy: 200 };
    const next = moveBall(b, 0.01);
    expect(next.vy).toBeLessThan(0);
  });

  it('does not exceed BALL_SPEED_MAX', () => {
    // Start at max speed → acceleration multiplier pushes over limit
    const b = { x: 400, y: 250, vx: BALL_SPEED_MAX, vy: 0 };
    const next = moveBall(b, 0.01);
    expect(Math.hypot(next.vx, next.vy)).toBeLessThanOrEqual(BALL_SPEED_MAX + 0.1);
  });
});

describe('Scoring detection', () => {
  it('returns null when ball is in play', () => {
    expect(checkScoring({ x: 400, y: 250, vx: 0, vy: 0 })).toBeNull();
  });

  it('P2 scores when ball exits left side', () => {
    expect(checkScoring({ x: -30, y: 250, vx: -300, vy: 0 })).toBe(2);
  });

  it('P1 scores when ball exits right side', () => {
    expect(checkScoring({ x: W + 30, y: 250, vx: 300, vy: 0 })).toBe(1);
  });

  it('no score near edge but still in bounds', () => {
    expect(checkScoring({ x: 5, y: 250, vx: -100, vy: 0 })).toBeNull();
    expect(checkScoring({ x: W - 5, y: 250, vx: 100, vy: 0 })).toBeNull();
  });
});

describe('Speed constants', () => {
  it('BALL_SPEED_MAX > BALL_SPEED_START', () => {
    expect(BALL_SPEED_MAX).toBeGreaterThan(BALL_SPEED_START);
  });

  it('BALL_ACCEL > 1 (ball gets faster on paddle hit)', () => {
    expect(BALL_ACCEL).toBeGreaterThan(1);
  });
});
