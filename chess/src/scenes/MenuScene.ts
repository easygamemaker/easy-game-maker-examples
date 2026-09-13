import {
  Scene, RectShape, Text, TransitionManager, Easing,
  type SceneParams, type App,
} from 'easy-game-maker';

const W = 560;
const H = 620;

// Design tokens
const GOLD    = '#c8a96e';
const GOLD_DIM = '#7a5a30';
const CREAM   = '#f0e6d0';
const BG      = '#0c0905';

export class MenuScene extends Scene {
  private _app!: App;
  private _transitions!: TransitionManager;
  private _blinkText!: Text;
  private _diamonds: RectShape[] = [];
  private _ready = false;

  private _onKey = (e: unknown): void => {
    const ev = e as { key: string };
    if (ev.key !== ' ') return;
    if (this._ready) return;
    this._ready = true;
    this._app.input.off('keydown', this._onKey);
    void this._app.scenes.go('game', {
      transition: 'fade', duration: 400,
      params: { app: this._app },
    });
  };

  override onCreate(params?: SceneParams): void {
    this._app = params?.['app'] as App;
    this._transitions = new TransitionManager();
    this._build();
  }

  override onResume(): void {
    this._ready = false;
    this._app.input.off('keydown', this._onKey);
    this._app.input.on('keydown', this._onKey);
    this._startBlink();
    this._animateDiamonds();
  }

  override onPause(): void { this._transitions.cancelAll(); }

  override onDestroy(): void {
    this._app.input.off('keydown', this._onKey);
  }

  override onUpdate(dt: number): void { this._transitions.update(dt); }

  // ── Build ──────────────────────────────────────────────────────────────────

