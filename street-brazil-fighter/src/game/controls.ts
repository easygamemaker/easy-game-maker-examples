import { GButton, GAxis, type App } from 'easy-game-maker';
import type { PlayerInput } from '../sim';

export type Action = keyof PlayerInput;
export const ACTIONS: readonly Action[] = ['left', 'right', 'up', 'down', 'punch', 'kick', 'special', 'block'];

export const NO_INPUT: PlayerInput = {
  left: false, right: false, up: false, down: false, punch: false, kick: false, special: false, block: false,
};

export type KeyMap = Readonly<Record<Action, readonly string[]>>;

/** P1: WASD + J punch, K kick, L special, U block. */
export const P1_KEYS: KeyMap = {
  left: ['KeyA'], right: ['KeyD'], up: ['KeyW'], down: ['KeyS'],
  punch: ['KeyJ'], kick: ['KeyK'], special: ['KeyL'], block: ['KeyU'],
};
/** P2: arrows + numpad 1 punch, 2 kick, 3 special, 0 block. */
export const P2_KEYS: KeyMap = {
  left: ['ArrowLeft'], right: ['ArrowRight'], up: ['ArrowUp'], down: ['ArrowDown'],
  punch: ['Numpad1'], kick: ['Numpad2'], special: ['Numpad3'], block: ['Numpad0'],
};
export const KEY_MAPS: readonly [KeyMap, KeyMap] = [P1_KEYS, P2_KEYS];

export function keyboardInput(isDown: (code: string) => boolean, map: KeyMap): PlayerInput {
  const get = (a: Action): boolean => map[a].some(isDown);
  return {
    left: get('left'), right: get('right'), up: get('up'), down: get('down'),
    punch: get('punch'), kick: get('kick'), special: get('special'), block: get('block'),
  };
}

export interface PadReader {
  down(button: number): boolean;
  stick(): { x: number; y: number };
}

const STICK = 0.5;

/** Gamepad mapping: d-pad or left stick moves, X punch, A kick, Y special, B/LB/RB block. */
export function padInput(pad: PadReader): PlayerInput {
  const s = pad.stick();
  return {
    left: pad.down(GButton.DPAD_LEFT) || s.x < -STICK,
    right: pad.down(GButton.DPAD_RIGHT) || s.x > STICK,
    up: pad.down(GButton.DPAD_UP) || s.y < -STICK,
    down: pad.down(GButton.DPAD_DOWN) || s.y > STICK,
    punch: pad.down(GButton.X),
    kick: pad.down(GButton.A),
    special: pad.down(GButton.Y),
    block: pad.down(GButton.B) || pad.down(GButton.LB) || pad.down(GButton.RB),
  };
}

export function mergeInputs(...inputs: readonly PlayerInput[]): PlayerInput {
  const out = { ...NO_INPUT } as Record<Action, boolean>;
  for (const i of inputs) for (const a of ACTIONS) out[a] = out[a] || i[a];
  return out;
}

/** Menu navigation edges, true for one frame after the press. */
export interface NavEdges {
  readonly left: boolean;
  readonly right: boolean;
  readonly up: boolean;
  readonly down: boolean;
  readonly confirm: boolean;
  readonly back: boolean;
  readonly start: boolean;
}
const NO_EDGES: NavEdges = { left: false, right: false, up: false, down: false, confirm: false, back: false, start: false };

interface NavState {
  readonly left: boolean; readonly right: boolean; readonly up: boolean; readonly down: boolean;
  readonly confirm: boolean; readonly back: boolean; readonly start: boolean;
}

export function edgesOf(prev: NavState, cur: NavState): NavEdges {
  return {
    left: cur.left && !prev.left, right: cur.right && !prev.right,
    up: cur.up && !prev.up, down: cur.down && !prev.down,
    confirm: cur.confirm && !prev.confirm, back: cur.back && !prev.back, start: cur.start && !prev.start,
  };
}

/** Polls keyboard and gamepads each frame and gives per-player held inputs and menu edges. */
export class ControlHub {
  private prev: [NavState, NavState] = [NO_EDGES, NO_EDGES];
  private touch: PlayerInput = NO_INPUT;
  /** Scripted inputs used by the automation hook. Null means read the real devices. */
  override: [PlayerInput, PlayerInput] | null = null;

  /** Keys pressed since the last frame ended, so a tap shorter than one frame is not lost. */
  private readonly latched = new Set<string>();

  constructor(private readonly app: App) {
    app.input.on('keydown', (e: unknown) => this.latched.add((e as { code: string }).code));
  }

  /** Call once per rendered frame after the sim steps ran. */
  endFrame(): void {
    this.latched.clear();
  }

  private isDown(code: string): boolean {
    return this.app.input.isKeyDown(code) || this.latched.has(code);
  }

  setTouch(input: PlayerInput): void {
    this.touch = input;
  }

  private pad(slot: 0 | 1): PlayerInput {
    const gp = this.app.gamepad;
    if (!gp.isConnectedAt(slot)) return NO_INPUT;
    return padInput({
      down: (b) => gp.isButtonDown(b, slot),
      stick: () => ({ x: gp.getAxis(GAxis.LEFT_X, slot), y: gp.getAxis(GAxis.LEFT_Y, slot) }),
    });
  }

  /** Held fight input of one player. P1 also gets the touch pad. */
  held(slot: 0 | 1): PlayerInput {
    if (this.override) return this.override[slot];
    const kb = keyboardInput((c) => this.isDown(c), KEY_MAPS[slot]);
    return mergeInputs(kb, this.pad(slot), slot === 0 ? this.touch : NO_INPUT);
  }

  private navState(slot: 0 | 1, shared: boolean): NavState {
    const slots: readonly (0 | 1)[] = shared ? [0, 1] : [slot];
    const keys = (codes: readonly string[]): boolean => codes.some((c) => this.app.input.isKeyDown(c));
    let s: NavState = { left: false, right: false, up: false, down: false, confirm: false, back: false, start: false };
    for (const p of slots) {
      const h = mergeInputs(keyboardInput((c) => this.app.input.isKeyDown(c), KEY_MAPS[p]), this.pad(p));
      const pad = this.app.gamepad;
      s = {
        left: s.left || h.left, right: s.right || h.right, up: s.up || h.up, down: s.down || h.down,
        confirm: s.confirm || h.punch || h.kick || (p === 0 ? keys(['Enter', 'Space']) : keys(['NumpadEnter'])) || (pad.isConnectedAt(p) && pad.isButtonDown(GButton.A, p)),
        back: s.back || h.block || (p === 0 && keys(['Escape', 'Backspace'])),
        start: s.start || (p === 0 && keys(['Enter', 'Escape', 'KeyP'])) || (pad.isConnectedAt(p) && pad.isButtonDown(GButton.START, p)),
      };
    }
    return s;
  }

  /** Call once per frame. Returns the edges of the player (or of everybody when `shared`). */
  edges(slot: 0 | 1, shared = false): NavEdges {
    const cur = this.navState(slot, shared);
    const key = shared ? 0 : slot;
    const e = edgesOf(this.prev[key], cur);
    this.prev = key === 0 ? [cur, this.prev[1]] : [this.prev[0], cur];
    return e;
  }
}
