import { describe, expect, it } from 'vitest';
import { getCharacter } from '../../data/characters';
import { blocks, chipDamage, comboScale, scaledDamage } from '../../sim/combat';
import { KNOCKDOWN_LIE_FRAMES } from '../../sim/constants';
import { createFighter } from '../../sim/fighter';
import { input, neutralInput, patchFighters, placeFighters, runFrames, startFight } from '../../sim/testing';
import type { InputPair } from '../../sim/testing';
import type { MatchState, PlayerInput, SimEvent } from '../../sim/types';

const N = neutralInput();

/** Craque mirror, no hit stop, P1 at 700 and P2 at 800 (100 px apart). */
function closeFight(p1 = 'craque', p2 = 'craque', x1 = 700, x2 = 800): MatchState {
  return placeFighters(startFight({ p1, p2, hitStopFrames: 0 }), x1, x2);
}

/** P1 presses `press` on step 0, P2 holds `hold` the whole time. */
function script(press: Partial<PlayerInput>, hold: PlayerInput = N, holdP1: Partial<PlayerInput> = {}) {
  return (i: number): InputPair => [i === 0 ? input({ ...holdP1, ...press }) : input(holdP1), hold];
}

function firstIndex(states: readonly MatchState[], pred: (s: MatchState) => boolean): number {
  return states.findIndex(pred);
}

function eventsOf<T extends SimEvent['type']>(events: readonly SimEvent[], type: T): Extract<SimEvent, { type: T }>[] {
  return events.filter((e): e is Extract<SimEvent, { type: T }> => e.type === type);
}

describe('hit detection and damage', () => {
  it('light punch connects on its first active frame and deals its damage', () => {
    const lp = getCharacter('craque').moves.lightPunch;
    const run = runFrames(closeFight(), 30, script({ punch: true }));
    const hitStep = firstIndex(run.states, (s) => s.fighters[1].health < 1000);
    expect(hitStep).toBe(lp.startup);
    expect(run.states[hitStep]?.fighters[1].health).toBe(1000 - lp.damage);
    const hits = eventsOf(run.events, 'hit');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ attacker: 0, defender: 1, damage: lp.damage, special: false, knockdown: false, moveId: 'lightPunch' });
    expect(hits[0]?.x).toBeGreaterThan(700);
    expect(hits[0]?.x).toBeLessThan(800);
  });

  it('one move hits at most once even with several active frames', () => {
    const run = runFrames(closeFight(), 30, script({ punch: true }));
    expect(eventsOf(run.events, 'hit')).toHaveLength(1);
  });

  it('a move out of range whiffs', () => {
    const run = runFrames(closeFight('craque', 'craque', 500, 900), 30, script({ punch: true }));
    expect(eventsOf(run.events, 'hit')).toHaveLength(0);
    expect(run.state.fighters[1].health).toBe(1000);
  });

  it('heavy kick reaches further than light punch', () => {
    const far = closeFight('craque', 'craque', 600, 790);
    expect(eventsOf(runFrames(far, 30, script({ punch: true })).events, 'hit')).toHaveLength(0);
    expect(eventsOf(runFrames(far, 40, script({ kick: true })).events, 'hit')).toHaveLength(1);
  });

  it('down + punch is the crouch punch and down + kick the sweep', () => {
    const cp = runFrames(closeFight(), 30, script({ punch: true, down: true }, N, { down: true }));
    expect(eventsOf(cp.events, 'attackStart')[0]?.moveId).toBe('crouchPunch');
    const ck = runFrames(closeFight(), 40, script({ kick: true, down: true }, N, { down: true }));
    expect(eventsOf(ck.events, 'attackStart')[0]?.moveId).toBe('crouchKick');
    expect(eventsOf(ck.events, 'knockdown')).toHaveLength(1);
  });

  it('attacks trigger on the rising edge only', () => {
    const run = runFrames(closeFight('craque', 'craque', 300, 1000), 60, () => [input({ punch: true }), N]);
    expect(eventsOf(run.events, 'attackStart')).toHaveLength(1);
  });

  it('a press during recovery is buffered for 4 frames', () => {
    const lp = getCharacter('craque').moves.lightPunch;
    const total = lp.startup + lp.active + lp.recovery;
    const pressAt = total - 3;
    const run = runFrames(closeFight('craque', 'craque', 300, 1000), 40, (i) => [input({ punch: i === 0 || i === pressAt }), N]);
    const starts = run.states.map((s, i) => ({ i, s })).filter(({ i, s }) => s.fighters[0].moveFrame === 1 && i > 0);
    expect(eventsOf(run.events, 'attackStart')).toHaveLength(2);
    expect(starts[0]?.i).toBe(total);
  });

  it('a press made too early (beyond the buffer) is dropped', () => {
    const lp = getCharacter('craque').moves.lightPunch;
    const total = lp.startup + lp.active + lp.recovery;
    const run = runFrames(closeFight('craque', 'craque', 300, 1000), 40, (i) => [input({ punch: i === 0 || i === total - 6 }), N]);
    expect(eventsOf(run.events, 'attackStart')).toHaveLength(1);
  });
});

