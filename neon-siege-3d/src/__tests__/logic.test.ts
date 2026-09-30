import { describe, expect, it } from 'vitest';
import {
  ARENA_LIMIT,
  ARENA_SIZE,
  FIRE_INTERVAL,
  HEALTH_PICKUP,
  HIT_GRACE_SECONDS,
  MAG_SIZE,
  MAX_RESERVE,
  PLAYER_EYE,
  PLAYER_MAX_HEALTH,
  RELOAD_SECONDS,
  START_RESERVE,
  TELEGRAPH_SECONDS,
  accuracy,
  addAmmo,
  aimAngles,
  applyPickup,
  boltBlocked,
  boltExpired,
  boltHitsPlayer,
  canReload,
  canShoot,
  createRng,
  damagePlayer,
  distance2D,
  healPlayer,
  hurtDrone,
  isDead,
  isDry,
  killPoints,
  newBolt,
  newDrone,
  newPlayer,
  newRun,
  newWaves,
  newWeapon,
  pickupInReach,
  pushOutOfCover,
  registerKill,
  registerShot,
  rollDrop,
  shoot,
  spawnPoint,
  startReload,
  stepBolt,
  stepDrone,
  tickPlayer,
  tickWaves,
  tickWeapon,
  waveConfig,
  type Bolt,
  type Cover,
  type Drone,
  type Vec3,
  type Waves,
} from '../logic';

const PLAYER: Vec3 = { x: 0, y: PLAYER_EYE, z: 0 };
const rng = () => createRng(7);

describe('weapon', () => {
  it('starts full with a reserve', () => {
    const w = newWeapon();
    expect(w.mag).toBe(MAG_SIZE);
    expect(w.reserve).toBe(START_RESERVE);
    expect(canShoot(w)).toBe(true);
  });

  it('spends one round per shot and does not mutate', () => {
    const w = newWeapon();
    const next = shoot(w);
    expect(next.mag).toBe(MAG_SIZE - 1);
    expect(w.mag).toBe(MAG_SIZE);
  });

  it('cannot shoot an empty magazine or while reloading', () => {
    expect(canShoot({ mag: 0, reserve: 10, reloadLeft: 0 })).toBe(false);
    expect(canShoot({ mag: 5, reserve: 10, reloadLeft: 0.5 })).toBe(false);
    expect(shoot({ mag: 0, reserve: 10, reloadLeft: 0 }).mag).toBe(0);
  });

  it('reloads only when it helps', () => {
    expect(canReload(newWeapon())).toBe(false);
    expect(canReload({ mag: 3, reserve: 0, reloadLeft: 0 })).toBe(false);
    expect(canReload({ mag: 3, reserve: 40, reloadLeft: 0 })).toBe(true);
    expect(startReload({ mag: 3, reserve: 40, reloadLeft: 0 }).reloadLeft).toBe(RELOAD_SECONDS);
    expect(startReload(newWeapon()).reloadLeft).toBe(0);
  });

  it('tops the magazine up from the reserve when the reload finishes', () => {
    let w = startReload({ mag: 10, reserve: 50, reloadLeft: 0 });
    w = tickWeapon(w, RELOAD_SECONDS / 2);
    expect(w.mag).toBe(10);
    expect(w.reloadLeft).toBeGreaterThan(0);
    w = tickWeapon(w, RELOAD_SECONDS);
    expect(w).toEqual({ mag: MAG_SIZE, reserve: 30, reloadLeft: 0 });
  });

  it('takes only what the reserve has', () => {
    const w = tickWeapon(startReload({ mag: 0, reserve: 12, reloadLeft: 0 }), 5);
    expect(w).toEqual({ mag: 12, reserve: 0, reloadLeft: 0 });
    expect(isDry(w)).toBe(false);
    expect(isDry({ mag: 0, reserve: 0, reloadLeft: 0 })).toBe(true);
  });

  it('caps the reserve when ammo is picked up', () => {
    expect(addAmmo({ mag: 30, reserve: 140, reloadLeft: 0 }, 30).reserve).toBe(MAX_RESERVE);
  });

  it('has a fire rate that a magazine cannot outlast a reload', () => {
    expect(FIRE_INTERVAL * MAG_SIZE).toBeGreaterThan(RELOAD_SECONDS);
  });
});

