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
// settlement and plain features (Phases 6-7): each names its chronology row, and presence must agree (fail-closed:
// present_467 null = not placed = absent). Present features are matched against the blocklist on id, name and kind only
// (their notes cite blocklisted things as negatives); a match is exempt only with a written reason in `blocklist_ok`.
for (const [file, zone] of [['src/data/settlement.json', 'settlement'], ['src/data/plain.json', 'plain']] as const) {
  for (const f of J(file).features as any[]) {
    if (!f.chrono || !present.has(f.chrono)) { errors.push(`${zone} feature ${f.id}: chronology row '${f.chrono}' missing (fail-closed)`); continue; }
    if (!!f.present_467 !== present.get(f.chrono)) errors.push(`${zone} feature ${f.id}: present_467=${f.present_467} but chronology ${f.chrono} present=${present.get(f.chrono)}`);
    for (const k of String(f.src ?? '').split(';')) if (k && !sources[k]) errors.push(`${zone} feature ${f.id}: unknown source key ${k}`);
    if (!['A', 'B', 'C'].includes(f.tier)) errors.push(`${zone} feature ${f.id}: bad tier ${f.tier}`);
    if (f.present_467) { const text = [f.id.replace(/_/g, ' '), f.name, f.kind].join(' ');
      for (const t of terms) if (t.re.test(text) && !f.blocklist_ok?.[t.id]) errors.push(`${zone} feature ${f.id}: present in 467 but matches blocklist '${t.id}' (exempt only with a blocklist_ok reason)`); }
  }
}
// generated architecture: every part's building must be a PRESENT chronology structure (fail-closed)
const { buildTerrace } = await import('../src/arch/terrace');
const { parts } = buildTerrace();
const partBuildings = new Set(parts.map((p: any) => p.building));
for (const b of partBuildings) { if (!present.has(b)) errors.push(`generated part building '${b}' not in chronology (fail-closed)`); else if (!present.get(b)) errors.push(`generated part building '${b}' is ABSENT in 467 BCE`); }
for (const p of parts as any[]) for (const k of String(p.src).split(';')) if (!sources[k]) errors.push(`part ${p.building}/${p.kind}: unknown source key ${k}`);
if (errors.length) { console.error('lint:chrono FAILED\n' + errors.map(e => ' - ' + e).join('\n')); process.exit(1); }
console.log(`lint:chrono OK — ${chrono.structures.length} structures, ${assets.length} registered assets, ${parts.length} generated parts in ${partBuildings.size} buildings, ${terms.length} blocklist terms`);
