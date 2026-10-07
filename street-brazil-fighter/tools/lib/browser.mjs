// Shared by browser-check.mjs and playtest.mjs: Playwright lookup, a static server for dist/ and a page factory.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, join, normalize, resolve } from 'node:path';
import { ROOT } from '../fal.mjs';

export const DIST = join(ROOT, 'dist');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.css': 'text/css' };

/** Playwright is not a dependency: PLAYWRIGHT_DIR, local node_modules, EGM_SDK_DIR or a sibling easy-game-maker checkout. */
export function loadPlaywright() {
  const dirs = [process.env.PLAYWRIGHT_DIR, join(ROOT, 'node_modules'), process.env.EGM_SDK_DIR && join(process.env.EGM_SDK_DIR, 'node_modules'), resolve(ROOT, '..', '..', 'easy-game-maker', 'node_modules'), resolve(ROOT, '..', 'easy-game-maker', 'node_modules')].filter(Boolean);
  for (const d of dirs) {
    if (existsSync(join(d, 'playwright'))) return createRequire(join(d, 'x.js'))('playwright');
  }
  throw new Error('playwright not found; set PLAYWRIGHT_DIR or EGM_SDK_DIR');
}

export function serve() {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    let p = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
    if (p === '/' || p === '\\') p = '/index.html';
    const file = join(DIST, p);
    if (!file.startsWith(DIST) || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  });
  return new Promise((ok) => server.listen(0, '127.0.0.1', () => ok({ server, port: server.address().port })));
}

export const LAUNCH_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
