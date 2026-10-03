/**
 * CPU opponent. A small state machine (approach, guard, retreat, neutral) plus
 * reactive layers (guard, anti-air, punish, special cancel) driven by a
 * delayed view of the opponent. Fully deterministic: all randomness comes from
 * the seeded Rng stored in AiState.
 *
 *   let ai = createAi('normal', 1234);
 *   const { input, ai: nextAi } = decideAi(ai, match, 1);
 */

import { getCharacter } from '../data/characters';
import type { CharacterData, MoveData } from '../data/characters';
import { AI_PARAMS, moveReach, remember, seenMove, viewOpponent } from './ai-model';
import type { AiParams, Difficulty, OpponentView } from './ai-model';
import { canUseSpecial } from './fighter';
import { NEUTRAL_INPUT, input as makeInput, isNeutral } from './input';
import { chance, createRng, nextFloat, nextRange } from './rng';
import type { Rng } from './rng';
import type { FighterState, MatchState, PlayerInput, Side } from './types';

export type AiMode = 'neutral' | 'approach' | 'retreat' | 'guard';
export type ThreatResponse = 'guard' | 'antiAir' | 'ignore';

export interface AiState {
  readonly difficulty: Difficulty;
  readonly rng: Rng;
  readonly mode: AiMode;
  readonly modeFrames: number;
  readonly targetRange: number;
  readonly history: readonly OpponentView[];
  /** Consecutive frames with a fully neutral output (watchdog). */
  readonly idleFrames: number;
  readonly lastInput: PlayerInput;
  readonly threatKey: string | null;
  readonly threatResponse: ThreatResponse | null;
  readonly guardLow: boolean;
  readonly guardHold: number;
  /** Attack instance for which the cancel / punish roll was already made. */
  readonly rolledKey: string | null;
}

/** Frames of neutral output after which the watchdog forces an action. */
export const AI_WATCHDOG_FRAMES = 120;
const GUARD_HOLD_FRAMES = 8;
const PROJECTILE_ALERT_RANGE = 450;
const AIR_ALERT_RANGE = 330;

export function createAi(difficulty: Difficulty, seed: number): AiState {
  return {
    difficulty,
    rng: createRng(seed),
    mode: 'neutral',
    modeFrames: 0,
    targetRange: 0,
    history: [],
    idleFrames: 0,
    lastInput: NEUTRAL_INPUT,
    threatKey: null,
    threatResponse: null,
    guardLow: false,
    guardHold: 0,
    rolledKey: null,
  };
}

/** Local random helper threading an immutable Rng through one decision. */
interface Dice {
  roll(p: number): boolean;
  range(min: number, max: number): number;
  pick<T>(items: readonly T[]): T;
  current(): Rng;
}

function makeDice(start: Rng): Dice {
  let rng = start;
  return {
    roll(p) {
      const [v, next] = chance(rng, p);
      rng = next;
      return v;
    },
    range(min, max) {
      const [v, next] = nextRange(rng, min, max);
      rng = next;
      return v;
    },
    pick<T>(items: readonly T[]): T {
      const [f, next] = nextFloat(rng);
      rng = next;
      const item = items[Math.min(items.length - 1, Math.floor(f * items.length))];
      if (item === undefined) throw new Error('pick from empty list');
      return item;
    },
    current: () => rng,
  };
}

interface Threat {
  readonly key: string;
  readonly kind: 'attack' | 'projectile' | 'air';
  readonly low: boolean;
}

interface Plan {
  readonly input: PlayerInput;
  readonly patch: Partial<AiState>;
}

interface Ctx {
  readonly ai: AiState;
  readonly params: AiParams;
  readonly self: FighterState;
  readonly char: CharacterData;
  readonly match: MatchState;
  readonly seen: OpponentView;
  readonly dist: number;
  readonly fwd: Partial<PlayerInput>;
  readonly back: Partial<PlayerInput>;
  readonly dice: Dice;
}

