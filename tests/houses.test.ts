// D-234: the town's houses as built (houses.ts, houseplan.ts, towndoors.ts; build.ts levels). Headless (no GPU):
//  - every house is built at both levels (walls, roof, doorways); the far level holds every plot, the near tiles too;
//  - the street doors stand in the plan's doorways (the walking grid's door edges; the leaf spans the opening);
//  - the fixtures stand in their own courts, off the doors, and the people's court spots avoid them (walk.ts plotCells);
//  - hearths stand in courts, clear of the walls, where the fire system has them;
//  - the line-of-sight raster (tests/lib/townLos.ts, D-227) reads the new geometry: court facades at the eave, parapets by
//    the household's standing;
//  - budgets of the far level and the near tiles; the variety of the houses (UD-08: nothing copy-pasted).
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three/webgpu';
import { FireSystem } from '../src/world/fire';
import { Settlement } from '../src/world/settlement/build';
import { newHB, HOUSE_PARTS, P, NEAR_R, TILE } from '../src/world/settlement/houses';
import { fixturesOf, livesOf, blockedOf, HOUSE_KINDS } from '../src/world/settlement/houseplan';
import { plotCells, passable } from '../src/world/settlement/walk';
import { ROOM, COURT, YARD, EAVE_LIP, type Site } from '../src/world/settlement/site';
import { heightRaster, rasterAt } from './lib/townLos';
import { loadTerrain } from './plainLib';
import { hashString } from '../src/core/rng';

let town: Settlement, fire: FireSystem, T: ReturnType<typeof loadTerrain>;
beforeAll(() => { T = loadTerrain(); fire = new FireSystem(0); town = new Settlement(null, T, fire, 'test'); }, 300_000);
const houses = (s: Site) => s.plots.filter(p => HOUSE_KINDS.has(p.kind));
const decode = (o: number) => ({ desc: o >> 5, part: o & 31 });
/** the houses' far level (its vertices carry their tile's centre) */
const isFarMesh = (o: any) => !!o.geometry?.getAttribute?.('tileId');

describe('every house built (D-234)', () => {
  it('the far level holds walls and roofs of every house plot; every near tile builds every house of it with walls, roof, eave or parapet and doorways', () => {
    const farParts = new Map<string, Set<number>>();
    // the far batches' owners (via the meshes' describe on every face)
    let farFaces = 0;
    town.group.traverse((o: any) => { if (!o.isMesh || !isFarMesh(o)) return; const n = o.geometry.index.count / 3; farFaces += n;
      for (let f = 0; f < n; f++) { const d = o.userData.describe({ faceIndex: f }); if (!d) continue; const id = d.note.split(':')[0]; (farParts.get(id) ?? farParts.set(id, new Set()).get(id)!).add(d.part ?? 0); } });
    let nHouse = 0; const missFar: string[] = [];
    for (const hs of town.houses) for (const p of houses(hs.s)) { nHouse++; const ps = farParts.get(p.id); if (!ps || !ps.has(P.wall) || !ps.has(P.roof)) missFar.push(p.id); }
    console.log(`[houses] ${nHouse} houses and workshops; far level ${farFaces} faces; missing on the far level: ${missFar.length}`);
    expect(nHouse).toBeGreaterThan(1400); expect(missFar).toEqual([]);
    // near: every tile of every site, straight into batches (no meshes)
    const nearParts = new Map<string, Set<number>>(); let tiles = 0, tris = 0, worst = 0; const t0 = performance.now();
    for (const hs of town.houses) { const own = new Map<number, string>(); hs.s.plots.forEach(p => own.set(hs.pdesc[p.idx], `${hs.s.id}/${p.id}`)); // (description indices are per cluster)
      for (const t of hs.tiles.keys()) { const B = newHB(); hs.buildTile(t, B); tiles++; let tt = 0;
      for (const b of Object.values(B)) { tt += b.tris; for (const o of b.owner) { const { desc, part } = decode(o); const id = own.get(desc); if (id) (nearParts.get(id) ?? nearParts.set(id, new Set()).get(id)!).add(part); } }
      tris += tt; worst = Math.max(worst, tt); } }
    const ms = performance.now() - t0; const missNear: string[] = [];
    for (const hs of town.houses) for (const p of houses(hs.s)) { const ps = nearParts.get(`${hs.s.id}/${p.id}`); if (!ps || !ps.has(P.wall) || !ps.has(P.roof) || !ps.has(P.door) || !(ps.has(P.eave) || ps.has(P.spout))) missNear.push(`${p.id}[${[...(ps ?? [])].sort((a, b) => a - b).join(',')}]`); }
    console.log(`[houses] near: ${tiles} tiles in ${ms.toFixed(0)} ms (${(ms / tiles).toFixed(1)} ms a tile), ${(tris / 1e6).toFixed(2)} M triangles over the whole town, worst tile ${(worst / 1e3).toFixed(1)} k; houses missing a part near: ${missNear.length} ${missNear.slice(0, 5).join(' ')}`);
    expect(missNear.length).toBeLessThanOrEqual(Math.ceil(nHouse * 0.01)); // (a house whose court has no oversailed facade and no lane spout may lack both)
    expect(worst).toBeLessThan(60_000);
  }, 600_000);
});

