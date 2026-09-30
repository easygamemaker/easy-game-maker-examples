import { describe, expect, it } from 'vitest';
import {
  BASE_COIN_POINTS,
  COIN_RADIUS,
  MAX_STREAK,
  ROUND_SECONDS,
  STREAK_BONUS,
  STREAK_WINDOW,
  clampToDisc,
  clock,
  coinValue,
  collectCoin,
  createRng,
  newRound,
  pickCoinSpot,
  rankFor,
  startRound,
  tickRound,
} from '../logic';

describe('round clock', () => {
  it('does not advance before the round starts', () => {
    const r = tickRound(newRound(), 1);
    expect(r.timeLeft).toBe(ROUND_SECONDS);
    expect(r.status).toBe('ready');
  });

  it('counts down and ends at zero without going negative', () => {
    let r = startRound(newRound(2));
    r = tickRound(r, 1.5);
    expect(r.status).toBe('playing');
    r = tickRound(r, 1.5);
    expect(r.timeLeft).toBe(0);
    expect(r.status).toBe('over');
  });

  it('returns a new object and leaves the input alone', () => {
    const before = startRound(newRound());
    const after = tickRound(before, 0.5);
    expect(after).not.toBe(before);
    expect(before.timeLeft).toBe(ROUND_SECONDS);
  });
});

describe('scoring', () => {
  it('pays the base value for a first coin', () => {
    const { round, points } = collectCoin(startRound(newRound()));
    expect(points).toBe(BASE_COIN_POINTS);
    expect(round.score).toBe(BASE_COIN_POINTS);
    expect(round.collected).toBe(1);
  });

  it('grows the payout while coins come in quick succession', () => {
    let r = startRound(newRound());
    const paid: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const p = collectCoin(r);
      paid.push(p.points);
      r = tickRound(p.round, 0.5);
    }
    expect(paid).toEqual([BASE_COIN_POINTS, BASE_COIN_POINTS + STREAK_BONUS, BASE_COIN_POINTS + STREAK_BONUS * 2]);
  });

  it('breaks the streak after the window passes', () => {
    let r = collectCoin(startRound(newRound())).round;
    r = tickRound(r, STREAK_WINDOW + 0.1);
    expect(r.streak).toBe(0);
    expect(collectCoin(r).points).toBe(BASE_COIN_POINTS);
  });

  it('caps the streak bonus', () => {
    expect(coinValue(MAX_STREAK + 10)).toBe(coinValue(MAX_STREAK));
    expect(coinValue(0)).toBe(BASE_COIN_POINTS);
  });

  it('ignores pickups when the round is not being played', () => {
    const ready = newRound();
    expect(collectCoin(ready)).toEqual({ round: ready, points: 0 });
  });
});

describe('island geometry', () => {
  it('leaves a point inside the disc unchanged', () => {
    const p = { x: 2, z: 3 };
    expect(clampToDisc(p, 10)).toBe(p);
  });

  it('pulls a point outside back onto the rim, keeping its direction', () => {
    const out = clampToDisc({ x: 30, z: 40 }, 10);
    expect(Math.hypot(out.x, out.z)).toBeCloseTo(10, 6);
    expect(out.x / out.z).toBeCloseTo(0.75, 6);
  });

  it('places coins inside the coin disc and away from the others', () => {
    const rng = createRng(7);
    const placed: { x: number; z: number }[] = [];
    for (let i = 0; i < 8; i += 1) {
      const spot = pickCoinSpot(rng, placed, 3);
      expect(Math.hypot(spot.x, spot.z)).toBeLessThanOrEqual(COIN_RADIUS + 1e-9);
      placed.push(spot);
    }
    const gaps = placed.flatMap((a, i) => placed.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.z - b.z)));
    expect(Math.min(...gaps)).toBeGreaterThan(2);
  });
});

describe('helpers', () => {
  it('replays the same layout for the same seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('formats the clock rounding up', () => {
    expect(clock(45)).toBe('0:45');
    expect(clock(0.2)).toBe('0:01');
    expect(clock(0)).toBe('0:00');
    expect(clock(75)).toBe('1:15');
  });

  it('ranks scores', () => {
    expect(rankFor(0)).toBe('Bronze');
    expect(rankFor(199)).toBe('Bronze');
    expect(rankFor(200)).toBe('Silver');
    expect(rankFor(400)).toBe('Gold');
    expect(rankFor(999)).toBe('Champion');
  });
});
