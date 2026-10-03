/**
 * Pure helpers for tests and tooling: scripted input runs, quick setup of a
 * fight and AI vs AI matches.
 */

import { createAi, decideAi } from './ai';
import type { AiState } from './ai';
import type { Difficulty } from './ai-model';
import { INTRO_FRAMES } from './constants';
import { input, neutralInput } from './input';
import { createMatch, stepMatch } from './match';
import type { FighterState, MatchConfig, MatchState, PlayerInput, SimEvent } from './types';

export { input, neutralInput };

export type InputPair = readonly [PlayerInput, PlayerInput];
export type InputsFn = (frame: number, state: MatchState) => InputPair;

export const NEUTRAL_PAIR: InputPair = [neutralInput(), neutralInput()];

export interface RunResult {
  readonly state: MatchState;
  readonly events: readonly SimEvent[];
  /** State after every step (index 0 is after the first step). */
  readonly states: readonly MatchState[];
}

/** Steps `n` frames; `inputsFn` receives the 0-based step index and the state before the step. */
export function runFrames(state: MatchState, n: number, inputsFn: InputsFn = () => NEUTRAL_PAIR): RunResult {
  const states: MatchState[] = [];
  const events: SimEvent[] = [];
  let current = state;
  for (let i = 0; i < n; i += 1) {
    const result = stepMatch(current, inputsFn(i, current));
    current = result.state;
    states.push(current);
    events.push(...result.events);
  }
  return { state: current, events, states };
}

/** Creates a match and skips the intro so the next step is a fight frame. */
export function startFight(config: MatchConfig): MatchState {
  return runFrames(createMatch(config), INTRO_FRAMES).state;
}

/** Returns a copy of the state with fighter fields overridden (test setup only). */
export function patchFighters(
  state: MatchState,
  p1: Partial<FighterState> = {},
  p2: Partial<FighterState> = {},
): MatchState {
  return { ...state, fighters: [{ ...state.fighters[0], ...p1 }, { ...state.fighters[1], ...p2 }] };
}

/** Places both fighters (facing each other) at the given x positions. */
export function placeFighters(state: MatchState, x1: number, x2: number): MatchState {
  return patchFighters(state, { x: x1, facing: x2 >= x1 ? 1 : -1 }, { x: x2, facing: x2 >= x1 ? -1 : 1 });
}

export interface AiMatchOptions {
  readonly p1: string;
  readonly p2: string;
  readonly d1: Difficulty;
  readonly d2: Difficulty;
  readonly seed1: number;
  readonly seed2: number;
  readonly maxFrames?: number;
  readonly config?: Partial<MatchConfig>;
}

export interface AiMatchResult {
  readonly state: MatchState;
  readonly frames: number;
  readonly finished: boolean;
  readonly hits: number;
}

/** Plays a whole match between two AIs until matchEnd or maxFrames. */
export function runMatchWithAi(options: AiMatchOptions): AiMatchResult {
  const maxFrames = options.maxFrames ?? 60000;
  let state = createMatch({ ...options.config, p1: options.p1, p2: options.p2 });
  let ai1: AiState = createAi(options.d1, options.seed1);
  let ai2: AiState = createAi(options.d2, options.seed2);
  let frames = 0;
  let hits = 0;
  while (state.phase !== 'matchEnd' && frames < maxFrames) {
    const a = decideAi(ai1, state, 0);
    const b = decideAi(ai2, state, 1);
    ai1 = a.ai;
    ai2 = b.ai;
    const result = stepMatch(state, [a.input, b.input]);
    state = result.state;
    hits += result.events.filter((e) => e.type === 'hit').length;
    frames += 1;
  }
  return { state, frames, finished: state.phase === 'matchEnd', hits };
}
