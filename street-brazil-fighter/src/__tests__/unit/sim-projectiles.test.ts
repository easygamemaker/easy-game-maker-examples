import { describe, expect, it } from 'vitest';
import { getCharacter } from '../../data/characters';
import type { ProjectileSpecial } from '../../data/characters';
import { STAGE_WIDTH } from '../../sim/constants';
import { advanceProjectiles, cancelClashingProjectiles } from '../../sim/projectiles';
import { input, neutralInput, patchFighters, placeFighters, runFrames, startFight } from '../../sim/testing';
import type { InputPair } from '../../sim/testing';
import type { MatchState, PlayerInput, Projectile, SimEvent } from '../../sim/types';

const N = neutralInput();

function charged(p1: string, p2: string, x1: number, x2: number, meters: readonly [number, number] = [100, 0]): MatchState {
  const s = placeFighters(startFight({ p1, p2, hitStopFrames: 0 }), x1, x2);
  return patchFighters(s, { meter: meters[0] }, { meter: meters[1] });
}

function spec(id: string): ProjectileSpecial {
  const s = getCharacter(id).moves.special.special;
  if (s === undefined || s.kind === 'dash') throw new Error('no projectile');
  return s;
}

const fire = (hold: PlayerInput = N) => (i: number): InputPair => [input({ special: i === 0 }), hold];
const ofType = (events: readonly SimEvent[], type: SimEvent['type']) => events.filter((e) => e.type === type);

function projectile(partial: Partial<Projectile>): Projectile {
  return {
    id: 1, owner: 0, characterId: 'craque', kind: 'projectile', visual: 'fireball', x: 500, y: 120, vx: 10, facing: 1,
    w: 60, h: 60, age: 0, lifetime: 100, damage: 100, level: 'mid', ...partial,
  };
}

describe('projectiles', () => {
  it('spawns on the first active frame of the special in front of the fighter', () => {
    const move = getCharacter('craque').moves.special;
    const run = runFrames(charged('craque', 'craque', 300, 1300), 20, fire());
    const spawnStep = run.states.findIndex((s) => s.projectiles.length > 0);
    expect(spawnStep).toBe(move.startup);
    const p = run.states[spawnStep]?.projectiles[0];
    expect(p).toMatchObject({ owner: 0, x: 300 + spec('craque').spawnOffsetX, y: spec('craque').spawnOffsetY, vx: spec('craque').speed, visual: 'fireball' });
    expect(ofType(run.events, 'projectileSpawn')).toHaveLength(1);
    expect(run.states[0]?.fighters[0].pose).toBe('special_charge');
    expect(run.states[spawnStep]?.fighters[0].pose).toBe('special_release');
  });

  it('moves at constant speed and expires after its lifetime', () => {
    const s = spec('rosa');
    const run = runFrames(charged('rosa', 'craque', 300, 1300), 200, fire());
    const spawnStep = run.states.findIndex((st) => st.projectiles.length > 0);
    const at = (i: number) => run.states[spawnStep + i]?.projectiles[0];
    expect((at(10)?.x ?? 0) - (at(0)?.x ?? 0)).toBeCloseTo(10 * s.speed);
    expect(at(s.lifetime - 1)).toBeDefined();
    expect(at(s.lifetime)).toBeUndefined();
    expect(ofType(run.events, 'projectileExpire')).toHaveLength(1);
    expect(run.state.fighters[1].health).toBe(1000);
  });

  it('is removed when it hits and deals its damage once', () => {
    const move = getCharacter('craque').moves.special;
    const run = runFrames(charged('craque', 'craque', 300, 1000), 120, fire());
    expect(ofType(run.events, 'hit')).toHaveLength(1);
    expect(ofType(run.events, 'projectileHit')).toHaveLength(1);
    expect(run.state.fighters[1].health).toBe(1000 - move.damage);
    expect(run.state.projectiles).toHaveLength(0);
  });

  it('leaves the stage when out of bounds', () => {
    const edge = projectile({ x: STAGE_WIDTH + 25, vx: 10 });
    const moved = advanceProjectiles([edge]);
    expect(moved.projectiles).toHaveLength(0);
    expect(moved.events[0]?.type).toBe('projectileExpire');
    expect(advanceProjectiles([projectile({ x: 700 })]).projectiles).toHaveLength(1);
  });

  it('only one projectile per owner on screen (meter is kept)', () => {
    const run = runFrames(charged('craque', 'craque', 300, 1300), 60, (i) => [input({ special: i === 0 || i === 40 }), N]);
    expect(ofType(run.events, 'specialStart')).toHaveLength(1);
    expect(run.state.fighters[0].meter).toBe(50);
  });

  it('opposing projectiles cancel each other', () => {
    const run = runFrames(charged('craque', 'craque', 400, 1100, [50, 50]), 120, () => [input({ special: true }), input({ special: true })]);
    expect(ofType(run.events, 'projectileClash')).toHaveLength(1);
    expect(ofType(run.events, 'hit')).toHaveLength(0);
    expect(run.state.projectiles).toHaveLength(0);
    const same = cancelClashingProjectiles([projectile({ id: 1 }), projectile({ id: 2 })]);
    expect(same.projectiles).toHaveLength(2);
  });

  it('saci whirlwind passes over a crouching opponent', () => {
    const crouching = runFrames(charged('saci', 'craque', 400, 800), 200, fire(input({ down: true })));
    expect(ofType(crouching.events, 'hit')).toHaveLength(0);
    const standing = runFrames(charged('saci', 'craque', 400, 800), 200, fire());
    expect(ofType(standing.events, 'hit')).toHaveLength(1);
  });

  it('curupira ground wave must be blocked low or jumped, with short range', () => {
    const standBlock = runFrames(charged('curupira', 'craque', 400, 800), 100, fire(input({ block: true })));
    expect(ofType(standBlock.events, 'hit')).toHaveLength(1);
    const lowBlock = runFrames(charged('curupira', 'craque', 400, 800), 100, fire(input({ block: true, down: true })));
    expect(ofType(lowBlock.events, 'block')).toHaveLength(1);
    const jump = runFrames(charged('curupira', 'craque', 400, 800), 100, (i) => [input({ special: i === 0 }), input({ up: i === 28 })]);
    expect(ofType(jump.events, 'hit')).toHaveLength(0);
    const far = runFrames(charged('curupira', 'craque', 400, 1100), 100, fire());
    expect(ofType(far.events, 'hit')).toHaveLength(0);
    expect(ofType(far.events, 'projectileExpire')).toHaveLength(1);
  });

  it('rosa feathers have a wide hitbox', () => {
    const run = runFrames(charged('rosa', 'craque', 400, 1300), 20, fire());
    const p = run.state.projectiles[0];
    expect(p?.w).toBe(180);
  });
});

describe('dash special', () => {
  it('tiao meia-lua travels forward, hits once and knocks down', () => {
    const move = getCharacter('tiao').moves.special;
    const run = runFrames(charged('tiao', 'craque', 500, 800), 60, fire());
    expect(run.states[move.startup + 3]?.fighters[0].x).toBeGreaterThan(500);
    const hits = ofType(run.events, 'hit');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ knockdown: true, special: true, damage: move.damage });
    expect(ofType(run.events, 'knockdown')).toHaveLength(1);
  });

  it('chips 10% of its damage when blocked', () => {
    const run = runFrames(charged('tiao', 'craque', 500, 800), 60, fire(input({ block: true })));
    expect(run.state.fighters[1].health).toBe(1000 - 14);
  });
});
