import {
  Scene,
  RectShape,
  Text,
  TransitionManager,
  Easing,
  type SceneParams,
  type App,
} from 'easy-game-maker';

const W = 500;
const H = 660;

// Tetromino colors (one per letter of TETRIS)
const TITLE_COLORS = ['#00e5ff', '#ffd600', '#cc00ff', '#00e676', '#ff1744', '#ff6d00'];

export class MenuScene extends Scene {
  private _app!: App;
  private _transitions!: TransitionManager;
  private _blinkText!: Text;
  private _started = false;

  private _keyHandler = (_e: unknown): void => {
    if (this._started) return;
    this._started = true;
    this._app.input.off('keydown', this._keyHandler);
    void this._app.scenes.go('game', {
      transition: 'fade',
      duration: 350,
      params: { app: this._app },
    });
  };

  override onCreate(params?: SceneParams): void {
    this._app = params?.['app'] as App;
    this._transitions = new TransitionManager();
    this._buildScene();
  }

  override onResume(): void {
    this._started = false;
    this._app.input.off('keydown', this._keyHandler);
    this._app.input.on('keydown', this._keyHandler);
    this._startBlink();
  }

  override onPause(): void {
    this._transitions.cancelAll();
  }

  override onDestroy(): void {
    this._app.input.off('keydown', this._keyHandler);
  }

  override onUpdate(dt: number): void {
    this._transitions.update(dt);
  }

  // ── Scene construction ──────────────────────────────────────────────────────

  private _buildScene(): void {
    // Background gradient (layered rects)
    this._bg('#0d0d1a', 0, 0, W, H, 0, 0);
    this._bg('#0a0a30', 0, 0, W, 300, 0, 0); // top has slight blue tint

    // Decorative grid lines
    for (let x = 0; x <= W; x += 28) {
      this._bg('#ffffff06', x, 0, 1, H, 0, 0);
    }
    for (let y = 0; y <= H; y += 28) {
      this._bg('#ffffff06', 0, y, W, 1, 0, 0);
    }

    // ── Title: TETRIS ──────────────────────────────────────────────────────────
    const letters = 'TETRIS'.split('');
    const letterW = 58;
    const titleX = (W - letters.length * letterW) / 2 + letterW / 2;

    letters.forEach((letter, i) => {
      const color = TITLE_COLORS[i] ?? '#ffffff';

      // Glow/shadow block behind each letter
      const glow = new RectShape({
        x: titleX + i * letterW, y: 155,
        width: 52, height: 68,
        fill: color,
      });
      glow.alpha = 0.12;
      glow.anchorX = 0.5; glow.anchorY = 0.5;
      this.add(glow);

      // Letter
      const txt = new Text({
        text: letter,
        x: titleX + i * letterW, y: 155,
        fontSize: 52,
        fontFamily: 'monospace',
        color,
      });
      txt.anchorX = 0.5; txt.anchorY = 0.5;
      this.add(txt);
    });

    // Subtitle
    const sub = new Text({
      text: 'CLASSIC EDITION',
      x: W / 2, y: 204,
      fontSize: 12,
      color: '#ffffff40',
      fontFamily: 'monospace',
    });
    sub.anchorX = 0.5; sub.anchorY = 0.5;
    this.add(sub);

    // Divider
    this._bg('#ffffff20', W / 2, 222, 200, 1);

    // ── Preview blocks (decorative tetrominoes) ───────────────────────────────
    this._drawDecoPiece([
      [0,0],[0,1],[0,2],[0,3]
    ], '#00e5ff', 68, 270, 20);

    this._drawDecoPiece([
      [0,0],[0,1],[1,0],[1,1]
    ], '#ffd600', 160, 262, 20);

    this._drawDecoPiece([
      [0,1],[1,0],[1,1],[1,2]
    ], '#cc00ff', 230, 262, 20);

    this._drawDecoPiece([
      [0,0],[0,1],[1,1],[1,2]
    ], '#00e676', 306, 262, 20);

    this._drawDecoPiece([
      [0,1],[1,0],[1,1],[2,0]
    ], '#ff1744', 386, 255, 20);

    // ── Controls card ─────────────────────────────────────────────────────────
    this._bg('#ffffff08', W / 2, 360, 320, 140);
    this._bg('#ffffff15', W / 2, 360, 322, 142); // border

    this._label('CONTROLS', W / 2, 320, '#ffffff60', 10);

    const controls = [
      ['← →',   'Move'],
      ['↑',      'Rotate'],
      ['↓',      'Soft drop'],
      ['Space',  'Hard drop'],
      ['P',      'Pause'],
    ];
    controls.forEach(([key, action], i) => {
      const y = 340 + i * 22;
      this._label(key ?? '', 190, y, '#00e5ff', 12);
      this._label(action ?? '', 310, y, '#ffffffb0', 12);
    });

    // ── Press any key ─────────────────────────────────────────────────────────
    this._blinkText = new Text({
      text: 'PRESS ANY KEY TO START',
      x: W / 2, y: 590,
      fontSize: 15,
      color: '#ffffff',
      fontFamily: 'monospace',
    });
    this._blinkText.anchorX = 0.5; this._blinkText.anchorY = 0.5;
    this.add(this._blinkText);

    // Version
    this._label('Easy Game Maker v0.1.0', W / 2, 635, '#ffffff25', 10);
  }

  private _startBlink(): void {
    this._transitions.cancelAll();
    this._blinkText.alpha = 1;

    const blink = (): void => {
      this._transitions.to(
        this._blinkText as unknown as Record<string, number>,
        {
          alpha: 0.1,
          duration: 600,
          easing: Easing.inOutSine,
          onComplete: () => {
            this._transitions.to(
              this._blinkText as unknown as Record<string, number>,
              {
                alpha: 1,
                duration: 600,
                easing: Easing.inOutSine,
                onComplete: blink,
              },
            );
          },
        },
      );
    };
    blink();
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private _bg(
    fill: string, x: number, y: number, w: number, h: number,
    anchorX = 0.5, anchorY = 0.5,
  ): RectShape {
    const r = new RectShape({ x, y, width: w, height: h, fill });
    r.anchorX = anchorX; r.anchorY = anchorY;
    this.add(r);
    return r;
  }

  private _label(text: string, x: number, y: number, color: string, size: number): Text {
    const t = new Text({ text, x, y, fontSize: size, color, fontFamily: 'monospace' });
    t.anchorX = 0.5; t.anchorY = 0.5;
    this.add(t);
    return t;
  }

  private _drawDecoPiece(
    cells: Array<[number, number]>, color: string,
    ox: number, oy: number, size: number,
  ): void {
    for (const [r, c] of cells) {
      const block = new RectShape({
        x: ox + c * size + size / 2,
        y: oy + r * size + size / 2,
        width: size - 2,
        height: size - 2,
        fill: color,
      });
      block.alpha = 0.8;
      block.anchorX = 0.5; block.anchorY = 0.5;
      this.add(block);
    }
  }
}
