import { RectShape, Scene, Sprite, type SceneParams } from 'easy-game-maker';
import { CHARACTERS, type CharacterData } from '../data/characters';
import { createBackdrop } from '../game/backdrop';
import { ctxOf, goto, hook, updateSession, type GameContext } from '../game/context';
import { COLORS, W } from '../game/layout';
import { FONT_TITLE, Label, moveGrid, rect } from '../game/ui';
import type { FighterFrame } from '../game/assets';
import type { NavEdges } from '../game/controls';

const COLS = 3;
const CARD_W = 210;
const CARD_H = 232;
const GAP = 16;
const PREVIEW_H = 380;
const SHUFFLE_FRAMES = 44;

const cursorBox = (color: string): RectShape => {
  const r = new RectShape({ width: CARD_W + 10, height: CARD_H + 10, fill: '#00000000', stroke: color, strokeWidth: 6, cornerRadius: 8 });
  r.anchorX = 0;
  r.anchorY = 0;
  return r;
};

function spriteOf(frame: FighterFrame, height: number): Sprite {
  const s = height / frame.h;
  const sp = new Sprite({ texture: frame.texture, width: frame.w * s, height: height });
  sp.anchorX = frame.anchorX / frame.w;
  sp.anchorY = frame.anchorY / frame.h;
  return sp;
}

export class CharacterSelectScene extends Scene {
  private ctx!: GameContext;
  private roster: readonly CharacterData[] = [];
  private cursor: [number, number] = [0, 1];
  private locked: [boolean, boolean] = [false, false];
  private cursors!: [RectShape, RectShape];
  private previews: [Sprite | null, Sprite | null] = [null, null];
  private names!: [Label, Label];
  private info!: Label;
  private special!: Label;
  private shuffle = -1;
  private leaving = false;
  private tick = 0;

  override onCreate(params?: SceneParams): void {
    this.ctx = ctxOf(params);
    const { assets, session } = this.ctx;
    this.roster = CHARACTERS.filter((c) => assets.hasFighter(c.id));
    this.cursor = [Math.max(0, this.roster.findIndex((c) => c.id === session.p1)), Math.max(0, this.roster.findIndex((c) => c.id === session.p2))];
    this.add(createBackdrop(assets, session.stageId, 0.72));
    this.add(new Label('CHOOSE YOUR FIGHTER', W / 2, 52, { size: 46, color: COLORS.gold, font: FONT_TITLE }));
    this.buildCards();
    this.cursors = [cursorBox('#3b82f6'), cursorBox('#ef4444')];
    this.cursors[1].visible = session.mode === '2p';
    this.add(this.cursors[0], this.cursors[1]);
    const mode = session.mode === '1p' ? `1P VS CPU  (${session.difficulty.toUpperCase()})` : '2P VERSUS';
    this.add(new Label(mode, W / 2, 96, { size: 22, color: COLORS.dim }));
    this.names = [new Label('', 170, 600, { size: 34, font: FONT_TITLE }), new Label('', W - 170, 600, { size: 34, font: FONT_TITLE })];
    this.add(...this.names);
    this.info = new Label('', W / 2, 628, { size: 22, color: COLORS.white });
    this.special = new Label('', W / 2, 662, { size: 22, color: COLORS.gold });
    this.add(this.info, this.special);
    this.add(new Label('P1', 170, 128, { size: 40, color: '#60a5fa', font: FONT_TITLE }));
    this.add(new Label(session.mode === '1p' ? 'CPU' : 'P2', W - 170, 128, { size: 40, color: '#f87171', font: FONT_TITLE }));
    this.refresh();
  }

  override onResume(): void {
    this.leaving = false;
    hook().scene = 'select';
    this.ctx.assets.audio.music('music_select');
  }

  private cardPos(i: number): { x: number; y: number } {
    const rows = Math.ceil(this.roster.length / COLS);
    const x0 = (W - (COLS * CARD_W + (COLS - 1) * GAP)) / 2;
    const y0 = 118 + (2 - rows) * (CARD_H / 2);
    return { x: x0 + (i % COLS) * (CARD_W + GAP), y: y0 + Math.floor(i / COLS) * (CARD_H + GAP) };
  }

  private buildCards(): void {
    this.roster.forEach((c, i) => {
      const { x, y } = this.cardPos(i);
      this.add(rect(x, y, CARD_W, CARD_H, '#0b1020', 0.82));
      this.add(rect(x, y + CARD_H - 40, CARD_W, 40, c.accent, 0.9));
      this.add(new Label(c.displayName.toUpperCase(), x + CARD_W / 2, y + CARD_H - 20, { size: 17, font: FONT_TITLE, color: COLORS.ink, shadow: null }));
      const frame = this.ctx.assets.fighter(c.id).get('idle');
      if (frame) {
        const sp = spriteOf(frame, 168);
        sp.x = x + CARD_W / 2;
        sp.y = y + CARD_H - 48;
        this.add(sp);
      }
    });
  }

