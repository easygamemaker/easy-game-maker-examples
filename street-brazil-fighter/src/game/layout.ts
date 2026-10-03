/** Logical canvas size: exactly the 13:7 ratio of the stage art. */
export const W = 1300;
export const H = 700;
/** Screen y of the ground line where fighters' feet touch. */
export const GROUND_SCREEN_Y = 590;
/** The stage image is drawn 1.2x the screen so the camera can scroll sideways. */
export const STAGE_ZOOM = 1.2;
export const STAGE_WORLD_W = W * STAGE_ZOOM; // 1560, equals the sim STAGE_WIDTH
export const STAGE_WORLD_H = H * STAGE_ZOOM; // 840
/** The atlas idle body is 400 px tall; the game draws it 300 px tall. */
export const SPRITE_SCALE = 0.75;

export const COLORS = {
  ink: '#10131f',
  gold: '#ffd23f',
  green: '#1faa59',
  blue: '#1d4ed8',
  white: '#ffffff',
  red: '#e63946',
  dim: '#9aa3b8',
} as const;
