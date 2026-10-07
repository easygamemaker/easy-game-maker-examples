import { describe, expect, it } from 'vitest';
import { getCharacter } from '../../data/characters';
import { MAX_SEPARATION, MAX_X, MIN_X, P1_START_X, P2_START_X, PUSHBOX_WIDTH, STAGE_WIDTH } from '../../sim/constants';
import { createFighter } from '../../sim/fighter';
import { enforceMaxSeparation, resolvePushboxes } from '../../sim/spacing';
import { input, neutralInput, placeFighters, runFrames, startFight } from '../../sim/testing';
import type { MatchState } from '../../sim/types';

const N = neutralInput();

function fight(x1: number, x2: number, p1 = 'craque', p2 = 'craque'): MatchState {
  return placeFighters(startFight({ p1, p2, hitStopFrames: 0 }), x1, x2);
}

describe('start and walking', () => {
  it('fighters start 400 px apart around the stage center, P1 facing right', () => {
    const s = startFight({ p1: 'tiao', p2: 'rosa' });
    expect(P1_START_X).toBe(STAGE_WIDTH / 2 - 200);
    expect(P2_START_X).toBe(STAGE_WIDTH / 2 + 200);
    expect(s.fighters[0]).toMatchObject({ x: P1_START_X, facing: 1, state: 'idle', pose: 'idle' });
    expect(s.fighters[1]).toMatchObject({ x: P2_START_X, facing: -1 });
  });

  it('walks forward and back at the character speeds', () => {
    const c = getCharacter('rosa');
    const s = fight(500, 1000, 'rosa', 'rosa');
    const fwd = runFrames(s, 10, () => [input({ right: true }), N]);
    expect(fwd.state.fighters[0].x).toBeCloseTo(500 + 10 * c.walkForward);
    expect(fwd.state.fighters[0].state).toBe('walkForward');
    expect(fwd.state.fighters[0].pose).toBe('walk');
    const back = runFrames(s, 10, () => [input({ left: true }), N]);
    expect(back.state.fighters[0].x).toBeCloseTo(500 - 10 * c.walkBack);
  });

  it('left/right are absolute: P2 walks forward with left', () => {
    const run = runFrames(fight(500, 1000), 5, () => [N, input({ left: true })]);
    expect(run.state.fighters[1].state).toBe('walkForward');
    expect(run.state.fighters[1].x).toBeLessThan(1000);
  });

  it('crouch and crouch block poses', () => {
    const crouch = runFrames(fight(500, 1000), 2, () => [input({ down: true }), N]);
    expect(crouch.state.fighters[0].pose).toBe('crouch');
    const cb = runFrames(fight(500, 1000), 2, () => [input({ down: true, block: true }), N]);
    expect(cb.state.fighters[0].state).toBe('blockCrouch');
    expect(cb.state.fighters[0].pose).toBe('crouch_block');
  });

  it('stays inside the stage walls', () => {
    const run = runFrames(fight(100, 900), 60, () => [input({ left: true }), N]);
    expect(run.state.fighters[0].x).toBe(MIN_X);
  });
});

describe('jumping', () => {
  it('jump arc lands back on the ground with land event and captures direction', () => {
    const c = getCharacter('craque');
    const run = runFrames(fight(400, 1100), 80, (i) => [input({ up: i === 0, right: i === 0 }), N]);
    const types = run.events.map((e) => e.type);
    expect(types).toContain('jump');
    expect(types).toContain('land');
    const peak = Math.max(...run.states.map((s) => s.fighters[0].y));
    expect(peak).toBeGreaterThan(150);
    expect(run.states[5]?.fighters[0]).toMatchObject({ state: 'jump', jumpDir: 1, pose: 'jump' });
    const airtime = run.states.findIndex((s, i) => i > 0 && s.fighters[0].y === 0);
    expect(run.state.fighters[0].x).toBeCloseTo(400 + c.jumpForwardSpeed * (airtime + 1), 0);
    expect(run.state.fighters[0].state).toBe('idle');
  });

  it('saci jumps higher than curupira', () => {
    const peak = (id: string) => {
      const run = runFrames(fight(400, 1100, id, 'craque'), 60, (i) => [input({ up: i === 0 }), N]);
      return Math.max(...run.states.map((s) => s.fighters[0].y));
    };
    expect(peak('saci')).toBeGreaterThan(peak('curupira'));
  });

  it('jump kick is the air attack, used once per jump, ends on landing', () => {
    const run = runFrames(fight(400, 1100), 60, (i) => [input({ up: i === 0, kick: i === 10 || i === 30, punch: i === 32 }), N]);
    const starts = run.events.filter((e) => e.type === 'attackStart');
    expect(starts).toHaveLength(1);
    expect(starts[0]).toMatchObject({ moveId: 'jumpKick' });
    expect(run.states[17]?.fighters[0].pose).toBe('jump_kick');
    expect(run.state.fighters[0].state).toBe('idle');
  });
});

describe('facing', () => {
  it('flips both fighters when a jumper crosses over', () => {
    const run = runFrames(fight(700, 790), 80, (i) => [input({ up: i === 0, right: i === 0 }), N]);
    const mid = run.states[20];
    expect(mid?.fighters[0].x).toBeGreaterThan(790);
    expect(mid?.fighters[0].facing).toBe(1);
    expect(mid?.fighters[1].facing).toBe(1);
    expect(run.state.fighters[0].facing).toBe(-1);
    expect(run.state.fighters[1].facing).toBe(1);
    expect(run.state.fighters[0].x).toBeGreaterThan(run.state.fighters[1].x);
  });

  it('never turns during an attack', () => {
    const s = placeFighters(fight(700, 800), 700, 800);
    const turned = { ...s, fighters: [{ ...s.fighters[0], facing: -1 as const }, s.fighters[1]] as const };
    const run = runFrames(turned, 5, (i) => [input({ punch: i === 0 }), N]);
    expect(run.states[0]?.fighters[0].facing).toBe(-1);
    expect(run.state.fighters[0].state).toBe('attack');
    expect(run.state.fighters[0].facing).toBe(-1);
  });
});