describe('player health', () => {
  it('takes damage and then is protected for a moment', () => {
    const hit = damagePlayer(newPlayer(), 20);
    expect(hit.health).toBe(PLAYER_MAX_HEALTH - 20);
    expect(hit.grace).toBe(HIT_GRACE_SECONDS);
    expect(damagePlayer(hit, 20)).toBe(hit);
    expect(damagePlayer(tickPlayer(hit, 1), 20).health).toBe(PLAYER_MAX_HEALTH - 40);
  });

  it('never goes below zero and stays dead', () => {
    const dead = damagePlayer({ health: 5, grace: 0 }, 50);
    expect(dead.health).toBe(0);
    expect(isDead(dead)).toBe(true);
    expect(healPlayer(dead, 30)).toBe(dead);
  });

  it('heals up to the maximum', () => {
    expect(healPlayer({ health: 90, grace: 0 }, HEALTH_PICKUP).health).toBe(PLAYER_MAX_HEALTH);
  });

  it('ignores zero damage', () => {
    const p = newPlayer();
    expect(damagePlayer(p, 0)).toBe(p);
  });
});

describe('wave config', () => {
  it('gets bigger, faster and meaner every wave', () => {
    const early = waveConfig(1);
    const late = waveConfig(8);
    expect(late.count).toBeGreaterThan(early.count);
    expect(late.speed).toBeGreaterThan(early.speed);
    expect(late.fireInterval).toBeLessThan(early.fireInterval);
    expect(late.hp).toBeGreaterThan(early.hp);
    expect(late.maxAlive).toBeGreaterThanOrEqual(early.maxAlive);
  });

  it('a higher difficulty level speeds up firing and movement', () => {
    expect(waveConfig(3, 1).fireInterval).toBeLessThan(waveConfig(3, 0).fireInterval);
    expect(waveConfig(3, 1).speed).toBeGreaterThan(waveConfig(3, 0).speed);
  });

  it('stays inside sane limits for absurd waves', () => {
    const cfg = waveConfig(500, 1);
    expect(cfg.count).toBeLessThanOrEqual(30);
    expect(cfg.maxAlive).toBeLessThanOrEqual(9);
    expect(cfg.fireInterval).toBeGreaterThanOrEqual(1.05 - 1e-9);
    expect(waveConfig(0).count).toBe(waveConfig(1).count);
  });

  it('opens with drones a single rifle burst can beat', () => {
    expect(waveConfig(1).hp).toBeLessThanOrEqual(60);
  });
});

describe('wave director', () => {
  const run = (waves: Waves, seconds: number, alive: number): { waves: Waves; spawned: number; events: string[] } => {
    let state = waves;
    let spawned = 0;
    const events: string[] = [];
    for (let t = 0; t < seconds; t += 0.1) {
      const tick = tickWaves(state, 0.1, alive, 0);
      state = tick.waves;
      spawned += tick.spawn;
      if (tick.event) events.push(tick.event);
    }
    return { waves: state, spawned, events };
  };

  it('waits out the first break, then starts wave 1', () => {
    const result = run(newWaves(), 3.5, 0);
    expect(result.events[0]).toBe('started');
    expect(result.waves.wave).toBe(1);
    expect(result.waves.phase).toBe('active');
  });

  it('releases exactly the wave count, one drone at a time', () => {
    const result = run(newWaves(), 14, 0);
    expect(result.spawned).toBe(waveConfig(1).count);
  });

  it('holds spawns while too many drones are alive', () => {
    const started = run(newWaves(), 3.5, 0).waves;
    const capped = run(started, 10, waveConfig(1).maxAlive);
    expect(capped.spawned).toBe(0);
  });

  it('clears the wave only when everything is spawned and dead', () => {
    let state = tickWaves(newWaves(), 10, 0).waves;
    expect(state.wave).toBe(1);
    expect(tickWaves({ ...state, toSpawn: 2 }, 0.05, 0).event).toBe(null);
    expect(tickWaves({ ...state, toSpawn: 0 }, 0.05, 3).event).toBe(null);
    const cleared = tickWaves({ ...state, toSpawn: 0 }, 0.05, 0);
    expect(cleared.event).toBe('cleared');
    expect(cleared.waves.phase).toBe('break');
    state = cleared.waves;
    expect(tickWaves(state, 100, 0).waves.wave).toBe(2);
  });

  it('advances the wave counter across a full simulated game', () => {
    let state = newWaves();
    let alive = 0;
    let cleared = 0;
    for (let t = 0; t < 400 && state.wave < 4; t += 0.1) {
      const tick = tickWaves(state, 0.1, alive, 0);
      state = tick.waves;
      alive += tick.spawn;
      if (tick.event === 'cleared') cleared += 1;
      if (alive > 0 && t % 0.5 < 0.1) alive -= 1;
    }
    expect(state.wave).toBe(4);
    expect(cleared).toBe(3);
  });
});

