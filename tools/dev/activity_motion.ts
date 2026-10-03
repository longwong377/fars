// s18 C14 (D-790): every activity's own motion. For every activity of the registry (src/people/activities.ts ACTIVITIES) and
// each of its variants, the animation it plays; flagged GENERIC when that is a stand-in for the work (idle, inspect, talk,
// walk for a non-walking deed) rather than a motion of the work itself. Prints coverage and the generic list.
//   npx tsx tools/dev/activity_motion.ts [--json]
import { ACTIVITIES } from '../../src/people/activities';
import { WORK_ANIMS } from '../../src/people/workAnims';
const GENERIC = new Set(['idle', 'inspect', 'talk']);
const rows: { id: string; variant: string; anim: string; moving: boolean; generic: boolean; note: string }[] = [];
for (const [id, P] of Object.entries(ACTIVITIES) as [string, any][]) {
  const base = { id, variant: '', anim: P.anim, moving: !!P.moving, note: P.note ?? '' };
  rows.push({ ...base, generic: GENERIC.has(P.anim) && !/^(idle|stand|wait|talk|watch|rest|guard|pray|listen)/.test(id) });
  for (const v of P.variants ?? []) { const a = v.anim ?? P.anim; rows.push({ id, variant: String(v.when), anim: a, moving: !!P.moving, note: v.note ?? '', generic: GENERIC.has(a) && !/^(idle|stand|wait|talk|watch|rest|guard|pray|listen)/.test(id) }); }
}
const gen = rows.filter(r => r.generic), work = new Set(WORK_ANIMS as readonly string[]);
const out = { activities: Object.keys(ACTIVITIES).length, rows: rows.length, generic: gen.length, coverage: +(1 - gen.length / rows.length).toFixed(3), workAnims: work.size,
  genericList: gen.map(r => `${r.id}${r.variant ? ' [' + r.variant.slice(0, 50) + ']' : ''} -> ${r.anim}: ${r.note.slice(0, 80)}`) };
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 1)); else { console.log(`activities ${out.activities}, rows ${out.rows}, generic ${out.generic}, coverage ${out.coverage}`); for (const l of out.genericList) console.log('  ' + l); }
