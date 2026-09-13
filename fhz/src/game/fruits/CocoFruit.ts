import { FruitActor, type FruitOptions } from '../FruitActor';

// normal: 0-11 (12), special: 12-23 (12), collision: 24-27 (4)
export class CocoFruit extends FruitActor {
  constructor(opts: Omit<FruitOptions, 'frameMap'>) {
    super({ ...opts, frameMap: { normal: [0, 11], special: [12, 23], collision: [24, 27] } });
  }

  protected override _doSpecial(): void {
    if (!this.physicsBody) return;
    // Coconut bomb – strong impulse downward
    this.physicsBody.applyImpulse(2, 4);
  }
}
