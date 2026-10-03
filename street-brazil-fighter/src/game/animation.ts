import { getCharacter, type MoveData, type MoveKey } from '../data/characters';
import type { FighterState } from '../sim';

/**
 * Animation clips on top of the sim. Pure: a clip is picked from the sim state and a frame index is derived
 * from counters the sim already keeps (stateFrame, moveFrame), so the same state always draws the same frame.
 * The sim never reads any of this.
 */
export interface Clip {
  /** Atlas frame names, in order. */
  readonly frames: readonly string[];
  /** Simulation steps (60 Hz) each frame stays on screen. */
  readonly durations: readonly number[];
  readonly loop: boolean;
}

const names = (prefix: string, n: number): readonly string[] => Array.from({ length: n }, (_, i) => `${prefix}_${i}`);
const same = (n: number, d: number): readonly number[] => Array.from({ length: n }, () => d);

/** Breathing: about 6 frames per second, a bob that goes down and back up. */
export const IDLE_CLIP: Clip = { frames: ['idle_0', 'idle_1', 'idle_2', 'idle_1'], durations: same(4, 10), loop: true };
/** Walk cycle at 12 frames per second. */
export const WALK_CLIP: Clip = { frames: names('walk', 6), durations: same(6, 5), loop: true };
/** Walking backwards plays the same cycle in reverse, so the feet appear to step back. */
export const WALK_BACK_CLIP: Clip = { frames: [...WALK_CLIP.frames].reverse(), durations: [...WALK_CLIP.durations], loop: true };

/** Moves that have a three frame attack clip, and the atlas prefix of that clip. */
export const ATTACK_CLIP_PREFIX: Readonly<Partial<Record<MoveKey, string>>> = {
  lightPunch: 'punch',
  heavyKick: 'kick',
  special: 'special',
};

/** Moves whose long recovery first pulls the limb back through the chamber frame, then drops to the stance. */
const CHAMBER_RECOVERY: ReadonlySet<MoveKey> = new Set<MoveKey>(['heavyKick']);
const CHAMBER_SHARE = 0.45;

/**
 * One-shot clip locked to the move data: frame 0 for the startup, 1 for the active frames, 2 for the recovery.
 * With `chamber` the first part of the recovery shows frame 0 again (the leg coming back) before frame 2.
 */
export function attackClip(prefix: string, move: MoveData, chamber = false): Clip {
  if (!chamber) return { frames: names(prefix, 3), durations: [move.startup, move.active, move.recovery], loop: false };
  const back = Math.max(1, Math.round(move.recovery * CHAMBER_SHARE));
  return {
    frames: [`${prefix}_0`, `${prefix}_1`, `${prefix}_0`, `${prefix}_2`],
    durations: [move.startup, move.active, back, Math.max(1, move.recovery - back)],
    loop: false,
  };
}

/** Index of the clip frame shown `t` steps after the clip began. One-shot clips hold their last frame. */
export function clipIndex(clip: Clip, t: number): number {
  const total = clip.durations.reduce((a, b) => a + b, 0);
  if (total <= 0) return 0;
  let u = Math.max(0, Math.floor(t));
  if (clip.loop) u %= total;
  else if (u >= total) return clip.frames.length - 1;
  for (let i = 0; i < clip.durations.length; i++) {
    const d = clip.durations[i] as number;
    if (u < d) return i;
    u -= d;
  }
  return clip.frames.length - 1;
}

/**
 * Animation frame name for a fighter this step, or null when the sim's own pose should be used
 * (jump, crouch, block, hit, knockdown, victory, and the moves without a clip).
 */
export function clipFrameName(f: FighterState): string | null {
  switch (f.state) {
    case 'idle':
      return pick(IDLE_CLIP, f.stateFrame);
    case 'walkForward':
      return pick(WALK_CLIP, f.stateFrame);
    case 'walkBack':
      return pick(WALK_BACK_CLIP, f.stateFrame);
    case 'attack': {
      if (!f.moveId || f.moveFrame < 1) return null;
      const prefix = ATTACK_CLIP_PREFIX[f.moveId];
      if (!prefix) return null;
      const clip = attackClip(prefix, getCharacter(f.characterId).moves[f.moveId], CHAMBER_RECOVERY.has(f.moveId));
      return pick(clip, f.moveFrame - 1);
    }
    default:
      return null;
  }
}

function pick(clip: Clip, t: number): string {
  return clip.frames[clipIndex(clip, t)] as string;
}
