import { describe, expect, it } from 'vitest';
import { parseAtlas } from '../../game/atlas';
import { MAX_CAMERA_X, cameraTarget, followCamera } from '../../game/camera';
import { bannerText, healthColor } from '../../game/hud';
import { parseQuery } from '../../game/query';
import { TOUCH_BUTTONS, TouchPad, hitButton } from '../../game/touch';
import { moveGrid } from '../../game/ui';
import { W } from '../../game/layout';

describe('moveGrid', () => {
  it('wraps horizontally inside a row', () => {
    expect(moveGrid(2, 3, 6, 1, 0)).toBe(0);
    expect(moveGrid(0, 3, 6, -1, 0)).toBe(2);
  });
  it('wraps vertically and skips missing cells', () => {
    expect(moveGrid(1, 3, 6, 0, 1)).toBe(4);
    expect(moveGrid(4, 3, 6, 0, 1)).toBe(1);
    expect(moveGrid(2, 3, 5, 0, 1)).toBe(2);
  });
  it('wraps inside a short last row', () => {
    expect(moveGrid(4, 3, 5, 1, 0)).toBe(3);
  });
});

describe('camera', () => {
  it('centres the midpoint and clamps to the stage', () => {
    expect(cameraTarget(780, 780)).toBe(780 - W / 2);
    expect(cameraTarget(60, 100)).toBe(0);
    expect(cameraTarget(1500, 1500)).toBe(MAX_CAMERA_X);
  });
  it('eases toward the target without overshooting', () => {
    let x = 0;
    for (let i = 0; i < 200; i++) x = followCamera(x, 1500, 1500);
    expect(x).toBeCloseTo(MAX_CAMERA_X, 1);
    expect(x).toBeLessThanOrEqual(MAX_CAMERA_X);
  });
});

describe('hud helpers', () => {
  it('maps health to a colour', () => {
    expect(healthColor(1)).toBe('#2ee66b');
    expect(healthColor(0.4)).toBe('#ffd23f');
    expect(healthColor(0.1)).toBe('#ff4d4d');
  });
  it('words the end banner for one and two players', () => {
    expect(bannerText('P1 WINS', '1p', 0)).toBe('YOU WIN');
    expect(bannerText('P2 WINS', '1p', 1)).toBe('YOU LOSE');
    expect(bannerText('P2 WINS', '2p', 1)).toBe('P2 WINS');
    expect(bannerText('FIGHT!', '1p', null)).toBe('FIGHT!');
    expect(bannerText(null, '1p', null)).toBe('');
  });
});

describe('query parsing', () => {
  it('reads the automation switches', () => {
    const q = parseQuery('?autoplay=cpu&hitboxes=1&speed=8&diff=hard&p1=rosa&seed=9&p2mode=dummy');
    expect(q).toMatchObject({ autoplay: true, hitboxes: true, speed: 8, difficulty: 'hard', p1: 'rosa', seed: 9, p2mode: 'dummy' });
  });
  it('falls back to safe defaults on nonsense', () => {
    const q = parseQuery('?speed=999&diff=nightmare&seed=abc');
    expect(q).toMatchObject({ speed: 16, difficulty: 'normal', seed: 1, autoplay: false, quick: false });
  });
});

describe('touch pad', () => {
  const punch = TOUCH_BUTTONS.find((b) => b.action === 'punch')!;
  const left = TOUCH_BUTTONS.find((b) => b.action === 'left')!;
  it('hits buttons by position', () => {
    expect(hitButton(TOUCH_BUTTONS, punch.x + 5, punch.y + 5)?.action).toBe('punch');
    expect(hitButton(TOUCH_BUTTONS, 600, 100)).toBeNull();
  });
  it('holds several buttons for several fingers and releases them', () => {
    const pad = new TouchPad();
    pad.press(1, left.x + 10, left.y + 10);
    pad.press(2, punch.x + 10, punch.y + 10);
    expect(pad.read()).toMatchObject({ left: true, punch: true, kick: false });
    pad.release(1);
    expect(pad.read()).toMatchObject({ left: false, punch: true });
  });
  it('drops a button when the finger slides off it', () => {
    const pad = new TouchPad();
    pad.press(1, left.x + 10, left.y + 10);
    pad.move(1, 600, 100);
    expect(pad.read().left).toBe(false);
  });
});

describe('atlas parsing', () => {
  const good = { image: 'a.png', size: { w: 100, h: 100 }, bodyHeight: 400, frames: { idle: { x: 0, y: 0, w: 50, h: 60, anchorX: 25, anchorY: 60 } } };
  it('accepts a valid atlas', () => {
    expect(parseAtlas(good).frames['idle']?.w).toBe(50);
  });
  it('rejects frames outside the image and missing fields', () => {
    expect(() => parseAtlas({ ...good, frames: { idle: { ...good.frames.idle, x: 80 } } })).toThrow(/outside/);
    expect(() => parseAtlas({ ...good, size: undefined })).toThrow(/size/);
    expect(() => parseAtlas(null)).toThrow();
  });
});
