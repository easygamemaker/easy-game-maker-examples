/**
 * Fighter roster for Street Brazil Fighter.
 *
 * Pure data: no engine, DOM or Node imports. All frame counts are in 60 Hz
 * simulation steps. Distances are pixels, y is height above ground.
 *
 * Box convention (`Rect`): x is the forward offset of the box CENTER from the
 * fighter x (mirrored when the fighter faces left), y is the BOTTOM of the box
 * above the fighter y (above the projectile y for projectile hitboxes), w and h
 * are width and height.
 */

export type PoseId =
  | 'idle'
  | 'walk'
  | 'jump'
  | 'crouch'
  | 'punch'
  | 'kick'
  | 'block'
  | 'hit'
  | 'down'
  | 'punch_windup'
  | 'kick_windup'
  | 'special_charge'
  | 'special_release'
  | 'crouch_block'
  | 'crouch_punch'
  | 'jump_kick'
  | 'victory'
  | 'fx';

/** Sprite frame names present in every character atlas. */
export const POSE_IDS: readonly PoseId[] = [
  'idle',
  'walk',
  'jump',
  'crouch',
  'punch',
  'kick',
  'block',
  'hit',
  'down',
  'punch_windup',
  'kick_windup',
  'special_charge',
  'special_release',
  'crouch_block',
  'crouch_punch',
  'jump_kick',
  'victory',
  'fx',
];

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** low: crouch block only. high: stand block only. mid: either. */
export type HitLevel = 'high' | 'mid' | 'low';

export type MoveKey = 'lightPunch' | 'heavyKick' | 'crouchPunch' | 'crouchKick' | 'jumpKick' | 'special';

export const MOVE_KEYS: readonly MoveKey[] = [
  'lightPunch',
  'heavyKick',
  'crouchPunch',
  'crouchKick',
  'jumpKick',
  'special',
];

export type ProjectileVisual = 'slash' | 'whirlwind' | 'shockwave' | 'fireball' | 'feathers';

/**
 * A projectile special ('projectile' flies straight, 'ground-wave' hugs the
 * ground and is a low hit). It spawns on the first active frame of the move at
 * (fighter.x + facing * spawnOffsetX, fighter.y + spawnOffsetY) and flies at
 * `speed` px per frame for at most `lifetime` frames. The move `hitbox` is the
 * projectile box relative to the projectile position.
 */
export interface ProjectileSpecial {
  readonly kind: 'projectile' | 'ground-wave';
  readonly speed: number;
  readonly lifetime: number;
  readonly spawnOffsetX: number;
  readonly spawnOffsetY: number;
  readonly visual: ProjectileVisual;
}

/**
 * A dash special: during the active frames the fighter travels forward at
 * `speed` px per frame carrying the move hitbox. Movement stops on contact.
 */
export interface DashSpecial {
  readonly kind: 'dash';
  readonly speed: number;
}

export type SpecialData = ProjectileSpecial | DashSpecial;

export interface MovePoses {
  readonly startup: PoseId;
  readonly active: PoseId;
  readonly recovery: PoseId;
}

export interface MoveData {
  readonly id: MoveKey;
  readonly name: string;
  readonly startup: number;
  readonly active: number;
  readonly recovery: number;
  readonly damage: number;
  readonly hitstun: number;
  readonly blockstun: number;
  /** Total pushback distance (px) applied to the defender on hit or block. */
  readonly knockback: number;
  /** Extra pushback (px) applied to the attacker when the move is blocked. */
  readonly selfPushback?: number;
  /** Meter gained by the attacker on hit (half on block). */
  readonly meterGain: number;
  /** Meter gained by the defender on hit (half on block). */
  readonly meterGainDefender: number;
  readonly hitbox: Rect;
  readonly level: HitLevel;
  readonly knockdown: boolean;
  readonly poses: MovePoses;
  readonly special?: SpecialData;
}

export interface HurtboxDims {
  readonly w: number;
  readonly h: number;
}

export interface CharacterHurtboxes {
  readonly stand: HurtboxDims;
  readonly crouch: HurtboxDims;
  readonly jump: HurtboxDims;
}

export interface CharacterMoves {
  readonly lightPunch: MoveData;
  readonly heavyKick: MoveData;
  readonly crouchPunch: MoveData;
  readonly crouchKick: MoveData;
  readonly jumpKick: MoveData;
  readonly special: MoveData;
}

