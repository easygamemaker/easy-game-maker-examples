// ── Types ─────────────────────────────────────────────────────────────────────

export type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
export type Color = 'w' | 'b';

export interface Piece {
  readonly type: PieceType;
  readonly color: Color;
}

export interface Move {
  from: readonly [number, number];
  to:   readonly [number, number];
  piece: Piece;
  captured?: Piece;
  special?: 'castleK' | 'castleQ' | 'enPassant' | 'promotion';
  promoteTo?: PieceType;
}

export type Board = (Piece | null)[][];

export interface CastlingRights {
  wK: boolean; wQ: boolean;
  bK: boolean; bQ: boolean;
}

export type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw';

export interface GameState {
  board: Board;
  turn: Color;
  enPassant: readonly [number, number] | null;
  castling: CastlingRights;
  status: GameStatus;
  lastMove: Move | null;
  halfMove: number;   // 50-move rule counter
  moveCount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function opp(c: Color): Color { return c === 'w' ? 'b' : 'w'; }

function inB(r: number, c: number): boolean {
  return r >= 0 && r <= 7 && c >= 0 && c <= 7;
}

function sq(board: Board, r: number, c: number): Piece | null {
  if (!inB(r, c)) return null;
  return board[r]?.[c] ?? null;
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function findKing(board: Board, color: Color): readonly [number, number] {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = sq(board, r, c);
      if (p?.type === 'K' && p.color === color) return [r, c];
    }
  }
  return [-1, -1]; // should never happen in a legal position
}

// ── Attack detection ──────────────────────────────────────────────────────────

export function isAttackedBy(
  board: Board, row: number, col: number, byColor: Color,
): boolean {
  // Pawn attacks
  const pd = byColor === 'w' ? 1 : -1; // white pawns attack upward (from row+1)
  for (const dc of [-1, 1]) {
    const p = sq(board, row + pd, col + dc);
    if (p?.type === 'P' && p.color === byColor) return true;
  }

  type D2 = [number, number];

  // Knight
  for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]] as D2[]) {
    const p = sq(board, row + dr, col + dc);
    if (p?.type === 'N' && p.color === byColor) return true;
  }

  // Diagonals (bishop/queen)
  for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]] as D2[]) {
    let r = row + dr, c = col + dc;
    while (inB(r, c)) {
      const p = sq(board, r, c);
      if (p) {
        if (p.color === byColor && (p.type === 'B' || p.type === 'Q')) return true;
        break;
      }
      r += dr; c += dc;
    }
  }

  // Orthogonals (rook/queen)
  for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]] as D2[]) {
    let r = row + dr, c = col + dc;
    while (inB(r, c)) {
      const p = sq(board, r, c);
      if (p) {
        if (p.color === byColor && (p.type === 'R' || p.type === 'Q')) return true;
        break;
      }
      r += dr; c += dc;
    }
  }

  // King (1 step)
  for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]] as D2[]) {
    const p = sq(board, row + dr, col + dc);
    if (p?.type === 'K' && p.color === byColor) return true;
  }

  return false;
}

export function isInCheck(board: Board, color: Color): boolean {
  const [kr, kc] = findKing(board, color);
  if (kr === -1) return false;
  return isAttackedBy(board, kr, kc, opp(color));
}

// ── Apply move to board in-place (for check testing) ─────────────────────────

function applyToBoard(board: Board, move: Move, turn: Color): void {
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;

  board[tr]![tc] = board[fr]![fc] ?? null;
  board[fr]![fc] = null;

  if (move.special === 'enPassant') {
    const cr = turn === 'w' ? tr + 1 : tr - 1;
    board[cr]![tc] = null;
  }
  if (move.special === 'castleK') {
    // Rook h-file → f-file
    board[tr]![tc - 1] = board[tr]![tc + 1] ?? null;
    board[tr]![tc + 1] = null;
  }
  if (move.special === 'castleQ') {
    // Rook a-file → d-file
    board[tr]![tc + 1] = board[tr]![tc - 2] ?? null;
    board[tr]![tc - 2] = null;
  }
  if (move.special === 'promotion') {
    board[tr]![tc] = { type: move.promoteTo ?? 'Q', color: turn };
  }
}

// ── Pseudo-legal move generators ──────────────────────────────────────────────

