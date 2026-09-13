import { Group, AnimatedSprite, type Texture } from 'easy-game-maker';

// Frame ranges (0-based) within the combined frames array:
// idle:      0-9   (10 frames)
// tilt:      10-23 (14 frames)
// openMouth: 24-31 (8 frames)
// chew:      32-42 (11 frames)
// sad:       43-55 (13 frames)
const FRAMES = {
  idle:      [0,  9]  as [number, number],
  tilt:      [10, 23] as [number, number],
  openMouth: [24, 31] as [number, number],
  chew:      [32, 42] as [number, number],
  sad:       [43, 55] as [number, number],
};

const EAT_RADIUS = 50;   // px — how close candy must be to trigger eating
const SIZE = 160;         // display size

export class OmNom extends Group {
  private readonly _anim: AnimatedSprite;
  private _state: keyof typeof FRAMES = 'idle';
  private _timer: ReturnType<typeof setTimeout> | null = null;
  onCandyEaten: (() => void) | null = null;

  constructor(frames: Texture[], omNomX: number, omNomY: number) {
    super();
    this._anim = new AnimatedSprite({ frames });
    this._anim.width = SIZE; this._anim.height = SIZE;
    this._anim.anchorX = 0.5; this._anim.anchorY = 0.5;
    this.x = omNomX; this.y = omNomY;
    this.add(this._anim);
    this.idle();
  }

  get eatRadius(): number { return EAT_RADIUS; }

  idle(): void {
    this._clearTimer();
    this._state = 'idle';
    this._anim.playRange(0, 9, 10, true);
  }

  tilt(): void {
    if (this._state === 'chew' || this._state === 'sad') return;
    this._clearTimer();
    this._state = 'tilt';
    this._anim.playRange(10, 23, 24, false, () => this.idle());
  }

  openMouth(): void {
    if (this._state === 'chew' || this._state === 'sad') return;
    this._clearTimer();
    this._state = 'openMouth';
    this._anim.playRange(24, 31, 14, false);
  }

  closeMouth(): void {
    if (this._state !== 'openMouth') return;
    this._anim.playRange(31, 24, 14, false, () => this.idle());
  }

  chew(): void {
    this._clearTimer();
    this._state = 'chew';
    this._anim.playRange(32, 42, 12, false, () => {
      this.idle();
      this.onCandyEaten?.();
    });
  }

  sad(): void {
    this._clearTimer();
    this._state = 'sad';
    this._anim.playRange(43, 55, 14, false, () => this.idle());
  }

  /** Check if candy is close enough to eat. Returns true and triggers eat. */
  tryEat(candyX: number, candyY: number): boolean {
    if (this._state === 'chew') return false;
    const dx = candyX - this.x;
    const dy = candyY - this.y;
    if (Math.hypot(dx, dy) < EAT_RADIUS) {
      this.chew();
      return true;
    }
    // Open mouth when candy is approaching
    if (Math.hypot(dx, dy) < EAT_RADIUS * 2.5 && this._state === 'idle') {
      this.openMouth();
    } else if (Math.hypot(dx, dy) >= EAT_RADIUS * 2.5 && this._state === 'openMouth') {
      this.closeMouth();
    }
    return false;
  }

  update(dt: number): void {
    this._anim.update(dt);
  }

  private _clearTimer(): void {
    if (this._timer) { clearTimeout(this._timer); this._timer = null; }
  }
}
