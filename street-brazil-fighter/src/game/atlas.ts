export interface AtlasFrame {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly anchorX: number;
  readonly anchorY: number;
}

export interface AtlasData {
  readonly image: string;
  readonly size: { readonly w: number; readonly h: number };
  readonly bodyHeight: number;
  readonly frames: Readonly<Record<string, AtlasFrame>>;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** Validates an atlas JSON loaded from disk. Throws a readable error on any problem. */
export function parseAtlas(raw: unknown): AtlasData {
  if (!raw || typeof raw !== 'object') throw new Error('atlas: not an object');
  const r = raw as Record<string, unknown>;
  const size = r['size'] as { w?: unknown; h?: unknown } | undefined;
  if (typeof r['image'] !== 'string') throw new Error('atlas: missing image');
  if (!size || !isNum(size.w) || !isNum(size.h)) throw new Error('atlas: missing size');
  if (!isNum(r['bodyHeight'])) throw new Error('atlas: missing bodyHeight');
  const frames = r['frames'] as Record<string, Record<string, unknown>> | undefined;
  if (!frames || typeof frames !== 'object') throw new Error('atlas: missing frames');
  const out: Record<string, AtlasFrame> = {};
  for (const [name, f] of Object.entries(frames)) {
    const { x, y, w, h, anchorX, anchorY } = f as Record<string, unknown>;
    if (![x, y, w, h, anchorX, anchorY].every(isNum)) throw new Error(`atlas: bad frame ${name}`);
    const fr = { x, y, w, h, anchorX, anchorY } as AtlasFrame;
    if (fr.x < 0 || fr.y < 0 || fr.x + fr.w > size.w || fr.y + fr.h > size.h) {
      throw new Error(`atlas: frame ${name} is outside the image`);
    }
    out[name] = fr;
  }
  return { image: r['image'], size: { w: size.w, h: size.h }, bodyHeight: r['bodyHeight'], frames: out };
}
