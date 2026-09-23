// Phase 7 (the plain): positions against the data, seasonal state by date, the carved channels and the Naqsh-e Rustam
// ground in the heightfield, and the budgets of the generated meshes. Everything here runs headless (no GPU).
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { loadTerrain, loadRiversFile } from './plainLib';
import { PLAIN, feature, pointInPolygon, settlementZones, distToPolyline } from '../src/world/plain/data';
import { riverState, cropState, foliage, doyOf, MID_MONTH, MONTHS, CROP_ROWS, cropTable, YEAR } from '../src/world/plain/seasonal';
import { plotAt, landUseAt, pcg, unit, checkMixes, IRR_STEPS, RAINFED_BARLEY, VINE_SHARE, buildZones, zoneAt } from '../src/world/plain/fields';
import { buildCanals } from '../src/world/plain/canals';
import { placeVillages, villageCompounds, compoundBoxes } from '../src/world/plain/villages';
import { buildPlain, PlainBuild, PLAIN_QUALITY } from '../src/world/plain';
import { carvableTranslit } from '../src/world/plain/naqsh';
import { buildMapLayers, builtPlainOf } from '../src/ui/mapLayers';
import { loadInscriptionFonts } from '../src/arch/decor';
import { curvatureDrop } from '../src/terrain/heightfield';

const T = loadTerrain(), R = loadRiversFile();

