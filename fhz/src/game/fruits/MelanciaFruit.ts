import { FruitActor, type FruitOptions } from '../FruitActor';
import type { PhysicsBody } from 'easy-game-maker';

// frames loaded: 12 normal + 12 special + 5 collision = 29 total (0-based)
// normal: 0-11, special: 12-23, collision: 24-28
export class MelanciaFruit extends FruitActor {
  constructor(opts: Omit<FruitOptions, 'frameMap'>) {
    super({ ...opts, frameMap: { normal: [0, 11], special: [12, 23], collision: [24, 28] } });
  }

  protected override _doSpecial(): void {
    if (!this.physicsBody) return;
    this.physicsBody.applyImpulse(3, -2.5);
  }
}
