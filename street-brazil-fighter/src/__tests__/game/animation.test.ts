import { describe, expect, it } from 'vitest';
import { CHARACTERS, getCharacter, visualScaleOf, type MoveKey } from '../../data/characters';
import {
  ATTACK_CLIP_PREFIX, IDLE_CLIP, WALK_BACK_CLIP, WALK_CLIP, attackClip, clipFrameName, clipIndex,
} from '../../game/animation';
import { spawnFootprints } from '../../game/fx';
import { movePhaseOf, type FighterState } from '../../sim';
import { input, neutralInput, patchFighters, placeFighters, runFrames, startFight } from '../../sim/testing';

const N = neutralInput();

const base = (patch: Partial<FighterState> = {}): FighterState => ({ ...startFight({ p1: 'tiao', p2: 'dalva' }).fighters[0], ...patch });

describe('clipIndex', () => {
  it('loops a looping clip', () => {
    const total = IDLE_CLIP.durations.reduce((a, b) => a + b, 0);
    expect(clipIndex(IDLE_CLIP, 0)).toBe(0);
    expect(clipIndex(IDLE_CLIP, 9)).toBe(0);
    expect(clipIndex(IDLE_CLIP, 10)).toBe(1);
    expect(clipIndex(IDLE_CLIP, total - 1)).toBe(IDLE_CLIP.frames.length - 1);
    expect(clipIndex(IDLE_CLIP, total)).toBe(0);
    expect(clipIndex(IDLE_CLIP, total * 5 + 25)).toBe(2);
  });

  it('holds the last frame of a one-shot clip and never goes below zero', () => {
    const clip = attackClip('punch', getCharacter('tiao').moves.lightPunch);
    expect(clipIndex(clip, 10_000)).toBe(2);
    expect(clipIndex(clip, -5)).toBe(0);
  });

  it('honours per-frame durations', () => {
    const clip = { frames: ['a', 'b', 'c'], durations: [1, 3, 2], loop: true };
    expect([0, 1, 2, 3, 4, 5, 6].map((t) => clipIndex(clip, t))).toEqual([0, 1, 1, 1, 2, 2, 0]);
  });
});

describe('chamber recovery', () => {
  it('the heavy kick pulls the leg back through frame 0 before the stance', () => {
    const kick = getCharacter('tiao').moves.heavyKick;
    const clip = attackClip('kick', kick, true);
    expect(clip.frames).toEqual(['kick_0', 'kick_1', 'kick_0', 'kick_2']);
    expect(clip.durations.reduce((a, b) => a + b, 0)).toBe(kick.startup + kick.active + kick.recovery);
    expect(clip.durations.slice(0, 2)).toEqual([kick.startup, kick.active]);
  });
});

describe('clipFrameName', () => {
  it('breathes while idle and loops', () => {
    const names = [0, 10, 20, 30, 40].map((t) => clipFrameName(base({ state: 'idle', stateFrame: t })));
    expect(names).toEqual(['idle_0', 'idle_1', 'idle_2', 'idle_1', 'idle_0']);
  });

  it('walks forward through the 6 frame cycle and backwards in reverse', () => {
    const per = WALK_CLIP.durations[0] as number;
    const fwd = Array.from({ length: 7 }, (_, i) => clipFrameName(base({ state: 'walkForward', stateFrame: i * per })));
    expect(fwd).toEqual(['walk_0', 'walk_1', 'walk_2', 'walk_3', 'walk_4', 'walk_5', 'walk_0']);
    const back = Array.from({ length: 6 }, (_, i) => clipFrameName(base({ state: 'walkBack', stateFrame: i * per })));
    expect(back).toEqual(['walk_5', 'walk_4', 'walk_3', 'walk_2', 'walk_1', 'walk_0']);
    expect(WALK_BACK_CLIP.frames).toHaveLength(WALK_CLIP.frames.length);
  });

  it('is deterministic: the same state gives the same frame', () => {
    const f = base({ state: 'walkForward', stateFrame: 17 });
    expect(clipFrameName(f)).toBe(clipFrameName({ ...f }));
  });

  it('leaves the other states to the key poses', () => {
    for (const state of ['jump', 'crouch', 'blockStand', 'blockCrouch', 'hitstun', 'blockstun', 'knockdown', 'ko', 'victory'] as const) {
      expect(clipFrameName(base({ state })), state).toBeNull();
    }
    expect(clipFrameName(base({ state: 'attack', moveId: 'crouchKick', moveFrame: 3 }))).toBeNull();
    expect(clipFrameName(base({ state: 'attack', moveId: null, moveFrame: 0 }))).toBeNull();
  });
});

