import { dE, isSkin, lab2rgb, rgb2lab } from './color.mjs';
export const mean = (arr) => arr.reduce((a, v) => a.map((s, k) => s + v[k] / arr.length), [0, 0, 0]);
/** Opaque pixels of an atlas frame as [x, y, r, g, b]. */
export function pixelsOf(fr) {
  const out = [];
  for (let y = 0; y < fr.h; y++) for (let x = 0; x < fr.w; x++) {
    const i = (y * fr.w + x) * 4;
    if (fr.data[i + 3] > 220) out.push([x, y, fr.data[i], fr.data[i + 1], fr.data[i + 2]]);
  }
  return out;
}
/** k-means (k=5) over Lab pixels of the reference frame, ignoring the dark outline. Returns [{ c, share }]. */
export function palette(px) {
  const lab = px.map((p) => rgb2lab(p[2], p[3], p[4])).filter((l) => l[0] > 28).filter((_, i) => i % 3 === 0);
  let cs = [0, 1, 2, 3, 4].map((k) => lab[Math.floor((lab.length * (k + 0.5)) / 5)]);
  const assign = (p) => { let b = 0, bd = Infinity; cs.forEach((c, k) => { const d = dE(p, c); if (d < bd) { bd = d; b = k; } }); return b; };
  for (let it = 0; it < 12; it++) {
    const sum = cs.map(() => [0, 0, 0, 0]);
    for (const p of lab) { const s = sum[assign(p)]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; }
    cs = cs.map((c, k) => (sum[k][3] ? [sum[k][0] / sum[k][3], sum[k][1] / sum[k][3], sum[k][2] / sum[k][3]] : c));
  }
  const counts = cs.map(() => 0);
  for (const p of lab) counts[assign(p)]++;
  return cs.map((c, k) => ({ c, rgb: lab2rgb(...c), share: counts[k] / lab.length })).filter((x) => x.share >= 0.06);
}
/** Region of a pixel: 0 = skin (hue mask), 1..n = nearest non-skin cluster within 30 dE, -1 = none (outline, effects). */
export function regionOf(r, g, b, pal, lab = rgb2lab(r, g, b)) {
  if (lab[0] < 24) return -1;
  if (isSkin(r, g, b)) return 0;
  let best = -1, bd = 30;
  pal.forEach((cl, k) => { if (isSkin(...cl.rgb)) return; const d = dE(lab, cl.c); if (d < bd) { bd = d; best = k + 1; } });
  return best;
}
/** Mean Lab per region (index 0 = skin); null when a region has fewer than 40 pixels. White clothing is a region too. */
export function regionMeans(px, pal) {
  const sums = Array.from({ length: pal.length + 1 }, () => [0, 0, 0, 0]);
  for (const p of px) {
    const lab = rgb2lab(p[2], p[3], p[4]);
    const k = regionOf(p[2], p[3], p[4], pal, lab);
    if (k < 0) continue;
    const s = sums[k]; s[0] += lab[0]; s[1] += lab[1]; s[2] += lab[2]; s[3]++;
  }
  return sums.map((s) => (s[3] < 40 ? null : [s[0] / s[3], s[1] / s[3], s[2] / s[3]]));
}
export const clusterMeans = regionMeans;
