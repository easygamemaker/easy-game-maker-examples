import type { MatchState, SimEvent } from '../sim';
import { isFighterSound, type SfxId, type SoundId, type VoiceId } from './catalog';

/** One sound the game layer should start for a sim event. The simulation itself never imports this. */
export interface Cue {
  readonly id: SoundId;
  readonly channel: 'sfx' | 'voice';
  readonly volume: number;
  /** Seconds to wait before starting it (a line that should follow a banner or an impact). */
  readonly delay: number;
  /** The announcer lowers the music while it speaks. */
  readonly duck: boolean;
}

/** Every sim event type either makes a sound or is explicitly silent. A new event type breaks the build until it is listed. */
export const EVENT_POLICY: Readonly<Record<SimEvent['type'], 'sound' | 'silent'>> = {
  roundStart: 'sound',
  fightStart: 'sound',
  attackStart: 'sound',
  specialStart: 'sound',
  hit: 'sound',
  block: 'sound',
  projectileSpawn: 'silent', // the special's own sound already played on specialStart
  projectileHit: 'silent', // the hit or block event of the same step carries the sound
  projectileClash: 'sound',
  projectileExpire: 'silent',
  knockdown: 'sound',
  wakeUp: 'silent',
  ko: 'sound',
  jump: 'sound',
  land: 'sound',
  timeUp: 'sound',
  roundEnd: 'sound',
  matchEnd: 'sound',
};

export interface CueContext {
  readonly match: MatchState;
  readonly mode: '1p' | '2p';
}

const sfx = (id: SfxId, volume = 1, delay = 0): Cue => ({ id, channel: 'sfx', volume, delay, duck: false });
const voice = (id: VoiceId, volume = 1, delay = 0, duck = true): Cue => ({ id, channel: 'voice', volume, delay, duck });
const fighterVoice = (character: string, kind: 'attack' | 'hurt' | 'ko', delay = 0): Cue[] =>
  isFighterSound(character) ? [voice(`${character}_${kind}`, 0.9, delay, false)] : [];

const PUNCHES: ReadonlySet<string> = new Set(['lightPunch', 'crouchPunch']);

/** The sounds for one sim event. `frame` picks between the two variants of a sound, deterministically. */
export function cuesForEvent(e: SimEvent, ctx: CueContext): readonly Cue[] {
  const { match, mode } = ctx;
  const alt = match.frame % 2 === 1;
  const charOf = (side: 0 | 1): string => match.fighters[side].characterId;
  switch (e.type) {
    case 'roundStart':
      return [sfx('round_start', 0.8), voice(e.round >= 3 ? 'ann_round_final' : e.round === 2 ? 'ann_round_2' : 'ann_round_1', 1, 0.35)];
    case 'fightStart':
      return [voice('ann_fight')];
    case 'attackStart':
      if (e.moveId === 'special') return [];
      return [
        PUNCHES.has(e.moveId) ? sfx(alt ? 'punch_2' : 'punch', 0.8) : sfx(alt ? 'kick_2' : 'kick', 0.9),
        ...(e.moveId === 'heavyKick' ? fighterVoice(charOf(e.player), 'attack') : []),
      ];
    case 'specialStart': {
      const id = `sp_${e.characterId}`;
      return [...(isFighterSound(e.characterId) ? [sfx(id as SfxId)] : []), ...fighterVoice(e.characterId, 'attack')];
    }
    case 'hit':
      return [sfx(alt ? 'hit_2' : 'hit', e.special || e.knockdown ? 1 : 0.85), ...fighterVoice(charOf(e.defender), 'hurt', 0.04)];
    case 'block':
      return [sfx('block')];
    case 'projectileClash':
      return [sfx('block', 0.8)];
    case 'knockdown':
      return [sfx('knockdown')];
    case 'ko':
      return [sfx('ko'), voice('ann_ko', 1, 0.15), ...fighterVoice(charOf(e.player), 'ko', 0.5)];
    case 'jump':
      return [sfx('jump', 0.5)];
    case 'land':
      return [sfx('land', 0.6)];
    case 'timeUp':
      return [voice('ann_time')];
    case 'roundEnd': {
      const w = e.winner;
      if (w === null || e.reason !== 'ko') return [];
      const f = match.fighters[w];
      return f.health >= f.maxHealth ? [voice('ann_perfect', 1, 1.1)] : [];
    }
    case 'matchEnd': {
      if (e.winner === null) return [];
      const id: VoiceId = mode === '2p' ? (e.winner === 0 ? 'ann_p1_wins' : 'ann_p2_wins') : e.winner === 0 ? 'ann_you_win' : 'ann_you_lose';
      return [voice(id, 1, 2.3)];
    }
    default:
      return [];
  }
}

export const cuesForEvents = (events: readonly SimEvent[], ctx: CueContext): readonly Cue[] => events.flatMap((e) => cuesForEvent(e, ctx));
