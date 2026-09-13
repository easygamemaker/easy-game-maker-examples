import { Group, RectShape, Text } from 'easy-game-maker';

export class AmmoPickup extends Group {
  x = 0;
  y = 0;
  pickupId: string;
  active = true;

  private _glow!: RectShape;
  private _box!: RectShape;
  private _inner!: RectShape;
  private _label!: Text;
  private _time = 0;

  constructor(opts: { id: string; x: number; y: number }) {
    super();
    this.pickupId = opts.id;
    this.x = opts.x;
    this.y = opts.y;
    this._build();
  }

  private _build(): void {
    // Glow background (pulsing larger square)
    this._glow = new RectShape({ x: 0, y: 0, width: 32, height: 32, fill: '#ffd70033' });
    this._glow.anchorX = 0.5; this._glow.anchorY = 0.5;
    this.add(this._glow);

    // Outer box (rotating)
    this._box = new RectShape({ x: 0, y: 0, width: 18, height: 18, fill: '#c8a000' });
    this._box.anchorX = 0.5; this._box.anchorY = 0.5;
    this.add(this._box);

    // Inner accent bar
    this._inner = new RectShape({ x: 0, y: 0, width: 10, height: 4, fill: '#ffd700' });
    this._inner.anchorX = 0.5; this._inner.anchorY = 0.5;
    this.add(this._inner);

    // Label
    this._label = new Text({ text: 'AMMO', x: 0, y: 20, fontSize: 9, color: '#ffd700cc' });
    this._label.anchorX = 0.5; this._label.anchorY = 0.5;
    this.add(this._label);
  }

  update(dt: number): void {
    if (!this.active) return;
    this._time += dt;
    this._box.rotation = this._time * 1.4;
    const pulse = 0.7 + 0.3 * Math.sin(this._time * 3.5);
    this._glow.alpha = pulse * 0.6;
  }

  collect(): void {
    this.active = false;
    this.visible = false;
  }

  respawn(id: string, x: number, y: number): void {
    this.pickupId = id;
    this.x = x;
    this.y = y;
    this.active = true;
    this.visible = true;
    this._time = 0;
  }
}
