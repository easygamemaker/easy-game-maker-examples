import { Group } from 'easy-game-maker';
import type { NavEdges } from './controls';
import { COLORS } from './layout';
import { FONT_TITLE, Label, rect } from './ui';

export interface MenuItem {
  readonly id: string;
  readonly text: string;
}

export type MenuEvent =
  | { readonly type: 'move' }
  | { readonly type: 'confirm'; readonly id: string }
  | { readonly type: 'adjust'; readonly id: string; readonly dir: -1 | 1 };

/** Vertical text menu with a highlighted row, keyboard/pad navigation and pointer hit testing. */
export class MenuList extends Group {
  private index = 0;
  private items: readonly MenuItem[];
  private readonly labels: Label[] = [];
  private readonly bar = rect(0, 0, 520, 52, COLORS.gold, 0.9, [0.5, 0.5]);

  constructor(items: readonly MenuItem[], private readonly cx: number, private readonly top: number, private readonly step = 64, private readonly size = 34) {
    super();
    this.items = items;
    this.add(this.bar);
    items.forEach((it, i) => {
      const l = new Label(it.text, cx, top + i * step, { size, font: FONT_TITLE });
      this.labels.push(l);
      this.add(l);
    });
    this.refresh();
  }

  get selected(): MenuItem {
    return this.items[this.index] as MenuItem;
  }

  setText(id: string, text: string): void {
    const i = this.items.findIndex((it) => it.id === id);
    const old = this.items[i];
    if (i < 0 || !old) return;
    this.items = this.items.map((it, k) => (k === i ? { id: old.id, text } : it));
    this.labels[i]?.setText(text);
  }

  private refresh(): void {
    this.bar.x = this.cx;
    this.bar.y = this.top + this.index * this.step;
    this.labels.forEach((l, i) => {
      l.setColor(i === this.index ? COLORS.ink : COLORS.white);
      l.setShadowVisible(i !== this.index);
    });
  }

  /** Index of the row under a point, or -1. */
  rowAt(x: number, y: number): number {
    if (Math.abs(x - this.cx) > 260) return -1;
    const i = Math.round((y - this.top) / this.step);
    return i >= 0 && i < this.items.length && Math.abs(y - (this.top + i * this.step)) <= this.step / 2 ? i : -1;
  }

  pointerHover(x: number, y: number): MenuEvent | null {
    const i = this.rowAt(x, y);
    if (i < 0 || i === this.index) return null;
    this.index = i;
    this.refresh();
    return { type: 'move' };
  }

  pointerPress(x: number, y: number): MenuEvent | null {
    const i = this.rowAt(x, y);
    if (i < 0) return null;
    this.index = i;
    this.refresh();
    return { type: 'confirm', id: this.selected.id };
  }

  navigate(e: NavEdges): MenuEvent | null {
    const n = this.items.length;
    if (e.up || e.down) {
      this.index = (this.index + (e.down ? 1 : -1) + n) % n;
      this.refresh();
      return { type: 'move' };
    }
    if (e.left || e.right) return { type: 'adjust', id: this.selected.id, dir: e.right ? 1 : -1 };
    if (e.confirm || e.start) return { type: 'confirm', id: this.selected.id };
    return null;
  }
}
