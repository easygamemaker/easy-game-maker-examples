import { Scene, Sprite, type SceneParams } from 'easy-game-maker';
import { getCharacter } from '../data/characters';
import { createBackdrop } from '../game/backdrop';
import { ctxOf, goto, hook, type GameContext } from '../game/context';
import { COLORS, W } from "../game/layout";
import { MenuList, type MenuEvent } from '../game/menu';
import { FONT_TITLE, Label, rect } from '../game/ui';

export class ResultScene extends Scene {
  private ctx!: GameContext;
  private menu!: MenuList;
  private leaving = false;

  override onCreate(params?: SceneParams): void {
    this.ctx = ctxOf(params);
    const { assets, session, summary } = this.ctx;
    const winner = summary?.winner ?? null;
    this.add(createBackdrop(assets, session.stageId, 0.7));
    const headline = winner === null ? 'DRAW' : session.mode === '1p' ? (winner === 0 ? 'YOU WIN' : 'YOU LOSE') : `P${winner + 1} WINS`;
    this.add(new Label(headline, W / 2, 110, { size: 110, color: winner === 1 && session.mode === '1p' ? '#ff4d4d' : COLORS.gold, font: FONT_TITLE }));
    if (winner !== null) {
      const id = winner === 0 ? session.p1 : session.p2;
      const frame = assets.fighter(id).get('victory') ?? assets.fighter(id).get('idle');
      if (frame) {
        const h = 330;
        const s = h / frame.h;
        const sp = new Sprite({ texture: frame.texture, x: W / 2 - 330, y: 560, width: frame.w * s, height: h });
        sp.anchorX = frame.anchorX / frame.w;
        sp.anchorY = frame.anchorY / frame.h;
        this.add(sp);
        this.add(new Label(getCharacter(id).displayName.toUpperCase(), W / 2 - 330, 600, { size: 30, font: FONT_TITLE }));
      }
    }
    if (summary) {
      this.add(rect(W / 2 - 170, 190, 340, 90, '#000000', 0.45));
      this.add(new Label(`ROUNDS  ${summary.wins[0]}  -  ${summary.wins[1]}`, W / 2, 222, { size: 32, font: FONT_TITLE }));
      this.add(new Label(`${summary.rounds} rounds played`, W / 2, 262, { size: 20, color: COLORS.dim }));
    }
    this.menu = new MenuList(
      [{ id: 'rematch', text: 'REMATCH' }, { id: 'select', text: 'CHARACTER SELECT' }, { id: 'title', text: 'TITLE' }],
      W / 2 + 150, 400, 72, 34,
    );
    this.add(this.menu);
    this.ctx.app.input.on('pointerdown', this.onPointer);
    this.ctx.app.input.on('pointermove', this.onHover);
  }

  override onDestroy(): void {
    this.ctx.app.input.off('pointerdown', this.onPointer);
    this.ctx.app.input.off('pointermove', this.onHover);
  }

  override onResume(): void {
    this.leaving = false;
    hook().scene = 'result';
    const w = this.ctx.summary?.winner ?? null;
    this.ctx.assets.audio.music(w === null ? null : this.ctx.session.mode === '1p' && w === 1 ? 'music_ko' : 'music_victory');
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
    const { assets } = this.ctx;
    if (ev.type === 'move') assets.play('ui_move');
    else if (ev.type === 'confirm') {
      this.leaving = true;
      assets.play('ui_select');
      void goto(this.ctx, ev.id === 'rematch' ? 'fight' : ev.id === 'select' ? 'select' : 'title', 300);
    }
  }

  override onUpdate(): void {
    this.handle(this.menu.navigate(this.ctx.controls.edges(0, true)));
  }
}
