/** Audio volume settings, persisted in localStorage (every access is wrapped: storage can be blocked or full). */

export interface AudioSettings {
  readonly master: number;
  readonly music: number;
  readonly sfx: number;
  readonly muted: boolean;
}

export const DEFAULT_SETTINGS: AudioSettings = { master: 0.8, music: 0.7, sfx: 1, muted: false };
export const STORAGE_KEY = 'sbf.audio.v1';
export const VOLUME_STEP = 0.1;

/** The minimum of the Storage interface used here, so tests can pass a fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const clampVolume = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(1, Math.max(0, v)) * 100) / 100 : fallback;

/** Reads the saved settings; anything missing, corrupt or unreadable falls back to the defaults. */
export function loadSettings(store: KeyValueStore | null): AudioSettings {
  try {
    const raw = store?.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const o = JSON.parse(raw) as Record<string, unknown>;
    return {
      master: clampVolume(o['master'], DEFAULT_SETTINGS.master),
      music: clampVolume(o['music'], DEFAULT_SETTINGS.music),
      sfx: clampVolume(o['sfx'], DEFAULT_SETTINGS.sfx),
      muted: o['muted'] === true,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

/** Returns false when the settings could not be saved (the game keeps working with them in memory). */
export function saveSettings(store: KeyValueStore | null, s: AudioSettings): boolean {
  try {
    store?.setItem(STORAGE_KEY, JSON.stringify(s));
    return store !== null;
  } catch {
    return false;
  }
}

export type VolumeKey = 'master' | 'music' | 'sfx';

export function stepVolume(s: AudioSettings, key: VolumeKey, dir: -1 | 1): AudioSettings {
  return { ...s, [key]: clampVolume(s[key] + dir * VOLUME_STEP, s[key]) };
}

/** Effective gain of each channel group: master times the group volume, zero while muted. */
export function channelGains(s: AudioSettings): { readonly music: number; readonly sfx: number } {
  if (s.muted) return { music: 0, sfx: 0 };
  return { music: s.master * s.music, sfx: s.master * s.sfx };
}

export function browserStore(): KeyValueStore | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}
