/**
 * Fighter state machine: one call to `stepFighter` advances a fighter by one
 * frame (timers, input handling, physics, pose). Hits are resolved later by
 * `combat.ts`, spacing by `spacing.ts`.
 *
 * Frame convention: a move started on step T has moveFrame 1 on step T. Its
 * active frames are moveFrame startup+1 .. startup+active, and on step
 * T + startup + active + recovery the fighter is back to neutral and can act on
 * that very step. Stun works the same way: see `advanceTimers`.
 */

import { getCharacter } from '../data/characters';
import type { CharacterData, MoveData, MoveKey, PoseId, ProjectileSpecial } from '../data/characters';
import { KNOCKDOWN_LIE_FRAMES, P1_START_X, P2_START_X, PROXIMITY_GUARD_RANGE, SLIDE_EPSILON, SLIDE_FRICTION, SPECIAL_COST } from './constants';
import { getMoveData, isAirborne, isProjectileMove } from './geometry';
import { EMPTY_BUFFER, NEUTRAL_INPUT, horizontal, recordPresses, updateBuffer } from './input';
import type { FighterState, FighterStateName, MovePhase, PlayerInput, Projectile, SimEvent, Side } from './types';

export interface FighterContext {
  readonly opponent: FighterState;
  readonly projectiles: readonly Projectile[];
}

export interface ProjectileSpawnRequest {
  readonly owner: Side;
  readonly characterId: string;
  readonly x: number;
  readonly y: number;
  readonly facing: 1 | -1;
  readonly spec: ProjectileSpecial;
  readonly move: MoveData;
}

export interface FighterStepResult {
  readonly fighter: FighterState;
  readonly events: readonly SimEvent[];
  readonly spawn: ProjectileSpawnRequest | null;
}

const ACTIONABLE: ReadonlySet<FighterStateName> = new Set<FighterStateName>([
  'idle',
  'walkForward',
  'walkBack',
  'crouch',
  'blockStand',
  'blockCrouch',
]);

export function createFighter(side: Side, characterId: string, meter = 0): FighterState {
  const character = getCharacter(characterId);
  return {
    side,
    characterId,
    x: side === 0 ? P1_START_X : P2_START_X,
    y: 0,
    vx: 0,
    vy: 0,
    slideVx: 0,
    facing: side === 0 ? 1 : -1,
    state: 'idle',
    stateFrame: 0,
    pose: 'idle',
    poseFrame: 0,
    health: character.maxHealth,
    maxHealth: character.maxHealth,
    meter,
    comboCount: 0,
    moveId: null,
    moveFrame: 0,
    movePhase: null,
    moveConnected: false,
    stunFrames: 0,
    crouching: false,
    jumpDir: 0,
    airAttackUsed: false,
    buffer: EMPTY_BUFFER,
    lastInput: NEUTRAL_INPUT,
  };
}

export function isActionable(f: FighterState): boolean {
  return ACTIONABLE.has(f.state) && !isAirborne(f);
}

export function movePhaseOf(move: MoveData, moveFrame: number): MovePhase {
  if (moveFrame <= move.startup) return 'startup';
  if (moveFrame <= move.startup + move.active) return 'active';
  return 'recovery';
}

export function moveTotalFrames(move: MoveData): number {
  return move.startup + move.active + move.recovery;
}

/** Returns the fighter in `state`, resetting stateFrame only when the state changes. */
function withState(f: FighterState, state: FighterStateName): FighterState {
  return f.state === state ? f : { ...f, state, stateFrame: 0 };
}

/** Back to standing neutral: clears move, stun and the received combo. */
export function toNeutral(f: FighterState): FighterState {
  return {
    ...f,
    state: 'idle',
    stateFrame: 0,
    vx: 0,
    moveId: null,
    moveFrame: 0,
    movePhase: null,
    moveConnected: false,
    stunFrames: 0,
    crouching: false,
    comboCount: 0,
    airAttackUsed: false,
    jumpDir: 0,
  };
}

