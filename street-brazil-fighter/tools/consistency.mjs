// Objective consistency report: for every fighter and frame, compares body height, head width, skin colour and
// the colour of the main clothing regions (CIE Lab) against the fighter's idle_0 reference.
// Usage: node tools/consistency.mjs [--dir public/assets/fighters] [--only tiao,saci] [--json out.json]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './fal.mjs';
import { loadAtlas } from './lib/atlas.mjs';
import { dE, isSkin, rgb2lab } from './lib/color.mjs';
import { mean, palette, pixelsOf, regionMeans } from './lib/palette.mjs';

const argv = process.argv.slice(2);
const val = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const DIR = join(ROOT, val('--dir', 'public/assets/fighters'));
const only = val('--only', '')?.split(',').filter(Boolean);
const IDS = ['tiao', 'dalva', 'saci', 'curupira', 'craque', 'rosa'];
export const THRESH = { height: 0.06, head: 0.12, skin: 6, cloth: 9, torso: 0.3 };
/** Frames whose body is upright, so height and head width are comparable with the idle reference. */
const UPRIGHT = /^(idle|walk|punch_[02]|kick_[02]|special_[02])/;

const pixels = pixelsOf;

/** Measures one frame. `bandPx` is the fixed head band height (a fraction of the reference body height, in px). */
function measure(fr, bandPx) {
  const px = pixels(fr);
  let top = Infinity, bottom = -1;
  for (const p of px) { if (p[1] < top) top = p[1]; if (p[1] > bottom) bottom = p[1]; }
  const height = bottom - top + 1;
  const band = px.filter((p) => p[1] < top + bandPx);
  const skinBand = band.filter((p) => isSkin(p[2], p[3], p[4]));
  // head width: median width of the horizontal run that contains the top centre, over the band rows 25..95%,
  // so a raised fist or a swinging arm beside the head does not count
  const topRows = px.filter((p) => p[1] < top + 3);
  const x0 = topRows.length ? Math.round(topRows.reduce((a, p) => a + p[0], 0) / topRows.length) : 0;
  const filled = new Set(px.filter((p) => p[1] < top + bandPx).map((p) => p[1] * 100000 + p[0]));
  const widths = [];
  for (let y = Math.round(top + bandPx * 0.25); y < top + bandPx * 0.95; y++) {
    if (!filled.has(y * 100000 + x0)) continue;
    let l = x0, r = x0;
    while (filled.has(y * 100000 + l - 1)) l--;
    while (filled.has(y * 100000 + r + 1)) r++;
    widths.push(r - l + 1);
  }
  widths.sort((a, b) => a - b);
  const head = widths.length ? widths[Math.floor(widths.length / 2)] : 0;
  const skin = skinBand.length > 30 ? mean(skinBand.map((p) => rgb2lab(p[2], p[3], p[4]))) : null;
  // whole body skin tone (every warm pixel) and torso width (median row width at 38..52% of the body height)
  const warm = px.filter((p) => isSkin(p[2], p[3], p[4]));
  const skinAll = warm.length > 200 ? mean(warm.map((p) => rgb2lab(p[2], p[3], p[4]))) : null;
  const rowW = [];
  for (let y = Math.round(top + height * 0.38); y < top + height * 0.52; y++) {
    const xs = px.filter((p) => p[1] === y).map((p) => p[0]);
    if (xs.length) rowW.push(Math.max(...xs) - Math.min(...xs) + 1);
  }
  rowW.sort((a, b) => a - b);
  const torso = rowW.length ? rowW[Math.floor(rowW.length / 2)] : 0;
  return { px, height, head, skin, skinAll, torso };
}

function clothDeviation(px, pal, refMeans) {
  let worst = 0, which = -1;
  regionMeans(px, pal).forEach((m, k) => {
    if (!m || !refMeans[k]) return;
    const d = dE(m, refMeans[k]);
    if (d > worst) { worst = d; which = k; }
  });
  return { worst, which };
}

