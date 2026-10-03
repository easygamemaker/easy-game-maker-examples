import { Group, Sprite } from 'easy-game-maker';
import type { GameAssets } from './assets';
import { H, W } from './layout';
import { rect } from './ui';

/** Full-screen stage picture for the menus: the thumbnail at once, the sharp image when it arrives. */
export function createBackdrop(assets: GameAssets, stageId: string, dim = 0.55): Group {
  const g = new Group();
  const sprite = new Sprite({ x: W / 2, y: H / 2, width: W, height: H });
  const thumb = assets.stageThumb(stageId);
  if (thumb) sprite.texture = thumb;
  g.add(sprite);
  void assets.stageImage(stageId).then((t) => {
    sprite.texture = t;
  }).catch(() => undefined);
  g.add(rect(0, 0, W, H, '#0a0d18', dim));
  return g;
}
