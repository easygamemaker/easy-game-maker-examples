import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { ROOT, copyTo } from './fal.mjs';

export const RAW = join(ROOT, 'art-src', 'raw');
export const PROMPTS_JSON = join(ROOT, 'art-src', 'prompts.json');

export function parseArgs(argv = process.argv.slice(2)) {
  const a = { dryRun: false, force: false, only: [], seed: null, styleRef: null, sheet: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--dry-run') a.dryRun = true;
    else if (k === '--force') a.force = true;
    else if (k === '--only') a.only = String(argv[++i]).split(',');
    else if (k === '--seed') a.seed = Number(argv[++i]);
    else if (k === '--style-ref') a.styleRef = argv[++i];
    else if (k === '--sheet') a.sheet = argv[++i];
  }
  return a;
}

export function defaultSeed(id) {
  return parseInt(createHash('sha256').update(id).digest('hex').slice(0, 7), 16);
}

export function readProvenance() {
  return existsSync(PROMPTS_JSON) ? JSON.parse(readFileSync(PROMPTS_JSON, 'utf8')) : { entries: [] };
}

/** Records (replaces by id) one provenance entry and copies the raw output next to it. */
export function record(entry, rawFile) {
  const p = readProvenance();
  const entries = p.entries.filter((e) => e.id !== entry.id);
  entries.push(entry);
  entries.sort((x, y) => x.id.localeCompare(y.id));
  mkdirSync(join(ROOT, 'art-src'), { recursive: true });
  writeFileSync(PROMPTS_JSON, JSON.stringify({ note: 'Prompts, models, params and request ids of every generated image. Raw outputs live in art-src/raw (gitignored).', entries }, null, 2) + '\n');
  if (rawFile) copyTo(rawFile, join(RAW, `${entry.id}.${rawFile.split('.').pop()}`));
}

/** Number of previous generations of an id: used to vary the seed on --force. */
export function attemptsOf(id) {
  return readProvenance().entries.find((e) => e.id === id)?.attempt ?? 0;
}
