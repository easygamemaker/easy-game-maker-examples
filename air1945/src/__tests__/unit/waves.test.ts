import { describe, it, expect } from 'vitest';
import { WAVES, cloneWaves, type SpawnCmd } from '../../game/waves';
import { SCORE_FIGHTER, SCORE_BOMBER, SCORE_GUNSHIP, SCORE_BOSS } from '../../game/entities';

describe('WAVES data', () => {
  it('has at least one wave', () => {
    expect(WAVES.length).toBeGreaterThan(0);
  });

  it('every wave has spawns array', () => {
    for (const wave of WAVES) {
      expect(Array.isArray(wave.spawns)).toBe(true);
    }
  });

  it('every spawn has required fields', () => {
    for (const wave of WAVES) {
      for (const spawn of wave.spawns) {
        expect(typeof spawn.t).toBe('number');
        expect(typeof spawn.x).toBe('number');
        expect(typeof spawn.vy).toBe('number');
        expect(['fighter', 'bomber', 'gunship']).toContain(spawn.type);
        expect(typeof spawn.spawned).toBe('boolean');
      }
    }
  });

  it('spawn times are non-negative', () => {
    for (const wave of WAVES) {
      for (const spawn of wave.spawns) {
        expect(spawn.t).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('spawn speeds are positive (moving downward)', () => {
    for (const wave of WAVES) {
      for (const spawn of wave.spawns) {
        expect(spawn.vy).toBeGreaterThan(0);
      }
    }
  });

  it('all spawns start as not spawned', () => {
    for (const wave of WAVES) {
      for (const spawn of wave.spawns) {
        expect(spawn.spawned).toBe(false);
      }
    }
  });
});

describe('cloneWaves', () => {
  it('returns same number of waves', () => {
    expect(cloneWaves()).toHaveLength(WAVES.length);
  });

  it('produces independent copies (mutation isolation)', () => {
    const cloned = cloneWaves();
    cloned[0]!.spawns[0]!.spawned = true;
    expect(WAVES[0]!.spawns[0]!.spawned).toBe(false);
  });

  it('each call returns a fresh clone', () => {
    const a = cloneWaves();
    const b = cloneWaves();
    a[0]!.spawns[0]!.spawned = true;
    expect(b[0]!.spawns[0]!.spawned).toBe(false);
  });
});

describe('Scoring hierarchy', () => {
  it('boss is worth more than all enemy types', () => {
    expect(SCORE_BOSS).toBeGreaterThan(SCORE_GUNSHIP);
    expect(SCORE_BOSS).toBeGreaterThan(SCORE_BOMBER);
    expect(SCORE_BOSS).toBeGreaterThan(SCORE_FIGHTER);
  });

  it('gunship > bomber > fighter', () => {
    expect(SCORE_GUNSHIP).toBeGreaterThan(SCORE_BOMBER);
    expect(SCORE_BOMBER).toBeGreaterThan(SCORE_FIGHTER);
  });

  it('all score values are positive', () => {
    expect(SCORE_FIGHTER).toBeGreaterThan(0);
    expect(SCORE_BOMBER).toBeGreaterThan(0);
    expect(SCORE_GUNSHIP).toBeGreaterThan(0);
    expect(SCORE_BOSS).toBeGreaterThan(0);
  });
});
