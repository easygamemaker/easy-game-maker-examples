// White-background removal for sprite sheets: border flood fill, soft edge matte with colour
// decontamination (no white fringe) and connected-component frame detection.

const WHITE_MIN = 236; // a pixel is background-like when its darkest channel is at least this
const EDGE_RADIUS = 2;
const SOLID_BELOW = 175; // edge pixels at or below this (darkest channel) are fully opaque
const CLEAR_ABOVE = 250; // edge pixels at or above this are fully transparent

const minCh = (d, i) => Math.min(d[i], d[i + 1], d[i + 2]);

/** Returns a Uint8Array mask (1 = background) flood filled from the image border through near-white pixels. */
export function floodBackground(rgba, w, h) {
  const bg = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let sp = 0;
  const push = (p) => {
    if (bg[p] || minCh(rgba, p * 4) < WHITE_MIN) return;
    bg[p] = 1;
    stack[sp++] = p;
  };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (sp) {
    const p = stack[--sp];
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) push(p - 1);
    if (x < w - 1) push(p + 1);
    if (y > 0) push(p - w);
    if (y < h - 1) push(p + w);
  }
  return bg;
}

/** Builds straight-alpha RGBA where background is clear and edge pixels are matted and decontaminated. */
export function matte(rgba, w, h, bg) {
  // distance (chebyshev) of each foreground pixel to the background, capped at EDGE_RADIUS + 1
  const near = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = y * w + x;
      if (bg[p]) continue;
      let hit = false;
      for (let dy = -EDGE_RADIUS; dy <= EDGE_RADIUS && !hit; dy++) {
        const yy = y + dy;
        if (yy < 0 || yy >= h) { hit = true; break; }
        for (let dx = -EDGE_RADIUS; dx <= EDGE_RADIUS; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= w || bg[yy * w + xx]) { hit = true; break; }
        }
      }
      near[p] = hit ? 1 : 0;
    }
  }
  const out = new Uint8ClampedArray(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const i = p * 4;
    if (bg[p]) continue;
    let a = 1;
    if (near[p]) {
      const m = minCh(rgba, i);
      a = Math.min(1, Math.max(0, (CLEAR_ABOVE - m) / (CLEAR_ABOVE - SOLID_BELOW)));
    }
    if (a <= 0.02) continue;
    for (let c = 0; c < 3; c++) {
      const v = a < 1 ? (rgba[i + c] - (1 - a) * 255) / a : rgba[i + c];
      out[i + c] = Math.max(0, Math.min(255, v));
    }
    out[i + 3] = Math.round(a * 255);
  }
  return out;
}

/** Finds connected opaque blobs after dilating by `gap` pixels so detached effects join their frame. */
export function findBlobs(rgba, w, h, gap = 14, minArea = 60) {
  const solid = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) solid[p] = rgba[p * 4 + 3] > 40 ? 1 : 0;
  // dilate horizontally then vertically (box)
  const tmp = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    let last = -1e9;
    const row = y * w;
    for (let x = 0; x < w; x++) { if (solid[row + x]) last = x; if (x - last <= gap) tmp[row + x] = 1; }
    last = 1e9;
    for (let x = w - 1; x >= 0; x--) { if (solid[row + x]) last = x; if (last - x <= gap) tmp[row + x] = 1; }
  }
  const dil = new Uint8Array(w * h);
  for (let x = 0; x < w; x++) {
    let last = -1e9;
    for (let y = 0; y < h; y++) { if (tmp[y * w + x]) last = y; if (y - last <= gap) dil[y * w + x] = 1; }
    last = 1e9;
    for (let y = h - 1; y >= 0; y--) { if (tmp[y * w + x]) last = y; if (last - y <= gap) dil[y * w + x] = 1; }
  }
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const blobs = [];
  for (let s = 0; s < w * h; s++) {
    if (!dil[s] || seen[s]) continue;
    let sp = 0;
    stack[sp++] = s;
    seen[s] = 1;
    let minX = w, minY = h, maxX = 0, maxY = 0, area = 0;
    while (sp) {
      const p = stack[--sp];
      const x = p % w;
      const y = (p - x) / w;
      if (solid[p]) {
        area++;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nb) if (q >= 0 && dil[q] && !seen[q]) { seen[q] = 1; stack[sp++] = q; }
    }
    if (area >= minArea) blobs.push({ minX, minY, maxX, maxY, area });
  }
  return blobs;
}

/**
 * Marks enclosed pure-white regions (gaps between an arm and the body that the border flood fill cannot reach)
 * as background. Only regions of at least `minArea` pixels whose darkest channel is >= 250 are cleared.
 * Opt-in per character, because white clothing has pure-white highlights too.
 */
export function fillEnclosedWhite(rgba, w, h, bg, minArea = 80) {
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const isWhite = (p) => !bg[p] && minCh(rgba, p * 4) >= 250;
  for (let s = 0; s < w * h; s++) {
    if (seen[s] || !isWhite(s)) continue;
    const members = [];
    let sp = 0;
    stack[sp++] = s;
    seen[s] = 1;
    while (sp) {
      const p = stack[--sp];
      members.push(p);
      const x = p % w;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p >= w ? p - w : -1, p < w * (h - 1) ? p + w : -1];
      for (const q of nb) if (q >= 0 && !seen[q] && isWhite(q)) { seen[q] = 1; stack[sp++] = q; }
    }
    if (members.length >= minArea) for (const p of members) bg[p] = 1;
  }
}
