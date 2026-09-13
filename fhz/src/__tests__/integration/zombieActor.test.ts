import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Group } from 'easy-game-maker';
import { ZombieActor, type ZombieOptions } from '../../game/ZombieActor';

// ── Mock AnimatedSprite ────────────────────────────────────────────────────────
vi.mock('easy-game-maker', async (importOriginal) => {
  const actual = await importOriginal<typeof import('easy-game-maker')>();
  class MockAnimatedSprite extends actual.Group {
    width = 86; height = 86;
    private _onComplete: (() => void) | null = null;
    playRange(_s: number, _e: number, _fps: number, _loop: boolean, onComplete?: () => void) {
      this._onComplete = onComplete ?? null;
    }
    stop() {}
    update(_dt: number) {}
    triggerComplete() { this._onComplete?.(); }
  }
  return { ...actual, AnimatedSprite: MockAnimatedSprite };
});

// ── Helpers ────────────────────────────────────────────────────────────────────
function makeZombie(hits: number, fps = 10): ZombieActor & { anim: { triggerComplete(): void } } {
  const opts: ZombieOptions = {
    x: 200, y: 235,
    width: 86, height: 86,
    frames: [],
    frameMap: { walk:[0,11], collision:[12,21], run:[22,33], deteriorate:[34,41] },
    hits,
    fps,
  };
  return new ZombieActor(opts) as ZombieActor & { anim: { triggerComplete(): void } };
}

// ── Tests ──────────────────────────────────────────────────────────────────────
describe('ZombieActor.alive', () => {
  it('starts alive', () => {
    expect(makeZombie(1).alive).toBe(true);
  });
});

describe('ZombieActor.hit() — 1-hit zombie', () => {
  it('returns true (killed) on first hit', () => {
    const z = makeZombie(1);
    expect(z.hit()).toBe(true);
  });

  it('becomes not alive after hit', () => {
    const z = makeZombie(1);
    z.hit();
    expect(z.alive).toBe(false);
  });

  it('subsequent hits after death return false', () => {
    const z = makeZombie(1);
    z.hit();
    expect(z.hit()).toBe(false);
  });
});

describe('ZombieActor.hit() — 2-hit zombie', () => {
  it('returns false on first hit (not killed yet)', () => {
    const z = makeZombie(2);
    expect(z.hit()).toBe(false);
  });

  it('still alive after first hit', () => {
    const z = makeZombie(2);
    z.hit();
    expect(z.alive).toBe(true);
  });

  it('returns true (killed) on second hit', () => {
    const z = makeZombie(2);
    z.hit(); // first
    expect(z.hit()).toBe(true); // second
  });

  it('becomes not alive after second hit', () => {
    const z = makeZombie(2);
    z.hit(); z.hit();
    expect(z.alive).toBe(false);
  });
});

describe('ZombieActor.onDead callback', () => {
  it('fires onDead after death animations complete', () => {
    const z = makeZombie(1);
    const spy = vi.fn();
    z.onDead = spy;
    z.hit();
    // Simulate collision anim → deteriorate anim → callback
    (z.anim as { triggerComplete(): void }).triggerComplete();
    (z.anim as { triggerComplete(): void }).triggerComplete();
    expect(spy).toHaveBeenCalledWith(z);
  });

  it('does not fire onDead if zombie was not killed', () => {
    const z = makeZombie(2);
    const spy = vi.fn();
    z.onDead = spy;
    z.hit(); // not killed yet
    expect(spy).not.toHaveBeenCalled();
  });
});

describe('ZombieActor.pause / resume', () => {
  it('can be paused and resumed without error', () => {
    const z = makeZombie(1);
    z.walk();
    expect(() => { z.pause(); z.resume(); }).not.toThrow();
  });
});

describe('ZombieActor.update — walking movement', () => {
  it('x decreases after update (zombie walks left)', () => {
    const z = makeZombie(1);
    z.walk();
    const before = z.x;
    z.update(1 / 60);
    expect(z.x).toBeLessThan(before);
  });

  it('does not move when dead', () => {
    const z = makeZombie(1);
    z.hit();
    const before = z.x;
    z.update(1 / 60);
    expect(z.x).toBe(before);
  });
});