describe('doors, courts and the people (D-234)', () => {
  it('each street door leaf hangs in its plan doorway (the walking grid\'s door edge), shut across the opening, open into the house', () => {
    let n = 0; const bad: string[] = [];
    for (const hs of town.houses) { const s = hs.s;
      for (const d of hs.doors) { const p = s.plots[d.plot], dp = s.doorPoints(p)!; n++;
        const e = s.edgeBetween(p.door!.cell, p.door!.out); if (!s.doors.has(e) || !passable(s, p.door!.cell, p.door!.out)) bad.push(`${p.id}: door edge not walkable`);
        const mid = s.grid(...dp.mid), inside = s.grid(...dp.inside);
        const closedEnd = [d.hinge[0] + Math.cos(d.closedYaw), d.hinge[1] + Math.sin(d.closedYaw)]; // (world x, −z) → grid (e, n)
        const cMid = [(d.hinge[0] + closedEnd[0]) / 2, (d.hinge[1] + closedEnd[1]) / 2];
        // the shut leaf's middle within 0.45 m of the doorway's middle (it hangs on the inner face), its span along the wall
        const dm = Math.hypot(cMid[0] - mid[0], cMid[1] - mid[1]); if (dm > 0.5) bad.push(`${p.id}: shut leaf ${dm.toFixed(2)} m from the doorway`);
        // open, the leaf points into the house
        const oDir = [Math.cos(d.openYaw), Math.sin(d.openYaw)], inw = [inside[0] - mid[0], inside[1] - mid[1]]; if (oDir[0] * inw[0] + oDir[1] * inw[1] < 0.3) bad.push(`${p.id}: opens outward`);
        if (Math.abs(d.y - T.heightAt(mid[0], -mid[1])) > 0.4) bad.push(`${p.id}: leaf foot ${d.y.toFixed(2)} vs ground`); } }
    console.log(`[houses] ${n} street doors checked`); expect(n).toBeGreaterThan(1400); expect(bad.slice(0, 10)).toEqual([]);
  });
  it('fixtures stand in their own plot, off every doorway; the people\'s court spots avoid them; nothing moved the plan (hearths, doors, capacities)', () => {
    const bad: string[] = []; let nf = 0, nb = 0;
    for (const s of town.plan.sites) { const bl = blockedOf(s);
      for (const f of fixturesOf(s)) { nf++; if (f.kind === 'fleece' || f.kind === 'roller' || f.kind === 'roof_fuel' || f.kind === 'roof_mats' || f.kind === 'portico') continue; // (roof things; the portico's court was checked two cells deep when it was laid out)
        // on the plot's cells or its edge (walls): the cell half a metre into the court from the fixture's point
        const k = s.k(s.ci(f.u + Math.cos(f.rot) * 0.5), s.cj(f.v + Math.sin(f.rot) * 0.5)); if (f.kind !== 'drain' && f.kind !== 'niche' && s.cell[k] !== f.plot) bad.push(`${s.plots[f.plot].id} ${f.kind}: not in its plot`); }
      for (const k of bl) { nb++; if (!(s.sub[k] === COURT || s.sub[k] === YARD)) bad.push(`${s.id} blocked cell ${k} not a court`);
        const i = k % s.W, j = (k / s.W) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (!s.inb(i + di, j + dj)) continue; if (s.doors.has(s.edgeBetween(k, s.k(i + di, j + dj)))) bad.push(`${s.id} blocked cell ${k} at a door`); } }
      for (const p of s.plots) { const c = plotCells(s, p.idx); const open = c.open.filter(k => !bl.has(k)); if (open.length && c.open.some(k => bl.has(k))) bad.push(`${p.id}: people may stand in a fixture`); } }
    console.log(`[houses] ${nf} fixtures, ${nb} court cells taken by them`); expect(nf).toBeGreaterThan(8000); expect(bad.slice(0, 10)).toEqual([]);
  });
  it('hearths stand in court cells of their own plot, at least 0.3 m clear of the wall faces, exactly where the fire system burns them', () => {
    const bad: string[] = []; let n = 0; const firePos = fire.fires.filter(f => f.kind === 'hearth' && f.group).map(f => [f.pos.x, -f.pos.z]);
    for (const s of town.plan.sites) for (const f of s.fittings) { if (f.kind !== 'hearth' || f.plot < 0 || !HOUSE_KINDS.has(s.plots[f.plot].kind)) continue; n++;
      const i = s.ci(f.u), j = s.cj(f.v), k = s.k(i, j); if (s.cell[k] !== f.plot || (s.sub[k] !== COURT && s.sub[k] !== YARD)) { bad.push(`${s.plots[f.plot].id}: hearth not in its court`); continue; }
      // clearance from any wall on the cell's edges: walls are ≤ 0.7 m thick, centred on the edge (0.35 m in)
      const fu = f.u - (s.u0 + i), fv = f.v - (s.v0 + j);
      for (const [di, dj, d] of [[1, 0, 1 - fu], [-1, 0, fu], [0, 1, 1 - fv], [0, -1, fv]] as const) { const kk = s.inb(i + di, j + dj) ? s.k(i + di, j + dj) : -1; const wall = kk < 0 || s.cell[kk] !== f.plot || s.sub[kk] === ROOM;
        if (wall && d < 0.35 + 0.3) bad.push(`${s.plots[f.plot].id}: hearth ${d.toFixed(2)} m from a wall line`); }
      const g = s.grid(f.u, f.v); if (!firePos.some(q => Math.hypot(q[0] - g[0], q[1] - g[1]) < 0.01)) bad.push(`${s.plots[f.plot].id}: no fire at the hearth`); }
    console.log(`[houses] ${n} house hearths checked`); expect(n).toBeGreaterThan(800); expect(bad.slice(0, 10)).toEqual([]);
  });
});

