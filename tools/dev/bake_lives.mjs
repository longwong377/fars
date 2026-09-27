// D-296: the bake of the lives' prose layer (src/people/converse/bake.ts), run in the conversation lab on the GPU through
// tools/dev/converse_drive.mjs:
//   MODEL=<WebLLM id> N=50 SEED=1 DAY=150 node tools/dev/converse_drive.mjs tools/dev/bake_lives.mjs <scratch>/bake.json
// then: node tools/dev/bake_lives.mjs --write <scratch>/bake.json  (writes src/data/lives_baked_s1.json: the rows that pass
// the checks, and the count of those that did not). The people are drawn seeded from every class (the T-E9 classes), adults.
import { readFileSync, writeFileSync } from 'node:fs';
if (process.argv[2] === '--write') {
  const r = JSON.parse(readFileSync(process.argv[3], 'utf8')).result;
  const rows = r.rows.filter(x => x.check?.ok).map(({ record, raw, ...x }) => x);
  const out = { _meta: { what: 'the baked prose layer of people’s lives (D-296): written offline by a local model from each person’s record (life.ts) and checked (bake.ts checkBake: the fence, names only of the record); keyed to world seed and pid; tier C', model: r.model, seed: r.seed, day: r.day, made: r.when, tried: r.rows.length, kept: rows.length, rejected: r.rows.filter(x => !x.check?.ok).map(x => ({ pid: x.pid, why: x.check ? [...x.check.fence, ...x.check.unknownNames.map(n => 'name:' + n)] : ['unparsed'] })) }, rows };
  writeFileSync('src/data/lives_baked_s1.json', JSON.stringify(out, null, 1)); console.log('kept', rows.length, 'of', r.rows.length);
}
export default async (page, lab, log) => {
  const model = process.env.MODEL ?? 'gemma-2-2b-it-q4f16_1-MLC', n = +(process.env.N ?? 50), day = +(process.env.DAY ?? 150);
  await lab('load', model); log('bake model', model);
  const pids = await page.evaluate(([n, day]) => window.__lab.bakePeople(n, day), [n, day]);
  const rows = [];
  for (const pid of pids) { try { const b = await lab('bake', pid, day); rows.push({ pid, model, ms: b.ms, ...b.baked, check: b.check, raw: b.raw, name: b.record.name, job: b.record.job }); log(pid, b.record.name, (b.ms / 1000).toFixed(1), 's', b.check?.ok ? 'ok' : JSON.stringify(b.check)); }
    catch (e) { log('fail', pid, String(e).slice(0, 200)); rows.push({ pid, error: String(e).slice(0, 300) }); } }
  return { model, seed: 1, day, when: new Date().toISOString(), rows };
};