describe('frame accounting', () => {
  it('hitstun N: defender is back to neutral exactly N frames after the hit frame', () => {
    const lp = getCharacter('craque').moves.lightPunch;
    const run = runFrames(closeFight(), 40, script({ punch: true }));
    const h = lp.startup;
    expect(run.states[h]?.fighters[1].state).toBe('hitstun');
    expect(run.states[h + lp.hitstun - 1]?.fighters[1].state).toBe('hitstun');
    expect(run.states[h + lp.hitstun]?.fighters[1].state).toBe('idle');
  });

  it('the attacker recovers exactly startup + active + recovery frames after starting', () => {
    const lp = getCharacter('craque').moves.lightPunch;
    const total = lp.startup + lp.active + lp.recovery;
    const run = runFrames(closeFight(), 40, script({ punch: true }));
    expect(run.states[0]?.fighters[0].moveFrame).toBe(1);
    expect(run.states[total - 1]?.fighters[0].state).toBe('attack');
    expect(run.states[total - 1]?.fighters[0].movePhase).toBe('recovery');
    expect(run.states[total]?.fighters[0].state).toBe('idle');
  });

  it('blockstun N: blocker leaves blockstun exactly N frames after the block frame', () => {
    const lp = getCharacter('craque').moves.lightPunch;
    const run = runFrames(closeFight(), 40, script({ punch: true }, input({ block: true })));
    const h = lp.startup;
    expect(eventsOf(run.events, 'block')).toHaveLength(1);
    expect(run.states[h]?.fighters[1].state).toBe('blockstun');
    expect(run.states[h + lp.blockstun - 1]?.fighters[1].state).toBe('blockstun');
    expect(run.states[h + lp.blockstun]?.fighters[1].state).toBe('blockStand');
    expect(run.state.fighters[1].health).toBe(1000);
  });

  it('light punch is plus on hit and minus on block (frame advantage)', () => {
    const lp = getCharacter('craque').moves.lightPunch;
    const attackerFree = lp.active + lp.recovery;
    expect(lp.hitstun - attackerFree).toBeGreaterThan(0);
    expect(lp.blockstun - attackerFree).toBeLessThanOrEqual(0);
  });

  it('hit stop freezes both fighters and delays recovery by the same amount', () => {
    const lp = getCharacter('craque').moves.lightPunch;
    const state = placeFighters(startFight({ p1: 'craque', p2: 'craque', hitStopFrames: 6 }), 700, 800);
    const run = runFrames(state, 50, script({ punch: true }));
    const h = lp.startup;
    expect(run.states[h]?.hitStop).toBe(6);
    expect(run.states[h + 6]?.hitStop).toBe(0);
    expect(run.states[h + 6 + lp.hitstun - 1]?.fighters[1].state).toBe('hitstun');
    expect(run.states[h + 6 + lp.hitstun]?.fighters[1].state).toBe('idle');
  });
});

