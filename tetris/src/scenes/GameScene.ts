import {
  Scene,
  RectShape,
  Text,
  type SceneParams,
  type App,
} from 'easy-game-maker';
import { isTouchDevice } from '../helpers/TouchHelper';

// ── Layout constants ──────────────────────────────────────────────────────────

const COLS = 10;
const ROWS = 20;
const CELL = 28;

const BOARD_LEFT = 80;   // left edge of board
const BOARD_TOP = 80;    // top edge of board

const PANEL_X = BOARD_LEFT + COLS * CELL + 30; // score panel x

// ── Game constants ────────────────────────────────────────────────────────────

const SPAWN_ROW = 1;
const SPAWN_COL = 4;

const MOVE_INITIAL = 0.12;  // seconds before key repeat starts
const MOVE_REPEAT  = 0.05;  // seconds between repeats

// Gravity (seconds per drop) per level index 0-10+
const GRAVITY_TABLE = [1.0, 0.85, 0.7, 0.55, 0.42, 0.31, 0.22, 0.15, 0.1, 0.07, 0.05];

// Score per lines cleared (multiplied by level)
const LINE_SCORES = [0, 100, 300, 500, 800];

// ── Piece definitions ─────────────────────────────────────────────────────────

type Cell = [number, number]; // [row, col] offset from pivot

interface PieceDef {
  color: string;
  cells: Cell[];
}

const PIECE_DEFS: PieceDef[] = [
  { color: '#00e5ff', cells: [[0,-1],[0,0],[0,1],[0,2]] },   // I
  { color: '#ffd600', cells: [[0,0],[0,1],[1,0],[1,1]] },    // O
  { color: '#cc00ff', cells: [[-1,0],[0,-1],[0,0],[0,1]] },  // T
  { color: '#00e676', cells: [[-1,0],[-1,1],[0,-1],[0,0]] }, // S
  { color: '#ff1744', cells: [[-1,-1],[-1,0],[0,0],[0,1]] }, // Z
  { color: '#2979ff', cells: [[-1,-1],[0,-1],[0,0],[0,1]] }, // J
  { color: '#ff6d00', cells: [[-1,1],[0,-1],[0,0],[0,1]] },  // L
];

// Pre-compute all 4 rotations for each piece
function rotateCW(cells: Cell[]): Cell[] {
  return cells.map(([r, c]) => [c, -r]);
}

const ALL_ROTATIONS: Cell[][][] = PIECE_DEFS.map((p) => {
  const rots: Cell[][] = [p.cells];
  for (let i = 1; i < 4; i++) rots.push(rotateCW(rots[i - 1]!));
  return rots;
});

// ── Active piece ──────────────────────────────────────────────────────────────

interface ActivePiece {
  type: number;
  rotation: number;
  row: number;
  col: number;
}

function getPieceCells(p: ActivePiece): Cell[] {
  const cells = ALL_ROTATIONS[p.type]?.[p.rotation] ?? [];
  return cells.map(([dr, dc]) => [p.row + dr, p.col + dc]);
}

// ── Collision ─────────────────────────────────────────────────────────────────

function isBlocked(board: (string | null)[][], r: number, c: number): boolean {
  if (c < 0 || c >= COLS || r >= ROWS) return true;
  if (r < 0) return false; // above board = free
  return (board[r]?.[c] ?? null) !== null;
}

function collidesWithBoard(board: (string | null)[][], p: ActivePiece): boolean {
  return getPieceCells(p).some(([r, c]) => isBlocked(board, r, c));
}

// ── GameScene ─────────────────────────────────────────────────────────────────

export class GameScene extends Scene {
  private _app!: App;

  // ── Board cell pool (ROWS × COLS RectShapes) ──────────────────────────────
  private _boardCells: RectShape[] = [];

  // ── Active + ghost + next piece (4 cells each) ────────────────────────────
  private _activeCells: RectShape[] = [];
  private _ghostCells:  RectShape[] = [];
  private _nextCells:   RectShape[] = [];

  // ── HUD text ─────────────────────────────────────────────────────────────
  private _scoreTxt!: Text;
  private _levelTxt!: Text;
  private _linesTxt!: Text;
  private _statusTxt!: Text;

  // ── Game state ────────────────────────────────────────────────────────────
  private _board: (string | null)[][] = [];
  private _piece!: ActivePiece;
  private _nextType = 0;

