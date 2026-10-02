// s17 C7 (D-610): the census of the furnished rooms: every enterable room of the town's and the villages' houses (and the
// Terrace's room ranges), planned for its household (src/world/interiors), counted per kind: bare rooms (fewer than
// MIN_THINGS), things per room, floor covered, identical rooms among neighbours (15 m), things in a doorway's sweep, the
// triangles per room and of the ring round the eye. `--baseline` counts what houses.ts drew before (a mat, rolls, a pile
// of rugs; a store's row of jars; the vestibule's water jar and a bench), the same rooms. `--no-pop`: without the population.
//   npx tsx tools/dev/interior_census.ts [--baseline] [--no-pop] [--json out.json]
import { readFileSync, writeFileSync } from 'node:fs';
import { buildTownPlan } from '../../src/world/settlement/plan';
import { SiteHouses } from '../../src/world/settlement/houses';
import { HOUSE_KINDS } from '../../src/world/settlement/houseplan';
import type { RGB } from '../../src/world/settlement/geom';
import type { Site } from '../../src/world/settlement/site';
import { roomPlan, roomIn, usesOf, type HouseView, type RoomRect } from '../../src/world/interiors/town';
import { setInteriorPeople } from '../../src/world/interiors/household';
import { census, formatCensus, type CRoom } from '../../src/world/interiors/census';
import { RING_R } from '../../src/world/interiors/ring';
import { TRIS, type Item, type Plan } from '../../src/world/interiors/plan';
import { hi } from '../../src/world/settlement/houses';

const args = process.argv.slice(2), BASE = args.includes('--baseline'), NOPOP = args.includes('--no-pop'), JSONOUT = args.includes('--json') ? args[args.indexOf('--json') + 1] : null;
const t0 = Date.now();
const houseOf = (s: Site, si: number) => { const n = s.plots.length; return new SiteHouses(s, si, () => 0, new Float32Array(n), new Uint8Array(n), Array.from({ length: n }, () => [0.5, 0.45, 0.35] as RGB), new Int32Array(n), []); };
const plan = buildTownPlan();
let villages: { id: string; site: Site }[] = [];
// the villages (the plain's placement and compounds, as the world builds them)
{ const { loadTerrain, loadRiversFile } = await import('../../tests/plainLib'); const { buildCanals } = await import('../../src/world/plain/canals'); const { placeVillages, villageCompounds } = await import('../../src/world/plain/villages'); const { villageSite } = await import('../../src/world/plain/villagesite');
  const T = loadTerrain(), R = loadRiversFile(), canals = buildCanals(T, R.rivers, 1), V = placeVillages(T, R.rivers, canals, 1);
  villages = V.map(v => ({ id: v.id, site: villageSite(v, villageCompounds(v, T, 1)).site }));
  if (!NOPOP) { const { Population } = await import('../../src/people/population'); const { PopGeo } = await import('../../src/people/popgeo'); const { NavGrid } = await import('../../src/people/navgrid');
    const pop = new Population(1), nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
    const geo = new PopGeo({ pop, nav, town: plan, ground: (e, n) => T.heightAt(e, -n), villages: V, compounds: vi => villageCompounds(V[vi], T, 1), canals: canals.map(c => c.pts), seed: 1 });
    setInteriorPeople(pop, hh => { const x = geo.villageOf(hh); return x ? `${V[x.vi].id}-c${x.ci}` : null; }); } }
console.log(`[census] world planned in ${((Date.now() - t0) / 1000).toFixed(1)} s`);