// the DNa/DNb carving needs the inscription fonts wherever the plain is built
beforeAll(async () => { await loadInscriptionFonts(async p => { const b = readFileSync('public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; }); });

describe('rivers (plain.json flow_by_month, channel; tools/build_terrain.py layer 4)', () => {
  it('the fitted trapezoid reproduces every monthly width within 0.15 m', () => {
    for (const id of ['river_pulvar', 'river_kur']) { const f = feature(id), c = f.channel;
      for (const r of f.flow_by_month) expect(Math.abs(c.bed_width_m + 2 * c.side_slope_h_per_v * r.depth_m - r.width_m), `${id} ${r.month}`).toBeLessThan(0.15); }
  });
  it('river state on the date: mid-April is the table peak, mid-September the low; turbid in spring', () => {
    const dayOfDoy = (doy: number) => ((doy - doyOf(0)) % YEAR + YEAR) % YEAR;
    const apr = riverState('river_pulvar', dayOfDoy(MID_MONTH[3])), sep = riverState('river_pulvar', dayOfDoy(MID_MONTH[8]));
    expect(apr.width).toBeCloseTo(18.0, 5); expect(apr.depth).toBeCloseTo(1.2, 5); expect(apr.turbid).toBeCloseTo(1, 5);
    expect(sep.width).toBeCloseTo(7.5, 5); expect(sep.depth).toBeCloseTo(0.39, 5); expect(sep.turbid).toBeCloseTo(0, 5);
    const kur = riverState('river_kur', dayOfDoy(MID_MONTH[3])); expect(kur.width).toBeCloseTo(35, 5);
    // day 0 is 17 April (1 Nisannu 467): high water
    expect(riverState('river_pulvar', 0).flowRel).toBeGreaterThan(0.95);
  });
  it('the centreline follows the data course (joined OSM parts) and the bank level never rises downstream', () => {
    for (const r of R.rivers) {
      const course = feature(r.id).polylines.flat();
      let worst = 0; for (let i = 0; i < r.x.length - (r.id === 'river_pulvar' ? 20 : 0); i += 7) worst = Math.max(worst, distToPolyline(r.x[i], r.y[i], course)); // the Pulvar's last ~340 m join it to the Kur (C)
      expect(worst, r.id).toBeLessThan(1);
      for (let i = 1; i < r.bank.length; i++) expect(r.bank[i]).toBeLessThanOrEqual(r.bank[i - 1] + 1e-6);
      for (let i = 0; i < r.bank.length; i++) expect(r.bank[i]).toBeLessThanOrEqual(r.floodplain[i] + 0.02); // never above the local floodplain
    }
  });
  it('the heightfield is carved under the channel (bed - 0.3 m) wherever the corridor is drawn', () => {
    let n = 0;
    for (const r of R.rivers) for (let i = 0; i < r.x.length; i += 25) {
      const x = r.x[i], z = -r.y[i], bedAsl = r.bank[i] - r.channel.bank_height_m;
      expect(T.aslAt(x, z), `${r.id} at ${x.toFixed(0)},${r.y[i].toFixed(0)}`).toBeLessThan(bedAsl - 0.1); n++;
    }
    expect(n).toBeGreaterThan(400);
  });
  it('the Pulvar bed meets the Kur at the confluence without a step (< 0.5 m)', () => {
    const P = R.rivers.find(r => r.id === 'river_pulvar')!, K = R.rivers.find(r => r.id === 'river_kur')!;
    const ex = P.x[P.x.length - 1], ey = P.y[P.y.length - 1]; let bi = 0, bd = Infinity;
    for (let i = 0; i < K.x.length; i++) { const d = Math.hypot(K.x[i] - ex, K.y[i] - ey); if (d < bd) { bd = d; bi = i; } }
    expect(bd).toBeLessThan(200); expect(Math.abs(P.bank[P.bank.length - 1] - K.bank[bi])).toBeLessThan(0.5);
    const cf = feature('confluence').xy; expect(Math.hypot(ex - cf[0], ey - cf[1])).toBeLessThan(feature('confluence').unc_m);
  });
});

describe('Naqsh-e Rustam ground (plain.json naqsh_e_rustam; build_terrain.py layer 5)', () => {
  const nr = PLAIN.naqsh_e_rustam;
  it('ancient ground at the cliff foot is 5 m below the present ground and the face line is clear of the smoothed cliff', () => {
    expect(R.nrAncientFootAsl).toBeGreaterThan(1615); expect(R.nrAncientFootAsl).toBeLessThan(1628);
    for (let x = nr.cliff.x_range[0] + 20; x <= nr.cliff.x_range[1] - 20; x += 40) {
      // in front of the face (and where the rock face is displaced back up to 2 m) the ground is at the ancient foot level (+ its gentle 2 % rise outward)
      for (const d of [-2, 2, 15, 30]) expect(T.aslAt(x, -(nr.cliff.face_y - d)), `x ${x} d ${d}`).toBeLessThan(R.nrAncientFootAsl + 0.02 * Math.max(0, d) + 0.6);
    }
  });
  it('the Darius I tomb point lies on the face line (within its 20 m uncertainty) and the Xerxes tomb 60 m ENE on the same line', () => {
    const d = feature('nr_darius_tomb'), x = feature('nr_xerxes_tomb');
    expect(Math.abs(d.xy[1] - nr.cliff.face_y)).toBeLessThan(d.unc_m);
    expect(x.xy[1]).toBe(d.xy[1]); expect(x.xy[0] - d.xy[0]).toBe(60);
    expect(nr.facade.lower_arm_h_m).toBeCloseTo(nr.facade.height_m - nr.facade.median_register_h_m - nr.facade.upper_arm_h_m, 2);
  });
});

describe('fields and crops by date (plain.json crops; seasonal.ts)', () => {
  const at = (row: typeof CROP_ROWS[number], month: number) => cropState(row, MID_MONTH[month]);
  it('barley follows the table: 0.3 m in March, 0.6 m in April; ripening in May; cut by mid-June; stubble in summer; ploughed in November', () => {
    expect(at('barley', 2).height).toBeCloseTo(0.3, 5); expect(at('barley', 3).height).toBeCloseTo(0.6, 5);
    expect(at('barley', 3).green).toBeGreaterThan(0.8);
    expect(cropState('barley', 138).straw).toBeGreaterThan(0.5); // 18 May: golden
    expect(at('barley', 5).height).toBe(0); expect(at('barley', 7).straw).toBeGreaterThan(0.25); expect(at('barley', 7).green).toBeLessThan(0.1);
    expect(cropState('barley', 312).tilled).toBeGreaterThan(0.9); // 8 Nov
  });
  it('wheat stands to 1.1 m in June and is harvested by mid-July; sesame is a summer crop; fallow follows the herb layer', () => {
    expect(at('wheat', 5).height).toBeCloseTo(1.1, 5); expect(at('wheat', 6).height).toBe(0);
    expect(at('sesame', 7).height).toBeCloseTo(1.2, 5); expect(at('sesame', 0).height).toBe(0); expect(at('sesame', 11).height).toBe(0);
    expect(at('fallow', 3).green).toBeGreaterThan(at('fallow', 7).green);
  });
  it('the crop-state texture is the same function (8-bit)', () => {
    const t = cropTable();
    for (const [r, row] of CROP_ROWS.entries()) for (const d of [10, 105, 150, 200, 330]) { const s = cropState(row, d), i = (r * YEAR + d) * 4;
      expect(Math.abs(t[i] / 255 * 1.5 - Math.min(1.5, s.height))).toBeLessThan(0.01); expect(Math.abs(t[i + 1] / 255 - s.green)).toBeLessThan(0.005); }
  });
  it('deciduous trees are bare in January and in leaf in June; fruit trees blossom in late March', () => {
    for (const g of ['plane', 'pome', 'oak', 'willow', 'poplar', 'fig', 'almond'] as const) { expect(foliage(g, 15).leaf).toBeLessThan(0.05); expect(foliage(g, 166).leaf).toBeGreaterThan(0.95); }
    expect(foliage('pome', 90).blossom).toBeGreaterThan(0.9); expect(foliage('fig', 90).blossom).toBe(0); expect(foliage('pomegranate', 150).blossom).toBeGreaterThan(0.4); // peak share 0.45 (D-149)
    for (const g of ['evergreen_dark', 'evergreen_grey'] as const) for (const d of [15, 105, 200, 330]) expect(foliage(g, d).leaf).toBe(1);
  });
});

describe('plots and land use (C layout; the shader and JS share one hash)', () => {
  it('PCG hash equals an independent 64-bit (BigInt) evaluation of three\'s TSL `hash` recipe, and units are float-exact', () => {
    const M = 0xffffffffn, ref = (v: number) => { const s = (BigInt(v) * 747796405n + 2891336453n) & M; const w = (((s >> ((s >> 28n) + 4n)) ^ s) * 277803737n) & M; return Number(((w >> 22n) ^ w) & M); };
    for (const v of [0, 1, 2, 12345, 32768, 65535, 2 ** 31, 2 ** 32 - 1, 987654321]) expect(pcg(v)).toBe(ref(v));
    for (let i = 0; i < 1000; i++) { const u = unit(pcg(i)); expect(Math.fround(u)).toBe(u); expect(u).toBeGreaterThanOrEqual(0); expect(u).toBeLessThan(1); }
  });
  it('plots are irregular strips, not a rectangular grid: sizes 22-52 x 90-210 m, orientations spread over 180 deg', () => {
    const angles: number[] = []; const seen = new Set<number>();
    for (let i = 0; i < 400; i++) { const p = plotAt(-9000 + i * 97.3, 4000 + (i % 20) * 311); if (seen.has(p.h)) continue; seen.add(p.h);
      expect(p.w).toBeGreaterThanOrEqual(22); expect(p.w).toBeLessThanOrEqual(52); expect(p.l).toBeGreaterThanOrEqual(90); expect(p.l).toBeLessThanOrEqual(210); angles.push(p.angle); }
    const bins = new Array(6).fill(0); for (const a of angles) bins[Math.min(5, Math.floor(a / Math.PI * 6))]++;
    expect(Math.min(...bins)).toBeGreaterThan(angles.length / 20);
  });
  it('crop thresholds are the data mixes', () => {
    const m = checkMixes();
    expect(m.irr).toEqual(IRR_STEPS.map(v => expect.closeTo(v, 6)) as any); expect(m.kurSame).toBe(true);
    expect(m.rainBarley).toBe(RAINFED_BARLEY); expect(m.vine).toBe(VINE_SHARE);
  });
});

describe('placement: canals, villages, zones', () => {
  const canals = buildCanals(T, R.rivers, 1), villages = placeVillages(T, R.rivers, canals, 1);
  const zones = settlementZones();
  it('canals: off-takes on the irrigated side, 0.5 m/km, >= 0.8 km, inside their irrigated polygon, never in a settlement zone', () => {
    expect(canals.length).toBeGreaterThan(20);
    const rule = feature('irrigation_systems_sumner').procedural_rule;
    for (const c of canals) {
      expect(c.length).toBeGreaterThanOrEqual(800);
      const g = (c.level[0] - c.level[c.level.length - 1]) / (c.length / 1000); expect(g).toBeCloseTo(rule.gradient_m_per_km, 5);
      const poly = feature(c.river === 'river_pulvar' ? 'fields_irrigated_pulvar' : 'fields_irrigated_kur').polygon;
      for (const p of c.pts.slice(1)) { expect(pointInPolygon(p[0], p[1], poly)).toBe(true); expect(zones.some(z => pointInPolygon(p[0], p[1], z))).toBe(false); }
      expect(c.width).toBeGreaterThanOrEqual(rule.main_canal_width_m[0]); expect(c.width).toBeLessThanOrEqual(rule.main_canal_width_m[1]);
    }
  });
  it('villages: the four Barrington villages within their uncertainty; 33 more by the rule (>= 2 km apart, <= 1.5 km from water)', () => {
    const vu = feature('villages_unlocated').procedural_rule;
    expect(villages.length).toBe(4 + vu.count_secure - vu.located_here);
    for (const id of ['village_masumabad_west', 'village_saidun', 'village_tukrash', 'village_rakkan']) { const v = villages.find(q => q.id === id)!, f = feature(id);
      expect(Math.hypot(v.x - f.xy[0], v.y - f.xy[1])).toBeLessThanOrEqual(f.unc_m); expect(v.tier).toBe('C'); }
    const water = [...R.rivers.map(r => Array.from(r.x, (x, i) => [x, r.y[i]])), ...canals.map(c => c.pts)];
    for (const v of villages.filter(q => !q.located)) {
      for (const w of villages) if (w !== v) expect(Math.hypot(v.x - w.x, v.y - w.y)).toBeGreaterThanOrEqual(vu.min_spacing_km * 1000);
      expect(Math.min(...water.map(l => distToPolyline(v.x, v.y, l as any)))).toBeLessThanOrEqual(vu.max_dist_to_water_km * 1000);
      expect(zones.some(z => pointInPolygon(v.x, v.y, z))).toBe(false);
      expect(v.pop).toBeGreaterThanOrEqual(vu.pop_range[0]); expect(v.pop).toBeLessThanOrEqual(vu.pop_range[1]);
    }
    const total = villages.filter(q => !q.located).reduce((a, v) => a + v.pop, 0);
    expect(Math.abs(total - feature('villages_unlocated').layout.total_procedural_pop) / 30000).toBeLessThan(0.1);
    expect(villages.reduce((a, v) => a + v.pop, 0)).toBeLessThanOrEqual(PLAIN._meta.density.plain_population_max);
  });
  it('zones: no fields in settlement zones or on steep ground; crops follow the mixes', () => {
    const Z = buildZones({ terrain: T, rivers: R.rivers.map(r => ({ x: r.x, y: r.y, halfCorridor: r.carveRadius.mid + 24 })), villages: villages.map(v => ({ x: v.x, y: v.y, r: v.r })) });
    for (const z of zones) for (let k = 0; k < z.length; k++) { const a = z[k], b = z[(k + 1) % z.length], cx = (a[0] + b[0] + z[(k + 2) % z.length][0]) / 3, cy = (a[1] + b[1] + z[(k + 2) % z.length][1]) / 3;
      if (pointInPolygon(cx, cy, z)) { const t = zoneAt(Z, cx, -cy); expect(t[0] + t[1] + t[2]).toBe(0); } }
    const counts: Record<string, number> = {}; let n = 0;
    for (let i = 0; i < 60000 && n < 4000; i++) { const x = -12000 + (i * 7919) % 24000, z = -12000 + ((i * 104729) % 24000); const u = landUseAt(Z, x, z); if (u.use !== 'irrigated') continue; counts[u.row] = (counts[u.row] ?? 0) + 1; n++; }
    const mix = feature('fields_irrigated_pulvar').crop_mix;
    for (const [k, v] of Object.entries({ barley: mix.barley, wheat: mix.wheat, emmer_spelt: mix.emmer_spelt, sesame: mix.sesame, fallow: mix.fallow })) expect(Math.abs((counts[k] ?? 0) / n - v), k).toBeLessThan(0.06);
  });
});

describe('walking the plain (terrain heightfield + lazy plain colliders)', () => {
  let P: PlainBuild, phys: any, Player: any;
  beforeAll(async () => {
    const { Physics } = await import('../src/player/physics'); Player = (await import('../src/player/player')).Player;
    phys = await Physics.create();
    P = await buildPlain(new THREE.Scene(), T, phys, { quality: 'test', seed: 1, fetchJson: async p => JSON.parse(readFileSync('public/' + p, 'utf8')) });
  }, 120_000);
  /** walk from grid (e, n) at a world yaw for `sec` seconds; the plain's lazy colliders follow the player */
  const walk = (e: number, n: number, yaw: number, sec: number) => {
    phys.updateTerrain(T, { x: e, y: 0, z: -n });
    const ctx = (p: any) => ({ clock: { dayIndex: 150 }, cond: { windMs: 1 }, camera: { position: new THREE.Vector3(p.x, p.y + 1.6, p.z) }, player: { position: new THREE.Vector3(p.x, p.y, p.z) } });
    P.update(0, ctx({ x: e, y: T.heightAt(e, -n), z: -n })); phys.step(1 / 60);
    const ground = phys.castRayDown(e, -n, T.heightAt(e, -n) + 30) ?? T.heightAt(e, -n);
    const pl = new Player(phys, e, ground + 0.05, -n); let minY = Infinity;
    for (let i = 0; i < sec * 60; i++) {
      if (i % 30 === 0) { phys.updateTerrain(T, pl.position); P.update(0, ctx(pl.position)); }
      pl.update(1 / 60, { forward: 1, right: 0, run: false, yaw, pitch: 0 }); phys.step(1 / 60); minY = Math.min(minY, pl.feetY);
    }
    return { pl, minY };
  };
  it('crosses the Pulvar at low water (September): wades the channel and climbs out, no fall', () => {
    const r = R.rivers.find(q => q.id === 'river_pulvar')!; let i = 0, bd = Infinity;
    for (let k = 0; k < r.x.length; k++) { const d = Math.hypot(r.x[k] + 2511, r.y[k] - 2729); if (d < bd) { bd = d; i = k; } }
    const bedY = r.bank[i] - r.channel.bank_height_m - T.meta.court_asl - curvatureDrop(r.x[i], -r.y[i]);
    const { pl, minY } = walk(r.x[i], r.y[i] - 60, 0, 90); // yaw 0 walks grid north, across the W-flowing reach
    expect(-pl.position.z - (r.y[i] - 60)).toBeGreaterThan(100); // got across (not stuck on a bank)
    expect(minY).toBeGreaterThan(bedY - 0.4); // never fell through the carved trough
    expect(pl.maxFall).toBeLessThan(1);
  });
  it('a village house wall stops the player', () => {
    const v = P.data.villages.find(q => q.id === 'village_p01')!;
    const c = villageCompounds(v, T, 1)[0], wall = compoundBoxes(c, T.heightAt(c.x, -c.y))[0]; // the N yard wall
    const sa = Math.sin(c.angle), ca = Math.cos(c.angle), out = c.d / 2 + 10;
    const e = c.x - sa * out, n = c.y + ca * out; // 10 m outside the N wall along the compound's +v axis
    const yaw = Math.atan2(-sa, -ca); // walk along -v (world direction (sa, ca))
    const { pl } = walk(e, n, yaw, 20);
    const along = (pl.position.x - c.x) * -sa + (-pl.position.z - c.y) * ca; // position along +v from the compound centre
    expect(along).toBeGreaterThan(c.d / 2 - 0.05); void wall;
  });
  it('the Naqsh-e Rustam cliff face stops the player at its foot', () => {
    const fy = PLAIN.naqsh_e_rustam.cliff.face_y;
    const { pl } = walk(700, fy - 40, 0, 40);
    expect(-pl.position.z).toBeLessThan(fy + 2.5); expect(-pl.position.z).toBeGreaterThan(fy - 6);
  });
});

describe('the plain as built (headless): budgets, tiers, chronology', () => {
  let P: PlainBuild; const scene = new THREE.Scene();
  beforeAll(async () => {
    P = await buildPlain(scene, T, null, { quality: 'high', seed: 1, fetchJson: async p => JSON.parse(readFileSync('public/' + p, 'utf8')) });
  }, 120_000);
  it('the out-of-world map reads the plain as built (rivers, canals, villages)', () => {
    const L = buildMapLayers({ plain: builtPlainOf(P.data as any) });
    expect(L.filter(i => i.style === 'river' && i.id.startsWith('river_')).length).toBe(P.data.rivers.rivers.length);
    expect(L.filter(i => i.style === 'village').length).toBe(P.data.villages.length);
    expect(L.filter(i => i.style === 'canal').length).toBeGreaterThanOrEqual(P.data.canals.length);
  });
  it('the tomb of Darius carries DNa and DNb in Old Persian from the edition, without the modern lacunae', () => {
    const tm = P.group.getObjectByName('nr-inscriptions-carved') as THREE.Mesh; expect(tm).toBeTruthy();
    const note = String(tm.userData.note); console.log(note);
    for (const id of ['DNa', 'DNb']) {
      const m = note.match(new RegExp(`${id}: (\\d+) signs, glyph ([\\d.]+) cm, (\\d+) lines`)); expect(m, id).toBeTruthy();
      expect(+m![1], id).toBeGreaterThan(600); expect(+m![2], id).toBeGreaterThan(1.5); expect(+m![2], id).toBeLessThan(8);
      expect(carvableTranslit(id).split(' ').some(w => w === 'x' || w.includes('-')), id).toBe(false);
      expect(P.group.getObjectByName(`inscription:${id}:op:pick`), id).toBeTruthy();
    }
  });
  it('draw calls and triangles of everything the plain adds stay inside the Phase 7 budget (<= 150 calls, <= 2 M triangles before culling)', () => {
    let calls = 0, tris = 0; const rows: string[] = [];
    P.group.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; calls++;
      const g = m.geometry, per = (g.index ? g.index.count : g.getAttribute('position').count) / 3, inst = (g as any).isInstancedBufferGeometry ? (g as THREE.InstancedBufferGeometry).instanceCount : 1;
      tris += per * inst; rows.push(`${m.name}: ${(per * inst / 1000).toFixed(1)} k`); });
    console.log(`plain meshes ${calls}, triangles ${(tris / 1e6).toFixed(2)} M (worst case, no culling)\n` + rows.join('\n') + '\n' + JSON.stringify(P.stats()));
    expect(calls).toBeLessThanOrEqual(40); expect(tris).toBeLessThan(2.0e6);
  });
  it('every placed mesh carries a tier and a source (dev overlay F3); placeholders are flagged', () => {
    const missing: string[] = []; let placeholders = 0;
    P.group.traverse(o => { if (!(o as THREE.Mesh).isMesh) return; let q: THREE.Object3D | null = o; while (q && !q.userData?.tier) q = q.parent; if (!q) missing.push(o.name); else if (q.userData.placeholder) placeholders++; });
    expect(missing).toEqual([]); expect(placeholders).toBeGreaterThan(0);
  });
  it('the tomb reliefs are carved figures of the attested programme (D-069)', () => {
    const sets: any[] = []; P.group.traverse(o => { if (o.name.endsWith('-reliefs') && (o as any).items) sets.push(o); });
    expect(sets.length).toBeGreaterThan(0);
    for (const rs of sets) {
      const count = (k: string) => rs.items.filter((i: any) => i.kind === k).length;
      expect(count('bearer'), rs.name).toBe(28);
      for (const k of ['king_worship', 'fire_altar', 'winged_figure', 'moon']) expect(count(k), `${rs.name} ${k}`).toBe(1);
      expect(count('guard'), rs.name).toBe(6);
      expect(rs.userData.placeholder).toBe(false);
      const king = rs.items.find((i: any) => i.kind === 'king_worship'), altar = rs.items.find((i: any) => i.kind === 'fire_altar');
      expect(king.mirror).toBe(false); expect(altar.o.x).toBeGreaterThan(king.o.x); // the king faces the altar
      // not drawn from the Terrace (≈ 6 km), drawn from the foot of the cliff
      rs.update(new THREE.Vector3(0, 10, 0)); expect(rs.visible, 'hidden from the Terrace').toBe(false);
      rs.update(king.o.clone().add(new THREE.Vector3(0, -15, 60))); expect(rs.visible, 'drawn at 60 m').toBe(true);
    }
  });
  it('nothing absent in 467 is built (later tombs, Sasanian reliefs, Istakhr, Naqsh-e Rajab)', () => {
    const names: string[] = []; P.group.traverse(o => names.push(o.name.toLowerCase()));
    for (const bad of ['artaxerxes', 'darius_ii', 'darius ii', 'sasanian', 'istakhr', 'rajab', 'bahram', 'qanat']) expect(names.some(n => n.includes(bad)), bad).toBe(false);
    const nr = P.group.getObjectByName('naqsh-e-rustam')!; void scene;
    expect(nr.getObjectByName('nr_darius_tomb')).toBeTruthy(); expect(nr.getObjectByName('nr_xerxes_tomb')).toBeTruthy(); expect(nr.getObjectByName('nr_xerxes_tomb-inscription-panels')).toBeFalsy();
  });
  it('the Naqsh-e Rustam façade stands 15 m above the ancient ground and is 22.93 m high', () => {
    const m = P.group.getObjectByName('nr_darius_tomb') as THREE.Mesh; m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox!;
    const f = PLAIN.naqsh_e_rustam.facade, x = feature('nr_darius_tomb').xy[0], ground = R.nrAncientFootAsl - T.meta.court_asl - curvatureDrop(x, -PLAIN.naqsh_e_rustam.cliff.face_y);
    // the cut cross: its foot 15 m above the ancient ground, 22.93 m high (the dressed rock around it is part of the cliff mesh)
    expect(bb.min.y - ground).toBeCloseTo(f.foot_above_ground_m, 1); expect(bb.max.y - bb.min.y).toBeCloseTo(f.height_m, 1);
    const k = P.group.getObjectByName('nr-kaba') as THREE.Mesh; k.geometry.computeBoundingBox(); const kb = k.geometry.boundingBox!;
    // the lowest base step is sunk 0.6 m into the ground
    expect(kb.max.y - kb.min.y - 0.6).toBeCloseTo(PLAIN.naqsh_e_rustam.kaba.height_with_base_m, 2);
  });
  it('orchard row impostors never stand within the 3-D radius (the grey domes at village P22, D-121), and the tree layers hand over exactly', () => {
    // high quality (this describe): PLAIN_QUALITY.high's r3 and mid ring. The row mesh as built: a row collapses when
    // its plot centre lies within the mid radius of the mid-ring centre (per vertex), and fragments within r3 of the camera are cut.
    const rows = P.group.getObjectByName('plain-orchards-far') as THREE.Mesh, g = rows.geometry;
    const pos = g.getAttribute('position'), B = g.getAttribute('rowB'), Q = PLAIN_QUALITY.high;
    const cams: [number, number][] = [[-973, -3287], [-2505, -2700], [-5205, -1611], [-36.4, -122.45]]; // P22, Pulvar bank, field, Grand Stair
    for (const [cx, cz] of cams) {
      // the mid centre lags the camera by at most (rMid - r3) / 4 (index.ts rebuilds it then)
      for (const [ox, oz] of [[0, 0], [(Q.rMid - Q.r3) / 4, 0], [0, -(Q.rMid - Q.r3) / 4]]) {
        const mx = cx + ox, mz = cz + oz; let nearest = Infinity;
        for (let q = 0; q < pos.count; q += 4) {
          if (Math.hypot(B.getX(q) - mx, B.getY(q) - mz) < Q.rMid) continue; // collapsed: the mid ring draws these trees
          // the row's two ends (vertices q, q+1) at the ground: distance from the camera to the segment
          const ax = pos.getX(q), az = pos.getZ(q), bx = pos.getX(q + 1), bz = pos.getZ(q + 1), dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
          const t = Math.max(0, Math.min(1, ((cx - ax) * dx + (cz - az) * dz) / l2)); nearest = Math.min(nearest, Math.hypot(ax + dx * t - cx, az + dz * t - cz));
        }
        expect(nearest, `camera ${cx},${cz} mid offset ${ox},${oz}`).toBeGreaterThan(Q.r3);
      }
    }
    // the layers at P22: the 3-D set within its radius, the impostors' cut at the same centre and radius
    P.update(0, { clock: { dayIndex: 0 }, cond: { windMs: 2 }, camera: { position: new THREE.Vector3(-973, 1.6, -3287) } });
    const st = P.stats(); console.log('P22 tree layers', JSON.stringify({ near: st.nearTrees, lod0: st.lod0Trees, shadow: st.shadowTrees, nearR: st.nearR, mid: st.midTrees, rows: st.orchardRows, tris: st.nearTreeTris }));
    expect(st.nearTrees).toBeGreaterThan(100); expect(st.nearR).toBeGreaterThan(100); expect(st.midTrees).toBeGreaterThan(st.nearTrees);
    expect(st.nearTreeTris).toBeLessThan(1.2e6);
  });
  it('seasons drive the uniforms: the river is wider on 17 April than in September', () => {
    const ctx = (day: number) => ({ clock: { dayIndex: day }, cond: { windMs: 2 }, camera: { position: new THREE.Vector3(-4000, 20, -3000) } });
    P.update(0, ctx(0)); const w0 = riverState('river_pulvar', 0).width; P.update(0, ctx(150)); const w1 = riverState('river_pulvar', 150).width;
    expect(w0).toBeGreaterThan(w1 + 5);
    expect(MONTHS.length).toBe(12);
  });
});