  private refresh(): void {
    const { assets, session } = this.ctx;
    ([0, 1] as const).forEach((p) => {
      const pos = this.cardPos(this.cursor[p]);
      const inset = p === 1 && this.cursor[0] === this.cursor[1] ? 6 : 0;
      this.cursors[p].x = pos.x - 5 + inset;
      this.cursors[p].y = pos.y - 5 + inset;
      const c = this.roster[this.cursor[p]];
      const frame = c ? assets.fighter(c.id).get('idle') : undefined;
      if (!c || !frame) return;
      this.names[p].setText(c.displayName.toUpperCase());
      this.names[p].setColor(this.locked[p] ? COLORS.gold : COLORS.white);
      const old = this.previews[p];
      if (old) this.remove(old);
      const sp = spriteOf(frame, PREVIEW_H);
      sp.x = p === 0 ? 170 : W - 170;
      sp.y = 570;
      sp.scaleX = p === 0 ? 1 : -1;
      if (p === 1 && session.p1 === c.id && this.roster[this.cursor[0]]?.id === c.id) sp.tint = [0.75, 0.85, 1.25, 1];
      this.add(sp);
      this.previews = p === 0 ? [sp, this.previews[1]] : [this.previews[0], sp];
    });
    const focus = this.roster[this.cursor[this.locked[0] ? 1 : 0]];
    if (focus) {
      this.info.setText(focus.tagline);
      this.special.setText(`SPECIAL  ${focus.specialName.toUpperCase()}`);
    }
  }

  private edgesFor(p: 0 | 1): NavEdges {
    return this.ctx.controls.edges(p, p === 0 && this.ctx.session.mode === '1p');
  }

  private apply(p: 0 | 1, e: NavEdges): void {
    const { assets } = this.ctx;
    if (this.locked[p]) {
      if (e.back) {
        this.locked = p === 0 ? [false, this.locked[1]] : [this.locked[0], false];
        this.shuffle = -1;
        this.refresh();
      }
      return;
    }
    const dx = (e.right ? 1 : 0) - (e.left ? 1 : 0);
    const dy = (e.down ? 1 : 0) - (e.up ? 1 : 0);
    if (dx !== 0 || dy !== 0) {
      const next = moveGrid(this.cursor[p], COLS, this.roster.length, dx, dy);
      this.cursor = p === 0 ? [next, this.cursor[1]] : [this.cursor[0], next];
      assets.play('ui_move');
      this.speak(next);
      this.refresh();
    } else if (e.confirm) {
      this.locked = p === 0 ? [true, this.locked[1]] : [this.locked[0], true];
      assets.play('ui_select');
      this.speak(this.cursor[p]);
      if (p === 0 && this.ctx.session.mode === '1p') {
        this.shuffle = SHUFFLE_FRAMES;
        this.cursors[1].visible = true;
      }
      this.refresh();
    } else if (e.back && p === 0) {
      this.leaving = true;
      void goto(this.ctx, 'title');
    }
  }

  /** The announcer reads the name of the fighter under a cursor. */
  private speak(index: number | undefined): void {
    const c = index === undefined ? undefined : this.roster[index];
    if (c) this.ctx.assets.audio.speakName(c.id);
  }

  private cpuPick(): void {
    if (this.shuffle < 0) return;
    this.shuffle -= 1;
    if (this.shuffle % 4 === 0 && this.shuffle > 0) {
      this.cursor = [this.cursor[0], (this.cursor[1] + 1) % this.roster.length];
      this.ctx.assets.play('ui_move', 0.4);
      this.refresh();
    }
    if (this.shuffle === 0) {
      this.cursor = [this.cursor[0], Math.floor(Math.random() * this.roster.length)];
      this.locked = [true, true];
      this.speak(this.cursor[1]);
      this.refresh();
    }
  }

  override onUpdate(): void {
    if (this.leaving || this.roster.length === 0) return;
    this.tick += 1;
    const mode = this.ctx.session.mode;
    this.apply(0, this.edgesFor(0));
    if (mode === '2p') this.apply(1, this.edgesFor(1));
    else this.cpuPick();
    if (this.locked[0] && this.locked[1] && !this.leaving) {
      this.leaving = true;
      updateSession(this.ctx, { p1: (this.roster[this.cursor[0]] as CharacterData).id, p2: (this.roster[this.cursor[1]] as CharacterData).id });
      setTimeoutFrames(this, () => void goto(this.ctx, 'stage'));
    }
  }
}

/** Waits about half a second of scene time so the picked fighters are seen before moving on. */
function setTimeoutFrames(scene: Scene, fn: () => void): void {
  const t = window.setTimeout(fn, 450);
  const prev = scene.onDestroy.bind(scene);
  scene.onDestroy = () => {
    window.clearTimeout(t);
    prev();
  };
}
