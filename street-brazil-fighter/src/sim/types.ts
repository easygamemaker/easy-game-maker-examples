/**
 * Shared simulation types. Everything is readonly: every step returns new
 * objects and never mutates its arguments.
 */

import type { HitLevel, MoveKey, PoseId, ProjectileVisual } from '../data/characters';

export type Side = 0 | 1;
export type Facing = 1 | -1;

/** left/right are absolute screen directions. */
export interface PlayerInput {
  readonly left: boolean;
  readonly right: boolean;
  readonly up: boolean;
  readonly down: boolean;
  readonly punch: boolean;
  readonly kick: boolean;
  readonly special: boolean;
  readonly block: boolean;
}

export type FighterStateName =
  | 'idle'
  | 'walkForward'
  | 'walkBack'
  | 'crouch'
  | 'jump'
  | 'attack'
  | 'blockStand'
  | 'blockCrouch'
  | 'hitstun'
  | 'blockstun'
  | 'knockdown'
  | 'ko'
  | 'victory';

export type MovePhase = 'startup' | 'active' | 'recovery';

/** Frames left for each buffered press (0 = nothing buffered). */
export interface InputBuffer {
  readonly punch: number;
  readonly kick: number;
  readonly special: number;
}

export interface FighterState {
  readonly side: Side;
  readonly characterId: string;
  readonly x: number;
  readonly y: number;
  readonly vx: number;
  readonly vy: number;
  /** Knockback slide velocity, decays every frame. */
  readonly slideVx: number;
  readonly facing: Facing;
  readonly state: FighterStateName;
  /** Frames spent in the current state (0 on the frame the state was entered). */
  readonly stateFrame: number;
  readonly pose: PoseId;
  /** Frames the current pose has been shown (0 on the first frame). */
  readonly poseFrame: number;
  readonly health: number;
  readonly maxHealth: number;
  readonly meter: number;
  /** Hits received in the current combo (show it on the ATTACKER side HUD). */
  readonly comboCount: number;
  readonly moveId: MoveKey | null;
  /** 1-based frame inside the current move, 0 when not attacking. */
  readonly moveFrame: number;
  readonly movePhase: MovePhase | null;
  /** True once the current move hit or was blocked (one hit per use). */
  readonly moveConnected: boolean;
  /** Remaining hitstun/blockstun frames, or lying frames when knocked down. */
  readonly stunFrames: number;
  /** While in blockstun: whether the block is crouching. */
  readonly crouching: boolean;
  /** Jump arc captured at takeoff: -1 left, 0 neutral, 1 right (absolute). */
  readonly jumpDir: -1 | 0 | 1;
  readonly airAttackUsed: boolean;
  readonly buffer: InputBuffer;
  readonly lastInput: PlayerInput;
}

export interface Projectile {
  readonly id: number;
  readonly owner: Side;
  readonly characterId: string;
  readonly kind: 'projectile' | 'ground-wave';
  readonly visual: ProjectileVisual;
  /** Center x of the projectile. */
  readonly x: number;
  /** Bottom of the projectile above the ground. */
  readonly y: number;
  readonly vx: number;
  readonly facing: Facing;
  readonly w: number;
  readonly h: number;
  readonly age: number;
  readonly lifetime: number;
  readonly damage: number;
  readonly level: HitLevel;
}

export type MatchPhase = 'intro' | 'fight' | 'ko' | 'timeUp' | 'roundEnd' | 'matchEnd';

export type RoundEndReason = 'ko' | 'doubleKo' | 'time';

export interface RoundOutcome {
  readonly winner: Side | null;
  readonly reason: RoundEndReason;
}

export interface MatchConfig {
  readonly p1: string;
  readonly p2: string;
  readonly stageId?: string;
  /** Best of N rounds (default 3: first to 2 wins). */
  readonly rounds?: number;
  /** Frozen frames after a hit or block (default 6, use 0 for exact frame tests). */
  readonly hitStopFrames?: number;
  /** Round length in seconds (default 99). */
  readonly roundSeconds?: number;
}

