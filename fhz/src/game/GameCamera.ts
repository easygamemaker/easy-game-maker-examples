import { Group, TransitionManager, type Easing } from 'easy-game-maker';
import { CANVAS_W, WORLD_W } from '../config/levels';

export class GameCamera {
  readonly group: Group;
  private _camX = 0;
  private _minX = 0;
  private _maxX: number;
  private _transitions: TransitionManager;

  constructor(worldWidth = WORLD_W, canvasWidth = CANVAS_W) {
    this.group = new Group();
    this._maxX = Math.max(0, worldWidth - canvasWidth);
    this._transitions = new TransitionManager();
  }

  get x(): number { return this._camX; }

  /** Move camera so target world-X is visible. Smooth follow. */
  follow(worldX: number): void {
    const target = Math.min(this._maxX, Math.max(0, worldX - CANVAS_W * 0.3));
    this._camX = target;
    this.group.x = -Math.round(this._camX);
  }

  /** Snap camera to target X (no tween). */
  snapTo(worldX: number): void {
    this._camX = Math.min(this._maxX, Math.max(0, worldX));
    this.group.x = -Math.round(this._camX);
  }

  /** Shift camera immediately by delta pixels (for finger/mouse drag). */
  panByDelta(delta: number): void {
    this._panning = false;
    this._camX = Math.min(this._maxX, Math.max(0, this._camX + delta));
    this.group.x = -Math.round(this._camX);
  }

  /** Tween camera to target X. */
  panTo(worldX: number, duration: number, easing?: typeof Easing.linear, onComplete?: () => void): void {
    const target = Math.min(this._maxX, Math.max(0, worldX));
    this._transitions.to(this as unknown as Record<string, number>, {
      duration,
      easing,
      onComplete,
      // We animate _camX manually in update()
    } as never);
    // Simple manual tween stored for update
    this._panTarget = target;
    this._panDuration = duration;
    this._panElapsed = 0;
    this._panStart = this._camX;
    this._panOnComplete = onComplete ?? null;
    this._panning = true;
  }

  private _panning = false;
  private _panTarget = 0;
  private _panStart = 0;
  private _panDuration = 1;
  private _panElapsed = 0;
  private _panOnComplete: (() => void) | null = null;

  update(dt: number): void {
    this._transitions.update(dt);
    if (this._panning) {
      this._panElapsed += dt;
      const t = Math.min(1, this._panElapsed / this._panDuration);
      // ease-out cubic
      const e = 1 - Math.pow(1 - t, 3);
      this._camX = this._panStart + (this._panTarget - this._panStart) * e;
      this.group.x = -Math.round(this._camX);
      if (t >= 1) {
        this._panning = false;
        const cb = this._panOnComplete;
        this._panOnComplete = null;
        cb?.();
      }
    }
  }
}
