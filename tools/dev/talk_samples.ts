// D-371..D-377: what a player would meet, as text: five people of a seed told about their own lives (their brief), and
// overheard exchanges (the lexicon's words, the translation layer's gloss and topic). Writes sessions/s15-cloud-samples.md.
//   npx tsx tools/dev/talk_samples.ts [seed=1] [day=150] [hour=11]
import { writeFileSync } from 'node:fs';
import { simAt } from '../../tests/sim_fixture';
import { lifeRecord, lifeBriefShort } from '../../src/people/converse/life';
import { Overheard } from '../../src/people/overheard';
import { u01, salt } from '../../src/people/hash';
const [seed, d, hr] = [Number(process.argv[2] ?? 1), Number(process.argv[3] ?? 150), Number(process.argv[4] ?? 11)];
const sim = simAt(seed, d, hr, { asks: true }); sim.econTo(d + 1); const P = sim.pop;
const out: string[] = [`# What the people of seed ${seed} are told about their own lives (day ${d}, ${hr}:00): five drawn at random`, '', 'Out of world: the language model\'s brief (English); the person answers in their own words and voice.', ''];
for (const p of P.persons.filter(p => P.present(p.id, d) && P.ageOn(p.id, d) >= 8).sort((a, b) => u01(seed, salt('samp'), a.id) - u01(seed, salt('samp'), b.id)).slice(0, 5)) {
  const L = lifeRecord(P, sim.cal, p.id, d, hr); out.push(`## ${L.name}${L.byname ? `, ${L.byname}` : ''} (${L.age}, ${p.job})`, '', '```', lifeBriefShort(L), '```', ''); }
out.push('# Overheard near the player', '', 'The words are the lexicon\'s attested ones (§10); the gloss and the topic are the translation layer\'s.', '');
const O = new Overheard(sim), seen = new Set<string>();
for (const t of sim.living.talks.filter(t => t.day === d)) { if (seen.size >= 5) break; const k = `${Math.min(t.a, t.b)}:${Math.max(t.a, t.b)}`; if (seen.has(k)) continue; seen.add(k);
  const ex = O.exchange(t.a, t.b, d * 24 + hr); if (!ex) continue;
  out.push(`- **${P.nameOf(t.a)?.replace(/^\*/, '')}** and **${P.nameOf(t.b)?.replace(/^\*/, '')}** (${ex.lang}), talking of ${ex.topic}${ex.carried ? '' : ' (no word for it in this tongue: the topic is in the note only)'}:`);
  for (const x of ex.turns) out.push(`  - ${x.who === 'a' ? 'A' : 'B'}: *${x.unit.translit}* "${(x.unit.gloss ?? '').split(/[;(]/)[0].trim().slice(0, 60)}"`); }
writeFileSync('sessions/s15-cloud-samples.md', out.join('\n') + '\n'); console.log('written');
