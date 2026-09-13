import { Group, Sprite, type Texture } from 'easy-game-maker';
import type { PhysicsBody, PhysicsWorld } from 'easy-game-maker';

export const CANDY_RADIUS_PX = 35;  // physics radius

export class Candy extends Group {
  physicsBody: PhysicsBody | null = null;
  onFellOffScreen: (() => void) | null = null;
  private _fell = false;
  private readonly _sprite: Sprite;

  constructor(texture: Texture) {
    super();
    // Group width/height used by PhysicsWorld to size the circle body
    this.width = CANDY_RADIUS_PX * 2;
    this.height = CANDY_RADIUS_PX * 2;

    this._sprite = new Sprite({ texture, width: CANDY_RADIUS_PX * 2, height: CANDY_RADIUS_PX * 2 });
    this._sprite.anchorX = 0.5;
    this._sprite.anchorY = 0.5;
    this.add(this._sprite);
  }

  initPhysics(physics: PhysicsWorld, x: number, y: number): void {
    this.x = x; this.y = y;
    this.physicsBody = physics.addBody(this, {
      type: 'dynamic', shape: 'circle',
      density: 0.4, friction: 0.1, restitution: 0.2,
    });
    this.physicsBody.linearDamping = 0.2;
  }

  checkFell(canvasH: number): void {
    if (!this._fell && this.y > canvasH + 80) {
      this._fell = true;
      this.onFellOffScreen?.();
    }
  }

  reset(physics: PhysicsWorld, x: number, y: number): void {
    this._fell = false;
    this.alpha = 1;
    if (this.physicsBody) {
      physics.removeBody(this.physicsBody);
      this.physicsBody = null;
    }
    this.initPhysics(physics, x, y);
  }

  eat(): void {
    this.alpha = 0;
    if (this.physicsBody) {
      // Stop candy from moving
      this.physicsBody.setVelocity(0, 0);
    }
  }
}
