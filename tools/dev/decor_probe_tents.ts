// D-330: the court setting's tents (the simulation's own, court.ts) as JSON for tools/dev/decor_probe.html?tents (not shipped):
//   npx tsx tools/dev/decor_probe_tents.ts [camp,...]  → tools/dev/decor_probe_tents.json
import { readFileSync, writeFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim } from '../../src/people/sim';
const only = process.argv[2]?.split(',');
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const T = new PeopleSim(1, nav, () => ({ rain: 0, lightning: 0, windMs: 2, tempC: 20, dust: 0 }) as any, { court: true }).pop.court!.tents.filter(t => !only || only.includes(t.camp));
writeFileSync('tools/dev/decor_probe_tents.json', JSON.stringify(T)); console.log(`[decor_probe_tents] ${T.length} tents`);
