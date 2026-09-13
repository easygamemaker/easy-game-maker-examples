import { Group, AnimatedSprite, type Texture } from 'easy-game-maker';
import type { PhysicsBody } from 'easy-game-maker';

export interface FruitFrameMap {
  normal: [number, number];
  special: [number, number];
  collision: [number, number];
}

export interface FruitOptions {
  x?: number;
  y?: number;
  width: number;
  height: number;
  frames: Texture[];
  frameMap: FruitFrameMap;
  fps?: number;
}

export class FruitActor extends Group {
  readonly anim: AnimatedSprite;
  protected readonly _frameMap: FruitFrameMap;
  protected readonly _fps: number;
  physicsBody: PhysicsBody | null = null;
  inAir = false;
  launched = false;
  specialUsed = false;
  onLanded: (() => void) | null = null;
  onSpecialActivated: ((fruit: FruitActor) => void) | null = null;

  constructor(opts: FruitOptions) {
    super();
    this.x = opts.x ?? 0;
    this.y = opts.y ?? 0;
    // Expose dimensions on the Group itself so PhysicsWorld can use them for shape sizing
    this.width = opts.width;
    this.height = opts.height;
    this._frameMap = opts.frameMap;
    this._fps = opts.fps ?? 10;

    this.anim = new AnimatedSprite({ frames: opts.frames });
    this.anim.width = opts.width;
    this.anim.height = opts.height;
    this.anim.anchorX = 0.5;
    this.anim.anchorY = 0.5;
    this.add(this.anim);
  }

  playNormal(): void {
    const [s, e] = this._frameMap.normal;
    this.anim.playRange(s, e, this._fps, true);
  }

  activateSpecial(): void {
    if (this.specialUsed || !this.inAir) return;
    this.specialUsed = true;
    const [s, e] = this._frameMap.special;
    this.anim.playRange(s, e, this._fps, false);
    this._doSpecial();
    this.onSpecialActivated?.(this);
  }

  protected _doSpecial(): void {
    // Subclasses override
  }

  land(): void {
    if (!this.launched) return;
    const [s, e] = this._frameMap.collision;
    this.anim.playRange(s, e, this._fps, false, () => {
      this.onLanded?.();
    });
  }

  update(dt: number): void {
    this.anim.update(dt);
    // Sync display position from physics
    if (this.physicsBody) {
      this.x = this.physicsBody.displayObject.x;
      this.y = this.physicsBody.displayObject.y;
    }
  }
}
