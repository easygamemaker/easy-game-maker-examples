/**
 * Projectiles: spawn from a special, constant velocity flight, expiry, stage
 * bounds and mutual cancellation. Hits against fighters live in combat.ts.
 */

import { STAGE_WIDTH } from './constants';
import type { ProjectileSpawnRequest } from './fighter';
import { boxesOverlap, overlapCenter, projectileBox } from './geometry';
import type { Projectile, SimEvent } from './types';

export function createProjectile(id: number, req: ProjectileSpawnRequest): Projectile {
  return {
    id,
    owner: req.owner,
    characterId: req.characterId,
    kind: req.spec.kind,
    visual: req.spec.visual,
    x: req.x,
    y: req.y,
    vx: req.facing * req.spec.speed,
    facing: req.facing,
    w: req.move.hitbox.w,
    h: req.move.hitbox.h,
    age: 0,
    lifetime: req.spec.lifetime,
    damage: req.move.damage,
    level: req.move.level,
  };
}

/**
 * Moves every projectile one frame. A projectile lives `lifetime` frames: it
 * is removed on the step its age reaches lifetime, or when its box is fully
 * outside the stage.
 */
export function advanceProjectiles(projectiles: readonly Projectile[]): { projectiles: Projectile[]; events: SimEvent[] } {
  const kept: Projectile[] = [];
  const events: SimEvent[] = [];
  for (const p of projectiles) {
    const moved: Projectile = { ...p, x: p.x + p.vx, age: p.age + 1 };
    const outside = moved.x + moved.w / 2 < 0 || moved.x - moved.w / 2 > STAGE_WIDTH;
    if (moved.age >= moved.lifetime || outside) {
      events.push({ type: 'projectileExpire', id: p.id, owner: p.owner, x: moved.x, y: moved.y });
    } else {
      kept.push(moved);
    }
  }
  return { projectiles: kept, events };
}

/** Opposing projectiles that overlap cancel each other out. */
export function cancelClashingProjectiles(projectiles: readonly Projectile[]): { projectiles: Projectile[]; events: SimEvent[] } {
  const removed = new Set<number>();
  const events: SimEvent[] = [];
  projectiles.forEach((a, i) => {
    projectiles.slice(i + 1).forEach((b) => {
      if (a.owner === b.owner || removed.has(a.id) || removed.has(b.id)) return;
      const boxA = projectileBox(a);
      const boxB = projectileBox(b);
      if (!boxesOverlap(boxA, boxB)) return;
      removed.add(a.id);
      removed.add(b.id);
      const at = overlapCenter(boxA, boxB);
      events.push({ type: 'projectileClash', ids: [a.id, b.id], x: at.x, y: at.y });
    });
  });
  return { projectiles: projectiles.filter((p) => !removed.has(p.id)), events };
}
