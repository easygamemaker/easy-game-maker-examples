/**
 * Match flow: phases, rounds, timer and the per-frame world step.
 *
 * Phases: intro (ROUND n, then FIGHT!) -> fight -> ko | timeUp -> roundEnd ->
 * intro of the next round | matchEnd. Inputs are only read in the fight phase.
 */

import { getCharacter } from '../data/characters';
import {
  DEFAULT_HIT_STOP_FRAMES,
  DEFAULT_ROUNDS,
  EXTRA_ROUNDS_LIMIT,
  INTRO_FRAMES,
  INTRO_ROUND_BANNER_FRAMES,
  KO_FRAMES,
  ROUND_END_FRAMES,
  ROUND_SECONDS,
  STEP_HZ,
  TIME_UP_FRAMES,
} from './constants';
import { applyHits, detectHits } from './combat';
import { createFighter, freezeFighter, stepFighter, withPose } from './fighter';
import type { ProjectileSpawnRequest } from './fighter';
import { NEUTRAL_INPUT } from './input';
import { advanceProjectiles, cancelClashingProjectiles, createProjectile } from './projectiles';
import { resolveSpacing } from './spacing';
import type {
  Banner,
  FighterState,
  MatchConfig,
  MatchPhase,
  MatchState,
  PlayerInput,
  Projectile,
  ResolvedMatchConfig,
  RoundOutcome,
  SimEvent,
  Side,
  StepResult,
} from './types';

type Pair = readonly [FighterState, FighterState];
type Inputs = readonly [PlayerInput, PlayerInput];

const NEUTRAL_PAIR: Inputs = [NEUTRAL_INPUT, NEUTRAL_INPUT];

export function resolveConfig(config: MatchConfig): ResolvedMatchConfig {
  getCharacter(config.p1);
  getCharacter(config.p2);
  const rounds = Math.max(1, Math.floor(config.rounds ?? DEFAULT_ROUNDS));
  return {
    p1: config.p1,
    p2: config.p2,
    stageId: config.stageId ?? null,
    rounds,
    winsNeeded: Math.floor(rounds / 2) + 1,
    maxRounds: rounds + EXTRA_ROUNDS_LIMIT,
    hitStopFrames: Math.max(0, Math.floor(config.hitStopFrames ?? DEFAULT_HIT_STOP_FRAMES)),
    roundSeconds: Math.max(1, Math.floor(config.roundSeconds ?? ROUND_SECONDS)),
  };
}

function roundBanner(round: number): Banner {
  const clamped = Math.min(5, Math.max(1, round));
  return `ROUND ${clamped}` as Banner;
}

function freshFighters(config: ResolvedMatchConfig, meters: readonly [number, number]): Pair {
  return [createFighter(0, config.p1, meters[0]), createFighter(1, config.p2, meters[1])];
}

export function createMatch(config: MatchConfig): MatchState {
  const resolved = resolveConfig(config);
  const timerFrames = resolved.roundSeconds * STEP_HZ;
  return {
    config: resolved,
    frame: 0,
    phase: 'intro',
    phaseFrame: 0,
    round: 1,
    wins: [0, 0],
    timerFrames,
    timerSeconds: resolved.roundSeconds,
    fighters: freshFighters(resolved, [0, 0]),
    projectiles: [],
    nextProjectileId: 1,
    hitStop: 0,
    banner: roundBanner(1),
    roundOutcome: null,
    roundWinner: null,
    winner: null,
    healthTotals: [0, 0],
  };
}

function enterPhase(state: MatchState, phase: MatchPhase, banner: Banner | null): MatchState {
  return { ...state, phase, phaseFrame: 0, banner };
}

interface WorldStep {
  readonly fighters: Pair;
  readonly projectiles: readonly Projectile[];
  readonly nextProjectileId: number;
  readonly events: readonly SimEvent[];
  readonly connected: boolean;
}

function spawnProjectiles(
  requests: readonly (ProjectileSpawnRequest | null)[],
  firstId: number,
): { projectiles: Projectile[]; events: SimEvent[]; nextId: number } {
  const projectiles: Projectile[] = [];
  const events: SimEvent[] = [];
  let nextId = firstId;
  for (const req of requests) {
    if (req === null) continue;
    const p = createProjectile(nextId, req);
    projectiles.push(p);
    events.push({ type: 'projectileSpawn', id: p.id, owner: p.owner, x: p.x, y: p.y, visual: p.visual });
    nextId += 1;
  }
  return { projectiles, events, nextId };
}

/**
 * One frame of the world: fighters, spacing, projectiles and (when `combat`
 * is true) hit detection. Order: fighters step against the previous frame,
 * spacing, existing projectiles move, new projectiles spawn, clashes, hits.
 */
