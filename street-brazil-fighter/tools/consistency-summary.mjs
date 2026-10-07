// Compact before/after table from two consistency.mjs --json outputs.
// Usage: node tools/consistency-summary.mjs art-src/work/consistency-before.json art-src/work/consistency-after.json
import { readFileSync } from 'node:fs';
const [beforeFile, afterFile] = process.argv.slice(2);
const load = (f) => JSON.parse(readFileSync(f, 'utf8')).filter((r) => r.atlas !== 'cross');
const avg = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
function stats(rows) {
  const out = {};
  for (const id of ['tiao', 'dalva', 'saci', 'curupira', 'craque', 'rosa']) {
    const r = rows.filter((x) => x.id === id);
    const sk = r.map((x) => x.skinDE).filter((v) => v !== null), cl = r.map((x) => x.clothDE);
    const anim = r.filter((x) => x.atlas === 'anim' && x.heightDev !== null);
    out[id] = {
      skinMean: avg(sk), skinMax: Math.max(...sk), clothMean: avg(cl), clothMax: Math.max(...cl),
      heightOut: anim.filter((x) => Math.abs(x.heightDev) > 0.06).length,
      headOut: anim.filter((x) => x.headDev !== null && Math.abs(x.headDev) > 0.12).length,
    };
  }
  return out;
}
const b = stats(load(beforeFile)), a = stats(load(afterFile));
const f = (v) => v.toFixed(1);
console.log('| Fighter | skin dE mean (before > after) | skin dE worst | colour dE worst | height out of 6% | head out of 12% |');
console.log('|---|---|---|---|---|---|');
for (const id of Object.keys(b)) console.log(`| ${id} | ${f(b[id].skinMean)} > ${f(a[id].skinMean)} | ${f(b[id].skinMax)} > ${f(a[id].skinMax)} | ${f(b[id].clothMax)} > ${f(a[id].clothMax)} | ${b[id].heightOut} > ${a[id].heightOut} | ${b[id].headOut} > ${a[id].headOut} |`);