function addRay(
  moves: Move[], board: Board, piece: Piece,
  r: number, c: number, directions: readonly (readonly [number, number])[],
): void {
  for (const [dr, dc] of directions) {
    let nr = r + dr, nc = c + dc;
    while (inB(nr, nc)) {
      const target = sq(board, nr, nc);
      if (!target) {
        moves.push({ from: [r, c], to: [nr, nc], piece });
      } else {
        if (target.color !== piece.color) {
          moves.push({ from: [r, c], to: [nr, nc], piece, captured: target });
        }
        break;
      }
      nr += dr; nc += dc;
    }
  }
}

function pawnPseudo(
  state: GameState, r: number, c: number, piece: Piece,
): Move[] {
  const moves: Move[] = [];
  const dr = piece.color === 'w' ? -1 : 1;
  const startRow = piece.color === 'w' ? 6 : 1;
  const promoRow = piece.color === 'w' ? 0 : 7;

  const makeMove = (nr: number, nc: number, captured?: Piece, special?: Move['special']): void => {
    if (nr === promoRow) {
      for (const pt of ['Q', 'R', 'B', 'N'] as PieceType[]) {
        moves.push({ from: [r, c], to: [nr, nc], piece, captured, special: 'promotion', promoteTo: pt });
      }
    } else {
      moves.push({ from: [r, c], to: [nr, nc], piece, captured, special });
    }
  };

  // Forward 1
  if (!sq(state.board, r + dr, c)) {
    makeMove(r + dr, c);
    // Forward 2 from start
    if (r === startRow && !sq(state.board, r + dr * 2, c)) {
      moves.push({ from: [r, c], to: [r + dr * 2, c], piece });
    }
  }

  // Diagonal captures
  for (const dc of [-1, 1]) {
    const nr = r + dr, nc = c + dc;
    if (!inB(nr, nc)) continue;
    const target = sq(state.board, nr, nc);
    if (target && target.color !== piece.color) {
      makeMove(nr, nc, target);
    }
    // En passant
    if (
      state.enPassant &&
      state.enPassant[0] === nr &&
      state.enPassant[1] === nc
    ) {
      const epRow = piece.color === 'w' ? nr + 1 : nr - 1;
      const epPawn = sq(state.board, epRow, nc);
      makeMove(nr, nc, epPawn ?? undefined, 'enPassant');
    }
  }

  return moves;
}

type D2 = [number, number];

function knightPseudo(r: number, c: number, piece: Piece, board: Board): Move[] {
  const moves: Move[] = [];
  for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]] as D2[]) {
    const nr = r + dr, nc = c + dc;
    if (!inB(nr, nc)) continue;
    const target = sq(board, nr, nc);
    if (!target || target.color !== piece.color) {
      moves.push({ from: [r, c], to: [nr, nc], piece, captured: target ?? undefined });
    }
  }
  return moves;
}

function kingPseudo(state: GameState, r: number, c: number, piece: Piece): Move[] {
  const moves: Move[] = [];
  const { board, castling } = state;

  // Normal king moves
  for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]] as D2[]) {
    const nr = r + dr, nc = c + dc;
    if (!inB(nr, nc)) continue;
    const target = sq(board, nr, nc);
    if (!target || target.color !== piece.color) {
      moves.push({ from: [r, c], to: [nr, nc], piece, captured: target ?? undefined });
    }
  }

  // Castling — only if king not currently in check
  if (isInCheck(board, piece.color)) return moves;

  const byOpp = opp(piece.color);

  // Kingside
  const canK = piece.color === 'w' ? castling.wK : castling.bK;
  if (canK && r === (piece.color === 'w' ? 7 : 0)) {
    const r1 = r;
    if (
      !sq(board, r1, 5) && !sq(board, r1, 6) &&
      !isAttackedBy(board, r1, 5, byOpp) &&
      !isAttackedBy(board, r1, 6, byOpp)
    ) {
      moves.push({ from: [r, c], to: [r1, 6], piece, special: 'castleK' });
    }
  }

  // Queenside
  const canQ = piece.color === 'w' ? castling.wQ : castling.bQ;
  if (canQ && r === (piece.color === 'w' ? 7 : 0)) {
    const r1 = r;
    if (
      !sq(board, r1, 3) && !sq(board, r1, 2) && !sq(board, r1, 1) &&
      !isAttackedBy(board, r1, 3, byOpp) &&
      !isAttackedBy(board, r1, 2, byOpp)
    ) {
      moves.push({ from: [r, c], to: [r1, 2], piece, special: 'castleQ' });
    }
  }

  return moves;
}

