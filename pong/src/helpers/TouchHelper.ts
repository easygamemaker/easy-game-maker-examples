/**
 * Detects whether the current environment needs touch controls.
 * Works in EGM Simulator (reads ?egm_platform param) and on real devices.
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const p = new URLSearchParams(window.location.search).get('egm_platform');
  if (p === 'ios' || p === 'android') return true;
  return navigator.maxTouchPoints > 0;
}
