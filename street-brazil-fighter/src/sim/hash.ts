/** Stable 32-bit FNV-1a hash of any JSON-serialisable value (used for determinism checks). */

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function hashString(text: string, seed: number = FNV_OFFSET): number {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME) >>> 0;
  }
  return h >>> 0;
}

export function hashValue(value: unknown, seed?: number): number {
  return hashString(JSON.stringify(value), seed);
}

/** Folds a sequence of values into one hash (order sensitive). */
export function hashSequence(values: readonly unknown[]): number {
  return values.reduce<number>((h, v) => hashValue(v, h), FNV_OFFSET);
}
