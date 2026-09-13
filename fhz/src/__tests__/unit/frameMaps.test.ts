import { describe, it, expect } from 'vitest';

// ── Zombie frame maps ──────────────────────────────────────────────────────────
// All zombies load: 12 walk + 10 collision + 12 run + 8 deteriorate = 42 frames (0–41)
const TOTAL_ZOMBIE_FRAMES = 42;

const ZOMBIE_FRAME_MAPS = {
  ZumbiNormal:  { walk:[0,11], collision:[12,21], run:[22,33], deteriorate:[34,41], hits:1 },
  ZumbiVelho:   { walk:[0,11], collision:[12,21], run:[22,33], deteriorate:[34,41], hits:1 },
  ZumbiGordo:   { walk:[0,11], collision:[12,21], run:[22,33], deteriorate:[34,41], hits:2 },
  ZumbiKid:     { walk:[0,11], collision:[12,21], run:[22,33], deteriorate:[34,41], hits:1 },
  ZumbiMulher:  { walk:[0,11], collision:[12,21], run:[22,33], deteriorate:[34,41], hits:1 },
  ZumbiFortao:  { walk:[0,11], collision:[12,21], run:[22,33], deteriorate:[34,41], hits:2 },
} as const;

// ── Fruit frame maps ───────────────────────────────────────────────────────────
const FRUIT_FRAME_MAPS = {
  Melancia: { normal:[0,11], special:[12,23], collision:[24,28] },
  Maca:     { normal:[0,11], special:[12,25], collision:[0,0]   },
  Laranja:  { normal:[0,11], special:[12,23], collision:[24,24] },
  Abacaxy:  { normal:[0,11], special:[12,23], collision:[24,27] },
  Coco:     { normal:[0,11], special:[12,23], collision:[24,27] },
  Melao:    { normal:[0,11], special:[12,23], collision:[24,24] },
} as const;

describe('Zombie frame maps', () => {
  for (const [name, map] of Object.entries(ZOMBIE_FRAME_MAPS)) {
    describe(name, () => {
      it('walk starts at 0', () => expect(map.walk[0]).toBe(0));
      it('walk ends before collision starts', () => {
        expect(map.walk[1]).toBeLessThan(map.collision[0]);
      });
      it('collision ends before run starts', () => {
        expect(map.collision[1]).toBeLessThan(map.run[0]);
      });
      it('run ends before deteriorate starts', () => {
        expect(map.run[1]).toBeLessThan(map.deteriorate[0]);
      });
      it('deteriorate ends within total frame count', () => {
        expect(map.deteriorate[1]).toBeLessThan(TOTAL_ZOMBIE_FRAMES);
      });
      it('hits is 1 or 2', () => {
        expect([1, 2]).toContain(map.hits);
      });
    });
  }
});

describe('Fruit frame maps', () => {
  for (const [name, map] of Object.entries(FRUIT_FRAME_MAPS)) {
    describe(name, () => {
      it('normal range is valid', () => {
        expect(map.normal[0]).toBeLessThanOrEqual(map.normal[1]);
      });
      it('special range is valid', () => {
        expect(map.special[0]).toBeLessThanOrEqual(map.special[1]);
      });
      it('collision range is valid', () => {
        expect(map.collision[0]).toBeLessThanOrEqual(map.collision[1]);
      });
      it('normal and special do not overlap', () => {
        expect(map.normal[1]).toBeLessThan(map.special[0]);
      });
    });
  }
});
