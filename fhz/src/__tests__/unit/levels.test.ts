import { describe, it, expect } from 'vitest';
import { LEVELS, isLevelDual, type LevelConfig } from '../../config/levels';

describe('LEVELS config', () => {
  it('has at least one level', () => {
    expect(LEVELS.length).toBeGreaterThan(0);
  });

  it('every level has a unique id', () => {
    const ids = LEVELS.map(l => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every level has a name and background', () => {
    for (const l of LEVELS) {
      expect(l.name.length).toBeGreaterThan(0);
      expect(l.background.length).toBeGreaterThan(0);
    }
  });

  it('nextLevel references an existing level id or is null', () => {
    const ids = new Set(LEVELS.map(l => l.id));
    for (const l of LEVELS) {
      if (l.nextLevel !== null) {
        expect(ids.has(l.nextLevel)).toBe(true);
      }
    }
  });

  it('exactly one level has nextLevel = null (the last)', () => {
    const terminal = LEVELS.filter(l => l.nextLevel === null);
    expect(terminal.length).toBe(1);
  });

  describe('single-catapult levels', () => {
    const single = LEVELS.filter(l => !isLevelDual(l));

    it('have zombies, fruits, zombieStartX, zombieY', () => {
      for (const l of single) {
        expect(l.zombies).toBeDefined();
        expect(l.fruits).toBeDefined();
        expect(typeof l.zombieStartX).toBe('number');
        expect(typeof l.zombieY).toBe('number');
      }
    });

    it('have at least 1 zombie and 1 fruit', () => {
      for (const l of single) {
        expect((l.zombies?.length ?? 0)).toBeGreaterThan(0);
        expect((l.fruits?.length ?? 0)).toBeGreaterThan(0);
      }
    });

    it('zombieY is within canvas height (0–320)', () => {
      for (const l of single) {
        if (l.zombieY !== undefined) {
          expect(l.zombieY).toBeGreaterThan(0);
          expect(l.zombieY).toBeLessThan(320);
        }
      }
    });
  });

  describe('dual-catapult levels', () => {
    const dual = LEVELS.filter(l => isLevelDual(l));

    it('each dual level has topLane and bottomLane', () => {
      for (const l of dual) {
        expect(l.dual?.topLane.zombies.length).toBeGreaterThan(0);
        expect(l.dual?.bottomLane.zombies.length).toBeGreaterThan(0);
      }
    });

    it('each lane has at least 1 fruit', () => {
      for (const l of dual) {
        expect((l.dual?.topLane.fruits.length ?? 0)).toBeGreaterThan(0);
        expect((l.dual?.bottomLane.fruits.length ?? 0)).toBeGreaterThan(0);
      }
    });
  });
});

describe('isLevelDual', () => {
  it('returns true only for levels with dual property', () => {
    for (const l of LEVELS) {
      expect(isLevelDual(l)).toBe(l.dual !== undefined);
    }
  });
});
