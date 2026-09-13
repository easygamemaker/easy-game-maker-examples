import { RectShape } from 'easy-game-maker';
import type { PhysicsWorld, PhysicsBody } from 'easy-game-maker';

// Visual radius used for zombie collision detection (px)
export const SEED_HIT_RADIUS = 18;

// Seed speed in m/s
const SEED_SPEED = 14;
// PPM must match PhysicsWorld PPM (50)
const PPM = 50;

export class SeedProjectile {
  readonly shape: RectShape;
  physicsBody: PhysicsBody | null = null;
  active = true;

  constructor(x: number, y: number) {
    // Small dark ellipse approximated by a rectangle
    this.shape = new RectShape({ x, y, width: 10, height: 7, fill: '#111800' });
    this.shape.anchorX = 0.5;
    this.shape.anchorY = 0.5;
  }

  get x(): number { return this.shape.x; }
  get y(): number { return this.shape.y; }

  /** Launch 3 seeds in a forward fan from the watermelon's current physics velocity. */
  static spawnFan(
    fruitX: number,
    fruitY: number,
    fruitVx: number,
    fruitVy: number,
    physics: PhysicsWorld,
  ): SeedProjectile[] {
    const seeds: SeedProjectile[] = [];

    // Normalise the fruit's flight direction, fallback to rightward
    const len = Math.hypot(fruitVx, fruitVy) || 1;
    const dirX = fruitVx / len;
    const dirY = fruitVy / len;

    // Three launch angles relative to flight direction (radians)
    const BASE_ANGLE = Math.atan2(dirY, dirX);
    const SPREAD = 0.45;  // ~26° per side
    const angles = [BASE_ANGLE - SPREAD, BASE_ANGLE, BASE_ANGLE + SPREAD];

    for (const angle of angles) {
      const s = new SeedProjectile(fruitX, fruitY);
      const body = physics.addBody(s.shape, {
        type: 'dynamic',
        shape: 'circle',
        density: 0.3,
        friction: 0.1,
        restitution: 0.2,
      });
      body.setPosition(fruitX, fruitY);
      body.linearDamping = 0.05;
      body.isBullet = true;
      body.setVelocity(
        Math.cos(angle) * SEED_SPEED,
        Math.sin(angle) * SEED_SPEED,
      );
      s.physicsBody = body;
      seeds.push(s);
    }
    return seeds;
  }

  syncFromPhysics(): void {
    if (!this.physicsBody) return;
    this.shape.x = this.physicsBody.displayObject.x;
    this.shape.y = this.physicsBody.displayObject.y;
    // Rotate to match flight direction
    const vel = this.physicsBody.getVelocity();
    if (Math.hypot(vel.x, vel.y) > 0.5) {
      this.shape.rotation = Math.atan2(vel.y, vel.x);
    }
  }

  destroy(physics: PhysicsWorld): void {
    if (this.physicsBody) {
      physics.removeBody(this.physicsBody);
      this.physicsBody = null;
    }
    this.active = false;
  }
}
