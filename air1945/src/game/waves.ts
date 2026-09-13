import type { EnemyType } from './entities';
import { W } from './entities';

export interface SpawnCmd {
  t: number;
  type: EnemyType;
  x: number;
  vy: number;
  useSine: boolean;
  sineAmp: number;
  sineFreq: number;
  shootInterval: number;
  spawned: boolean;
}

export interface WaveDef {
  spawns: SpawnCmd[];
}

function f(t: number, x: number, vy = 160, si = 2.8): SpawnCmd {
  return { t, type: 'fighter', x, vy, useSine: false, sineAmp: 0, sineFreq: 0, shootInterval: si, spawned: false };
}

function b(t: number, x: number, vy = 95, amp = 60, freq = 1.2, si = 2.2): SpawnCmd {
  return { t, type: 'bomber', x, vy, useSine: true, sineAmp: amp, sineFreq: freq, shootInterval: si, spawned: false };
}

function g(t: number, x: number, vy = 70, si = 1.8): SpawnCmd {
  return { t, type: 'gunship', x, vy, useSine: false, sineAmp: 0, sineFreq: 0, shootInterval: si, spawned: false };
}

const C = W / 2;  // center

export const WAVES: WaveDef[] = [
  // Wave 1 — Straight line of fighters
  { spawns: [
    f(0.0, 70), f(0.4, 140), f(0.8, 210), f(1.2, 280), f(1.6, 350), f(2.0, 210),
  ]},

  // Wave 2 — Two V formations
  { spawns: [
    f(0.0, C-120, 180), f(0.0, C+120, 180),
    f(0.5, C-80,  180), f(0.5, C+80,  180),
    f(1.0, C-40,  180), f(1.0, C+40,  180),
    f(1.5, C,     180),
    f(2.5, C-100, 200), f(2.5, C+100, 200),
    f(3.0, C-60,  200), f(3.0, C+60,  200),
  ]},

  // Wave 3 — Bombers in sine waves
  { spawns: [
    b(0.0,  70), b(0.6, 350),
    b(1.4, 140), b(2.0, 280),
    b(2.8, 210, 85, 50, 1.5),
    b(3.6,  90, 85, 70, 1.8), b(3.6, 330, 85, 70, 1.8),
  ]},

  // Wave 4 — Mixed assault
  { spawns: [
    f(0.0, 60, 200), f(0.0, 360, 200),
    b(0.5, C,  90, 55, 1.0, 2.0),
    f(1.2, 110, 220), f(1.2, 310, 220),
    g(2.0, C),
    f(3.0, 80, 220), f(3.0, 340, 220), f(3.0, C, 220),
    b(4.0, 160, 100, 40, 1.4), b(4.0, 260, 100, 40, 1.4),
  ]},

  // Wave 5 — Heavy assault
  { spawns: [
    g(0.0,  90, 75, 1.6), g(0.0, 330, 75, 1.6),
    f(0.5, C-60, 240, 2.2), f(0.5, C+60, 240, 2.2),
    b(1.2, 140, 105, 65, 1.6, 1.8), b(1.2, 280, 105, 65, 1.6, 1.8),
    g(2.5, C, 80, 1.5),
    f(3.0, 70, 260, 2.0), f(3.0, 210, 260, 2.0), f(3.0, 350, 260, 2.0),
    g(4.0, 140, 85, 1.4), g(4.0, 280, 85, 1.4),
    b(5.0, C, 110, 80, 2.0, 1.6),
  ]},
];

export function cloneWaves(): WaveDef[] {
  return WAVES.map((w) => ({
    spawns: w.spawns.map((s) => ({ ...s, spawned: false })),
  }));
}
