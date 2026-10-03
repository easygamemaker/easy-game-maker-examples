import { RectShape, Scene, Sprite, type SceneParams } from 'easy-game-maker';
import { STAGES, type StageData } from '../data/stages';
import { createBackdrop } from '../game/backdrop';
import { ctxOf, goto, hook, updateSession, type GameContext } from '../game/context';
import { COLORS, H, W } from '../game/layout';
import { FONT_TITLE, Label, moveGrid, rect } from '../game/ui';

const COLS = 3;
const CARD_W = 286;
const CARD_H = 154;
const GAP = 16;
const GRID_TOP = 90;
const LABEL_BAR_Y = 628;

export class StageSelectScene extends Scene {
  private ctx!: GameContext;
  private stages: readonly StageData[] = [];
  private index = 0;
  private cursor!: RectShape;
  private stageLabel!: Label;
  private leaving = false;

  override onCreate(params?: SceneParams): void {
    this.ctx = ctxOf(params);
    const { assets, session } = this.ctx;
    this.stages = STAGES.filter((s) => assets.hasStage(s.id));
    this.index = Math.max(0, this.stages.findIndex((s) => s.id === session.stageId));
    this.add(createBackdrop(assets, session.stageId, 0.78));
    this.add(new Label('CHOOSE THE STAGE', W / 2, 46, { size: 46, color: COLORS.gold, font: FONT_TITLE }));
    this.stages.forEach((s, i) => {
      const { x, y } = this.pos(i);
      this.add(rect(x - 4, y - 4, CARD_W + 8, CARD_H + 8, '#000000', 0.7));
      const tex = assets.stageThumb(s.id);
      if (tex) this.add(new Sprite({ texture: tex, x: x + CARD_W / 2, y: y + CARD_H / 2, width: CARD_W, height: CARD_H }));
    });
    this.cursor = new RectShape({ width: CARD_W + 16, height: CARD_H + 16, fill: '#00000000', stroke: COLORS.gold, strokeWidth: 7, cornerRadius: 6 });
    this.cursor.anchorX = 0;
    this.cursor.anchorY = 0;
    this.add(this.cursor);
    this.add(rect(0, LABEL_BAR_Y, W, H - LABEL_BAR_Y, '#06080f', 0.82));
    this.add(rect(0, LABEL_BAR_Y, W, 3, COLORS.gold, 0.9));
    this.stageLabel = new Label('', W / 2, LABEL_BAR_Y + (H - LABEL_BAR_Y) / 2 + 2, { size: 32, font: FONT_TITLE });
    this.add(this.stageLabel);
    this.refresh();
  }

  override onResume(): void {
    this.leaving = false;
    hook().scene = 'stage';
  }

  private pos(i: number): { x: number; y: number } {
    const x0 = (W - (COLS * CARD_W + (COLS - 1) * GAP)) / 2;
    return { x: x0 + (i % COLS) * (CARD_W + GAP), y: GRID_TOP + Math.floor(i / COLS) * (CARD_H + GAP) };
  }

  private refresh(): void {
    const { x, y } = this.pos(this.index);
    this.cursor.x = x - 8;
    this.cursor.y = y - 8;
    const s = this.stages[this.index];
    if (s) this.stageLabel.setText(`${s.name.toUpperCase()}  -  ${s.city.toUpperCase()}`);
  }

  override onUpdate(): void {
    if (this.leaving || this.stages.length === 0) return;
    const e = this.ctx.controls.edges(0, true);
    const dx = (e.right ? 1 : 0) - (e.left ? 1 : 0);
    const dy = (e.down ? 1 : 0) - (e.up ? 1 : 0);
    if (dx !== 0 || dy !== 0) {
      this.index = moveGrid(this.index, COLS, this.stages.length, dx, dy);
      this.ctx.assets.play('ui_move');
      this.refresh();
    } else if (e.confirm || e.start) {
      this.leaving = true;
      this.ctx.assets.play('ui_select');
      updateSession(this.ctx, { stageId: (this.stages[this.index] as StageData).id });
      void goto(this.ctx, 'fight', 300);
    } else if (e.back) {
      this.leaving = true;
      void goto(this.ctx, 'select');
    }
  }
}
