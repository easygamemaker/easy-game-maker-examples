import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHARACTERS, MOVE_KEYS, POSE_IDS } from '../../data/characters';
import { STAGES } from '../../data/stages';
import { ATTACK_CLIP_PREFIX, IDLE_CLIP, WALK_CLIP } from '../../game/animation';
import { ANIMATED_FIGHTERS } from '../../game/assets';
import { SOUND_IDS } from '../../audio/catalog';
import { parseAtlas } from '../../game/atlas';

const PUBLIC = join(__dirname, '..', '..', '..', 'public', 'assets');
const MB = 1024 * 1024;

function pngSize(file: string): { w: number; h: number } {
  const b = readFileSync(file);
  expect(b.subarray(1, 4).toString('latin1')).toBe('PNG');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

function webpSize(file: string): { w: number; h: number } {
  const b = readFileSync(file);
  expect(b.subarray(0, 4).toString('latin1')).toBe('RIFF');
  expect(b.subarray(8, 12).toString('latin1')).toBe('WEBP');
  const kind = b.subarray(12, 16).toString('latin1');
  if (kind === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
  if (kind === 'VP8X') return { w: b.readUIntLE(24, 3) + 1, h: b.readUIntLE(27, 3) + 1 };
  const bits = b.readUInt32LE(21);
  return { w: (bits & 0x3fff) + 1, h: ((bits >> 14) & 0x3fff) + 1 };
}

function totalBytes(dir: string): number {
  return readdirSync(dir, { withFileTypes: true }).reduce(
    (sum, e) => sum + (e.isDirectory() ? totalBytes(join(dir, e.name)) : statSync(join(dir, e.name)).size),
    0,
  );
}

describe('fighter atlases', () => {
  for (const c of CHARACTERS) {
    describe(c.id, () => {
      const jsonPath = join(PUBLIC, 'fighters', `${c.id}.json`);
      const pngPath = join(PUBLIC, 'fighters', `${c.id}.png`);

      it('has an atlas json and png', () => {
        expect(existsSync(jsonPath)).toBe(true);
        expect(existsSync(pngPath)).toBe(true);
      });

      it('json matches the png size and every frame lies inside it', () => {
        const atlas = parseAtlas(JSON.parse(readFileSync(jsonPath, 'utf8')));
        expect(atlas.image).toBe(`${c.id}.png`);
        expect(pngSize(pngPath)).toEqual({ w: atlas.size.w, h: atlas.size.h });
      });

      it('has every pose and every frame name used by the move data', () => {
        const atlas = parseAtlas(JSON.parse(readFileSync(jsonPath, 'utf8')));
        for (const pose of POSE_IDS) expect(atlas.frames[pose], `${c.id}:${pose}`).toBeDefined();
        for (const key of MOVE_KEYS) {
          const m = c.moves[key];
          for (const p of [m.poses.startup, m.poses.active, m.poses.recovery]) {
            expect(atlas.frames[p], `${c.id}.${key} uses ${p}`).toBeDefined();
          }
        }
      });

      it('anchors sit inside their frame', () => {
        const atlas = parseAtlas(JSON.parse(readFileSync(jsonPath, 'utf8')));
        for (const [name, f] of Object.entries(atlas.frames)) {
          expect(f.anchorX, name).toBeGreaterThanOrEqual(0);
          expect(f.anchorX, name).toBeLessThanOrEqual(f.w);
          expect(f.anchorY, name).toBeGreaterThan(0);
          expect(f.anchorY, name).toBeLessThanOrEqual(f.h + 1);
        }
      });
    });
  }
});

describe('animation atlases', () => {
  const needed = [...new Set([...IDLE_CLIP.frames, ...WALK_CLIP.frames, ...Object.values(ATTACK_CLIP_PREFIX).flatMap((p) => [0, 1, 2].map((i) => `${p}_${i}`))])];

  it('lists only known fighters', () => {
    for (const id of ANIMATED_FIGHTERS) expect(CHARACTERS.some((c) => c.id === id), id).toBe(true);
  });

  for (const id of ANIMATED_FIGHTERS) {
    describe(id, () => {
      const jsonPath = join(PUBLIC, 'fighters', `${id}-anim.json`);
      const pngPath = join(PUBLIC, 'fighters', `${id}-anim.png`);

      it('json matches the png and has every clip frame', () => {
        const atlas = parseAtlas(JSON.parse(readFileSync(jsonPath, 'utf8')));
        expect(pngSize(pngPath)).toEqual({ w: atlas.size.w, h: atlas.size.h });
        for (const name of needed) expect(atlas.frames[name], `${id}:${name}`).toBeDefined();
      });

      it('walk and idle frames are about as tall as the key-pose idle and stand on their anchor', () => {
        const anim = parseAtlas(JSON.parse(readFileSync(jsonPath, 'utf8')));
        const key = parseAtlas(JSON.parse(readFileSync(join(PUBLIC, 'fighters', `${id}.json`), 'utf8')));
        const idleH = (key.frames['idle'] as { h: number }).h;
        for (const name of [...IDLE_CLIP.frames, ...WALK_CLIP.frames]) {
          const f = anim.frames[name] as { h: number; anchorY: number };
          expect(f.h / idleH, name).toBeGreaterThan(0.85);
          expect(f.h / idleH, name).toBeLessThan(1.2);
          expect(Math.abs(f.anchorY - f.h), name).toBeLessThanOrEqual(14);
        }
      });
    });
  }
});

describe('stages', () => {
  it('there are nine with unique ids', () => {
    expect(STAGES).toHaveLength(9);
    expect(new Set(STAGES.map((s) => s.id)).size).toBe(9);
  });
  for (const s of STAGES) {
    it(`${s.id} has a 2600x1400 image and a 650x350 thumbnail`, () => {
      const image = join(PUBLIC, '..', s.image);
      const thumb = join(PUBLIC, '..', s.thumb);
      expect(existsSync(image)).toBe(true);
      expect(existsSync(thumb)).toBe(true);
      expect(webpSize(image)).toEqual({ w: 2600, h: 1400 });
      expect(webpSize(thumb)).toEqual({ w: 650, h: 350 });
    });
  }
});

describe('audio and budget', () => {
  it('every sound exists as an mp3 with a valid header', () => {
    for (const n of SOUND_IDS) {
      const f = join(PUBLIC, 'audio', `${n}.mp3`);
      expect(existsSync(f), n).toBe(true);
      const head = readFileSync(f).subarray(0, 3);
      // an ID3 tag or an MPEG frame sync (0xFF 0xFB/0xFA/0xF3/0xF2)
      expect(head.toString('latin1') === 'ID3' || (head[0] === 0xff && (head[1] as number) >= 0xe0), n).toBe(true);
    }
  });

  it('ships no leftover audio files that the game does not load', () => {
    const known = new Set(SOUND_IDS.map((n) => `${n}.mp3`));
    for (const f of readdirSync(join(PUBLIC, 'audio'))) expect(known.has(f), f).toBe(true);
  });

  it('audio stays under 8 MB and all shipped assets under 30 MB', () => {
    expect(totalBytes(join(PUBLIC, 'audio'))).toBeLessThan(8 * MB);
    expect(totalBytes(PUBLIC)).toBeLessThan(30 * MB);
  });
});
