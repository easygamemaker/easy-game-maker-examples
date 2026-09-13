/**
 * Tetris rotation logic — extracted from GameScene for pure testing.
 * The rotation formula r[row][col] = original[COLS-1-col][row] is testable
 * without any EGM dependency.
 */
import { describe, it, expect } from 'vitest';

// ── Piece rotation (planck formula from GameScene) ────────────────────────────
type Cell = [number, number];

function rotatePiece(cells: Cell[]): Cell[] {
  return cells.map(([r, c]) => [c, -r] as Cell);
}

function normalizeCells(cells: Cell[]): Cell[] {
  const minR = Math.min(...cells.map(([r]) => r));
  const minC = Math.min(...cells.map(([, c]) => c));
  return cells.map(([r, c]) => [r - minR, c - minC] as Cell);
}

// ── Piece definitions (from GameScene PIECES) ─────────────────────────────────
const PIECES: Record<string, Cell[]> = {
  I: [[0,0],[0,1],[0,2],[0,3]],      // horizontal bar
  O: [[0,0],[0,1],[1,0],[1,1]],      // square
  T: [[0,0],[0,1],[0,2],[1,1]],      // T-shape
  S: [[0,1],[0,2],[1,0],[1,1]],      // S-shape
  Z: [[0,0],[0,1],[1,1],[1,2]],      // Z-shape
  L: [[0,0],[1,0],[2,0],[2,1]],      // L-shape
  J: [[0,1],[1,1],[2,0],[2,1]],      // J-shape
};

function cellsEqual(a: Cell[], b: Cell[]): boolean {
  if (a.length !== b.length) return false;
  const sA = a.map(([r,c]) => `${r},${c}`).sort().join('|');
  const sB = b.map(([r,c]) => `${r},${c}`).sort().join('|');
  return sA === sB;
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('Piece rotation', () => {
  describe('O-piece (square)', () => {
    it('4 rotations return to original shape', () => {
      let p = PIECES.O!;
      for (let i = 0; i < 4; i++) p = normalizeCells(rotatePiece(p));
      expect(cellsEqual(p, normalizeCells(PIECES.O!))).toBe(true);
    });
  });

  describe('I-piece (bar)', () => {
    it('2 rotations return to original orientation', () => {
      let p = normalizeCells(rotatePiece(PIECES.I!));
      p = normalizeCells(rotatePiece(p));
      expect(cellsEqual(p, normalizeCells(PIECES.I!))).toBe(true);
    });

    it('rotated I-piece is vertical (all same column)', () => {
      const rotated = normalizeCells(rotatePiece(PIECES.I!));
      const cols = rotated.map(([, c]) => c);
      expect(new Set(cols).size).toBe(1);
    });
  });

  describe('T-piece', () => {
    it('4 rotations return to original', () => {
      let p = PIECES.T!;
      for (let i = 0; i < 4; i++) p = normalizeCells(rotatePiece(p));
      expect(cellsEqual(p, normalizeCells(PIECES.T!))).toBe(true);
    });

    it('rotation changes shape', () => {
      const original = normalizeCells(PIECES.T!);
      const rotated  = normalizeCells(rotatePiece(PIECES.T!));
      expect(cellsEqual(original, rotated)).toBe(false);
    });
  });

  describe('All pieces', () => {
    it('each piece has exactly 4 cells', () => {
      for (const [name, cells] of Object.entries(PIECES)) {
        expect(cells).toHaveLength(4);
      }
    });

    it('all 4 rotations of every piece return to original', () => {
      for (const [name, piece] of Object.entries(PIECES)) {
        let p = piece;
        for (let i = 0; i < 4; i++) p = normalizeCells(rotatePiece(p));
        expect(cellsEqual(p, normalizeCells(piece))).toBe(true);
      }
    });
  });
});

describe('Board boundary helpers', () => {
  const COLS = 10, ROWS = 20;

  function isInBounds(r: number, c: number): boolean {
    return r >= 0 && r < ROWS && c >= 0 && c < COLS;
  }

  it('center cells are in bounds', () => {
    expect(isInBounds(10, 5)).toBe(true);
  });

  it('top-left corner is in bounds', () => {
    expect(isInBounds(0, 0)).toBe(true);
  });

  it('negative row is out of bounds', () => {
    expect(isInBounds(-1, 0)).toBe(false);
  });

  it('column >= COLS is out of bounds', () => {
    expect(isInBounds(0, COLS)).toBe(false);
  });
});
