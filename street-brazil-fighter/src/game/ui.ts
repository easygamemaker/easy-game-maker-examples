import { Group, RectShape, Text, Sprite, type Texture } from 'easy-game-maker';
import { COLORS } from './layout';

export const FONT_TITLE = 'Impact, "Arial Black", "Helvetica Neue", sans-serif';
export const FONT_UI = '"Arial Black", "Helvetica Neue", Arial, sans-serif';

export type HAlign = 'left' | 'center' | 'right';

export interface LabelOptions {
  readonly size?: number;
  readonly color?: string;
  readonly align?: HAlign;
  readonly font?: string;
  readonly shadow?: string | null;
  readonly weight?: string;
}

const ANCHOR: Record<HAlign, number> = { left: 0, center: 0.5, right: 1 };

/** Text with a hard drop shadow so it stays readable over any stage art. */
export class Label extends Group {
  private readonly front: Text;
  private readonly back: Text | null;

  constructor(text: string, x: number, y: number, opts: LabelOptions = {}) {
    super();
    const size = opts.size ?? 28;
    const align = opts.align ?? 'center';
    const make = (color: string): Text => {
      const t = new Text({
        text, fontSize: size, color, fontFamily: opts.font ?? FONT_UI, fontWeight: opts.weight ?? 'bold',
      });
      t.anchorX = ANCHOR[align];
      t.anchorY = 0.5;
      return t;
    };
    this.front = make(opts.color ?? COLORS.white);
    const shadow = opts.shadow === undefined ? '#000000' : opts.shadow;
    this.back = shadow ? make(shadow) : null;
    if (this.back) {
      this.back.x = Math.max(2, size / 14);
      this.back.y = Math.max(2, size / 14);
      this.add(this.back);
    }
    this.add(this.front);
    this.x = x;
    this.y = y;
  }

  get text(): string {
    return this.front.text;
  }
  setText(value: string): void {
    this.front.text = value;
    if (this.back) this.back.text = value;
  }
  setColor(color: string): void {
    this.front.color = color;
  }
  setShadowVisible(value: boolean): void {
    if (this.back) this.back.visible = value;
  }
}

export function rect(x: number, y: number, w: number, h: number, fill: string, alpha = 1, anchor: [number, number] = [0, 0]): RectShape {
  const r = new RectShape({ x, y, width: w, height: h, fill });
  r.anchorX = anchor[0];
  r.anchorY = anchor[1];
  r.alpha = alpha;
  return r;
}

/** Draws `texture` to cover a w x h box (like CSS object-fit: cover), top-left at x, y. */
export function coverSprite(texture: Texture, x: number, y: number, w: number, h: number): Sprite {
  const s = Math.max(w / texture.width, h / texture.height);
  const sp = new Sprite({ texture, x: x + w / 2, y: y + h / 2, width: texture.width * s, height: texture.height * s });
  return sp;
}

/** Moves a cursor on a grid: horizontal moves wrap inside the row, vertical moves wrap over rows that have the column. */
export function moveGrid(index: number, cols: number, count: number, dx: number, dy: number): number {
  const rows = Math.ceil(count / cols);
  let row = Math.floor(index / cols);
  let col = index % cols;
  if (dx !== 0) {
    const rowLen = Math.min(cols, count - row * cols);
    col = (col + dx + rowLen) % rowLen;
  }
  if (dy !== 0) {
    do {
      row = (row + dy + rows) % rows;
    } while (row * cols + col >= count);
  }
  return row * cols + col;
}
