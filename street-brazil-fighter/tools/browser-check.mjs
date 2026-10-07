// Headless browser check: builds the game, serves dist/, drives it with Playwright (Chromium, 1300x700),
// writes optimized screenshots to docs/screenshots, asserts zero console errors, plays a full CPU vs CPU
// match through window.__SBF__ and checks that a keyboard punch from P1 hurts a standing P2.
//
// Playwright is not a dependency of this example. It is resolved from, in order: PLAYWRIGHT_DIR, the local
// node_modules, EGM_SDK_DIR/node_modules (an easy-game-maker checkout) or ../../easy-game-maker/node_modules.
// Usage: node tools/browser-check.mjs [--no-build] [--shots-only]
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import sharp from 'sharp';
import { ROOT } from './fal.mjs';
import { LAUNCH_ARGS, loadPlaywright, serve } from './lib/browser.mjs';

const args = new Set(process.argv.slice(2));
const SHOTS = join(ROOT, 'docs', 'screenshots');

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
};

async function shot(page, name) {
  mkdirSync(SHOTS, { recursive: true });
  const buf = await page.screenshot({ type: 'png' });
  await sharp(buf).webp({ quality: 80 }).toFile(join(SHOTS, `${name}.webp`));
}

const hookOf = (page) => page.evaluate(() => {
  const h = window.__SBF__;
  if (!h) return null;
  const m = h.match;
  return { scene: h.scene, done: h.done, winner: h.winner, frame: h.frame, phase: m?.phase, round: m?.round, wins: m?.wins, hp: m?.fighters.map((f) => f.health), x: m?.fighters.map((f) => f.x), state: m?.fighters.map((f) => f.state) };
});
const waitScene = (page, scene, timeout = 20000) => page.waitForFunction((s) => window.__SBF__?.scene === s, scene, { timeout });
// a press must last a few rendered frames: the menus read key edges once per frame and headless software rendering is slow
const tap = async (page, key, wait = 200) => { await page.keyboard.down(key); await page.waitForTimeout(260); await page.keyboard.up(key); await page.waitForTimeout(wait); };

if (!args.has('--no-build')) execFileSync('npx', ['vite', 'build'], { cwd: ROOT, stdio: 'inherit' });
const { chromium } = loadPlaywright();
const { server, port } = await serve();
const base = `http://127.0.0.1:${port}/`;
const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
const errors = [];
const newPage = async (query = '') => {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 700 } });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`http ${r.status()}: ${r.url()}`); });
  await page.goto(base + query);
  return { page, ctx };
};

try {
  // 1. menu flow with real keys + screenshots
  {
    const { page, ctx } = await newPage();
    await waitScene(page, 'title');
    await page.waitForTimeout(600);
    await shot(page, '01-title');
    check('title scene reached', true);
    await tap(page, 'Enter', 700);
    await waitScene(page, 'select');
    await page.waitForTimeout(500);
    await tap(page, 'KeyD'); await tap(page, 'KeyD'); await tap(page, 'KeyS');
    await shot(page, '02-character-select');
    await tap(page, 'KeyJ', 300);
    await page.waitForTimeout(900);
    await shot(page, '03-character-select-cpu');
    await waitScene(page, 'stage', 40000);
    await page.waitForTimeout(600);
    await tap(page, 'KeyD'); await tap(page, 'KeyS');
    await shot(page, '04-stage-select');
    await tap(page, 'KeyJ', 300);
    await waitScene(page, 'fight', 40000);
    await page.waitForFunction(() => window.__SBF__?.match?.phase === 'fight', null, { timeout: 40000 });
    await page.waitForTimeout(2200);
    await shot(page, '05-fight');
    const s = await hookOf(page);
    check('menu flow reaches a fight', s?.phase === 'fight', JSON.stringify({ phase: s?.phase, round: s?.round }));
    await ctx.close();
  }

  // 2. keyboard punch hits a standing P2 (dummy), with hitboxes drawn for one extra screenshot
  {
    const { page, ctx } = await newPage('?quick=1&p1=tiao&p2=tiao&stage=copacabana&p2mode=dummy&seed=3&hitboxes=1');
    await waitScene(page, 'fight');
    await page.waitForFunction(() => window.__SBF__?.match?.phase === 'fight', null, { timeout: 40000 });
    const start = await hookOf(page);
    await page.keyboard.down('KeyD');
    for (let i = 0; i < 80; i++) {
      const h = await hookOf(page);
      if (h && Math.abs(h.x[1] - h.x[0]) < 120) break;
      await page.waitForTimeout(50);
    }
    await page.keyboard.up('KeyD');
    for (let i = 0; i < 4; i++) { await tap(page, 'KeyJ', 250); }
    await page.waitForTimeout(150);
    await shot(page, '06-fight-hitboxes');
    const end = await hookOf(page);
    check('keyboard punch reduces P2 health', end.hp[1] < start.hp[1], `P2 hp ${start.hp[1]} -> ${end.hp[1]}`);
    await ctx.close();
  }

  // 2b. every fighter and every stage loads and fights; a few extra screenshots
  if (!args.has('--shots-only')) {
    const ids = ['tiao', 'dalva', 'saci', 'curupira', 'craque', 'rosa'];
    const stages = ['pelourinho', 'copacabana', 'amazonia', 'paulista', 'sambodromo', 'pantanal', 'lencois', 'corcovado', 'ouropreto'];
    let ok = 0;
    for (let i = 0; i < stages.length; i++) {
      const p1 = ids[i % 6], p2 = ids[(i + 1) % 6];
      const { page, ctx } = await newPage(`?quick=1&p1=${p1}&p2=${p2}&stage=${stages[i]}&seed=${i + 1}&diff=hard&speed=2`);
      await waitScene(page, 'fight');
      await page.waitForFunction(() => window.__SBF__?.match?.phase === 'fight', null, { timeout: 20000 });
      await page.waitForTimeout(3500);
      const h = await hookOf(page);
      if (h?.phase) ok++;
      if (['saci', 'curupira', 'craque', 'rosa'].includes(p1) && i < 8 && i % 2 === 0) await shot(page, `07-fight-${p1}-vs-${p2}-${stages[i]}`);
      await ctx.close();
    }
    check('all 6 fighters and 9 stages load and fight', ok === stages.length, `${ok}/${stages.length}`);
  }

  // 3. CPU vs CPU full match through the automation hook
  if (!args.has('--shots-only')) {
    const { page, ctx } = await newPage('?autoplay=cpu&speed=8&seed=5&diff=normal');
    await waitScene(page, 'fight');
    const t0 = Date.now();
    let state = null;
    while (Date.now() - t0 < 180000) {
      state = await hookOf(page);
      if (state?.done) break;
      await page.waitForTimeout(500);
    }
    check('autoplay=cpu finishes a full match', Boolean(state?.done), `winner ${state?.winner}, wins ${JSON.stringify(state?.wins)}, ${Math.round((Date.now() - t0) / 1000)} s real time`);
    check('a fighter won two rounds', Boolean(state?.wins && Math.max(...state.wins) >= 2));
    await ctx.close();
  }
  check('zero console errors', errors.length === 0, errors.slice(0, 5).join(' | '));
} finally {
  await browser.close();
  server.close();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`${results.length - failed}/${results.length} browser checks passed`);
process.exit(failed ? 1 : 0);