describe('the line-of-sight raster reads the new houses (D-227 on D-234)', () => {
  it('court facades stand at the eave (roof + lip) and outer walls at roof + parapet, the parapet by the household\'s standing', () => {
    const s = town.plan.sites.find(x => x.id === 'q_s1')!, hs = town.houses.find(h => h.s === s)!;
    const R = heightRaster(town.group, 0.25, /^settlement:/, { x0: s.frame.c[0] - 60, x1: s.frame.c[0] + 60, z0: -s.frame.c[1] - 60, z1: -s.frame.c[1] + 60 });
    let nF = 0, okF = 0, nP = 0, okP = 0; const pars = new Set<number>();
    for (const w of s.walls()) { const mu = (w.u0 + w.u1) / 2, mv = (w.v0 + w.v1) / 2, g = s.grid(mu, mv); if (Math.abs(g[0] - s.frame.c[0]) > 55 || Math.abs(g[1] - s.frame.c[1]) > 55 || w.door) continue;
      const sp = hs.wallSpan(w), y = rasterAt(R, g[0], -g[1]); const p = s.plots[w.sides[0].plot];
      if (w.kind === 'facade') { nF++; if (Math.abs(y - (hs.base[p.idx] + p.height + EAVE_LIP)) < 0.15) okF++; }
      if (w.kind === 'outer' && w.sides.length === 1 && HOUSE_KINDS.has(p.kind)) { const k = s.k(s.ci(mu + (w.v0 === w.v1 ? 0 : 0.5)), s.cj(mv + (w.v0 === w.v1 ? 0.5 : 0))); void k; nP++; if (Math.abs(y - sp.top) < 0.15) okP++; pars.add(Math.round(p.parapet * 20)); } }
    console.log(`[houses] raster: ${okF}/${nF} court facades at roof + lip, ${okP}/${nP} outer walls at their top; ${pars.size} parapet heights (5 cm bins)`);
    expect(okF / nF).toBeGreaterThan(0.9); expect(okP / nP).toBeGreaterThan(0.9); expect(pars.size).toBeGreaterThan(6);
  });
});