function dashReach(move: MoveData): number {
  const spec = move.special;
  const travel = spec !== undefined && spec.kind === 'dash' ? spec.speed * move.active * 0.8 : 0;
  return travel + moveReach(move);
}

function findThreat(seen: OpponentView, self: FighterState): Threat | null {
  const sdist = Math.abs(seen.x - self.x);
  for (const p of seen.projectiles) {
    const towards = Math.sign(self.x - p.x) === Math.sign(p.vx);
    if (towards && Math.abs(self.x - p.x) < PROJECTILE_ALERT_RANGE) {
      return { key: `p${p.id}`, kind: 'projectile', low: p.level === 'low' || p.y >= 150 };
    }
  }
  if (seen.airborne && sdist < AIR_ALERT_RANGE && (seen.state === 'jump' || seen.state === 'attack')) {
    return { key: `j${Math.floor(seen.frame / 50)}`, kind: 'air', low: false };
  }
  const move = seenMove(seen);
  if (seen.state === 'attack' && move !== null && seen.movePhase !== 'recovery' && !seen.airborne) {
    const isProjectile = move.special !== undefined && move.special.kind !== 'dash';
    if (!isProjectile && sdist < dashReach(move) + 50) {
      return { key: `m${seen.frame - seen.moveFrame}`, kind: 'attack', low: move.level === 'low' };
    }
  }
  return null;
}

function guardInput(ctx: Ctx, low: boolean): PlayerInput {
  return makeInput({ ...ctx.back, block: true, down: low });
}

function pressAttack(ctx: Ctx, key: 'lightPunch' | 'heavyKick' | 'crouchPunch' | 'crouchKick'): PlayerInput {
  switch (key) {
    case 'lightPunch':
      return makeInput({ punch: true });
    case 'heavyKick':
      return makeInput({ kick: true });
    case 'crouchPunch':
      return makeInput({ punch: true, down: true });
    case 'crouchKick':
      return makeInput({ kick: true, down: true });
  }
}

function chooseAttack(ctx: Ctx, est: number): PlayerInput {
  const m = ctx.char.moves;
  if (est <= moveReach(m.lightPunch)) {
    return pressAttack(ctx, ctx.dice.pick(['lightPunch', 'lightPunch', 'crouchPunch', 'crouchKick', 'heavyKick'] as const));
  }
  if (est <= moveReach(m.crouchKick)) {
    return pressAttack(ctx, ctx.dice.pick(['crouchKick', 'heavyKick', 'heavyKick'] as const));
  }
  return pressAttack(ctx, 'heavyKick');
}

function specialFits(char: CharacterData, est: number): boolean {
  const move = char.moves.special;
  const spec = move.special;
  if (spec === undefined) return false;
  if (spec.kind === 'dash') return est < dashReach(move);
  const range = spec.speed * spec.lifetime + spec.spawnOffsetX;
  if (spec.kind === 'ground-wave') return est > 120 && est < range - 40;
  return est > 160 && est < range - 40;
}

function busyPlan(ctx: Ctx): Plan | null {
  const { self, params, dice, ai, match } = ctx;
  switch (self.state) {
    case 'ko':
    case 'victory':
      return { input: NEUTRAL_INPUT, patch: {} };
    case 'knockdown':
    case 'hitstun':
      return { input: params.wakeUpGuard ? guardInput(ctx, false) : NEUTRAL_INPUT, patch: {} };
    case 'blockstun':
      return { input: guardInput(ctx, self.crouching), patch: {} };
    case 'attack': {
      const key = `c${match.frame - self.moveFrame}`;
      const cancellable = self.moveConnected && self.moveId !== 'special' && self.moveId !== 'jumpKick';
      if (cancellable && ai.rolledKey !== key && canUseSpecial(self, ctx.char, match.projectiles)) {
        const go = dice.roll(params.cancelChance);
        return { input: go ? makeInput({ special: true }) : NEUTRAL_INPUT, patch: { rolledKey: key } };
      }
      return { input: NEUTRAL_INPUT, patch: {} };
    }
    case 'jump': {
      const descending = self.vy < 2;
      if (!self.airAttackUsed && descending && ctx.dist < 190 && self.y < 230) {
        return { input: makeInput({ kick: true }), patch: {} };
      }
      return { input: NEUTRAL_INPUT, patch: {} };
    }
    default:
      return null;
  }
}

