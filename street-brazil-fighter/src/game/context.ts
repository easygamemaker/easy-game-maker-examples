import type { App, Scene } from 'easy-game-maker';
import type { Difficulty, MatchState } from '../sim';
import type { ControlHub } from './controls';
import type { GameAssets } from './assets';
import type { Query } from './query';
import type { AudioDebug } from '../audio/director';

export type Mode = '1p' | '2p';

export interface Session {
  readonly mode: Mode;
  readonly difficulty: Difficulty;
  readonly p1: string;
  readonly p2: string;
  readonly stageId: string;
}

/** What the result screen shows after a match. */
export interface MatchSummary {
  readonly winner: 0 | 1 | null;
  readonly wins: readonly [number, number];
  readonly rounds: number;
  readonly healthLeft: readonly [number, number];
}

/** Shared services and the (replaced, never mutated) session, passed to every scene. */
export interface GameContext {
  readonly app: App;
  readonly assets: GameAssets;
  readonly controls: ControlHub;
  readonly query: Query;
  session: Session;
  summary: MatchSummary | null;
}

export const DEFAULT_SESSION: Session = {
  mode: '1p', difficulty: 'normal', p1: 'tiao', p2: 'dalva', stageId: 'copacabana',
};

export function updateSession(ctx: GameContext, patch: Partial<Session>): void {
  ctx.session = { ...ctx.session, ...patch };
}

/** The automation hook. Always present so a headless test can read the state. */
export interface SbfHook {
  scene: string;
  mode: string;
  match: MatchState | null;
  frame: number;
  done: boolean;
  winner: 0 | 1 | null;
  speed: number;
  paused: boolean;
  /** Camera x of the last rendered frame (lets a test crop around the fighters). */
  camX: number;
  /** Atlas frame name drawn for each fighter in the last frame. */
  shown: readonly [string, string];
  /** What the audio director was asked to play (see src/audio/director.ts). */
  audio: AudioDebug | null;
}

/** Returns the automation hook, creating it on first use. */
export function hook(): SbfHook {
  if (!window.__SBF__) {
    window.__SBF__ = { scene: 'boot', mode: '1p', match: null, frame: 0, done: false, winner: null, speed: 1, paused: false, camX: 0, shown: ['', ''], audio: null };
  }
  return window.__SBF__;
}

declare global {
  interface Window {
    __SBF__?: SbfHook;
    __EGM_SIMULATOR__?: boolean;
  }
}

export type SceneName = 'boot' | 'title' | 'select' | 'stage' | 'fight' | 'result';

/** Scenes are cached by the engine, so the target is destroyed first and rebuilt with fresh params. */
export function goto(ctx: GameContext, name: SceneName, fade = 220): Promise<void> {
  if (ctx.app.scenes.currentName !== name) ctx.app.scenes.destroyScene(name);
  return ctx.app.scenes.go(name, { transition: 'fade', duration: fade, params: { ctx } });
}

export const ctxOf = (params: Record<string, unknown> | undefined): GameContext => {
  const c = params?.['ctx'] as GameContext | undefined;
  if (!c) throw new Error('scene started without a game context');
  return c;
};

export type { Scene };