describe('score and accuracy', () => {
  it('pays more per kill on later waves', () => {
    expect(killPoints(5)).toBeGreaterThan(killPoints(1));
    expect(registerKill(newRun(), 2)).toEqual({ kills: 1, score: killPoints(2), shots: 0, hits: 0 });
  });

  it('reports accuracy as a whole percentage', () => {
    let r = newRun();
    expect(accuracy(r)).toBe(0);
    r = registerShot(registerShot(registerShot(r, true), false), true);
    expect(accuracy(r)).toBe(67);
  });
});

describe('spawn point', () => {
  it('spawns inside the arena and away from the player', () => {
    const random = createRng(3);
    for (let i = 0; i < 200; i += 1) {
      const p = spawnPoint(random, { x: 5, y: PLAYER_EYE, z: -4 });
      expect(Math.abs(p.x)).toBeLessThanOrEqual(ARENA_SIZE / 2);
      expect(Math.abs(p.z)).toBeLessThanOrEqual(ARENA_SIZE / 2);
      expect(distance2D(p, { x: 5, y: 0, z: -4 })).toBeGreaterThanOrEqual(14 - 1e-9);
      expect(p.y).toBeGreaterThanOrEqual(2);
    }
  });
});

describe('drone steering', () => {
  const cfg = waveConfig(1);
  const spawn = (pos: Vec3): Drone => newDrone(1, pos, cfg, rng());

  const simulate = (drone: Drone, seconds: number, others: Vec3[] = []): { drone: Drone; shots: number } => {
    let d = drone;
    let shots = 0;
    for (let t = 0; t < seconds; t += 1 / 30) {
      const step = stepDrone(d, PLAYER, others, 1 / 30, cfg, t);
      d = step.drone;
      if (step.fire) shots += 1;
    }
    return { drone: d, shots };
  };

  it('closes in from far away until it reaches shooting range', () => {
    const far = spawn({ x: 18, y: 3, z: 0 });
    const { drone } = simulate(far, 12);
    const range = distance2D(drone.pos, PLAYER);
    expect(range).toBeLessThan(15);
    expect(range).toBeGreaterThan(5);
  });

  it('backs off when the player rushes it', () => {
    const near = spawn({ x: 2, y: 3, z: 0 });
    const { drone } = simulate(near, 6);
    expect(distance2D(drone.pos, PLAYER)).toBeGreaterThan(4);
  });

  it('never leaves the arena or the flight ceiling', () => {
    const edge = spawn({ x: ARENA_LIMIT, y: 3, z: ARENA_LIMIT });
    const { drone } = simulate(edge, 20);
    expect(Math.abs(drone.pos.x)).toBeLessThanOrEqual(ARENA_LIMIT + 1e-9);
    expect(Math.abs(drone.pos.z)).toBeLessThanOrEqual(ARENA_LIMIT + 1e-9);
    expect(drone.pos.y).toBeGreaterThanOrEqual(1.2);
    expect(drone.pos.y).toBeLessThanOrEqual(5);
  });

  it('keeps clear of a drone parked on top of it', () => {
    const a = spawn({ x: 10, y: 3, z: 0 });
    const { drone } = simulate(a, 1, [{ x: 10.5, y: 3, z: 0 }]);
    expect(distance2D(drone.pos, { x: 10.5, y: 3, z: 0 })).toBeGreaterThan(0.5);
  });

  it('shoots at its fire interval, telegraphing first', () => {
    const d = { ...spawn({ x: 10, y: 3, z: 0 }), fireTimer: TELEGRAPH_SECONDS + 0.2 };
    let step = stepDrone(d, PLAYER, [], 0.1, cfg, 0);
    expect(step.drone.telegraph).toBe(false);
    step = stepDrone(step.drone, PLAYER, [], 0.2, cfg, 0.1);
    expect(step.drone.telegraph).toBe(true);
    expect(step.fire).toBe(false);
    step = stepDrone(step.drone, PLAYER, [], 0.6, cfg, 0.3);
    expect(step.fire).toBe(true);
    expect(step.drone.telegraph).toBe(false);
    expect(step.drone.fireTimer).toBeGreaterThan(0.5);
  });

  it('fires about once per interval over time', () => {
    const { shots } = simulate(spawn({ x: 10, y: 3, z: 0 }), 20);
    const expected = 20 / cfg.fireInterval;
    expect(shots).toBeGreaterThan(expected * 0.6);
    expect(shots).toBeLessThan(expected * 1.4);
  });

  it('flies around cover instead of through it', () => {
    const block: Cover = { minX: -2, maxX: 2, minZ: -2, maxZ: 2, height: 3.4 };
    const inside = pushOutOfCover({ x: 0.5, y: 2.4, z: 0.1 }, [block]);
    expect(Math.abs(inside.x) >= 3 - 1e-9 || Math.abs(inside.z) >= 3 - 1e-9).toBe(true);
    expect(pushOutOfCover({ x: 8, y: 2.4, z: 0 }, [block])).toEqual({ x: 8, y: 2.4, z: 0 });
    expect(pushOutOfCover({ x: 0, y: 5, z: 0 }, [block])).toEqual({ x: 0, y: 5, z: 0 });
    let d = spawn({ x: -10, y: 2.4, z: 0 });
    for (let t = 0; t < 30; t += 1 / 30) {
      d = stepDrone(d, { x: 10, y: PLAYER_EYE, z: 0 }, [], 1 / 30, cfg, t, [block]).drone;
      const trapped = d.pos.x > -3 && d.pos.x < 3 && d.pos.z > -3 && d.pos.z < 3 && d.pos.y < block.height + 0.6;
      expect(trapped).toBe(false);
    }
  });

  it('takes damage and reports the kill', () => {
    const d = spawn({ x: 5, y: 3, z: 0 });
    const first = hurtDrone(d, 20);
    expect(first.killed).toBe(false);
    expect(first.drone.hp).toBe(cfg.hp - 20);
    expect(d.hp).toBe(cfg.hp);
    expect(hurtDrone(first.drone, 999)).toMatchObject({ killed: true, drone: { hp: 0 } });
  });
});

