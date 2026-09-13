import { ZombieActor, type ZombieOptions } from '../ZombieActor';

export class ZumbiKid extends ZombieActor {
  constructor(opts: Omit<ZombieOptions, 'frameMap' | 'hits'>) {
    super({
      ...opts,
      frameMap: { walk: [0, 11], collision: [12, 21], run: [22, 33], deteriorate: [34, 41] },
      hits: 1,
      fps: 13,
    });
  }
}
