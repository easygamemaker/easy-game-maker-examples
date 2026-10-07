import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Loads an atlas (json + png) and returns { json, frames: Map(name -> {w,h,anchorX,anchorY,data(RGBA)}) }. */
export async function loadAtlas(dir, name) {
  const json = JSON.parse(readFileSync(join(dir, `${name}.json`), 'utf8'));
  const { data, info } = await sharp(join(dir, json.image)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const frames = new Map();
  for (const [pose, fr] of Object.entries(json.frames)) {
    const buf = Buffer.alloc(fr.w * fr.h * 4);
    for (let y = 0; y < fr.h; y++) data.copy(buf, y * fr.w * 4, ((fr.y + y) * info.width + fr.x) * 4, ((fr.y + y) * info.width + fr.x + fr.w) * 4);
    frames.set(pose, { ...fr, pose, data: buf });
  }
  return { json, frames };
}