const BUTTON: Partial<Record<MoveKey, 'punch' | 'kick' | 'special'>> = { lightPunch: 'punch', heavyKick: 'kick', special: 'special' };

describe('attack clips are locked to the move frame data of every fighter', () => {
  for (const c of CHARACTERS) {
    for (const key of Object.keys(ATTACK_CLIP_PREFIX) as MoveKey[]) {
      it(`${c.id} ${key}: extended frame shows exactly during the active frames`, () => {
        const move = c.moves[key];
        const prefix = ATTACK_CLIP_PREFIX[key] as string;
        const button = BUTTON[key] as 'punch' | 'kick' | 'special';
        let s = placeFighters(startFight({ p1: c.id, p2: 'tiao', hitStopFrames: 0 }), 300, 1200);
        s = patchFighters(s, { meter: 100 });
        const names: string[] = [];
        const phases: string[] = [];
        let pressed = false;
        const run = runFrames(s, move.startup + move.active + move.recovery + 4, () => {
          const first = !pressed;
          pressed = true;
          return [first ? input({ [button]: true }) : N, N];
        });
        for (const st of run.states) {
          const f = st.fighters[0];
          if (f.state !== 'attack' || f.moveId !== key) continue;
          names.push(clipFrameName(f) as string);
          phases.push(f.movePhase as string);
        }
        expect(names).toHaveLength(move.startup + move.active + move.recovery);
        names.forEach((n, i) => {
          const expected = { startup: [`${prefix}_0`], active: [`${prefix}_1`], recovery: [`${prefix}_2`, `${prefix}_0`] }[phases[i] as 'startup'];
          expect(expected, `frame ${i + 1}`).toContain(n);
          expect(phases[i]).toBe(movePhaseOf(move, i + 1));
        });
        expect(names.filter((n) => n === `${prefix}_1`)).toHaveLength(move.active);
        expect(names[move.startup]).toBe(`${prefix}_1`);
        expect(names[move.startup - 1]).toBe(`${prefix}_0`);
        // the recovery ends on the stance frame and never goes back to the extended one
        expect(names[names.length - 1]).toBe(`${prefix}_2`);
      });
    }
  }
});

describe('Curupira footprints', () => {
  const walker = (state: 'walkForward' | 'walkBack', facing: 1 | -1, id = 'curupira'): FighterState =>
    base({ characterId: id, state, facing, stateFrame: 4, y: 0 });

  it('appear on the step beat and point against the walking direction', () => {
    const fwd = spawnFootprints([walker('walkForward', 1)]);
    expect(fwd).toHaveLength(1);
    expect(fwd[0]).toMatchObject({ kind: 'footprint', dir: -1 });
    expect(spawnFootprints([walker('walkForward', -1)])[0]?.dir).toBe(1);
    expect(spawnFootprints([walker('walkBack', 1)])[0]?.dir).toBe(1);
  });

  it('are not left by other fighters, off the beat, or in the air', () => {
    expect(spawnFootprints([walker('walkForward', 1, 'tiao')])).toHaveLength(0);
    expect(spawnFootprints([{ ...walker('walkForward', 1), stateFrame: 5 }])).toHaveLength(0);
    expect(spawnFootprints([{ ...walker('walkForward', 1), y: 40 }])).toHaveLength(0);
    expect(spawnFootprints([{ ...walker('walkForward', 1), state: 'idle' }])).toHaveLength(0);
  });
});

describe('visual scale', () => {
  it('every fighter stays within 8 percent of the common base height', () => {
    for (const c of CHARACTERS) {
      expect(visualScaleOf(c), c.id).toBeGreaterThanOrEqual(0.92);
      expect(visualScaleOf(c), c.id).toBeLessThanOrEqual(1.08);
    }
  });
});
