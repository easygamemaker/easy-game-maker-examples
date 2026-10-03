// Real play-through of the built game with keyboard events, like a person would drive it.
// Writes full-size PNG screenshots and filmstrips (contact sheets of frames sampled during one action) to
// art-src/playtest (gitignored). A curated subset is converted to WebP into docs/playtest by --curate.
//
// Usage: node tools/playtest.mjs [--no-build] [--suite menus,fighters,ko,chaos,autoplay,all] [--only tiao,saci]
// Playwright is resolved like in browser-check.mjs (PLAYWRIGHT_DIR, EGM_SDK_DIR, sibling checkout).
import { mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import sharp from 'sharp';
import { ROOT } from './fal.mjs';
import { LAUNCH_ARGS, loadPlaywright, serve } from './lib/browser.mjs';

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(n);
const opt = (n, d) => (argv.includes(n) ? argv[argv.indexOf(n) + 1] : d);
const SUITES = new Set(opt('--suite', 'all').split(','));
const want = (s) => SUITES.has('all') || SUITES.has(s);
const ONLY = opt('--only', '').split(',').filter(Boolean);
const OUT = join(ROOT, 'art-src', 'playtest');
mkdirSync(OUT, { recursive: true });

const FIGHTERS = ['tiao', 'dalva', 'saci', 'curupira', 'craque', 'rosa'];
const STAGES = ['pelourinho', 'copacabana', 'amazonia', 'paulista', 'sambodromo', 'pantanal', 'lencois', 'corcovado', 'ouropreto'];
const fighters = FIGHTERS.filter((f) => !ONLY.length || ONLY.includes(f));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (!flag('--no-build')) execFileSync('npx', ['vite', 'build'], { cwd: ROOT, stdio: 'inherit' });
const { chromium } = loadPlaywright();
const { server, port } = await serve();
const base = `http://127.0.0.1:${port}/`;
const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
const errors = [];
const report = [];
const note = (line) => { report.push(line); console.log(line); };

async function newPage(query = '') {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 700 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
  await page.goto(base + query);
  return { page, ctx };
}

const hook = (page) => page.evaluate(() => {
  const h = window.__SBF__;
  const m = h?.match;
  return h && {
    scene: h.scene, done: h.done, winner: h.winner, frame: h.frame, camX: h.camX, shown: h.shown, paused: h.paused,
    phase: m?.phase, round: m?.round, wins: m?.wins, banner: m?.banner,
    x: m?.fighters.map((f) => f.x), hp: m?.fighters.map((f) => f.health), meter: m?.fighters.map((f) => f.meter),
    state: m?.fighters.map((f) => f.state), pose: m?.fighters.map((f) => f.pose), mf: m?.fighters.map((f) => f.moveFrame),
    facing: m?.fighters.map((f) => f.facing), y: m?.fighters.map((f) => f.y),
  };
});
const waitScene = (page, scene, timeout = 40000) => page.waitForFunction((s) => window.__SBF__?.scene === s, scene, { timeout });
const waitPhase = (page, phase, timeout = 60000) => page.waitForFunction((p) => window.__SBF__?.match?.phase === p, phase, { timeout });
const waitFrames = (page, n) => page.evaluate((k) => new Promise((ok) => {
  const f0 = window.__SBF__.frame;
  const tick = () => (window.__SBF__.frame >= f0 + k ? ok() : requestAnimationFrame(tick));
  tick();
}), n);
const hold = async (page, key, frames) => { await page.keyboard.down(key); await waitFrames(page, frames); await page.keyboard.up(key); };
const tap = (page, key, frames = 3) => hold(page, key, frames);
/** Menu key press in real time (the sim frame counter does not run outside a fight). */
const press = async (page, key) => { await page.keyboard.down(key); await sleep(110); await page.keyboard.up(key); await sleep(90); };
const png = (name, buf) => sharp(buf).png({ compressionLevel: 9 }).toFile(join(OUT, `${name}.png`));
const full = async (page, name) => png(name, await page.screenshot({ type: 'png' }));

/**
 * Samples n screenshots, one every `every` sim frames, cropped around the fighters, while `action` runs, and
 * composes them into one labelled contact sheet. Returns the infos of the frames (state, shown frame name...).
 */
async function filmstrip(page, name, { focus = 0, n = 10, every = 3, width = 520, top = 170, height = 450, action, cols = 6, scale = 0.62 }) {
  const task = action ? action() : Promise.resolve();
  const tiles = [];
  let last = -1e9;
  for (let i = 0; i < n; i++) {
    await page.waitForFunction(([f, e]) => (window.__SBF__?.frame ?? 0) >= f + e, [last, every], { timeout: 30000 });
    const info = await hook(page);
    const cx = (focus === 'mid' ? (info.x[0] + info.x[1]) / 2 : info.x[focus]) - info.camX;
    const left = Math.round(Math.min(1300 - width, Math.max(0, cx - width / 2)));
    const buf = await page.screenshot({ type: 'png', clip: { x: left, y: top, width, height } });
    last = info.frame;
    tiles.push({ buf, info });
  }
  await task;
  const tw = Math.round(width * scale), th = Math.round(height * scale);
  const rows = Math.ceil(tiles.length / cols);
  const comps = [];
  for (let i = 0; i < tiles.length; i++) {
    const t = tiles[i];
    const lbl = `${t.info.shown[typeof focus === 'number' ? focus : 0]}  f${t.info.frame}`;
    const svg = `<svg width="${tw}" height="${th}" xmlns="http://www.w3.org/2000/svg"><rect width="${tw}" height="${th}" fill="none" stroke="#ffffff55"/><rect x="0" y="0" width="${tw}" height="20" fill="#000000aa"/><text x="6" y="15" font-size="14" fill="#fff" font-family="Helvetica, Arial">${lbl}</text></svg>`;
    const tile = await sharp(t.buf).resize(tw, th).png().toBuffer();
    comps.push({ input: tile, left: (i % cols) * tw, top: Math.floor(i / cols) * th });
    comps.push({ input: Buffer.from(svg), left: (i % cols) * tw, top: Math.floor(i / cols) * th });
  }
  await sharp({ create: { width: tw * Math.min(cols, tiles.length), height: th * rows, channels: 3, background: '#10131f' } }).composite(comps).png({ compressionLevel: 9 }).toFile(join(OUT, `${name}.png`));
  return tiles.map((t) => t.info);
}

const setSpeed = (page, v) => page.evaluate((x) => { window.__SBF__.speed = x; }, v);

const startDummyFight = async (id, opp, stage, extra = '') => {
  const { page, ctx } = await newPage(`?quick=1&p1=${id}&p2=${opp}&stage=${stage}&p2mode=dummy&seed=3&meter=1${extra}`);
  await waitScene(page, 'fight');
  await waitPhase(page, 'fight');
  return { page, ctx };
};

// ---- menus: the real menu flow to a 1P fight ---------------------------------------------------------------

async function menus() {
  const { page, ctx } = await newPage();
  await waitScene(page, 'title');
  await sleep(700);
  await full(page, 'menu-01-title');
  await press(page, 'Enter');
  await waitScene(page, 'select');
  await sleep(600);
  await full(page, 'menu-02-mode-or-select');
  // step through the roster with the real keys and capture each fighter highlighted
  for (let i = 0; i < 3; i++) { await press(page, 'KeyD'); await sleep(250); }
  await full(page, 'menu-03-select-p1');
  await press(page, 'KeyJ');
  await sleep(1200);
  await full(page, 'menu-04-select-p2');
  await waitScene(page, 'stage', 60000);
  await sleep(600);
  await full(page, 'menu-05-stage-select');
  for (let i = 0; i < 4; i++) { await press(page, 'KeyD'); await sleep(120); }
  for (let i = 0; i < 2; i++) { await press(page, 'KeyS'); await sleep(120); }
  await full(page, 'menu-06-stage-select-last-row');
  await press(page, 'KeyJ');
  await waitScene(page, 'fight', 60000);
  await waitPhase(page, 'fight');
  await sleep(1500);
  await full(page, 'menu-07-fight-1p');
  await press(page, 'Enter');
  await sleep(400);
  const h = await hook(page);
  await full(page, 'menu-08-pause');
  note(`menus: reached a 1P fight, pause ${h.paused ? 'works' : 'did NOT open'}`);
  await ctx.close();
}

// ---- one filmstrip session per fighter (P2 is a dummy so the actions are repeatable) -----------------------

async function fighterSuite(id, i) {
  const opp = FIGHTERS[(FIGHTERS.indexOf(id) + 1) % FIGHTERS.length];
  const stage = STAGES[(i * 2 + 1) % STAGES.length];
  const { page, ctx } = await startDummyFight(id, opp, stage, '&speed=6');
  note(`fighters: ${id} vs ${opp} dummy on ${stage}`);
  const strip = async (name, opts) => {
    await setSpeed(page, 0.1);
    const infos = await filmstrip(page, `strip-${id}-${name}`, { ...opts, every: 1 });
    await setSpeed(page, 6);
    note(`  ${name}: ${infos.map((x) => x.shown[opts.focus === 'mid' ? 0 : (opts.focus ?? 0)]).join(' ')}`);
  };
  await strip('idle', { n: 14 });
  await png(`shot-${id}-idle`, await page.screenshot({ type: 'png' }));
  await strip('walk', { n: 14, action: () => hold(page, 'KeyD', 40) });
  await strip('walkback', { n: 12, action: () => hold(page, 'KeyA', 36) });
  await strip('jump', { n: 16, top: 40, height: 580, action: () => tap(page, 'KeyW', 2) });
  await waitFrames(page, 20);
  await hold(page, 'KeyS', 20).catch(() => {});
  await page.keyboard.down('KeyS'); await waitFrames(page, 12);
  await png(`shot-${id}-crouch`, await page.screenshot({ type: 'png', clip: { x: 0, y: 170, width: 1300, height: 450 } }));
  await page.keyboard.up('KeyS');
  await page.keyboard.down('KeyU'); await waitFrames(page, 12);
  await png(`shot-${id}-block`, await page.screenshot({ type: 'png', clip: { x: 0, y: 170, width: 1300, height: 450 } }));
  await page.keyboard.up('KeyU');
  await waitFrames(page, 20);
  await strip('punch', { n: 10, action: () => tap(page, 'KeyJ', 2) });
  await waitFrames(page, 30);
  await strip('kick', { n: 14, action: () => tap(page, 'KeyK', 2) });
  await waitFrames(page, 40);
  // close in on the dummy for the hit moment and the special
  await page.keyboard.down('KeyD');
  for (let k = 0; k < 200; k++) {
    const h = await hook(page);
    if (Math.abs(h.x[1] - h.x[0]) < 150) break;
    await waitFrames(page, 4);
  }
  await page.keyboard.up('KeyD');
  await strip('hit', { focus: 'mid', width: 640, n: 12, action: () => tap(page, 'KeyJ', 2) });
  await waitFrames(page, 60);
  await strip('special', { focus: 'mid', width: 760, n: 16, action: () => tap(page, 'KeyL', 2) });
  const hs = await hook(page);
  note(`  after the special: P2 hp ${hs.hp[1]} (state ${hs.state[1]}), P1 meter ${hs.meter[0]}`);
  await ctx.close();
}

// ---- KO route against the dummy: round banners, KO, match end banner and the result screen -----------------

async function koRoute(id, i) {
  const opp = FIGHTERS[(FIGHTERS.indexOf(id) + 2) % FIGHTERS.length];
  const stage = STAGES[(i * 3 + 2) % STAGES.length];
  const { page, ctx } = await startDummyFight(id, opp, stage, '&speed=3');
  let shotsKo = false, shotsEnd = false, shotsR2 = false;
  const t0 = Date.now();
  let h = await hook(page);
  while (h.scene === 'fight' && Date.now() - t0 < 240000) {
    if (h.phase === 'fight') {
      if (Math.abs(h.x[1] - h.x[0]) > 140) await page.keyboard.down('KeyD');
      else { await page.keyboard.up('KeyD'); await tap(page, Math.random() < 0.5 ? 'KeyJ' : 'KeyK', 3); }
    } else await page.keyboard.up('KeyD');
    if (h.phase === 'ko' && !shotsKo) { await sleep(500); await full(page, `ko-${id}-1-ko`); shotsKo = true; }
    if (h.round === 2 && h.phase === 'intro' && !shotsR2) { await sleep(150); await full(page, `ko-${id}-2-round2`); shotsR2 = true; }
    if (h.phase === 'matchEnd' && !shotsEnd) { await sleep(500); await full(page, `ko-${id}-3-matchend`); shotsEnd = true; }
    await sleep(60);
    h = await hook(page);
  }
  await page.keyboard.up('KeyD');
  if (h.scene === 'result') { await sleep(900); await full(page, `ko-${id}-4-result`); }
  note(`ko: ${id} vs ${opp} dummy: ko shot ${shotsKo}, round 2 shot ${shotsR2}, match end shot ${shotsEnd}, ended in scene ${h.scene}`);
  await ctx.close();
}

// ---- chaos: a scripted human-like player against a hard CPU, screenshots every few seconds ------------------

async function chaos(id, i) {
  const opp = FIGHTERS[(FIGHTERS.indexOf(id) + 3) % FIGHTERS.length];
  const stage = STAGES[(i * 4 + 3) % STAGES.length];
  const { page, ctx } = await newPage(`?quick=1&p1=${id}&p2=${opp}&stage=${stage}&diff=hard&seed=${i + 11}`);
  await waitScene(page, 'fight');
  await waitPhase(page, 'fight');
  const t0 = Date.now();
  let n = 0, nextShot = 1500;
  const seen = new Set();
  while (Date.now() - t0 < 24000) {
    const h = await hook(page);
    if (h.phase !== 'fight') { await sleep(300); continue; }
    h.state.forEach((s) => seen.add(s));
    const toward = h.x[1] > h.x[0] ? 'KeyD' : 'KeyA', away = toward === 'KeyD' ? 'KeyA' : 'KeyD';
    const near = Math.abs(h.x[1] - h.x[0]) < 200;
    const r = Math.random();
    if (!near && r < 0.7) await hold(page, toward, 14);
    else if (r < 0.3) await tap(page, 'KeyJ', 3);
    else if (r < 0.5) await tap(page, 'KeyK', 3);
    else if (r < 0.6 && h.meter[0] >= 50) await tap(page, 'KeyL', 3);
    else if (r < 0.72) await hold(page, 'KeyU', 20);
    else if (r < 0.8) await tap(page, 'KeyW', 3);
    else if (r < 0.88) await hold(page, 'KeyS', 18);
    else await hold(page, away, 10);
    if (Date.now() - t0 > nextShot) { await full(page, `chaos-${id}-${n++}`); nextShot += 3500; }
  }
  const h = await hook(page);
  note(`chaos: ${id} vs ${opp} (hard CPU) on ${stage}: states seen ${[...seen].join(',')}; hp ${h.hp}; ${n} shots`);
  await ctx.close();
}

// ---- autoplay: every pair, CPU vs CPU, long matches with a stuck-state watchdog --------------------------------

async function autoplay() {
  const pairs = [];
  for (let a = 0; a < FIGHTERS.length; a++) for (let b = a; b < FIGHTERS.length; b++) pairs.push([FIGHTERS[a], FIGHTERS[b]]);
  const run = async ([a, b], k) => {
    const { page, ctx } = await newPage(`?autoplay=cpu&p1=${a}&p2=${b}&stage=${STAGES[k % STAGES.length]}&seed=${k + 2}&diff=hard&speed=16`);
    await waitScene(page, 'fight');
    const t0 = Date.now();
    let prev = null, stuckSince = Date.now(), stuck = false, h = null;
    while (Date.now() - t0 < 150000) {
      h = await hook(page);
      if (h.done) break;
      if (prev && h.frame === prev.frame) { if (Date.now() - stuckSince > 6000) { stuck = true; break; } } else stuckSince = Date.now();
      prev = h;
      await sleep(400);
    }
    const ok = Boolean(h?.done) && !stuck;
    note(`autoplay ${a} vs ${b}: ${ok ? 'finished' : stuck ? 'STUCK (frame stopped)' : 'TIMEOUT'} winner ${h?.winner} wins ${JSON.stringify(h?.wins)} frame ${h?.frame} in ${Math.round((Date.now() - t0) / 1000)} s`);
    await ctx.close();
    return ok;
  };
  const oks = [];
  for (let i = 0; i < pairs.length; i += 3) oks.push(...(await Promise.all(pairs.slice(i, i + 3).map((p, j) => run(p, i + j)))));
  note(`autoplay: ${oks.filter(Boolean).length}/${oks.length} pairs finished a full match`);
}

/** Two full CPU vs CPU matches at 4x with periodic screenshots. */
async function cpuMatches() {
  const pairs = [['tiao', 'rosa', 'copacabana'], ['saci', 'curupira', 'amazonia']];
  for (const [a, b, st] of pairs) {
    const { page, ctx } = await newPage(`?autoplay=cpu&p1=${a}&p2=${b}&stage=${st}&seed=21&diff=normal&speed=4`);
    await waitScene(page, 'fight');
    const t0 = Date.now();
    let n = 0, h = await hook(page);
    while (!h.done && Date.now() - t0 < 200000) {
      await sleep(3500);
      await full(page, `cpu-${a}-vs-${b}-${n++}`);
      h = await hook(page);
    }
    await sleep(1200);
    await full(page, `cpu-${a}-vs-${b}-end`);
    note(`cpu match ${a} vs ${b}: done ${h.done}, winner ${h.winner}, wins ${JSON.stringify(h.wins)}, ${n} shots, ${Math.round((Date.now() - t0) / 1000)} s`);
    await ctx.close();
  }
}

try {
  if (want('menus')) await menus();
  if (want('fighters')) for (const [i, id] of fighters.entries()) await fighterSuite(id, i);
  if (want('ko')) for (const [i, id] of fighters.entries()) await koRoute(id, i);
  if (want('chaos')) for (let i = 0; i < fighters.length; i += 3) await Promise.all(fighters.slice(i, i + 3).map((id, j) => chaos(id, i + j)));
  if (want('cpu')) await cpuMatches();
  if (want('autoplay')) await autoplay();
} finally {
  await browser.close();
  server.close();
}
note(`console errors: ${errors.length}${errors.length ? ' ' + errors.slice(0, 5).join(' | ') : ''}`);
writeFileSync(join(OUT, 'report.txt'), report.join('\n') + '\n');
process.exit(errors.length ? 1 : 0);
