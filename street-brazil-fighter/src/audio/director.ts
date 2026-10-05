import { ONE_SHOT_MUSIC, soundUrl, type MusicId, type SoundId } from './catalog';
import { SOUND_DURATIONS } from './durations';
import type { Cue } from './mapping';
import {
  DUCK_LEVEL, INITIAL_MIXER, outputGain, requestTrack, stepMixer, trackEnded, type MixerState,
} from './musicMixer';
import { channelGains, loadSettings, saveSettings, stepVolume, type AudioSettings, type KeyValueStore, type VolumeKey } from './settings';

/** The part of the engine's AudioManager that the director uses (a fake can stand in for it in tests). */
export interface AudioEngine {
  hasBuffer(key: string): boolean;
  playOnChannel(channel: string, key: string, options?: { loop?: boolean; volume?: number; onComplete?: () => void }): void;
  setChannelVolume(channel: string, volume: number): void;
  setSoundVolume(key: string, volume: number, channel?: string): void;
  channel(name: string): { stop(key: string): void; isPlaying(key: string): boolean };
}

export interface AudioLogEntry {
  readonly n: number;
  readonly kind: 'sfx' | 'voice' | 'music';
  readonly id: string;
}

/** Instrumentation exposed as window.__SBF__.audio so a headless run can check what the game asked to play. */
export interface AudioDebug {
  unlocked: boolean;
  hidden: boolean;
  paused: boolean;
  /** Track the mixer is heading for (null = silence). */
  music: MusicId | null;
  /** Tracks currently playing or fading, with their output gain. */
  playing: Record<string, number>;
  volumes: AudioSettings;
  loaded: number;
  failed: string[];
  counts: { sfx: number; voice: number; music: number };
  log: AudioLogEntry[];
}

const LOG_LIMIT = 600;

export function createDebug(settings: AudioSettings): AudioDebug {
  return {
    unlocked: false, hidden: false, paused: false, music: null, playing: {}, volumes: settings, loaded: 0, failed: [],
    counts: { sfx: 0, voice: 0, music: 0 }, log: [],
  };
}

/** Plays the game's music and sounds on three channels (music, sfx, voice) with settings, ducking and crossfades. */
export class AudioDirector {
  readonly debug: AudioDebug;
  private settings: AudioSettings;
  private mixer: MixerState = INITIAL_MIXER;
  private unlocked = false;
  private hidden = false;
  private paused = false;
  private time = 0;
  private duckLeft = 0;
  private logCount = 0;
  private readonly loaded = new Set<SoundId>();
  private queue: { readonly at: number; readonly cue: Cue }[] = [];
  private lastMusicLog: MusicId | null = null;

  constructor(private readonly engine: AudioEngine, private readonly store: KeyValueStore | null) {
    this.settings = loadSettings(store);
    this.debug = createDebug(this.settings);
    this.applyChannelVolumes();
  }

  // ---- loading and gesture --------------------------------------------------

  markLoaded(id: SoundId): void {
    this.loaded.add(id);
    this.debug.loaded = this.loaded.size;
  }

  markFailed(id: SoundId, reason: string): void {
    this.debug.failed.push(`${id}: ${reason}`);
  }

  isLoaded(id: SoundId): boolean {
    return this.loaded.has(id);
  }

