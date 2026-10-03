import { W, STAGE_WORLD_W } from './layout';

export const MAX_CAMERA_X = STAGE_WORLD_W - W;

export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** Camera x that centres the midpoint of the fighters, clamped to the stage. */
export function cameraTarget(x1: number, x2: number): number {
  return clamp((x1 + x2) / 2 - W / 2, 0, MAX_CAMERA_X);
}

/** Eases the camera toward its target (frame-rate independent per fixed step). */
export function followCamera(current: number, x1: number, x2: number, ease = 0.12): number {
  const target = cameraTarget(x1, x2);
  return clamp(current + (target - current) * ease, 0, MAX_CAMERA_X);
}
