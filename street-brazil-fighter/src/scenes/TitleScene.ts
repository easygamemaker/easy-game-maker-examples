import { Scene, type SceneParams } from 'easy-game-maker';
import { createBackdrop } from '../game/backdrop';
import { ctxOf, goto, hook, updateSession, type GameContext } from '../game/context';
import { COLORS, H, W } from '../game/layout';
import { MenuList, type MenuEvent } from '../game/menu';
import { FONT_TITLE, Label, rect } from '../game/ui';
import type { Difficulty } from '../sim';

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];
const diffText = (d: Difficulty): string => `DIFFICULTY  <  ${d.toUpperCase()}  >`;

export class TitleScene extends Scene {
  private ctx!: GameContext;
  private menu!: MenuList;
  private logo: Label[] = [];
  private time = 0;
  private leaving = false;

  override onCreate(params?: SceneParams): void {
    this.ctx = ctxOf(params);
    const { assets, session } = this.ctx;
    this.add(createBackdrop(assets, assets.hasStage('copacabana') ? 'copacabana' : (assets.hasStage('pelourinho') ? 'pelourinho' : session.stageId), 0.5));
    this.add(rect(0, 70, W, 250, '#000000', 0.35));
    this.add(rect(0, 70, W, 8, COLORS.green));
    this.add(rect(0, 78, W, 5, COLORS.gold));
    this.add(rect(0, 312, W, 8, COLORS.green));
    this.add(rect(0, 305, W, 5, COLORS.gold));
    const street = new Label('STREET', W / 2, 135, { size: 100, color: COLORS.gold, font: FONT_TITLE });
    const brazil = new Label('BRAZIL', W / 2, 225, { size: 100, color: '#27d36b', font: FONT_TITLE });
    const fighter = new Label('F I G H T E R', W / 2, 290, { size: 40, color: '#59a5ff', font: FONT_TITLE });
    this.logo = [street, brazil, fighter];
    this.add(...this.logo);
    this.menu = new MenuList(
      [
        { id: '1p', text: '1P  VS  CPU' },
        { id: '2p', text: '2P  VERSUS' },
        { id: 'diff', text: diffText(session.difficulty) },
      ],
      W / 2, 430, 72, 38,
    );
    this.add(this.menu);
    this.add(new Label('P1  WASD + J punch  K kick  L special  U block', W / 2, H - 70, { size: 20, color: COLORS.white }));
    this.add(new Label('P2  Arrows + Numpad 1 punch  2 kick  3 special  0 block      Gamepads supported', W / 2, H - 40, { size: 20, color: COLORS.white }));
    this.ctx.app.input.on('pointerdown', this.onPointer);
    this.ctx.app.input.on('pointermove', this.onHover);
  }

  override onDestroy(): void {
    this.ctx.app.input.off('pointerdown', this.onPointer);
    this.ctx.app.input.off('pointermove', this.onHover);
  }

  override onResume(): void {
    this.leaving = false;
    hook().scene = 'title';
  }

  private readonly onPointer = (e: unknown): void => {
    const p = e as { x: number; y: number };
    this.handle(this.menu.pointerPress(p.x, p.y));
  };
  private readonly onHover = (e: unknown): void => {
    const p = e as { x: number; y: number };
    this.menu.pointerHover(p.x, p.y);
  };

  private handle(ev: MenuEvent | null): void {
    if (!ev || this.leaving) return;
    const { assets, session } = this.ctx;
    if (ev.type === 'move') assets.play('ui_move');
    else if (ev.type === 'adjust' && ev.id === 'diff') {
      const i = DIFFICULTIES.indexOf(session.difficulty);
      const next = DIFFICULTIES[(i + ev.dir + DIFFICULTIES.length) % DIFFICULTIES.length] as Difficulty;
      updateSession(this.ctx, { difficulty: next });
      this.menu.setText('diff', diffText(next));
      assets.play('ui_move');
    } else if (ev.type === 'confirm' && (ev.id === '1p' || ev.id === '2p')) {
      this.leaving = true;
      assets.play('ui_select');
      updateSession(this.ctx, { mode: ev.id });
      void goto(this.ctx, 'select');
    }
  }

  override onUpdate(dt: number): void {
    this.time += dt;
    this.logo.forEach((l, i) => {
      l.y += Math.sin(this.time * 2 + i) * 0.12;
    });
    this.handle(this.menu.navigate(this.ctx.controls.edges(0, true)));
  }
}
