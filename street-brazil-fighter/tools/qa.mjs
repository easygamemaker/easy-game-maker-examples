// QA for the processed art: contact sheets in art-src/qa and automatic checks with a pass/fail table.
// Usage: node tools/qa.mjs [--only id,id]   (exit code 1 when any check fails)
import sharp from 'sharp';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './fal.mjs';
import { CHARACTERS, STAGES, POSES_A, POSES_B } from './prompts.mjs';
import { RAW, parseArgs } from './common.mjs';
import { floodBackground, findBlobs, matte } from './lib/matte.mjs';

const args = parseArgs();
const QA = join(ROOT, 'art-src', 'qa');
mkdirSync(QA, { recursive: true });
const ALL = [...POSES_A, ...POSES_B];
const STANDING = ['idle', 'walk', 'punch', 'kick', 'block', 'hit', 'punch_windup', 'kick_windup', 'victory', 'special_charge'];
const rows = [];
const check = (scope, name, ok, detail = '') => rows.push({ scope, name, ok, detail });

async function checkRaw(ch, sheet) {
  const file = join(RAW, `sprite-${ch.id}-${sheet}.png`);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const rgba = matte(data, w, h, floodBackground(data, w, h));
  const blobs = findBlobs(rgba, w, h, 14);
  const cw = w / 3, ch3 = h / 3;
  const cell = Array.from({ length: 9 }, () => null);
  for (const b of blobs) {
    const i = Math.min(2, Math.floor(((b.minY + b.maxY) / 2) / ch3)) * 3 + Math.min(2, Math.floor(((b.minX + b.maxX) / 2) / cw));
    const c = cell[i];
    cell[i] = c ? { minX: Math.min(c.minX, b.minX), minY: Math.min(c.minY, b.minY), maxX: Math.max(c.maxX, b.maxX), maxY: Math.max(c.maxY, b.maxY) } : { ...b };
  }
  const scope = `${ch.id}/${sheet.toUpperCase()}`;
  check(scope, 'exactly 9 frames', cell.every(Boolean) && blobs.length >= 9, `${cell.filter(Boolean).length} cells filled, ${blobs.length} blobs`);
  const boxes = cell.filter(Boolean);
  const margin = Math.min(...boxes.map((b) => Math.min(b.minX, b.minY, w - 1 - b.maxX, h - 1 - b.maxY)));
  check(scope, 'edge margin >= 2 px (nothing clipped)', margin >= 2, `min margin ${margin}px`);
  let touching = 0;
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY) touching++;
  }
  check(scope, 'frames do not touch', touching === 0, `${touching} overlapping pairs`);
}

