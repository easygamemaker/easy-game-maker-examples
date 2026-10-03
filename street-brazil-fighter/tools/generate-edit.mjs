// Round 2 generation: redesign redraws (Saci one leg, Curupira backwards feet) and the per-fighter animation
// sheets C (walk + idle) and D (attacks). Everything goes through /edit with a reference rebuilt from the atlas.
// ALWAYS run with --dry-run first and always with one specific --job: this never loops over the roster.
// Usage: node tools/generate-edit.mjs --job <id> [--dry-run] [--force]
//   jobs: redo-saci-a, redo-saci-b, redo-curupira-a, redo-curupira-b, anim-<fighter>-c, anim-<fighter>-d, anim-<fighter>-d1
//   (d1 = sheet D with the idle sheet only as reference, used when the two-reference variant fails)
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { MODEL_EDIT, runJob, uploadReference, sha256File, budgetUsd, readLedger, ROOT } from './fal.mjs';
import {
  CHARACTERS, ANIM_DESC, POSES_A, POSES_B, SACI_ONE_LEG, CURUPIRA_BACK_FEET,
  redoPromptA, redoPromptB, sheetPromptC, sheetPromptD, sheetPromptDOne,
} from './prompts.mjs';
import { parseArgs, defaultSeed, record, attemptsOf, RAW } from './common.mjs';
import { buildRefSheet } from './lib/refsheet.mjs';

const argv = process.argv.slice(2);
const jobId = argv[argv.indexOf('--job') + 1];
const args = parseArgs(argv);
if (!jobId || jobId.startsWith('--')) throw new Error('pass --job <id> (see the header of this file)');
const m = /^(redo|anim)-([a-z]+)-(a|b|c|d|d1)$/.exec(jobId);
if (!m) throw new Error(`unknown job id ${jobId}`);
const [, kind, fid, sheet] = m;
const ch = CHARACTERS.find((c) => c.id === fid);
if (!ch) throw new Error(`unknown fighter ${fid}`);

const change = fid === 'saci' ? SACI_ONE_LEG : fid === 'curupira' ? CURUPIRA_BACK_FEET : null;
if (kind === 'redo' && !change) throw new Error('redo jobs exist only for saci and curupira');

const animDesc = ANIM_DESC[fid] ?? ch.desc;
let prompt;
const refs = [];
if (kind === 'redo' && sheet === 'a') {
  prompt = redoPromptA(change, ch.desc);
  refs.push(await buildRefSheet(fid, POSES_A, `ref-${fid}-a.png`));
} else if (kind === 'redo') {
  prompt = redoPromptB(change, ch.desc, ch.special);
  const rawA = join(RAW, `redo-${fid}-a.png`);
  if (!existsSync(rawA) && !args.dryRun) throw new Error(`generate redo-${fid}-a first`);
  refs.push(existsSync(rawA) ? rawA : await buildRefSheet(fid, POSES_A, `ref-${fid}-a.png`));
} else if (sheet === 'c') {
  prompt = sheetPromptC(animDesc);
  refs.push(await buildRefSheet(fid, POSES_A, `ref-${fid}-a.png`));
} else if (sheet === 'd') {
  prompt = sheetPromptD(animDesc, ch.special);
  refs.push(await buildRefSheet(fid, POSES_A, `ref-${fid}-a.png`), await buildRefSheet(fid, POSES_B, `ref-${fid}-b.png`));
} else {
  prompt = sheetPromptDOne(animDesc, ch.special);
  refs.push(await buildRefSheet(fid, POSES_A, `ref-${fid}-a.png`));
}

const id = jobId;
const attempt = args.force ? attemptsOf(id) + 1 : Math.max(1, attemptsOf(id));
const seed = args.seed ?? defaultSeed(id) + attempt;
const params = { num_images: 1, aspect_ratio: '1:1', resolution: '2K', output_format: 'png', seed };
const input = { prompt, ...params };
let refHashes = [];
if (!args.dryRun) {
  input.image_urls = [];
  for (const r of refs) input.image_urls.push(await uploadReference(r));
  refHashes = refs.map(sha256File);
}
console.log(`${id} (attempt ${attempt})\n  refs: ${refs.length}\n  prompt: ${prompt}\n  params: ${JSON.stringify(params)}`);
const job = await runJob({ model: MODEL_EDIT, input, label: id, force: args.force, dryRun: args.dryRun, refHashes });
if (!job.dryRun) {
  record({ id, kind: kind === 'redo' ? 'sprite-sheet-redo' : 'anim-sheet', character: fid, sheet, model: MODEL_EDIT, prompt, params, referenceSheets: refs.length, seed, requestId: job.requestId, date: new Date().toISOString().slice(0, 10), attempt }, job.files[0]);
  const keep = join(ROOT, 'art-src', 'work', 'attempts');
  mkdirSync(keep, { recursive: true });
  copyFileSync(job.files[0], join(keep, `${id}-attempt${attempt}.png`));
  console.log(`  saved art-src/raw/${id}.png and art-src/work/attempts/${id}-attempt${attempt}.png`);
}
console.log(`ledger: $${readLedger().spentUsd.toFixed(2)} spent of $${budgetUsd()}`);
