/** Input helpers: neutral input, direction resolution and the press buffer. */

import { INPUT_BUFFER_FRAMES } from './constants';
import type { InputBuffer, PlayerInput } from './types';

export const NEUTRAL_INPUT: PlayerInput = Object.freeze({
  left: false,
  right: false,
  up: false,
  down: false,
  punch: false,
  kick: false,
  special: false,
  block: false,
});

export const EMPTY_BUFFER: InputBuffer = Object.freeze({ punch: 0, kick: 0, special: 0 });

export function neutralInput(): PlayerInput {
  return NEUTRAL_INPUT;
}

/** Builds an input from a partial description (missing keys are released). */
export function input(partial: Partial<PlayerInput> = {}): PlayerInput {
  return { ...NEUTRAL_INPUT, ...partial };
}

/** Absolute horizontal direction: -1 left, 1 right, 0 none or both. */
export function horizontal(i: PlayerInput): -1 | 0 | 1 {
  if (i.left === i.right) return 0;
  return i.left ? -1 : 1;
}

export function isNeutral(i: PlayerInput): boolean {
  return !(i.left || i.right || i.up || i.down || i.punch || i.kick || i.special || i.block);
}

function nextSlot(current: number, pressed: boolean): number {
  if (pressed) return INPUT_BUFFER_FRAMES;
  return current > 0 ? current - 1 : 0;
}

/**
 * Ages the buffer by one frame and records rising edges of punch, kick and
 * special. A press stays usable for INPUT_BUFFER_FRAMES steps (the press step
 * included).
 */
export function updateBuffer(buffer: InputBuffer, previous: PlayerInput, current: PlayerInput): InputBuffer {
  return {
    punch: nextSlot(buffer.punch, current.punch && !previous.punch),
    kick: nextSlot(buffer.kick, current.kick && !previous.kick),
    special: nextSlot(buffer.special, current.special && !previous.special),
  };
}

/**
 * Records rising edges without aging (used while the match is in hit stop so
 * presses made during the freeze are not lost).
 */
export function recordPresses(buffer: InputBuffer, previous: PlayerInput, current: PlayerInput): InputBuffer {
  return {
    punch: current.punch && !previous.punch ? INPUT_BUFFER_FRAMES : buffer.punch,
    kick: current.kick && !previous.kick ? INPUT_BUFFER_FRAMES : buffer.kick,
    special: current.special && !previous.special ? INPUT_BUFFER_FRAMES : buffer.special,
  };
}