  /** Browsers only allow audio after a user gesture: nothing is played before this. */
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    this.debug.unlocked = true;
    this.update(0);
  }

  get isUnlocked(): boolean {
    return this.unlocked;
  }

  // ---- settings -------------------------------------------------------------

  get current(): AudioSettings {
    return this.settings;
  }

  setSettings(next: AudioSettings): void {
    this.settings = next;
    this.debug.volumes = next;
    saveSettings(this.store, next);
    this.applyChannelVolumes();
  }

  adjust(key: VolumeKey, dir: -1 | 1): void {
    this.setSettings(stepVolume(this.settings, key, dir));
  }

  toggleMute(): void {
    this.setSettings({ ...this.settings, muted: !this.settings.muted });
  }

  private applyChannelVolumes(): void {
    const g = channelGains(this.settings);
    const quiet = this.hidden ? 0 : 1;
    this.engine.setChannelVolume('music', g.music * quiet);
    this.engine.setChannelVolume('sfx', g.sfx * quiet);
    this.engine.setChannelVolume('voice', g.sfx * quiet);
  }

  // ---- visibility and pause -------------------------------------------------

  /** No sound while the tab is hidden: the channels go silent and pending lines are dropped. */
  setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.debug.hidden = hidden;
    if (hidden) this.queue = [];
    this.applyChannelVolumes();
  }

  /** The music stops being heard while the game is paused (it keeps its place and fades back in on resume). */
  setPaused(paused: boolean): void {
    this.paused = paused;
    this.debug.paused = paused;
  }

  // ---- music ----------------------------------------------------------------

  /** Crossfades to a track (null fades everything out). Safe to call every frame with the same id. */
  music(id: MusicId | null): void {
    const r = requestTrack(this.mixer, id);
    this.mixer = r.state;
    this.debug.music = id;
    if (r.started.length > 0 || id !== this.lastMusicLog) {
      this.lastMusicLog = id;
      if (id !== null) this.log('music', id);
    }
  }

  // ---- effects and voice ----------------------------------------------------

  play(cue: Cue): void {
    if (!this.unlocked || this.hidden) return;
    if (cue.delay > 0) {
      this.queue.push({ at: this.time + cue.delay, cue: { ...cue, delay: 0 } });
      return;
    }
    if (!this.loaded.has(cue.id)) return; // a file that failed to load is simply silent
    this.engine.playOnChannel(cue.channel, soundUrl(cue.id), { volume: cue.volume });
    this.log(cue.channel, cue.id);
    if (cue.duck) this.duckLeft = Math.max(this.duckLeft, (SOUND_DURATIONS[cue.id] ?? 1) + 0.3);
  }

  playAll(cues: readonly Cue[]): void {
    for (const c of cues) this.play(c);
  }

  sfx(id: SoundId, volume = 1): void {
    this.play({ id, channel: 'sfx', volume, delay: 0, duck: false });
  }

  /** The select screen reads the fighter's name: a new name cuts the previous one. */
  speakName(fighter: string): void {
    for (const f of ['tiao', 'dalva', 'saci', 'curupira', 'craque', 'rosa']) {
      if (f !== fighter) this.engine.channel('voice').stop(soundUrl(`name_${f}` as SoundId));
    }
    this.play({ id: `name_${fighter}` as SoundId, channel: 'voice', volume: 0.9, delay: 0, duck: false });
  }

  // ---- frame update ---------------------------------------------------------

  update(dt: number): void {
    this.time += dt;
    this.duckLeft = Math.max(0, this.duckLeft - dt);
    if (this.hidden) return;
    const due = this.queue.filter((q) => q.at <= this.time);
    if (due.length > 0) {
      this.queue = this.queue.filter((q) => q.at > this.time);
      for (const q of due) this.play(q.cue);
    }
    if (!this.unlocked) return;
    const goal = this.paused ? 0 : this.duckLeft > 0 ? DUCK_LEVEL : 1;
    const step = stepMixer(this.mixer, dt, goal);
    this.mixer = step.state;
    for (const id of step.stopped) this.engine.channel('music').stop(soundUrl(id));
    const playing: Record<string, number> = {};
    for (const id of Object.keys(this.mixer.gains) as MusicId[]) {
      this.ensurePlaying(id);
      const g = outputGain(this.mixer, id);
      playing[id] = Number(g.toFixed(3));
      this.engine.setSoundVolume(soundUrl(id), g, 'music');
    }
    this.debug.playing = playing;
  }

  private ensurePlaying(id: MusicId): void {
    const url = soundUrl(id);
    if (!this.loaded.has(id) || this.engine.channel('music').isPlaying(url)) return;
    this.engine.playOnChannel('music', url, {
      loop: !ONE_SHOT_MUSIC.has(id),
      volume: outputGain(this.mixer, id),
      onComplete: () => {
        this.mixer = trackEnded(this.mixer, id);
      },
    });
  }

  private log(kind: AudioLogEntry['kind'], id: string): void {
    this.debug.counts[kind] += 1;
    this.debug.log.push({ n: ++this.logCount, kind, id });
    if (this.debug.log.length > LOG_LIMIT) this.debug.log.splice(0, this.debug.log.length - LOG_LIMIT);
  }

  // ---- browser wiring -------------------------------------------------------

  /** Hooks the first gesture, the M key and tab visibility. Returns a function that removes the listeners. */
  attachBrowser(win: Window & typeof globalThis): () => void {
    const gesture = (): void => this.unlock();
    const key = (e: KeyboardEvent): void => {
      this.unlock();
      if (e.code === 'KeyM' && !e.repeat) this.toggleMute();
    };
    const vis = (): void => this.setHidden(win.document.hidden);
    win.addEventListener('keydown', key, true);
    win.addEventListener('pointerdown', gesture, true);
    win.document.addEventListener('visibilitychange', vis);
    vis();
    return () => {
      win.removeEventListener('keydown', key, true);
      win.removeEventListener('pointerdown', gesture, true);
      win.document.removeEventListener('visibilitychange', vis);
    };
  }
}