describe('blocking rules', () => {
  const holdingRight = { ...createFighter(1, 'craque'), lastInput: input({ right: true }) };
  const crouchBack = { ...holdingRight, lastInput: input({ right: true, down: true }) };
  const blockButton = { ...createFighter(1, 'craque'), lastInput: input({ block: true }) };
  const crouchBlock = { ...blockButton, lastInput: input({ block: true, down: true }) };

  it('needs block or holding away from the attack', () => {
    expect(blocks(createFighter(1, 'craque'), 1, 'mid')).toBe(false);
    expect(blocks(holdingRight, 1, 'mid')).toBe(true);
    expect(blocks(holdingRight, -1, 'mid')).toBe(false);
    expect(blocks(blockButton, -1, 'mid')).toBe(true);
  });

  it('low must be crouch blocked, high must be stand blocked, mid either', () => {
    expect(blocks(blockButton, 1, 'low')).toBe(false);
    expect(blocks(crouchBlock, 1, 'low')).toBe(true);
    expect(blocks(crouchBack, 1, 'low')).toBe(true);
    expect(blocks(blockButton, 1, 'high')).toBe(true);
    expect(blocks(crouchBlock, 1, 'high')).toBe(false);
    expect(blocks(blockButton, 1, 'mid')).toBe(true);
    expect(blocks(crouchBlock, 1, 'mid')).toBe(true);
  });

  it('cannot block while attacking, in hitstun or in the air', () => {
    expect(blocks({ ...blockButton, state: 'attack' }, 1, 'mid')).toBe(false);
    expect(blocks({ ...blockButton, state: 'hitstun' }, 1, 'mid')).toBe(false);
    expect(blocks({ ...blockButton, state: 'jump', y: 50, vy: 3 }, 1, 'mid')).toBe(false);
    expect(blocks({ ...blockButton, state: 'blockstun' }, 1, 'mid')).toBe(true);
  });

  it('a sweep beats a standing block but not a crouching block', () => {
    const sweep = script({ kick: true, down: true }, input({ block: true }), { down: true });
    const standing = runFrames(closeFight(), 40, sweep);
    expect(eventsOf(standing.events, 'hit')).toHaveLength(1);
    const crouching = runFrames(closeFight(), 40, script({ kick: true, down: true }, input({ block: true, down: true }), { down: true }));
    expect(eventsOf(crouching.events, 'block')).toHaveLength(1);
    expect(crouching.state.fighters[1].health).toBe(1000);
  });

  it('holding back blocks automatically and shows the guard pose', () => {
    const run = runFrames(closeFight(), 30, script({ punch: true }, input({ right: true })));
    expect(eventsOf(run.events, 'block')).toHaveLength(1);
    expect(run.states[1]?.fighters[1].state).toBe('blockStand');
    expect(run.states[1]?.fighters[1].pose).toBe('block');
  });

  it('holding back without a threat walks back', () => {
    const state = closeFight('craque', 'craque', 500, 900);
    const run = runFrames(state, 10, () => [N, input({ right: true })]);
    expect(run.state.fighters[1].state).toBe('walkBack');
    expect(run.state.fighters[1].x).toBeGreaterThan(900);
  });
});

describe('meter, chip and cancels', () => {
  it('meter: attacker and defender gain on hit, half on block', () => {
    const lp = getCharacter('craque').moves.lightPunch;
    const hit = runFrames(closeFight(), 30, script({ punch: true }));
    expect(hit.state.fighters[0].meter).toBe(lp.meterGain);
    expect(hit.state.fighters[1].meter).toBe(lp.meterGainDefender);
    const blocked = runFrames(closeFight(), 30, script({ punch: true }, input({ block: true })));
    expect(blocked.state.fighters[0].meter).toBe(Math.floor(lp.meterGain / 2));
    expect(blocked.state.fighters[1].meter).toBe(Math.floor(lp.meterGainDefender / 2));
    expect(lp.meterGainDefender).toBeGreaterThan(lp.meterGain / 2);
  });

  it('special needs 50 meter and consumes it', () => {
    const empty = runFrames(closeFight('craque', 'craque', 400, 1000), 5, script({ special: true }));
    expect(eventsOf(empty.events, 'specialStart')).toHaveLength(0);
    const charged = patchFighters(closeFight('craque', 'craque', 400, 1000), { meter: 70 });
    const run = runFrames(charged, 5, script({ special: true }));
    expect(eventsOf(run.events, 'specialStart')).toHaveLength(1);
    expect(run.state.fighters[0].meter).toBe(20);
  });

  it('specials chip 10% on block, normals do not', () => {
    const fireball = getCharacter('craque').moves.special;
    expect(chipDamage(fireball)).toBe(10);
    expect(chipDamage(getCharacter('craque').moves.heavyKick)).toBe(0);
    const state = patchFighters(closeFight('craque', 'craque', 500, 800), { meter: 50 });
    const run = runFrames(state, 60, script({ special: true }, input({ block: true })));
    expect(eventsOf(run.events, 'block')[0]).toMatchObject({ chip: 10, special: true, projectile: true });
    expect(run.state.fighters[1].health).toBe(990);
  });

  it('a special cancels a normal that connected, spending meter', () => {
    const state = patchFighters(closeFight(), { meter: 50 });
    const lp = getCharacter('craque').moves.lightPunch;
    const run = runFrames(state, 40, (i) => [input({ punch: i === 0, special: i === lp.startup + 1 }), N]);
    const starts = eventsOf(run.events, 'attackStart').map((e) => e.moveId);
    expect(starts).toEqual(['lightPunch', 'special']);
    expect(run.states[lp.startup + 1]?.fighters[0].moveId).toBe('special');
    expect(run.states[lp.startup + 1]?.fighters[0].meter).toBe(50 + lp.meterGain - 50);
  });

  it('a special cannot cancel a whiffed normal', () => {
    const state = patchFighters(closeFight('craque', 'craque', 400, 1000), { meter: 50 });
    const lp = getCharacter('craque').moves.lightPunch;
    const run = runFrames(state, 12, (i) => [input({ punch: i === 0, special: i === lp.startup + 1 }), N]);
    expect(eventsOf(run.events, 'attackStart').map((e) => e.moveId)).toEqual(['lightPunch']);
  });
});

