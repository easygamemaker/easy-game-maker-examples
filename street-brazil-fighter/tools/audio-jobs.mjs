// Every ElevenLabs job of the game: sound effects, announcer lines, fighter voices and music.
// Edit a prompt here, run `node tools/generate-audio.mjs --only <id>` and the cache makes sure
// unchanged jobs are never paid twice. No prompt names an artist, a song or a lyric.
export const SFX_MODEL = 'eleven_text_to_sound_v2';
export const TTS_MODEL = 'eleven_multilingual_v2';
export const MUSIC_MODEL = 'music_v2_5';
/** Premade "Arnold" voice: crisp, strong, fast. The API key has no voices_read permission, so the list
 *  could not be fetched; the voice was picked among premade ids by pace and loudness (see README). */
export const ANNOUNCER_VOICE = 'VR6AewLTigWG4xSOukaG';
export const VOICE_SETTINGS = { stability: 0.3, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true };
export const FORMAT = 'mp3_44100_128';

/** Observed on this account: about 10 credits per second of sound effect, 12.5 per second of music,
 *  1 credit per character of speech. Used by the budget guard before each call. */
export const CREDITS = { sfxPerSec: 10, musicPerSec: 12.5, ttsPerChar: 1 };

const sfx = (id, text, duration, influence = 0.5, out = id) => ({ id, kind: 'sfx', text, duration, influence, out });

export const SFX = [
  sfx('punch', 'Quick martial arts punch whoosh followed by a light snappy impact, arcade fighting game', 0.6, 0.6),
  sfx('punch_2', 'Fast jab whoosh and a crisp light punch impact on a body, fighting game', 0.6, 0.6),
  sfx('kick', 'Heavy kick whoosh and a thick thudding impact, arcade fighting game', 0.8, 0.6),
  sfx('kick_2', 'Strong roundhouse kick swoosh then a deep meaty impact, fighting game', 0.8, 0.6),
  sfx('hit', 'Fleshy body hit impact, a punch landing on a body, punchy, arcade fighting game', 0.5, 0.6),
  sfx('hit_2', 'Solid blow landing on a torso, dull slap and thump, arcade fighting game', 0.5, 0.6),
  sfx('block', 'Metallic clang with a dull thud of a blocked strike, fighting game', 0.5, 0.6),
  sfx('sp_tiao', 'Fast spinning whoosh, a capoeira dash with wind rushing past and a swirling spin', 1.2, 0.5),
  sfx('sp_dalva', 'Blade slash with a rushing energy wave, a machete cut releasing a sharp whooshing arc', 1.0, 0.5),
  sfx('sp_saci', 'Small mystical whirlwind, wind gust swirling and spinning with a playful whistling tone', 1.2, 0.5),
  sfx('sp_curupira', 'Massive ground stomp with an earth shockwave, deep rumble and cracking stone', 1.2, 0.6),
  sfx('sp_craque', 'Fireball launched by a kick, a flaming whoosh with a soccer ball thump', 1.0, 0.5),
  sfx('sp_rosa', 'Burst of feathers, a bright fluttering rustle with a sparkling magical swirl', 1.2, 0.5),
  sfx('jump', 'Short light jump whoosh, quick and airy, arcade game', 0.5, 0.5),
  sfx('land', 'Soft landing thud of feet hitting the ground, short', 0.5, 0.5),
  sfx('knockdown', 'A body falling hard on the ground with a heavy thump and a short slide, fighting game', 0.9, 0.6),
  sfx('ko', 'Huge dramatic knockout impact boom, a cinematic hit with a long reverb tail', 1.5, 0.6),
  sfx('round_start', 'Large gong strike with a long ringing metallic tail, fighting game round start', 1.5, 0.6),
  sfx('ui_move', 'Soft short menu cursor blip, a tiny clean tick, video game user interface', 0.5, 0.7),
  sfx('ui_select', 'Bright confirm chime for a menu selection, short and happy, video game user interface', 0.5, 0.7),
  sfx('pause', 'Short pause menu blip, a quick descending two note tone, video game user interface', 0.5, 0.7),
];

const FIGHTERS = {
  tiao: ['male capoeira master', 'a short sharp martial arts attack shout', 'a short male pained grunt', 'a dramatic male cry of defeat'],
  dalva: ['fierce female warrior', 'a short fierce female attack shout', 'a short female pained grunt', 'a dramatic female cry of defeat'],
  saci: ['mischievous trickster boy', 'a short high pitched mischievous cackle shout', 'a short high pitched pained yelp', 'a comic high pitched cry of defeat'],
  curupira: ['gruff forest guardian', 'a short deep gruff roar attack shout', 'a short deep pained grunt', 'a deep dramatic roar of defeat'],
  craque: ['young athletic man', 'a short athletic effort shout', 'a short young male pained grunt', 'a young male cry of defeat'],
  rosa: ['energetic female dancer', 'a short energetic female exclamation attack shout', 'a short female pained gasp', 'a female cry of defeat'],
};
export const VOICES = Object.entries(FIGHTERS).flatMap(([f, [who, atk, hurt, ko]]) => [
  sfx(`${f}_attack`, `${atk}, ${who}, no words, dry, fighting game voice`, 0.6, 0.6),
  sfx(`${f}_hurt`, `${hurt}, ${who}, no words, dry, fighting game voice`, 0.5, 0.6),
  sfx(`${f}_ko`, `${ko}, ${who}, no words, dry, fighting game voice`, 1.2, 0.6),
]);

