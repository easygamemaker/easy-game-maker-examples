import { Group, Sprite, CircleShape, RectShape, type Texture } from 'easy-game-maker';
import type { PhysicsWorld, PhysicsBody } from 'easy-game-maker';
import { Rope } from './Rope';
import type { Candy } from './Candy';

export const HOOK_RANGE_PX = 90;  // auto-attach radius

export class Hook extends Group {
  readonly hookX: number;
  readonly hookY: number;
  private _anchorBody!: PhysicsBody;
  private _rope: Rope | null = null;
  private readonly _rangeCircle: CircleShape;

  constructor(hookTex: Texture, x: number, y: number) {
    super();
    this.hookX = x; this.hookY = y;

    const sprite = new Sprite({ texture: hookTex, x, y, width: 39, height: 39 });
    sprite.anchorX = 0.5; sprite.anchorY = 0.5;
    this.add(sprite);

    // Visible range indicator (matches original)
    this._rangeCircle = new CircleShape();
    this._rangeCircle.radius = HOOK_RANGE_PX;
    this._rangeCircle.x = x; this._rangeCircle.y = y;
    this._rangeCircle.fillColor = [71/255, 175/255, 217/255, 0.08];
    this.add(this._rangeCircle);
  }

  /** Create a static anchor body at hook position (used as rope joint anchor). */
  initPhysics(physics: PhysicsWorld): void {
    const anchor = new RectShape({ x: this.hookX, y: this.hookY, width: 2, height: 2, fill: '#00000000' });
    anchor.anchorX = 0.5; anchor.anchorY = 0.5;
    anchor.width = 2; anchor.height = 2;
    this._anchorBody = physics.addBody(anchor, { type: 'static', shape: 'rect' });
  }

  get anchorBody(): PhysicsBody { return this._anchorBody; }
  get rope(): Rope | null { return this._rope; }
  get hasRope(): boolean { return this._rope !== null && !this._rope.disposed; }

  /** Attach an already-created rope to this hook. */
  setRope(rope: Rope): void {
    this._rope = rope;
    this._rangeCircle.fillColor = [71/255, 175/255, 217/255, 0];
  }

  /** Check if a free candy is within range and hook is free — auto-attach. */
  tryAutoAttach(candy: Candy, physics: PhysicsWorld, parent: Group): boolean {
    if (this.hasRope) return false;
    if (!candy.physicsBody) return false;
    const dx = candy.x - this.hookX;
    const dy = candy.y - this.hookY;
    if (Math.hypot(dx, dy) < HOOK_RANGE_PX) {
      const rope = new Rope(physics, parent, this.hookX, this.hookY, candy.x, candy.y, 18);
      rope.attachToHook(this._anchorBody);
      rope.attachToCandy(candy.physicsBody);
      this.setRope(rope);
      return true;
    }
    return false;
  }

  /** Per-frame update. Returns true if rope was just fully disposed. */
  update(dt: number): boolean {
    if (!this._rope) return false;
    const done = this._rope.update(dt);
    if (done || this._rope.disposed) {
      this._rope = null;
      this._rangeCircle.fillColor = [71/255, 175/255, 217/255, 0.08];
      return true;
    }
    return false;
  }

  disposeRope(): void {
    if (this._rope) { this._rope.dispose(); this._rope = null; }
    this._rangeCircle.fillColor = [71/255, 175/255, 217/255, 0.08];
  }
}
