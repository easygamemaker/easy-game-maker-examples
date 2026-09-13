import {
  Scene,
  RectShape,
  Text,
  Easing,
  type SceneParams,
  type App,
  TransitionManager,
} from 'easy-game-maker';
import { isTouchDevice } from '../helpers/TouchHelper';

// ── Constants ─────────────────────────────────────────────────────────────────
const W = 800;
const H = 500;

const PADDLE_W     = 14;
const PADDLE_H     = 90;
const PADDLE_SPEED = 420;
const PADDLE_MARGIN= 32;

const BALL_SIZE       = 14;
const BALL_HALF       = BALL_SIZE / 2;
const BALL_SPEED_START= 340;
const BALL_SPEED_MAX  = 650;
const BALL_ACCEL      = 1.05;

const SCORE_TO_WIN = 7;
const SERVE_DELAY  = 1.2;

// P2 AI reaction speed (0-1, higher = harder)
const AI_REACTION = 0.85;

type GameState = 'waiting' | 'playing' | 'scored' | 'gameover';

export class GameScene extends Scene {
  private _app!: App;
  private _transitions!: TransitionManager;

  private _p1Paddle!: RectShape;
  private _p2Paddle!: RectShape;
  private _ball!:     RectShape;
  private _p1ScoreText!: Text;
  private _p2ScoreText!: Text;
  private _messageText!: Text;
  private _subText!:     Text;

  private _state: GameState = 'waiting';
  private _p1Score = 0;
  private _p2Score = 0;
  private _ballVx  = 0;
  private _ballVy  = 0;
  private _serveTimer = 0;

  /** True when running on a touch device (mobile / tablet). */
  private _touch = false;

  // ── Touch button zones (canvas coords) ───────────────────────────────────────
  // Left half: P1 controls — top = up, bottom = down
  // Right half: unused (P2 is AI on touch)
  private _touchZoneLeft  = 0;
  private _touchZoneRight = W / 2;

  override onCreate(params?: SceneParams): void {
    this._app         = params?.['app'] as App;
    this._transitions = new TransitionManager();
    this._touch       = isTouchDevice();

    this._buildScene();
    if (this._touch) this._buildTouchUI();
    this._setState('waiting');

    // Tap anywhere to serve on touch
    this._app.input.on('pointerdown', () => {
      if (this._state === 'waiting' || this._state === 'gameover') {
        if (this._state === 'gameover') this._resetGame();
        this._launch();
      }
    });
  }

  override onUpdate(dt: number): void {
    this._transitions.update(dt);
    this._handleInput(dt);

    if (this._state === 'playing') {
      if (this._touch) this._runAI(dt);     // P2 AI on touch devices
      this._moveBall(dt);
      this._checkPaddleCollisions();
      this._checkScoring();
    }

    if (this._state === 'scored') {
      this._serveTimer -= dt;
      if (this._serveTimer <= 0) this._launch();
    }
  }

  // ── Scene construction ────────────────────────────────────────────────────────

  private _buildScene(): void {
    this._addRect(0, 0, W, H, '#0a0a1a', 0, 0);

    for (let y = 10; y < H; y += 28) {
      this._addRect(W / 2, y + 6, 3, 14, '#ffffff18', 0.5, 0);
    }
    this._addRect(W / 2, H / 2, 3, H, '#ffffff08');

    // Player labels — adapt for touch
    const p1Hint = this._touch ? 'Touch upper/lower left' : 'W / S';
    const p2Hint = this._touch ? 'AI' : '↑ / ↓';

    this._label('P1', 100, 22, '#4dabf780');
    this._label('P2', W - 100, 22, '#ff6b6b80');
    this._label(p1Hint, 100, H - 18, '#ffffff30', 9);
    this._label(p2Hint, W - 100, H - 18, '#ffffff30', 9);

    this._p1ScoreText = new Text({ text: '0', x: W/2-55, y: 44, fontSize: 52, color: '#4dabf7' });
    this._p1ScoreText.anchorX = 1; this._p1ScoreText.anchorY = 0.5; this.add(this._p1ScoreText);

    this._p2ScoreText = new Text({ text: '0', x: W/2+55, y: 44, fontSize: 52, color: '#ff6b6b' });
    this._p2ScoreText.anchorX = 0; this._p2ScoreText.anchorY = 0.5; this.add(this._p2ScoreText);

    this._p1Paddle = this._addRect(PADDLE_MARGIN, H/2, PADDLE_W, PADDLE_H, '#4dabf7');
    this._p2Paddle = this._addRect(W-PADDLE_MARGIN, H/2, PADDLE_W, PADDLE_H, '#ff6b6b');
    this._ball     = this._addRect(W/2, H/2, BALL_SIZE, BALL_SIZE, '#ffffff');

    this._messageText = new Text({ text: '', x: W/2, y: H/2-10, fontSize: 28, color: '#ffffff' });
    this._messageText.anchorX = 0.5; this._messageText.anchorY = 0.5; this.add(this._messageText);

    this._subText = new Text({ text: '', x: W/2, y: H/2+30, fontSize: 14, color: '#ffffff70' });
    this._subText.anchorX = 0.5; this._subText.anchorY = 0.5; this.add(this._subText);
  }

