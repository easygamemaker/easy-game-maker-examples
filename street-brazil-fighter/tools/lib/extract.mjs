// Splits a generated 3x3 sprite sheet into trimmed, matted frames with feet anchors.
import sharp from 'sharp';
import { floodBackground, fillEnclosedWhite, matte, findBlobs } from './matte.mjs';

/** Splits one sheet into 9 frames: {pose, rgba, w, h, anchorX, anchorY} in sheet pixels. */
export async function extractSheet(file, poses, gap, pad, holeFill) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const bg = floodBackground(data, w, h);
  if (holeFill) fillEnclosedWhite(data, w, h, bg);
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

