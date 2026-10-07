// Generates the game audio with ElevenLabs. Always start with --dry-run.
//   node tools/generate-audio.mjs --dry-run
//   node tools/generate-audio.mjs --only punch,ann_fight
//   node tools/generate-audio.mjs --kind music
// Needs ELEVENLABS_API_KEY in the environment (never written anywhere). Budget: ELEVEN_BUDGET_CREDITS (default 20000).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, budgetCredits, generate, readLedger, reconcile, safeError, subscription } from './lib/eleven.mjs';
import { ALL_JOBS, FORMAT, jobRequest } from './audio-jobs.mjs';

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n) => (args.includes(n) ? args[args.indexOf(n) + 1] : null);
const dryRun = flag('--dry-run');
const only = val('--only')?.split(',') ?? null;
const kind = val('--kind');
const OUT = join(ROOT, 'art-src', 'audio-prompts.json');

const jobs = ALL_JOBS.filter((j) => (!only || only.includes(j.id)) && (!kind || j.kind === kind));
const prior = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : { entries: [] };
const entries = new Map(prior.entries.map((e) => [e.id, e]));
let estimateTotal = 0;
let failures = 0;

for (const job of jobs) {
  const req = jobRequest(job);
  try {
    const r = await generate({ id: job.id, endpoint: req.endpoint, body: req.body, query: { output_format: FORMAT }, estimate: req.estimate, dryRun });
    estimateTotal += r.cached ? 0 : req.estimate;
    console.log(`${dryRun ? 'dry ' : r.cached ? 'cache' : 'new  '} ${job.kind.padEnd(5)} ${job.id.padEnd(18)} ~${req.estimate} credits`);
    if (!dryRun) {
      const old = entries.get(job.id);
      entries.set(job.id, {
        id: job.id, kind: job.kind, endpoint: req.endpoint, model: req.model, voiceId: req.voiceId,
        params: req.body, outputFormat: FORMAT, cacheKey: r.key,
        date: r.cached && old ? old.date : new Date().toISOString().slice(0, 10),
        estimatedCredits: r.cached && old ? old.estimatedCredits : req.estimate,
      });
    }
  } catch (err) {
    failures++;
    console.log(`FAIL  ${job.id}: ${safeError(err)}`);
  }
}
console.log(`${jobs.length} jobs, estimated new spend ${estimateTotal} credits (cap ${budgetCredits()}, guard so far ${readLedger().spentCredits})`);
if (!dryRun) {
  const sorted = [...entries.values()].sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(OUT, JSON.stringify({
    note: 'Every ElevenLabs request of the game: endpoint, model, voice id, parameters (including the prompt), date and estimated credits. Raw outputs live in art-src/audio-raw (gitignored). The real credit totals are in the README.',
    entries: sorted,
  }, null, 2) + '\n');
  if (flag('--reconcile')) {
    const l = await reconcile();
    console.log(`real credits since start: ${l.realSpent} (account ${l.usedNow}/${l.limit})`);
  } else console.log('account now', JSON.stringify(await subscription()));
}
process.exit(failures ? 1 : 0);
