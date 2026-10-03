/**
 * Simulation constants. One step is one frame at STEP_HZ.
 * World units are pixels: x grows right, y is height above the ground.
 */

export const STEP_HZ = 60;

export const STAGE_WIDTH = 1560;
export const VIEW_WIDTH = 1300;
export const WALL_MARGIN = 60;
export const MIN_X = WALL_MARGIN;
export const MAX_X = STAGE_WIDTH - WALL_MARGIN;
export const MAX_SEPARATION = 1100;

export const START_OFFSET = 200;
export const P1_START_X = STAGE_WIDTH / 2 - START_OFFSET;
export const P2_START_X = STAGE_WIDTH / 2 + START_OFFSET;

export const PUSHBOX_WIDTH = 100;
export const PUSHBOX_HEIGHT = 270;

/** Hurtbox used while lying down (knockdown on the ground, ko). */
export const DOWN_HURTBOX = { w: 200, h: 70 } as const;
/** Jumping hurtboxes start this far above the fighter y (legs tucked). */
export const JUMP_HURTBOX_LIFT = 30;

export const METER_MAX = 100;
export const SPECIAL_COST = 50;
/** Specials deal this fraction of their damage on block. Normals deal none. */
export const CHIP_RATIO = 0.1;

/** Frames a button press stays buffered while the fighter cannot act. */
export const INPUT_BUFFER_FRAMES = 4;

/** Frames lying on the ground (invulnerable) after a knockdown lands. */
export const KNOCKDOWN_LIE_FRAMES = 45;
/** Upward velocity given to a knocked down fighter. */
export const KNOCKDOWN_POP_VY = 7;
/** Horizontal air speed of a knocked down fighter while it falls. */
export const KNOCKDOWN_AIR_VX = 3;

/** Knockback slides decay by this factor every frame (total distance = knockback). */
export const SLIDE_FRICTION = 0.8;
export const SLIDE_EPSILON = 0.05;

export const COMBO_SCALING_STEP = 0.1;
export const COMBO_SCALING_MIN = 0.4;

/** Holding back blocks automatically (guard pose) when a threat is this close. */
export const PROXIMITY_GUARD_RANGE = 380;

export const DEFAULT_HIT_STOP_FRAMES = 6;

export const ROUND_SECONDS = 99;
export const DEFAULT_ROUNDS = 3;
/** A best-of-N match never plays more than N + EXTRA_ROUNDS_LIMIT rounds. */
export const EXTRA_ROUNDS_LIMIT = 2;

export const INTRO_FRAMES = 90;
/** Inside the intro, 'ROUND n' is shown before this frame and 'FIGHT!' after. */
export const INTRO_ROUND_BANNER_FRAMES = 60;
export const KO_FRAMES = 120;
export const TIME_UP_FRAMES = 120;
export const ROUND_END_FRAMES = 90;
