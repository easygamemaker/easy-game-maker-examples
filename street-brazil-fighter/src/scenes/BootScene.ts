import { Scene, type SceneParams } from 'easy-game-maker';
import { ctxOf, goto, hook, type GameContext } from '../game/context';
import { COLORS, H, W } from '../game/layout';
import { FONT_TITLE, Label, rect } from '../game/ui';

const BAR_W = 640;

/** Loads every asset with a progress bar, then moves on to the title (or straight into a fight). */
export class BootScene extends Scene {
  private ctx!: GameContext;
  private bar!: ReturnType<typeof rect>;
  private status!: Label;

  override async onCreate(params?: SceneParams): Promise<void> {
    this.ctx = ctxOf(params);
    this.add(rect(0, 0, W, H, COLORS.ink));
    this.add(rect(0, H / 2 - 150, W, 12, COLORS.green));
    this.add(rect(0, H / 2 - 138, W, 6, COLORS.gold));
    this.add(new Label('STREET BRAZIL FIGHTER', W / 2, H / 2 - 70, { size: 64, color: COLORS.gold, font: FONT_TITLE }));
    this.add(rect(W / 2 - BAR_W / 2 - 4, H / 2 + 20, BAR_W + 8, 28, '#000000', 0.6));
    this.bar = rect(W / 2 - BAR_W / 2, H / 2 + 24, 1, 20, COLORS.green);
    this.add(this.bar);
    this.status = new Label('Loading', W / 2, H / 2 + 80, { size: 20, color: COLORS.dim });
    this.add(this.status);
    hook().scene = 'boot';

    await this.ctx.assets.loadAll((fraction, label) => {
      this.bar.width = Math.max(1, BAR_W * fraction);
      this.status.setText(`Loading ${Math.round(fraction * 100)}%  ${label}`);
    });
    if (this.ctx.assets.problems.length) console.warn('asset problems', this.ctx.assets.problems);
  }

  override onResume(): void {
    const { query } = this.ctx;
    const next = query.quick || query.autoplay ? 'fight' : 'title';
    void goto(this.ctx, next, 300);
  }
}
