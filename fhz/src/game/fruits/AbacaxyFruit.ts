import { FruitActor, type FruitOptions } from '../FruitActor';

// normal: 0-11 (12), special: 12-23 (12), collision: 24-27 (4)
export class AbacaxyFruit extends FruitActor {
  constructor(opts: Omit<FruitOptions, 'frameMap'>) {
    super({ ...opts, frameMap: { normal: [0, 11], special: [12, 23], collision: [24, 27] } });
  }

  protected override _doSpecial(): void {
    if (!this.physicsBody) return;
    // Pineapple spins and accelerates forward
    this.physicsBody.applyImpulse(4, -1);
  }
}
