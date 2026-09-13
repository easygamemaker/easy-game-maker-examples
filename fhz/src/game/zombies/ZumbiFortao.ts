import { ZombieActor, type ZombieOptions } from '../ZombieActor';

// Strong zombie takes 2 hits, walks slower
export class ZumbiFortao extends ZombieActor {
  constructor(opts: Omit<ZombieOptions, 'frameMap' | 'hits'>) {
    super({
      ...opts,
      frameMap: { walk: [0, 11], collision: [12, 21], run: [22, 33], deteriorate: [34, 41] },
      hits: 2,
      fps: 8,
    });
  }
}
