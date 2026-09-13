import { FruitActor, type FruitOptions } from '../FruitActor';

// normal: 0-11 (12), special/noar: 12-23 (12), collision: 24-24 (1, reuse frame 0)
export class LaranjaFruit extends FruitActor {
  constructor(opts: Omit<FruitOptions, 'frameMap'>) {
    super({ ...opts, frameMap: { normal: [0, 11], special: [12, 23], collision: [24, 24] } });
  }

  protected override _doSpecial(): void {
    if (!this.physicsBody) return;
    // Orange bounces upward after special
    this.physicsBody.applyImpulse(1.5, -3);
  }
}