  private _score = 0;
  private _level = 1;
  private _lines = 0;
  private _highScore = 0;
  private _highScoreTxt!: Text;

  private _gravTimer = 0;
  private _paused = false;
  private _gameOver = false;

  // ── Key hold timers ────────────────────────────────────────────────────────
  private _held: Record<string, number> = {};

  // ── Touch controls ────────────────────────────────────────────────────────
  private _touch = false;
  /** Virtual keys pressed by on-screen buttons. */
  private _vk: Record<string, boolean> = {};

  // ── One-shot key handler ──────────────────────────────────────────────────
  private _keyHandler = (e: unknown): void => {
    const ev = e as { key: string; repeat: boolean };
    if (ev.repeat) return;
    if (this._gameOver) {
      void this._app.scenes.go('menu', {
        transition: 'fade', duration: 350,
        params: { app: this._app },
      });
      return;
    }
    if (ev.key === 'p' || ev.key === 'P') {
      this._paused = !this._paused;
      this._statusTxt.text = this._paused ? 'PAUSED' : '';
      this._statusTxt.alpha = this._paused ? 1 : 0;
    }
    if (!this._paused) {
      if (ev.key === 'ArrowUp' || ev.key === 'x' || ev.key === 'X') this._tryRotate();
      if (ev.key === ' ') this._hardDrop();
    }
  };

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  override onCreate(params?: SceneParams): void {
    this._app = params?.['app'] as App;
    this._touch = isTouchDevice();
    this._buildScene();
    if (this._touch) this._buildTouchButtons();
    this._app.input.on('keydown', this._keyHandler);
    this._resetGame();
  }

  override onResume(): void {
    this._paused = false;
    this._gameOver = false;
    this._resetGame();
  }

  override onDestroy(): void {
    this._app.input.off('keydown', this._keyHandler);
  }

  override onUpdate(dt: number): void {
    if (this._paused || this._gameOver) return;

    // Check both keyboard and virtual (touch) keys
    this._handleRepeat('ArrowLeft',  dt, () => this._tryMove(0, -1));
    this._handleRepeat('ArrowRight', dt, () => this._tryMove(0,  1));
    this._handleRepeat('ArrowDown',  dt, () => { if (!this._tryMove(1, 0)) this._lock(); });

    this._gravTimer += dt;
    const interval = GRAVITY_TABLE[Math.min(this._level - 1, GRAVITY_TABLE.length - 1)] ?? 0.05;
    if (this._gravTimer >= interval) {
      this._gravTimer = 0;
      if (!this._tryMove(1, 0)) this._lock();
    }

    this._renderPieces();
  }

  // ── Scene construction ────────────────────────────────────────────────────