const line = (id, text) => ({ id, kind: 'tts', text, out: id });
export const ANNOUNCER = [
  line('ann_round_1', 'Round one!'),
  line('ann_round_2', 'Round two!'),
  line('ann_round_final', 'Final round!'),
  line('ann_fight', 'Fight!'),
  line('ann_ko', 'K. O.!'),
  line('ann_time', 'Time!'),
  line('ann_perfect', 'Perfect!'),
  line('ann_p1_wins', 'Player one wins!'),
  line('ann_p2_wins', 'Player two wins!'),
  line('ann_you_win', 'You win!'),
  line('ann_you_lose', 'You lose!'),
  line('name_tiao', 'Mestre Tião!'),
  line('name_dalva', 'Cangaceira Dalva!'),
  line('name_saci', 'Saci!'),
  line('name_curupira', 'Curupira!'),
  line('name_craque', 'Craque da Várzea!'),
  line('name_rosa', 'Passista Rosa!'),
];

/** Music: lengths are whole bars at the BPM written in the prompt, so a loop point falls on a downbeat. */
const barsMs = (bpm, bars) => Math.round((bars * 4 * 60000) / bpm);
const NO = 'Instrumental only, no vocals, no singing, no lyrics.';
const music = (id, prompt, lengthMs, loop = true) => ({ id, kind: 'music', text: `${prompt} ${NO}`, lengthMs, loop, out: id });
export const MUSIC = [
  music('music_title', 'Heroic Brazilian fighting game title theme at 100 BPM in 4/4. Berimbau, atabaque and pandeiro percussion, bright cavaquinho strumming, warm acoustic bass and a proud brass and guitar melody that rises and resolves. Confident, epic and joyful. Loopable, starts and ends on the same groove.', barsMs(100, 30)),
  music('music_select', 'Relaxed Brazilian groove for a character select screen at 90 BPM in 4/4. Soft samba rhythm with brushed pandeiro, nylon guitar, light cavaquinho, mellow bass and a playful flute melody. Warm and laid back with a little anticipation. Loopable, starts and ends on the same groove.', barsMs(90, 22)),
  music('music_fight_a', 'Energetic samba rock fighting game battle track at 120 BPM in 4/4. Driving drums, capoeira berimbau and atabaque percussion, funky electric bass, distorted rhythm guitar, cavaquinho and punchy brass stabs. Tension builds section by section with a strong hook. Loopable, starts and ends on the same groove.', barsMs(120, 40)),
  music('music_fight_b', 'Funk carioca inspired fighting game battle track at 130 BPM in 4/4. Heavy tamborzao beat, agogo bells, cuica, capoeira atabaque percussion, deep sub bass and a gritty synth and guitar riff. Aggressive and driving, tension builds. Loopable, starts and ends on the same groove.', barsMs(130, 42)),
  music('music_victory', 'Short triumphant victory jingle with bright brass fanfare, cavaquinho and joyful samba percussion, ending on a strong final chord.', 12000, false),
  music('music_ko', 'Short dramatic defeat sting, a low brass and berimbau phrase with a slow falling melody and a final heavy drum hit.', 7000, false),
];

export const ALL_JOBS = [...SFX, ...VOICES, ...ANNOUNCER, ...MUSIC];

export function jobRequest(job) {
  if (job.kind === 'sfx') {
    return {
      endpoint: '/v1/sound-generation',
      body: { text: job.text, duration_seconds: job.duration, prompt_influence: job.influence, model_id: SFX_MODEL },
      estimate: Math.ceil(job.duration * CREDITS.sfxPerSec),
      voiceId: null, model: SFX_MODEL,
    };
  }
  if (job.kind === 'tts') {
    return {
      endpoint: `/v1/text-to-speech/${ANNOUNCER_VOICE}`,
      body: { text: job.text, model_id: TTS_MODEL, voice_settings: VOICE_SETTINGS },
      estimate: Math.ceil(job.text.length * CREDITS.ttsPerChar) + 4,
      voiceId: ANNOUNCER_VOICE, model: TTS_MODEL,
    };
  }
  return {
    endpoint: '/v1/music',
    body: { prompt: job.text, music_length_ms: job.lengthMs, force_instrumental: true, model_id: MUSIC_MODEL },
    estimate: Math.ceil((job.lengthMs / 1000) * CREDITS.musicPerSec),
    voiceId: null, model: MUSIC_MODEL,
  };
}
