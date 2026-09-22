// Chronology + anachronism lint (brief §13.5). Fails (exit 1) when:
//  * a world asset lacks period/src/tier, or references a source key missing from sources.json;
//  * an asset belongs to a structure that is absent in 467 BCE (fail-closed: unknown structure ids fail too);
//  * any asset id/name/tags/description matches a blocklist term (whole word, case-insensitive);
//  * the site spec's absent list disagrees with chronology.json.
import { readFileSync } from 'node:fs';
const J = (p: string) => JSON.parse(readFileSync(p, 'utf8'));
const chrono = J('src/data/chronology.json');
const block = J('src/data/blocklist.json');
const sources = J('src/data/sources.json');
const assets = J('src/data/assets.json').assets as any[];
const spec = J('src/data/site_spec.json');
const errors: string[] = [];
const present = new Map<string, boolean>();
for (const s of chrono.structures) present.set(s.id, s.present);
const footprintPresent = new Map<string, boolean>();
for (const s of chrono.structures) if (s.footprint) footprintPresent.set(s.footprint, s.present);

for (const s of chrono.structures) {
  for (const k of String(s.src).split(';')) if (!sources[k]) errors.push(`chronology ${s.id}: unknown source key ${k}`);
  if (!['A', 'B', 'C'].includes(s.tier)) errors.push(`chronology ${s.id}: bad tier ${s.tier}`);
}
const absent: string[] = spec.absent_in_467.list.v;
for (const k of absent) if (footprintPresent.get(k) !== false) errors.push(`site_spec absent list has ${k}, but chronology does not mark that footprint absent`);
for (const [k, p] of footprintPresent) if (!p && !absent.includes(k)) errors.push(`footprint ${k} is absent in chronology but missing from site_spec absent list`);

const terms: { id: string; re: RegExp }[] = [];
for (const e of block.entries) for (const t of e.terms) terms.push({ id: e.id, re: new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i') });
for (const a of assets) {
  for (const f of ['id', 'period', 'src', 'tier']) if (!a[f]) errors.push(`asset ${a.id ?? '?'}: missing ${f}`);
  for (const k of String(a.src ?? '').split(';')) if (k && !sources[k]) errors.push(`asset ${a.id}: unknown source key ${k}`);
  if (a.structure) {
    if (!present.has(a.structure)) errors.push(`asset ${a.id}: structure ${a.structure} not in chronology (fail-closed)`);
    else if (!present.get(a.structure)) errors.push(`asset ${a.id}: structure ${a.structure} is ABSENT in 467 BCE`);
  }
  const text = [a.id, a.name, a.description, ...(a.tags ?? [])].filter(Boolean).join(' ');
  for (const t of terms) if (t.re.test(text) && !(a.exempt === 'calibration' || a.exempt === 'nowview')) errors.push(`asset ${a.id}: matches blocklist '${t.id}'`);
}
if (errors.length) { console.error('lint:chrono FAILED\n' + errors.map(e => ' - ' + e).join('\n')); process.exit(1); }
console.log(`lint:chrono OK — ${chrono.structures.length} structures, ${assets.length} assets, ${terms.length} blocklist terms`);