  private _build(): void {
    // ── Background ──────────────────────────────────────────────────────────
    this._r(W / 2, H / 2, W, H, BG);

    // Vignette top
    this._r(W / 2, 60, W, 120, '#1a100800');
    for (let i = 0; i < 6; i++) {
      const alpha = (0.06 - i * 0.01);
      const h = 10 + i * 8;
      const strip = new RectShape({ x: W / 2, y: h / 2, width: W, height: h, fill: '#c8a96e' });
      strip.alpha = Math.max(0.01, alpha);
      strip.anchorX = 0.5; strip.anchorY = 0.5;
      this.add(strip);
    }

    // ── Outer gold frame ────────────────────────────────────────────────────
    // Two nested border rectangles for depth
    this._r(W / 2, H / 2, 504, 564, GOLD, 0.5, 0.5, 0.18);
    this._r(W / 2, H / 2, 496, 556, BG,   0.5, 0.5, 1.0);
    this._r(W / 2, H / 2, 488, 548, GOLD, 0.5, 0.5, 0.07);

    // Corner ornaments — four L-brackets
    const cx = 28; const cy = 32; // corner inset from canvas edge
    const arm = 24;               // arm length
    const thick = 2;              // line thickness
    // Top-left
    this._r(cx + arm / 2, cy,          arm,   thick, GOLD, 0.5, 0.5, 0.7);
    this._r(cx,           cy + arm / 2, thick, arm,   GOLD, 0.5, 0.5, 0.7);
    // Top-right
    this._r(W - cx - arm / 2, cy,          arm,   thick, GOLD, 0.5, 0.5, 0.7);
    this._r(W - cx,           cy + arm / 2, thick, arm,   GOLD, 0.5, 0.5, 0.7);
    // Bottom-left
    this._r(cx + arm / 2, H - cy,          arm,   thick, GOLD, 0.5, 0.5, 0.7);
    this._r(cx,           H - cy - arm / 2, thick, arm,   GOLD, 0.5, 0.5, 0.7);
    // Bottom-right
    this._r(W - cx - arm / 2, H - cy,          arm,   thick, GOLD, 0.5, 0.5, 0.7);
    this._r(W - cx,           H - cy - arm / 2, thick, arm,   GOLD, 0.5, 0.5, 0.7);

    // ── Top emblem ───────────────────────────────────────────────────────────
    // Central rotating diamond
    const emblem = new RectShape({ x: W / 2, y: 120, width: 40, height: 40, fill: GOLD });
    emblem.rotation = Math.PI / 4;
    emblem.alpha = 0.9;
    emblem.anchorX = 0.5; emblem.anchorY = 0.5;
    this.add(emblem);
    this._diamonds.push(emblem);

    // Inner diamond (cutout effect)
    const innerDiamond = new RectShape({ x: W / 2, y: 120, width: 26, height: 26, fill: BG });
    innerDiamond.rotation = Math.PI / 4;
    innerDiamond.anchorX = 0.5; innerDiamond.anchorY = 0.5;
    this.add(innerDiamond);

    // Tiny center dot
    this._r(W / 2, 120, 6, 6, GOLD);

    // Flanking lines
    this._r(W / 2 - 80, 120, 90, 1, GOLD, 0.5, 0.5, 0.5);
    this._r(W / 2 + 80, 120, 90, 1, GOLD, 0.5, 0.5, 0.5);

    // Dot accents on lines
    this._r(W / 2 - 128, 120, 4, 4, GOLD, 0.5, 0.5, 0.4);
    this._r(W / 2 + 128, 120, 4, 4, GOLD, 0.5, 0.5, 0.4);

    // ── Title ────────────────────────────────────────────────────────────────
    const title = new Text({
      text: 'CHESS',
      x: W / 2, y: 200,
      fontSize: 62, color: GOLD,
      fontFamily: 'monospace',
    });
    title.anchorX = 0.5; title.anchorY = 0.5;
    this.add(title);

    // Subtitle — letter-spaced
    this._txt('C L A S S I C   E D I T I O N', W / 2, 240, '#8a6a40', 11);

    // ── Divider ───────────────────────────────────────────────────────────────
    this._r(W / 2 - 60, 264, 4, 4, GOLD, 0.5, 0.5, 0.6);
    this._r(W / 2,       264, 120, 1, GOLD, 0.5, 0.5, 0.4);
    this._r(W / 2 + 60, 264, 4, 4, GOLD, 0.5, 0.5, 0.6);

    // ── Checkerboard strip ────────────────────────────────────────────────────
    // 8 alternating mini squares — decorative only
    for (let i = 0; i < 16; i++) {
      const col = i % 2 === 0 ? '#c8a96e20' : '#c8a96e08';
      this._r(W / 2 - 7 * 18 + i * 18 + 9, 296, 16, 16, col);
    }

    // ── Player info ───────────────────────────────────────────────────────────
    this._txt('H U M A N   v s   H U M A N', W / 2, 336, CREAM, 13);

    this._r(W / 2, 354, 160, 1, GOLD_DIM, 0.5, 0.5, 0.4);

    // Controls
    this._txt('Click a piece, then click its destination', W / 2, 374, '#7a6a58', 10);
    this._txt('N  =  new game            R  =  resign', W / 2, 392, '#5a4a38', 10);

    // ── Second divider ────────────────────────────────────────────────────────
    this._r(W / 2, 418, 280, 1, '#3a2a18');

    // ── Blink text ────────────────────────────────────────────────────────────
    this._blinkText = new Text({
      text: '—   PRESS   SPACE   TO   START   —',
      x: W / 2, y: 454,
      fontSize: 13, color: CREAM,
      fontFamily: 'monospace',
    });
    this._blinkText.anchorX = 0.5; this._blinkText.anchorY = 0.5;
    this.add(this._blinkText);

    // ── Bottom decorative strip ───────────────────────────────────────────────
    this._r(W / 2, 490, 280, 1, '#3a2a18');

    // Dot row
    for (let i = 0; i < 7; i++) {
      this._r(W / 2 - 54 + i * 18, 508, 4, 4, GOLD, 0.5, 0.5, 0.15 + i * 0.04);
    }

    // Version
    this._txt('Easy Game Maker  v0.1.0', W / 2, 540, '#3a2a18', 9);
  }

  // ── Animations ────────────────────────────────────────────────────────────

  private _startBlink(): void {
    this._transitions.cancelAll();
    this._blinkText.alpha = 1;
    const pulse = (): void => {
      this._transitions.to(
        this._blinkText as unknown as Record<string, number>,
        { alpha: 0.12, duration: 800, easing: Easing.inOutSine,
          onComplete: () => this._transitions.to(
            this._blinkText as unknown as Record<string, number>,
            { alpha: 1, duration: 800, easing: Easing.inOutSine, onComplete: pulse },
          ),
        },
      );
    };
    pulse();
  }

  private _animateDiamonds(): void {
    const spin = (): void => {
      for (const d of this._diamonds) {
        this._transitions.to(
          d as unknown as Record<string, number>,
          { rotation: d.rotation + Math.PI * 2, duration: 8000, easing: Easing.linear, onComplete: spin },
        );
      }
    };
    spin();
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _r(
    x: number, y: number, w: number, h: number, fill: string,
    ax = 0.5, ay = 0.5, alpha = 1,
  ): RectShape {
    const r = new RectShape({ x, y, width: w, height: h, fill });
    r.anchorX = ax; r.anchorY = ay; r.alpha = alpha;
    this.add(r); return r;
  }

  private _txt(text: string, x: number, y: number, color: string, size: number): Text {
    const t = new Text({ text, x, y, fontSize: size, color, fontFamily: 'monospace' });
    t.anchorX = 0.5; t.anchorY = 0.5; this.add(t); return t;
  }
}
