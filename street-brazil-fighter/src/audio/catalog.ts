/** Every sound of the game. The files are mp3 in public/assets/audio, produced by tools/process-audio.mjs. */

const FIGHTER_IDS = ['tiao', 'dalva', 'saci', 'curupira', 'craque', 'rosa'] as const;
export type FighterSoundId = (typeof FIGHTER_IDS)[number];

export const SFX_IDS = [
  'punch', 'punch_2', 'kick', 'kick_2', 'hit', 'hit_2', 'block', 'jump', 'land', 'knockdown', 'ko',
  'round_start', 'ui_move', 'ui_select', 'pause',
  ...FIGHTER_IDS.map((f) => `sp_${f}` as const),
] as const;

export const VOICE_IDS = [
  'ann_round_1', 'ann_round_2', 'ann_round_final', 'ann_fight', 'ann_ko', 'ann_time', 'ann_perfect',
  'ann_p1_wins', 'ann_p2_wins', 'ann_you_win', 'ann_you_lose',
  ...FIGHTER_IDS.flatMap((f) => [`${f}_attack`, `${f}_hurt`, `${f}_ko`, `name_${f}`] as const),
] as const;

export const MUSIC_IDS = ['music_title', 'music_select', 'music_fight_a', 'music_fight_b', 'music_victory', 'music_ko'] as const;

export type SfxId = (typeof SFX_IDS)[number];
export type VoiceId = (typeof VOICE_IDS)[number];
export type MusicId = (typeof MUSIC_IDS)[number];
export type SoundId = SfxId | VoiceId | MusicId;

export const SOUND_IDS: readonly SoundId[] = [...SFX_IDS, ...VOICE_IDS, ...MUSIC_IDS];
export const soundUrl = (id: SoundId): string => `assets/audio/${id}.mp3`;

/** Music that plays once instead of looping. */
export const ONE_SHOT_MUSIC: ReadonlySet<MusicId> = new Set<MusicId>(['music_victory', 'music_ko']);

/** The two fight tracks, shared out between the nine stages (bright daytime places get the samba rock, the rest the funk). */
export const STAGE_MUSIC: Readonly<Record<string, 'music_fight_a' | 'music_fight_b'>> = {
  pelourinho: 'music_fight_a',
  copacabana: 'music_fight_b',
  amazonia: 'music_fight_a',
  paulista: 'music_fight_b',
  sambodromo: 'music_fight_b',
  pantanal: 'music_fight_a',
  lencois: 'music_fight_a',
  corcovado: 'music_fight_b',
  ouropreto: 'music_fight_a',
};

export const fightMusicFor = (stageId: string): MusicId => STAGE_MUSIC[stageId] ?? 'music_fight_a';

export const isFighterSound = (id: string): id is FighterSoundId => (FIGHTER_IDS as readonly string[]).includes(id);