/**
 * Advances per-state timers by one frame.
 * Stun convention: hitstun/blockstun N applied on step H leaves the fighter in
 * stun after steps H .. H+N-1; on step H+N it returns to neutral before its
 * input is read, so it can act on step H+N. Knockdown lying frames work the same
 * way, counted from the landing step.
 */
function advanceTimers(f: FighterState): { fighter: FighterState; events: SimEvent[] } {
  const base: FighterState = { ...f, stateFrame: f.stateFrame + 1 };
  if (f.state === 'attack') {
    const move = getMoveData(f);
    if (move === null) return { fighter: toNeutral(base), events: [] };
    const frame = f.moveFrame + 1;
    if (frame > moveTotalFrames(move)) {
      if (isAirborne(f)) {
        return {
          fighter: { ...base, state: 'jump', stateFrame: 0, moveId: null, moveFrame: 0, movePhase: null, moveConnected: false },
          events: [],
        };
      }
      return { fighter: toNeutral(base), events: [] };
    }
    return { fighter: { ...base, moveFrame: frame, movePhase: movePhaseOf(move, frame) }, events: [] };
  }
  if (f.state === 'hitstun' || f.state === 'blockstun') {
    const left = f.stunFrames - 1;
    return { fighter: left <= 0 ? toNeutral(base) : { ...base, stunFrames: left }, events: [] };
  }
  if (f.state === 'knockdown' && !isAirborne(f)) {
    const left = f.stunFrames - 1;
    if (left <= 0) {
      return { fighter: toNeutral(base), events: [{ type: 'wakeUp', player: f.side, x: f.x }] };
    }
    return { fighter: { ...base, stunFrames: left }, events: [] };
  }
  return { fighter: base, events: [] };
}

export function hasOwnProjectile(side: Side, projectiles: readonly Projectile[]): boolean {
  return projectiles.some((p) => p.owner === side);
}

export function canUseSpecial(f: FighterState, character: CharacterData, projectiles: readonly Projectile[]): boolean {
  if (f.meter < SPECIAL_COST) return false;
  if (isProjectileMove(character.moves.special) && hasOwnProjectile(f.side, projectiles)) return false;
  return true;
}

function startMove(f: FighterState, key: MoveKey, character: CharacterData): { fighter: FighterState; events: SimEvent[] } {
  const move = character.moves[key];
  const isSpecial = key === 'special';
  const buffer =
    key === 'special'
      ? { ...f.buffer, special: 0 }
      : key === 'heavyKick' || key === 'crouchKick' || key === 'jumpKick'
        ? { ...f.buffer, kick: 0, punch: key === 'jumpKick' ? 0 : f.buffer.punch }
        : { ...f.buffer, punch: 0 };
  const airborne = isAirborne(f);
  const fighter: FighterState = {
    ...f,
    state: 'attack',
    stateFrame: 0,
    moveId: key,
    moveFrame: 1,
    movePhase: movePhaseOf(move, 1),
    moveConnected: false,
    buffer,
    meter: isSpecial ? f.meter - SPECIAL_COST : f.meter,
    vx: airborne ? f.vx : 0,
    airAttackUsed: airborne ? true : f.airAttackUsed,
  };
  const events: SimEvent[] = [{ type: 'attackStart', player: f.side, moveId: key }];
  if (isSpecial) {
    events.push({ type: 'specialStart', player: f.side, characterId: f.characterId, x: f.x, y: f.y });
  }
  return { fighter, events };
}

function pickGroundAttack(f: FighterState, input: PlayerInput, character: CharacterData, ctx: FighterContext): MoveKey | null {
  if (f.buffer.special > 0 && canUseSpecial(f, character, ctx.projectiles)) return 'special';
  if (f.buffer.kick > 0) return input.down ? 'crouchKick' : 'heavyKick';
  if (f.buffer.punch > 0) return input.down ? 'crouchPunch' : 'lightPunch';
  return null;
}

