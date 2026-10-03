import { CircleShape, Group, Sprite } from 'easy-game-maker';
import type { FighterState, Projectile } from '../sim';
import type { FighterFrame, FighterFrames } from './assets';
import { clipFrameName } from './animation';
import { drawParams, type FighterVisual } from './fx';
import { GROUND_SCREEN_Y, SPRITE_SCALE, W } from './layout';

/** Keeps a drawn sprite inside the visible screen (screen x of its left and right edge), by shifting it. */
export function keepOnScreen(left: number, right: number, margin = 6): number {
  if (left < margin) return margin - left;
  if (right > W - margin) return W - margin - right;
  return 0;
}

/** Draws one fighter: a ground shadow and the sprite of the sim's current pose, in world coordinates. */
export class FighterView extends Group {
  private readonly shadow: CircleShape;
  private readonly sprite = new Sprite();
  /** Name of the atlas frame drawn last. */
  shown = '';

  constructor(private readonly frames: FighterFrames, private readonly mirrorTint: boolean, private readonly scale = 1) {
    super();
    this.shadow = new CircleShape({ radius: 60, fill: '#000000' });
    this.shadow.alpha = 0.33;
    this.shadow.scaleY = 0.2;
    this.shadow.zIndex = 0;
    this.sprite.zIndex = 1;
    this.add(this.shadow, this.sprite);
  }

  update(f: FighterState, visual: FighterVisual, frame: number, camX = 0): void {
    const clip = clipFrameName(f);
    const clipPose = clip === null ? undefined : this.frames.get(clip);
    const pose: FighterFrame | undefined = clipPose ?? this.frames.get(f.pose) ?? this.frames.get('idle');
    if (!pose) return;
    this.shown = clipPose !== undefined ? (clip as string) : this.frames.has(f.pose) ? f.pose : 'idle';
    const p = drawParams(visual, f, frame, clipPose !== undefined);
    const sp = this.sprite;
    sp.texture = pose.texture;
    sp.width = pose.w * SPRITE_SCALE * this.scale;
    sp.height = pose.h * SPRITE_SCALE * this.scale;
    sp.anchorX = pose.anchorX / pose.w;
    sp.anchorY = pose.anchorY / pose.h;
    // a knocked down fighter at the wall would lie half outside the screen: nudge the drawing back in view
    const k = sp.width * p.scaleX;
    const left = f.x - camX - (f.facing === 1 ? pose.anchorX : pose.w - pose.anchorX) * (sp.width / pose.w) * p.scaleX;
    sp.x = f.x + keepOnScreen(left, left + k);
    sp.y = GROUND_SCREEN_Y - f.y + p.offsetY;
    sp.scaleX = f.facing * p.scaleX;
    sp.scaleY = p.scaleY;
    const m = this.mirrorTint ? [0.78, 0.88, 1.2] : [1, 1, 1];
    sp.tint = [(m[0] as number) * p.tint[0], (m[1] as number) * p.tint[1], (m[2] as number) * p.tint[2], 1];
    const air = Math.min(1, f.y / 260);
    this.shadow.x = f.x;
    this.shadow.y = GROUND_SCREEN_Y + 4;
    this.shadow.scaleX = 1 - 0.45 * air;
    this.shadow.scaleY = 0.2 * (1 - 0.45 * air);
    this.shadow.alpha = 0.33 * (1 - 0.5 * air);
  }
}

/** One sprite per live projectile, created and removed as the sim adds and drops them. */
export class ProjectileViews extends Group {
  private readonly views = new Map<number, Sprite>();

  constructor(private readonly fighters: ReadonlyMap<string, FighterFrames>) {
    super();
  }

  update(projectiles: readonly Projectile[]): void {
    const alive = new Set<number>();
    for (const p of projectiles) {
      alive.add(p.id);
      let sp = this.views.get(p.id);
      const fx = this.fighters.get(p.characterId)?.get('fx');
      if (!fx) continue;
      if (!sp) {
        sp = new Sprite({ texture: fx.texture });
        sp.anchorX = 0.5;
        sp.anchorY = 0.5;
        this.views.set(p.id, sp);
        this.add(sp);
      }
      const targetH = Math.max(70, p.h * 1.5);
      const scale = Math.min(targetH / fx.h, (p.w * 2.2) / fx.w);
      sp.width = fx.w * scale;
      sp.height = fx.h * scale;
      sp.x = p.x;
      sp.y = GROUND_SCREEN_Y - p.y - p.h / 2;
      sp.scaleX = p.facing;
      sp.rotation = p.visual === 'whirlwind' || p.visual === 'feathers' ? p.age * 0.25 * p.facing : 0;
      sp.alpha = Math.min(1, (p.lifetime - p.age) / 8 + 0.2);
    }
    for (const [id, sp] of [...this.views]) {
      if (alive.has(id)) continue;
      this.remove(sp);
      this.views.delete(id);
    }
  }
}
