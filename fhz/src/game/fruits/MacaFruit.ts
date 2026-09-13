import { FruitActor, type FruitOptions } from '../FruitActor';

// normal: 0-11 (12), special: 12-25 (14), collision: 26-26 (1, reuse frame 0)
export class MacaFruit extends FruitActor {
  constructor(opts: Omit<FruitOptions, 'frameMap'>) {
    super({ ...opts, frameMap: { normal: [0, 11], special: [12, 25], collision: [0, 0] } });
  }

  protected override _doSpecial(): void {
    if (!this.physicsBody) return;
    // Apple splits – strong downward force
    this.physicsBody.applyImpulse(2, 3);
  }
}