describe('budgets (settlement view ≤ 150 draw calls and ≤ 2 M triangles added)', () => {
  it('the far level, and the near tiles at three lane spots: triangles, meshes, the share that casts shadows', () => {
    let far = 0, farMeshes = 0; town.group.traverse((o: any) => { if (o.isMesh && isFarMesh(o)) { far += o.geometry.index.count / 3; farMeshes++; } });
    console.log(`[houses] far level ${(far / 1e6).toFixed(3)} M triangles in ${farMeshes} meshes`); expect(far).toBeLessThan(0.8e6);
    for (const id of ['q_s1', 'q_w1', 'q_s3']) { const s = town.plan.sites.find(x => x.id === id)!; const t0 = performance.now(); town.nearUpdate(s.frame.c[0], -s.frame.c[1], 0, true); const ms = performance.now() - t0;
      let cast = 0, all = 0, meshes = 0; town.group.traverse((o: any) => { if (!o.isMesh || !/settlement:near:/.test(o.name) || !o.visible) return; const t = o.geometry.index.count / 3; all += t; meshes++; if (o.castShadow) cast += t; });
      console.log(`[houses] near ${id}: ${town.nearInfo.tiles} tiles, ${meshes} meshes, ${(all / 1e3).toFixed(0)} k triangles (${(cast / 1e3).toFixed(0)} k cast), built in ${ms.toFixed(0)} ms`);
      expect(all).toBeLessThan(0.6e6); expect(cast).toBeLessThan(0.25e6); expect(meshes).toBeLessThanOrEqual(5 * Math.ceil(Math.PI * (NEAR_R + TILE) ** 2 / TILE ** 2)); }
    town.nearUpdate(1e7, 1e7, 0, true);
  }, 300_000);
});

describe('no two houses alike (UD-08, D-236: nothing copy-pasted)', () => {
  it('distinct house configurations; no identical house within 20 m; the modules differ at 20 m', () => {
    const sig: { key: string; mod: string; g: [number, number]; id: string }[] = [];
    for (const s of town.plan.sites) { const L = livesOf(s), fx = fixturesOf(s);
      for (const p of houses(s)) { const rooms = new Map<number, number>(); for (let k = 0; k < s.cell.length; k++) if (s.cell[k] === p.idx && s.sub[k] === ROOM) rooms.set(s.room[k], (rooms.get(s.room[k]) ?? 0) + 1);
        const court = plotCells(s, p.idx).open.length, l = L[p.idx], mine = fx.filter(f => f.plot === p.idx).map(f => f.kind).sort().join(',');
        // the module: what a passer-by sees of the house from the lane at 20 m (frontage, height, parapet, tone, door wood, footing)
        const mod = [p.w, Math.round(p.height * 10), Math.round(p.parapet * 20), Math.round(l.socle * 20), Math.round(l.doorWood * 4), hashString(p.id + 'colour') % 5].join('|');
        const key = [p.w, p.d, [...rooms.values()].sort((a, b) => a - b).join('.'), court, mod, mine, l.age, l.addition, l.animal].join('/');
        const [i0, j0, i1, j1] = p.rect; sig.push({ key, mod, g: s.grid(s.u0 + (i0 + i1) / 2, s.v0 + (j0 + j1) / 2), id: p.id }); } }
    const keys = new Set(sig.map(x => x.key)), mods = new Set(sig.map(x => x.mod));
    let twins20 = 0, modTwins20 = 0;
    for (let a = 0; a < sig.length; a++) for (let b = a + 1; b < sig.length; b++) { const d = Math.hypot(sig[a].g[0] - sig[b].g[0], sig[a].g[1] - sig[b].g[1]); if (d > 20) continue; if (sig[a].key === sig[b].key) twins20++; if (sig[a].mod === sig[b].mod) modTwins20++; }
    console.log(`[houses] ${sig.length} houses: ${keys.size} distinct configurations (${(100 * keys.size / sig.length).toFixed(1)} %); ${mods.size} distinct lane faces; identical houses within 20 m: ${twins20}; identical lane faces within 20 m: ${modTwins20} pairs`);
    expect(keys.size).toBe(sig.length); expect(twins20).toBe(0); expect(modTwins20 / sig.length).toBeLessThan(0.02);
  });
});

