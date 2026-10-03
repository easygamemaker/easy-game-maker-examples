import { describe, expect, it } from 'vitest';
import { chance, createRng, nextFloat, nextInt, nextRange } from '../../sim/rng';
import type { Rng } from '../../sim/rng';

function draw(seed: number, n: number): number[] {
  const out: number[] = [];
  let rng: Rng = createRng(seed);
  for (let i = 0; i < n; i += 1) {
    const [v, next] = nextFloat(rng);
    out.push(v);
    rng = next;
  }
  return out;
}

describe('rng (mulberry32, immutable state)', () => {
  it('is deterministic for a seed and does not mutate the input', () => {
    const rng = createRng(42);
    const [a] = nextFloat(rng);
    const [b] = nextFloat(rng);
    expect(a).toBe(b);
    expect(rng).toEqual(createRng(42));
    expect(draw(42, 50)).toEqual(draw(42, 50));
  });

  it('different seeds diverge', () => {
    expect(draw(1, 10)).not.toEqual(draw(2, 10));
  });

  it('values stay in range and are roughly uniform', () => {
    const values = draw(9, 5000);
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });

  it('helpers: nextInt, nextRange, chance', () => {
    let rng = createRng(3);
    for (let i = 0; i < 200; i += 1) {
      const [n, r1] = nextInt(rng, 6);
      const [x, r2] = nextRange(r1, -5, 5);
      expect(Number.isInteger(n) && n >= 0 && n < 6).toBe(true);
      expect(x >= -5 && x < 5).toBe(true);
      rng = r2;
    }
    expect(chance(rng, 0)[0]).toBe(false);
    expect(chance(rng, 1)[0]).toBe(true);
  });
});
