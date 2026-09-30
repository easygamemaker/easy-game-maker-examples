import { describe, expect, it } from 'vitest';
import {
  DODGE_POINTS,
  INVULNERABLE_SECONDS,
  LANE_COUNT,
  LANE_WIDTH,
  MAX_SPEED,
  MIN_SPEED,
  SHIP_Z,
  START_LIVES,
  createRng,
  findHit,
  hitRun,
  laneX,
  maxBlocked,
  nearestLane,
  newRun,
  nextRow,
  openLanes,
  rowSpacing,
  scoreOf,
  speedAt,
  startRun,
  stepObstacles,
  tickRun,
  registerDodges,
  type Obstacle,
} from '../logic';

describe('lanes', () => {
  it('centres the middle lane on x = 0 and spaces lanes evenly', () => {
    expect(laneX(2)).toBe(0);
    expect(laneX(3) - laneX(2)).toBeCloseTo(LANE_WIDTH);
    expect(laneX(0)).toBeCloseTo(-laneX(LANE_COUNT - 1));
  });

  it('maps x back to the nearest lane and clamps outside the track', () => {
    for (let i = 0; i < LANE_COUNT; i += 1) expect(nearestLane(laneX(i) + 0.2)).toBe(i);
    expect(nearestLane(-99)).toBe(0);
    expect(nearestLane(99)).toBe(LANE_COUNT - 1);
  });
});

describe('difficulty curve', () => {
  it('starts slow, ends fast and never overshoots', () => {
    expect(speedAt(0)).toBe(MIN_SPEED);
    expect(speedAt(10_000)).toBe(MAX_SPEED);
    expect(speedAt(20)).toBeGreaterThan(speedAt(10));
  });

  it('closes the gap between rows and blocks more lanes over time', () => {
    expect(rowSpacing(200)).toBeLessThan(rowSpacing(0));
    expect(maxBlocked(0)).toBe(1);
    expect(maxBlocked(200)).toBe(3);
  });
});

describe('row generation', () => {
  it('always leaves an open lane that can be reached from the previous row', () => {
    const rng = createRng(11);
    let open = [2];
    for (let i = 0; i < 300; i += 1) {
      const elapsed = (i / 300) * 90;
      const blocked = nextRow(rng, open, elapsed);
      const next = openLanes(blocked);
      expect(next.length).toBeGreaterThan(0);
      expect(blocked.length).toBeLessThanOrEqual(maxBlocked(elapsed));
      expect(next.some((o) => open.some((p) => Math.abs(o - p) <= 2))).toBe(true);
      open = next;
    }
  });

  it('replays the same rows for the same seed', () => {
    const a = createRng(5);
    const b = createRng(5);
    expect(nextRow(a, [], 30)).toEqual(nextRow(b, [], 30));
  });
});

describe('obstacles', () => {
  const rock = (id: number, lane: number, z: number, row = id): Obstacle => ({ id, row, lane, z });

  it('moves obstacles toward the ship without mutating the input', () => {
    const before = [rock(1, 0, -50)];
    const { obstacles } = stepObstacles(before, 0.5, 20);
    expect(obstacles[0]?.z).toBe(-40);
    expect(before[0]?.z).toBe(-50);
  });

  it('reports an obstacle once, as it goes past, and drops it behind the ship', () => {
    let list = [rock(1, 0, SHIP_Z + 2)];
    let step = stepObstacles(list, 0.05, 20);
    expect(step.passed.map((o) => o.id)).toEqual([1]);
    list = step.obstacles;
    step = stepObstacles(list, 0.05, 20);
    expect(step.passed).toEqual([]);
    step = stepObstacles(step.obstacles, 1, 20);
    expect(step.obstacles).toEqual([]);
  });

  it('lets a caller count rows rather than rocks', () => {
    const list = [rock(1, 0, SHIP_Z + 2, 7), rock(2, 3, SHIP_Z + 2, 7)];
    const { passed } = stepObstacles(list, 0.05, 20);
    expect(new Set(passed.map((o) => o.row)).size).toBe(1);
  });

  it('detects a hit only when ship and obstacle overlap', () => {
    const list = [rock(1, 2, SHIP_Z - 0.5)];
    expect(findHit(list, 0)?.id).toBe(1);
    expect(findHit(list, LANE_WIDTH)).toBeUndefined();
    expect(findHit([rock(2, 2, -30)], 0)).toBeUndefined();
  });
});

describe('run state', () => {
  it('does not run before it is started', () => {
    expect(tickRun(newRun(), 1).elapsed).toBe(0);
  });

  it('advances distance with the speed curve', () => {
    const run = tickRun(startRun(newRun()), 1);
    expect(run.distance).toBeCloseTo(MIN_SPEED, 5);
  });

  it('costs one life per hit and then protects the ship for a moment', () => {
    let run = startRun(newRun());
    run = hitRun(run);
    expect(run.lives).toBe(START_LIVES - 1);
    expect(run.invulnerable).toBe(INVULNERABLE_SECONDS);
    expect(hitRun(run).lives).toBe(START_LIVES - 1);
    run = tickRun(run, INVULNERABLE_SECONDS + 0.1);
    expect(hitRun(run).lives).toBe(START_LIVES - 2);
  });

  it('ends the run when the last life is lost', () => {
    let run = startRun(newRun());
    for (let i = 0; i < START_LIVES; i += 1) run = hitRun(tickRun(run, INVULNERABLE_SECONDS + 0.1));
    expect(run.status).toBe('over');
    expect(run.lives).toBe(0);
  });

  it('scores distance and dodged rows', () => {
    let run = startRun(newRun());
    run = registerDodges(run, 2);
    run = { ...run, distance: 100 };
    expect(scoreOf(run)).toBe(50 + 2 * DODGE_POINTS);
    expect(registerDodges(run, 0)).toBe(run);
  });
});
