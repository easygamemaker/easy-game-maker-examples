import type { MusicId } from './catalog';

/**
 * Crossfade state machine for the background music. Pure: every call returns a new state.
 * `gains` holds the fade level (0 to 1) of every track that is currently playing or fading; a track whose level reaches
 * zero while it is not the target is reported as stopped. `duck` lowers the whole music bus while the announcer speaks.
 */
export interface MixerState {
  readonly target: MusicId | null;
  readonly gains: Readonly<Partial<Record<MusicId, number>>>;
  /** Current bus factor from ducking and pause (0 to 1). */
  readonly bus: number;
}

export const FADE_SECONDS = 1.2;
export const DUCK_LEVEL = 0.35;
const DUCK_ATTACK = 0.08;
const DUCK_RELEASE = 0.6;
const PAUSE_FADE = 0.25;

export const INITIAL_MIXER: MixerState = { target: null, gains: {}, bus: 1 };

export interface MixerStep {
  readonly state: MixerState;
  readonly started: readonly MusicId[];
  readonly stopped: readonly MusicId[];
}

/** Picks the track that should play (null for silence). Returns the same state when it already is the target. */
export function requestTrack(s: MixerState, id: MusicId | null): { state: MixerState; started: readonly MusicId[] } {
  if (s.target === id) return { state: s, started: [] };
  const started = id !== null && s.gains[id] === undefined ? [id] : [];
  const gains = id !== null && s.gains[id] === undefined ? { ...s.gains, [id]: 0 } : s.gains;
  return { state: { ...s, target: id, gains }, started };
}

const toward = (v: number, goal: number, rate: number): number => (goal > v ? Math.min(goal, v + rate) : Math.max(goal, v - rate));

/** Advances the fades by `dt` seconds. `busGoal` is the wanted bus factor (DUCK_LEVEL while ducked, 0 while paused). */
export function stepMixer(s: MixerState, dt: number, busGoal: number): MixerStep {
  const rate = dt / FADE_SECONDS;
  const gains: Partial<Record<MusicId, number>> = {};
  const stopped: MusicId[] = [];
  for (const [id, g] of Object.entries(s.gains) as [MusicId, number][]) {
    const next = toward(g, id === s.target ? 1 : 0, rate);
    if (next <= 0 && id !== s.target) stopped.push(id);
    else gains[id] = next;
  }
  const speed = busGoal < s.bus ? (busGoal === 0 ? PAUSE_FADE : DUCK_ATTACK) : DUCK_RELEASE;
  const bus = toward(s.bus, busGoal, dt / speed);
  return { state: { ...s, gains, bus }, started: [], stopped };
}

/** Final level of one track: its fade level times the bus factor. */
export const outputGain = (s: MixerState, id: MusicId): number => (s.gains[id] ?? 0) * s.bus;

/** A one-shot track ended by itself: forget it so a later request starts it again. */
export function trackEnded(s: MixerState, id: MusicId): MixerState {
  if (s.gains[id] === undefined) return s;
  const { [id]: _gone, ...rest } = s.gains;
  return { ...s, gains: rest, target: s.target === id ? null : s.target };
}
