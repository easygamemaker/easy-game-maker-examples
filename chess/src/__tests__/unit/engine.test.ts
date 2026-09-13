/**
 * Chess engine unit tests.
 *
 * Board coordinate system (from engine.ts initialState):
 *   row 0 = black back rank (rank 8)
 *   row 1 = black pawns    (rank 7)
 *   row 6 = white pawns    (rank 2)
 *   row 7 = white back rank (rank 1)
 *   col 0-7 = a-h files
 */
import { describe, it, expect } from 'vitest';
import {
  initialState, applyMove, allLegalMoves,
  type GameState, type Move,
} from '../../chess/engine';

// ── Helpers ────────────────────────────────────────────────────────────────────
function makeMove(s: GameState, fr: number, fc: number, tr: number, tc: number): GameState {
  const moves = allLegalMoves(s);
  const m = moves.find(mv => mv.from[0]===fr && mv.from[1]===fc && mv.to[0]===tr && mv.to[1]===tc);
  if (!m) throw new Error(`No legal move [${fr},${fc}]→[${tr},${tc}]`);
  return applyMove(s, m);
}

// ── Initial state ───────────────────────────────────────────────────────────────
describe('initialState', () => {
  it('creates a 8×8 board', () => {
    const s = initialState();
    expect(s.board).toHaveLength(8);
    expect(s.board[0]).toHaveLength(8);
  });

  it('white moves first', () => {
    expect(initialState().turn).toBe('w');
  });

  it('game status is playing', () => {
    expect(initialState().status).toBe('playing');
  });

  it('white pawns are on row 6, black on row 1', () => {
    const { board } = initialState();
    for (let c = 0; c < 8; c++) {
      expect(board[6]?.[c]?.type).toBe('P');
      expect(board[6]?.[c]?.color).toBe('w');
      expect(board[1]?.[c]?.type).toBe('P');
      expect(board[1]?.[c]?.color).toBe('b');
    }
  });

  it('white king on row 7 col 4, black king on row 0 col 4', () => {
    const { board } = initialState();
    expect(board[7]?.[4]?.type).toBe('K');
    expect(board[7]?.[4]?.color).toBe('w');
    expect(board[0]?.[4]?.type).toBe('K');
    expect(board[0]?.[4]?.color).toBe('b');
  });

  it('all castling rights enabled', () => {
    const { castling } = initialState();
    expect(castling.wK && castling.wQ && castling.bK && castling.bQ).toBe(true);
  });
});

// ── Legal move count ─────────────────────────────────────────────────────────
describe('Legal move generation', () => {
  it('white has exactly 20 legal moves from initial position', () => {
    expect(allLegalMoves(initialState())).toHaveLength(20);
  });
});

// ── Pawn moves ─────────────────────────────────────────────────────────────────
describe('Pawn moves', () => {
  it('white pawn can advance 1 square (row 6→5)', () => {
    const moves = allLegalMoves(initialState());
    expect(moves.some(m => m.from[0]===6 && m.to[0]===5)).toBe(true);
  });

  it('white pawn can advance 2 squares from start (row 6→4)', () => {
    const moves = allLegalMoves(initialState());
    expect(moves.some(m => m.from[0]===6 && m.to[0]===4)).toBe(true);
  });
});

// ── Turn alternation ────────────────────────────────────────────────────────
describe('Turn alternation', () => {
  it('switches to black after white moves', () => {
    const s = makeMove(initialState(), 6, 4, 4, 4); // e4
    expect(s.turn).toBe('b');
  });

  it('switches back to white after black moves', () => {
    let s = makeMove(initialState(), 6, 4, 4, 4); // e4
    s = makeMove(s, 1, 4, 3, 4);                  // e5
    expect(s.turn).toBe('w');
  });
});

// ── Checkmate ─────────────────────────────────────────────────────────────────
describe("Fool's Mate — fastest checkmate", () => {
  // 1.f3 e5  2.g4 Qh4#
  // Board coords: white f2=(6,5), g2=(6,6); black e7=(1,4), d8=(0,3)→h4=(4,7)
  it('results in checkmate after 4 half-moves', () => {
    let s = initialState();
    s = makeMove(s, 6, 5, 5, 5);  // f2→f3
    s = makeMove(s, 1, 4, 3, 4);  // e7→e5
    s = makeMove(s, 6, 6, 4, 6);  // g2→g4
    s = makeMove(s, 0, 3, 4, 7);  // Qd8→h4#
    expect(s.status).toBe('checkmate');
  });

  it('checkmated side has 0 legal moves', () => {
    let s = initialState();
    s = makeMove(s, 6, 5, 5, 5);
    s = makeMove(s, 1, 4, 3, 4);
    s = makeMove(s, 6, 6, 4, 6);
    s = makeMove(s, 0, 3, 4, 7);
    expect(allLegalMoves(s)).toHaveLength(0);
  });
});

describe("Scholar's Mate", () => {
  // 1.e4 e5  2.Bc4 Nc6  3.Qh5 Nf6  4.Qxf7#
  it('results in checkmate after 7 half-moves', () => {
    let s = initialState();
    s = makeMove(s, 6, 4, 4, 4);  // e2→e4
    s = makeMove(s, 1, 4, 3, 4);  // e7→e5
    s = makeMove(s, 7, 5, 4, 2);  // Bf1→c4
    s = makeMove(s, 0, 1, 2, 2);  // Nb8→c6
    s = makeMove(s, 7, 3, 3, 7);  // Qd1→h5
    s = makeMove(s, 0, 6, 2, 5);  // Ng8→f6
    s = makeMove(s, 3, 7, 1, 5);  // Qh5→f7#
    expect(s.status).toBe('checkmate');
  });
});

// ── applyMove immutability ────────────────────────────────────────────────────
describe('applyMove immutability', () => {
  it('does not mutate the original state', () => {
    const s = initialState();
    const originalTurn = s.turn;
    const pawnBefore   = s.board[6]?.[4];
    makeMove(s, 6, 4, 4, 4);           // e4
    expect(s.turn).toBe(originalTurn);  // still white's turn
    expect(s.board[6]?.[4]).toBe(pawnBefore);  // pawn still at e2
  });

  it('returns a new state object', () => {
    const s = initialState();
    const next = makeMove(s, 6, 4, 4, 4);
    expect(next).not.toBe(s);
  });
});

// ── Castling rights ───────────────────────────────────────────────────────────
describe('Castling rights', () => {
  it('all 4 rights start as true', () => {
    const { castling } = initialState();
    expect(castling.wK).toBe(true);
    expect(castling.wQ).toBe(true);
    expect(castling.bK).toBe(true);
    expect(castling.bQ).toBe(true);
  });

  it('rights are preserved after pawn moves', () => {
    let s = makeMove(initialState(), 6, 4, 4, 4); // e4
    s = makeMove(s, 1, 4, 3, 4);                  // e5
    expect(s.castling.wK).toBe(true);
    expect(s.castling.bK).toBe(true);
  });
});
