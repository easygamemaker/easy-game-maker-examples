// Draws chosen atlas frames side by side on a neutral grey (feet aligned) with labels: used to eyeball consistency.
import sharp from 'sharp';
import { loadAtlas } from './atlas.mjs';

/** items: [{ dir, atlas, pose }]. Returns a PNG buffer. Frames are drawn at `zoom` times their atlas size. */
export async function strip(items, { zoom = 1, bg = '#6b7280', pad = 10 } = {}) {
  const cache = new Map();
  const cells = [];
  for (const it of items) {
    const k = `${it.dir}/${it.atlas}`;
    if (!cache.has(k)) cache.set(k, await loadAtlas(it.dir, it.atlas));
    const fr = cache.get(k).frames.get(it.pose);
    if (!fr) throw new Error(`no frame ${it.pose} in ${it.atlas}`);
    const png = await sharp(fr.data, { raw: { width: fr.w, height: fr.h, channels: 4 } }).resize(Math.round(fr.w * zoom), Math.round(fr.h * zoom)).png().toBuffer();
    cells.push({ png, w: Math.round(fr.w * zoom), h: Math.round(fr.h * zoom), ax: fr.anchorX * zoom, ay: fr.anchorY * zoom, label: it.label ?? it.pose });
  }
  const left = Math.max(...cells.map((c) => c.ax)), right = Math.max(...cells.map((c) => c.w - c.ax));
  const up = Math.max(...cells.map((c) => c.ay)), down = Math.max(...cells.map((c) => c.h - c.ay));
  const cw = Math.ceil(left + right + pad * 2), ch = Math.ceil(up + down + pad * 2 + 22);
  const comps = [];
  const labels = cells.map((c, i) => `<text x="${i * cw + 6}" y="16" font-family="Helvetica" font-size="14" fill="#fff">${c.label.replace(/&/g, '&amp;')}</text>`).join('');
  cells.forEach((c, i) => comps.push({ input: c.png, left: Math.round(i * cw + pad + left - c.ax), top: Math.round(22 + pad + up - c.ay) }));
  comps.push({ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${cw * cells.length}" height="${ch}">${labels}</svg>`), left: 0, top: 0 });
  return sharp({ create: { width: cw * cells.length, height: ch, channels: 3, background: bg } }).composite(comps).png().toBuffer();
}
