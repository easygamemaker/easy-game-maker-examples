// Measures how much the two fighters' DRAWN sprites overlap during scripted fights (real sim, real animation
// selection, real atlases). Run: npx vite-node tools/overlap.mts [--out art-src/work/overlap.json] [--top 12]
// Airborne frames only count in the jump-in scenario (a jump may cross the opponent). For every step it rasterises both sprites (alpha mask, 4 px cells) in world space and reports
//   overlap  = shared cells / cells of the smaller sprite
//   head     = share of the defender's head region (top 22% of its sprite) covered by the other sprite
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadAtlas } from './lib/atlas.mjs';
import { getCharacter, visualScaleOf } from '../src/data/characters';
import { clipFrameName } from '../src/game/animation';
import { SPRITE_SCALE } from '../src/game/layout';
import { MAX_X, MIN_X, input, type FighterState, type MatchState, type PlayerInput } from '../src/sim';
import { patchFighters, runFrames, startFight, type InputPair } from '../src/sim/testing';

const ROOT = join(import.meta.dirname, '..');
const DIR = join(ROOT, 'public', 'assets', 'fighters');
const argv = process.argv.slice(2);
const val = (n: string, d: string): string => (argv.includes(n) ? (argv[argv.indexOf(n) + 1] as string) : d);
const CELL = 8;
/** What-if: shift the draw anchor of the hit and block frames backwards by this many atlas px (see tools/characters.json > post). */
const HITDX = Number(val('--hitdx', '0'));
const DOWNDX = Number(val('--downdx', '0'));
const SHIFTED = new Set(['hit', 'block', 'crouch_block']);
const IDS = ['tiao', 'dalva', 'saci', 'curupira', 'craque', 'rosa'];

interface Mask { w: number; h: number; ax: number; ay: number; cells: Uint8Array; cw: number; ch: number }
const masks = new Map<string, Map<string, Mask>>();
for (const id of IDS) {
  const m = new Map<string, Mask>();
  for (const name of [id, `${id}-anim`]) {
    const atlas = await loadAtlas(DIR, name);
    for (const [pose, fr] of atlas.frames as Map<string, { w: number; h: number; anchorX: number; anchorY: number; data: Buffer }>) {
      const cw = Math.ceil(fr.w / CELL), ch = Math.ceil(fr.h / CELL);
      const cells = new Uint8Array(cw * ch);
      for (let y = 0; y < fr.h; y++) for (let x = 0; x < fr.w; x++) if (fr.data[(y * fr.w + x) * 4 + 3] > 128) cells[Math.floor(y / CELL) * cw + Math.floor(x / CELL)] = 1;
      m.set(pose, { w: fr.w, h: fr.h, ax: fr.anchorX + (SHIFTED.has(pose) ? HITDX : pose === 'down' ? DOWNDX : 0), ay: fr.anchorY, cells, cw, ch });
    }
  }
  masks.set(id, m);
}

/** Atlas frame the game draws for a fighter this step (same choice as FighterView). */
function shownFrame(f: FighterState): string {
  const clip = clipFrameName(f);
  const m = masks.get(f.characterId) as Map<string, Mask>;
  if (clip && m.has(clip)) return clip;
  return m.has(f.pose) ? f.pose : 'idle';
}

type Cells = Map<number, number>; // key = cellY * 4096 + (cellX + 2048) -> 1
function rasterise(f: FighterState): { cells: Set<number>; top: number; bottom: number; frame: string } {
  const frame = shownFrame(f);
  const mk = (masks.get(f.characterId) as Map<string, Mask>).get(frame) as Mask;
  const s = SPRITE_SCALE * visualScaleOf(getCharacter(f.characterId)) * CELL;
  const cells = new Set<number>();
  let top = Infinity, bottom = -Infinity;
  for (let cy = 0; cy < mk.ch; cy++) for (let cx = 0; cx < mk.cw; cx++) {
    if (!mk.cells[cy * mk.cw + cx]) continue;
    const wx = f.x + f.facing * (cx * CELL + CELL / 2 - mk.ax) * (s / CELL);
    const wy = f.y + (mk.ay - (cy * CELL + CELL / 2)) * (s / CELL);
    const gx = Math.round(wx / CELL), gy = Math.round(wy / CELL);
    cells.add(gy * 4096 + gx + 2048);
    top = Math.max(top, wy); bottom = Math.min(bottom, wy);
  }
  return { cells, top, bottom, frame };
}

