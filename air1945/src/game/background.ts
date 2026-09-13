import { Group, RectShape } from 'easy-game-maker';
import { W, H } from './entities';

interface BGLayer {
  speed: number;
  items: Array<{ rect: RectShape; startY: number }>;
}

export class ParallaxBG {
  private readonly layers: BGLayer[] = [];

  constructor(parent: Group) {
    // Layer 1 — distant stars (fast, tiny)
    this.layers.push(this._makeLayer(parent, 48, () => ({
      w: 2 + Math.random() * 2,
      h: 2 + Math.random() * 2,
      fill: '#ffffff',
      alpha: 0.15 + Math.random() * 0.5,
    }), 220 + Math.random() * 80));

    // Layer 2 — nebula wisps (medium, semi-transparent)
    this.layers.push(this._makeLayer(parent, 14, () => ({
      w: 40 + Math.random() * 70,
      h: 14 + Math.random() * 22,
      fill: Math.random() > 0.5 ? '#0a1a3a' : '#081428',
      alpha: 0.5 + Math.random() * 0.3,
    }), 65 + Math.random() * 20));

    // Layer 3 — distant terrain/islands (slow, large)
    this.layers.push(this._makeLayer(parent, 6, () => ({
      w: 60 + Math.random() * 90,
      h: 30 + Math.random() * 50,
      fill: '#060e1c',
      alpha: 0.85,
    }), 28 + Math.random() * 12));
  }

  update(dt: number): void {
    for (const layer of this.layers) {
      for (const item of layer.items) {
        item.rect.y += layer.speed * dt;
        if (item.rect.y > H + 60) {
          item.rect.y = item.startY - H;
          item.rect.x = Math.random() * W;
        }
      }
    }
  }

  private _makeLayer(
    parent: Group,
    count: number,
    factory: () => { w: number; h: number; fill: string; alpha: number },
    speed: number,
  ): BGLayer {
    const items: BGLayer['items'] = [];
    for (let i = 0; i < count; i++) {
      const { w, h, fill, alpha } = factory();
      const r = new RectShape({ x: Math.random() * W, y: Math.random() * H, width: w, height: h, fill });
      r.anchorX = 0.5; r.anchorY = 0.5; r.alpha = alpha;
      parent.add(r);
      items.push({ rect: r, startY: r.y });
    }
    return { speed, items };
  }
}
