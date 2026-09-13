export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const p = new URLSearchParams(window.location.search).get('egm_platform');
  if (p === 'ios' || p === 'android') return true;
  return navigator.maxTouchPoints > 0;
}
