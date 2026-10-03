// Pure JS WAV synthesizer for the sound effects. Deterministic: same output on every run.
// Usage: node tools/make-sfx.mjs   (writes public/assets/audio/*.wav, which are committed)
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './fal.mjs';

const RATE = 22050;
const OUT = join(ROOT, 'public', 'assets', 'audio');
mkdirSync(OUT, { recursive: true });

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
  };
}

const TAU = Math.PI * 2;
const env = (t, d, attack = 0.004, curve = 2.5) => (t < attack ? t / attack : Math.pow(Math.max(0, 1 - (t - attack) / (d - attack)), curve));

/** layers: [{ type: 'sine'|'square'|'saw'|'noise', f0, f1, gain, d, delay, lp }] */
function render(duration, layers, seed = 1) {
  const n = Math.floor(duration * RATE);
  const buf = new Float32Array(n);
  const noise = rng(seed);
  for (const L of layers) {
    let phase = 0, lp = 0;
    const d = L.d ?? duration;
    const start = Math.floor((L.delay ?? 0) * RATE);
    for (let i = start; i < n; i++) {
      const t = (i - start) / RATE;
      if (t > d) break;
      const k = t / d;
      const f = L.f0 + ((L.f1 ?? L.f0) - L.f0) * k;
      phase += (TAU * f) / RATE;
      let s;
      if (L.type === 'noise') {
        s = noise();
        if (L.lp) { lp += L.lp * (s - lp); s = lp; }
      } else if (L.type === 'square') s = Math.sin(phase) >= 0 ? 0.6 : -0.6;
      else if (L.type === 'saw') s = ((phase / TAU) % 1) * 2 - 1;
      else s = Math.sin(phase);
      buf[i] += s * (L.gain ?? 1) * env(t, d, L.attack ?? 0.004, L.curve ?? 2.5);
    }
  }
  return buf;
}

function wav(samples) {
  let peak = 0;
  for (const s of samples) peak = Math.max(peak, Math.abs(s));
  const norm = peak > 0 ? 0.85 / peak : 1;
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s * norm)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + data.length, 4); h.write('WAVEfmt ', 8);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const SOUNDS = {
  punch: render(0.16, [{ type: 'noise', f0: 0, gain: 0.8, d: 0.12, lp: 0.45 }, { type: 'sine', f0: 220, f1: 90, gain: 0.9, d: 0.14 }], 11),
  kick: render(0.24, [{ type: 'noise', f0: 0, gain: 0.7, d: 0.18, lp: 0.3 }, { type: 'sine', f0: 160, f1: 55, gain: 1, d: 0.22 }], 12),
  hit: render(0.2, [{ type: 'noise', f0: 0, gain: 1, d: 0.14, lp: 0.7 }, { type: 'square', f0: 140, f1: 60, gain: 0.5, d: 0.16 }, { type: 'sine', f0: 90, f1: 40, gain: 0.8, d: 0.2 }], 13),
  block: render(0.14, [{ type: 'noise', f0: 0, gain: 0.5, d: 0.08, lp: 0.9 }, { type: 'square', f0: 520, f1: 380, gain: 0.45, d: 0.1 }], 14),
  special: render(0.55, [{ type: 'saw', f0: 180, f1: 900, gain: 0.45, d: 0.5, curve: 1.2 }, { type: 'noise', f0: 0, gain: 0.45, d: 0.5, lp: 0.2, curve: 1.5 }, { type: 'sine', f0: 360, f1: 1500, gain: 0.5, d: 0.45 }], 15),
  ko: render(0.9, [{ type: 'sine', f0: 200, f1: 38, gain: 1, d: 0.85, curve: 1.6 }, { type: 'noise', f0: 0, gain: 0.8, d: 0.4, lp: 0.25 }, { type: 'square', f0: 330, f1: 90, gain: 0.35, d: 0.6 }], 16),
  round_start: render(0.7, [{ type: 'square', f0: 440, gain: 0.45, d: 0.16 }, { type: 'square', f0: 660, gain: 0.45, d: 0.16, delay: 0.17 }, { type: 'square', f0: 880, gain: 0.55, d: 0.4, delay: 0.34 }], 17),
  ui_move: render(0.07, [{ type: 'square', f0: 700, f1: 760, gain: 0.5, d: 0.06 }], 18),
  ui_select: render(0.22, [{ type: 'square', f0: 520, gain: 0.5, d: 0.08 }, { type: 'square', f0: 780, gain: 0.5, d: 0.14, delay: 0.07 }], 19),
};

for (const [name, samples] of Object.entries(SOUNDS)) {
  const file = join(OUT, `${name}.wav`);
  writeFileSync(file, wav(samples));
  console.log(`${name}.wav  ${(samples.length / RATE).toFixed(2)}s`);
}