  /** Semi-transparent touch zones on the left half of the screen. */
  private _buildTouchUI(): void {
    // Upper-left zone → UP
    const upZone = new RectShape({ x: W/4, y: H/4, width: W/2-20, height: H/2-10, fill: '#ffffff' });
    upZone.alpha = 0.04; upZone.anchorX = 0.5; upZone.anchorY = 0.5;
    this.add(upZone);
    this._label('▲', W/4, H/4, '#ffffff20', 32);

    // Lower-left zone → DOWN
    const downZone = new RectShape({ x: W/4, y: H*3/4, width: W/2-20, height: H/2-10, fill: '#ffffff' });
    downZone.alpha = 0.04; downZone.anchorX = 0.5; downZone.anchorY = 0.5;
    this.add(downZone);
    this._label('▼', W/4, H*3/4, '#ffffff20', 32);
  }

  // ── State machine ─────────────────────────────────────────────────────────────

  private _setState(state: GameState, scorer?: 1 | 2): void {
    this._state = state;

    const serveHint = this._touch ? 'Tap to serve' : 'Press SPACE to serve';
    const againHint = this._touch ? 'Tap to play again' : 'Press SPACE to play again';
    const p2Label   = this._touch ? '(AI)' : '';

    switch (state) {
      case 'waiting':
        this._resetBall();
        this._messageText.text = 'PONG';
        this._subText.text = `${serveHint}  ${p2Label}`;
        this._messageText.alpha = 1; this._subText.alpha = 1;
        break;
      case 'playing':
        this._messageText.text = ''; this._subText.text = '';
        break;
      case 'scored':
        this._resetBall();
        this._serveTimer = SERVE_DELAY;
        this._messageText.text = scorer === 1 ? 'Point P1!' : 'Point P2!';
        this._messageText.color = scorer === 1 ? '#4dabf7' : '#ff6b6b';
        this._messageText.alpha = 1; this._subText.text = '';
        this._transitions.to(this._messageText as unknown as Record<string,number>,
          { alpha: 0, duration: (SERVE_DELAY-0.1)*1000, easing: Easing.linear });
        break;
      case 'gameover': {
        const winner = this._p1Score >= SCORE_TO_WIN ? 'Player 1' : 'Player 2';
        this._messageText.text = `${winner} wins!`;
        this._messageText.color = this._p1Score >= SCORE_TO_WIN ? '#4dabf7' : '#ff6b6b';
        this._messageText.alpha = 1;
        this._subText.text = againHint; this._subText.alpha = 1;
        break;
      }
    }
  }

  // ── Input ─────────────────────────────────────────────────────────────────────

  private _handleInput(dt: number): void {
    const input = this._app.input;

    // P1 — keyboard
    if (input.isKeyDown('w') || input.isKeyDown('W')) {
      this._p1Paddle.y = Math.max(PADDLE_H/2, this._p1Paddle.y - PADDLE_SPEED * dt);
    }
    if (input.isKeyDown('s') || input.isKeyDown('S')) {
      this._p1Paddle.y = Math.min(H - PADDLE_H/2, this._p1Paddle.y + PADDLE_SPEED * dt);
    }

    // P1 — touch (left half of screen, upper = up, lower = down)
    if (this._touch && input.pointer.isDown && input.pointer.x < W/2) {
      if (input.pointer.y < H/2) {
        this._p1Paddle.y = Math.max(PADDLE_H/2, this._p1Paddle.y - PADDLE_SPEED * dt);
      } else {
        this._p1Paddle.y = Math.min(H - PADDLE_H/2, this._p1Paddle.y + PADDLE_SPEED * dt);
      }
    }

    // P2 — keyboard only (AI handles it on touch)
    if (!this._touch) {
      if (input.isKeyDown('ArrowUp')) {
        this._p2Paddle.y = Math.max(PADDLE_H/2, this._p2Paddle.y - PADDLE_SPEED * dt);
      }
      if (input.isKeyDown('ArrowDown')) {
        this._p2Paddle.y = Math.min(H - PADDLE_H/2, this._p2Paddle.y + PADDLE_SPEED * dt);
      }
    }

    // Serve — keyboard only (tap handled via pointerdown listener)
    if (!this._touch && (input.isKeyDown(' ') || input.isKeyDown('Space'))) {
      if (this._state === 'waiting' || this._state === 'gameover') {
        if (this._state === 'gameover') this._resetGame();
        this._launch();
      }
    }
  }