export interface CharacterData {
  readonly id: string;
  readonly displayName: string;
  readonly tagline: string;
  readonly specialName: string;
  /** UI accent color, hex. */
  readonly accent: string;
  readonly walkForward: number;
  readonly walkBack: number;
  readonly jumpVelocity: number;
  readonly gravity: number;
  readonly jumpForwardSpeed: number;
  readonly maxHealth: number;
  /** On-screen size multiplier of the sprite (1 = the common base body height). Kept within 0.92 to 1.08. */
  readonly visualScale?: number;
  readonly hurtbox?: CharacterHurtboxes;
  readonly moves: CharacterMoves;
}

const PUNCH_POSES: MovePoses = { startup: 'punch_windup', active: 'punch', recovery: 'punch_windup' };
const KICK_POSES: MovePoses = { startup: 'kick_windup', active: 'kick', recovery: 'kick_windup' };
const CROUCH_POSES: MovePoses = { startup: 'crouch', active: 'crouch_punch', recovery: 'crouch' };
const JUMP_POSES: MovePoses = { startup: 'jump', active: 'jump_kick', recovery: 'jump' };
const SPECIAL_POSES: MovePoses = { startup: 'special_charge', active: 'special_release', recovery: 'special_release' };

interface NormalTuning {
  readonly startup: number;
  readonly active: number;
  readonly recovery: number;
  readonly damage: number;
  readonly hitstun: number;
  readonly blockstun: number;
  readonly knockback: number;
  readonly hitbox: Rect;
}

function lightPunch(t: NormalTuning): MoveData {
  return { id: 'lightPunch', name: 'Light Punch', ...t, meterGain: 4, meterGainDefender: 6, level: 'mid', knockdown: false, poses: PUNCH_POSES };
}

function heavyKick(t: NormalTuning): MoveData {
  return { id: 'heavyKick', name: 'Heavy Kick', ...t, selfPushback: 10, meterGain: 8, meterGainDefender: 10, level: 'mid', knockdown: false, poses: KICK_POSES };
}

function crouchPunch(t: NormalTuning): MoveData {
  return { id: 'crouchPunch', name: 'Crouch Punch', ...t, meterGain: 3, meterGainDefender: 5, level: 'mid', knockdown: false, poses: CROUCH_POSES };
}

function crouchKick(t: NormalTuning): MoveData {
  return { id: 'crouchKick', name: 'Sweep', ...t, selfPushback: 10, meterGain: 7, meterGainDefender: 9, level: 'low', knockdown: true, poses: CROUCH_POSES };
}

function jumpKick(t: NormalTuning): MoveData {
  return { id: 'jumpKick', name: 'Jump Kick', ...t, meterGain: 6, meterGainDefender: 8, level: 'high', knockdown: false, poses: JUMP_POSES };
}

interface SpecialTuning extends NormalTuning {
  readonly name: string;
  readonly level: HitLevel;
  readonly knockdown: boolean;
  readonly meterGain: number;
  readonly meterGainDefender: number;
  readonly special: SpecialData;
}

function special(t: SpecialTuning): MoveData {
  return { id: 'special', selfPushback: 20, poses: SPECIAL_POSES, ...t };
}

const TIAO: CharacterData = {
  id: 'tiao',
  displayName: 'Mestre Tiao',
  tagline: 'The capoeira master who never stops swaying.',
  specialName: 'Meia-Lua Tornado',
  accent: '#f2b33d',
  walkForward: 4.4,
  walkBack: 3.6,
  jumpVelocity: 20,
  gravity: 0.95,
  jumpForwardSpeed: 5.5,
  maxHealth: 1000,
  moves: {
    lightPunch: lightPunch({ startup: 4, active: 3, recovery: 9, damage: 45, hitstun: 15, blockstun: 11, knockback: 28, hitbox: { x: 75, y: 140, w: 80, h: 55 } }),
    heavyKick: heavyKick({ startup: 10, active: 4, recovery: 18, damage: 105, hitstun: 20, blockstun: 16, knockback: 60, hitbox: { x: 120, y: 110, w: 130, h: 60 } }),
    crouchPunch: crouchPunch({ startup: 4, active: 2, recovery: 8, damage: 30, hitstun: 13, blockstun: 10, knockback: 22, hitbox: { x: 70, y: 50, w: 70, h: 50 } }),
    crouchKick: crouchKick({ startup: 8, active: 4, recovery: 20, damage: 80, hitstun: 20, blockstun: 14, knockback: 40, hitbox: { x: 120, y: 0, w: 160, h: 40 } }),
    jumpKick: jumpKick({ startup: 6, active: 12, recovery: 4, damage: 80, hitstun: 17, blockstun: 13, knockback: 35, hitbox: { x: 50, y: -40, w: 90, h: 90 } }),
    special: special({
      name: 'Meia-Lua Tornado',
      startup: 8, active: 16, recovery: 18, damage: 140, hitstun: 24, blockstun: 18, knockback: 70,
      hitbox: { x: 60, y: 60, w: 110, h: 140 }, level: 'mid', knockdown: true, meterGain: 0, meterGainDefender: 12,
      special: { kind: 'dash', speed: 11 },
    }),
  },
};

