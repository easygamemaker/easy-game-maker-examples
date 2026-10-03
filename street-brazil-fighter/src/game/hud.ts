import { CircleShape, Group, RectShape } from 'easy-game-maker';
import { getCharacter } from '../data/characters';
import type { Banner, MatchState, Side } from '../sim';
import { METER_MAX, SPECIAL_COST } from '../sim';
import type { Mode } from './context';
import { COLORS, H, W } from './layout';
import { FONT_TITLE, Label, rect } from './ui';

const BAR_W = 520;
const BAR_H = 32;
const BAR_Y = 30;
const BAR_X: readonly [number, number] = [60, W - 60 - BAR_W];
const METER_W = 300;
const METER_Y = 98;

export const healthColor = (fraction: number): string => (fraction > 0.5 ? '#2ee66b' : fraction > 0.25 ? '#ffd23f' : '#ff4d4d');

/** Text of the big center banner for the given sim banner and game mode. */
export function bannerText(banner: Banner | null, mode: Mode, winner: Side | null): string {
  if (banner === null) return '';
  if (banner === 'P1 WINS' || banner === 'P2 WINS') {
    if (mode === '1p') return winner === 0 ? 'YOU WIN' : 'YOU LOSE';
    return banner;
  }
  return banner;
}

const BANNER_COLOR = (text: string): string => {
  if (text === 'KO!' || text === 'YOU LOSE') return '#ff4d4d';
  if (text === 'FIGHT!') return COLORS.gold;
  if (text === 'TIME!') return '#ff9f1c';
  return COLORS.white;
};

interface SideWidgets {
  readonly trail: RectShape;
  readonly fill: RectShape;
  readonly meter: RectShape;
  readonly meterLabel: Label;
  readonly combo: Label;
  readonly pips: readonly CircleShape[];
}

export class Hud extends Group {
  private readonly widgets: readonly [SideWidgets, SideWidgets];
  private readonly timer: Label;
  private readonly banner: Label;
  private readonly bannerBox = new Group();
  private trail: readonly [number, number] = [1, 1];

  constructor(p1: string, p2: string, private readonly mode: Mode) {
    super();
    this.zIndex = 100;
    this.add(rect(0, 0, W, 130, '#000000', 0.28));
    const make = (side: Side): SideWidgets => {
      const x = BAR_X[side];
      this.add(rect(x - 4, BAR_Y - 4, BAR_W + 8, BAR_H + 8, '#0b0f1c', 0.9));
      const anchor = side === 0 ? 0 : 1;
      const edge = side === 0 ? x : x + BAR_W;
      const trail = rect(edge, BAR_Y, BAR_W, BAR_H, '#ff7a1a', 1, [anchor, 0]);
      const fill = rect(edge, BAR_Y, BAR_W, BAR_H, '#2ee66b', 1, [anchor, 0]);
      this.add(trail, fill);
      const meterEdge = side === 0 ? x : x + BAR_W;
      this.add(rect(side === 0 ? meterEdge - 3 : meterEdge + 3 - METER_W, METER_Y - 3, METER_W + 0, 22, '#0b0f1c', 0.85));
      const meter = rect(meterEdge, METER_Y, 0, 16, '#3aa0ff', 1, [anchor, 0]);
      this.add(meter);
      const char = getCharacter(side === 0 ? p1 : p2);
      this.add(new Label(char.displayName.toUpperCase(), edge, 79, { size: 20, font: FONT_TITLE, align: side === 0 ? 'left' : 'right' }));
      const meterLabel = new Label('SPECIAL', side === 0 ? meterEdge + METER_W + 12 : meterEdge - METER_W - 12, METER_Y + 8, { size: 15, color: COLORS.dim, align: side === 0 ? 'left' : 'right' });
      this.add(meterLabel);
      const combo = new Label('', side === 0 ? 70 : W - 70, 190, { size: 46, font: FONT_TITLE, color: COLORS.gold, align: side === 0 ? 'left' : 'right' });
      combo.visible = false;
      this.add(combo);
      const pips = [0, 1].map((i) => {
        const c = new CircleShape({ radius: 9, fill: '#00000000', stroke: COLORS.gold, strokeWidth: 3 });
        c.x = side === 0 ? 540 - i * 26 : W - 540 + i * 26;
        c.y = 82;
        this.add(c);
        return c;
      });
      return { trail, fill, meter, meterLabel, combo, pips };
    };
    this.widgets = [make(0), make(1)];
    this.add(rect(W / 2 - 52, 22, 104, 76, '#0b0f1c', 0.92));
    this.add(rect(W / 2 - 52, 22, 104, 6, COLORS.gold));
    this.timer = new Label('99', W / 2, 62, { size: 58, font: FONT_TITLE, color: COLORS.gold });
    this.add(this.timer);
    this.banner = new Label('', 0, 0, { size: 140, font: FONT_TITLE });
    this.bannerBox.x = W / 2;
    this.bannerBox.y = H / 2 - 90;
    this.bannerBox.add(this.banner);
    this.add(this.bannerBox);
  }

  update(m: MatchState): void {
    const trailNext: [number, number] = [this.trail[0], this.trail[1]];
    ([0, 1] as const).forEach((s) => {
      const f = m.fighters[s];
      const w = this.widgets[s];
      const frac = Math.max(0, f.health / f.maxHealth);
      w.fill.width = Math.max(0, BAR_W * frac);
      w.fill.fillColor = RectShape.parseColor(healthColor(frac));
      // the orange trail catches up slowly, so recent damage stays visible
      trailNext[s] = frac >= this.trail[s] ? frac : Math.max(frac, this.trail[s] - 0.006);
      w.trail.width = BAR_W * trailNext[s];
      const mf = Math.min(1, f.meter / METER_MAX);
      w.meter.width = METER_W * mf;
      const ready = f.meter >= SPECIAL_COST;
      w.meter.fillColor = RectShape.parseColor(ready ? (m.frame % 24 < 12 ? '#ffd23f' : '#ffb000') : '#3aa0ff');
      w.meterLabel.setText(ready ? 'SPECIAL READY' : 'SPECIAL');
      w.meterLabel.setColor(ready ? COLORS.gold : COLORS.dim);
      const attackerCombo = m.fighters[s === 0 ? 1 : 0].comboCount;
      w.combo.visible = attackerCombo >= 2;
      if (w.combo.visible) w.combo.setText(`${attackerCombo} HITS`);
      w.pips.forEach((p, i) => {
        const won = m.wins[s] > i;
        p.fillColor = RectShape.parseColor(won ? COLORS.gold : '#00000000');
        p.isDirty = true;
      });
    });
    this.trail = trailNext;
    this.timer.setText(String(Math.max(0, m.timerSeconds)).padStart(2, '0'));
    const text = bannerText(m.banner, this.mode, m.winner ?? m.roundWinner);
    this.banner.visible = text !== '';
    if (text !== '') {
      if (this.banner.text !== text) {
        this.banner.setText(text);
      }
      this.banner.setColor(BANNER_COLOR(text));
      const t = Math.min(1, m.phaseFrame / 10);
      const s = 1 + 0.9 * (1 - t) * (1 - t);
      this.bannerBox.scaleX = s;
      this.bannerBox.scaleY = s;
      this.bannerBox.alpha = Math.min(1, 0.2 + t);
    }
  }
}