export interface ResolvedMatchConfig {
  readonly p1: string;
  readonly p2: string;
  readonly stageId: string | null;
  readonly rounds: number;
  readonly winsNeeded: number;
  readonly maxRounds: number;
  readonly hitStopFrames: number;
  readonly roundSeconds: number;
}

export type Banner =
  | 'ROUND 1'
  | 'ROUND 2'
  | 'ROUND 3'
  | 'ROUND 4'
  | 'ROUND 5'
  | 'FIGHT!'
  | 'KO!'
  | 'TIME!'
  | 'DRAW'
  | 'P1 WINS'
  | 'P2 WINS';

export interface MatchState {
  readonly config: ResolvedMatchConfig;
  /** Total steps since the match was created. */
  readonly frame: number;
  readonly phase: MatchPhase;
  /** Steps since the current phase was entered (0 on the entry step). */
  readonly phaseFrame: number;
  readonly round: number;
  readonly wins: readonly [number, number];
  readonly timerFrames: number;
  readonly timerSeconds: number;
  readonly fighters: readonly [FighterState, FighterState];
  readonly projectiles: readonly Projectile[];
  readonly nextProjectileId: number;
  /** Remaining frozen frames after a hit (fighters and projectiles do not move). */
  readonly hitStop: number;
  readonly banner: Banner | null;
  /** Outcome of the round in progress once decided (ko, timeUp, roundEnd phases). */
  readonly roundOutcome: RoundOutcome | null;
  readonly roundWinner: Side | null;
  /** Match winner, set in the matchEnd phase (null means a drawn match). */
  readonly winner: Side | null;
  /** Health left at the end of each round, summed (tie breaker after the last round). */
  readonly healthTotals: readonly [number, number];
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export type SimEvent =
  | { readonly type: 'roundStart'; readonly round: number }
  | { readonly type: 'fightStart'; readonly round: number }
  | { readonly type: 'attackStart'; readonly player: Side; readonly moveId: MoveKey }
  | { readonly type: 'specialStart'; readonly player: Side; readonly characterId: string; readonly x: number; readonly y: number }
  | {
      readonly type: 'hit';
      readonly attacker: Side;
      readonly defender: Side;
      readonly moveId: MoveKey;
      readonly damage: number;
      readonly x: number;
      readonly y: number;
      readonly special: boolean;
      readonly knockdown: boolean;
      readonly comboCount: number;
      readonly projectile: boolean;
    }
  | {
      readonly type: 'block';
      readonly attacker: Side;
      readonly defender: Side;
      readonly moveId: MoveKey;
      readonly chip: number;
      readonly x: number;
      readonly y: number;
      readonly special: boolean;
      readonly projectile: boolean;
    }
  | { readonly type: 'projectileSpawn'; readonly id: number; readonly owner: Side; readonly x: number; readonly y: number; readonly visual: ProjectileVisual }
  | { readonly type: 'projectileHit'; readonly id: number; readonly owner: Side; readonly x: number; readonly y: number; readonly blocked: boolean }
  | { readonly type: 'projectileClash'; readonly ids: readonly [number, number]; readonly x: number; readonly y: number }
  | { readonly type: 'projectileExpire'; readonly id: number; readonly owner: Side; readonly x: number; readonly y: number }
  | { readonly type: 'knockdown'; readonly player: Side; readonly x: number }
  | { readonly type: 'wakeUp'; readonly player: Side; readonly x: number }
  | { readonly type: 'ko'; readonly player: Side; readonly x: number; readonly y: number }
  | { readonly type: 'jump'; readonly player: Side; readonly x: number }
  | { readonly type: 'land'; readonly player: Side; readonly x: number }
  | { readonly type: 'timeUp' }
  | { readonly type: 'roundEnd'; readonly round: number; readonly winner: Side | null; readonly reason: RoundEndReason }
  | { readonly type: 'matchEnd'; readonly winner: Side | null };

export interface StepResult {
  readonly state: MatchState;
  readonly events: readonly SimEvent[];
}

/** A world-space axis-aligned rectangle: left, bottom (y above ground), width, height. */
export interface WorldBox {
  readonly left: number;
  readonly bottom: number;
  readonly w: number;
  readonly h: number;
}