function skinRegion(px, refPx, pal) {
  const a = regionMeans(px, pal)[0], b = regionMeans(refPx, pal)[0];
  return a && b ? dE(a, b) : null;
}
const rows = [];
for (const id of IDS) {
  if (only.length && !only.includes(id)) continue;
  const key = await loadAtlas(DIR, id);
  const anim = await loadAtlas(DIR, `${id}-anim`);
  // every frame is compared with the fighter's animation idle_0 (the key pose atlas is a different generation, so its drift shows too)
  const sets = [
    { name: 'anim', atlas: anim, ref: anim.frames.get('idle_0') },
    { name: 'key', atlas: key, ref: anim.frames.get('idle_0') },
  ];
  const animRef = measure(anim.frames.get('idle_0'), 0);
  const bandPx = (animRef.height || 400) * 0.2;
  const refAnim = measure(anim.frames.get('idle_0'), bandPx);
  const pal = palette(refAnim.px);
  for (const set of sets) {
    const rm = measure(set.ref, bandPx);
    const refMeans = regionMeans(rm.px, pal);
    for (const fr of set.atlas.frames.values()) {
      if (fr.pose === 'fx' || (set.name === 'anim' && fr.pose === 'idle_0')) continue;
      const m = measure(fr, bandPx);
      const upright = UPRIGHT.test(fr.pose) || ['idle', 'walk', 'punch', 'kick', 'block', 'hit', 'victory'].includes(fr.pose);
      const h = upright ? m.height / rm.height - 1 : null;
      const hd = upright && m.head && rm.head ? m.head / rm.head - 1 : null;
      const skFace = m.skin && rm.skin ? dE(m.skin, rm.skin) : null;
      const skBody = m.skinAll && rm.skinAll ? dE(m.skinAll, rm.skinAll) : null;
      const sk = skinRegion(m.px, rm.px, pal);
      const tw = upright && rm.torso && m.torso ? m.torso / m.height / (rm.torso / rm.height) - 1 : null;
      const cl = clothDeviation(m.px, pal, refMeans);
      const flags = [];
      if (h !== null && Math.abs(h) > THRESH.height) flags.push('height');
      if (hd !== null && Math.abs(hd) > THRESH.head) flags.push('head');
      if (sk !== null && sk > THRESH.skin) flags.push('skin');
      if (cl.worst > THRESH.cloth) flags.push('cloth');
      if (tw !== null && Math.abs(tw) > THRESH.torso) flags.push('torso');
      rows.push({ id, frame: fr.pose, atlas: set.name, heightDev: h, headDev: hd, skinDE: sk, torsoDev: tw, clothDE: cl.worst, skinLab: m.skin, flags });
    }
  }
  // cross-atlas check: the animated idle against the key pose idle
  const ka = measure(key.frames.get('idle'), bandPx);
  const aa = measure(anim.frames.get('idle_0'), bandPx);
  rows.push({ id, frame: 'ANIM idle_0 vs KEY idle', atlas: 'cross', heightDev: aa.height / ka.height - 1, headDev: ka.head ? aa.head / ka.head - 1 : null, skinDE: ka.skin && aa.skin ? dE(ka.skin, aa.skin) : null, clothDE: 0, flags: [] });
}
const pct = (v) => (v === null ? '   -  ' : `${(v * 100).toFixed(1).padStart(5)}%`);
const num = (v) => (v === null ? '  - ' : v.toFixed(1).padStart(5));
console.log('fighter   frame            height   head    skinDE torso  clothDE flags');
for (const r of rows) console.log(`${r.id.padEnd(9)} ${(r.atlas[0]+' '+r.frame).padEnd(18)} ${pct(r.heightDev)} ${pct(r.headDev)} ${num(r.skinDE)} ${pct(r.torsoDev ?? null)} ${num(r.clothDE)}   ${r.flags.join(',')}`);
const out = rows.filter((r) => r.flags.length);
console.log(`\n${rows.length} frames, ${out.length} outliers (height>${THRESH.height * 100}%, head>${THRESH.head * 100}%, skin dE>${THRESH.skin}, cloth dE>${THRESH.cloth})`);
for (const id of IDS) { const n = out.filter((r) => r.id === id).length; if (!only.length || only.includes(id)) console.log(`  ${id}: ${n}`); }
if (val('--json', null)) { mkdirSync(join(ROOT, 'art-src', 'work'), { recursive: true }); writeFileSync(join(ROOT, val('--json')), JSON.stringify(rows, null, 1)); }