function pseudoLegal(state: GameState, r: number, c: number): Move[] {
  const piece = sq(state.board, r, c);
  if (!piece || piece.color !== state.turn) return [];
  const b = state.board;

  switch (piece.type) {
    case 'P': return pawnPseudo(state, r, c, piece);
    case 'N': return knightPseudo(r, c, piece, b);
    case 'K': return kingPseudo(state, r, c, piece);
    case 'B': { const m: Move[] = []; addRay(m, b, piece, r, c, [[-1,-1],[-1,1],[1,-1],[1,1]]); return m; }
    case 'R': { const m: Move[] = []; addRay(m, b, piece, r, c, [[-1,0],[1,0],[0,-1],[0,1]]); return m; }
    case 'Q': { const m: Move[] = []; addRay(m, b, piece, r, c, [[-1,-1],[-1,1],[1,-1],[1,1],[-1,0],[1,0],[0,-1],[0,1]]); return m; }
  }
}

// ── Legal move filtering ──────────────────────────────────────────────────────

export function legalMoves(state: GameState, r: number, c: number): Move[] {
  return pseudoLegal(state, r, c).filter((move) => {
    const testBoard = cloneBoard(state.board);
    applyToBoard(testBoard, move, state.turn);
    return !isInCheck(testBoard, state.turn);
  });
}

export function allLegalMoves(state: GameState): Move[] {
  const moves: Move[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = sq(state.board, r, c);
      if (p?.color === state.turn) {
        moves.push(...legalMoves(state, r, c));
      }
    }
  }
  return moves;
}

// ── Apply a move to produce a new game state ──────────────────────────────────

export function applyMove(state: GameState, move: Move): GameState {
  const board = cloneBoard(state.board);
  applyToBoard(board, move, state.turn);

  const castling = { ...state.castling };
  const [fr, fc] = move.from;
  const [tr, tc] = move.to;

  // Update castling rights when king or rook moves/is captured
  if (fr === 7 && fc === 4) { castling.wK = false; castling.wQ = false; }
  if (fr === 0 && fc === 4) { castling.bK = false; castling.bQ = false; }
  if (fr === 7 && fc === 7) castling.wK = false;
  if (fr === 7 && fc === 0) castling.wQ = false;
  if (fr === 0 && fc === 7) castling.bK = false;
  if (fr === 0 && fc === 0) castling.bQ = false;
  if (tr === 7 && tc === 7) castling.wK = false;
  if (tr === 7 && tc === 0) castling.wQ = false;
  if (tr === 0 && tc === 7) castling.bK = false;
  if (tr === 0 && tc === 0) castling.bQ = false;

  // En passant target
  let enPassant: readonly [number, number] | null = null;
  if (move.piece.type === 'P' && Math.abs(tr - fr) === 2) {
    enPassant = [(fr + tr) / 2, fc];
  }

  const nextTurn = opp(state.turn);
  const halfMove = move.captured || move.piece.type === 'P' ? 0 : state.halfMove + 1;
  const moveCount = state.moveCount + (state.turn === 'b' ? 1 : 0);

  const next: GameState = {
    board,
    turn: nextTurn,
    enPassant,
    castling,
    status: 'playing',
    lastMove: move,
    halfMove,
    moveCount,
  };

  // Determine game status
  const inCheck = isInCheck(board, nextTurn);
  const hasMoves = allLegalMoves(next).length > 0;

  if (!hasMoves) {
    next.status = inCheck ? 'checkmate' : 'stalemate';
  } else if (halfMove >= 100) {
    next.status = 'draw';
  } else {
    next.status = inCheck ? 'check' : 'playing';
  }

  return next;
}

// ── Initial state ─────────────────────────────────────────────────────────────

export function initialState(): GameState {
  const B = (t: PieceType): Piece => ({ type: t, color: 'b' });
  const W = (t: PieceType): Piece => ({ type: t, color: 'w' });

  const board: Board = [
    [B('R'), B('N'), B('B'), B('Q'), B('K'), B('B'), B('N'), B('R')],
    [B('P'), B('P'), B('P'), B('P'), B('P'), B('P'), B('P'), B('P')],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [W('P'), W('P'), W('P'), W('P'), W('P'), W('P'), W('P'), W('P')],
    [W('R'), W('N'), W('B'), W('Q'), W('K'), W('B'), W('N'), W('R')],
  ];

  return {
    board,
    turn: 'w',
    enPassant: null,
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    status: 'playing',
    lastMove: null,
    halfMove: 0,
    moveCount: 1,
  };
}