describe('combo scaling', () => {
  it('scales 1.0, 0.9, 0.8 ... down to 0.4', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 10].map((n) => Number(comboScale(n).toFixed(2)))).toEqual([1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.4, 0.4]);
    expect(scaledDamage(50, 3)).toBe(35);
  });

  it('applies to the current combo of the defender and resets on neutral', () => {
    const lp = getCharacter('craque').moves.lightPunch;
    const state = patchFighters(closeFight(), {}, { comboCount: 3 });
    const run = runFrames(state, 40, script({ punch: true }));
    const hit = eventsOf(run.events, 'hit')[0];
    expect(hit?.damage).toBe(Math.round(lp.damage * 0.7));
    expect(hit?.comboCount).toBe(4);
    expect(run.states[lp.startup]?.fighters[1].comboCount).toBe(4);
    expect(run.states[lp.startup + lp.hitstun]?.fighters[1].comboCount).toBe(0);
  });

  it('a special cancel combo counts hits and scales the second hit', () => {
    const lp = getCharacter('craque').moves.lightPunch;
    const fireball = getCharacter('craque').moves.special;
    const state = patchFighters(closeFight(), { meter: 50 });
    const run = runFrames(state, 40, (i) => [input({ punch: i === 0, special: i === lp.startup + 1 }), N]);
    const hits = eventsOf(run.events, 'hit');
    expect(hits).toHaveLength(2);
    expect(hits[1]?.comboCount).toBe(2);
    expect(hits[1]?.special).toBe(true);
    expect(hits[1]?.damage).toBe(Math.round(fireball.damage * 0.9));
  });

  it('a hit after the defender recovered starts a new combo', () => {
    const lp = getCharacter('craque').moves.lightPunch;
    const total = lp.startup + lp.active + lp.recovery;
    const state = placeFighters(startFight({ p1: 'craque', p2: 'craque', hitStopFrames: 0 }), 700, 780);
    const run = runFrames(state, 40, (i) => [input({ punch: i === 0 || i === total }), N]);
    const hits = eventsOf(run.events, 'hit');
    expect(hits).toHaveLength(2);
    expect(hits[1]?.comboCount).toBe(1);
    expect(hits[1]?.damage).toBe(lp.damage);
  });
});

describe('knockdown and wake up', () => {
  it('a sweep knocks down; the fighter lies invulnerable then wakes up', () => {
    const run = runFrames(closeFight(), 120, (i) => [input({ kick: i === 0, down: i < 30, punch: i === 40 || i === 60 }), N]);
    const kd = run.states.findIndex((s) => s.fighters[1].state === 'knockdown');
    expect(kd).toBeGreaterThan(0);
    expect(eventsOf(run.events, 'knockdown')).toHaveLength(1);
    const landing = run.states.findIndex((s, i) => i > kd && s.fighters[1].state === 'knockdown' && s.fighters[1].y === 0);
    expect(run.states[landing]?.fighters[1].pose).toBe('down');
    expect(run.states[kd]?.fighters[1].pose).toBe('hit');
    expect(run.states[landing + KNOCKDOWN_LIE_FRAMES - 1]?.fighters[1].state).toBe('knockdown');
    expect(run.states[landing + KNOCKDOWN_LIE_FRAMES]?.fighters[1].state).toBe('idle');
    expect(eventsOf(run.events, 'wakeUp')).toHaveLength(1);
    // punches thrown while the opponent is down do not connect
    expect(eventsOf(run.events, 'hit')).toHaveLength(1);
  });

  it('air hits always knock down', () => {
    const state = patchFighters(closeFight(), {}, { state: 'jump', y: 120, vy: -2 });
    const run = runFrames(state, 20, script({ kick: true }));
    expect(eventsOf(run.events, 'hit')[0]?.knockdown).toBe(true);
  });

  it('the attacker is pushed back when the defender is cornered', () => {
    const cornered = closeFight('craque', 'craque', 1400, 1500);
    const run = runFrames(cornered, 30, script({ kick: true }));
    expect(eventsOf(run.events, 'hit')).toHaveLength(1);
    expect(run.state.fighters[1].x).toBe(1500);
    expect(run.state.fighters[0].x).toBeLessThan(1400);
  });
});