describe('bolts', () => {
  const cfg = waveConfig(1);
  const from: Vec3 = { x: 10, y: 3, z: 0 };

  it('fly toward the player at the wave bolt speed', () => {
    const b = newBolt(1, from, PLAYER, cfg, rng());
    expect(Math.hypot(b.vel.x, b.vel.y, b.vel.z)).toBeCloseTo(cfg.boltSpeed, 5);
    expect(b.vel.x).toBeLessThan(0);
    expect(b.damage).toBe(cfg.boltDamage);
  });

  it('eventually reach a player who stands still', () => {
    let hit = false;
    for (let seed = 1; seed <= 20 && !hit; seed += 1) {
      let b: Bolt = newBolt(1, from, PLAYER, cfg, createRng(seed));
      for (let i = 0; i < 300 && !hit && !boltExpired(b); i += 1) {
        b = stepBolt(b, 1 / 60);
        hit = boltHitsPlayer(b, PLAYER);
      }
    }
    expect(hit).toBe(true);
  });

  it('miss a player who has stepped aside', () => {
    let b: Bolt = { id: 1, pos: from, vel: { x: -15, y: 0, z: 0 }, life: 4, damage: 10 };
    let hit = false;
    for (let i = 0; i < 200; i += 1) {
      b = stepBolt(b, 1 / 60);
      hit = hit || boltHitsPlayer(b, { x: 0, y: PLAYER_EYE, z: 3 });
    }
    expect(hit).toBe(false);
  });

  it('pass over the head of a crouched-out-of-range height', () => {
    const b: Bolt = { id: 1, pos: { x: 0, y: PLAYER_EYE + 1, z: 0 }, vel: { x: 0, y: 0, z: 0 }, life: 1, damage: 5 };
    expect(boltHitsPlayer(b, PLAYER)).toBe(false);
    expect(boltHitsPlayer({ ...b, pos: { x: 0, y: 1, z: 0 } }, PLAYER)).toBe(true);
  });

  it('are stopped by cover, the floor and the wall', () => {
    const cover: Cover[] = [{ minX: 4, maxX: 7, minZ: -1, maxZ: 1, height: 3 }];
    const at = (x: number, y: number, z: number): Bolt => ({ id: 1, pos: { x, y, z }, vel: { x: 0, y: 0, z: 0 }, life: 1, damage: 1 });
    expect(boltBlocked(at(5, 1.5, 0), cover)).toBe(true);
    expect(boltBlocked(at(5, 3.5, 0), cover)).toBe(false);
    expect(boltBlocked(at(2, 1.5, 0), cover)).toBe(false);
    expect(boltBlocked(at(2, 0, 0), cover)).toBe(true);
    expect(boltBlocked(at(ARENA_SIZE / 2 + 1, 2, 0), cover)).toBe(true);
  });

  it('expire after their lifetime', () => {
    let b = newBolt(1, from, PLAYER, cfg, rng());
    b = stepBolt(b, 10);
    expect(boltExpired(b)).toBe(true);
  });
});

