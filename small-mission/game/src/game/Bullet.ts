import { Group, CircleShape, RectShape } from 'easy-game-maker';

const BULLET_SPEED = 400;
const BULLET_MAX_RANGE = 580;

interface TrailPoint { x: number; y: number; alpha: number; }

export class BulletRenderer extends Group {
  x = 0;
  y = 0;
  readonly bulletId: string;
  readonly ownerId: string;

  private _vx: number;
  private _vy: number;
  private _traveled = 0;
  private _dot!: CircleShape;
  private _trail: TrailPoint[] = [];
  private _trailShapes: RectShape[] = [];
  private _active = true;
  private _trailTimer = 0;

  constructor(opts: { id: string; ownerId: string; x: number; y: number; angle: number }) {
    super();
    this.bulletId = opts.id;
    this.ownerId  = opts.ownerId;
    this.x = opts.x;
    this.y = opts.y;
    this._vx = Math.cos(opts.angle) * BULLET_SPEED;
    this._vy = Math.sin(opts.angle) * BULLET_SPEED;
    this._build();
  }

  get active(): boolean { return this._active; }

  private _build(): void {
    // Trail particles (3 ghost dots)
    for (let i = 0; i < 3; i++) {
      const trail = new RectShape({
        x: 0, y: 0, width: 4 - i, height: 4 - i,
        fill: `rgba(255, 220, 50, ${0.5 - i * 0.15})`,
      });
      trail.anchorX = 0.5; trail.anchorY = 0.5;
      this._trailShapes.push(trail);
      this.add(trail);
    }

    // Main bullet dot
    this._dot = new CircleShape({
      x: 0, y: 0, radius: 4, fill: '#ffe840',
      stroke: '#ffffff88', strokeWidth: 1,
    });
    this._dot.anchorX = 0.5; this._dot.anchorY = 0.5;
    this.add(this._dot);
  }

  update(dt: number): boolean {
    if (!this._active) return false;

    const prevX = this.x;
    const prevY = this.y;

    this.x += this._vx * dt;
    this.y += this._vy * dt;
    this._traveled += BULLET_SPEED * dt;

    // Update trail positions (3 ghost dots following behind)
    this._trailTimer += dt;
    for (let i = 0; i < this._trailShapes.length; i++) {
      const frac = (i + 1) * 0.06;
      this._trailShapes[i]!.x = -(this._vx * frac);
      this._trailShapes[i]!.y = -(this._vy * frac);
    }

    if (this._traveled >= BULLET_MAX_RANGE) {
      this._active = false;
      return false;
    }

    return true;
  }

  destroy(): void {
    this._active = false;
  }
}
