import { FruitActor, type FruitOptions } from '../FruitActor';

// normal: 0-11 (12), special: 12-23 (12), collision: 24-24 (1)
export class MelaoFruit extends FruitActor {
  constructor(opts: Omit<FruitOptions, 'frameMap'>) {
    super({ ...opts, frameMap: { normal: [0, 11], special: [12, 23], collision: [24, 24] } });
  }

  protected override _doSpecial(): void {
    if (!this.physicsBody) return;
    // Melon: slow down and drop straight
    this.physicsBody.setVelocity(1, 2);
  }
}
