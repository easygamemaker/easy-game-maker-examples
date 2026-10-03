/**
 * AI tuning per difficulty and the delayed perception model. The AI sees its
 * own fighter as it is now but the opponent as it was `reactionFrames` ago.
 */

import { getCharacter } from '../data/characters';
import type { HitLevel, MoveData } from '../data/characters';
import { isAirborne } from './geometry';
import type { FighterState, MatchState, MovePhase, Side } from './types';

export type Difficulty = 'easy' | 'normal' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export interface AiParams {
  /** Delay in frames before the AI perceives what the opponent does. */
  readonly reactionFrames: number;
  /** Frames between free (non reactive) decisions. */
  readonly decisionInterval: number;
  /** Chance to guard a perceived attack or projectile. */
  readonly blockChance: number;
  /** Chance to pick the right guard height. */
  readonly heightAccuracy: number;
  readonly antiAirChance: number;
  /** Chance to attack when the opponent looks in range. */
  readonly aggression: number;
  /** Random error (px) in the AI distance estimate. */
  readonly spacingError: number;
  readonly specialChance: number;
  /** Chance to special cancel a normal that connected. */
  readonly cancelChance: number;
  readonly jumpInChance: number;
  readonly retreatChance: number;
  /** Chance to punish an opponent move that is in recovery nearby. */
  readonly punishChance: number;
  /** Guard while waking up and after blocking. */
  readonly wakeUpGuard: boolean;
}

export const AI_PARAMS: Readonly<Record<Difficulty, AiParams>> = {
  easy: {
    reactionFrames: 28,
    decisionInterval: 30,
    blockChance: 0.2,
    heightAccuracy: 0.5,
    antiAirChance: 0.1,
    aggression: 0.45,
    spacingError: 90,
    specialChance: 0.2,
    cancelChance: 0,
    jumpInChance: 0.15,
    retreatChance: 0.25,
    punishChance: 0.05,
    wakeUpGuard: false,
  },
  normal: {
    reactionFrames: 16,
    decisionInterval: 18,
    blockChance: 0.55,
    heightAccuracy: 0.8,
    antiAirChance: 0.4,
    aggression: 0.6,
    spacingError: 40,
    specialChance: 0.4,
    cancelChance: 0.3,
    jumpInChance: 0.12,
    retreatChance: 0.2,
    punishChance: 0.4,
    wakeUpGuard: true,
  },
  hard: {
    reactionFrames: 8,
    decisionInterval: 10,
    blockChance: 0.85,
    heightAccuracy: 0.95,
    antiAirChance: 0.75,
    aggression: 0.75,
    spacingError: 12,
    specialChance: 0.6,
    cancelChance: 0.7,
    jumpInChance: 0.08,
    retreatChance: 0.12,
    punishChance: 0.85,
    wakeUpGuard: true,
  },
};

export interface SeenProjectile {
  readonly id: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly level: HitLevel;
}

/** What the AI remembers about the opponent at a given frame. */
export interface OpponentView {
  readonly frame: number;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly airborne: boolean;
  readonly state: FighterState['state'];
  readonly characterId: string;
  readonly moveId: FighterState['moveId'];
  readonly moveFrame: number;
  readonly movePhase: MovePhase | null;
  readonly projectiles: readonly SeenProjectile[];
}

export function viewOpponent(match: MatchState, side: Side): OpponentView {
  const opp = match.fighters[side === 0 ? 1 : 0];
  return {
    frame: match.frame,
    x: opp.x,
    y: opp.y,
    vx: opp.vx,
    airborne: isAirborne(opp),
    state: opp.state,
    characterId: opp.characterId,
    moveId: opp.moveId,
    moveFrame: opp.moveFrame,
    movePhase: opp.movePhase,
    projectiles: match.projectiles
      .filter((p) => p.owner !== side)
      .map((p) => ({ id: p.id, x: p.x, y: p.y, vx: p.vx, level: p.level })),
  };
}

/** Appends a view and keeps the last `reactionFrames + 1` entries. */
export function remember(history: readonly OpponentView[], view: OpponentView, reactionFrames: number): readonly OpponentView[] {
  const limit = reactionFrames + 1;
  const next = [...history, view];
  return next.length > limit ? next.slice(next.length - limit) : next;
}

/** Horizontal reach (fighter x to the far edge of the hitbox) plus a typical half body. */
export function moveReach(move: MoveData): number {
  return move.hitbox.x + move.hitbox.w / 2 + 40;
}

export function seenMove(view: OpponentView): MoveData | null {
  if (view.moveId === null) return null;
  return getCharacter(view.characterId).moves[view.moveId];
}
