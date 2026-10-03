import type { PlayerInput } from '../sim';
import { NO_INPUT, type Action } from './controls';

export interface TouchButton {
  readonly action: Action;
  readonly label: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

const btn = (action: Action, label: string, x: number, y: number, size = 92): TouchButton => ({
  action, label, x, y, w: size, h: size,
});

/** On-screen layout for P1: a d-pad on the left and four action buttons on the right. */
export const TOUCH_BUTTONS: readonly TouchButton[] = [
  btn('left', '<', 20, 586),
  btn('right', '>', 232, 586),
  btn('up', '^', 126, 484),
  btn('down', 'v', 126, 586),
  btn('punch', 'P', 1010, 540),
  btn('kick', 'K', 1110, 480),
  btn('special', 'S', 1190, 570),
  btn('block', 'B', 1090, 590, 80),
];

export function hitButton(buttons: readonly TouchButton[], x: number, y: number): TouchButton | null {
  for (const b of buttons) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

/** Tracks which button each finger holds, so several buttons can be down at once. */
export class TouchPad {
  private readonly held = new Map<number, Action>();

  press(pointerId: number, x: number, y: number): void {
    const b = hitButton(TOUCH_BUTTONS, x, y);
    if (b) this.held.set(pointerId, b.action);
    else this.held.delete(pointerId);
  }
  move(pointerId: number, x: number, y: number): void {
    if (this.held.has(pointerId)) this.press(pointerId, x, y);
  }
  release(pointerId: number): void {
    this.held.delete(pointerId);
  }
  read(): PlayerInput {
    const out = { ...NO_INPUT } as Record<Action, boolean>;
    for (const a of this.held.values()) out[a] = true;
    return out;
  }
}

export const isTouchDevice = (): boolean =>
  typeof navigator !== 'undefined' && (navigator.maxTouchPoints > 0 || new URLSearchParams(location.search).get('touch') === '1');