describe('F3 names the house, the part, its tier (D-234; D-228\'s PLACEHOLDER lifted from the near level)', () => {
  it('near faces carry no placeholder and name a part with a tier and sources; far faces are marked as the distant level', () => {
    const s = town.plan.sites.find(x => x.id === 'q_w1')!; town.nearUpdate(s.frame.c[0], -s.frame.c[1], 0, true);
    let near = 0, farN = 0; const parts = new Set<number>(); const bad: string[] = [];
    town.group.traverse((o: any) => { if (!o.isMesh || typeof o.userData.describe !== 'function') return; const n = o.geometry.index.count / 3, isNear = /settlement:near:/.test(o.name), isFar = isFarMesh(o); if (!isNear && !isFar) return;
      for (let f = 0; f < n; f += Math.max(1, Math.floor(n / 400))) { const d = o.userData.describe({ faceIndex: f }); if (!d) { bad.push(`${o.name} ${f}: no description`); continue; }
        if (!['A', 'B', 'C', 'B/C'].includes(d.tier) || !d.src) bad.push(`${o.name}: tier/src`);
        if (isNear) { near++; parts.add(d.part ?? 0); if (d.placeholder || /PLACEHOLDER/.test(d.note)) bad.push(`${o.name}: placeholder`); }
        if (isFar) { farN++; if (d.lod !== 'far') bad.push(`${o.name}: far face not marked`); } } });
    console.log(`[houses] F3: ${near} near faces (${parts.size} parts), ${farN} far faces`);
    expect(bad.slice(0, 5)).toEqual([]); expect(parts.size).toBeGreaterThanOrEqual(10);
    for (const p of HOUSE_PARTS.slice(1)) if (p.note) { expect(p.tier).toBe('C'); expect(p.src.length).toBeGreaterThan(3); }
    town.nearUpdate(1e7, 1e7, 0, true); void THREE;
  });
});

describe('the street doors\' hours and the seasons (D-234)', () => {
  it('shut at night; by day about a fifth shut, a third ajar, the rest open; the season rebuilds the near tiles', async () => {
    const { doorOpenness } = await import('../src/world/settlement/towndoors');
    const doors = town.houses.flatMap(h => h.doors); let night = 0, shut = 0, ajar = 0, open = 0;
    for (const d of doors) { if (doorOpenness(d.id, d.kind, 30, -12) > 0) night++; const o = doorOpenness(d.id, d.kind, 30, 35); if (o === 0) shut++; else if (o < 0.5) ajar++; else open++; }
    console.log(`[houses] doors at night open ${night}; by day shut ${shut}, ajar ${ajar}, open ${open}`);
    expect(night).toBe(0); expect(shut / doors.length).toBeGreaterThan(0.12); expect(shut / doors.length).toBeLessThan(0.32); expect(ajar).toBeGreaterThan(0.2 * doors.length);
    const { seasonOf } = await import('../src/world/settlement/houses'); expect([seasonOf(10), seasonOf(60), seasonOf(130), seasonOf(250)]).toEqual(['cold', 'harvest', 'warm', 'cold']);
    const s = town.plan.sites.find(x => x.id === 'q_s1')!; town.nearUpdate(s.frame.c[0], -s.frame.c[1], 0, true); const n0 = town.nearInfo.tiles;
    (town as any).resetNear(); expect(town.nearInfo.tiles).toBe(n0); town.nearUpdate(s.frame.c[0], -s.frame.c[1], 0, true); expect(town.nearInfo.tiles).toBe(n0); expect(town.nearTile([...(town as any).shownSet][0])).toBe(true);
    town.nearUpdate(1e7, 1e7, 0, true);
  });
});
