import {
  Scene, RectShape, Text,
  type SceneParams, type App,
} from 'easy-game-maker';
import {
  initialState, legalMoves, allLegalMoves, applyMove, isInCheck, findKing, opp,
  type GameState, type Move, type Color,
} from '../chess/engine';
import { isTouchDevice } from '../helpers/TouchHelper';

// ── Layout ────────────────────────────────────────────────────────────────────

const CELL  = 60;
const BOARD = 8 * CELL;          // 480
const BL    = 40;                 // board left (room for rank labels)
const BT    = 80;                 // board top
const CW    = 560;                // canvas width
const CH    = 620;                // canvas height

// Square colors
const LIGHT     = '#f0d9b5';
const DARK      = '#b58863';
const SEL       = '#f6f669cc';    // selected square
const MOVE_HL   = '#20a02055';    // valid move dot background
const LAST_HL   = '#cdd16f99';    // last move highlight
const CHECK_HL  = '#ff222288';    // king in check
const CAPTURE   = '#20a02077';    // capture highlight (ring)

// Piece symbols
const SYMBOLS: Record<string, string> = {
  wK:'♔', wQ:'♕', wR:'♖', wB:'♗', wN:'♘', wP:'♙',
  bK:'♚', bQ:'♛', bR:'♜', bB:'♝', bN:'♞', bP:'♟',
};
const PIECE_FONT = '"Apple Symbols","Segoe UI Symbol","Noto Sans Symbols",serif';
const PIECE_SIZE = 38;

// ── GameScene ─────────────────────────────────────────────────────────────────

export class GameScene extends Scene {
  private _app!: App;

  // Display object pools
  private _squares:    RectShape[] = [];   // 64 board squares
  private _highlights: RectShape[] = [];   // 64 highlight overlays
  private _moveHints:  RectShape[] = [];   // up to 28 move hint circles
  private _pieceShadow: Text[]     = [];   // 32 piece shadow texts (outline effect)
  private _pieceTexts: Text[]      = [];   // 32 piece texts

  // HUD
  private _statusTxt!: Text;
  private _turnTxt!:   Text;
  private _moveTxt!:   Text;

  // Promotion UI
  private _promoPanel!: RectShape;
  private _promoTxts: (RectShape | Text)[] = [];
  private _pendingPromoMove: Move | null = null;

  // State
  private _state!: GameState;
  private _selected: readonly [number, number] | null = null;
  private _validMoves: Move[] = [];
  private _dirty = true;

  // ── Key / pointer handlers ────────────────────────────────────────────────

  private _onKey = (e: unknown): void => {
    const ev = e as { key: string };
    if (ev.key === 'n' || ev.key === 'N') {
      this._state = initialState();
      this._selected = null;
      this._validMoves = [];
      this._dirty = true;
    }
    if ((ev.key === 'r' || ev.key === 'R') &&
        this._state.status !== 'checkmate' &&
        this._state.status !== 'stalemate') {
      // Resign: give win to opponent
      this._state = { ...this._state, status: 'checkmate' };
      this._dirty = true;
    }
  };

  private _onPointer = (e: unknown): void => {
    const ev = e as { x: number; y: number };
    if (this._pendingPromoMove) {
      this._handlePromoClick(ev.x, ev.y);
      return;
    }
    const col = Math.floor((ev.x - BL) / CELL);
    const row = Math.floor((ev.y - BT) / CELL);
    if (row < 0 || row > 7 || col < 0 || col > 7) return;
    this._handleSquareClick(row, col);
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  override onCreate(params?: SceneParams): void {
    this._app = params?.['app'] as App;
    this._buildScene();
    this._app.input.on('keydown', this._onKey);
    this._app.input.on('pointerdown', this._onPointer);
    this._state = initialState();
    this._dirty = true;
  }

  override onResume(): void {
    this._state = initialState();
    this._selected = null;
    this._validMoves = [];
    this._pendingPromoMove = null;
    this._promoPanel.visible = false;
    this._dirty = true;
  }

  override onDestroy(): void {
    this._app.input.off('keydown', this._onKey);
    this._app.input.off('pointerdown', this._onPointer);
  }

  override onUpdate(_dt: number): void {
    if (this._dirty) {
      this._render();
      this._dirty = false;
    }
  }

  // ── Scene construction ────────────────────────────────────────────────────

  private _buildScene(): void {
    // ── Layer 1: Static backgrounds (rendered first, always behind everything) ──
    // Full canvas background
    this._r(CW / 2, CH / 2, CW, CH, '#1a1510');
    // Top HUD bar (y: 0→BT)
    this._r(CW / 2, BT / 2, CW, BT, '#120e0a');
    // Bottom HUD bar (y: BT+BOARD→CH)
    const bottomH = CH - BT - BOARD;
    this._r(CW / 2, BT + BOARD + bottomH / 2, CW, bottomH, '#120e0a');

    // ── Layer 2: Board ──────────────────────────────────────────────────────
    // Board frame / shadow
    this._r(BL + BOARD / 2, BT + BOARD / 2, BOARD + 10, BOARD + 10, '#0a0806');

    // 64 board squares
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const fill = (r + c) % 2 === 0 ? LIGHT : DARK;
        const sq = this._r(BL + c * CELL + CELL / 2, BT + r * CELL + CELL / 2, CELL, CELL, fill);
        this._squares.push(sq);
      }
    }