function stepWorld(state: MatchState, inputs: Inputs, combat: boolean): WorldStep {
  const [f0, f1] = state.fighters;
  const r0 = stepFighter(f0, inputs[0], { opponent: f1, projectiles: state.projectiles });
  const r1 = stepFighter(f1, inputs[1], { opponent: f0, projectiles: state.projectiles });
  const spaced = resolveSpacing(state.fighters, [r0.fighter, r1.fighter]);
  const posed: Pair = [withPose(f0, spaced[0]), withPose(f1, spaced[1])];
  const moved = advanceProjectiles(state.projectiles);
  const spawned = combat ? spawnProjectiles([r0.spawn, r1.spawn], state.nextProjectileId) : { projectiles: [], events: [], nextId: state.nextProjectileId };
  const clashed = cancelClashingProjectiles([...moved.projectiles, ...spawned.projectiles]);
  const baseEvents: SimEvent[] = [...r0.events, ...r1.events, ...moved.events, ...spawned.events, ...clashed.events];
  if (!combat) {
    return { fighters: posed, projectiles: clashed.projectiles, nextProjectileId: spawned.nextId, events: baseEvents, connected: false };
  }
  const hits = detectHits(posed, clashed.projectiles);
  const applied = applyHits(posed, clashed.projectiles, hits);
  const final: Pair = [withPose(f0, applied.fighters[0]), withPose(f1, applied.fighters[1])];
  return {
    fighters: final,
    projectiles: applied.projectiles,
    nextProjectileId: spawned.nextId,
    events: [...baseEvents, ...applied.events],
    connected: hits.length > 0,
  };
}

function healthFraction(f: FighterState): number {
  return f.health / f.maxHealth;
}

/** Round outcome when the timer runs out: higher health fraction wins, equal is a draw. */
export function timeUpOutcome(fighters: Pair): RoundOutcome {
  const a = healthFraction(fighters[0]);
  const b = healthFraction(fighters[1]);
  return { winner: a > b ? 0 : b > a ? 1 : null, reason: 'time' };
}

function koOutcome(fighters: Pair): RoundOutcome | null {
  const dead0 = fighters[0].health <= 0;
  const dead1 = fighters[1].health <= 0;
  if (dead0 && dead1) return { winner: null, reason: 'doubleKo' };
  if (dead0) return { winner: 1, reason: 'ko' };
  if (dead1) return { winner: 0, reason: 'ko' };
  return null;
}

function applyWorld(state: MatchState, world: WorldStep): MatchState {
  return {
    ...state,
    fighters: world.fighters,
    projectiles: world.projectiles,
    nextProjectileId: world.nextProjectileId,
    hitStop: world.connected ? state.config.hitStopFrames : 0,
  };
}

function stepFight(state: MatchState, inputs: Inputs): StepResult {
  if (state.hitStop > 0) {
    const frozen: Pair = [freezeFighter(state.fighters[0], inputs[0]), freezeFighter(state.fighters[1], inputs[1])];
    const timerFrames = Math.max(0, state.timerFrames - 1);
    const next: MatchState = { ...state, fighters: frozen, hitStop: state.hitStop - 1, timerFrames, timerSeconds: Math.ceil(timerFrames / STEP_HZ) };
    return checkRoundOver(next, []);
  }
  const world = stepWorld(state, inputs, true);
  const timerFrames = Math.max(0, state.timerFrames - 1);
  const next: MatchState = { ...applyWorld(state, world), timerFrames, timerSeconds: Math.ceil(timerFrames / STEP_HZ) };
  return checkRoundOver(next, [...world.events]);
}

function checkRoundOver(state: MatchState, events: SimEvent[]): StepResult {
  const ko = koOutcome(state.fighters);
  if (ko !== null) {
    return { state: { ...enterPhase(state, 'ko', 'KO!'), roundOutcome: ko, projectiles: [], hitStop: 0 }, events };
  }
  if (state.timerFrames <= 0) {
    const outcome = timeUpOutcome(state.fighters);
    return {
      state: { ...enterPhase(state, 'timeUp', 'TIME!'), roundOutcome: outcome, projectiles: [], hitStop: 0 },
      events: [...events, { type: 'timeUp' }],
    };
  }
  return { state, events };
}

function toVictory(f: FighterState): FighterState {
  if (f.state === 'ko') return f;
  return withPose(f, { ...f, state: 'victory', stateFrame: 0, vx: 0, moveId: null, moveFrame: 0, movePhase: null, stunFrames: 0 });
}

