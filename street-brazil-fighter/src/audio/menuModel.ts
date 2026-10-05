import type { AudioSettings, VolumeKey } from './settings';

export interface AudioRow {
  readonly id: VolumeKey | 'mute' | 'back';
  readonly text: string;
}

const pct = (v: number): string => `${Math.round(v * 100)}%`;
const row = (label: string, value: string): string => `${label}  <  ${value}  >`;

/** The rows of the audio menu (title and pause menu) for the current settings. */
export function audioRows(s: AudioSettings): readonly AudioRow[] {
  return [
    { id: 'master', text: row('MASTER', pct(s.master)) },
    { id: 'music', text: row('MUSIC', pct(s.music)) },
    { id: 'sfx', text: row('EFFECTS', pct(s.sfx)) },
    { id: 'mute', text: row('MUTE', s.muted ? 'ON' : 'OFF') },
    { id: 'back', text: 'BACK' },
  ];
}
