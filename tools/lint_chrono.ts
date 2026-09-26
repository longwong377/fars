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
const chronoTier = new Map<string, string>((chrono.structures as any[]).map(s => [s.id, s.tier]));
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
    // the files' rule (D-228): tier = the lower of existence and position; a position uncertain by more than 200 m is not a
    // dataset coordinate, so it is C, and so is the row. The chronology row carries the same tier.
    if (typeof f.unc_m === 'number' && f.unc_m > 200 && f.tier !== 'C') errors.push(`${zone} feature ${f.id}: tier ${f.tier} but position +-${f.unc_m} m (C): tier = the lower of existence and position`);
    if (chronoTier.get(f.chrono) !== f.tier) errors.push(`${zone} feature ${f.id}: tier ${f.tier} but chronology ${f.chrono} tier ${chronoTier.get(f.chrono)}`);
    if (f.present_467) { const text = [f.id.replace(/_/g, ' '), f.name, f.kind].join(' ');
      for (const t of terms) if (t.re.test(text) && !f.blocklist_ok?.[t.id]) errors.push(`${zone} feature ${f.id}: present in 467 but matches blocklist '${t.id}' (exempt only with a blocklist_ok reason)`); }
  }
}
// Phase 6 build: the reconstruction rows of settlement.json (town_elements) and everything the town generator places.
// Fail-closed: every generated plot, fitting, prop, tree, water piece, road and midden names a row (a town_elements row
// or a settlement feature) and a PRESENT settlement feature; rows carry valid tiers and source keys; no row's id, name or
// kind matches the blocklist; nothing is generated on the site of an ABSENT feature (the Frataraka complex).
{
  const S = J('src/data/settlement.json');
  const feats = new Map<string, any>((S.features as any[]).map(f => [f.id, f]));
  const rows = new Map<string, any>();
  for (const r of (S.town_elements ?? []) as any[]) {
    if (rows.has(r.id)) errors.push(`town row ${r.id}: duplicate id`); rows.set(r.id, r);
    if (!['A', 'B', 'C'].includes(r.tier)) errors.push(`town row ${r.id}: bad tier ${r.tier}`);
    for (const k of String(r.src ?? '').split(';')) if (!k || !sources[k]) errors.push(`town row ${r.id}: unknown source key '${k}'`);
    for (const f of r.in_feature ?? []) { const F = feats.get(f); if (!F) errors.push(`town row ${r.id}: in_feature ${f} is not a settlement feature`); else if (!F.present_467) errors.push(`town row ${r.id}: in_feature ${f} is ABSENT in 467`); }
    if (!(r.in_feature ?? []).length) errors.push(`town row ${r.id}: no in_feature (fail-closed)`);
    // a reconstruction row placed in a feature is no better attested than the place it stands in (D-228)
    for (const f of r.in_feature ?? []) { const F = feats.get(f); if (F && r.tier < F.tier) errors.push(`town row ${r.id}: tier ${r.tier} above its feature ${f} (${F.tier}): tier = the lower of existence and position`); }
    const text = [r.id.replace(/_/g, ' '), r.name, r.kind].join(' ');
    for (const t of terms) if (t.re.test(text) && !r.blocklist_ok?.[t.id]) errors.push(`town row ${r.id}: matches blocklist '${t.id}'`);
  }
  const { buildTownPlan } = await import('../src/world/settlement/plan');
  const plan = buildTownPlan();
  const okRow = (row: string, where: string) => { if (!rows.has(row) && !(feats.get(row)?.present_467)) errors.push(`${where}: row '${row}' is neither a town_elements row nor a present settlement feature (fail-closed)`); };
  const okFeat = (f: string, where: string) => { const F = feats.get(f); if (!F) errors.push(`${where}: feature '${f}' not in settlement.json (fail-closed)`); else if (!F.present_467) errors.push(`${where}: feature '${f}' is ABSENT in 467`); };
  let n = 0;
  for (const s of plan.sites) { okFeat(s.meta.feature, `site ${s.id}`);
    for (const p of s.plots) { okRow(p.row, `plot ${p.id}`); okFeat(p.feature, `plot ${p.id}`); n++;
      const rf = rows.get(p.row); if (rf && !(rf.in_feature ?? []).includes(p.feature)) errors.push(`plot ${p.id}: row ${p.row} does not cover feature ${p.feature}`);
      for (const t of terms) if (t.re.test(`${p.kind} ${p.craft ?? ''}`)) errors.push(`plot ${p.id}: kind/craft matches blocklist '${t.id}'`); } }
  for (const p of plan.props) { okRow(p.row, `prop ${p.note.slice(0, 30)}`); okFeat(p.feature, 'prop'); n++; }
  for (const t of plan.trees) { okRow(t.row, 'tree'); okFeat(t.feature, 'tree'); n++; }
  for (const w of plan.water) { okRow(w.row, `water ${w.kind}`); okFeat(w.feature, `water ${w.kind}`); n++; }
  for (const r of plan.roads) { okRow(r.row, `road ${r.id}`); okFeat(r.feature, `road ${r.id}`); n++; }
  for (const m of plan.middens) { okRow(m.row, 'midden'); okFeat(m.feature, 'midden'); n++; }
  // D-234: every house fixture (houseplan.ts) names a row that covers its plot's feature; no fixture kind matches the blocklist;
  // every source key of the house parts (houses.ts HOUSE_PARTS, shown in F3) resolves
  for (const s of plan.sites) for (const f of s.fixtures ?? []) { const p = s.plots[f.plot]; okRow(f.row, `fixture ${f.kind} of ${p.id}`); n++;
    const rf = rows.get(f.row); if (rf && !(rf.in_feature ?? []).includes(p.feature)) errors.push(`fixture ${f.kind} of ${p.id}: row ${f.row} does not cover feature ${p.feature}`);
    for (const t of terms) if (t.re.test(f.kind.replace(/_/g, ' ')) || t.re.test(f.note)) errors.push(`fixture ${f.kind} of ${p.id}: matches blocklist '${t.id}'`); }
  const { HOUSE_PARTS } = await import('../src/world/settlement/houses');
  for (const [i, hp] of HOUSE_PARTS.entries()) { for (const k of hp.src.split(';')) if (k && !sources[k]) errors.push(`house part ${i}: unknown source key ${k}`); if (!['A', 'B', 'C'].includes(hp.tier)) errors.push(`house part ${i}: bad tier ${hp.tier}`); }
  // absent features keep their ground empty
  for (const f of (S.features as any[]).filter(f => f.present_467 === false && f.xy)) {
    for (const s of plan.sites) for (const p of s.plots) { const [i0, j0, i1, j1] = p.rect; const c = s.grid((s.cu(i0) + s.cu(i1 - 1)) / 2, (s.cv(j0) + s.cv(j1 - 1)) / 2);
      if (Math.hypot(c[0] - f.xy[0], c[1] - f.xy[1]) < 80) errors.push(`plot ${p.id} stands on the site of ${f.id}, ABSENT in 467`); }
  }
  console.log(`lint:chrono settlement build: ${rows.size} town rows, ${n} generated items checked`);
}
// town.json (the population's abstract places): every quarter and facility position is C (its _meta: no storehouse, stable
// or burial ground located), so each row is C whatever its activity's tier (D-228); source keys resolve
{
  const TJ = J('src/data/town.json');
  for (const k of ['quarters', 'facilities'] as const) for (const r of (TJ[k] ?? []) as any[]) {
    if (r.tier !== 'C') errors.push(`town.json ${k} ${r.id}: tier ${r.tier}, but every town.json position is C (tier = the lower of existence and position)`);
    for (const key of String(r.src ?? '').split(';')) if (key && !sources[key]) errors.push(`town.json ${k} ${r.id}: unknown source key ${key}`);
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
