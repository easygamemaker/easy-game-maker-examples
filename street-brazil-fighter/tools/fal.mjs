// fal.ai client wrapper with a budget guard, a persistent ledger and a content cache.
// The API key is read by @fal-ai/client from the FAL_KEY environment variable only.
// It is never logged, never written to a file, and error output is reduced to a safe message.
import { fal } from '@fal-ai/client';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE_DIR = join(ROOT, 'tools', '.cache');
const LEDGER = join(CACHE_DIR, 'ledger.json');
const JOBS = join(CACHE_DIR, 'jobs');
const FILES = join(CACHE_DIR, 'files');

/** Verified on fal.ai on 2026-10-03: 1K and 2K cost 0.15 USD per image, 4K is double. */
export const PRICE_USD = { '1K': 0.15, '2K': 0.15, '4K': 0.3 };
export const MODEL_T2I = 'fal-ai/nano-banana-pro';
export const MODEL_EDIT = 'fal-ai/nano-banana-pro/edit';

export const budgetUsd = () => Number(process.env.FAL_BUDGET_USD ?? 15);

export function estimateUsd(input) {
  return (PRICE_USD[input.resolution ?? '1K'] ?? 0.3) * (input.num_images ?? 1);
}

function ensureDirs() {
  for (const d of [CACHE_DIR, JOBS, FILES]) mkdirSync(d, { recursive: true });
}

export function readLedger() {
  ensureDirs();
  if (!existsSync(LEDGER)) return { spentUsd: 0, entries: [] };
  return JSON.parse(readFileSync(LEDGER, 'utf8'));
}

function writeLedger(l) {
  writeFileSync(LEDGER, JSON.stringify(l, null, 2));
}

function stable(v) {
  if (Array.isArray(v)) return v.map(stable);
  if (v && typeof v === 'object') {
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])]));
  }
  return v;
}

export function cacheKey(model, input) {
  return createHash('sha256').update(JSON.stringify(stable({ model, input }))).digest('hex').slice(0, 32);
}

/** Reduces any error to a message that cannot carry request headers or credentials. */
export function safeError(err) {
  const status = err?.status ?? err?.response?.status;
  const body = err?.body?.detail ?? err?.body?.message ?? err?.message ?? 'unknown error';
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const key = process.env.FAL_KEY;
  const clean = key ? text.split(key).join('[redacted]') : text;
  return `${status ? `HTTP ${status}: ` : ''}${clean.slice(0, 400)}`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function withRetry(fn, label, attempts = 4) {
  let delay = 2000;
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      const status = err?.status ?? err?.response?.status;
      const retryable = !status || status >= 500 || status === 429;
      if (!retryable || i >= attempts) throw new Error(`${label}: ${safeError(err)}`);
      console.warn(`  retry ${i}/${attempts - 1} for ${label} in ${delay}ms (${safeError(err)})`);
      await sleep(delay);
      delay *= 2;
    }
  }
}

async function download(url, dest) {
  const res = await withRetry(async () => {
    const r = await fetch(url);
    if (!r.ok) throw Object.assign(new Error(`download failed`), { status: r.status });
    return r;
  }, 'download');
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

export async function uploadReference(path) {
  const buf = readFileSync(path);
  return withRetry(() => fal.storage.upload(new Blob([buf], { type: 'image/png' })), 'upload');
}

/**
 * Runs one generation job. Returns { files: string[], requestId, cached, costUsd, input }.
 * `refHashes` lets the cache key include the content of reference images instead of their URLs.
 */
export async function runJob({ model, input, label, force = false, dryRun = false, refHashes = [] }) {
  ensureDirs();
  const key = cacheKey(model, { ...input, image_urls: refHashes.length ? refHashes : undefined });
  const jobFile = join(JOBS, `${key}.json`);
  const estimate = estimateUsd(input);

  if (!force && existsSync(jobFile)) {
    const job = JSON.parse(readFileSync(jobFile, 'utf8'));
    if (job.files.every((f) => existsSync(f))) {
      console.log(`  [cache] ${label} (no cost)`);
      return { ...job, cached: true, costUsd: 0 };
    }
  }

  const ledger = readLedger();
  if (dryRun) {
    console.log(`  [dry-run] ${label}: ${model} ~$${estimate.toFixed(2)} (spent $${ledger.spentUsd.toFixed(2)} of $${budgetUsd()})`);
    return { files: [], cached: false, costUsd: 0, dryRun: true };
  }
  if (ledger.spentUsd + estimate > budgetUsd() + 1e-9) {
    throw new Error(`budget guard: spent $${ledger.spentUsd.toFixed(2)} + $${estimate.toFixed(2)} would exceed $${budgetUsd()}`);
  }
  if (!process.env.FAL_KEY) throw new Error('FAL_KEY is not set in the environment');

  console.log(`  [submit] ${label} (${model}, ~$${estimate.toFixed(2)})`);
  const result = await withRetry(
    () => fal.subscribe(model, {
      input,
      logs: false,
      onEnqueue: (id) => console.log(`    request id ${id}`),
    }),
    label,
  );
  const images = result?.data?.images ?? [];
  if (!images.length) throw new Error(`${label}: response had no images`);

  const files = [];
  for (let i = 0; i < images.length; i++) {
    const ext = (images[i].content_type ?? 'image/png').split('/')[1] ?? 'png';
    const dest = join(FILES, `${key}-${i}.${ext}`);
    await download(images[i].url, dest);
    files.push(dest);
  }
  const job = { files, requestId: result.requestId, model, date: new Date().toISOString() };
  writeFileSync(jobFile, JSON.stringify(job, null, 2));
  const l2 = readLedger();
  l2.spentUsd = Math.round((l2.spentUsd + estimate) * 1e4) / 1e4;
  l2.entries.push({ label, model, key, requestId: result.requestId, costUsd: estimate, date: job.date });
  writeLedger(l2);
  console.log(`    done, spent total $${l2.spentUsd.toFixed(2)} of $${budgetUsd()}`);
  return { ...job, cached: false, costUsd: estimate };
}

export function copyTo(src, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(src, dest);
}

export const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex').slice(0, 16);

// Tools fail with a one-line message instead of a stack trace (the message never contains credentials).
const bail = (e) => {
  console.error(`ERROR: ${e?.message ?? e}`);
  process.exit(2);
};
process.on('unhandledRejection', bail);
process.on('uncaughtException', bail);