function reactivePlan(ctx: Ctx): Plan | null {
  const { ai, params, dice, seen, self } = ctx;
  const threat = findThreat(seen, self);
  if (threat !== null) {
    const fresh = threat.key !== ai.threatKey;
    let response = ai.threatResponse ?? 'ignore';
    let guardLow = ai.guardLow;
    if (fresh) {
      if (threat.kind === 'air') {
        response = dice.roll(params.antiAirChance) ? 'antiAir' : dice.roll(params.blockChance) ? 'guard' : 'ignore';
        guardLow = false;
      } else {
        response = dice.roll(params.blockChance) ? 'guard' : 'ignore';
        guardLow = dice.roll(params.heightAccuracy) ? threat.low : !threat.low;
      }
    }
    const patch: Partial<AiState> = { threatKey: threat.key, threatResponse: response, guardLow };
    if (response === 'guard') {
      return { input: guardInput(ctx, guardLow), patch: { ...patch, guardHold: GUARD_HOLD_FRAMES } };
    }
    if (response === 'antiAir') {
      const hk = moveReach(ctx.char.moves.heavyKick);
      if (ctx.dist < hk + 20) return { input: makeInput({ kick: true }), patch: { ...patch, threatResponse: 'ignore' } };
      return { input: NEUTRAL_INPUT, patch };
    }
    return null;
  }
  if (ai.guardHold > 0) {
    return { input: guardInput(ctx, ai.guardLow), patch: { guardHold: ai.guardHold - 1 } };
  }
  const move = seenMove(seen);
  if (seen.state === 'attack' && seen.movePhase === 'recovery' && move !== null) {
    const key = `r${seen.frame - seen.moveFrame}`;
    const hk = moveReach(ctx.char.moves.heavyKick);
    if (ai.rolledKey !== key && ctx.dist < hk) {
      const go = dice.roll(params.punishChance);
      const attack = ctx.dist < moveReach(ctx.char.moves.lightPunch) ? 'lightPunch' : 'heavyKick';
      return { input: go ? pressAttack(ctx, attack) : NEUTRAL_INPUT, patch: { rolledKey: key } };
    }
  }
  return null;
}

function continueMode(ctx: Ctx): Plan | null {
  const { ai } = ctx;
  if (ai.modeFrames <= 0) return null;
  const patch: Partial<AiState> = { modeFrames: ai.modeFrames - 1 };
  switch (ai.mode) {
    case 'approach':
      if (ctx.dist <= ai.targetRange) return null;
      return { input: makeInput(ctx.fwd), patch };
    case 'retreat':
      return { input: makeInput(ctx.back), patch };
    case 'guard':
      return { input: guardInput(ctx, ai.guardLow), patch };
    case 'neutral':
      return { input: NEUTRAL_INPUT, patch };
  }
}