/** what houses.ts drew in a room before D-610 (kinds and counts; places along the back wall) */
function baseline(h: HouseView, r: RoomRect, use: string): Plan {
  const s = h.s, si = (h as any).si as number, items: Item[] = [], room = roomIn(h, r)!, u0 = s.u0 + r.i0, v0 = s.v0 + r.j0, W = r.i1 - r.i0, D = r.j1 - r.j0;
  const back = r.drain >= 0 && r.drain < 4 ? [1, 0, 3, 2][r.drain] : 1, L = (back < 2 ? W : D) - 0.9, at = (a: number) => (back < 2 ? [u0 + 0.45 + a, back === 0 ? v0 + 0.4 : v0 + D - 0.4] : [back === 2 ? u0 + 0.4 : u0 + W - 0.4, v0 + 0.45 + a]);
  const put = (k: Item['k'], a: number) => { const [u, v] = at(a); items.push({ k, u, v, rot: 0, w: 0.5, d: 0.5, h: 0.5, y: 0, vr: 0, wall: back }); };
  const hh = hi(r.room, si, 5);
  if (use === 'vestibule') { put('jar_water', 0.15); if (hh < 0.6) put('bench', L / 2); }
  else if (use === 'store') { const n = Math.max(2, Math.floor(L / 0.62)); for (let k = 0; k < n; k++) put(hi(r.room, k, 2) < 0.65 ? 'jar_store' : 'sack', 0.2 + (L - 0.4) * k / Math.max(1, n - 1)); }
  else { items.push({ k: 'mat', u: u0 + W / 2, v: v0 + D / 2, rot: 0, w: W - 0.9, d: D - 0.9, h: 0.01, y: 0, vr: 0, wall: -1 }); const nb = 1 + Math.floor(hi(r.room, 7) * 3); for (let k = 0; k < nb; k++) if (0.3 + k * 0.75 + 0.6 <= L) put('roll', 0.3 + k * 0.75); put('rugs', L - 0.35); }
  let cov = 0; for (const it of items) cov += it.k === 'mat' ? it.w * it.d : 0.25; const fl = Math.max(0.1, (W - 0.6) * (D - 0.6));
  return { items, floor: fl, covered: Math.min(1, cov / fl), use: room.use, clear: [] };
}
const rooms: CRoom[] = [], ringPts: [number, number][] = [];
const add = (label: string, s: Site, si: number) => { const hs = houseOf(s, si), h = Object.assign(Object.create(hs), { life: (q: number) => (hs as any).life(q), day: 30 }) as HouseView;
  for (const r of hs.rooms) { const p = s.plots[r.plot]; if (!HOUSE_KINDS.has(p.kind)) continue; const x = roomPlan(h, r); if (!x) continue;
    const old = (hs as any).roomUse(r) as string, pl = BASE ? baseline(h, r, old === 'none' ? 'living' : old) : x.plan, [e, n] = s.grid((x.room.u0 + x.room.u1) / 2, (x.room.v0 + x.room.v1) / 2);
    rooms.push({ kind: `${label}/${BASE ? (old === 'none' ? 'living' : old) : x.room.use}`, e, n, room: x.room, plan: pl, tris: (x.prof.from === 'population' ? 1 : 1) * pl.items.reduce((a, it) => a + TRIS[it.k], 0) });
    if (x.prof.from === 'population') (rooms[rooms.length - 1] as any).pop = true; (rooms[rooms.length - 1] as any).st = x.prof.standing; (rooms[rooms.length - 1] as any).jobs = x.prof.jobs; }
  for (const p of s.plots) if (p.door && HOUSE_KINDS.has(p.kind)) { const d = s.doorPoints(p)!; ringPts.push(s.grid(...d.out)); } void usesOf; };
plan.sites.forEach((s, si) => add('town', s, si));
villages.forEach((v, vi) => add('village', v.site, 1000 + vi));
// the Terrace's room ranges: the fittings rooms.ts lays (the baseline) and the furnishing after them
{ const { terraceRooms } = await import('../../src/arch/terrace_rooms'); const { planTerraceRoom } = await import('../../src/world/interiors/terrace');
  for (const { room, fit } of terraceRooms()) { if (room.use === 'passage') continue; const x = planTerraceRoom(room, fit), e = (room.x[0] + room.x[1]) / 2, n = (room.y[0] + room.y[1]) / 2;
    const pre: Item[] = [...fit.mats.map(m => ({ k: 'mat' as const, u: m.c[0], v: m.c[1], rot: 0, w: m.size[0], d: m.size[1], h: 0.02, y: 0, vr: 0, wall: -1 })), ...fit.jars.map(j => ({ k: 'jar_store' as const, u: j[0], v: j[1], rot: 0, w: 0.5, d: 0.5, h: 0.8, y: 0, vr: 0, wall: -1 })),
      ...fit.querns.map(j => ({ k: 'quern' as const, u: j[0], v: j[1], rot: 0, w: 0.5, d: 0.4, h: 0.2, y: 0, vr: 0, wall: -1 })), ...fit.benches.map(b => ({ k: 'bench' as const, u: b.c[0], v: b.c[1], rot: 0, w: b.size[0], d: b.size[1], h: 0.5, y: 0, vr: 0, wall: -1 }))];
    const items = BASE ? pre : [...pre, ...x.plan.items], fl = x.plan.floor; let cov = 0; for (const it of items) if (it.y < 0.05 && !['peg_cloth', 'herbs', 'onions', 'lamp'].includes(it.k)) cov += it.w * it.d;
    // (a dormitory counts its things per sleeping place: a room of ninety mats is not furnished by ninety mats alone)
    rooms.push({ kind: `terrace/${room.building}/${room.use}`, e, n, room: x.room, plan: { ...x.plan, items: BASE ? pre : [...x.plan.items, ...pre.filter(q => q.k !== 'mat')], covered: Math.min(1, cov / fl) }, tris: BASE ? 0 : x.plan.items.reduce((a, it) => a + TRIS[it.k], 0) }); } }
