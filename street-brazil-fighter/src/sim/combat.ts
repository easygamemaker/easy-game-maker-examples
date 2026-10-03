/**
 * Hit detection and resolution. All hits of a frame are detected against the
 * same pre-hit snapshot and then applied, so simultaneous hits trade.
 */

import { getCharacter } from '../data/characters';
import type { HitLevel, MoveData, MoveKey } from '../data/characters';
import {
  CHIP_RATIO,
  COMBO_SCALING_MIN,
  COMBO_SCALING_STEP,
  KNOCKDOWN_AIR_VX,
  KNOCKDOWN_POP_VY,
  MAX_X,
  METER_MAX,
  MIN_X,
  SLIDE_FRICTION,
} from './constants';
import { activeHitbox, boxesOverlap, hurtboxes, isAirborne, isHittable, overlapCenter, projectileBox } from './geometry';
import { horizontal } from './input';
import type { FighterState, FighterStateName, Projectile, SimEvent, Side } from './types';

type Pair = readonly [FighterState, FighterState];

export interface HitRecord {
  readonly attacker: Side;
  readonly defender: Side;
  readonly move: MoveData;
  readonly moveId: MoveKey;
  /** Direction the defender is pushed (+1 right, -1 left). */
  readonly pushDir: 1 | -1;
  readonly x: number;
  readonly y: number;
  readonly projectileId: number | null;
}

const BLOCKABLE_STATES: ReadonlySet<FighterStateName> = new Set<FighterStateName>([
  'idle',
  'walkForward',
  'walkBack',
  'crouch',
  'blockStand',
  'blockCrouch',
  'blockstun',
]);

/** Damage multiplier for the next hit of a combo that already has `hitsSoFar` hits. */
export function comboScale(hitsSoFar: number): number {
  return Math.max(COMBO_SCALING_MIN, 1 - COMBO_SCALING_STEP * hitsSoFar);
}

export function scaledDamage(base: number, hitsSoFar: number): number {
  return Math.max(1, Math.round(base * comboScale(hitsSoFar)));
}

export function chipDamage(move: MoveData): number {
  return move.special !== undefined ? Math.round(move.damage * CHIP_RATIO) : 0;
}

/**
 * Blocking: the defender must be grounded, in a neutral or guard state (not
 * attacking, not in hitstun, not jumping) and hold block or hold away from the
 * attack (pushDir). Height: low needs a crouch block, high needs a stand
 * block, mid accepts both. Crouching is read from the down input.
 */
export function blocks(defender: FighterState, pushDir: 1 | -1, level: HitLevel): boolean {
  if (!BLOCKABLE_STATES.has(defender.state) || isAirborne(defender)) return false;
  const inp = defender.lastInput;
  const holdingAway = horizontal(inp) === pushDir;
  if (!inp.block && !holdingAway) return false;
  const crouching = inp.down;
  if (level === 'low') return crouching;
  if (level === 'high') return !crouching;
  return true;
}

function sideOf(i: number): Side {
  return i === 0 ? 0 : 1;
}

/** Detects melee and projectile hits for this frame (nothing is applied yet). */
export function detectHits(fighters: Pair, projectiles: readonly Projectile[]): HitRecord[] {
  const hits: HitRecord[] = [];
  fighters.forEach((attacker, i) => {
    const defender = fighters[i === 0 ? 1 : 0];
    const hitbox = activeHitbox(attacker);
    if (hitbox === null || attacker.moveId === null || !isHittable(defender)) return;
    const hurt = hurtboxes(defender).find((h) => boxesOverlap(hitbox, h));
    if (hurt === undefined) return;
    const at = overlapCenter(hitbox, hurt);
    const dx = defender.x - attacker.x;
    hits.push({
      attacker: sideOf(i),
      defender: sideOf(1 - i),
      move: getCharacter(attacker.characterId).moves[attacker.moveId],
      moveId: attacker.moveId,
      pushDir: dx > 0 ? 1 : dx < 0 ? -1 : attacker.facing,
      x: at.x,
      y: at.y,
      projectileId: null,
    });
  });
  for (const p of projectiles) {
    const defender = fighters[p.owner === 0 ? 1 : 0];
    if (!isHittable(defender)) continue;
    const box = projectileBox(p);
    const hurt = hurtboxes(defender).find((h) => boxesOverlap(box, h));
    if (hurt === undefined) continue;
    const at = overlapCenter(box, hurt);
    hits.push({
      attacker: p.owner,
      defender: p.owner === 0 ? 1 : 0,
      move: getCharacter(p.characterId).moves.special,
      moveId: 'special',
      pushDir: p.vx >= 0 ? 1 : -1,
      x: at.x,
      y: at.y,
      projectileId: p.id,
    });
  }
  return hits;
}

function slideFor(distance: number, dir: 1 | -1): number {
  return dir * distance * (1 - SLIDE_FRICTION);
}

function clampMeter(value: number): number {
  return Math.min(METER_MAX, Math.max(0, value));
}

/** Distance the defender can still travel before reaching the wall it is pushed to. */
function roomToWall(defender: FighterState, dir: 1 | -1): number {
  return dir === 1 ? MAX_X - defender.x : defender.x - MIN_X;
}

function updateAttacker(attacker: FighterState, hit: HitRecord, blocked: boolean, defender: FighterState): FighterState {
  const gain = blocked ? Math.floor(hit.move.meterGain / 2) : hit.move.meterGain;
  const melee = hit.projectileId === null;
  const leftover = melee ? Math.max(0, hit.move.knockback - roomToWall(defender, hit.pushDir)) : 0;
  const self = melee && blocked ? (hit.move.selfPushback ?? 0) : 0;
  const push = leftover + self;
  return {
    ...attacker,
    meter: clampMeter(attacker.meter + gain),
    moveConnected: melee ? true : attacker.moveConnected,
    slideVx: push > 0 ? slideFor(push, hit.pushDir === 1 ? -1 : 1) : attacker.slideVx,
  };
}

