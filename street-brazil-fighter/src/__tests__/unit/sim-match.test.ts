import { describe, expect, it } from 'vitest';
import { getCharacter } from '../../data/characters';
import { INTRO_FRAMES, INTRO_ROUND_BANNER_FRAMES, KO_FRAMES, P1_START_X, ROUND_END_FRAMES, STEP_HZ, TIME_UP_FRAMES } from '../../sim/constants';
import { hashSequence } from '../../sim/hash';
import { createMatch, decideMatch, stepMatch } from '../../sim/match';
import { input, neutralInput, patchFighters, placeFighters, runFrames, startFight } from '../../sim/testing';
import type { InputPair } from '../../sim/testing';
import type { MatchConfig, MatchState, PlayerInput, SimEvent, Side } from '../../sim/types';

const N = neutralInput();
const NN: InputPair = [N, N];

function ofType<T extends SimEvent['type']>(events: readonly SimEvent[], type: T): Extract<SimEvent, { type: T }>[] {
  return events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);
}

/** Steps with neutral inputs until `pred` holds (bounded). */
function until(state: MatchState, pred: (s: MatchState) => boolean, limit = 20000): { state: MatchState; events: SimEvent[]; steps: number } {
  let s = state;
  const events: SimEvent[] = [];
  let steps = 0;
  while (!pred(s) && steps < limit) {
    const r = stepMatch(s, NN);
    s = r.state;
    events.push(...r.events);
    steps += 1;
  }
  return { state: s, events, steps };
}

/** From a fight phase, ends the round by zeroing the health of `losers` and plays until the next fight or match end. */
function finishRound(state: MatchState, losers: readonly Side[]): { state: MatchState; events: SimEvent[] } {
  const patched = patchFighters(state, losers.includes(0) ? { health: 0 } : {}, losers.includes(1) ? { health: 0 } : {});
  return until(patched, (s) => s.phase === 'matchEnd' || (s.phase === 'fight' && s.round > state.round));
}

describe('intro and timer', () => {
  it('shows ROUND 1 then FIGHT! and starts the fight after the intro', () => {
    const s0 = createMatch({ p1: 'tiao', p2: 'saci' });
    expect(s0).toMatchObject({ phase: 'intro', round: 1, banner: 'ROUND 1', wins: [0, 0], timerSeconds: 99 });
    const run = runFrames(s0, INTRO_FRAMES, () => [input({ right: true, punch: true }), N]);
    expect(run.states[INTRO_ROUND_BANNER_FRAMES - 2]?.banner).toBe('ROUND 1');
    expect(run.states[INTRO_ROUND_BANNER_FRAMES - 1]?.banner).toBe('FIGHT!');
    expect(run.states[INTRO_FRAMES - 2]?.phase).toBe('intro');
    expect(run.state.phase).toBe('fight');
    expect(run.state.banner).toBeNull();
    expect(ofType(run.events, 'roundStart')).toEqual([{ type: 'roundStart', round: 1 }]);
    expect(ofType(run.events, 'fightStart')).toHaveLength(1);
    expect(run.state.fighters[0].x).toBe(P1_START_X);
    expect(ofType(run.events, 'attackStart')).toHaveLength(0);
  });

  it('counts the timer down once per 60 frames of fight', () => {
    const s = startFight({ p1: 'tiao', p2: 'saci' });
    expect(s.timerFrames).toBe(99 * STEP_HZ);
    const run = runFrames(s, STEP_HZ);
    expect(run.states[0]?.timerSeconds).toBe(99);
    expect(run.state.timerSeconds).toBe(98);
    expect(run.state.timerFrames).toBe(98 * STEP_HZ);
  });

  it('time up: the fighter with more health wins the round', () => {
    const s = placeFighters(startFight({ p1: 'craque', p2: 'craque', roundSeconds: 2, hitStopFrames: 0 }), 700, 800);
    const run = runFrames(s, 2 * STEP_HZ, (i) => [input({ punch: i === 0 }), N]);
    expect(run.state).toMatchObject({ phase: 'timeUp', banner: 'TIME!', timerFrames: 0, timerSeconds: 0 });
    expect(run.state.roundOutcome).toEqual({ winner: 0, reason: 'time' });
    expect(ofType(run.events, 'timeUp')).toHaveLength(1);
    const ended = runFrames(run.state, TIME_UP_FRAMES);
    expect(ended.state.phase).toBe('roundEnd');
    expect(ended.state.wins).toEqual([1, 0]);
    expect(ended.state.roundWinner).toBe(0);
    expect(ended.state.fighters[0].state).toBe('victory');
    expect(ended.state.fighters[0].pose).toBe('victory');
    expect(ofType(ended.events, 'roundEnd')).toEqual([{ type: 'roundEnd', round: 1, winner: 0, reason: 'time' }]);
  });

  it('time up with equal health is a draw round: no point, extra round', () => {
    const s = startFight({ p1: 'craque', p2: 'rosa', roundSeconds: 1 });
    const r = until(s, (st) => st.phase === 'roundEnd');
    expect(r.state.banner).toBe('DRAW');
    expect(r.state.wins).toEqual([0, 0]);
    const next = until(r.state, (st) => st.phase === 'intro');
    expect(next.state.round).toBe(2);
    expect(next.state.banner).toBe('ROUND 2');
  });
});

