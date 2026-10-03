import type { App, Texture } from 'easy-game-maker';
import { CHARACTERS } from '../data/characters';
import { STAGES } from '../data/stages';
import { parseAtlas } from './atlas';

export const SOUND_NAMES = [
  'punch', 'kick', 'hit', 'block', 'special', 'ko', 'round_start', 'ui_move', 'ui_select',
] as const;
export type SoundName = (typeof SOUND_NAMES)[number];

export interface FighterFrame {
  readonly texture: Texture;
  readonly w: number;
  readonly h: number;
  readonly anchorX: number;
  readonly anchorY: number;
}
export type FighterFrames = ReadonlyMap<string, FighterFrame>;

const soundUrl = (name: SoundName): string => `assets/audio/${name}.wav`;

/** Loads and keeps every texture and sound of the game. Missing art is tolerated and reported. */
export class GameAssets {
  private readonly fighters = new Map<string, FighterFrames>();
  private readonly thumbs = new Set<string>();
  private readonly sounds = new Set<string>();
  readonly problems: string[] = [];
  /** Browsers only allow audio after a user gesture, so sound stays off until the first key or click. */
  private unlocked = false;

  constructor(private readonly app: App) {
    const unlock = (): void => {
      this.unlocked = true;
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('pointerdown', unlock, true);
    };
    window.addEventListener('keydown', unlock, true);
    window.addEventListener('pointerdown', unlock, true);
  }

  hasFighter(id: string): boolean {
    return this.fighters.has(id);
  }
  fighter(id: string): FighterFrames {
    const f = this.fighters.get(id);
    if (!f) throw new Error(`fighter art not loaded: ${id}`);
    return f;
  }
  hasStage(id: string): boolean {
    return this.thumbs.has(id);
  }
  stageThumb(id: string): Texture | undefined {
    return this.app.assets.getTexture(`assets/stages/${id}-thumb.webp`);
  }
  async stageImage(id: string): Promise<Texture> {
    return this.app.assets.loadImageFromUrl(`assets/stages/${id}.webp`);
  }

  play(name: SoundName, volume = 1): void {
    if (this.unlocked && this.sounds.has(name)) this.app.audio.play(soundUrl(name), { volume });
  }

  /** Loads everything the menus and fights need. `onProgress` gets a 0..1 fraction. */
  async loadAll(onProgress: (fraction: number, label: string) => void): Promise<void> {
    const total = STAGES.length + CHARACTERS.length * 2 + SOUND_NAMES.length;
    let done = 0;
    const step = (label: string): void => onProgress(++done / total, label);
    const attempt = async (label: string, job: () => Promise<void>): Promise<boolean> => {
      try {
        await job();
        return true;
      } catch (err) {
        this.problems.push(`${label}: ${err instanceof Error ? err.message : String(err)}`);
        return false;
      } finally {
        step(label);
      }
    };

    await Promise.all([
      ...STAGES.map((s) =>
        attempt(`stage ${s.id}`, () => this.app.assets.load({ images: [s.thumb] })).then((ok) => {
          if (ok) this.thumbs.add(s.id);
        }),
      ),
      ...SOUND_NAMES.map((n) =>
        attempt(`sound ${n}`, () => this.app.assets.load({ sounds: [soundUrl(n)] })).then((ok) => {
          if (ok) this.sounds.add(n);
        }),
      ),
      ...CHARACTERS.map(async (c) => {
        const frames = await this.loadFighter(c.id, attempt);
        if (frames) this.fighters.set(c.id, frames);
      }),
    ]);
  }

  private async loadFighter(
    id: string,
    attempt: (label: string, job: () => Promise<void>) => Promise<boolean>,
  ): Promise<FighterFrames | null> {
    let atlas: ReturnType<typeof parseAtlas> | null = null;
    const okJson = await attempt(`atlas ${id}`, async () => {
      const res = await fetch(`assets/fighters/${id}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      atlas = parseAtlas(await res.json());
    });
    const url = `assets/fighters/${id}.png`;
    const okPng = await attempt(`sheet ${id}`, () => this.app.assets.load({ images: [url] }));
    const img = this.app.assets.getImage(url);
    if (!okJson || !okPng || !atlas || !img) return null;
    const a: ReturnType<typeof parseAtlas> = atlas;
    const frames = new Map<string, FighterFrame>();
    for (const [pose, f] of Object.entries(a.frames)) {
      const bitmap = await createImageBitmap(img, f.x, f.y, f.w, f.h, { premultiplyAlpha: 'none' });
      const texture = this.app.renderer.uploadTexture(`fighter:${id}:${pose}`, bitmap);
      frames.set(pose, { texture, w: f.w, h: f.h, anchorX: f.anchorX, anchorY: f.anchorY });
    }
    return frames;
  }
}
