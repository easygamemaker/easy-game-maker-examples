import type { GameAudio } from 'easy-game-maker/3d';

/** The two sounds the built-in set does not have: the rifle pulse and the drone's bolt. */
export function defineSounds(audio: GameAudio): void {
  audio.define('pulse', (config) => {
    const pitch = config?.pitch ?? 1;
    audio.tone({ frequency: 980 * pitch, type: 'square', slide: -760 * pitch, duration: 0.07, gain: 0.16 });
    audio.noise({ duration: 0.06, gain: 0.14, frequency: 2600, type: 'highpass' });
    audio.tone({ frequency: 120 * pitch, type: 'triangle', slide: -60, duration: 0.09, gain: 0.2 });
  });
  audio.define('droneShot', (config) => {
    const pitch = config?.pitch ?? 1;
    audio.tone({ frequency: 520 * pitch, type: 'sawtooth', slide: -330 * pitch, duration: 0.2, gain: 0.07 });
  });
}