/** An opponent attack or an incoming projectile close enough to raise the guard. */
export function isThreatened(f: FighterState, ctx: FighterContext): boolean {
  const opp = ctx.opponent;
  if (opp.state === 'attack' && opp.movePhase !== 'recovery' && Math.abs(opp.x - f.x) < PROXIMITY_GUARD_RANGE) {
    return true;
  }
  return ctx.projectiles.some((p) => {
    if (p.owner === f.side) return false;
    const towards = Math.sign(f.x - p.x) === Math.sign(p.vx);
    return towards && Math.abs(f.x - p.x) < PROXIMITY_GUARD_RANGE;
  });
}

function groundedActions(
  f: FighterState,
  input: PlayerInput,
  character: CharacterData,
  ctx: FighterContext,
): { fighter: FighterState; events: SimEvent[] } {
  const attack = pickGroundAttack(f, input, character, ctx);
  if (attack !== null) return startMove(f, attack, character);

  const dir = horizontal(input);
  const rel = dir * f.facing;
  const guard = input.block || (rel === -1 && isThreatened(f, ctx));
  if (input.down) {
    return { fighter: { ...withState(f, guard ? 'blockCrouch' : 'crouch'), vx: 0 }, events: [] };
  }
  if (input.up) {
    const fighter: FighterState = {
      ...withState(f, 'jump'),
      vx: dir * character.jumpForwardSpeed,
      vy: character.jumpVelocity,
      jumpDir: dir,
      airAttackUsed: false,
    };
    return { fighter, events: [{ type: 'jump', player: f.side, x: f.x }] };
  }
  if (guard) return { fighter: { ...withState(f, 'blockStand'), vx: 0 }, events: [] };
  if (rel === 1) return { fighter: { ...withState(f, 'walkForward'), vx: f.facing * character.walkForward }, events: [] };
  if (rel === -1) return { fighter: { ...withState(f, 'walkBack'), vx: -f.facing * character.walkBack }, events: [] };
  return { fighter: { ...withState(f, 'idle'), vx: 0 }, events: [] };
}

function isCancellableNormal(f: FighterState): boolean {
  return (
    f.state === 'attack' &&
    f.moveId !== null &&
    f.moveId !== 'special' &&
    f.moveId !== 'jumpKick' &&
    f.moveConnected &&
    f.movePhase !== 'startup' &&
    !isAirborne(f)
  );
}

/** Per-frame upkeep of an attack: dash velocity and projectile spawn. */
function attackUpkeep(f: FighterState, character: CharacterData): { fighter: FighterState; spawn: ProjectileSpawnRequest | null } {
  const move = getMoveData(f);
  const spec = move?.special;
  if (move === null || spec === undefined) return { fighter: f, spawn: null };
  if (spec.kind === 'dash') {
    const moving = f.movePhase === 'active' && !f.moveConnected;
    return { fighter: { ...f, vx: moving ? f.facing * spec.speed : 0 }, spawn: null };
  }
  if (f.moveFrame !== move.startup + 1) return { fighter: f, spawn: null };
  const spawn: ProjectileSpawnRequest = {
    owner: f.side,
    characterId: character.id,
    x: f.x + f.facing * spec.spawnOffsetX,
    y: f.y + spec.spawnOffsetY,
    facing: f.facing,
    spec,
    move,
  };
  return { fighter: f, spawn };
}

function landed(f: FighterState): { fighter: FighterState; events: SimEvent[] } {
  const grounded: FighterState = { ...f, y: 0, vy: 0, vx: 0 };
  if (f.state === 'knockdown') return { fighter: { ...grounded, stunFrames: KNOCKDOWN_LIE_FRAMES }, events: [] };
  if (f.state === 'ko') return { fighter: grounded, events: [] };
  if (f.state === 'jump' || f.state === 'attack') {
    return { fighter: toNeutral(grounded), events: [{ type: 'land', player: f.side, x: f.x }] };
  }
  return { fighter: grounded, events: [] };
}

