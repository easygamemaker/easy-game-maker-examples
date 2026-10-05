import { describe, expect, it } from 'vitest';
import { STAGES } from '../../data/stages';
import { MUSIC_IDS, SOUND_IDS, STAGE_MUSIC, fightMusicFor } from '../../audio/catalog';
import { AudioDirector, type AudioEngine } from '../../audio/director';
import { SOUND_DURATIONS } from '../../audio/durations';
import { EVENT_POLICY, cuesForEvent } from '../../audio/mapping';
import { audioRows } from '../../audio/menuModel';
import { DUCK_LEVEL, FADE_SECONDS, INITIAL_MIXER, outputGain, requestTrack, stepMixer, trackEnded } from '../../audio/musicMixer';
import { DEFAULT_SETTINGS, STORAGE_KEY, channelGains, clampVolume, loadSettings, saveSettings, stepVolume, type KeyValueStore } from '../../audio/settings';
import { createMatch, type MatchState, type SimEvent } from '../../sim';
import { startFight } from '../../sim/testing';

const memoryStore = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe('audio settings', () => {
  it('starts from the defaults and clamps values', () => {
    expect(loadSettings(memoryStore())).toEqual(DEFAULT_SETTINGS);
    expect(clampVolume(2, 0.5)).toBe(1);
    expect(clampVolume(-1, 0.5)).toBe(0);
    expect(clampVolume('x', 0.5)).toBe(0.5);
    expect(clampVolume(Number.NaN, 0.5)).toBe(0.5);
  });

  it('persists and reloads volumes and mute', () => {
    const store = memoryStore();
    const s = { master: 0.3, music: 0.5, sfx: 0.9, muted: true };
    expect(saveSettings(store, s)).toBe(true);
    expect(loadSettings(store)).toEqual(s);
  });

  it('survives corrupt data, blocked storage and a missing store', () => {
    const store = memoryStore();
    store.data.set(STORAGE_KEY, '{not json');
    expect(loadSettings(store)).toEqual(DEFAULT_SETTINGS);
    const blocked: KeyValueStore = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
    expect(loadSettings(blocked)).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings(blocked, DEFAULT_SETTINGS)).toBe(false);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(saveSettings(null, DEFAULT_SETTINGS)).toBe(false);
  });

  it('steps by 10 percent within 0..1 and mutes the channel gains', () => {
    expect(stepVolume({ ...DEFAULT_SETTINGS, master: 0.95 }, 'master', 1).master).toBe(1);
    expect(stepVolume({ ...DEFAULT_SETTINGS, music: 0.05 }, 'music', -1).music).toBe(0);
    expect(channelGains({ master: 0.5, music: 0.5, sfx: 1, muted: false })).toEqual({ music: 0.25, sfx: 0.5 });
    expect(channelGains({ ...DEFAULT_SETTINGS, muted: true })).toEqual({ music: 0, sfx: 0 });
  });

  it('formats the audio menu rows', () => {
    const rows = audioRows({ master: 0.8, music: 0.7, sfx: 1, muted: false });
    expect(rows.map((r) => r.id)).toEqual(['master', 'music', 'sfx', 'mute', 'back']);
    expect(rows[0]?.text).toContain('80%');
    expect(rows[3]?.text).toContain('OFF');
  });
});