// the court camps' tents (court setting: standing while the court is in residence)
{ const { Population } = await import('../../src/people/population'); const { planTent } = await import('../../src/world/interiors/tents');
  for (const t of (new Population(1, { court: true }) as any).court.tents as any[]) { const x = planTent(t); rooms.push({ kind: `tent/${t.kind}`, e: t.e, n: t.n, room: x.room, plan: BASE ? { ...x.plan, items: [], covered: 0 } : x.plan, tris: BASE ? 0 : x.plan.items.reduce((a: number, it: Item) => a + TRIS[it.k], 0) }); } }
// the palaces' rooms (furnish_palaces.ts: the court's use, and stored while it is away), counted per room and state
{ const { buildTerrace } = await import('../../src/arch/terrace'); const { palaceFurnishingPlan } = await import('../../src/world/furnish_palaces');
  const { parts, manifest, doorways } = buildTerrace(), by = new Map<string, any[]>();
  for (const it of palaceFurnishingPlan(parts, manifest, doorways)) { const k = `${it.building}:${it.room}:${it.state}`; (by.get(k) ?? by.set(k, []).get(k)!).push(it); }
  for (const [k, its] of by) { const [b, id, st] = k.split(':'), e = its.reduce((a, q) => a + q.e, 0) / its.length, n = its.reduce((a, q) => a + q.n, 0) / its.length;
    const items: Item[] = its.map(q => ({ k: (q.kind === 'carpet' || q.kind === 'mat' ? 'carpet' : 'chest') as any, sub: q.kind, u: q.e, v: q.n, rot: q.theta, w: q.hu * 2, d: q.hv * 2, h: q.h, y: 0, vr: 0, wall: -1 }));
    rooms.push({ kind: `palace/${b}/${st}`, e, n, room: { id: `palace:${k}`, u0: e - 50, u1: e + 50, v0: n - 50, v1: n + 50, doors: [], back: 1, use: 'living' }, plan: { items, floor: 1, covered: 0, use: 'living', clear: [] }, tris: 0 }); void id; } }
const rows = census(rooms, 15, r => !!(r as any).pop);
console.log(`[census] ${BASE ? 'BASELINE (houses.ts before D-610)' : 'D-610 interiors'}${NOPOP ? ', no population' : ''}: ${rooms.length} rooms in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
console.log(formatCensus(rows));
// the ring: triangles of the rooms within RING_R of each street door (the eye in the lane)
const grid = new Map<string, CRoom[]>(), gk = (e: number, n: number) => `${Math.floor(e / RING_R)},${Math.floor(n / RING_R)}`; for (const r of rooms) (grid.get(gk(r.e, r.n)) ?? grid.set(gk(r.e, r.n), []).get(gk(r.e, r.n))!).push(r);
let worst = 0, sum = 0; for (const [e, n] of ringPts) { let t = 0; const ce = Math.floor(e / RING_R), cn = Math.floor(n / RING_R); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const r of grid.get(`${ce + a},${cn + b}`) ?? []) if (Math.hypot(r.e - e, r.n - n) < RING_R + 3) t += r.tris ?? 0; worst = Math.max(worst, t); sum += t; }
console.log(`[census] the ring (rooms within ${RING_R} m of a street door): mean ${(sum / Math.max(1, ringPts.length) / 1e3).toFixed(1)} k triangles, worst ${(worst / 1e3).toFixed(1)} k`);
// the household's standing in its rooms: things per living room and sleeping room by standing (the poor sparse, the rich full)
for (const use of ['living', 'sleeping']) { const rs = rooms.filter(r => r.room.use === use && (r as any).st !== undefined), b = [0, 0.3, 0.55, 0.75, 1.01];
  console.log(`[census] ${use} rooms, things by the household's standing: ` + b.slice(0, -1).map((lo, i) => { const q = rs.filter(r => (r as any).st >= lo && (r as any).st < b[i + 1]); return `${lo}-${b[i + 1] > 1 ? 1 : b[i + 1]}: ${(q.reduce((a, r) => a + r.plan.items.length, 0) / Math.max(1, q.length)).toFixed(1)} (${q.length})`; }).join(', ')); }
const withK = (k: string) => rooms.filter(r => r.plan.items.some(i => i.k === k)).length;
console.log(`[census] rooms with a loom ${withK('loom_upright') + withK('loom_ground')}, a cradle ${withK('cradle')}, toys ${withK('toys')}, tablets ${withK('tablets')}, an anvil ${withK('anvil')}, a potter's wheel ${withK('wheel')}, spinning ${withK('spinning')}, tools leaning ${withK('tool_lean')}`);
if (JSONOUT) writeFileSync(JSONOUT, JSON.stringify({ baseline: BASE, rows, ring: { mean: sum / Math.max(1, ringPts.length), worst } }, null, 1));
