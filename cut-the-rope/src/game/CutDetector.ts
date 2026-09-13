import type { App, PointerEvent2D } from 'easy-game-maker';
import type { Rope } from './Rope';

/**
 * Tracks touch/mouse drag and cuts ropes whose segments the swipe crosses.
 * Matches the original game's approach: create a swept line between consecutive
 * pointer positions and test geometric segment intersection against each rope.
 */
export class CutDetector {
  private _prevX = 0;
  private _prevY = 0;
  private _down = false;
  private readonly _getRopes: () => Rope[];

  constructor(app: App, getRopes: () => Rope[]) {
    this._getRopes = getRopes;

    app.input.on<PointerEvent2D>('pointerdown', (e) => {
      this._down = true;
      this._prevX = e.x;
      this._prevY = e.y;
    });

    app.input.on<PointerEvent2D>('pointermove', (e) => {
      if (!this._down) return;
      const dx = e.x - this._prevX;
      const dy = e.y - this._prevY;
      if (Math.hypot(dx, dy) < 3) return;  // ignore micro movements

      for (const rope of this._getRopes()) {
        if (rope.checkCut(this._prevX, this._prevY, e.x, e.y)) break;
      }
      this._prevX = e.x;
      this._prevY = e.y;
    });

    app.input.on('pointerup', () => { this._down = false; });
  }
}
