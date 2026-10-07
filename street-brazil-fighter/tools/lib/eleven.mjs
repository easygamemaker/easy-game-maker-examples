// ElevenLabs client with a credit budget guard, a persistent ledger and a content cache.
// The key is read from ELEVENLABS_API_KEY only. It is never logged or written to a file,
// and every error is reduced to a status and a message that cannot carry request headers.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CACHE_DIR = join(ROOT, 'tools', '.cache', 'eleven');
export const RAW_DIR = join(ROOT, 'art-src', 'audio-raw');
const LEDGER = join(CACHE_DIR, 'ledger.json');
const API = 'https://api.elevenlabs.io';

/** Total credits this round may spend (the owner's cap). */
export const budgetCredits = () => Number(process.env.ELEVEN_BUDGET_CREDITS ?? 20000);

const stable = (v) =>
  Array.isArray(v) ? v.map(stable)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])]))
  : v;

export const keyOf = (endpoint, body, query) =>
  createHash('sha256').update(JSON.stringify(stable({ endpoint, body, query }))).digest('hex').slice(0, 32);

export function safeError(err) {
  const text = String(err?.message ?? err ?? 'unknown error');
  const key = process.env.ELEVENLABS_API_KEY;
  return (key ? text.split(key).join('[redacted]') : text).slice(0, 500);
}

function headers() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY is not set');
  return { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' };
}

export function readLedger() {
  mkdirSync(CACHE_DIR, { recursive: true });
  if (!existsSync(LEDGER)) return { startCredits: null, spentCredits: 0, entries: [] };
  return JSON.parse(readFileSync(LEDGER, 'utf8'));
}
const writeLedger = (l) => writeFileSync(LEDGER, JSON.stringify(l, null, 2));

/** Credits used so far in the billing cycle (character_count) and the plan limit. */
export async function subscription() {
  const res = await fetch(`${API}/v1/user/subscription`, { headers: { 'xi-api-key': headers()['xi-api-key'] } });
  if (!res.ok) throw new Error(`subscription HTTP ${res.status}`);
  const d = await res.json();
  return { tier: d.tier, used: d.character_count, limit: d.character_limit, resetUnix: d.next_character_count_reset_unix };
}

/**
 * One cached, budget-guarded call. `estimate` is the expected credit cost (checked before the call).
 * Returns { file, cached, credits (the estimate charged to the guard) }. The audio goes to art-src/audio-raw/<id>.<ext>.
 */
export async function generate({ id, endpoint, body, query = {}, ext = 'mp3', estimate = 0, meta = {}, dryRun = false }) {
  mkdirSync(CACHE_DIR, { recursive: true });
  mkdirSync(RAW_DIR, { recursive: true });
  const key = keyOf(endpoint, body, query);
  const cacheFile = join(CACHE_DIR, `${key}.${ext}`);
  const rawFile = join(RAW_DIR, `${id}.${ext}`);
  const ledger = readLedger();
  if (existsSync(cacheFile)) {
    writeFileSync(rawFile, readFileSync(cacheFile));
    return { file: rawFile, cached: true, credits: 0, key };
  }
  if (dryRun) return { file: null, cached: false, credits: 0, estimate, key };
  if (ledger.spentCredits + estimate > budgetCredits()) {
    throw new Error(`budget guard: ${ledger.spentCredits} spent + ${estimate} estimated > ${budgetCredits()}`);
  }
  if (ledger.startCredits === null) ledger.startCredits = (await subscription()).used;
  const qs = new URLSearchParams(query).toString();
  const res = await fetch(`${API}${endpoint}${qs ? `?${qs}` : ''}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${endpoint} HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const audio = Buffer.from(await res.arrayBuffer());
  writeFileSync(cacheFile, audio);
  writeFileSync(rawFile, audio);
  // The account usage counter lags a call by many seconds, so a per call delta is unreliable.
  // The guard counts the estimate; `reconcile()` reads the real counter once it has settled.
  ledger.spentCredits += estimate;
  ledger.entries.push({ id, key, endpoint, estimatedCredits: estimate, date: new Date().toISOString().slice(0, 10), bytes: audio.length, ...meta });
  writeLedger(ledger);
  const credits = estimate;
  return { file: rawFile, cached: false, credits, key };
}

/** Waits for the usage counter to settle, then records the real credits spent since the first call. */
export async function reconcile() {
  const ledger = readLedger();
  let now = await subscription();
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const next = await subscription();
    if (next.used === now.used && i >= 2) break;
    now = next;
  }
  ledger.realSpent = now.used - ledger.startCredits;
  ledger.usedNow = now.used;
  ledger.limit = now.limit;
  writeLedger(ledger);
  return ledger;
}
