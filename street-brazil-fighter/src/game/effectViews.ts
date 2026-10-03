import { CircleShape, Group, PolygonShape, type DisplayObject } from 'easy-game-maker';
import type { Effect, EffectKind } from './fx';
import { GROUND_SCREEN_Y } from './layout';

const star = (spikes: number, outer: number, inner: number): [number, number][] =>
  Array.from({ length: spikes * 2 }, (_, i) => {
    const a = (i / (spikes * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? outer : inner;
    return [Math.cos(a) * r, Math.sin(a) * r];
  });

const make: Record<EffectKind, () => DisplayObject> = {
  hit: () => new PolygonShape({ points: star(8, 44, 18), fill: '#fff3a0', stroke: '#ff7a1a', strokeWidth: 4 }),
  bigHit: () => new PolygonShape({ points: star(10, 70, 26), fill: '#ffe066', stroke: '#e63946', strokeWidth: 5 }),
  block: () => new CircleShape({ radius: 34, fill: '#00000000', stroke: '#7cc4ff', strokeWidth: 8 }),
  dust: () => new CircleShape({ radius: 22, fill: '#d9cdb4' }),
  clash: () => new PolygonShape({ points: star(12, 60, 24), fill: '#ffffff', stroke: '#59a5ff', strokeWidth: 4 }),
  ko: () => new CircleShape({ radius: 120, fill: '#ffffff' }),
};

const KINDS = Object.keys(make) as EffectKind[];

/** Pooled hit sparks, block rings, dust and the KO flash. The pool grows on demand and is reused. */
export class EffectViews extends Group {
  private readonly pools = new Map<EffectKind, DisplayObject[]>(KINDS.map((k) => [k, []]));

  constructor() {
    super();
    this.zIndex = 50;
  }

  update(effects: readonly Effect[]): void {
    for (const pool of this.pools.values()) for (const o of pool) o.visible = false;
    const used = new Map<EffectKind, number>();
    for (const e of effects) {
      const pool = this.pools.get(e.kind) as DisplayObject[];
      const i = used.get(e.kind) ?? 0;
      used.set(e.kind, i + 1);
      let o = pool[i];
      if (!o) {
        o = make[e.kind]();
        pool.push(o);
        this.add(o);
      }
      const t = e.age / e.life;
      o.visible = true;
      o.x = e.x;
      o.y = GROUND_SCREEN_Y - e.y;
      if (e.kind === 'dust') {
        o.scaleX = 0.6 + t * 2.2;
        o.scaleY = (0.6 + t * 1.2) * 0.6;
        o.alpha = 0.55 * (1 - t);
      } else if (e.kind === 'ko') {
        o.scaleX = 0.4 + t * 2.4;
        o.scaleY = o.scaleX;
        o.alpha = 0.7 * (1 - t) * (1 - t);
      } else {
        o.scaleX = 0.5 + Math.sin(Math.min(1, t * 1.6) * Math.PI * 0.5) * 0.9;
        o.scaleY = o.scaleX;
        o.rotation = e.kind === 'block' ? 0 : t * 0.6;
        o.alpha = 1 - t * t;
      }
    }
  }
}
