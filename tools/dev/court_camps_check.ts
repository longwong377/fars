// D-199: the court setting's camps against the built world (campCheck.ts): tents, radius, conflicts, slope, land use.
// Usage: npx tsx tools/dev/court_camps_check.ts [seed=1]
import { readFileSync } from 'node:fs';
import { Population } from '../../src/people/population';
import { buildTownPlan } from '../../src/world/settlement/plan';
import { buildCanals } from '../../src/world/plain/canals';
import { placeVillages } from '../../src/world/plain/villages';
import { buildZones, landUseAt } from '../../src/world/plain/fields';
import { buildTownGround } from '../../src/world/plain/townGround';
import { parseRivers } from '../../src/world/plain/data';
import { Ring, Terrain, type TerrainMeta } from '../../src/terrain/heightfield';
import { checkCamps } from '../../src/people/campCheck';
import { TENT_KINDS, CAMPS } from '../../src/people/camps';

const seed = +(process.argv[2] ?? 1);
const meta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
const ring = (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0) as ArrayBuffer), meta.court_asl);
const terrain = new Terrain(meta, ring('near'), ring('mid'), ring('far'));
const rivers = parseRivers(JSON.parse(readFileSync('public/generated/rivers.json', 'utf8')));
const canals = buildCanals(terrain, rivers.rivers, seed), villages = placeVillages(terrain, rivers.rivers, canals, seed), town = buildTownPlan();
const zones = buildZones({ terrain, rivers: rivers.rivers.map(r => ({ x: r.x, y: r.y, halfCorridor: r.carveRadius.mid + 24 })), villages: villages.map(v => ({ x: v.x, y: v.y, r: v.r })), ground: buildTownGround(town, CAMPS.filter(c => c.id !== 'court').map(c => ({ c: c.c, r: c.r }))),
  sites: town.sites.map(s => ({ c: s.frame.c as [number, number], theta: s.frame.theta, W: s.W, H: s.H })) });
const t0 = Date.now(); const pop = new Population(seed, { court: true }); const K = pop.court!;
console.log(`population ${pop.persons.length} (court ${K.end - K.first}) in ${Date.now() - t0} ms; tents ${K.tents.length}`);
const rep = checkCamps(K.tents, { town, villages, canals: canals.map(c => c.pts), rivers: rivers.rivers.map(r => ({ x: r.x, y: r.y, half: r.topWidth / 2 + 10 })), asl: (e, n) => terrain.aslAt(e, -n), landUse: (e, n) => landUseAt(zones, e, -n).use });
for (const [id, r] of Object.entries(rep)) console.log(id, `r ${K.campRadius.get(id)?.toFixed(0)}`, JSON.stringify({ ...r, meanSlope: +r.meanSlope.toFixed(3), maxSlope: +r.maxSlope.toFixed(3) }));
const kinds: Record<string, number> = {}; for (const t of K.tents) kinds[t.kind] = (kinds[t.kind] ?? 0) + 1; console.log('kinds', JSON.stringify(kinds), 'sleeps', JSON.stringify(Object.fromEntries(Object.entries(TENT_KINDS).map(([k, v]) => [k, v.sleeps]))));