const DALVA: CharacterData = {
  id: 'dalva',
  displayName: 'Cangaceira Dalva',
  tagline: 'Her machete cuts the dry wind of the sertao.',
  specialName: 'Peixeira Wave',
  accent: '#c8553d',
  walkForward: 3.8,
  walkBack: 3.2,
  jumpVelocity: 19.5,
  gravity: 0.95,
  jumpForwardSpeed: 5,
  maxHealth: 1000,
  moves: {
    lightPunch: lightPunch({ startup: 5, active: 3, recovery: 9, damage: 55, hitstun: 15, blockstun: 11, knockback: 30, hitbox: { x: 85, y: 140, w: 90, h: 55 } }),
    heavyKick: heavyKick({ startup: 11, active: 4, recovery: 18, damage: 115, hitstun: 21, blockstun: 16, knockback: 65, hitbox: { x: 120, y: 120, w: 120, h: 60 } }),
    crouchPunch: crouchPunch({ startup: 5, active: 3, recovery: 9, damage: 35, hitstun: 13, blockstun: 10, knockback: 24, hitbox: { x: 80, y: 50, w: 80, h: 50 } }),
    crouchKick: crouchKick({ startup: 9, active: 4, recovery: 21, damage: 85, hitstun: 20, blockstun: 14, knockback: 40, hitbox: { x: 105, y: 0, w: 130, h: 40 } }),
    jumpKick: jumpKick({ startup: 6, active: 12, recovery: 4, damage: 85, hitstun: 17, blockstun: 13, knockback: 35, hitbox: { x: 55, y: -40, w: 95, h: 90 } }),
    special: special({
      name: 'Peixeira Wave',
      startup: 12, active: 2, recovery: 26, damage: 110, hitstun: 22, blockstun: 18, knockback: 50,
      hitbox: { x: 0, y: 0, w: 70, h: 150 }, level: 'mid', knockdown: false, meterGain: 0, meterGainDefender: 10,
      special: { kind: 'projectile', speed: 8, lifetime: 120, spawnOffsetX: 90, spawnOffsetY: 40, visual: 'slash' },
    }),
  },
};

const SACI: CharacterData = {
  id: 'saci',
  displayName: 'Saci',
  tagline: 'Folklore trickster: red cap, pipe and a thousand tricks.',
  specialName: 'Redemoinho',
  accent: '#d62839',
  walkForward: 4.6,
  walkBack: 4,
  jumpVelocity: 22,
  gravity: 0.95,
  jumpForwardSpeed: 6,
  maxHealth: 1000,
  hurtbox: { stand: { w: 80, h: 240 }, crouch: { w: 80, h: 130 }, jump: { w: 70, h: 200 } },
  moves: {
    lightPunch: lightPunch({ startup: 4, active: 3, recovery: 8, damage: 40, hitstun: 14, blockstun: 10, knockback: 26, hitbox: { x: 70, y: 130, w: 80, h: 55 } }),
    heavyKick: heavyKick({ startup: 9, active: 4, recovery: 17, damage: 90, hitstun: 19, blockstun: 15, knockback: 55, hitbox: { x: 110, y: 100, w: 110, h: 60 } }),
    crouchPunch: crouchPunch({ startup: 4, active: 2, recovery: 8, damage: 28, hitstun: 13, blockstun: 10, knockback: 20, hitbox: { x: 65, y: 45, w: 70, h: 50 } }),
    crouchKick: crouchKick({ startup: 8, active: 4, recovery: 19, damage: 70, hitstun: 20, blockstun: 14, knockback: 40, hitbox: { x: 100, y: 0, w: 120, h: 40 } }),
    jumpKick: jumpKick({ startup: 5, active: 12, recovery: 4, damage: 72, hitstun: 17, blockstun: 13, knockback: 30, hitbox: { x: 45, y: -40, w: 85, h: 85 } }),
    special: special({
      name: 'Redemoinho',
      startup: 14, active: 2, recovery: 24, damage: 90, hitstun: 22, blockstun: 16, knockback: 45,
      hitbox: { x: 0, y: 0, w: 70, h: 110 }, level: 'mid', knockdown: false, meterGain: 0, meterGainDefender: 10,
      special: { kind: 'projectile', speed: 4.5, lifetime: 170, spawnOffsetX: 80, spawnOffsetY: 160, visual: 'whirlwind' },
    }),
  },
};

