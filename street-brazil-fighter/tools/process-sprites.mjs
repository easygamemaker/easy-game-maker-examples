// Turns the raw 3x3 sprite sheets into trimmed atlases per character (PNG + frames JSON): <id> from sheets A+B
// (key poses) and <id>-anim from sheets C+D (walk, idle and attack animation frames). A missing raw sheet
// keeps the committed atlas untouched.
// Usage: node tools/process-sprites.mjs [--only id,id]
import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './fal.mjs';
import { CHARACTERS, POSES_A, POSES_B, POSES_C, POSES_D } from './prompts.mjs';
import { RAW, parseArgs } from './common.mjs';
import { extractSheet } from './lib/extract.mjs';

const args = parseArgs();
const cfg = JSON.parse(readFileSync(join(ROOT, 'tools', 'characters.json'), 'utf8'));
const OUT = join(ROOT, 'public', 'assets', 'fighters');
mkdirSync(OUT, { recursive: true });
const WORK = join(ROOT, 'art-src', 'work');
mkdirSync(WORK, { recursive: true });

/** Scales, anchors and shelf-packs frames, then writes <name>.png and <name>.json. */
async function writeAtlas(name, frames, scaleOf, conf, bodyHeight) {
  const scaled = [];
  const aliases = [];
  for (const f of frames) {
    const o = conf.frames?.[f.pose] ?? {};
    if (o.copyOf) { aliases.push([f.pose, o.copyOf]); continue; }
    const scale = scaleOf(f) * (o.scale ?? 1);
    const nw = Math.max(1, Math.round(f.w * scale)), nh = Math.max(1, Math.round(f.h * scale));
    const png = await sharp(f.buf, { raw: { width: f.w, height: f.h, channels: 4 } }).resize(nw, nh, { kernel: 'lanczos3' }).png().toBuffer();
    scaled.push({ pose: f.pose, png, w: nw, h: nh, anchorX: Math.round(f.anchorX * scale + (o.dx ?? 0)), anchorY: Math.round(f.anchorY * scale + (o.dy ?? 0)) });
  }
  const MAXW = 2048;
  let x = 0, y = 0, rowH = 0;
  const placed = [];
  for (const f of scaled) {
    if (x + f.w > MAXW) { x = 0; y += rowH + 2; rowH = 0; }
    placed.push({ ...f, x, y });
    x += f.w + 2;
    rowH = Math.max(rowH, f.h);
  }
  const atlasW = Math.max(...placed.map((p) => p.x + p.w));
  const atlasH = y + rowH;
  const sheetPng = await sharp({ create: { width: atlasW, height: atlasH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(placed.map((p) => ({ input: p.png, left: p.x, top: p.y })))
    .png({ palette: true, quality: 92, effort: 8, compressionLevel: 9 })
    .toBuffer();
  writeFileSync(join(OUT, `${name}.png`), sheetPng);
  const out = Object.fromEntries(placed.map((p) => [p.pose, { x: p.x, y: p.y, w: p.w, h: p.h, anchorX: p.anchorX, anchorY: p.anchorY }]));
  // frames flagged copyOf reuse the pixels of another frame (a sheet frame the model drew off-model)
  for (const [pose, src] of aliases) out[pose] = out[src];
  writeFileSync(join(OUT, `${name}.json`), JSON.stringify({ image: `${name}.png`, size: { w: atlasW, h: atlasH }, bodyHeight, frames: out }, null, 1) + '\n');
  console.log(`${name}: atlas ${atlasW}x${atlasH}, ${placed.length} frames + ${aliases.length} aliases, ${(sheetPng.length / 1024).toFixed(0)} KB`);
}

const take = async (file, poses, conf) => {
  const frames = await extractSheet(file, poses, conf.blobMergeGap, conf.padding, conf.holeFill);
  const missing = frames.filter((f) => f.missing).map((f) => f.pose);
  if (missing.length) throw new Error(`${file}: frames not found: ${missing.join(', ')}`);
  return frames;
};

for (const ch of CHARACTERS) {
  if (args.only.length && !args.only.includes(ch.id)) continue;
  const conf = { ...cfg.defaults, ...(cfg.characters[ch.id] ?? {}) };
  const a = join(RAW, `sprite-${ch.id}-a.png`), b = join(RAW, `sprite-${ch.id}-b.png`);
  if (existsSync(a) && existsSync(b)) {
    const fa = await take(a, POSES_A, conf);
    const fb = await take(b, POSES_B, conf);
    const scale = conf.bodyHeight / fa[0].contentH;
    await writeAtlas(ch.id, [...fa, ...fb], () => scale, conf, conf.bodyHeight);
  } else console.warn(`${ch.id}: raw sheets A/B missing, key-pose atlas kept as committed`);

  const c = join(RAW, `anim-${ch.id}-c.png`), d = join(RAW, `anim-${ch.id}-d.png`);
  if (existsSync(c) && existsSync(d)) {
    const fc = await take(c, POSES_C, { ...conf, holeFill: conf.holeFillC ?? conf.holeFill });
    const fd = await take(d, POSES_D, { ...conf, holeFill: conf.holeFillD ?? conf.holeFill });
    // Each sheet is normalised on its own reference frame so a model that drew the whole sheet a bit larger
    // or smaller than sheet A still gives the same on-screen body height. Per-frame `scale` multiplies on top.
    const refOf = (frames, pose) => frames.find((f) => f.pose === pose).contentH;
    const sc = conf.bodyHeight / refOf(fc, conf.scaleRefC ?? 'idle_0');
    const sd = conf.bodyHeight / refOf(fd, conf.scaleRefD ?? 'punch_2');
    await writeAtlas(`${ch.id}-anim`, [...fc, ...fd], (f) => (POSES_C.includes(f.pose) ? sc : sd), conf, conf.bodyHeight);
    console.log(`  ${ch.id}-anim scales: C ${sc.toFixed(3)}, D ${sd.toFixed(3)}`);
  }
}
