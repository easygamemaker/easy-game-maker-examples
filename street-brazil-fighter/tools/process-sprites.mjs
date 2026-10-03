// Turns the raw 3x3 sprite sheets into one trimmed atlas per character (PNG + frames JSON).
// Usage: node tools/process-sprites.mjs [--only id,id]
import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './fal.mjs';
import { CHARACTERS, POSES_A, POSES_B } from './prompts.mjs';
import { RAW, parseArgs } from './common.mjs';
import { floodBackground, matte, findBlobs } from './lib/matte.mjs';

const args = parseArgs();
const cfg = JSON.parse(readFileSync(join(ROOT, 'tools', 'characters.json'), 'utf8'));
const OUT = join(ROOT, 'public', 'assets', 'fighters');
mkdirSync(OUT, { recursive: true });
const WORK = join(ROOT, 'art-src', 'work');
mkdirSync(WORK, { recursive: true });

/** Splits one sheet into 9 frames: {pose, rgba, w, h, anchorX, anchorY} in sheet pixels. */
async function extractSheet(file, poses, gap, pad) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const bg = floodBackground(data, w, h);
  const rgba = matte(data, w, h, bg);
  const blobs = findBlobs(rgba, w, h, gap);
  const cw = w / 3, ch = h / 3;
  const cells = Array.from({ length: 9 }, () => []);
  for (const b of blobs) {
    const cx = (b.minX + b.maxX) / 2, cy = (b.minY + b.maxY) / 2;
    const col = Math.min(2, Math.max(0, Math.floor(cx / cw)));
    const row = Math.min(2, Math.max(0, Math.floor(cy / ch)));
    cells[row * 3 + col].push(b);
  }
  const frames = [];
  for (let i = 0; i < 9; i++) {
    const bs = cells[i];
    if (!bs.length) { frames.push({ pose: poses[i], missing: true }); continue; }
    const minX = Math.max(0, Math.min(...bs.map((b) => b.minX)) - pad);
    const minY = Math.max(0, Math.min(...bs.map((b) => b.minY)) - pad);
    const maxX = Math.min(w - 1, Math.max(...bs.map((b) => b.maxX)) + pad);
    const maxY = Math.min(h - 1, Math.max(...bs.map((b) => b.maxY)) + pad);
    const fw = maxX - minX + 1, fh = maxY - minY + 1;
    const buf = Buffer.alloc(fw * fh * 4);
    // copy only pixels belonging to this frame's blobs (others cells may overlap the bbox)
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const sx = minX + x, sy = minY + y;
        const s = (sy * w + sx) * 4, d = (y * fw + x) * 4;
        buf[d] = rgba[s]; buf[d + 1] = rgba[s + 1]; buf[d + 2] = rgba[s + 2]; buf[d + 3] = rgba[s + 3];
      }
    }
    // feet anchor: lowest opaque row, x centroid of the bottom 12% of the content
    let top = fh, bottom = -1;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (buf[(y * fw + x) * 4 + 3] > 40) { if (y < top) top = y; if (y > bottom) bottom = y; }
    const content = bottom - top + 1;
    const band = Math.max(4, Math.round(content * 0.12));
    let sumX = 0, cnt = 0;
    for (let y = bottom - band; y <= bottom; y++) for (let x = 0; x < fw; x++) if (buf[(y * fw + x) * 4 + 3] > 40) { sumX += x; cnt++; }
    frames.push({ pose: poses[i], buf, w: fw, h: fh, top, bottom, contentH: content, anchorX: cnt ? sumX / cnt : fw / 2, anchorY: bottom + 1 });
  }
  return frames;
}

for (const ch of CHARACTERS) {
  if (args.only.length && !args.only.includes(ch.id)) continue;
  const a = join(RAW, `sprite-${ch.id}-a.png`), b = join(RAW, `sprite-${ch.id}-b.png`);
  if (!existsSync(a) || !existsSync(b)) { console.warn(`skip ${ch.id}: raw sheets missing`); continue; }
  const conf = { ...cfg.defaults, ...(cfg.characters[ch.id] ?? {}) };
  const fa = await extractSheet(a, POSES_A, conf.blobMergeGap, conf.padding);
  const fb = await extractSheet(b, POSES_B, conf.blobMergeGap, conf.padding);
  const all = [...fa, ...fb];
  const missing = all.filter((f) => f.missing).map((f) => f.pose);
  if (missing.length) throw new Error(`${ch.id}: frames not found: ${missing.join(', ')}`);
  const idle = fa[0];
  const scale = conf.bodyHeight / idle.contentH;

  const scaled = [];
  for (const f of all) {
    const nw = Math.max(1, Math.round(f.w * scale)), nh = Math.max(1, Math.round(f.h * scale));
    const png = await sharp(f.buf, { raw: { width: f.w, height: f.h, channels: 4 } }).resize(nw, nh, { kernel: 'lanczos3' }).png().toBuffer();
    const o = conf.frames?.[f.pose] ?? {};
    scaled.push({ pose: f.pose, png, w: nw, h: nh, anchorX: Math.round(f.anchorX * scale + (o.dx ?? 0)), anchorY: Math.round(f.anchorY * scale + (o.dy ?? 0)) });
  }
  // shelf packing, rows up to 2048 wide
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
  writeFileSync(join(OUT, `${ch.id}.png`), sheetPng);
  const frames = Object.fromEntries(placed.map((p) => [p.pose, { x: p.x, y: p.y, w: p.w, h: p.h, anchorX: p.anchorX, anchorY: p.anchorY }]));
  writeFileSync(join(OUT, `${ch.id}.json`), JSON.stringify({ image: `${ch.id}.png`, size: { w: atlasW, h: atlasH }, bodyHeight: conf.bodyHeight, frames }, null, 1) + '\n');
  console.log(`${ch.id}: scale ${scale.toFixed(3)}, atlas ${atlasW}x${atlasH}, ${(sheetPng.length / 1024).toFixed(0)} KB`);
}
