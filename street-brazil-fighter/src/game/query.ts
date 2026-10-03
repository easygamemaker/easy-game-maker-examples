import type { Difficulty } from '../sim';

/** Debug and automation switches read from the page address. */
export interface Query {
  /** `?autoplay=cpu` runs CPU against CPU. */
  readonly autoplay: boolean;
  /** `?hitboxes=1` draws hurtboxes and hitboxes. */
  readonly hitboxes: boolean;
  /** `?quick=1` skips the menus and starts a fight with p1, p2 and stage. */
  readonly quick: boolean;
  /** `?meter=1` starts both fighters with a full special meter (used to film specials). */
  readonly meter: boolean;
  readonly p1: string | null;
  readonly p2: string | null;
  readonly stage: string | null;
  /** `?p2mode=dummy` leaves P2 standing still (used by the automated hit test). */
  readonly p2mode: 'human' | 'cpu' | 'dummy' | null;
  readonly difficulty: Difficulty;
  /** Simulation steps per rendered frame (1 to 16), or a slow motion factor from 0.1 to below 1. */
  readonly speed: number;
  readonly seed: number;
}

const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

/** 1 to 16 whole steps per frame; below 1 a slow motion factor down to 0.1 (used to film animations). */
function parseSpeed(v: number): number {
  if (!Number.isFinite(v)) return 1;
  if (v < 1) return Math.max(0.1, Math.round(v * 100) / 100);
  return Math.min(16, Math.round(v));
}

export function parseQuery(search: string): Query {
  const q = new URLSearchParams(search);
  const diff = q.get('diff') as Difficulty | null;
  const mode = q.get('p2mode');
  const speed = Number(q.get('speed') ?? 1);
  const seed = Number(q.get('seed') ?? 1);
  return {
    autoplay: q.get('autoplay') === 'cpu',
    hitboxes: q.get('hitboxes') === '1',
    quick: q.get('quick') === '1',
    meter: q.get('meter') === '1',
    p1: q.get('p1'),
    p2: q.get('p2'),
    stage: q.get('stage'),
    p2mode: mode === 'dummy' || mode === 'cpu' || mode === 'human' ? mode : null,
    difficulty: diff && DIFFICULTIES.includes(diff) ? diff : 'normal',
    speed: parseSpeed(speed),
    seed: Number.isFinite(seed) ? seed : 1,
  };
}
