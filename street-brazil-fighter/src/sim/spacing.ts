/**
 * Spacing rules applied after both fighters moved: pushboxes (grounded
 * fighters never overlap), stage walls, the maximum separation and facing.
 */

import { MAX_SEPARATION, MAX_X, MIN_X, PUSHBOX_WIDTH } from './constants';
import { isAirborne } from './geometry';
import type { Facing, FighterState, FighterStateName } from './types';

type Pair = readonly [FighterState, FighterState];

export function clampX(x: number): number {
  return Math.min(MAX_X, Math.max(MIN_X, x));
}

/**
 * Pushes overlapping grounded fighters apart, half each. When one of them is
 * against a wall the other takes the whole push. Airborne fighters have no
 * pushbox so a jump can cross over; the overlap is resolved when they land
 * (each fighter keeps the side its x is on).
 */
export function resolvePushboxes(pair: Pair): Pair {
  const [a, b] = pair;
  if (isAirborne(a) || isAirborne(b)) return pair;
  const dx = b.x - a.x;
  const overlap = PUSHBOX_WIDTH - Math.abs(dx);
  if (overlap <= 0) return pair;
  const sign = dx > 0 ? 1 : dx < 0 ? -1 : a.facing;
  let ax = clampX(a.x - (sign * overlap) / 2);
  let bx = clampX(b.x + (sign * overlap) / 2);
  if (Math.abs(bx - ax) < PUSHBOX_WIDTH) {
    const aAtWall = ax === MIN_X || ax === MAX_X;
    if (aAtWall) {
      bx = clampX(ax + sign * PUSHBOX_WIDTH);
    } else {
      ax = clampX(bx - sign * PUSHBOX_WIDTH);
    }
  }
  return [{ ...a, x: ax }, { ...b, x: bx }];
}

/**
 * Keeps the distance between the fighters at most MAX_SEPARATION. The excess
 * is given back by whoever moved away this frame, in proportion to how far each
 * one moved outward (split evenly if neither moved outward).
 */
export function enforceMaxSeparation(prev: Pair, pair: Pair): Pair {
  const [a, b] = pair;
  const dist = Math.abs(b.x - a.x);
  if (dist <= MAX_SEPARATION) return pair;
  const excess = dist - MAX_SEPARATION;
  const dirAB = b.x >= a.x ? 1 : -1;
  const outA = Math.max(0, -(a.x - prev[0].x) * dirAB);
  const outB = Math.max(0, (b.x - prev[1].x) * dirAB);
  const total = outA + outB;
  const shareA = total > 0 ? outA / total : 0.5;
  const ax = a.x + dirAB * excess * shareA;
  const bx = b.x - dirAB * excess * (1 - shareA);
  return [{ ...a, x: ax }, { ...b, x: bx }];
}

const TURNABLE: ReadonlySet<FighterStateName> = new Set<FighterStateName>([
  'idle',
  'walkForward',
  'walkBack',
  'crouch',
  'blockStand',
  'blockCrouch',
  'hitstun',
  'blockstun',
]);

/** Grounded fighters that are not attacking, down or posing always face the opponent. */
export function canTurn(f: FighterState): boolean {
  return TURNABLE.has(f.state) && !isAirborne(f);
}

function faceTowards(f: FighterState, targetX: number): FighterState {
  if (!canTurn(f) || targetX === f.x) return f;
  const facing: Facing = targetX > f.x ? 1 : -1;
  return facing === f.facing ? f : { ...f, facing };
}

export function updateFacing(pair: Pair): Pair {
  const [a, b] = pair;
  return [faceTowards(a, b.x), faceTowards(b, a.x)];
}

/** Full spacing pass: walls, pushboxes, max separation, facing. */
export function resolveSpacing(prev: Pair, pair: Pair): Pair {
  const walled: Pair = [{ ...pair[0], x: clampX(pair[0].x) }, { ...pair[1], x: clampX(pair[1].x) }];
  const pushed = resolvePushboxes(walled);
  const separated = enforceMaxSeparation(prev, pushed);
  const clamped: Pair = [{ ...separated[0], x: clampX(separated[0].x) }, { ...separated[1], x: clampX(separated[1].x) }];
  return updateFacing(clamped);
}