describe('music mixer', () => {
  it('fades a new track in and the old one out, then reports the old one as stopped', () => {
    let s = requestTrack(INITIAL_MIXER, 'music_title').state;
    for (let i = 0; i < 120; i++) s = stepMixer(s, 1 / 60, 1).state;
    expect(outputGain(s, 'music_title')).toBe(1);
    const next = requestTrack(s, 'music_select');
    expect(next.started).toEqual(['music_select']);
    s = next.state;
    s = stepMixer(s, FADE_SECONDS / 2, 1).state;
    expect(s.gains.music_title).toBeCloseTo(0.5);
    expect(s.gains.music_select).toBeCloseTo(0.5);
    const done = stepMixer(s, FADE_SECONDS, 1);
    expect(done.stopped).toEqual(['music_title']);
    expect(done.state.gains.music_title).toBeUndefined();
    expect(done.state.gains.music_select).toBe(1);
  });

  it('asking for the track already playing changes nothing', () => {
    const s = requestTrack(INITIAL_MIXER, 'music_title').state;
    const again = requestTrack(s, 'music_title');
    expect(again.state).toBe(s);
    expect(again.started).toEqual([]);
  });

  it('null fades everything out', () => {
    let s = requestTrack(INITIAL_MIXER, 'music_fight_a').state;
    s = stepMixer(s, 5, 1).state;
    s = requestTrack(s, null).state;
    const r = stepMixer(s, 5, 1);
    expect(r.stopped).toEqual(['music_fight_a']);
    expect(Object.keys(r.state.gains)).toHaveLength(0);
  });

  it('ducks the bus quickly and releases it slowly, and pause silences it', () => {
    let s = stepMixer(requestTrack(INITIAL_MIXER, 'music_title').state, 5, 1).state;
    s = stepMixer(s, 0.2, DUCK_LEVEL).state;
    expect(s.bus).toBeCloseTo(DUCK_LEVEL);
    const rel = stepMixer(s, 0.1, 1).state;
    expect(rel.bus).toBeGreaterThan(DUCK_LEVEL);
    expect(rel.bus).toBeLessThan(1);
    const paused = stepMixer(rel, 1, 0).state;
    expect(outputGain(paused, 'music_title')).toBe(0);
  });

  it('a one-shot track that ended can be started again', () => {
    let s = requestTrack(INITIAL_MIXER, 'music_victory').state;
    s = trackEnded(s, 'music_victory');
    expect(s.target).toBeNull();
    expect(requestTrack(s, 'music_victory').started).toEqual(['music_victory']);
  });
});

describe('stage music', () => {
  it('maps every stage to one of the two fight tracks and uses both', () => {
    for (const st of STAGES) expect(['music_fight_a', 'music_fight_b']).toContain(fightMusicFor(st.id));
    expect(new Set(STAGES.map((s) => fightMusicFor(s.id))).size).toBe(2);
    expect(Object.keys(STAGE_MUSIC).sort()).toEqual(STAGES.map((s) => s.id).sort());
  });
});

// ---- the sim event to sound mapping -------------------------------------------------------

const fight = (p1 = 'tiao', p2 = 'dalva'): MatchState => startFight({ p1, p2 });
const SAMPLE_EVENTS: readonly SimEvent[] = [
  { type: 'roundStart', round: 1 },
  { type: 'fightStart', round: 1 },
  { type: 'attackStart', player: 0, moveId: 'lightPunch' },
  { type: 'specialStart', player: 0, characterId: 'tiao', x: 0, y: 0 },
  { type: 'hit', attacker: 0, defender: 1, moveId: 'lightPunch', damage: 40, x: 0, y: 0, special: false, knockdown: false, comboCount: 1, projectile: false },
  { type: 'block', attacker: 0, defender: 1, moveId: 'lightPunch', chip: 0, x: 0, y: 0, special: false, projectile: false },
  { type: 'projectileSpawn', id: 1, owner: 0, x: 0, y: 0, visual: 'slash' },
  { type: 'projectileHit', id: 1, owner: 0, x: 0, y: 0, blocked: false },
  { type: 'projectileClash', ids: [1, 2], x: 0, y: 0 },
  { type: 'projectileExpire', id: 1, owner: 0, x: 0, y: 0 },
  { type: 'knockdown', player: 1, x: 0 },
  { type: 'wakeUp', player: 1, x: 0 },
  { type: 'ko', player: 1, x: 0, y: 0 },
  { type: 'jump', player: 0, x: 0 },
  { type: 'land', player: 0, x: 0 },
  { type: 'timeUp' },
  { type: 'roundEnd', round: 1, winner: 0, reason: 'ko' },
  { type: 'matchEnd', winner: 0 },
];

