/**
 * Street Brazil Fighter simulation core (pure TypeScript, no engine/DOM/Node).
 *
 * MATCH LOOP (60 Hz, one stepMatch call per frame; pause = stop calling it)
 *   createMatch(config: MatchConfig): MatchState
 *     MatchConfig = { p1: string; p2: string; stageId?: string; rounds?: number (best of N, default 3);
 *                     hitStopFrames?: number (default 6); roundSeconds?: number (default 99) }
 *   stepMatch(state: MatchState, inputs: readonly [PlayerInput, PlayerInput]): { state: MatchState; events: readonly SimEvent[] }
 *   isMatchOver(state): boolean
 *   PlayerInput = { left, right, up, down, punch, kick, special, block: boolean }  (left/right are screen directions)
 *   neutralInput(): PlayerInput, input(partial): PlayerInput
 *
 * MATCH STATE (read only, new object every frame)
 *   phase: 'intro' | 'fight' | 'ko' | 'timeUp' | 'roundEnd' | 'matchEnd'; phaseFrame (0 on entry step); frame
 *   round, wins: [n, n], timerFrames, timerSeconds (ceil, show this), banner: Banner | null
 *     Banner = 'ROUND 1'..'ROUND 5' | 'FIGHT!' | 'KO!' | 'TIME!' | 'DRAW' | 'P1 WINS' | 'P2 WINS'
 *   roundOutcome: { winner: 0 | 1 | null; reason: 'ko' | 'doubleKo' | 'time' } | null, roundWinner, winner (matchEnd)
 *   hitStop: frames left of the post-hit freeze (renderer may shake the camera while > 0)
 *   fighters: [FighterState, FighterState], projectiles: Projectile[]
 *
 * FIGHTER STATE
 *   x (feet center), y (height above ground), facing (1 right, -1 left), state, stateFrame,
 *   pose: PoseId (sprite frame name in the character atlas), poseFrame (frames this pose has been shown),
 *   health / maxHealth, meter (0..100, SPECIAL_COST = 50), comboCount (hits RECEIVED in the current combo:
 *   show "N HITS" next to the attacker when the defender's comboCount >= 2), moveId, moveFrame, movePhase.
 *
 * PROJECTILE
 *   { id, owner, characterId, kind: 'projectile' | 'ground-wave', visual: 'slash' | 'whirlwind' | 'shockwave' |
 *     'fireball' | 'feathers', x (center), y (bottom), w, h, vx, facing, age, lifetime, damage, level }
 *   Draw the owner's 'fx' pose (or a visual-specific effect) centered at x, from y to y + h, mirrored by facing.
 *
 * EVENTS (SimEvent, discriminated by `type`; positions are world px for VFX/SFX)
 *   roundStart, fightStart, attackStart {player, moveId}, specialStart {player, x, y}, hit {attacker, defender,
 *   moveId, damage, x, y, special, knockdown, comboCount, projectile}, block {.., chip}, projectileSpawn,
 *   projectileHit, projectileClash, projectileExpire, knockdown, wakeUp, ko, jump, land, timeUp,
 *   roundEnd {round, winner, reason}, matchEnd {winner}
 *
 * AI
 *   createAi(difficulty: 'easy' | 'normal' | 'hard', seed: number): AiState
 *   decideAi(ai: AiState, match: MatchState, side: 0 | 1): { input: PlayerInput; ai: AiState }  (once per frame)
 *   createRng(seed), nextFloat(rng) -> [value, rng]  (immutable mulberry32)
 *
 * DEBUG DRAW: bodyHurtbox(f), hurtboxes(f), activeHitbox(f), projectileBox(p) return world boxes
 *   { left, bottom, w, h } (y up from the ground).
 *
 * Renderer conventions:
 *   - Screen y = groundY - world y. Mirror the sprite when facing === -1.
 *   - Draw `pose` directly; attack poses already follow startup/active/recovery from the move data.
 *   - knockdown / ko: pose is 'hit' while airborne (y > 0) and 'down' once on the ground; ko stays 'down'.
 *     Knockdown lies KNOCKDOWN_LIE_FRAMES frames after landing, then the fighter is 'idle' (wakeUp event).
 *   - victory pose appears in roundEnd (round winner) and matchEnd (match winner).
 *   - Camera: STAGE_WIDTH 1560, VIEW_WIDTH 1300; fighters stay within MAX_SEPARATION (1100) of each other.
 *   - Test helpers live in './testing' (runFrames, startFight, runMatchWithAi), not re-exported here.
 */

export type {
  Banner,
  Facing,
  FighterState,
  FighterStateName,
  InputBuffer,
  MatchConfig,
  MatchPhase,
  MatchState,
  MovePhase,
  PlayerInput,
  Point,
  Projectile,
  ResolvedMatchConfig,
  RoundEndReason,
  RoundOutcome,
  Side,
  SimEvent,
  StepResult,
  WorldBox,
} from './types';
export * from './constants';
export { createMatch, decideMatch, isMatchOver, resolveConfig, stepMatch, timeUpOutcome } from './match';
export { EMPTY_BUFFER, NEUTRAL_INPUT, horizontal, input, isNeutral, neutralInput } from './input';
export { AI_PARAMS, AI_WATCHDOG_FRAMES, createAi, decideAi } from './ai';
export type { AiMode, AiParams, AiState, Difficulty, ThreatResponse } from './ai';
export { DIFFICULTIES } from './ai-model';
export { chance, createRng, nextFloat, nextInt, nextRange } from './rng';
export type { Rng } from './rng';
export { hashSequence, hashString, hashValue } from './hash';
export { activeHitbox, bodyHurtbox, hurtboxes, isAirborne, projectileBox } from './geometry';
export { derivePose, movePhaseOf, moveTotalFrames } from './fighter';
export { chipDamage, comboScale, scaledDamage } from './combat';
export { CHARACTERS, CHARACTER_IDS, MOVE_KEYS, POSE_IDS, getCharacter, hurtboxesOf } from '../data/characters';
export type { CharacterData, HitLevel, MoveData, MoveKey, PoseId, ProjectileVisual, Rect, SpecialData } from '../data/characters';
