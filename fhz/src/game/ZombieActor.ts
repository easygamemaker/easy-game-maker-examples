import { Group, AnimatedSprite, type App } from 'easy-game-maker';
import type { PhysicsWorld, PhysicsBody } from 'easy-game-maker';
import type { Texture } from 'easy-game-maker';

export interface ZombieFrameMap {
  walk: [number, number];       // [start, end] 0-based
  collision: [number, number];
  run: [number, number];
  deteriorate: [number, number];
}

export interface ZombieOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  frames: Texture[];
  frameMap: ZombieFrameMap;
  hits: number;
  fps?: number;
}

export class ZombieActor extends Group {
  readonly anim: AnimatedSprite;
  private readonly _frameMap: ZombieFrameMap;
  private readonly _maxHits: number;
  private _hits: number;
  private _alive = true;
  private _running = false;
  private _fps: number;
  private _walkSpeed = 18;
  physicsBody: PhysicsBody | null = null;
  onDead: ((zombie: ZombieActor) => void) | null = null;

  constructor(opts: ZombieOptions) {
    super();
    this.x = opts.x;
    this.y = opts.y;
    this._frameMap = opts.frameMap;
    this._maxHits = opts.hits;
    this._hits = opts.hits;
    this._fps = opts.fps ?? 10;

    this.anim = new AnimatedSprite({ frames: opts.frames });
    this.anim.width = opts.width;
    this.anim.height = opts.height;
    this.anim.anchorX = 0.5;
    this.anim.anchorY = 0.5;  // Center anchor — matches Corona SDK default
    this.add(this.anim);
  }

  get alive(): boolean { return this._alive; }
  get hits(): number { return this._hits; }

  walk(): void {
    this._running = false;
    const [s, e] = this._frameMap.walk;
    this.anim.playRange(s, e, this._fps, true);
  }

  run(): void {
    this._running = true;
    const [s, e] = this._frameMap.run;
    this.anim.playRange(s, e, this._fps * 1.5, true);
  }

  hit(): boolean {
    if (!this._alive) return false;
    this._hits--;
    if (this._hits <= 0) {
      this._die();
      return true;
    }
    this.run();
    return false;
  }

  private _die(): void {
    this._alive = false;
    this._running = false;
    if (this.physicsBody) {
      this.physicsBody.setVelocity(0, 0);
    }
    // Play collision then deteriorate
    const [cs, ce] = this._frameMap.collision;
    const [ds, de] = this._frameMap.deteriorate;
    this.anim.playRange(cs, ce, this._fps, false, () => {
      this.anim.playRange(ds, de, this._fps * 0.7, false, () => {
        this.onDead?.(this);
      });
    });
  }

  pause(): void {
    this.anim.stop();
  }

  resume(): void {
    if (!this._alive) return;
    if (this._running) this.run(); else this.walk();
  }

  update(dt: number): void {
    this.anim.update(dt);
    // Zombies walk left toward catapult
    if (this._alive && !this._running) {
      this.x -= this._walkSpeed * dt;
    } else if (this._alive && this._running) {
      this.x -= this._walkSpeed * 2 * dt;
    }
  }
}