function decideFresh(ctx: Ctx): Plan {
  const { params, dice, char, self, match } = ctx;
  const est = ctx.dist + dice.range(-params.spacingError, params.spacingError);
  const settle = Math.max(1, Math.floor(params.decisionInterval / 2));
  if (canUseSpecial(self, char, match.projectiles) && specialFits(char, est) && dice.roll(params.specialChance)) {
    return { input: makeInput({ special: true }), patch: { mode: 'neutral', modeFrames: settle } };
  }
  const m = char.moves;
  if (est <= moveReach(m.heavyKick)) {
    if (dice.roll(params.aggression)) {
      return { input: chooseAttack(ctx, est), patch: { mode: 'neutral', modeFrames: settle } };
    }
    if (dice.roll(params.retreatChance)) {
      return { input: makeInput(ctx.back), patch: { mode: 'retreat', modeFrames: Math.floor(dice.range(12, 30)) } };
    }
    const guardLow = dice.roll(0.5);
    return { input: guardInput(ctx, guardLow), patch: { mode: 'guard', modeFrames: Math.floor(dice.range(8, 20)), guardLow } };
  }
  if (est > 200 && est < 420 && dice.roll(params.jumpInChance)) {
    return { input: makeInput({ ...ctx.fwd, up: true }), patch: { mode: 'neutral', modeFrames: params.decisionInterval } };
  }
  const targetRange = dice.roll(0.5) ? moveReach(m.lightPunch) - 10 : moveReach(m.heavyKick) - 15;
  return { input: makeInput(ctx.fwd), patch: { mode: 'approach', modeFrames: params.decisionInterval * 4, targetRange } };
}

function watchdogPlan(ctx: Ctx): Plan {
  const hk = moveReach(ctx.char.moves.heavyKick);
  if (ctx.dist > hk) {
    return { input: makeInput(ctx.fwd), patch: { mode: 'approach', modeFrames: 90, targetRange: hk - 15 } };
  }
  return { input: makeInput({ kick: true }), patch: { mode: 'neutral', modeFrames: 4 } };
}

/** Drops attack buttons that were already held last frame so every press is a rising edge. */
function releaseHeld(next: PlayerInput, last: PlayerInput): PlayerInput {
  if (!(next.punch && last.punch) && !(next.kick && last.kick) && !(next.special && last.special)) return next;
  return {
    ...next,
    punch: next.punch && !last.punch,
    kick: next.kick && !last.kick,
    special: next.special && !last.special,
  };
}

function planFor(ctx: Ctx): Plan {
  if (ctx.ai.idleFrames >= AI_WATCHDOG_FRAMES && ctx.self.state !== 'ko' && ctx.self.state !== 'victory') {
    return watchdogPlan(ctx);
  }
  return busyPlan(ctx) ?? reactivePlan(ctx) ?? continueMode(ctx) ?? decideFresh(ctx);
}

/**
 * Chooses the input of `side` for the next stepMatch call. Pure: returns the
 * input and a new AiState; call it once per frame with the current match.
 */
export function decideAi(ai: AiState, match: MatchState, side: Side): { input: PlayerInput; ai: AiState } {
  const params = AI_PARAMS[ai.difficulty];
  const history = remember(ai.history, viewOpponent(match, side), params.reactionFrames);
  const seen = history[0];
  if (match.phase !== 'fight' || seen === undefined) {
    const rest: AiState = { ...ai, history, idleFrames: 0, lastInput: NEUTRAL_INPUT, mode: 'neutral', modeFrames: 0, guardHold: 0 };
    return { input: NEUTRAL_INPUT, ai: rest };
  }
  const self = match.fighters[side];
  const opp = match.fighters[side === 0 ? 1 : 0];
  const toward = opp.x >= self.x ? 1 : -1;
  const dice = makeDice(ai.rng);
  const ctx: Ctx = {
    ai: { ...ai, history },
    params,
    self,
    char: getCharacter(self.characterId),
    match,
    seen,
    dist: Math.abs(opp.x - self.x),
    fwd: toward === 1 ? { right: true } : { left: true },
    back: toward === 1 ? { left: true } : { right: true },
    dice,
  };
  const plan = planFor(ctx);
  const output = releaseHeld(plan.input, ai.lastInput);
  const next: AiState = {
    ...ai,
    ...plan.patch,
    history,
    rng: dice.current(),
    idleFrames: isNeutral(output) ? ai.idleFrames + 1 : 0,
    lastInput: output,
  };
  return { input: output, ai: next };
}

export { AI_PARAMS };
export type { AiParams, Difficulty };