function enterRoundEnd(state: MatchState): StepResult {
  const outcome = state.roundOutcome ?? { winner: null, reason: 'time' as const };
  const winner = outcome.winner;
  const wins: readonly [number, number] = [state.wins[0] + (winner === 0 ? 1 : 0), state.wins[1] + (winner === 1 ? 1 : 0)];
  const healthTotals: readonly [number, number] = [
    state.healthTotals[0] + state.fighters[0].health,
    state.healthTotals[1] + state.fighters[1].health,
  ];
  const fighters: Pair =
    winner === null ? state.fighters : winner === 0 ? [toVictory(state.fighters[0]), state.fighters[1]] : [state.fighters[0], toVictory(state.fighters[1])];
  const next: MatchState = {
    ...enterPhase(state, 'roundEnd', winner === null ? 'DRAW' : null),
    wins,
    healthTotals,
    fighters,
    roundWinner: winner,
  };
  return { state: next, events: [{ type: 'roundEnd', round: state.round, winner, reason: outcome.reason }] };
}

/** Match winner once the round is over, or undefined if the match continues. */
export function decideMatch(state: MatchState): Side | null | undefined {
  const { winsNeeded, maxRounds } = state.config;
  if (state.wins[0] >= winsNeeded) return 0;
  if (state.wins[1] >= winsNeeded) return 1;
  if (state.round < maxRounds) return undefined;
  if (state.wins[0] !== state.wins[1]) return state.wins[0] > state.wins[1] ? 0 : 1;
  if (state.healthTotals[0] !== state.healthTotals[1]) return state.healthTotals[0] > state.healthTotals[1] ? 0 : 1;
  return null;
}

function leaveRoundEnd(state: MatchState): StepResult {
  const result = decideMatch(state);
  if (result !== undefined) {
    const banner: Banner = result === null ? 'DRAW' : result === 0 ? 'P1 WINS' : 'P2 WINS';
    const fighters: Pair = [
      result === 0 ? toVictory(state.fighters[0]) : state.fighters[0],
      result === 1 ? toVictory(state.fighters[1]) : state.fighters[1],
    ];
    return { state: { ...enterPhase(state, 'matchEnd', banner), winner: result, fighters }, events: [{ type: 'matchEnd', winner: result }] };
  }
  const round = state.round + 1;
  const meters: readonly [number, number] = [state.fighters[0].meter, state.fighters[1].meter];
  const timerFrames = state.config.roundSeconds * STEP_HZ;
  const next: MatchState = {
    ...enterPhase(state, 'intro', roundBanner(round)),
    round,
    fighters: freshFighters(state.config, meters),
    projectiles: [],
    hitStop: 0,
    timerFrames,
    timerSeconds: state.config.roundSeconds,
    roundOutcome: null,
    roundWinner: null,
  };
  return { state: next, events: [{ type: 'roundStart', round }] };
}

function stepIntro(state: MatchState): StepResult {
  const events: SimEvent[] = state.frame === 1 && state.phaseFrame === 1 ? [{ type: 'roundStart', round: state.round }] : [];
  if (state.phaseFrame >= INTRO_FRAMES) {
    return { state: enterPhase(state, 'fight', null), events: [...events, { type: 'fightStart', round: state.round }] };
  }
  const banner: Banner = state.phaseFrame < INTRO_ROUND_BANNER_FRAMES ? roundBanner(state.round) : 'FIGHT!';
  return { state: { ...state, banner }, events };
}

/** Steps the world with neutral inputs and no combat (post-round phases). */
function stepPassive(state: MatchState): { state: MatchState; events: SimEvent[] } {
  const world = stepWorld(state, NEUTRAL_PAIR, false);
  return { state: { ...applyWorld(state, world), hitStop: 0 }, events: [...world.events] };
}

/**
 * Advances the match by one frame. Pure and deterministic: the same state and
 * inputs always give the same result. Pausing is the caller's job (do not step).
 */
export function stepMatch(state: MatchState, inputs: Inputs): StepResult {
  const ticked: MatchState = { ...state, frame: state.frame + 1, phaseFrame: state.phaseFrame + 1 };
  switch (state.phase) {
    case 'intro':
      return stepIntro(ticked);
    case 'fight':
      return stepFight(ticked, inputs);
    case 'ko': {
      const passive = stepPassive(ticked);
      if (passive.state.phaseFrame >= KO_FRAMES) {
        const ended = enterRoundEnd(passive.state);
        return { state: ended.state, events: [...passive.events, ...ended.events] };
      }
      return passive;
    }
    case 'timeUp': {
      const passive = stepPassive(ticked);
      if (passive.state.phaseFrame >= TIME_UP_FRAMES) {
        const ended = enterRoundEnd(passive.state);
        return { state: ended.state, events: [...passive.events, ...ended.events] };
      }
      return passive;
    }
    case 'roundEnd': {
      const passive = stepPassive(ticked);
      if (passive.state.phaseFrame >= ROUND_END_FRAMES) {
        const left = leaveRoundEnd(passive.state);
        return { state: left.state, events: [...passive.events, ...left.events] };
      }
      return passive;
    }
    case 'matchEnd':
      return stepPassive(ticked);
  }
}

/** Convenience: true once the match reached its final phase. */
export function isMatchOver(state: MatchState): boolean {
  return state.phase === 'matchEnd';
}
