/**
 * Boxes: conversion of facing-relative rects to world boxes, overlap tests and
 * the hurtbox / hitbox of a fighter for its current state.
 */

import { getCharacter, hurtboxesOf } from '../data/characters';
import type { MoveData, Rect } from '../data/characters';
import { DOWN_HURTBOX, JUMP_HURTBOX_LIFT } from './constants';
import type { Facing, FighterState, Projectile, WorldBox } from './types';

/** Converts a facing-relative rect anchored at (x, y) into a world box. */
export function toWorldBox(x: number, y: number, facing: Facing, rect: Rect): WorldBox {
  const centerX = x + facing * rect.x;
  return { left: centerX - rect.w / 2, bottom: y + rect.y, w: rect.w, h: rect.h };
}

export function boxesOverlap(a: WorldBox, b: WorldBox): boolean {
  return a.left < b.left + b.w && b.left < a.left + a.w && a.bottom < b.bottom + b.h && b.bottom < a.bottom + a.h;
}

/** Center of the intersection of two overlapping boxes (used for hit sparks). */
export function overlapCenter(a: WorldBox, b: WorldBox): { x: number; y: number } {
  const left = Math.max(a.left, b.left);
  const right = Math.min(a.left + a.w, b.left + b.w);
  const bottom = Math.max(a.bottom, b.bottom);
  const top = Math.min(a.bottom + a.h, b.bottom + b.h);
  return { x: (left + right) / 2, y: (bottom + top) / 2 };
}

export function isAirborne(f: FighterState): boolean {
  return f.y > 0 || f.vy > 0;
}

export function getMoveData(f: FighterState): MoveData | null {
  if (f.moveId === null) return null;
  return getCharacter(f.characterId).moves[f.moveId];
}

/** True when the fighter is crouch-shaped (crouch, crouch block, crouch moves). */
export function isCrouchShaped(f: FighterState): boolean {
  if (f.state === 'crouch' || f.state === 'blockCrouch') return true;
  if (f.state === 'blockstun' || f.state === 'hitstun') return f.crouching;
  if (f.state === 'attack') return f.moveId === 'crouchPunch' || f.moveId === 'crouchKick';
  return false;
}

/** Can the fighter be hit at all (lying down, ko and victory are invulnerable). */
export function isHittable(f: FighterState): boolean {
  return f.state !== 'knockdown' && f.state !== 'ko' && f.state !== 'victory';
}

/** Main body hurtbox for the current state. */
export function bodyHurtbox(f: FighterState): WorldBox {
  const dims = hurtboxesOf(getCharacter(f.characterId));
  if (f.state === 'knockdown' || f.state === 'ko') {
    return { left: f.x - DOWN_HURTBOX.w / 2, bottom: f.y, w: DOWN_HURTBOX.w, h: DOWN_HURTBOX.h };
  }
  if (isAirborne(f)) {
    return { left: f.x - dims.jump.w / 2, bottom: f.y + JUMP_HURTBOX_LIFT, w: dims.jump.w, h: dims.jump.h };
  }
  const shape = isCrouchShaped(f) ? dims.crouch : dims.stand;
  return { left: f.x - shape.w / 2, bottom: f.y, w: shape.w, h: shape.h };
}

/**
 * All hurtboxes. During the active and recovery frames of a melee move the
 * extended limb (the move hitbox) is vulnerable too, so whiffs can be punished.
 */
export function hurtboxes(f: FighterState): readonly WorldBox[] {
  const body = bodyHurtbox(f);
  const move = getMoveData(f);
  if (f.state !== 'attack' || move === null || f.movePhase === 'startup' || isProjectileMove(move)) {
    return [body];
  }
  return [body, toWorldBox(f.x, f.y, f.facing, move.hitbox)];
}

export function isProjectileMove(move: MoveData): boolean {
  return move.special !== undefined && move.special.kind !== 'dash';
}

/** The melee hitbox if the fighter has one live this frame. */
export function activeHitbox(f: FighterState): WorldBox | null {
  if (f.state !== 'attack' || f.movePhase !== 'active' || f.moveConnected) return null;
  const move = getMoveData(f);
  if (move === null || isProjectileMove(move)) return null;
  return toWorldBox(f.x, f.y, f.facing, move.hitbox);
}

export function projectileBox(p: Projectile): WorldBox {
  return { left: p.x - p.w / 2, bottom: p.y, w: p.w, h: p.h };
}