  /** Simple P2 AI — follows the ball with a slight reaction delay. */
  private _runAI(dt: number): void {
    const targetY  = this._ball.y;
    const diff     = targetY - this._p2Paddle.y;
    const maxMove  = PADDLE_SPEED * AI_REACTION * dt;
    this._p2Paddle.y = Math.max(PADDLE_H/2, Math.min(H - PADDLE_H/2,
      this._p2Paddle.y + Math.sign(diff) * Math.min(Math.abs(diff), maxMove)));
  }

  // ── Ball ──────────────────────────────────────────────────────────────────────

  private _resetBall(): void {
    this._ball.x = W/2; this._ball.y = H/2;
    this._ballVx = 0;   this._ballVy = 0;
  }

  private _launch(): void {
    const angle = (Math.random() * 40 - 20) * (Math.PI / 180);
    const dir   = Math.random() < 0.5 ? 1 : -1;
    this._ballVx = Math.cos(angle) * BALL_SPEED_START * dir;
    this._ballVy = Math.sin(angle) * BALL_SPEED_START;
    this._setState('playing');
  }

  private _moveBall(dt: number): void {
    this._ball.x += this._ballVx * dt;
    this._ball.y += this._ballVy * dt;
    if (this._ball.y - BALL_HALF <= 0) { this._ball.y = BALL_HALF; this._ballVy = Math.abs(this._ballVy); }
    if (this._ball.y + BALL_HALF >= H)  { this._ball.y = H - BALL_HALF; this._ballVy = -Math.abs(this._ballVy); }
    const spd = Math.hypot(this._ballVx, this._ballVy);
    if (spd > BALL_SPEED_MAX) { this._ballVx = (this._ballVx/spd)*BALL_SPEED_MAX; this._ballVy = (this._ballVy/spd)*BALL_SPEED_MAX; }
  }

  private _checkPaddleCollisions(): void {
    const p1Right = this._p1Paddle.x + PADDLE_W/2;
    if (this._ballVx < 0 && this._ball.x-BALL_HALF<=p1Right && this._ball.x-BALL_HALF>=this._p1Paddle.x-PADDLE_W/2
      && this._ball.y>=this._p1Paddle.y-PADDLE_H/2 && this._ball.y<=this._p1Paddle.y+PADDLE_H/2) {
      this._ball.x = p1Right + BALL_HALF + 1;
      const impact = (this._ball.y - this._p1Paddle.y) / (PADDLE_H/2);
      const speed  = Math.hypot(this._ballVx, this._ballVy) * BALL_ACCEL;
      this._ballVx = Math.cos(impact*0.8) * speed;
      this._ballVy = Math.sin(impact*0.8) * speed;
    }
    const p2Left = this._p2Paddle.x - PADDLE_W/2;
    if (this._ballVx > 0 && this._ball.x+BALL_HALF>=p2Left && this._ball.x+BALL_HALF<=this._p2Paddle.x+PADDLE_W/2
      && this._ball.y>=this._p2Paddle.y-PADDLE_H/2 && this._ball.y<=this._p2Paddle.y+PADDLE_H/2) {
      this._ball.x = p2Left - BALL_HALF - 1;
      const impact = (this._ball.y - this._p2Paddle.y) / (PADDLE_H/2);
      const speed  = Math.hypot(this._ballVx, this._ballVy) * BALL_ACCEL;
      this._ballVx = Math.cos(Math.PI - impact*0.8) * speed;
      this._ballVy = Math.sin(Math.PI - impact*0.8) * speed;
    }
  }

  private _checkScoring(): void {
    if (this._ball.x < -BALL_HALF*2) { this._p2Score++; this._p2ScoreText.text=String(this._p2Score); this._checkWin(2); }
    else if (this._ball.x > W+BALL_HALF*2) { this._p1Score++; this._p1ScoreText.text=String(this._p1Score); this._checkWin(1); }
  }

  private _checkWin(scorer: 1|2): void {
    if (this._p1Score>=SCORE_TO_WIN || this._p2Score>=SCORE_TO_WIN) this._setState('gameover');
    else this._setState('scored', scorer);
  }

  private _resetGame(): void {
    this._p1Score = 0; this._p2Score = 0;
    this._p1ScoreText.text = '0'; this._p2ScoreText.text = '0';
    this._p1Paddle.y = H/2; this._p2Paddle.y = H/2;
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private _addRect(x: number, y: number, w: number, h: number, fill: string, ax=0.5, ay=0.5): RectShape {
    const r = new RectShape({ x, y, width: w, height: h, fill });
    r.anchorX = ax; r.anchorY = ay; this.add(r); return r;
  }

  private _label(text: string, x: number, y: number, color: string, size=11): Text {
    const t = new Text({ text, x, y, fontSize: size, color, fontFamily: 'monospace' });
    t.anchorX = 0.5; t.anchorY = 0.5; this.add(t); return t;
  }
}
