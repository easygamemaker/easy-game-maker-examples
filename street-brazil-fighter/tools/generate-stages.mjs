// Generates the nine stage backgrounds with fal-ai/nano-banana-pro (text to image).
// Usage: node tools/generate-stages.mjs [--dry-run] [--only id,id] [--force] [--seed n] [--style-ref path]
import { MODEL_T2I, MODEL_EDIT, runJob, uploadReference, sha256File, budgetUsd, readLedger } from './fal.mjs';
import { STAGES, stagePrompt } from './prompts.mjs';
import { parseArgs, defaultSeed, record, attemptsOf } from './common.mjs';

const args = parseArgs();
const list = STAGES.filter((s) => !args.only.length || args.only.includes(s.id));
const date = new Date().toISOString().slice(0, 10);

for (const stage of list) {
  const id = `stage-${stage.id}`;
  const attempt = args.force ? attemptsOf(id) + 1 : attemptsOf(id);
  const seed = args.seed ?? defaultSeed(id) + attempt;
  const prompt = stagePrompt(stage);
  const params = { num_images: 1, aspect_ratio: '16:9', resolution: '2K', output_format: 'png', seed };
  let model = MODEL_T2I;
  let input = { prompt, ...params };
  let refHashes = [];
  if (args.styleRef && !args.dryRun) {
    model = MODEL_EDIT;
    input = { prompt: `Match the art style of the attached reference image. ${prompt}`, ...params, image_urls: [await uploadReference(args.styleRef)] };
    refHashes = [sha256File(args.styleRef)];
  }
  console.log(`${id}\n  prompt: ${prompt}\n  params: ${JSON.stringify(params)}`);
  const job = await runJob({ model, input, label: id, force: args.force, dryRun: args.dryRun, refHashes });
  if (job.dryRun) continue;
  record({ id, kind: 'stage', model, prompt: input.prompt, params, seed, styleRef: args.styleRef ? 'owner reference image (style only)' : null, requestId: job.requestId, date, attempt }, job.files[0]);
}
console.log(`ledger: $${readLedger().spentUsd.toFixed(2)} spent of $${budgetUsd()}`);
