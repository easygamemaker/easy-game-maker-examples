import type { App, Texture } from 'easy-game-maker';
import { CHARACTERS } from '../data/characters';
import { STAGES } from '../data/stages';
import { AudioDirector } from '../audio/director';
import { SOUND_IDS, soundUrl, type SoundId } from '../audio/catalog';
import { browserStore } from '../audio/settings';
import { parseAtlas } from './atlas';


export interface FighterFrame {
  readonly texture: Texture;
  readonly w: number;
  readonly h: number;
  readonly anchorX: number;
  readonly anchorY: number;
}
export type FighterFrames = ReadonlyMap<string, FighterFrame>;

/** Fighters that ship an animation atlas (<id>-anim.json/png) next to the key-pose atlas. */
export const ANIMATED_FIGHTERS: readonly string[] = ['tiao', 'dalva', 'saci', 'curupira', 'craque', 'rosa'];

/** Loads and keeps every texture and sound of the game. Missing art is tolerated and reported. */
export class GameAssets {
  private readonly fighters = new Map<string, FighterFrames>();
  private readonly thumbs = new Set<string>();
  readonly problems: string[] = [];
  /** Music, effects and the announcer. Browsers only allow audio after a user gesture, so it stays silent until the first key or click. */
  readonly audio: AudioDirector;

  constructor(private readonly app: App) {
    this.audio = new AudioDirector(app.audio, browserStore());
    this.audio.attachBrowser(window);
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

  /** Plays an interface sound effect. */
  play(name: SoundId, volume = 1): void {
    this.audio.sfx(name, volume);
  }

  /** Loads everything the menus and fights need. `onProgress` gets a 0..1 fraction. */
  async loadAll(onProgress: (fraction: number, label: string) => void): Promise<void> {
    const total = STAGES.length + CHARACTERS.length * 2 + ANIMATED_FIGHTERS.length * 2 + SOUND_IDS.length;
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
      ...SOUND_IDS.map((n) =>
        attempt(`sound ${n}`, () => this.app.assets.load({ sounds: [soundUrl(n)] })).then((ok) => {
          if (ok) this.audio.markLoaded(n);
          else this.audio.markFailed(n, 'failed to load');
        }),
      ),
      ...CHARACTERS.map(async (c) => {
        const frames = await this.loadFighter(c.id, attempt);
        if (frames) this.fighters.set(c.id, frames);
      }),
    ]);
  }

  /** Loads one atlas (json + png) and uploads every frame as a texture into `frames`. */
  private async loadAtlas(
    name: string,
    id: string,
    frames: Map<string, FighterFrame>,
    attempt: (label: string, job: () => Promise<void>) => Promise<boolean>,
  ): Promise<boolean> {
    let atlas: ReturnType<typeof parseAtlas> | null = null;
    const okJson = await attempt(`atlas ${name}`, async () => {
      const res = await fetch(`assets/fighters/${name}.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      atlas = parseAtlas(await res.json());
    });
    const url = `assets/fighters/${name}.png`;
    const okPng = await attempt(`sheet ${name}`, () => this.app.assets.load({ images: [url] }));
    const img = this.app.assets.getImage(url);
    if (!okJson || !okPng || !atlas || !img) return false;
    const a: ReturnType<typeof parseAtlas> = atlas;
    for (const [pose, f] of Object.entries(a.frames)) {
      const bitmap = await createImageBitmap(img, f.x, f.y, f.w, f.h, { premultiplyAlpha: 'none' });
      const texture = this.app.renderer.uploadTexture(`fighter:${id}:${pose}`, bitmap);
      frames.set(pose, { texture, w: f.w, h: f.h, anchorX: f.anchorX, anchorY: f.anchorY });
    }
    return true;
  }

  private async loadFighter(
    id: string,
    attempt: (label: string, job: () => Promise<void>) => Promise<boolean>,
  ): Promise<FighterFrames | null> {
    const frames = new Map<string, FighterFrame>();
    if (!(await this.loadAtlas(id, id, frames, attempt))) return null;
    // the animation atlas is optional: without it the fighter plays the old key poses
    if (ANIMATED_FIGHTERS.includes(id)) await this.loadAtlas(`${id}-anim`, id, frames, attempt);
    return frames;
  }
}
