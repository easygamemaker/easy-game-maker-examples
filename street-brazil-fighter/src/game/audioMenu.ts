import { Group } from 'easy-game-maker';
import type { AudioDirector } from '../audio/director';
import { audioRows } from '../audio/menuModel';
import type { NavEdges } from './controls';
import { COLORS, H, W } from './layout';
import { MenuList, type MenuEvent } from './menu';
import { Label, rect } from './ui';

/** Overlay with the volume rows, used by the title screen and the pause menu. `handle` returns true when the player leaves it. */
export class AudioMenu extends Group {
  private readonly menu: MenuList;

  constructor(private readonly audio: AudioDirector, top = 250) {
    super();
    this.visible = false;
    this.add(rect(0, 0, W, H, '#000000', 0.78));
    this.add(new Label('AUDIO', W / 2, top - 90, { size: 70, color: COLORS.gold }));
    this.menu = new MenuList(audioRows(audio.current).map((r) => ({ id: r.id, text: r.text })), W / 2, top, 70, 32);
    this.add(this.menu);
    this.add(new Label('Left and right change the value.  M mutes everything.', W / 2, top + 400, { size: 20, color: COLORS.dim }));
  }

  open(): void {
    this.refresh();
    this.visible = true;
  }

  close(): void {
    this.visible = false;
  }

  /** Re-reads the settings (the M key can change them while the menu is open). */
  refresh(): void {
    for (const r of audioRows(this.audio.current)) this.menu.setText(r.id, r.text);
  }

  private apply(ev: MenuEvent | null): boolean {
    if (!ev) return false;
    if (ev.type === 'move') this.audio.sfx('ui_move');
    else if (ev.type === 'adjust') {
      if (ev.id === 'master' || ev.id === 'music' || ev.id === 'sfx') this.audio.adjust(ev.id, ev.dir);
      else if (ev.id === 'mute') this.audio.toggleMute();
      this.audio.sfx('ui_move');
    } else if (ev.type === 'confirm') {
      if (ev.id === 'back') {
        this.audio.sfx('ui_select');
        return true;
      }
      if (ev.id === 'mute') this.audio.toggleMute();
      this.audio.sfx('ui_select');
    }
    this.refresh();
    return false;
  }

  navigate(edges: NavEdges): boolean {
    if (edges.back) return true;
    return this.apply(this.menu.navigate(edges));
  }

  press(x: number, y: number): boolean {
    return this.apply(this.menu.pointerPress(x, y));
  }

  hover(x: number, y: number): void {
    this.apply(this.menu.pointerHover(x, y));
  }
}
