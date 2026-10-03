import { describe, expect, it } from 'vitest';
import { CHARACTERS, CHARACTER_IDS, MOVE_KEYS, POSE_IDS, getCharacter, hurtboxesOf } from '../../data/characters';
import type { MoveData } from '../../data/characters';

const allMoves = (): { char: string; move: MoveData }[] =>
  CHARACTERS.flatMap((c) => MOVE_KEYS.map((k) => ({ char: c.id, move: c.moves[k] })));

describe('character data', () => {
  it('has six unique fighters with the expected ids', () => {
    expect(CHARACTERS).toHaveLength(6);
    expect(new Set(CHARACTER_IDS).size).toBe(6);
    expect([...CHARACTER_IDS].sort()).toEqual(['craque', 'curupira', 'dalva', 'rosa', 'saci', 'tiao']);
    expect(new Set(CHARACTERS.map((c) => c.displayName)).size).toBe(6);
  });

  it('getCharacter finds every fighter and rejects unknown ids', () => {
    for (const id of CHARACTER_IDS) expect(getCharacter(id).id).toBe(id);
    expect(() => getCharacter('nobody')).toThrow();
  });

  it('every character has sane stats', () => {
    for (const c of CHARACTERS) {
      expect(c.maxHealth).toBe(1000);
      expect(c.walkForward).toBeGreaterThan(0);
      expect(c.walkBack).toBeGreaterThan(0);
      expect(c.walkBack).toBeLessThanOrEqual(c.walkForward);
      expect(c.gravity).toBeGreaterThan(0);
      expect(c.jumpVelocity).toBeGreaterThan(10);
      expect(c.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(c.tagline.length).toBeGreaterThan(10);
      expect(c.specialName).toBe(c.moves.special.name);
      const hb = hurtboxesOf(c);
      expect(hb.crouch.h).toBeLessThan(hb.stand.h);
    }
  });

  it('walk speeds are distinctly tuned', () => {
    expect(new Set(CHARACTERS.map((c) => c.walkForward)).size).toBe(6);
    const rosa = getCharacter('rosa');
    const curupira = getCharacter('curupira');
    expect(rosa.walkForward).toBe(Math.max(...CHARACTERS.map((c) => c.walkForward)));
    expect(curupira.walkForward).toBe(Math.min(...CHARACTERS.map((c) => c.walkForward)));
    expect(getCharacter('saci').jumpVelocity).toBe(Math.max(...CHARACTERS.map((c) => c.jumpVelocity)));
  });

  it('every move has plausible frame data and hitbox', () => {
    for (const { char, move } of allMoves()) {
      const label = `${char}.${move.id}`;
      expect(move.startup, label).toBeGreaterThanOrEqual(1);
      expect(move.active, label).toBeGreaterThanOrEqual(1);
      expect(move.recovery, label).toBeGreaterThanOrEqual(1);
      expect(move.damage, label).toBeGreaterThan(0);
      expect(move.hitstun, label).toBeGreaterThanOrEqual(1);
      expect(move.blockstun, label).toBeGreaterThanOrEqual(1);
      expect(move.blockstun, label).toBeLessThanOrEqual(move.hitstun);
      expect(move.knockback, label).toBeGreaterThan(0);
      expect(Math.abs(move.hitbox.x), label).toBeLessThanOrEqual(250);
      expect(move.hitbox.y, label).toBeGreaterThanOrEqual(-60);
      expect(move.hitbox.y, label).toBeLessThanOrEqual(260);
      expect(move.hitbox.w, label).toBeGreaterThan(0);
      expect(move.hitbox.w, label).toBeLessThanOrEqual(300);
      expect(move.hitbox.h, label).toBeGreaterThan(0);
      expect(move.hitbox.h, label).toBeLessThanOrEqual(300);
      expect(move.meterGain, label).toBeGreaterThanOrEqual(0);
      expect(move.meterGainDefender, label).toBeGreaterThan(0);
    }
  });

  it('normals respect the archetype ranges', () => {
    for (const c of CHARACTERS) {
      const { lightPunch: lp, heavyKick: hk, crouchPunch: cp, crouchKick: ck, jumpKick: jk } = c.moves;
      expect(lp.startup).toBeGreaterThanOrEqual(4);
      expect(lp.startup).toBeLessThanOrEqual(5);
      expect(lp.active).toBe(3);
      expect(lp.recovery).toBeGreaterThanOrEqual(8);
      expect(lp.recovery).toBeLessThanOrEqual(10);
      expect(lp.damage).toBeGreaterThanOrEqual(40);
      expect(lp.damage).toBeLessThanOrEqual(60);
      expect(hk.startup).toBeGreaterThanOrEqual(9);
      expect(hk.startup).toBeLessThanOrEqual(12);
      expect(hk.active).toBe(4);
      expect(hk.recovery).toBeGreaterThanOrEqual(16);
      expect(hk.recovery).toBeLessThanOrEqual(20);
      expect(hk.damage).toBeGreaterThanOrEqual(90);
      expect(hk.damage).toBeLessThanOrEqual(130);
      expect(hk.knockback).toBeGreaterThan(lp.knockback);
      expect(cp.damage).toBeLessThan(lp.damage);
      expect(cp.startup).toBeLessThanOrEqual(lp.startup);
      expect(ck.level).toBe('low');
      expect(ck.knockdown).toBe(true);
      expect(ck.poses.active).toBe('crouch_punch');
      expect(jk.level).toBe('high');
      expect(jk.damage).toBeGreaterThanOrEqual(70);
      expect(jk.damage).toBeLessThanOrEqual(90);
      expect(jk.hitbox.y).toBeLessThan(0);
    }
  });

  it('only uses pose ids that exist in POSE_IDS', () => {
    const known = new Set(POSE_IDS);
    expect(known.size).toBe(POSE_IDS.length);
    for (const { move } of allMoves()) {
      expect(known.has(move.poses.startup)).toBe(true);
      expect(known.has(move.poses.active)).toBe(true);
      expect(known.has(move.poses.recovery)).toBe(true);
    }
  });

  it('all six specials differ in kind or parameters', () => {
    const specials = CHARACTERS.map((c) => c.moves.special);
    for (const s of specials) expect(s.special).toBeDefined();
    const signatures = specials.map((s) => JSON.stringify({ special: s.special, hitbox: s.hitbox, damage: s.damage }));
    expect(new Set(signatures).size).toBe(6);
    expect(getCharacter('tiao').moves.special.special?.kind).toBe('dash');
    expect(getCharacter('tiao').moves.special.knockdown).toBe(true);
    expect(getCharacter('curupira').moves.special.special?.kind).toBe('ground-wave');
    expect(getCharacter('curupira').moves.special.level).toBe('low');
    const kinds = new Set(specials.map((s) => s.special?.kind));
    expect(kinds).toEqual(new Set(['dash', 'projectile', 'ground-wave']));
  });

  it('projectile specials have distinct personalities', () => {
    const spec = (id: string) => {
      const s = getCharacter(id).moves.special.special;
      if (s === undefined || s.kind === 'dash') throw new Error('not a projectile');
      return s;
    };
    expect(spec('craque').speed).toBeGreaterThan(spec('dalva').speed);
    expect(spec('saci').speed).toBeLessThan(spec('dalva').speed);
    expect(spec('saci').lifetime).toBeGreaterThan(spec('craque').lifetime);
    expect(spec('saci').spawnOffsetY).toBeGreaterThan(155);
    expect(spec('curupira').speed * spec('curupira').lifetime).toBeLessThanOrEqual(520);
    const rosa = getCharacter('rosa').moves.special;
    const craque = getCharacter('craque').moves.special;
    expect(rosa.hitbox.w).toBe(craque.hitbox.w * 3);
    expect(rosa.damage).toBeLessThan(craque.damage);
    expect(rosa.meterGain).toBeGreaterThan(craque.meterGain);
  });
});