const CURUPIRA: CharacterData = {
  id: 'curupira',
  displayName: 'Curupira',
  tagline: 'Forest guardian with backwards feet: his glowing footprints point the wrong way.',
  specialName: 'Pisao da Mata',
  accent: '#3f9b4f',
  walkForward: 3,
  walkBack: 2.5,
  jumpVelocity: 18.5,
  gravity: 0.95,
  jumpForwardSpeed: 4.5,
  maxHealth: 1000,
  hurtbox: { stand: { w: 100, h: 280 }, crouch: { w: 100, h: 155 }, jump: { w: 90, h: 235 } },
  moves: {
    lightPunch: lightPunch({ startup: 5, active: 3, recovery: 10, damage: 60, hitstun: 16, blockstun: 11, knockback: 32, hitbox: { x: 80, y: 140, w: 90, h: 60 } }),
    heavyKick: heavyKick({ startup: 12, active: 4, recovery: 20, damage: 130, hitstun: 22, blockstun: 17, knockback: 80, hitbox: { x: 125, y: 110, w: 130, h: 70 } }),
    crouchPunch: crouchPunch({ startup: 5, active: 3, recovery: 10, damage: 40, hitstun: 14, blockstun: 10, knockback: 26, hitbox: { x: 75, y: 50, w: 80, h: 55 } }),
    crouchKick: crouchKick({ startup: 10, active: 4, recovery: 22, damage: 95, hitstun: 20, blockstun: 15, knockback: 45, hitbox: { x: 105, y: 0, w: 130, h: 45 } }),
    jumpKick: jumpKick({ startup: 7, active: 12, recovery: 4, damage: 90, hitstun: 18, blockstun: 14, knockback: 40, hitbox: { x: 55, y: -40, w: 100, h: 95 } }),
    special: special({
      name: 'Pisao da Mata',
      startup: 14, active: 2, recovery: 24, damage: 120, hitstun: 24, blockstun: 18, knockback: 55,
      hitbox: { x: 0, y: 0, w: 90, h: 45 }, level: 'low', knockdown: false, meterGain: 0, meterGainDefender: 10,
      special: { kind: 'ground-wave', speed: 9, lifetime: 56, spawnOffsetX: 70, spawnOffsetY: 0, visual: 'shockwave' },
    }),
  },
};

