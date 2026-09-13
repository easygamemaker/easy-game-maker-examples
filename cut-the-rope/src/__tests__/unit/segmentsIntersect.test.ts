import { describe, it, expect } from 'vitest';
import { segmentsIntersect } from '../../helpers/segmentsIntersect';

// segmentsIntersect(ax,ay, bx,by, cx,cy, dx,dy)
// Returns true if segment AB intersects segment CD

describe('segmentsIntersect', () => {
  describe('normal intersections', () => {
    it('crossing perpendicular segments intersect', () => {
      // AB: (0,0)→(10,0)  CD: (5,-5)→(5,5)  — cross at (5,0)
      expect(segmentsIntersect(0,0, 10,0, 5,-5, 5,5)).toBe(true);
    });

    it('diagonal segments crossing at center', () => {
      // AB: (0,0)→(10,10)  CD: (0,10)→(10,0)  — cross at (5,5)
      expect(segmentsIntersect(0,0, 10,10, 0,10, 10,0)).toBe(true);
    });

    it('crossing at endpoint of one segment', () => {
      // AB: (0,0)→(10,0)  CD: (10,-5)→(10,5)  — touch at (10,0)
      expect(segmentsIntersect(0,0, 10,0, 10,-5, 10,5)).toBe(true);
    });
  });

  describe('non-intersecting cases', () => {
    it('parallel horizontal segments do not intersect', () => {
      expect(segmentsIntersect(0,0, 10,0, 0,5, 10,5)).toBe(false);
    });

    it('parallel vertical segments do not intersect', () => {
      expect(segmentsIntersect(0,0, 0,10, 5,0, 5,10)).toBe(false);
    });

    it('collinear non-overlapping segments do not intersect', () => {
      expect(segmentsIntersect(0,0, 4,0, 6,0, 10,0)).toBe(false);
    });

    it('segments on same line but gap between them', () => {
      expect(segmentsIntersect(0,0, 3,3, 5,5, 9,9)).toBe(false);
    });

    it('T-shape: one segment ends before reaching other', () => {
      // AB: (0,5)→(4,5)   CD: (6,0)→(6,10) — no intersection, gap
      expect(segmentsIntersect(0,5, 4,5, 6,0, 6,10)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('identical segments return true (complete overlap)', () => {
      expect(segmentsIntersect(0,0, 5,5, 0,0, 5,5)).toBe(true);
    });

    it('zero-length segment that lies on the other returns true', () => {
      // Point (5,0) on segment (0,0)→(10,0)
      expect(segmentsIntersect(0,0, 10,0, 5,0, 5,0)).toBe(true);
    });

    it('large coordinate values still work', () => {
      expect(segmentsIntersect(0,0, 1000,1000, 0,1000, 1000,0)).toBe(true);
    });

    it('negative coordinates', () => {
      expect(segmentsIntersect(-10,-10, 10,10, -10,10, 10,-10)).toBe(true);
    });
  });

  describe('rope cutting scenarios', () => {
    it('horizontal swipe crosses vertical rope segment', () => {
      // Rope goes from (100,50) to (100,200) — vertical
      // Swipe goes from (50,120) to (150,120) — horizontal
      expect(segmentsIntersect(100,50, 100,200, 50,120, 150,120)).toBe(true);
    });

    it('swipe that misses rope returns false', () => {
      // Rope: (100,50)→(100,200)  Swipe: (110,100)→(200,100) — starts after rope x
      expect(segmentsIntersect(100,50, 100,200, 110,100, 200,100)).toBe(false);
    });

    it('diagonal rope cut', () => {
      // Rope diagonal: (50,50)→(150,200)  Swipe: (50,200)→(200,50)
      expect(segmentsIntersect(50,50, 150,200, 50,200, 200,50)).toBe(true);
    });
  });
});