/** Velocity integration, gravity, landing and knockback slide. */
export function applyPhysics(f: FighterState, character: CharacterData): { fighter: FighterState; events: SimEvent[] } {
  let next: FighterState = f;
  let events: SimEvent[] = [];
  if (isAirborne(f)) {
    const y = f.y + f.vy;
    const moved: FighterState = { ...f, x: f.x + f.vx, y, vy: f.vy - character.gravity };
    const result = y <= 0 ? landed(moved) : { fighter: moved, events: [] };
    next = result.fighter;
    events = result.events;
  } else if (f.vx !== 0) {
    next = { ...f, x: f.x + f.vx };
  }
  if (next.slideVx !== 0) {
    const decayed = next.slideVx * SLIDE_FRICTION;
    next = { ...next, x: next.x + next.slideVx, slideVx: Math.abs(decayed) < SLIDE_EPSILON ? 0 : decayed };
  }
  return { fighter: next, events };
}

export function derivePose(f: FighterState): PoseId {
  switch (f.state) {
    case 'idle':
      return 'idle';
    case 'walkForward':
    case 'walkBack':
      return 'walk';
    case 'crouch':
      return 'crouch';
    case 'jump':
      return 'jump';
    case 'attack': {
      const move = getMoveData(f);
      if (move === null || f.movePhase === null) return 'idle';
      return move.poses[f.movePhase];
    }
    case 'blockStand':
      return 'block';
    case 'blockCrouch':
      return 'crouch_block';
    case 'blockstun':
      return f.crouching ? 'crouch_block' : 'block';
    case 'hitstun':
      return 'hit';
    case 'knockdown':
    case 'ko':
      return isAirborne(f) ? 'hit' : 'down';
    case 'victory':
      return 'victory';
  }
}

/** Recomputes pose and poseFrame relative to the previous frame. */
export function withPose(prev: FighterState, f: FighterState): FighterState {
  const pose = derivePose(f);
  return { ...f, pose, poseFrame: pose === prev.pose ? prev.poseFrame + 1 : 0 };
}

/** Advances one fighter by one frame. Pure: returns a new fighter. */
export function stepFighter(f: FighterState, input: PlayerInput, ctx: FighterContext): FighterStepResult {
  const character = getCharacter(f.characterId);
  const timed = advanceTimers(f);
  const events: SimEvent[] = [...timed.events];
  let g: FighterState = { ...timed.fighter, buffer: updateBuffer(f.buffer, f.lastInput, input) };

  if (isActionable(g)) {
    const acted = groundedActions(g, input, character, ctx);
    g = acted.fighter;
    events.push(...acted.events);
  } else if (g.state === 'jump' && !g.airAttackUsed && (g.buffer.punch > 0 || g.buffer.kick > 0)) {
    const acted = startMove(g, 'jumpKick', character);
    g = acted.fighter;
    events.push(...acted.events);
  } else if (isCancellableNormal(g) && g.buffer.special > 0 && canUseSpecial(g, character, ctx.projectiles)) {
    const acted = startMove(g, 'special', character);
    g = acted.fighter;
    events.push(...acted.events);
  }

  let spawn: ProjectileSpawnRequest | null = null;
  if (g.state === 'attack') {
    const kept = attackUpkeep(g, character);
    g = kept.fighter;
    spawn = kept.spawn;
  }

  const moved = applyPhysics(g, character);
  events.push(...moved.events);
  const fighter = withPose(f, { ...moved.fighter, lastInput: input });
  return { fighter, events, spawn };
}

/**
 * Freeze step used during hit stop: only the press buffer and the last input
 * are updated so presses made during the freeze are honoured afterwards.
 */
export function freezeFighter(f: FighterState, input: PlayerInput): FighterState {
  return { ...f, buffer: recordPresses(f.buffer, f.lastInput, input), lastInput: input };
}
