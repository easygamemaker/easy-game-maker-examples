// Rebuilds a 3x3 reference sheet on a white background from the committed atlas of a character.
// The raw generated sheets are not kept in git, so edit jobs use this as their reference image.
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../fal.mjs';

const SIZE = 2048;
const CELL = SIZE / 3;
const FIT = CELL - 60;

/** poses: 9 frame names of the atlas, in reading order. Returns the PNG path. */
export async function buildRefSheet(id, poses, outName) {
  const dir = join(ROOT, 'art-src', 'atlas-base');
  const atlas = JSON.parse(readFileSync(join(dir, `${id}.json`), 'utf8'));
  const img = sharp(join(dir, `${id}.png`));
  const comps = [];
  for (let i = 0; i < 9; i++) {
    const f = atlas.frames[poses[i]];
    if (!f) throw new Error(`atlas ${id} has no frame ${poses[i]}`);
    const crop = await img.clone().extract({ left: f.x, top: f.y, width: f.w, height: f.h }).png().toBuffer();
    const s = Math.min(1, FIT / f.w, FIT / f.h);
    const w = Math.round(f.w * s), h = Math.round(f.h * s);
    const buf = s < 1 ? await sharp(crop).resize(w, h).png().toBuffer() : crop;
    const col = i % 3, row = Math.floor(i / 3);
    const left = Math.round(col * CELL + (CELL - w) / 2);
    const top = Math.round(row * CELL + CELL - 40 - h);
    comps.push({ input: buf, left, top });
  }
  const dest = join(ROOT, 'art-src', 'work');
  mkdirSync(dest, { recursive: true });
  const out = join(dest, outName);
  await sharp({ create: { width: SIZE, height: SIZE, channels: 3, background: '#ffffff' } }).composite(comps).png().toFile(out);
  return out;
}
