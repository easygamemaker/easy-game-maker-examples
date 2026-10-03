import type { FighterState, Side, SimEvent } from '../sim';

/** Small tween layer on top of the sim: squash and stretch, hit flash and bob. Pure and immutable. */
export interface FighterVisual {
  readonly squashX: number;
  readonly squashY: number;
  readonly flash: number;
}

export const INITIAL_VISUAL: FighterVisual = { squashX: 1, squashY: 1, flash: 0 };

export const FLASH_FRAMES = 8;
const RELAX = 0.8;

const relax = (v: number): number => 1 + (v - 1) * RELAX;

export function stepVisual(prev: FighterVisual, side: Side, events: readonly SimEvent[]): FighterVisual {
  let v: FighterVisual = { squashX: relax(prev.squashX), squashY: relax(prev.squashY), flash: Math.max(0, prev.flash - 1) };
  for (const e of events) {
    if (e.type === 'jump' && e.player === side) v = { ...v, squashX: 0.86, squashY: 1.16 };
    else if (e.type === 'land' && e.player === side) v = { ...v, squashX: 1.2, squashY: 0.8 };
    else if (e.type === 'hit' && e.defender === side) v = { squashX: 0.88, squashY: 1.1, flash: FLASH_FRAMES };
    else if (e.type === 'attackStart' && e.player === side) v = { ...v, squashX: 1.08, squashY: 0.94 };
  }
  return v;
}

export interface DrawParams {
  readonly scaleX: number;
  readonly scaleY: number;
  readonly offsetY: number;
  readonly tint: readonly [number, number, number, number];
}

/** Bob while idle or walking, squash and stretch, and a red-white flash right after being hit. */
export function drawParams(v: FighterVisual, f: FighterState, frame: number, animated = false): DrawParams {
  let offsetY = 0;
  // drawn clips carry their own bob, so the programmatic one only stays for key-pose fallbacks
  if (animated) offsetY = 0;
  else if (f.state === 'idle' || f.state === 'crouch') offsetY = -Math.sin(frame * 0.11) * 2.5;
  else if (f.state === 'walkForward' || f.state === 'walkBack') offsetY = -Math.abs(Math.sin(frame * 0.28)) * 6;
  const k = v.flash / FLASH_FRAMES;
  const tint: [number, number, number, number] = k > 0 ? [1, 1 - 0.55 * k, 1 - 0.55 * k, 1] : [1, 1, 1, 1];
  return { scaleX: v.squashX, scaleY: v.squashY, offsetY, tint };
}

export type EffectKind = 'hit' | 'bigHit' | 'block' | 'dust' | 'clash' | 'ko' | 'footprint';

export interface Effect {
  readonly kind: EffectKind;
  readonly x: number;
  /** Height above the ground. */
  readonly y: number;
  readonly age: number;
  readonly life: number;
  /** Footprints only: 1 points right, -1 points left. */
  readonly dir?: 1 | -1;
}

const LIFE: Record<EffectKind, number> = { hit: 12, bigHit: 18, block: 10, dust: 16, clash: 14, ko: 30, footprint: 54 };

export function spawnEffects(events: readonly SimEvent[]): readonly Effect[] {
  const out: Effect[] = [];
  const add = (kind: EffectKind, x: number, y: number): void => {
    out.push({ kind, x, y, age: 0, life: LIFE[kind] });
  };
  for (const e of events) {
    switch (e.type) {
      case 'hit': add(e.special || e.knockdown ? 'bigHit' : 'hit', e.x, e.y); break;
      case 'block': add('block', e.x, e.y); break;
      case 'land': add('dust', e.x, 0); break;
      case 'knockdown': add('dust', e.x, 0); break;
      case 'projectileClash': add('clash', e.x, e.y); break;
      case 'ko': add('ko', e.x, e.y); break;
      default: break;
    }
  }
  return out;
}

/** Characters whose feet are turned backwards: they leave glowing footprints that point against the walk. */
const BACKWARDS_FEET = new Set(['curupira']);
const FOOTPRINT_EVERY = 9;

/** Folklore cue for the backwards feet: one footprint per step, pointing the way the Curupira came from. */
export function spawnFootprints(fighters: readonly FighterState[]): readonly Effect[] {
  const out: Effect[] = [];
  for (const f of fighters) {
    const walking = f.state === 'walkForward' || f.state === 'walkBack';
    if (!BACKWARDS_FEET.has(f.characterId) || !walking || f.y > 0 || f.stateFrame % FOOTPRINT_EVERY !== 4) continue;
    const moveDir = f.state === 'walkForward' ? f.facing : (-f.facing as 1 | -1);
    const step = Math.floor(f.stateFrame / FOOTPRINT_EVERY) % 2;
    out.push({ kind: 'footprint', x: f.x - moveDir * 6, y: -(step === 0 ? 4 : 14), age: 0, life: LIFE.footprint, dir: (-moveDir) as 1 | -1 });
  }
  return out;
}

export function stepEffects(effects: readonly Effect[]): readonly Effect[] {
  return effects.map((e) => ({ ...e, age: e.age + 1 })).filter((e) => e.age < e.life);
}

/** Screen shake offset for a frame: strong on KO and special hits, light on heavy hits. */
export function shakeAmount(events: readonly SimEvent[]): number {
  let s = 0;
  for (const e of events) {
    if (e.type === 'ko') s = Math.max(s, 14);
    else if (e.type === 'hit') s = Math.max(s, e.special ? 9 : e.knockdown ? 6 : 0);
  }
  return s;
}

export const decayShake = (shake: number): number => (shake < 0.5 ? 0 : shake * 0.85);
