import { describe, expect, it } from 'vitest';
import { CHARACTER_IDS } from '../../data/characters';
import { AI_PARAMS, AI_WATCHDOG_FRAMES, createAi, decideAi } from '../../sim/ai';
import type { AiState, Difficulty } from '../../sim/ai';
import { DIFFICULTIES } from '../../sim/ai-model';
import { ROUND_SECONDS, STEP_HZ } from '../../sim/constants';
import { hashSequence } from '../../sim/hash';
import { isNeutral } from '../../sim/input';
import { createMatch, stepMatch } from '../../sim/match';
import { neutralInput, runMatchWithAi, startFight } from '../../sim/testing';
import type { MatchState, PlayerInput } from '../../sim/types';

const N = neutralInput();

/** AI on side 0 against a dummy that never presses anything. */
function vsDummy(difficulty: Difficulty, p1: string, p2: string, seed: number, frames: number) {
  let state: MatchState = startFight({ p1, p2 });
  let ai: AiState = createAi(difficulty, seed);
  const outputs: PlayerInput[] = [];
  for (let i = 0; i < frames && state.phase === 'fight'; i += 1) {
    const d = decideAi(ai, state, 0);
    ai = d.ai;
    outputs.push(d.input);
    state = stepMatch(state, [d.input, N]).state;
  }
  return { state, outputs };
}

describe('AI determinism', () => {
  it('the same seed gives the same inputs and states', () => {
    const a = vsDummy('normal', 'dalva', 'saci', 11, 600);
    const b = vsDummy('normal', 'dalva', 'saci', 11, 600);
    expect(hashSequence(a.outputs)).toBe(hashSequence(b.outputs));
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
  });

  it('different seeds diverge', () => {
    const a = vsDummy('normal', 'dalva', 'saci', 11, 600);
    const b = vsDummy('normal', 'dalva', 'saci', 12, 600);
    expect(hashSequence(a.outputs)).not.toBe(hashSequence(b.outputs));
  });

  it('decideAi does not mutate its arguments', () => {
    const state = startFight({ p1: 'tiao', p2: 'rosa' });
    const ai = createAi('hard', 5);
    const before = JSON.stringify([ai, state]);
    decideAi(ai, state, 1);
    expect(JSON.stringify([ai, state])).toBe(before);
  });

  it('outputs neutral input outside the fight phase', () => {
    const intro = createMatch({ p1: 'tiao', p2: 'rosa' });
    expect(decideAi(createAi('hard', 1), intro, 0).input).toEqual(N);
  });
});

describe('AI parameters', () => {
  it('harder levels react faster and defend better', () => {
    const { easy, normal, hard } = AI_PARAMS;
    expect(hard.reactionFrames).toBeLessThan(normal.reactionFrames);
    expect(normal.reactionFrames).toBeLessThan(easy.reactionFrames);
    expect(hard.reactionFrames).toBe(8);
    expect(normal.reactionFrames).toBe(16);
    expect(easy.reactionFrames).toBe(28);
    expect(hard.blockChance).toBeGreaterThan(normal.blockChance);
    expect(normal.blockChance).toBeGreaterThan(easy.blockChance);
    expect(hard.spacingError).toBeLessThan(easy.spacingError);
  });
});

describe('AI vs passive dummy', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`${difficulty} deals damage within 600 frames`, () => {
      for (const [p1, p2] of [['craque', 'curupira'], ['curupira', 'saci'], ['saci', 'rosa']] as const) {
        const { state } = vsDummy(difficulty, p1, p2, 3, 600);
        expect(state.fighters[1].health, `${difficulty} ${p1}`).toBeLessThan(1000);
      }
    });

    it(`${difficulty} never stays neutral for longer than the watchdog allows`, () => {
      const { outputs } = vsDummy(difficulty, 'dalva', 'tiao', 9, 1200);
      let streak = 0;
      let longest = 0;
      for (const out of outputs) {
        streak = isNeutral(out) ? streak + 1 : 0;
        longest = Math.max(longest, streak);
      }
      expect(longest).toBeLessThanOrEqual(AI_WATCHDOG_FRAMES);
    });
  }

  it('approaches when far away', () => {
    const { state } = vsDummy('easy', 'curupira', 'craque', 4, 120);
    expect(state.fighters[0].x).toBeGreaterThan(startFight({ p1: 'curupira', p2: 'craque' }).fighters[0].x);
  });
});

const FRAME_BOUND = 3 * 3 * ROUND_SECONDS * STEP_HZ + 3000;

describe('AI vs AI full matches', () => {
  const pairs: readonly (readonly [Difficulty, Difficulty])[] = DIFFICULTIES.flatMap((a) => DIFFICULTIES.map((b) => [a, b] as const));

  it('every difficulty pairing (mirrors included) reaches matchEnd', () => {
    pairs.forEach(([d1, d2], i) => {
      const p1 = CHARACTER_IDS[i % 6] ?? 'tiao';
      const p2 = CHARACTER_IDS[(i + 1) % 6] ?? 'tiao';
      const result = runMatchWithAi({ p1, p2, d1, d2, seed1: 100 + i, seed2: 200 + i, maxFrames: FRAME_BOUND });
      expect(result.finished, `${d1} vs ${d2}`).toBe(true);
      expect(result.frames).toBeLessThan(FRAME_BOUND);
      expect(result.hits).toBeGreaterThan(4);
      expect(result.state.round).toBeLessThanOrEqual(5);
    });
  });

  it('character pairs covering all six fighters (and a mirror) finish', () => {
    const charPairs = [
      ['tiao', 'dalva'],
      ['saci', 'curupira'],
      ['craque', 'rosa'],
      ['curupira', 'tiao'],
      ['rosa', 'saci'],
      ['dalva', 'craque'],
      ['saci', 'saci'],
    ] as const;
    const seen = new Set(charPairs.flat());
    expect(seen.size).toBe(6);
    charPairs.forEach(([p1, p2], i) => {
      const result = runMatchWithAi({ p1, p2, d1: 'normal', d2: 'normal', seed1: i + 1, seed2: i + 50, maxFrames: FRAME_BOUND });
      expect(result.finished, `${p1} vs ${p2}`).toBe(true);
      expect(result.frames).toBeLessThan(FRAME_BOUND);
    });
  });

  it('hard beats easy in at least 7 of 10 seeded matches (both sides)', () => {
    let hardWins = 0;
    for (let i = 0; i < 10; i += 1) {
      const p1 = CHARACTER_IDS[i % 6] ?? 'tiao';
      const p2 = CHARACTER_IDS[(i + 3) % 6] ?? 'tiao';
      const hardSide = i % 2 === 0 ? 0 : 1;
      const result = runMatchWithAi({
        p1,
        p2,
        d1: hardSide === 0 ? 'hard' : 'easy',
        d2: hardSide === 1 ? 'hard' : 'easy',
        seed1: 1000 + i,
        seed2: 2000 + i,
      });
      if (result.state.winner === hardSide) hardWins += 1;
    }
    expect(hardWins).toBeGreaterThanOrEqual(7);
  });
});