async function checkAtlas(ch) {
  const jsonPath = join(ROOT, 'public', 'assets', 'fighters', `${ch.id}.json`);
  const pngPath = join(ROOT, 'public', 'assets', 'fighters', `${ch.id}.png`);
  const scope = `${ch.id}/atlas`;
  const atlas = JSON.parse(readFileSync(jsonPath, 'utf8'));
  check(scope, '18 named frames', ALL.every((p) => atlas.frames[p]), `${Object.keys(atlas.frames).length} frames`);
  const { data, info } = await sharp(pngPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  check(scope, 'json size matches png', info.width === atlas.size.w && info.height === atlas.size.h, `${info.width}x${info.height}`);
  // edge alpha cleanliness: opaque pixels next to transparent ones must not be near white
  let edge = 0, white = 0;
  for (const f of Object.values(atlas.frames)) {
    for (let y = f.y + 1; y < f.y + f.h - 1; y++) for (let x = f.x + 1; x < f.x + f.w - 1; x++) {
      const i = (y * info.width + x) * 4;
      if (data[i + 3] < 200) continue;
      const nbs = [i - 4, i + 4, i - info.width * 4, i + info.width * 4];
      if (!nbs.some((n) => data[n + 3] < 20)) continue;
      edge++;
      if (Math.min(data[i], data[i + 1], data[i + 2]) > 235) white++;
    }
  }
  check(scope, 'no near-white opaque edge pixels', white / Math.max(1, edge) < 0.005, `${white}/${edge} (${((100 * white) / Math.max(1, edge)).toFixed(2)}%)`);
  const idleH = atlas.frames.idle.h;
  const off = STANDING.filter((p) => { const r = atlas.frames[p].h / idleH; return r < 0.6 || r > 1.45; });
  check(scope, 'consistent scale (standing poses)', off.length === 0, off.length ? `out of range: ${off.join(',')}` : 'ok');
  const grounded = ['idle', 'walk', 'punch', 'kick', 'block', 'hit'].filter((p) => Math.abs(atlas.frames[p].anchorY - atlas.frames[p].h) > 14);
  check(scope, 'feet at frame bottom', grounded.length === 0, grounded.join(',') || 'ok');
  const kb = statSync(pngPath).size / 1024;
  check(scope, 'atlas size < 3 MB', kb < 3072, `${kb.toFixed(0)} KB`);

  // contact sheet
  const CW = 340, CH = 470, COLS = 6;
  const comps = [];
  const pad = 12, ground = CH - 60;
  const names = Object.keys(atlas.frames);
  for (let i = 0; i < names.length; i++) {
    const f = atlas.frames[names[i]];
    const ox = (i % COLS) * CW, oy = Math.floor(i / COLS) * CH;
    const scale = Math.min(1, (CW - 2 * pad) / f.w, (ground - 40) / f.h);
    const crop = await sharp(pngPath).extract({ left: f.x, top: f.y, width: f.w, height: f.h }).resize(Math.round(f.w * scale), Math.round(f.h * scale)).png().toBuffer();
    const left = Math.round(ox + CW / 2 - f.anchorX * scale);
    const top = Math.round(oy + ground - f.anchorY * scale);
    comps.push({ input: crop, left: Math.max(ox, left), top: Math.max(oy, top) });
    const svg = `<svg width="${CW}" height="${CH}" xmlns="http://www.w3.org/2000/svg"><rect width="${CW}" height="${CH}" fill="none" stroke="#555"/><line x1="0" y1="${ground}" x2="${CW}" y2="${ground}" stroke="#ff3355" stroke-width="2"/><line x1="${CW / 2}" y1="${ground - 20}" x2="${CW / 2}" y2="${ground + 20}" stroke="#33ddff" stroke-width="2"/><text x="8" y="22" font-size="18" fill="#fff" font-family="Helvetica, Arial">${names[i]}</text></svg>`;
    comps.push({ input: Buffer.from(svg), left: ox, top: oy });
  }
  const W = CW * COLS, H = CH * Math.ceil(names.length / COLS);
  await sharp({ create: { width: W, height: H, channels: 4, background: '#3b3f4a' } }).composite(comps).png().toFile(join(QA, `${ch.id}.png`));
}

for (const ch of CHARACTERS) {
  if (args.only.length && !args.only.includes(ch.id)) continue;
  const a = join(RAW, `sprite-${ch.id}-a.png`);
  if (!existsSync(a) || !existsSync(join(RAW, `sprite-${ch.id}-b.png`))) { check(ch.id, 'raw sheets present', false, 'not generated'); continue; }
  await checkRaw(ch, 'a');
  await checkRaw(ch, 'b');
  if (existsSync(join(ROOT, 'public', 'assets', 'fighters', `${ch.id}.json`))) await checkAtlas(ch);
  else check(ch.id, 'atlas processed', false, 'run process-sprites');
}
for (const s of STAGES) {
  if (args.only.length && !args.only.includes(s.id)) continue;
  const p = join(ROOT, 'public', 'assets', 'stages', `${s.id}.webp`);
  if (!existsSync(p)) { check(`stage/${s.id}`, 'image present', false, 'not generated'); continue; }
  const m = await sharp(p).metadata();
  check(`stage/${s.id}`, '2600x1400 webp', m.width === 2600 && m.height === 1400 && m.format === 'webp', `${m.width}x${m.height} ${m.format}`);
  const kb = statSync(p).size / 1024;
  check(`stage/${s.id}`, 'size < 1.5 MB', kb < 1536, `${kb.toFixed(0)} KB`);
  check(`stage/${s.id}`, 'thumbnail 650x350', existsSync(join(ROOT, 'public', 'assets', 'stages', `${s.id}-thumb.webp`)), '');
}

console.log('\nscope'.padEnd(22) + 'check'.padEnd(40) + 'result'.padEnd(7) + 'detail');
for (const r of rows) console.log(r.scope.padEnd(21) + ' ' + r.name.padEnd(39) + (r.ok ? 'PASS  ' : 'FAIL  ') + ' ' + r.detail);
const failed = rows.filter((r) => !r.ok).length;
console.log(`\n${rows.length - failed}/${rows.length} checks passed`);
process.exit(failed ? 1 : 0);