interface Sample { overlap: number; headA: number; headB: number; frames: [string, string]; states: [string, string]; dist: number; frame: number }
function measure(m: MatchState): Sample {
  const [fa, fb] = m.fighters;
  const a = rasterise(fa), b = rasterise(fb);
  let shared = 0;
  for (const c of a.cells) if (b.cells.has(c)) shared++;
  const head = (self: ReturnType<typeof rasterise>, other: ReturnType<typeof rasterise>): number => {
    const limit = self.top - (self.top - self.bottom) * 0.22;
    let n = 0, hit = 0;
    for (const c of self.cells) {
      const wy = Math.floor(c / 4096) * CELL;
      if (wy < limit) continue;
      n++;
      if (other.cells.has(c)) hit++;
    }
    return n ? hit / n : 0;
  };
  return {
    overlap: shared / Math.max(1, Math.min(a.cells.size, b.cells.size)), headA: head(a, b), headB: head(b, a),
    frames: [a.frame, b.frame], states: [fa.state, fb.state], dist: Math.abs(fb.x - fa.x), frame: m.frame,
  };
}

const press = (over: Partial<PlayerInput>): PlayerInput => input(over);
type Act = 'punch' | 'kick' | 'special' | 'jumpin' | 'sweep';
type Setup = 'open' | 'cornerRight' | 'cornerLeft';

function script(act: Act, defender: 'stand' | 'block'): (i: number, s: MatchState) => InputPair {
  return (i, s) => {
    const [a, b] = s.fighters;
    const dir = b.x > a.x ? 1 : -1;
    const dist = Math.abs(b.x - a.x);
    const walk = { right: dir === 1, left: dir === -1 };
    let p1: PlayerInput = press({});
    if (act === 'jumpin') {
      if (a.state === 'idle' && dist > 330) p1 = press(walk);
      else if (a.state === 'idle' && dist <= 330 && a.y === 0) p1 = press({ up: true, ...walk });
      else if (a.y > 80 && a.state === 'jump') p1 = press({ kick: true, ...walk });
      else p1 = press(a.y > 0 ? walk : {});
    } else {
      const gap = act === 'special' ? 360 : act === 'kick' || act === 'sweep' ? 180 : 130;
      if (dist > gap) p1 = press(walk);
      else {
        const k = i % (act === 'special' ? 70 : act === 'kick' || act === 'sweep' ? 34 : 18);
        if (k === 0) p1 = press(act === 'punch' ? { punch: true } : act === 'special' ? { special: true } : act === 'sweep' ? { kick: true, down: true } : { kick: true });
        else if (act !== 'special' && dist > gap - 25 && k > 8) p1 = press(walk); // keep pressing forward between attacks
      }
    }
    const p2 = defender === 'block' ? press({ block: true }) : press({});
    return [p1, p2];
  };
}

function setupMatch(p1: string, p2: string, setup: Setup): MatchState {
  let m = startFight({ p1, p2, roundSeconds: 99 });
  m = patchFighters(m, { meter: 100 }, { meter: 100 });
  if (setup === 'cornerRight') m = patchFighters(m, { x: MAX_X - 120, facing: 1 }, { x: MAX_X, facing: -1 });
  if (setup === 'cornerLeft') m = patchFighters(m, { x: MIN_X, facing: 1 }, { x: MIN_X + 120, facing: -1 });
  return m;
}