const CRAQUE: CharacterData = {
  id: 'craque',
  displayName: 'Craque da Varzea',
  tagline: 'Street football legend with a burning right foot.',
  specialName: 'Bola de Fogo',
  accent: '#2f6fdb',
  walkForward: 4,
  walkBack: 3.3,
  jumpVelocity: 20,
  gravity: 0.95,
  jumpForwardSpeed: 5.2,
  maxHealth: 1000,
  visualScale: 0.92,
  hurtbox: { stand: { w: 88, h: 248 }, crouch: { w: 88, h: 138 }, jump: { w: 78, h: 212 } },
  moves: {
    lightPunch: lightPunch({ startup: 4, active: 3, recovery: 9, damage: 50, hitstun: 15, blockstun: 11, knockback: 28, hitbox: { x: 75, y: 140, w: 85, h: 55 } }),
    heavyKick: heavyKick({ startup: 10, active: 4, recovery: 18, damage: 110, hitstun: 20, blockstun: 16, knockback: 65, hitbox: { x: 115, y: 110, w: 120, h: 60 } }),
    crouchPunch: crouchPunch({ startup: 4, active: 2, recovery: 9, damage: 32, hitstun: 13, blockstun: 10, knockback: 22, hitbox: { x: 70, y: 50, w: 75, h: 50 } }),
    crouchKick: crouchKick({ startup: 9, active: 4, recovery: 20, damage: 85, hitstun: 20, blockstun: 14, knockback: 40, hitbox: { x: 105, y: 0, w: 130, h: 40 } }),
    jumpKick: jumpKick({ startup: 6, active: 12, recovery: 4, damage: 82, hitstun: 17, blockstun: 13, knockback: 35, hitbox: { x: 50, y: -40, w: 90, h: 90 } }),
    special: special({
      name: 'Bola de Fogo',
      startup: 11, active: 2, recovery: 25, damage: 100, hitstun: 22, blockstun: 17, knockback: 50,
      hitbox: { x: 0, y: 0, w: 60, h: 60 }, level: 'mid', knockdown: false, meterGain: 0, meterGainDefender: 10,
      special: { kind: 'projectile', speed: 11, lifetime: 140, spawnOffsetX: 85, spawnOffsetY: 120, visual: 'fireball' },
    }),
  },
};

const ROSA: CharacterData = {
  id: 'rosa',
  displayName: 'Passista Rosa',
  tagline: 'Carnival queen whose samba steps cut like feathers.',
  specialName: 'Chuva de Plumas',
  accent: '#e85d9e',
  walkForward: 4.8,
  walkBack: 4,
  jumpVelocity: 21,
  gravity: 0.95,
  jumpForwardSpeed: 6,
  maxHealth: 1000,
  moves: {
    lightPunch: lightPunch({ startup: 4, active: 3, recovery: 8, damage: 42, hitstun: 14, blockstun: 10, knockback: 26, hitbox: { x: 75, y: 140, w: 80, h: 55 } }),
    heavyKick: heavyKick({ startup: 9, active: 4, recovery: 16, damage: 95, hitstun: 19, blockstun: 15, knockback: 55, hitbox: { x: 115, y: 120, w: 120, h: 60 } }),
    crouchPunch: crouchPunch({ startup: 4, active: 2, recovery: 8, damage: 28, hitstun: 13, blockstun: 10, knockback: 20, hitbox: { x: 70, y: 50, w: 70, h: 50 } }),
    crouchKick: crouchKick({ startup: 8, active: 4, recovery: 19, damage: 75, hitstun: 20, blockstun: 14, knockback: 38, hitbox: { x: 110, y: 0, w: 140, h: 40 } }),
    jumpKick: jumpKick({ startup: 5, active: 12, recovery: 4, damage: 74, hitstun: 17, blockstun: 13, knockback: 30, hitbox: { x: 50, y: -40, w: 90, h: 90 } }),
    special: special({
      name: 'Chuva de Plumas',
      startup: 10, active: 2, recovery: 22, damage: 70, hitstun: 20, blockstun: 16, knockback: 45,
      hitbox: { x: 0, y: 0, w: 180, h: 140 }, level: 'mid', knockdown: false, meterGain: 15, meterGainDefender: 6,
      special: { kind: 'projectile', speed: 5, lifetime: 80, spawnOffsetX: 110, spawnOffsetY: 40, visual: 'feathers' },
    }),
  },
};

export const CHARACTERS: readonly CharacterData[] = [TIAO, DALVA, SACI, CURUPIRA, CRAQUE, ROSA];

export const CHARACTER_IDS: readonly string[] = CHARACTERS.map((c) => c.id);

export function getCharacter(id: string): CharacterData {
  const found = CHARACTERS.find((c) => c.id === id);
  if (!found) {
    throw new Error(`Unknown character id: ${id}`);
  }
  return found;
}

/** Default hurtbox sizes; a character may override them through `hurtbox`. */
export const DEFAULT_HURTBOXES: CharacterHurtboxes = {
  stand: { w: 90, h: 270 },
  crouch: { w: 90, h: 150 },
  jump: { w: 80, h: 230 },
};

export const visualScaleOf = (character: CharacterData): number => character.visualScale ?? 1;

export function hurtboxesOf(character: CharacterData): CharacterHurtboxes {
  return character.hurtbox ?? DEFAULT_HURTBOXES;
}

export function getMove(character: CharacterData, key: MoveKey): MoveData {
  return character.moves[key];
}