describe('pickups', () => {
  it('drop health more often when hurt and ammo more often when low', () => {
    const count = (p: ReturnType<typeof newPlayer>, w: ReturnType<typeof newWeapon>, kind: string): number => {
      const random = createRng(11);
      let n = 0;
      for (let i = 0; i < 2000; i += 1) if (rollDrop(random, p, w) === kind) n += 1;
      return n;
    };
    const healthy = newPlayer();
    const hurt = { health: 15, grace: 0 };
    const full = newWeapon();
    const low = { mag: 2, reserve: 5, reloadLeft: 0 };
    expect(count(hurt, full, 'health')).toBeGreaterThan(count(healthy, full, 'health'));
    expect(count(healthy, low, 'ammo')).toBeGreaterThan(count(healthy, full, 'ammo'));
  });

  it('applies health and ammo to the right thing', () => {
    const p = { health: 40, grace: 0 };
    const w = { mag: 10, reserve: 20, reloadLeft: 0 };
    expect(applyPickup('health', p, w)).toEqual({ player: { health: 40 + HEALTH_PICKUP, grace: 0 }, weapon: w });
    expect(applyPickup('ammo', p, w).weapon.reserve).toBe(50);
    expect(applyPickup('ammo', p, w).player).toBe(p);
  });

  it('is collected only when the player is close', () => {
    const pickup = { id: 1, kind: 'health' as const, pos: { x: 1, y: 0.6, z: 0 }, life: 10 };
    expect(pickupInReach(pickup, PLAYER)).toBe(true);
    expect(pickupInReach({ ...pickup, pos: { x: 6, y: 0.6, z: 0 } }, PLAYER)).toBe(false);
  });
});

describe('aim angles', () => {
  it('points at a target straight ahead with no rotation', () => {
    const { yaw, pitch } = aimAngles({ x: 0, y: 1.7, z: 0 }, { x: 0, y: 1.7, z: -10 });
    expect(yaw).toBeCloseTo(0);
    expect(pitch).toBeCloseTo(0);
  });

  it('turns left for a target at negative x and up for a higher one', () => {
    const left = aimAngles({ x: 0, y: 0, z: 0 }, { x: -5, y: 0, z: -5 });
    expect(left.yaw).toBeCloseTo(Math.PI / 4);
    expect(aimAngles({ x: 0, y: 0, z: 0 }, { x: 0, y: 5, z: -5 }).pitch).toBeCloseTo(Math.PI / 4);
  });
});

describe('createRng', () => {
  it('replays the same sequence for the same seed', () => {
    const a = createRng(5);
    const b = createRng(5);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});
