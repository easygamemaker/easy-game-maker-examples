// Post-processing of the fighter atlases, no image model involved. Reads the BASE atlases (art-src/atlas-base,
// written by process-sprites.mjs) and writes the shipped ones (public/assets/fighters), applying the per-frame
// settings of tools/characters.json > post:
//   copyOf        reuse the pixels of another frame (a frame the model drew off-model)
//   scale         resize the frame about its feet anchor (stable body measurement, see consistency.mjs)
//   dx, dy        shift the draw anchor in atlas pixels (positive dx draws the sprite further left)
//   color         false to skip the colour match of that frame
// Colour match: the reference idle's palette is clustered in CIE Lab (5 clusters); in every other frame the
// pixels near each cluster are moved towards the reference mean of that cluster, by `strength`, with a weight that
// fades with the distance to the cluster. White clothing and highlights are protected.
// Idempotent: the base atlas is never modified. Usage: node tools/post-atlas.mjs [--only tiao,saci]
import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './fal.mjs';
import { loadAtlas } from './lib/atlas.mjs';
import { dE, lab2rgb, rgb2lab } from './lib/color.mjs';
import { palette, pixelsOf, regionMeans, regionOf } from './lib/palette.mjs';

const argv = process.argv.slice(2);
const only = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',') : [];
const BASE = join(ROOT, 'art-src', 'atlas-base');
const OUT = join(ROOT, 'public', 'assets', 'fighters');
const cfg = JSON.parse(readFileSync(join(ROOT, 'tools', 'characters.json'), 'utf8'));
mkdirSync(OUT, { recursive: true });
const IDS = ['tiao', 'dalva', 'saci', 'curupira', 'craque', 'rosa'];

const isWhiteish = (L, a, b) => L > 84 && Math.hypot(a, b) < 14;

function colorMatch(fr, pal, refMeans, strength, minDE) {
  const px = pixelsOf(fr);
  const means = regionMeans(px, pal);
  const deltas = means.map((m, k) => (m && refMeans[k] && dE(m, refMeans[k]) >= minDE ? refMeans[k].map((v, i) => v - m[i]) : null));
  if (!deltas.some(Boolean)) return { data: fr.data, changed: 0 };
  const out = Buffer.from(fr.data);
  let changed = 0;
  for (let i = 0; i < fr.w * fr.h; i++) {
    const o = i * 4;
    if (out[o + 3] < 8) continue;
    const lab = rgb2lab(out[o], out[o + 1], out[o + 2]);
    const k = regionOf(out[o], out[o + 1], out[o + 2], pal, lab);
    if (k < 0 || !deltas[k] || isWhiteish(...lab)) continue; // outline, effects and white clothing stay
    const guard = lab[0] > 80 ? Math.max(0, 1 - (lab[0] - 80) / 20) : 1; // highlights fade out of the shift
    const g = strength * guard;
    const rgb = lab2rgb(lab[0] + deltas[k][0] * g, lab[1] + deltas[k][1] * g, lab[2] + deltas[k][2] * g);
    out[o] = rgb[0]; out[o + 1] = rgb[1]; out[o + 2] = rgb[2];
    changed++;
  }
  return { data: out, changed };
}

async function writeAtlas(name, frames, json) {
  const MAXW = 2048;
  let x = 0, y = 0, rowH = 0;
  const placed = [];
  for (const f of frames) {
    if (f.alias) continue;
    if (x + f.w > MAXW) { x = 0; y += rowH + 2; rowH = 0; }
    placed.push({ ...f, x, y });
    x += f.w + 2;
    rowH = Math.max(rowH, f.h);
  }
  const W = Math.max(...placed.map((p) => p.x + p.w)), H = y + rowH;
  const comps = [];
  for (const p of placed) comps.push({ input: await sharp(p.data, { raw: { width: p.w, height: p.h, channels: 4 } }).png().toBuffer(), left: p.x, top: p.y });
  const png = await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(comps).png({ palette: true, quality: 92, effort: 8, compressionLevel: 9 }).toBuffer();
  writeFileSync(join(OUT, `${name}.png`), png);
  const out = Object.fromEntries(placed.map((p) => [p.pose, { x: p.x, y: p.y, w: p.w, h: p.h, anchorX: p.anchorX, anchorY: p.anchorY }]));
  for (const f of frames) if (f.alias) out[f.pose] = out[f.alias];
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify({ image: `${name}.png`, size: { w: W, h: H }, bodyHeight: json.bodyHeight, frames: out }, null, 1) + '\n');
  console.log(`${name}: ${placed.length} frames + ${frames.filter((f) => f.alias).length} aliases, ${(png.length / 1024).toFixed(0)} KB`);
}

for (const id of IDS) {
  if (only.length && !only.includes(id)) continue;
  const post = cfg.post?.[id] ?? {};
  const strength = post.colorStrength ?? 0.8, minDE = post.colorMinDE ?? 3.5;
  const animBase = await loadAtlas(BASE, `${id}-anim`);
  const refFrame = animBase.frames.get('idle_0');
  const refPx = pixelsOf(refFrame);
  const pal = palette(refPx);
  const refMeans = regionMeans(refPx, pal);
  for (const name of [id, `${id}-anim`]) {
    const atlas = await loadAtlas(BASE, name);
    const frames = [];
    const seenData = new Map();
    for (const [pose, fr] of atlas.frames) {
      const o = { ...(cfg.post?.defaults?.frames?.[pose] ?? {}), ...(post.frames?.[pose] ?? {}) };
      const key = `${fr.x},${fr.y}`;
      if (o.copyOf) { frames.push({ pose, alias: o.copyOf }); continue; }
      // frames that share pixels in the base (aliases of process-sprites) stay aliases
      if (seenData.has(key)) { frames.push({ pose, alias: seenData.get(key) }); continue; }
      seenData.set(key, pose);
      let data = fr.data, w = fr.w, h = fr.h, ax = fr.anchorX, ay = fr.anchorY;
      if (o.color !== false && pose !== 'fx') data = colorMatch(fr, pal, refMeans, strength, minDE).data;
      if (o.scale && o.scale !== 1) {
        w = Math.max(1, Math.round(fr.w * o.scale)); h = Math.max(1, Math.round(fr.h * o.scale));
        data = await sharp(data, { raw: { width: fr.w, height: fr.h, channels: 4 } }).resize(w, h, { kernel: 'lanczos3' }).raw().toBuffer();
        ax = Math.round(fr.anchorX * o.scale); ay = Math.round(fr.anchorY * o.scale);
      }
      frames.push({ pose, data, w, h, anchorX: ax + (o.dx ?? 0), anchorY: ay + (o.dy ?? 0) });
    }
    // an alias must point at a real frame (resolve chains)
    const real = new Set(frames.filter((f) => !f.alias).map((f) => f.pose));
    for (const f of frames) if (f.alias && !real.has(f.alias)) f.alias = frames.find((g) => g.pose === f.alias)?.alias ?? f.alias;
    await writeAtlas(name, frames, atlas.json);
  }
}
