/**
 * Deterministic random numbers (mulberry32) with explicit immutable state.
 *
 * API: every draw takes an `Rng` and returns a tuple `[value, nextRng]`; the
 * input Rng is never changed, so the caller threads the returned Rng forward.
 *
 *   const r0 = createRng(42);
 *   const [a, r1] = nextFloat(r0);   // a in [0, 1)
 *   const [b, r2] = nextInt(r1, 6);  // b in 0..5
 */

export interface Rng {
  readonly state: number;
}

export function createRng(seed: number): Rng {
  return { state: seed >>> 0 };
}

export function nextFloat(rng: Rng): readonly [number, Rng] {
  const t = (rng.state + 0x6d2b79f5) >>> 0;
  let r = Math.imul(t ^ (t >>> 15), t | 1);
  r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
  const value = ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  return [value, { state: t }];
}

/** Integer in [0, maxExclusive). */
export function nextInt(rng: Rng, maxExclusive: number): readonly [number, Rng] {
  const [f, next] = nextFloat(rng);
  return [Math.floor(f * Math.max(1, maxExclusive)), next];
}

/** Float in [min, max). */
export function nextRange(rng: Rng, min: number, max: number): readonly [number, Rng] {
  const [f, next] = nextFloat(rng);
  return [min + f * (max - min), next];
}

/** True with probability p. */
export function chance(rng: Rng, p: number): readonly [boolean, Rng] {
  const [f, next] = nextFloat(rng);
  return [f < p, next];
}