    // 64 highlight overlays (alpha=0 by default)
    for (let i = 0; i < 64; i++) {
      const hl = this._r(
        BL + (i % 8) * CELL + CELL / 2,
        BT + Math.floor(i / 8) * CELL + CELL / 2,
        CELL, CELL, '#00000000',
      );
      hl.alpha = 0;
      this._highlights.push(hl);
    }

    // 28 move hint dots
    for (let i = 0; i < 28; i++) {
      const hint = this._r(-100, -100, CELL, CELL, MOVE_HL);
      hint.alpha = 0;
      this._moveHints.push(hint);
    }

    // Rank labels (1–8)
    for (let r = 0; r < 8; r++) {
      const lbl = new Text({
        text: String(8 - r),
        x: BL - 14, y: BT + r * CELL + CELL / 2,
        fontSize: 11, color: '#9a7a5a', fontFamily: 'monospace',
      });
      lbl.anchorX = 0.5; lbl.anchorY = 0.5;
      this.add(lbl);
    }
    // File labels (a–h)
    for (let c = 0; c < 8; c++) {
      const lbl = new Text({
        text: String.fromCharCode(97 + c),
        x: BL + c * CELL + CELL / 2, y: BT + BOARD + bottomH / 2 - 8,
        fontSize: 11, color: '#9a7a5a', fontFamily: 'monospace',
      });
      lbl.anchorX = 0.5; lbl.anchorY = 0.5;
      this.add(lbl);
    }

    // ── Layer 3: Pieces (above board, below HUD text) ──────────────────────
    for (let i = 0; i < 32; i++) {
      const shadow = new Text({
        text: '', x: -200, y: -200,
        fontSize: PIECE_SIZE + 2, color: '#00000070', fontFamily: PIECE_FONT,
      });
      shadow.anchorX = 0.5; shadow.anchorY = 0.5;
      this.add(shadow);
      this._pieceShadow.push(shadow);

      const piece = new Text({
        text: '', x: -200, y: -200,
        fontSize: PIECE_SIZE, color: '#f5e6cc', fontFamily: PIECE_FONT,
      });
      piece.anchorX = 0.5; piece.anchorY = 0.5;
      this.add(piece);
      this._pieceTexts.push(piece);
    }

    // ── Layer 4: HUD text (rendered last → always readable on top) ─────────
    this._turnTxt = new Text({
      text: '⬜ White to move',
      x: BL, y: BT / 2,
      fontSize: 14, color: '#f0d9b5', fontFamily: 'monospace',
    });
    this._turnTxt.anchorX = 0; this._turnTxt.anchorY = 0.5;
    this.add(this._turnTxt);

    this._moveTxt = new Text({
      text: 'Move 1',
      x: CW - BL, y: BT / 2,
      fontSize: 11, color: '#8a6a50', fontFamily: 'monospace',
    });
    this._moveTxt.anchorX = 1; this._moveTxt.anchorY = 0.5;
    this.add(this._moveTxt);

    this._statusTxt = new Text({
      text: '',
      x: CW / 2, y: BT + BOARD + bottomH / 2 + 6,
      fontSize: 13, color: '#f0d9b5', fontFamily: 'monospace',
    });
    this._statusTxt.anchorX = 0.5; this._statusTxt.anchorY = 0.5;
    this.add(this._statusTxt);

    // Hint adapts to platform
    const isTouch = isTouchDevice();
    const hintText = isTouch
      ? 'Tap piece → tap destination  •  N = new'
      : 'N = new game    R = resign';
    const keyHint = new Text({
      text: hintText,
      x: CW / 2, y: BT + BOARD + bottomH - 10,
      fontSize: 9, color: '#5a4a38', fontFamily: 'monospace',
    });
    keyHint.anchorX = 0.5; keyHint.anchorY = 0.5;
    this.add(keyHint);