describe('sim event to sound mapping', () => {
  const match = fight();
  const ctx = { match, mode: '1p' as const };

  it('every sim event type is classified as a sound or explicitly silent, and the sample list covers them all', () => {
    expect(new Set(SAMPLE_EVENTS.map((e) => e.type))).toEqual(new Set(Object.keys(EVENT_POLICY)));
  });

  it('events marked as sound produce cues, silent ones produce none', () => {
    for (const e of SAMPLE_EVENTS) {
      const cues = cuesForEvent(e, ctx);
      if (EVENT_POLICY[e.type] === 'silent') expect(cues, e.type).toHaveLength(0);
      else if (e.type !== 'roundEnd') expect(cues.length, e.type).toBeGreaterThan(0);
    }
  });

  it('every cue refers to a known, shipped sound id', () => {
    const ids = new Set<string>(SOUND_IDS);
    for (const e of SAMPLE_EVENTS) for (const c of cuesForEvent(e, ctx)) expect(ids.has(c.id), c.id).toBe(true);
    for (const id of SOUND_IDS) expect(SOUND_DURATIONS[id], id).toBeGreaterThan(0);
  });

  it('round banners get the matching announcer line', () => {
    const line = (round: number) => cuesForEvent({ type: 'roundStart', round }, ctx).find((c) => c.channel === 'voice')?.id;
    expect(line(1)).toBe('ann_round_1');
    expect(line(2)).toBe('ann_round_2');
    expect(line(3)).toBe('ann_round_final');
    expect(cuesForEvent({ type: 'fightStart', round: 1 }, ctx)[0]?.id).toBe('ann_fight');
    expect(cuesForEvent({ type: 'timeUp' }, ctx)[0]?.id).toBe('ann_time');
    expect(cuesForEvent({ type: 'ko', player: 1, x: 0, y: 0 }, ctx).map((c) => c.id)).toContain('ann_ko');
  });

  it('announcer lines duck the music, effects and fighter shouts do not', () => {
    expect(cuesForEvent({ type: 'fightStart', round: 1 }, ctx)[0]?.duck).toBe(true);
    for (const c of cuesForEvent(SAMPLE_EVENTS[4] as SimEvent, ctx)) expect(c.duck).toBe(false);
  });

  it('specials use the sound and the shout of the fighter who throws them', () => {
    for (const id of ['tiao', 'dalva', 'saci', 'curupira', 'craque', 'rosa']) {
      const ids = cuesForEvent({ type: 'specialStart', player: 0, characterId: id, x: 0, y: 0 }, ctx).map((c) => c.id);
      expect(ids).toContain(`sp_${id}`);
      expect(ids).toContain(`${id}_attack`);
    }
  });

  it('the hit grunt belongs to the defender, the KO cry too', () => {
    const hit = cuesForEvent({ type: 'hit', attacker: 0, defender: 1, moveId: 'heavyKick', damage: 90, x: 0, y: 0, special: false, knockdown: false, comboCount: 1, projectile: false }, ctx);
    expect(hit.map((c) => c.id)).toContain('dalva_hurt');
    const ko = cuesForEvent({ type: 'ko', player: 0, x: 0, y: 0 }, ctx);
    expect(ko.map((c) => c.id)).toContain('tiao_ko');
  });

  it('the match result line depends on the mode and the winner', () => {
    const end = (winner: 0 | 1, mode: '1p' | '2p') => cuesForEvent({ type: 'matchEnd', winner }, { match, mode })[0]?.id;
    expect(end(0, '1p')).toBe('ann_you_win');
    expect(end(1, '1p')).toBe('ann_you_lose');
    expect(end(0, '2p')).toBe('ann_p1_wins');
    expect(end(1, '2p')).toBe('ann_p2_wins');
    expect(cuesForEvent({ type: 'matchEnd', winner: null }, ctx)).toHaveLength(0);
  });

  it('a flawless round win is announced as perfect, a normal one is not', () => {
    const win = { type: 'roundEnd', round: 1, winner: 0, reason: 'ko' } as const;
    expect(cuesForEvent(win, ctx).map((c) => c.id)).toEqual(['ann_perfect']);
    const hurt: MatchState = { ...match, fighters: [{ ...match.fighters[0], health: 500 }, match.fighters[1]] };
    expect(cuesForEvent(win, { match: hurt, mode: '1p' })).toHaveLength(0);
  });

  it('alternates the two hit and punch variants between frames', () => {
    const a = createMatch({ p1: 'tiao', p2: 'dalva' });
    const hitAt = (frame: number) => cuesForEvent(SAMPLE_EVENTS[4] as SimEvent, { match: { ...a, frame }, mode: '1p' })[0]?.id;
    expect(new Set([hitAt(10), hitAt(11)])).toEqual(new Set(['hit', 'hit_2']));
  });
});

