import { GButton } from 'easy-game-maker';
import { describe, expect, it } from 'vitest';
import { KEY_MAPS, NO_INPUT, edgesOf, keyboardInput, mergeInputs, padInput } from '../../game/controls';
import { INITIAL_VISUAL, decayShake, drawParams, shakeAmount, spawnEffects, stepEffects, stepVisual } from '../../game/fx';
import { FightRunner } from '../../game/runner';
import { createMatch, hashValue, type SimEvent } from '../../sim';

describe('keyboard and gamepad mapping', () => {
  it('maps P1 to WASD plus JKLU and P2 to arrows plus the numpad', () => {
    const down = new Set(['KeyA', 'KeyJ', 'KeyU']);
    expect(keyboardInput((c) => down.has(c), KEY_MAPS[0])).toMatchObject({ left: true, punch: true, block: true, kick: false });
    const down2 = new Set(['ArrowUp', 'Numpad3', 'Numpad2']);
    expect(keyboardInput((c) => down2.has(c), KEY_MAPS[1])).toMatchObject({ up: true, special: true, kick: true, punch: false });
  });
  it('reads the d-pad, the stick and the face buttons of a pad', () => {
    const held = new Set<number>([GButton.X, GButton.DPAD_LEFT]);
    const i = padInput({ down: (b) => held.has(b), stick: () => ({ x: 0, y: 0.9 }) });
    expect(i).toMatchObject({ punch: true, left: true, down: true, kick: false });
    expect(padInput({ down: () => false, stick: () => ({ x: 0.1, y: 0 }) })).toEqual(NO_INPUT);
  });
  it('merges inputs with OR', () => {
    expect(mergeInputs({ ...NO_INPUT, left: true }, { ...NO_INPUT, kick: true })).toMatchObject({ left: true, kick: true, right: false });
  });
  it('turns held states into one-frame edges', () => {
    const idle = { left: false, right: false, up: false, down: false, confirm: false, back: false, start: false };
    const pressed = { ...idle, confirm: true };
    expect(edgesOf(idle, pressed).confirm).toBe(true);
    expect(edgesOf(pressed, pressed).confirm).toBe(false);
  });
});

describe('fx layer', () => {
  it('squashes on landing and relaxes back to 1', () => {
    let v = stepVisual(INITIAL_VISUAL, 0, [{ type: 'land', player: 0, x: 0 }]);
    expect(v.squashY).toBeLessThan(1);
    for (let i = 0; i < 60; i++) v = stepVisual(v, 0, []);
    expect(v.squashY).toBeCloseTo(1, 2);
  });
  it('flashes the defender only and counts the flash down', () => {
    const hit: SimEvent = { type: 'hit', attacker: 0, defender: 1, moveId: 'lightPunch', damage: 10, x: 0, y: 0, special: false, knockdown: false, comboCount: 1, projectile: false };
    expect(stepVisual(INITIAL_VISUAL, 1, [hit]).flash).toBeGreaterThan(0);
    expect(stepVisual(INITIAL_VISUAL, 0, [hit]).flash).toBe(0);
  });
  it('spawns effects for hits and removes them after their life', () => {
    const hit: SimEvent = { type: 'hit', attacker: 0, defender: 1, moveId: 'heavyKick', damage: 10, x: 5, y: 100, special: false, knockdown: true, comboCount: 1, projectile: false };
    let fx = spawnEffects([hit]);
    expect(fx[0]?.kind).toBe('bigHit');
    for (let i = 0; i < 40; i++) fx = stepEffects(fx);
    expect(fx).toHaveLength(0);
  });
  it('shakes on KO and decays', () => {
    expect(shakeAmount([{ type: 'ko', player: 1, x: 0, y: 0 }])).toBeGreaterThan(0);
    expect(decayShake(0.2)).toBe(0);
    expect(decayShake(10)).toBeLessThan(10);
  });
  it('tints red right after a hit', () => {
    const m = createMatch({ p1: 'tiao', p2: 'dalva' });
    const p = drawParams({ ...INITIAL_VISUAL, flash: 8 }, m.fighters[0], 0);
    expect(p.tint[1]).toBeLessThan(1);
  });
});

describe('fight runner', () => {
  const base = { p1: 'tiao', p2: 'rosa', stageId: 'pelourinho', difficulty: 'normal' as const, seed: 3 };
  it('runs exactly one step per 1/60 s regardless of frame size', () => {
    const a = new FightRunner({ ...base, controllers: ['dummy', 'dummy'] });
    const b = new FightRunner({ ...base, controllers: ['dummy', 'dummy'] });
    for (let i = 0; i < 60; i++) a.advance(1 / 60, 1, () => NO_INPUT);
    for (let i = 0; i < 20; i++) b.advance(3 / 60, 1, () => NO_INPUT);
    expect(a.match.frame).toBe(60);
    expect(b.match.frame).toBe(60);
  });
  it('is deterministic with the same seed', () => {
    const run = (): string => {
      const r = new FightRunner({ ...base, controllers: ['cpu', 'cpu'] });
      for (let i = 0; i < 900; i++) r.step(() => NO_INPUT);
      return hashValue(r.match);
    };
    expect(run()).toBe(run());
  });
  it('speeds the simulation up without changing it', () => {
    const slow = new FightRunner({ ...base, controllers: ['cpu', 'cpu'] });
    const fast = new FightRunner({ ...base, controllers: ['cpu', 'cpu'] });
    for (let i = 0; i < 80; i++) slow.advance(1 / 60, 1, () => NO_INPUT);
    for (let i = 0; i < 10; i++) fast.advance(1 / 60, 8, () => NO_INPUT);
    expect(fast.match.frame).toBe(slow.match.frame);
    expect(hashValue(fast.match)).toBe(hashValue(slow.match));
  });
  it('plays a whole CPU vs CPU match to the end', () => {
    const r = new FightRunner({ ...base, controllers: ['cpu', 'cpu'], difficulty: 'hard' });
    let guard = 0;
    while (!r.over && guard++ < 40000) r.step(() => NO_INPUT);
    expect(r.over).toBe(true);
    expect(Math.max(...r.match.wins)).toBeGreaterThanOrEqual(2);
  });
  it('lets a human input move a fighter and leaves the dummy idle and unhurt', () => {
    const r = new FightRunner({ ...base, controllers: ['human', 'dummy'] });
    const x0 = r.match.fighters[0].x;
    for (let i = 0; i < 200; i++) r.step((side) => (side === 0 ? { ...NO_INPUT, right: true } : NO_INPUT));
    expect(r.match.fighters[0].x).toBeGreaterThan(x0);
    expect(r.match.fighters[1].state).toBe('idle');
    expect(r.match.fighters[1].health).toBe(r.match.fighters[1].maxHealth);
  });
});