describe('KO flow', () => {
  it('KO: banner, slow down phase, round end with victory pose, next round reset', () => {
    const lp = getCharacter('craque').moves.lightPunch;
    let s = placeFighters(startFight({ p1: 'craque', p2: 'craque', hitStopFrames: 0 }), 700, 800);
    s = patchFighters(s, { meter: 30 }, { health: 20 });
    const hit = runFrames(s, lp.startup + 1, (i) => [input({ punch: i === 0 }), N]);
    expect(hit.state).toMatchObject({ phase: 'ko', banner: 'KO!' });
    expect(hit.state.roundOutcome).toEqual({ winner: 0, reason: 'ko' });
    expect(hit.state.fighters[1].health).toBe(0);
    expect(hit.state.fighters[1].state).toBe('ko');
    expect(ofType(hit.events, 'ko')).toHaveLength(1);

    const ko = runFrames(hit.state, KO_FRAMES, () => [input({ punch: true }), N]);
    expect(ofType(ko.events, 'attackStart')).toHaveLength(0);
    expect(ko.state.phase).toBe('roundEnd');
    expect(ko.state.fighters[1].pose).toBe('down');
    expect(ko.state.fighters[1].state).toBe('ko');
    expect(ko.state.fighters[0].state).toBe('victory');
    expect(ko.state.wins).toEqual([1, 0]);

    const next = runFrames(ko.state, ROUND_END_FRAMES);
    expect(next.state).toMatchObject({ phase: 'intro', round: 2, banner: 'ROUND 2', roundWinner: null, roundOutcome: null });
    expect(next.state.fighters[1].health).toBe(1000);
    expect(next.state.fighters[0].x).toBe(P1_START_X);
    expect(next.state.fighters[0].meter).toBe(30 + lp.meterGain);
    expect(next.state.timerSeconds).toBe(99);
    expect(ofType(next.events, 'roundStart')).toEqual([{ type: 'roundStart', round: 2 }]);
  });

  it('double KO is a draw round', () => {
    const s = startFight({ p1: 'tiao', p2: 'dalva' });
    const r = until(patchFighters(s, { health: 0 }, { health: 0 }), (st) => st.phase === 'roundEnd');
    expect(r.state.roundOutcome).toEqual({ winner: null, reason: 'doubleKo' });
    expect(r.state.wins).toEqual([0, 0]);
    expect(r.state.banner).toBe('DRAW');
  });

  it('a trade can double KO', () => {
    let s = placeFighters(startFight({ p1: 'craque', p2: 'craque', hitStopFrames: 0 }), 700, 800);
    s = patchFighters(s, { health: 10 }, { health: 10 });
    const run = runFrames(s, 10, (i) => [input({ punch: i === 0 }), input({ punch: i === 0 })]);
    expect(ofType(run.events, 'ko')).toHaveLength(2);
    expect(run.state.roundOutcome?.reason).toBe('doubleKo');
  });
});