    // ── Layer 5: Promotion panel ────────────────────────────────────────────
    this._promoPanel = this._r(CW / 2, CH / 2, 320, 100, '#2a1e10');
    this._promoPanel.visible = false;

    const promoLabel = new Text({
      text: 'Promote to:',
      x: CW / 2, y: CH / 2 - 28,
      fontSize: 13, color: '#f0d9b5', fontFamily: 'monospace',
    });
    promoLabel.anchorX = 0.5; promoLabel.anchorY = 0.5;
    this.add(promoLabel);
    this._promoTxts.push(promoLabel);

    (['Q', 'R', 'B', 'N'] as const).forEach((type, i) => {
      const x = CW / 2 - 60 + i * 40;
      const bg = this._r(x, CH / 2 + 6, 36, 36, '#3a2a18');
      bg.name = `promo_${type}`;
      this._promoTxts.push(bg);
      const t = new Text({
        text: SYMBOLS[`w${type}`] ?? '?',
        x, y: CH / 2 + 6,
        fontSize: 24, color: '#f5e6cc', fontFamily: PIECE_FONT,
      });
      t.anchorX = 0.5; t.anchorY = 0.5;
      this.add(t);
      this._promoTxts.push(t);
    });

    this._promoTxts.forEach((obj) => { obj.visible = false; });
  }

  // ── Click logic ───────────────────────────────────────────────────────────

  private _handleSquareClick(row: number, col: number): void {
    if (this._state.status === 'checkmate' ||
        this._state.status === 'stalemate' ||
        this._state.status === 'draw') return;

    const piece = this._state.board[row]?.[col] ?? null;

    // Case 1: making a move
    if (this._selected !== null) {
      const [sr, sc] = this._selected;

      // Find if this is a valid move destination
      const move = this._validMoves.find(
        (m) => m.to[0] === row && m.to[1] === col,
      );

      if (move) {
        // Pawn promotion: multiple moves go to same square (Q/R/B/N)
        const promos = this._validMoves.filter(
          (m) => m.to[0] === row && m.to[1] === col && m.special === 'promotion',
        );
        if (promos.length > 1) {
          this._showPromoPanel(promos[0]!);
          return;
        }

        this._state = applyMove(this._state, move);
        this._selected = null;
        this._validMoves = [];
        this._dirty = true;
        return;
      }

      // Clicked own piece → change selection
      if (piece && piece.color === this._state.turn) {
        this._selected = [row, col];
        this._validMoves = legalMoves(this._state, row, col);
        this._dirty = true;
        return;
      }

      // Clicked empty/enemy with no move → deselect
      this._selected = null;
      this._validMoves = [];
      this._dirty = true;
      return;
    }

    // Case 2: selecting a piece
    if (piece && piece.color === this._state.turn) {
      this._selected = [row, col];
      this._validMoves = legalMoves(this._state, row, col);
      this._dirty = true;
    }
  }

  private _showPromoPanel(templateMove: Move): void {
    this._pendingPromoMove = templateMove;
    this._promoPanel.visible = true;
    this._promoTxts.forEach((obj) => { obj.visible = true; });
  }

  private _handlePromoClick(px: number, py: number): void {
    const promoOptions = ['Q', 'R', 'B', 'N'] as const;
    promoOptions.forEach((type, i) => {
      const x = CW / 2 - 60 + i * 40;
      if (Math.abs(px - x) < 20 && Math.abs(py - (CH / 2 + 6)) < 20) {
        const move = this._validMoves.find(
          (m) =>
            m.to[0] === this._pendingPromoMove!.to[0] &&
            m.to[1] === this._pendingPromoMove!.to[1] &&
            m.promoteTo === type,
        );
        if (move) {
          this._state = applyMove(this._state, move);
          this._selected = null;
          this._validMoves = [];
        }
        this._pendingPromoMove = null;
        this._promoPanel.visible = false;
        this._promoTxts.forEach((o) => { o.visible = false; });
        this._dirty = true;
      }
    });
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  private _render(): void {
    this._renderBoard();
    this._renderPieces();
    this._renderHUD();
  }

  private _renderBoard(): void {
    const { lastMove, status } = this._state;

    // Reset highlights
    for (let i = 0; i < 64; i++) {
      const hl = this._highlights[i];
      if (hl) { hl.alpha = 0; hl.fillColor = [0, 0, 0, 0]; }
    }

    // Last move highlight
    if (lastMove) {
      const [fr, fc] = lastMove.from;
      const [tr, tc] = lastMove.to;
      this._setHL(fr, fc, LAST_HL);
      this._setHL(tr, tc, LAST_HL);
    }

    // King in check
    if (status === 'check' || status === 'checkmate') {
      const [kr, kc] = findKing(this._state.board, this._state.turn);
      if (kr >= 0) this._setHL(kr, kc, CHECK_HL);
    }

    // Selected square
    if (this._selected) {
      const [sr, sc] = this._selected;
      this._setHL(sr, sc, SEL);
    }

    // Valid move hints
    this._moveHints.forEach((h) => { h.alpha = 0; });
    this._validMoves.forEach((move, i) => {
      const hint = this._moveHints[i];
      if (!hint) return;
      const [tr, tc] = move.to;
      hint.x = BL + tc * CELL + CELL / 2;
      hint.y = BT + tr * CELL + CELL / 2;

      if (move.captured || move.special === 'enPassant') {
        // Capture: ring
        hint.width = CELL; hint.height = CELL;
        hint.fillColor = RectShape.parseColor(CAPTURE);
        hint.alpha = 0.75;
      } else {
        // Empty square: small dot
        hint.width = CELL * 0.34;
        hint.height = CELL * 0.34;
        hint.fillColor = RectShape.parseColor('#20a020');
        hint.alpha = 0.65;
      }
    });
  }

  private _renderPieces(): void {
    // Collect all pieces
    const pieces: Array<{ r: number; c: number; sym: string; color: Color }> = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this._state.board[r]?.[c] ?? null;
        if (p) {
          pieces.push({ r, c, sym: SYMBOLS[`${p.color}${p.type}`] ?? '?', color: p.color });
        }
      }
    }

    // Update piece Text pool
    pieces.forEach(({ r, c, sym, color }, i) => {
      const shadow = this._pieceShadow[i];
      const text = this._pieceTexts[i];
      if (!shadow || !text) return;

      const x = BL + c * CELL + CELL / 2;
      const y = BT + r * CELL + CELL / 2;

      shadow.text = sym; shadow.x = x + 1.5; shadow.y = y + 1.5;
      text.text = sym; text.x = x; text.y = y;
      text.color = color === 'w' ? '#fdf0d0' : '#1a0f05';
    });

    // Hide unused slots
    for (let i = pieces.length; i < 32; i++) {
      const s = this._pieceShadow[i]; const t = this._pieceTexts[i];
      if (s) { s.text = ''; s.x = -200; }
      if (t) { t.text = ''; t.x = -200; }
    }
  }

  private _renderHUD(): void {
    const { turn, status, moveCount } = this._state;
    const turnIcon = turn === 'w' ? '⬜' : '⬛';
    const turnName = turn === 'w' ? 'White' : 'Black';

    if (status === 'checkmate') {
      const winner = opp(turn) === 'w' ? 'White' : 'Black';
      this._turnTxt.text = `${winner} wins!`;
      this._statusTxt.text = `☠  Checkmate — ${winner} wins`;
      this._statusTxt.color = '#e8c060';
    } else if (status === 'stalemate') {
      this._turnTxt.text = '½  Draw';
      this._statusTxt.text = '½  Stalemate — Draw';
      this._statusTxt.color = '#aaaaaa';
    } else if (status === 'draw') {
      this._turnTxt.text = '½  Draw';
      this._statusTxt.text = '½  50-move rule — Draw';
      this._statusTxt.color = '#aaaaaa';
    } else if (status === 'check') {
      this._turnTxt.text = `${turnIcon} ${turnName} — CHECK!`;
      this._statusTxt.text = `⚠  ${turnName} is in check`;
      this._statusTxt.color = '#ff6644';
    } else {
      this._turnTxt.text = `${turnIcon} ${turnName} to move`;
      this._statusTxt.text = this._selected
        ? `${(this._validMoves.length)} legal moves`
        : '';
      this._statusTxt.color = '#8a7a68';
    }

    this._moveTxt.text = `Move ${moveCount}`;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _setHL(r: number, c: number, hex: string): void {
    const hl = this._highlights[r * 8 + c];
    if (!hl) return;
    hl.fillColor = RectShape.parseColor(hex);
    hl.alpha = parseInt(hex.slice(7, 9) || 'cc', 16) / 255;
  }

  private _r(x: number, y: number, w: number, h: number, fill: string, ax = 0.5, ay = 0.5): RectShape {
    const r = new RectShape({ x, y, width: w, height: h, fill });
    r.anchorX = ax; r.anchorY = ay; this.add(r); return r;
  }
}