// ---- the director with a fake engine ------------------------------------------------------

function fakeEngine() {
  const played: { channel: string; key: string; loop?: boolean; volume?: number }[] = [];
  const playing = new Set<string>();
  const volumes: Record<string, number> = {};
  const soundVolumes: Record<string, number> = {};
  const engine: AudioEngine = {
    hasBuffer: () => true,
    playOnChannel: (channel, key, o) => { played.push({ channel, key, loop: o?.loop, volume: o?.volume }); playing.add(`${channel}:${key}`); },
    setChannelVolume: (ch, v) => { volumes[ch] = v; },
    setSoundVolume: (key, v) => { soundVolumes[key] = v; },
    channel: (name) => ({ stop: (key) => void playing.delete(`${name}:${key}`), isPlaying: (key) => playing.has(`${name}:${key}`) }),
  };
  return { engine, played, playing, volumes, soundVolumes };
}

const loadedDirector = (store: KeyValueStore | null = memoryStore()) => {
  const f = fakeEngine();
  const d = new AudioDirector(f.engine, store);
  for (const id of SOUND_IDS) d.markLoaded(id);
  return { ...f, d };
};

describe('audio director', () => {
  it('plays nothing before the first user gesture, then starts the requested music', () => {
    const { d, played } = loadedDirector();
    d.music('music_title');
    d.sfx('ui_select');
    d.update(0.1);
    expect(played).toHaveLength(0);
    d.unlock();
    expect(played.map((p) => p.key)).toEqual(['assets/audio/music_title.mp3']);
    expect(played[0]?.loop).toBe(true);
    d.sfx('ui_select');
    expect(played.at(-1)?.channel).toBe('sfx');
  });

  it('crossfades between scenes and stops the old track', () => {
    const { d, playing } = loadedDirector();
    d.unlock();
    d.music('music_title');
    for (let i = 0; i < 100; i++) d.update(1 / 60);
    d.music('music_select');
    d.update(0.1);
    expect(playing.has('music:assets/audio/music_title.mp3')).toBe(true);
    expect(playing.has('music:assets/audio/music_select.mp3')).toBe(true);
    for (let i = 0; i < 100; i++) d.update(1 / 60);
    expect(playing.has('music:assets/audio/music_title.mp3')).toBe(false);
    expect(d.debug.music).toBe('music_select');
  });

  it('victory and defeat jingles play once, not looped', () => {
    const { d, played } = loadedDirector();
    d.unlock();
    d.music('music_victory');
    d.update(0.1);
    expect(played.find((p) => p.key.includes('victory'))?.loop).toBe(false);
  });

  it('ducks the music while an announcer line plays and releases it afterwards', () => {
    const { d, soundVolumes } = loadedDirector();
    d.unlock();
    d.music('music_fight_a');
    for (let i = 0; i < 120; i++) d.update(1 / 60);
    const full = soundVolumes['assets/audio/music_fight_a.mp3'] ?? 0;
    expect(full).toBeCloseTo(1);
    d.play({ id: 'ann_fight', channel: 'voice', volume: 1, delay: 0, duck: true });
    for (let i = 0; i < 20; i++) d.update(1 / 60);
    expect(soundVolumes['assets/audio/music_fight_a.mp3']).toBeLessThan(0.5);
    for (let i = 0; i < 240; i++) d.update(1 / 60);
    expect(soundVolumes['assets/audio/music_fight_a.mp3']).toBeCloseTo(1);
  });

  it('delayed lines wait for their time', () => {
    const { d, played } = loadedDirector();
    d.unlock();
    d.play({ id: 'ann_you_win', channel: 'voice', volume: 1, delay: 1, duck: true });
    d.update(0.5);
    expect(played).toHaveLength(0);
    d.update(0.6);
    expect(played.map((p) => p.key)).toEqual(['assets/audio/ann_you_win.mp3']);
  });

  it('pausing silences the music and resuming brings it back', () => {
    const { d, soundVolumes } = loadedDirector();
    d.unlock();
    d.music('music_fight_b');
    for (let i = 0; i < 120; i++) d.update(1 / 60);
    d.setPaused(true);
    for (let i = 0; i < 60; i++) d.update(1 / 60);
    expect(soundVolumes['assets/audio/music_fight_b.mp3']).toBe(0);
    d.setPaused(false);
    for (let i = 0; i < 120; i++) d.update(1 / 60);
    expect(soundVolumes['assets/audio/music_fight_b.mp3']).toBeCloseTo(1);
  });

  it('a hidden tab is silent: no new sounds, channels at zero, pending lines dropped', () => {
    const { d, played, volumes } = loadedDirector();
    d.unlock();
    d.play({ id: 'ann_time', channel: 'voice', volume: 1, delay: 1, duck: true });
    d.setHidden(true);
    expect(volumes).toMatchObject({ music: 0, sfx: 0, voice: 0 });
    d.sfx('hit');
    d.update(2);
    expect(played).toHaveLength(0);
    d.setHidden(false);
    expect(volumes['sfx']).toBeGreaterThan(0);
  });

  it('volumes and mute reach the channels and are saved', () => {
    const store = memoryStore();
    const { d, volumes } = loadedDirector(store);
    d.adjust('master', -1);
    d.adjust('music', -1);
    expect(volumes['music']).toBeCloseTo(0.7 * 0.6);
    expect(volumes['sfx']).toBeCloseTo(0.7);
    d.toggleMute();
    expect(volumes).toMatchObject({ music: 0, sfx: 0, voice: 0 });
    expect(JSON.parse(store.data.get(STORAGE_KEY) as string)).toMatchObject({ muted: true, master: 0.7, music: 0.6 });
    const again = new AudioDirector(fakeEngine().engine, store);
    expect(again.current.muted).toBe(true);
  });

  it('a sound that failed to load is silent and recorded, and music for it is skipped', () => {
    const f = fakeEngine();
    const d = new AudioDirector(f.engine, null);
    d.markLoaded('hit');
    d.markFailed('block', 'failed to load');
    d.unlock();
    d.sfx('block');
    d.sfx('hit');
    d.music('music_title');
    d.update(0.1);
    expect(f.played.map((p) => p.key)).toEqual(['assets/audio/hit.mp3']);
    expect(d.debug.failed).toEqual(['block: failed to load']);
    expect(d.debug.log.filter((l) => l.kind === 'sfx').map((l) => l.id)).toEqual(['hit']);
  });

  it('logs what it plays for the headless check', () => {
    const { d } = loadedDirector();
    d.unlock();
    d.music('music_title');
    d.sfx('punch');
    d.play({ id: 'ann_fight', channel: 'voice', volume: 1, delay: 0, duck: true });
    expect(d.debug.counts).toEqual({ sfx: 1, voice: 1, music: 1 });
    expect(d.debug.log.map((l) => l.id)).toEqual(['music_title', 'punch', 'ann_fight']);
  });

  it('the select screen reading a name cuts the previous one', () => {
    const { d, playing } = loadedDirector();
    d.unlock();
    d.speakName('tiao');
    d.speakName('saci');
    expect(playing.has('voice:assets/audio/name_tiao.mp3')).toBe(false);
    expect(playing.has('voice:assets/audio/name_saci.mp3')).toBe(true);
    expect(MUSIC_IDS).toHaveLength(6);
  });
});