/** 12 ordered pairs: every fighter against the next one and against itself (mirror). */
const PAIRS: [string, string][] = IDS.flatMap((id, i) => [[id, IDS[(i + 1) % IDS.length] as string], [id, id]] as [string, string][]);
if (argv.includes('--debug')) { const m0 = setupMatch('tiao', 'dalva', 'open'); const fn = script('punch', 'block'); let st = m0; const ev: string[] = []; for (let i = 0; i < 200; i++) { const r = runFrames(st, 1, (_i, s) => fn(i, s)); st = r.state; for (const e of r.events) if (e.type === 'block' || e.type === 'hit') ev.push(e.type + '@' + i + ' d=' + Math.abs(st.fighters[1].x - st.fighters[0].x).toFixed(0)); } console.log(ev.join(' ')); }
const rows: { scenario: string; pair: string; max: Sample; avgOverlap: number; frames: number }[] = [];
const acts: Act[] = ['punch', 'kick', 'sweep', 'special', 'jumpin'];
for (const setup of ['open', 'cornerRight'] as Setup[]) {
  for (const act of acts) {
    for (const defender of ['stand', 'block'] as const) {
      if (setup === 'cornerRight' && act === 'jumpin') continue;
      for (const [p1, p2] of PAIRS) {
        let state = setupMatch(p1, p2, setup);
        const fn = script(act, defender);
        let worst: Sample | null = null, sum = 0, n = 0;
        for (let i = 0; i < 300; i++) {
          const r = runFrames(state, 1, (_i, s) => fn(i, s));
          state = r.state;
          if (state.phase !== 'fight') break;
          if (act !== 'jumpin' && (state.fighters[0].y > 0 || state.fighters[1].y > 0)) continue; // jump crossings are free by design: measured in the jump-in scenario
          const s = measure(state);
          if (!worst || s.overlap + Math.max(s.headA, s.headB) > worst.overlap + Math.max(worst.headA, worst.headB)) worst = s;
          sum += s.overlap; n++;
        }
        if (worst) rows.push({ scenario: `${setup}/${act}/${defender}`, pair: `${p1}-${p2}`, max: worst, avgOverlap: sum / Math.max(1, n), frames: n });
      }
    }
  }
}

const pct = (v: number): string => `${(v * 100).toFixed(0)}%`;
const byScenario = new Map<string, typeof rows>();
for (const r of rows) byScenario.set(r.scenario, [...(byScenario.get(r.scenario) ?? []), r]);
console.log('scenario                      pairs  worst overlap  worst head  mean overlap');
for (const [name, rs] of byScenario) {
  const mo = Math.max(...rs.map((r) => r.max.overlap)), mh = Math.max(...rs.map((r) => Math.max(r.max.headA, r.max.headB)));
  const mean = rs.reduce((a, r) => a + r.avgOverlap, 0) / rs.length;
  console.log(`${name.padEnd(29)} ${String(rs.length).padStart(5)}  ${pct(mo).padStart(12)}  ${pct(mh).padStart(10)}  ${pct(mean).padStart(11)}`);
}
const filter = val('--filter', '');
const all = rows.filter((r) => r.scenario.includes(filter)).map((r) => ({ ...r, score: r.max.overlap + Math.max(r.max.headA, r.max.headB) })).sort((a, b) => b.score - a.score);
console.log(`\nworst ${val('--top', '12')} cases:`);
for (const r of all.slice(0, Number(val('--top', '12')))) {
  console.log(`  ${r.scenario} ${r.pair} frame ${r.max.frame}: overlap ${pct(r.max.overlap)} head ${pct(r.max.headA)}/${pct(r.max.headB)} dist ${r.max.dist.toFixed(0)} ${r.max.frames[0]}(${r.max.states[0]}) vs ${r.max.frames[1]}(${r.max.states[1]})`);
}
const overall = { worstOverlap: Math.max(...rows.map((r) => r.max.overlap)), worstHead: Math.max(...rows.map((r) => Math.max(r.max.headA, r.max.headB))), meanOverlap: rows.reduce((a, r) => a + r.avgOverlap, 0) / rows.length, runs: rows.length };
console.log('\noverall', JSON.stringify(overall));
writeFileSync(join(ROOT, val('--out', 'art-src/work/overlap.json')), JSON.stringify({ overall, rows: all.slice(0, 60) }, null, 1));