describe('pushboxes and separation', () => {
  it('grounded fighters never overlap: the one who walks into a standing opponent is the one stopped', () => {
    const run = runFrames(fight(700, 760), 60, () => [input({ right: true }), N]);
    for (const s of run.states) {
      expect(s.fighters[1].x - s.fighters[0].x).toBeGreaterThanOrEqual(PUSHBOX_WIDTH - 1e-9);
    }
    // rule change of the polish round: the standing fighter is not shoved along, the walker gives way
    expect(run.state.fighters[1].x).toBe(760);
    expect(run.state.fighters[0].x).toBeCloseTo(760 - PUSHBOX_WIDTH);
  });

  it('when both fighters walk into each other the overlap is shared by how far each one travelled', () => {
    const a = { ...createFighter(0, 'craque'), x: 500 };
    const b = { ...createFighter(1, 'craque'), x: 520 };
    // a travelled 6 px towards b, b travelled 2 px towards a
    const prev = [{ ...a, x: 494 }, { ...b, x: 522 }] as const;
    const [ra, rb] = resolvePushboxes([a, b], prev);
    expect(PUSHBOX_WIDTH - 20).toBeGreaterThan(0);
    const overlap = PUSHBOX_WIDTH - 20;
    expect(ra.x).toBeCloseTo(500 - overlap * 0.75);
    expect(rb.x).toBeCloseTo(520 + overlap * 0.25);
    expect(rb.x - ra.x).toBeCloseTo(PUSHBOX_WIDTH);
  });

  it('a dash special never carries the attacker into the defender and stops at the minimum separation', () => {
    const base = fight(600, 900);
    const run = runFrames({ ...base, fighters: [{ ...base.fighters[0], meter: 100 }, base.fighters[1]] }, 90, (i) => [input({ special: i === 0 }), N]);
    for (const s of run.states) expect(s.fighters[1].x - s.fighters[0].x).toBeGreaterThanOrEqual(PUSHBOX_WIDTH - 1e-9);
  });

  it('the attacker is pushed back when the defender is against the wall (hit and block)', () => {
    for (const block of [false, true]) {
      const start = startFight({ p1: 'craque', p2: 'craque', hitStopFrames: 0 });
      const placed = { ...start, fighters: [{ ...start.fighters[0], x: MAX_X - PUSHBOX_WIDTH, facing: 1 as const }, { ...start.fighters[1], x: MAX_X, facing: -1 as const }] as const };
      const run = runFrames(placed, 60, (i) => [input({ kick: i === 0 }), block ? input({ block: true }) : N]);
      const last = run.state.fighters;
      expect(last[1].x).toBeLessThanOrEqual(MAX_X);
      expect(last[0].x).toBeLessThan(MAX_X - PUSHBOX_WIDTH - 1);
      expect(last[1].x - last[0].x).toBeGreaterThanOrEqual(PUSHBOX_WIDTH - 1e-9);
    }
  });

  it('a cornered fighter cannot be pushed through the wall', () => {
    const run = runFrames(fight(1300, MAX_X), 120, () => [input({ right: true }), N]);
    expect(run.state.fighters[1].x).toBe(MAX_X);
    expect(run.state.fighters[0].x).toBeCloseTo(MAX_X - PUSHBOX_WIDTH);
  });

  it('resolvePushboxes splits the overlap and respects walls', () => {
    const a = { ...createFighter(0, 'craque'), x: 500 };
    const b = { ...createFighter(1, 'craque'), x: 530 };
    const [ra, rb] = resolvePushboxes([a, b]);
    expect(ra.x).toBe(515 - PUSHBOX_WIDTH / 2);
    expect(rb.x).toBe(515 + PUSHBOX_WIDTH / 2);
    const [wa, wb] = resolvePushboxes([{ ...a, x: MIN_X }, { ...b, x: MIN_X + 10 }]);
    expect(wa.x).toBe(MIN_X);
    expect(wb.x).toBe(MIN_X + PUSHBOX_WIDTH);
  });

  it('distance never exceeds the maximum separation', () => {
    const run = runFrames(fight(300, 1300), 200, () => [input({ left: true }), input({ right: true })]);
    for (const s of run.states) {
      expect(Math.abs(s.fighters[1].x - s.fighters[0].x)).toBeLessThanOrEqual(MAX_SEPARATION + 1e-9);
    }
    expect(Math.abs(run.state.fighters[1].x - run.state.fighters[0].x)).toBeCloseTo(MAX_SEPARATION);
  });

  it('the fighter moving away gives back the excess', () => {
    const a = { ...createFighter(0, 'craque'), x: 200 };
    const b = { ...createFighter(1, 'craque'), x: 1300 };
    const [ra, rb] = enforceMaxSeparation([a, b], [{ ...a, x: 195 }, b]);
    expect(ra.x).toBe(200);
    expect(rb.x).toBe(1300);
  });

  it('knockback cannot exceed the maximum separation either', () => {
    const run = runFrames(fight(200, 1300), 40, () => [N, input({ left: true })]);
    for (const s of run.states) {
      expect(Math.abs(s.fighters[1].x - s.fighters[0].x)).toBeLessThanOrEqual(MAX_SEPARATION + 1e-9);
    }
  });
});
