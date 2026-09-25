// dev (D-217): the carving depth (ReliefItem.D, m) of every relief figure by set and kind: the rubric's 2–6 cm check
//   npx tsx tools/dev/relief_depths.ts
import { buildTerrace } from '../../src/arch/terrace';
import { buildReliefs, buildPhase4Reliefs } from '../../src/arch/decor';
import { ReliefSet } from '../../src/arch/reliefs';
const { manifest, doorways } = buildTerrace() as any;
const sets = [...buildReliefs(manifest).children, ...buildPhase4Reliefs(doorways).group.children].filter(c => c instanceof ReliefSet) as ReliefSet[];
const rows = new Map<string, { n: number; kinds: Set<string> }>();
let lo = Infinity, hi = 0;
for (const s of sets) for (const it of s.items) { const k = `${s.name} D ${(it.D * 100).toFixed(2)} cm`; const r = rows.get(k) ?? { n: 0, kinds: new Set() }; r.n++; r.kinds.add(it.kind); rows.set(k, r); lo = Math.min(lo, it.D); hi = Math.max(hi, it.D); }
for (const [k, r] of rows) console.log(k, r.n, [...r.kinds].slice(0, 8).join(','));
console.log(`all figures: ${(lo * 100).toFixed(2)}–${(hi * 100).toFixed(2)} cm`);