  private _buildScene(): void {
    // ── Background ────────────────────────────────────────────────────────
    this._rect(250, 330, 500, 660, '#0d0d1a', 0, 0); // full bg

    // Board background
    this._rect(
      BOARD_LEFT + (COLS * CELL) / 2,
      BOARD_TOP  + (ROWS * CELL) / 2,
      COLS * CELL + 2, ROWS * CELL + 2,
      '#0a0a22',
    );

    // Grid lines
    for (let c = 1; c < COLS; c++) {
      this._rect(BOARD_LEFT + c * CELL, BOARD_TOP + (ROWS * CELL) / 2, 1, ROWS * CELL, '#ffffff08');
    }
    for (let r = 1; r < ROWS; r++) {
      this._rect(BOARD_LEFT + (COLS * CELL) / 2, BOARD_TOP + r * CELL, COLS * CELL, 1, '#ffffff08');
    }

    // Board border
    this._rect(
      BOARD_LEFT + (COLS * CELL) / 2,
      BOARD_TOP  + (ROWS * CELL) / 2,
      COLS * CELL + 4, ROWS * CELL + 4,
      '#2a2a50',
    );

    // ── Board cell pool ────────────────────────────────────────────────────
    this._boardCells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = new RectShape({
          x: BOARD_LEFT + c * CELL + CELL / 2,
          y: BOARD_TOP  + r * CELL + CELL / 2,
          width: CELL - 2, height: CELL - 2,
          fill: '#0d0d1a',
        });
        cell.anchorX = 0.5; cell.anchorY = 0.5;
        this.add(cell);
        this._boardCells.push(cell);
      }
    }

    // ── Ghost cells (render before active so active is on top) ────────────
    this._ghostCells = this._makeCellPool(4, '#ffffff', 0.18);

    // ── Active piece cells ─────────────────────────────────────────────────
    this._activeCells = this._makeCellPool(4, '#ffffff', 1);

    // ── Right panel ───────────────────────────────────────────────────────
    const px = PANEL_X;

    // Panel bg
    this._rect(px + 45, 330, 100, 570, '#0a0a22', 0, 0);
    this._rect(px + 45, 330, 102, 572, '#1e1e40', 0, 0);

    // Score section
    this._panelLabel('SCORE', px + 10, 90);
    this._scoreTxt = this._panelValue('0', px + 10, 115, '#ffd600');

    this._panelLabel('HIGH', px + 10, 155);
    this._highScoreTxt = this._panelValue('0', px + 10, 178, '#ff6d00');

    // Divider
    this._rect(px + 45, 205, 80, 1, '#ffffff20');

    this._panelLabel('LEVEL', px + 10, 218);
    this._levelTxt = this._panelValue('1', px + 10, 242, '#00e5ff');

    this._panelLabel('LINES', px + 10, 278);
    this._linesTxt = this._panelValue('0', px + 10, 302, '#00e676');

    // Divider
    this._rect(px + 45, 325, 80, 1, '#ffffff20');

    // Next piece section
    this._panelLabel('NEXT', px + 10, 340);
    this._nextCells = this._makeCellPool(4, '#ffffff', 1);

    // Controls hint
    this._panelLabel('← →  move',   px + 10, 450, '#ffffff30', 9);
    this._panelLabel('↑    rotate', px + 10, 466, '#ffffff30', 9);
    this._panelLabel('↓    drop',   px + 10, 482, '#ffffff30', 9);
    this._panelLabel('SPC  hard',   px + 10, 498, '#ffffff30', 9);
    this._panelLabel('P    pause',  px + 10, 514, '#ffffff30', 9);

    // ── Status overlay (PAUSED / GAME OVER) ────────────────────────────────
    this._statusTxt = new Text({
      text: '',
      x: BOARD_LEFT + (COLS * CELL) / 2,
      y: BOARD_TOP  + (ROWS * CELL) / 2,
      fontSize: 22,
      color: '#ffffff',
      fontFamily: 'monospace',
    });
    this._statusTxt.anchorX = 0.5; this._statusTxt.anchorY = 0.5;
    this._statusTxt.alpha = 0;
    this.add(this._statusTxt);
  }

  // ── Game logic ────────────────────────────────────────────────────────────

  private _resetGame(): void {
    this._board = Array.from({ length: ROWS }, () => Array(COLS).fill(null) as (string | null)[]);
    this._score = 0;
    this._level = 1;
    this._lines = 0;
    this._gravTimer = 0;
    this._paused = false;
    this._gameOver = false;
    this._held = {};

    this._scoreTxt.text = '0';
    this._levelTxt.text = '1';
    this._linesTxt.text = '0';
    this._statusTxt.text = '';
    this._statusTxt.alpha = 0;

    this._nextType = Math.floor(Math.random() * PIECE_DEFS.length);
    this._spawnPiece();
    this._renderBoard();
    this._renderPieces();
  }

  private _spawnPiece(): void {
    const type = this._nextType;
    this._nextType = Math.floor(Math.random() * PIECE_DEFS.length);

    this._piece = { type, rotation: 0, row: SPAWN_ROW, col: SPAWN_COL };

    // Center spawn col differently for O piece
    if (type === 1) this._piece.col = 4; // O piece

    if (collidesWithBoard(this._board, this._piece)) {
      this._triggerGameOver();
    }
  }

  private _tryMove(dr: number, dc: number): boolean {
    const next: ActivePiece = { ...this._piece, row: this._piece.row + dr, col: this._piece.col + dc };
    if (collidesWithBoard(this._board, next)) return false;
    this._piece = next;
    return true;
  }

  private _tryRotate(): void {
    const next: ActivePiece = {
      ...this._piece,
      rotation: (this._piece.rotation + 1) % 4,
    };

    // Try plain rotation first
    if (!collidesWithBoard(this._board, next)) {
      this._piece = next;
      return;
    }

    // Simple wall kick: try ±1 column
    for (const dc of [-1, 1, -2, 2]) {
      const kicked: ActivePiece = { ...next, col: next.col + dc };
      if (!collidesWithBoard(this._board, kicked)) {
        this._piece = kicked;
        return;
      }
    }
    // Rotation blocked — do nothing
  }

  private _hardDrop(): void {
    while (this._tryMove(1, 0)) { /* drop */ }
    this._lock();
  }

  private _lock(): void {
    const color = PIECE_DEFS[this._piece.type]?.color ?? '#ffffff';
    for (const [r, c] of getPieceCells(this._piece)) {
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        if (this._board[r]) this._board[r]![c] = color;
      }
    }
    this._clearLines();
    this._spawnPiece();
    this._renderBoard();
  }

  private _clearLines(): void {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      const row = this._board[r];
      if (row && row.every((c) => c !== null)) {
        this._board.splice(r, 1);
        this._board.unshift(Array(COLS).fill(null) as (string | null)[]);
        cleared++;
        r++; // re-check same row index
      }
    }
    if (cleared === 0) return;

    this._lines += cleared;
    const gain = (LINE_SCORES[cleared] ?? 0) * this._level;
    this._score += gain;
    if (this._score > this._highScore) this._highScore = this._score;

    this._level = Math.floor(this._lines / 10) + 1;

    this._scoreTxt.text = String(this._score);
    this._highScoreTxt.text = String(this._highScore);
    this._levelTxt.text = String(this._level);
    this._linesTxt.text = String(this._lines);
  }

  private _triggerGameOver(): void {
    this._gameOver = true;
    this._statusTxt.text = 'GAME OVER\npress any key';
    this._statusTxt.alpha = 1;
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private _renderBoard(): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this._boardCells[r * COLS + c];
        if (!cell) continue;
        const color = this._board[r]?.[c] ?? null;
        if (color) {
          cell.fillColor = RectShape.parseColor(color);
          cell.alpha = 1;
        } else {
          cell.fillColor = [0.05, 0.05, 0.13, 1];
          cell.alpha = 1;
        }
      }
    }
  }

  private _renderPieces(): void {
    if (this._gameOver) {
      this._activeCells.forEach((c) => { c.alpha = 0; });
      this._ghostCells.forEach((c)  => { c.alpha = 0; });
      return;
    }

    const color = PIECE_DEFS[this._piece.type]?.color ?? '#ffffff';
    const parsed = RectShape.parseColor(color);

    // Ghost: drop piece as far as possible
    const ghost = { ...this._piece };
    while (!collidesWithBoard(this._board, { ...ghost, row: ghost.row + 1 })) {
      ghost.row++;
    }

    const activeCells = getPieceCells(this._piece);
    const ghostCells  = getPieceCells(ghost);

    activeCells.forEach(([r, c], i) => {
      const cell = this._activeCells[i];
      if (!cell) return;
      if (r < 0) { cell.alpha = 0; return; }
      cell.x = BOARD_LEFT + c * CELL + CELL / 2;
      cell.y = BOARD_TOP  + r * CELL + CELL / 2;
      cell.fillColor = parsed;
      cell.alpha = 1;
    });

    ghostCells.forEach(([r, c], i) => {
      const cell = this._ghostCells[i];
      if (!cell) return;
      if (r < 0 || (r === this._piece.row && c === this._piece.col)) { cell.alpha = 0; return; }
      cell.x = BOARD_LEFT + c * CELL + CELL / 2;
      cell.y = BOARD_TOP  + r * CELL + CELL / 2;
      cell.fillColor = parsed;
      cell.alpha = 0.2;
    });

    // Next piece preview
    const nextDef = PIECE_DEFS[this._nextType];
    const nextCells = ALL_ROTATIONS[this._nextType]?.[0] ?? [];
    const nextColor = RectShape.parseColor(nextDef?.color ?? '#ffffff');

    const nextOx = PANEL_X + 10;
    const nextOy = 365;
    const ns = 20; // preview cell size

    nextCells.forEach(([dr, dc], i) => {
      const cell = this._nextCells[i];
      if (!cell) return;
      cell.x = nextOx + 40 + dc * ns;
      cell.y = nextOy + dr * ns;
      cell.fillColor = nextColor;
      cell.alpha = 1;
    });

    // Hide unused next cells (O piece only uses 4)
    for (let i = nextCells.length; i < 4; i++) {
      const c = this._nextCells[i];
      if (c) c.alpha = 0;
    }
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  private _handleRepeat(key: string, dt: number, action: () => void): void {
    // Accept both hardware key and virtual (touch) key
    const isDown = this._app.input.isKeyDown(key) || (this._vk[key] ?? false);
    if (isDown) {
      const prev = this._held[key] ?? 0;
      const next = prev + dt;
      this._held[key] = next;

      if (prev === 0) {
        action();
      } else if (prev < MOVE_INITIAL && next >= MOVE_INITIAL) {
        action();
      } else if (next >= MOVE_INITIAL) {
        const prevTick = Math.floor((prev - MOVE_INITIAL) / MOVE_REPEAT);
        const nextTick = Math.floor((next - MOVE_INITIAL) / MOVE_REPEAT);
        if (nextTick > prevTick) action();
      }
    } else {
      this._held[key] = 0;
    }
  }

  // ── Touch buttons ─────────────────────────────────────────────────────────

  private _buildTouchButtons(): void {
    const CW = 500; const CH = 660;
    const BW = 82; const BH = 64;
    const y  = CH - BH / 2 - 4;
    const fill  = '#ffffff12';
    const fill2 = '#ffffff20';

    // Button definitions: [label, virtualKey, x, w, fill]
    const btns: Array<[string, string, number, number, string]> = [
      ['◀', 'ArrowLeft',  54,    BW,    fill ],
      ['▼', 'ArrowDown',  148,   BW,    fill ],
      ['▶', 'ArrowRight', 242,   BW,    fill ],
      ['↺', 'ArrowUp',    352,   BW,    fill2],
      ['⬇', ' ',          444,   BW-10, fill2],
    ];

    for (const [label, vKey, cx, bw, f] of btns) {
      const bg = new RectShape({ x: cx, y, width: bw, height: BH, fill: f });
      bg.anchorX = 0.5; bg.anchorY = 0.5;
      this.add(bg);

      const txt = new Text({ text: label, x: cx, y, fontSize: 24, color: '#ffffffcc', fontFamily: 'monospace' });
      txt.anchorX = 0.5; txt.anchorY = 0.5;
      this.add(txt);

      // Pointer down → press virtual key (one-shot keys use pointerdown)
      this._app.input.on('pointerdown', (e: unknown) => {
        const ev = e as { x: number; y: number };
        if (this._hitBtn(ev.x, ev.y, cx, y, bw, BH)) {
          this._vk[vKey] = true;
          // One-shot actions (rotate, hard drop)
          if (vKey === 'ArrowUp' && !this._paused && !this._gameOver) this._tryRotate();
          if (vKey === ' '       && !this._paused && !this._gameOver) this._hardDrop();
        }
      });

      // Pointer up → release virtual key
      this._app.input.on('pointerup', () => { this._vk[vKey] = false; });
    }
  }

  private _hitBtn(px: number, py: number, cx: number, cy: number, bw: number, bh: number): boolean {
    return Math.abs(px - cx) <= bw/2 && Math.abs(py - cy) <= bh/2;
  }

  // ── Cell pool helpers ──────────────────────────────────────────────────────

  private _makeCellPool(count: number, fill: string, alpha: number): RectShape[] {
    const pool: RectShape[] = [];
    for (let i = 0; i < count; i++) {
      const cell = new RectShape({
        x: -100, y: -100,
        width: CELL - 2, height: CELL - 2,
        fill,
      });
      cell.anchorX = 0.5; cell.anchorY = 0.5;
      cell.alpha = alpha;
      this.add(cell);
      pool.push(cell);
    }
    return pool;
  }

  private _rect(
    x: number, y: number, w: number, h: number,
    fill: string, anchorX = 0.5, anchorY = 0.5,
  ): RectShape {
    const r = new RectShape({ x, y, width: w, height: h, fill });
    r.anchorX = anchorX; r.anchorY = anchorY;
    this.add(r);
    return r;
  }

  private _panelLabel(
    text: string, x: number, y: number,
    color = '#ffffff60', size = 10,
  ): Text {
    const t = new Text({ text, x, y, fontSize: size, color, fontFamily: 'monospace' });
    t.anchorX = 0.5; t.anchorY = 0.5;
    this.add(t);
    return t;
  }

  private _panelValue(text: string, x: number, y: number, color: string): Text {
    const t = new Text({ text, x, y, fontSize: 18, color, fontFamily: 'monospace' });
    t.anchorX = 0.5; t.anchorY = 0.5;
    this.add(t);
    return t;
  }
}