interface DefenderResult {
  readonly fighter: FighterState;
  readonly events: SimEvent[];
}

function blockDefender(defender: FighterState, hit: HitRecord): DefenderResult {
  const chip = chipDamage(hit.move);
  const health = Math.max(0, defender.health - chip);
  const special = hit.move.special !== undefined;
  const events: SimEvent[] = [
    {
      type: 'block',
      attacker: hit.attacker,
      defender: hit.defender,
      moveId: hit.moveId,
      chip,
      x: hit.x,
      y: hit.y,
      special,
      projectile: hit.projectileId !== null,
    },
  ];
  const meter = clampMeter(defender.meter + Math.floor(hit.move.meterGainDefender / 2));
  if (health <= 0) {
    return koDefender({ ...defender, health: 0, meter }, hit, events);
  }
  const fighter: FighterState = {
    ...defender,
    health,
    meter,
    state: 'blockstun',
    stateFrame: 0,
    stunFrames: hit.move.blockstun,
    crouching: defender.lastInput.down,
    vx: 0,
    moveId: null,
    moveFrame: 0,
    movePhase: null,
    slideVx: slideFor(hit.move.knockback, hit.pushDir),
  };
  return { fighter, events };
}

function koDefender(defender: FighterState, hit: HitRecord, events: SimEvent[]): DefenderResult {
  const fighter: FighterState = {
    ...defender,
    state: 'ko',
    stateFrame: 0,
    vx: hit.pushDir * KNOCKDOWN_AIR_VX,
    vy: KNOCKDOWN_POP_VY,
    moveId: null,
    moveFrame: 0,
    movePhase: null,
    stunFrames: 0,
    slideVx: 0,
  };
  return { fighter, events: [...events, { type: 'ko', player: hit.defender, x: defender.x, y: defender.y }] };
}

function hitDefender(defender: FighterState, hit: HitRecord): DefenderResult {
  const damage = scaledDamage(hit.move.damage, defender.comboCount);
  const health = Math.max(0, defender.health - damage);
  const comboCount = defender.comboCount + 1;
  const knockdown = hit.move.knockdown || isAirborne(defender);
  const meter = clampMeter(defender.meter + hit.move.meterGainDefender);
  const events: SimEvent[] = [
    {
      type: 'hit',
      attacker: hit.attacker,
      defender: hit.defender,
      moveId: hit.moveId,
      damage,
      x: hit.x,
      y: hit.y,
      special: hit.move.special !== undefined,
      knockdown: knockdown || health <= 0,
      comboCount,
      projectile: hit.projectileId !== null,
    },
  ];
  const base: FighterState = { ...defender, health, comboCount, meter, moveId: null, moveFrame: 0, movePhase: null, moveConnected: false };
  if (health <= 0) return koDefender(base, hit, events);
  if (knockdown) {
    const fighter: FighterState = {
      ...base,
      state: 'knockdown',
      stateFrame: 0,
      vx: hit.pushDir * KNOCKDOWN_AIR_VX,
      vy: KNOCKDOWN_POP_VY,
      stunFrames: 0,
      slideVx: 0,
    };
    return { fighter, events: [...events, { type: 'knockdown', player: hit.defender, x: defender.x }] };
  }
  const fighter: FighterState = {
    ...base,
    state: 'hitstun',
    stateFrame: 0,
    stunFrames: hit.move.hitstun,
    crouching: defender.lastInput.down && !isAirborne(defender),
    vx: 0,
    slideVx: slideFor(hit.move.knockback, hit.pushDir),
  };
  return { fighter, events };
}

/**
 * Applies the detected hits. Blocking is decided against the defender state
 * before any hit of this frame; attackers are updated first so a trade leaves
 * both fighters hit.
 */
export function applyHits(fighters: Pair, projectiles: readonly Projectile[], hits: readonly HitRecord[]): {
  fighters: Pair;
  projectiles: Projectile[];
  events: SimEvent[];
} {
  if (hits.length === 0) return { fighters, projectiles: [...projectiles], events: [] };
  const original = fighters;
  const results = hits.map((hit) => ({ hit, blocked: blocks(original[hit.defender], hit.pushDir, hit.move.level) }));
  let next: [FighterState, FighterState] = [fighters[0], fighters[1]];
  for (const { hit, blocked } of results) {
    const updated = updateAttacker(next[hit.attacker], hit, blocked, original[hit.defender]);
    next = hit.attacker === 0 ? [updated, next[1]] : [next[0], updated];
  }
  const events: SimEvent[] = [];
  for (const { hit, blocked } of results) {
    const defender = next[hit.defender];
    const result = defender.state === 'ko' ? null : blocked ? blockDefender(defender, hit) : hitDefender(defender, hit);
    if (result !== null) {
      next = hit.defender === 0 ? [result.fighter, next[1]] : [next[0], result.fighter];
      events.push(...result.events);
    }
    if (hit.projectileId !== null) {
      events.push({ type: 'projectileHit', id: hit.projectileId, owner: hit.attacker, x: hit.x, y: hit.y, blocked });
    }
  }
  const usedProjectiles = new Set(hits.map((h) => h.projectileId).filter((id): id is number => id !== null));
  return { fighters: next, projectiles: projectiles.filter((p) => !usedProjectiles.has(p.id)), events };
}
