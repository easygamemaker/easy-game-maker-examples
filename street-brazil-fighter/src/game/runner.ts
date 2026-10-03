import {
  createAi, createMatch, decideAi, isMatchOver, stepMatch, STEP_HZ,
  type AiState, type Difficulty, type MatchState, type PlayerInput, type SimEvent, type Side,
} from '../sim';
import { NO_INPUT } from './controls';
import { cameraTarget, followCamera } from './camera';
import {
  INITIAL_VISUAL, decayShake, shakeAmount, spawnEffects, spawnFootprints, stepEffects, stepVisual,
  type Effect, type FighterVisual,
} from './fx';

export type Controller = 'human' | 'cpu' | 'dummy';

export interface RunnerOptions {
  readonly p1: string;
  readonly p2: string;
  readonly stageId: string;
  readonly controllers: readonly [Controller, Controller];
  readonly difficulty: Difficulty;
  readonly seed: number;
}

const STEP_SECONDS = 1 / STEP_HZ;
/** Never run more than this many steps for one rendered frame (a long stall must not spiral). */
const MAX_STEPS_PER_FRAME = 24;

/** Fixed 60 Hz stepping of the sim, kept apart from rendering. No engine imports, so it can be tested. */
export class FightRunner {
  match: MatchState;
  visuals: readonly [FighterVisual, FighterVisual] = [INITIAL_VISUAL, INITIAL_VISUAL];
  effects: readonly Effect[] = [];
  shake = 0;
  camX: number;
  private accumulator = 0;
  private ais: readonly [AiState | null, AiState | null];

  constructor(readonly options: RunnerOptions) {
    this.match = createMatch({ p1: options.p1, p2: options.p2, stageId: options.stageId });
    this.ais = [
      options.controllers[0] === 'cpu' ? createAi(options.difficulty, options.seed) : null,
      options.controllers[1] === 'cpu' ? createAi(options.difficulty, options.seed + 7919) : null,
    ];
    this.camX = cameraTarget(this.match.fighters[0].x, this.match.fighters[1].x);
  }

  get over(): boolean {
    return isMatchOver(this.match);
  }

  /** Runs one 60 Hz step with the given human inputs. Returns the events of that step. */
  step(human: (side: Side) => PlayerInput): readonly SimEvent[] {
    const ais: [AiState | null, AiState | null] = [this.ais[0], this.ais[1]];
    const pick = (side: Side): PlayerInput => {
      const c = this.options.controllers[side];
      if (c === 'human') return human(side);
      if (c === 'dummy') return NO_INPUT;
      const ai = ais[side];
      if (!ai) return NO_INPUT;
      const r = decideAi(ai, this.match, side);
      ais[side] = r.ai;
      return r.input;
    };
    const inputs: readonly [PlayerInput, PlayerInput] = [pick(0), pick(1)];
    this.ais = ais;
    const { state, events } = stepMatch(this.match, inputs);
    this.match = state;
    this.visuals = [stepVisual(this.visuals[0], 0, events), stepVisual(this.visuals[1], 1, events)];
    this.effects = [...stepEffects(this.effects), ...spawnEffects(events), ...spawnFootprints(state.fighters)];
    this.shake = Math.max(decayShake(this.shake), shakeAmount(events));
    this.camX = followCamera(this.camX, state.fighters[0].x, state.fighters[1].x);
    return events;
  }

  /** Feeds elapsed real time (seconds) and runs as many fixed steps as are due, times `speed`. */
  advance(dt: number, speed: number, human: (side: Side) => PlayerInput): readonly SimEvent[] {
    this.accumulator += Math.min(dt, 0.1) * speed;
    const events: SimEvent[] = [];
    let steps = 0;
    while (this.accumulator >= STEP_SECONDS && steps < MAX_STEPS_PER_FRAME) {
      this.accumulator -= STEP_SECONDS;
      steps += 1;
      events.push(...this.step(human));
    }
    if (steps === MAX_STEPS_PER_FRAME) this.accumulator = 0;
    return events;
  }
}
