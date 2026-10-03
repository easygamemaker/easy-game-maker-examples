// Generates the character sprite sheets. Sheet A: text to image. Sheet B: /edit with sheet A as reference.
// Usage: node tools/generate-sprites.mjs [--dry-run] [--only id,id] [--sheet a|b] [--force] [--seed n]
import { MODEL_T2I, MODEL_EDIT, runJob, uploadReference, sha256File, budgetUsd, readLedger } from './fal.mjs';
import { CHARACTERS, sheetPromptA, sheetPromptB } from './prompts.mjs';
import { parseArgs, defaultSeed, record, attemptsOf, RAW } from './common.mjs';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const args = parseArgs();
const list = CHARACTERS.filter((c) => !args.only.length || args.only.includes(c.id));
const date = new Date().toISOString().slice(0, 10);

for (const ch of list) {
  for (const sheet of ['a', 'b']) {
    if (args.sheet && args.sheet !== sheet) continue;
    const id = `sprite-${ch.id}-${sheet}`;
    const attempt = args.force ? attemptsOf(id) + 1 : attemptsOf(id);
    const seed = args.seed ?? defaultSeed(id) + attempt;
    const params = { num_images: 1, aspect_ratio: '1:1', resolution: '2K', output_format: 'png', seed };
    let model = MODEL_T2I;
    let prompt = sheetPromptA(ch.desc);
    let input = { prompt, ...params };
    let refHashes = [];
    if (sheet === 'b') {
      model = MODEL_EDIT;
      prompt = sheetPromptB(ch.desc, ch.special);
      const refA = join(RAW, `sprite-${ch.id}-a.png`);
      if (!existsSync(refA)) {
        if (args.dryRun) console.log(`  (sheet A raw missing, dry run continues)`);
        else throw new Error(`sheet A for ${ch.id} must be generated first`);
      }
      input = { prompt, ...params };
      if (!args.dryRun) {
        input.image_urls = [await uploadReference(refA)];
        refHashes = [sha256File(refA)];
      }
    }
    console.log(`${id}\n  prompt: ${prompt}\n  params: ${JSON.stringify(params)}`);
    const job = await runJob({ model, input, label: id, force: args.force, dryRun: args.dryRun, refHashes });
    if (job.dryRun) continue;
    record({ id, kind: 'sprite-sheet', character: ch.id, sheet, model, prompt, params, referenceSheet: sheet === 'b' ? `sprite-${ch.id}-a` : null, seed, requestId: job.requestId, date, attempt }, job.files[0]);
  }
}
console.log(`ledger: $${readLedger().spentUsd.toFixed(2)} spent of $${budgetUsd()}`);