describe('best of 3', () => {
  it('2-0 ends the match after two rounds', () => {
    const s = startFight({ p1: 'craque', p2: 'saci' });
    const r1 = finishRound(s, [1]);
    expect(r1.state.round).toBe(2);
    const r2 = finishRound(r1.state, [1]);
    expect(r2.state).toMatchObject({ phase: 'matchEnd', winner: 0, banner: 'P1 WINS', round: 2, wins: [2, 0] });
    expect(ofType(r2.events, 'matchEnd')).toEqual([{ type: 'matchEnd', winner: 0 }]);
    expect(r2.state.fighters[0].state).toBe('victory');
    const after = runFrames(r2.state, 200);
    expect(after.state.phase).toBe('matchEnd');
    expect(after.state.fighters[0].pose).toBe('victory');
  });

  it('2-1 ends the match after three rounds', () => {
    const s = startFight({ p1: 'craque', p2: 'saci' });
    const r1 = finishRound(s, [0]);
    const r2 = finishRound(r1.state, [1]);
    const r3 = finishRound(r2.state, [0]);
    expect(r3.state).toMatchObject({ phase: 'matchEnd', winner: 1, banner: 'P2 WINS', round: 3, wins: [1, 2] });
  });

  it('draw rounds give extra rounds but never more than 5', () => {
    let s = startFight({ p1: 'craque', p2: 'saci' });
    const rounds: number[] = [];
    for (let i = 0; i < 6 && s.phase !== 'matchEnd'; i += 1) {
      rounds.push(s.round);
      s = finishRound(s, [0, 1]).state;
    }
    expect(rounds).toEqual([1, 2, 3, 4, 5]);
    expect(s).toMatchObject({ phase: 'matchEnd', winner: null, banner: 'DRAW', round: 5, wins: [0, 0] });
  });

  it('a draw then two wins still needs only two wins', () => {
    const s = startFight({ p1: 'craque', p2: 'saci' });
    const r1 = finishRound(s, [0, 1]);
    const r2 = finishRound(r1.state, [0]);
    const r3 = finishRound(r2.state, [0]);
    expect(r3.state).toMatchObject({ phase: 'matchEnd', winner: 1, round: 3, wins: [0, 2] });
  });

  it('after the last allowed round, more wins then more total health decide', () => {
    const base = createMatch({ p1: 'craque', p2: 'saci' });
    expect(decideMatch({ ...base, round: 3, wins: [1, 1] })).toBeUndefined();
    expect(decideMatch({ ...base, round: 2, wins: [2, 0] })).toBe(0);
    expect(decideMatch({ ...base, round: 5, wins: [1, 0] })).toBe(0);
    expect(decideMatch({ ...base, round: 5, wins: [1, 1], healthTotals: [500, 800] })).toBe(1);
    expect(decideMatch({ ...base, round: 5, wins: [0, 0], healthTotals: [900, 300] })).toBe(0);
    expect(decideMatch({ ...base, round: 5, wins: [1, 1], healthTotals: [700, 700] })).toBeNull();
  });

  it('rounds option changes the wins needed', () => {
    const s = startFight({ p1: 'craque', p2: 'saci', rounds: 1 });
    expect(s.config.winsNeeded).toBe(1);
    const r = finishRound(s, [1]);
    expect(r.state).toMatchObject({ phase: 'matchEnd', winner: 0 });
  });

  it('rejects unknown characters', () => {
    expect(() => createMatch({ p1: 'craque', p2: 'nobody' })).toThrow();
  });
});

describe('determinism', () => {
  /** Pseudo-random but fully scripted inputs (pure function of the frame). */
  function scripted(seed: number): (i: number) => InputPair {
    const at = (i: number, salt: number): number => {
      const v = Math.imul((i + 1) * 2654435761 + salt * 40503 + seed * 97, 2246822519) >>> 0;
      return (v >>> 8) % 100;
    };
    const one = (i: number, salt: number): PlayerInput => {
      const block = Math.floor(i / 6);
      return input({
        left: at(block, salt + 1) < 25,
        right: at(block, salt + 2) < 40,
        up: at(block, salt + 3) < 6,
        down: at(block, salt + 4) < 15,
        punch: at(i, salt + 5) < 10,
        kick: at(i, salt + 6) < 8,
        special: at(i, salt + 7) < 3,
        block: at(block, salt + 8) < 10,
      });
    };
    return (i) => [one(i, 0), one(i, 50)];
  }

  function hashRun(config: MatchConfig, seed: number): { hash: number; events: number } {
    const run = runFrames(createMatch(config), 600, scripted(seed));
    return { hash: hashSequence(run.states), events: run.events.length };
  }

  it('the same inputs give the identical 600-frame state sequence', () => {
    const config = { p1: 'tiao', p2: 'curupira' };
    const a = hashRun(config, 7);
    const b = hashRun(config, 7);
    expect(a.hash).toBe(b.hash);
    expect(a.events).toBe(b.events);
    expect(a.events).toBeGreaterThan(10);
  });

  it('different inputs give a different sequence', () => {
    const config = { p1: 'tiao', p2: 'curupira' };
    expect(hashRun(config, 7).hash).not.toBe(hashRun(config, 8).hash);
  });

  it('stepMatch never mutates its input state', () => {
    const s = startFight({ p1: 'rosa', p2: 'dalva' });
    const snapshot = JSON.stringify(s);
    stepMatch(s, [input({ right: true, punch: true }), input({ special: true })]);
    expect(JSON.stringify(s)).toBe(snapshot);
  });
});
