// One contact strip per fighter with every animation frame of the clips the game plays (idle, walk, punch, kick, special),
// feet aligned, from the shipped atlases. Usage: node tools/clip-strips.mjs [--dir public/assets/fighters] [--out art-src/work/strips] [--only tiao]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { ROOT } from './fal.mjs';
import { strip } from './lib/strip.mjs';

const argv = process.argv.slice(2);
const val = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const dir = join(ROOT, val('--dir', 'public/assets/fighters'));
const out = join(ROOT, val('--out', 'art-src/work/strips'));
const only = val('--only', '').split(',').filter(Boolean);
mkdirSync(out, { recursive: true });
const CLIPS = [['idle', 3], ['walk', 6], ['punch', 3], ['kick', 3], ['special', 3]];
for (const id of ['tiao', 'dalva', 'saci', 'curupira', 'craque', 'rosa']) {
  if (only.length && !only.includes(id)) continue;
  const rows = [];
  for (const [clip, n] of CLIPS) {
    const items = Array.from({ length: n }, (_, i) => ({ dir, atlas: `${id}-anim`, pose: `${clip}_${i}`, label: `${clip}_${i}` }));
    rows.push(await strip(items, { zoom: 0.5 }));
  }
  const metas = await Promise.all(rows.map((r) => sharp(r).metadata()));
  const W = Math.max(...metas.map((m) => m.width)), H = metas.reduce((a, m) => a + m.height, 0);
  let y = 0;
  const comps = rows.map((r, i) => { const c = { input: r, left: 0, top: y }; y += metas[i].height; return c; });
  const png = await sharp({ create: { width: W, height: H, channels: 3, background: '#6b7280' } }).composite(comps).png().toBuffer();
  writeFileSync(join(out, `${id}.png`), png);
  console.log(`${id}: ${W}x${H}`);
}
