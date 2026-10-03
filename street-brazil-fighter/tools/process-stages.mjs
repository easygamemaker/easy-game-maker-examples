// Center-crops each raw stage image to exactly 13:7, resizes to 2600x1400 and writes WebP + a 650x350 thumbnail.
// Usage: node tools/process-stages.mjs [--only id,id]
import sharp from 'sharp';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './fal.mjs';
import { STAGES } from './prompts.mjs';
import { RAW, parseArgs } from './common.mjs';

const args = parseArgs();
const OUT = join(ROOT, 'public', 'assets', 'stages');
mkdirSync(OUT, { recursive: true });
const W = 2600, H = 1400;

for (const stage of STAGES) {
  if (args.only.length && !args.only.includes(stage.id)) continue;
  const src = join(RAW, `stage-${stage.id}.png`);
  if (!existsSync(src)) { console.warn(`skip ${stage.id}: no raw image`); continue; }
  const meta = await sharp(src).metadata();
  const cropH = Math.min(meta.height, Math.round((meta.width * 7) / 13));
  const cropW = Math.min(meta.width, Math.round((cropH * 13) / 7));
  const left = Math.floor((meta.width - cropW) / 2);
  const top = Math.floor((meta.height - cropH) / 2);
  const base = sharp(src).extract({ left, top, width: cropW, height: cropH });
  await base.clone().resize(W, H, { fit: 'fill' }).webp({ quality: 85 }).toFile(join(OUT, `${stage.id}.webp`));
  await base.clone().resize(650, 350, { fit: 'fill' }).webp({ quality: 80 }).toFile(join(OUT, `${stage.id}-thumb.webp`));
  console.log(`${stage.id}: ${meta.width}x${meta.height} -> crop ${cropW}x${cropH} -> ${W}x${H}`);
}
