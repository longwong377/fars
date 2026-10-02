// D-335 (session 12): the hills' bedrock as geometry — the ledge strips along the terrain shader's risers
// (src/world/hills/ledges.ts) and the ground rock (outcrops, talus, scree: src/world/hills/bedrock.ts). Headless, on the real
// DEM. What could pass while the intent fails: ledges that exist but not where the texture draws the risers (checked: every
// strip point on its package's riser foot, the package cliff-forming); ledges everywhere as parallel contour lines (checked:
// pinched out along the strike, a minority of the packages' length drawn); ledges on the Terrace or trodden ground (checked);
// a face that does not stand up, or faces uphill (checked); a triangle budget blown by the whole mountain (checked, per view).
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three/webgpu';
import { loadTerrain } from './plainLib';
import { ledgeRuns, stripGeometry, Ledges, LEDGES, LEDGE_FORM, LEDGE_FADE, reliefShare, farSink, type LedgeRun } from '../src/world/hills/ledges';
import { stratY, cliffPkg, bedrockTile, Bedrock, BEDROCK, sinkShare, sinkDepth, reachOf, type BedrockEnv } from '../src/world/hills/bedrock';
import { HILL } from '../src/world/plain/terrainPlain';
import { TERRACE_BOX } from '../src/world/plain/townGround';

const T = loadTerrain();
const env: BedrockEnv = { ground: (x, z) => T.surfaceAt(x, z) };
// the W face of Kuh-e Rahmat behind the Terrace (grid e 300..900, n -300..500): world tiles
const tilesOf = (e0: number, e1: number, n0: number, n1: number) => { const out: [number, number][] = [];
  for (let ti = Math.floor(e0 / LEDGES.tile); ti <= Math.floor(e1 / LEDGES.tile); ti++) for (let tj = Math.floor(-n1 / LEDGES.tile); tj <= Math.floor(-n0 / LEDGES.tile); tj++) out.push([ti, tj]); return out; };
let runs: LedgeRun[] = [];
beforeAll(() => { for (const [ti, tj] of tilesOf(300, 900, -300, 500)) runs.push(...ledgeRuns(env, ti, tj, 1)); }, 120_000);

describe('the ledges (hills/ledges.ts)', () => {
  it('stand on the shader\'s risers: every run point on its package\'s riser foot (the stratigraphic height), the package cliff-forming', () => {
    expect(runs.length).toBeGreaterThan(50);
    let pts = 0, worst = 0;
    for (const r of runs) { expect(cliffPkg(r.k)).toBe(true); const level = HILL.pkg * (r.k + 1 - HILL.riser);
      for (const [x, z] of r.pts) { worst = Math.max(worst, Math.abs(stratY(x, T.surfaceAt(x, z), z) - level)); pts++; } }
    console.log(`ledge runs on the W face: ${runs.length}, points ${pts}, worst |sy - riser foot| ${worst.toFixed(3)} m`);
    expect(worst).toBeLessThan(0.35); // (linear interpolation on the 4 m grid of a surface that is itself linear per 4 m triangle)
  });
  it('pinch out and resume along the strike (not unbroken contour lines), and a minority of the packages\' riser length stands', () => {
    let on = 0, all = 0, segs = 0;
    for (const r of runs) { let prev = false; r.h.forEach((h, i) => { if (i) { const L = Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]); all += L; if (h > 0.3) on += L; }
      const cur = h > 0.3; if (cur && !prev) segs++; prev = cur; }); }
    console.log(`riser foot length ${(all / 1000).toFixed(1)} km, ledges standing ${(on / 1000).toFixed(1)} km (${(100 * on / all).toFixed(0)} %), ${segs} separate ledges, mean ${(on / segs).toFixed(0)} m`);
    expect(on / all).toBeGreaterThan(0.12); expect(on / all).toBeLessThan(0.75);
    expect(on / segs).toBeGreaterThan(8); expect(on / segs).toBeLessThan(400);
  });
  it('keep off the Terrace, its fortification and its approach', () => {
    const near: LedgeRun[] = []; for (const [ti, tj] of tilesOf(TERRACE_BOX.e0 - 40, TERRACE_BOX.e1 + 80, TERRACE_BOX.n0 - 40, TERRACE_BOX.n1 + 40)) near.push(...ledgeRuns(env, ti, tj, 1));
    for (const r of near) r.pts.forEach(([x, z], i) => { const e = x, n = -z; if (e > TERRACE_BOX.e0 - 40 && e < TERRACE_BOX.e1 + 80 && n > TERRACE_BOX.n0 - 40 && n < TERRACE_BOX.n1 + 40) expect(r.h[i]).toBe(0); });
  });
  it('a face stands its height above the ground at the riser foot, leaning back, and faces downhill', () => {
    const r = runs.filter(q => Math.max(...q.h) > 2)[0]; expect(r).toBeTruthy();
    const g = stripGeometry([r], env, 1, false, null), rows = 3 + 3, i = r.h.indexOf(Math.max(...r.h)), [x, z] = r.pts[i];
    const P = (row: number) => new THREE.Vector3(g.pos[(i * rows + row) * 3], g.pos[(i * rows + row) * 3 + 1], g.pos[(i * rows + row) * 3 + 2]);
    const baseV = P(1), topV = P(3), g0 = T.surfaceAt(x, z);
    expect(topV.y - g0).toBeGreaterThan(r.h[i] * 0.9); expect(Math.abs(baseV.y - g0)).toBeLessThan(0.1);
    const d = 3, gx = (T.surfaceAt(x + d, z) - T.surfaceAt(x - d, z)) / (2 * d), gz = (T.surfaceAt(x, z + d) - T.surfaceAt(x, z - d)) / (2 * d);
    const foot = P(0); expect((foot.x - x) * -gx + (foot.z - z) * -gz).toBeGreaterThan(0); // the foot lies downhill of the face
    expect((topV.x - x) * -gx + (topV.z - z) * -gz).toBeLessThan(0); // the top leans back, uphill
    expect(foot.y).toBeLessThan(T.surfaceAt(foot.x, foot.z)); // buried
  });
  it('what a frame draws of them stays within its budget at the views that see the mountain (<= 0.40 M triangles in the view, <= 0.40 M in the shadow passes, 3 draws)', () => {
    const L = new Ledges(env, 1, null), out: string[] = [];
    for (const [n, e, no] of [['calib-24', -166.6, 108.9], ['stair-top', -36.4, 122.45], ['rahmat-slope', 420, 150], ['quarry', 600, -700]] as [string, number, number][]) {
      L.update(new THREE.Vector3(e, T.surfaceAt(e, -no), -no), true); const tris = L.stats.nearTris + L.stats.midTris + L.stats.farTris, shadow = 4 * (L.stats.nearTris + L.stats.midTris); // (every caster in every cascade: the upper bound) out.push(`${n}: ${JSON.stringify(L.stats)}`);
      expect(tris).toBeLessThan(0.40e6); expect(shadow).toBeLessThan(0.40e6); expect(L.group.children.length).toBe(3);
    }
    console.log(out.join('\n'));
  }, 120_000);
});

describe('the ground rock (hills/bedrock.ts)', () => {
  const sizes = { ledge: [], ground: [[4.04, 1.33, 3.75], [4.89, 1.40, 10.45], [8.98, 1.53, 5.63], [9.96, 0.85, 11.5]] as [number, number, number][] };
  it('outcrops, talus and scree on the hills only, tilted to the ground, none on the Terrace or on flat ground', () => {
    const sites = tilesOf(300, 900, -300, 500).flatMap(([ti, tj]) => bedrockTile(env, ti, tj, 1, sizes));
    const kinds: Record<string, number> = {}; for (const s of sites) kinds[s.kind] = (kinds[s.kind] ?? 0) + 1;
    console.log('ground rock on the W face:', sites.length, JSON.stringify(kinds));
    expect(sites.length).toBeGreaterThan(100); expect(Object.keys(kinds).length).toBeGreaterThanOrEqual(2);
    for (const s of sites) { const [x, , z] = s.p, d = 3, sl = Math.hypot(T.surfaceAt(x + d, z) - T.surfaceAt(x - d, z), T.surfaceAt(x, z + d) - T.surfaceAt(x, z - d)) / (2 * d);
      expect(sl).toBeGreaterThan(0.09);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(new THREE.Quaternion(...s.q)), nrm = new THREE.Vector3(-(T.surfaceAt(x + d, z) - T.surfaceAt(x - d, z)) / (2 * d), 1, -(T.surfaceAt(x, z + d) - T.surfaceAt(x, z - d)) / (2 * d)).normalize();
      expect(up.dot(nrm)).toBeGreaterThan(0.97); }
    const flat = tilesOf(-900, -500, 0, 400).flatMap(([ti, tj]) => bedrockTile(env, ti, tj, 1, sizes)); expect(flat.length).toBe(0); // the plain W of the Terrace
  }, 120_000);
  it('within its budget at the mountain views (<= 0.25 M triangles at the sets\' own levels)', () => {
    const kit: any = { ledge: [], ground: sizes.ground.map((s, i) => ({ id: 'g' + i, cls: 'ground', size: s, lods: [3000, 600, 80].map(n => { const g = new THREE.BufferGeometry(); g.setIndex(new Array(n * 3).fill(0)); g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9), 3)); return g; }) })),
      atlas: { ground: { map: new THREE.Texture(), normal: new THREE.Texture(), arm: new THREE.Texture(), mean: [0.2, 0.2, 0.2] } } };
    const B = new Bedrock(env, 1, kit);
    for (const [e, no, az] of [[420, 150, 80], [600, -700, 60], [-166.6, 108.9, 117]]) { const yaw = -((az - 341) * Math.PI) / 180;
      B.update(new THREE.Vector3(e, T.surfaceAt(e, -no), -no), new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)), true);
      console.log(`bedrock at (${e}, ${no}): ${JSON.stringify(B.stats)}`); expect(B.stats.tris).toBeLessThan(0.25e6); }
    // D-600: beyond the near levels every variant draws its own lod2 (no shape swapped in), to its own reach
    for (const v of [0, 1, 2, 3]) for (const lod of [2, 3]) expect(B.sets.some(q => q.cls === 'ground' && q.v === v && q.lod === lod)).toBe(true);
    expect(B.stats.ground).toBeGreaterThan(0);
  }, 120_000);
});
void LEDGE_FORM;

describe('D-600: the hills\' rock and ledges change with distance by fades the shader runs every frame, never by a step at a rebuild', () => {
  it('a ledge tile turns coarse (no relief) only where its relief has faded to 0, and its far end is sunk whole at the reach', () => {
    // a tile is fine when within NEAR at a rebuild; the walker moves up to moveM before the next: a coarse tile is >= NEAR - moveM away
    expect(reliefShare(LEDGES.NEAR - LEDGES.moveM)).toBe(0);
    expect(reliefShare(LEDGES.NEAR * LEDGE_FADE.relief[0])).toBe(1);
    // the far end: the tallest face (LEDGE_FORM.h max x the 1.2 jitter) and its lip under the ground at R; tiles kept to R + moveM
    expect(farSink(LEDGES.R)).toBeGreaterThanOrEqual(LEDGE_FORM.h[1] * 1.2 + LEDGE_FORM.lip + 0.5);
    // continuity: no step of more than 2 cm of sink or 2 % of relief per metre walked
    for (let d = 0; d < LEDGES.R + 30; d += 0.5) { expect(Math.abs(farSink(d + 0.5) - farSink(d))).toBeLessThan(0.02 * 0.5 * 50); expect(Math.abs(reliefShare(d + 0.5) - reliefShare(d))).toBeLessThan(0.05); }
  });
  it('the fine strip with its relief faded out is the coarse strip (the same face, within 6 cm: < 1 px at 70 m)', () => {
    const tiles = tilesOf(300, 900, -300, 500); let n = 0, worst = 0;
    for (const [ti, tj] of tiles) { const runs = ledgeRuns(env, ti, tj, 1); if (!runs.length) continue;
      const f = stripGeometry(runs, env, 1, true, null), c = stripGeometry(runs, env, 1, false, null);
      // every coarse vertex's face top and foot against the fine strip's nearest vertex of the same row role
      const top = (g: typeof f, rows: number) => { const o: [number, number, number][] = []; for (let i = 0; i < g.pos.length / 3; i += rows) { const k = (i + rows - 3) * 3; o.push([g.pos[k], g.pos[k + 1], g.pos[k + 2]]); } return o; };
      const ft = top(f, 8 + 3), ct = top(c, 3 + 3);
      for (const p of ct) { let best = Infinity; for (const q of ft) best = Math.min(best, Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])); worst = Math.max(worst, best); n++; }
      if (n > 400) break; }
    console.log(`ledge coarse vs fine (relief off): ${n} face tops, worst ${(worst * 100).toFixed(1)} cm`);
    expect(n).toBeGreaterThan(50); expect(worst).toBeLessThan(0.06);
  }, 120_000);
  it('a ground rock sinks continuously over the last 15 % of its reach, whole at the reach, and is drawn to the reach + one rebuild step', () => {
    for (const ext of [2.5, 5, 8, 12]) { const R = reachOf('ground', ext);
      expect(R).toBeGreaterThanOrEqual(BEDROCK.lod[1]); expect(R).toBeLessThanOrEqual(BEDROCK.R.ground);
      // at its reach a piece spans no more than farPx pixels at the player's lens (or the reach is the near levels' end or R)
      if (R > BEDROCK.lod[1] && R < BEDROCK.R.ground) expect((ext / R) * BEDROCK.pxRad).toBeLessThanOrEqual(BEDROCK.farPx + 1e-6);
      for (let d = 0; d < R + 30; d += 0.5) expect(Math.abs(sinkShare(R, d + 0.5) - sinkShare(R, d))).toBeLessThan(0.03 * 260 / R + 1e-9);
      expect(sinkShare(R, R)).toBe(1); }
    const st = { cls: 'ground' as const, v: 0, kind: 'outcrop', p: [0, 0, 0] as [number, number, number], q: [0, 0, 0, 1] as [number, number, number, number], s: [1.5, 1.5, 1.5] as [number, number, number], c: [1, 1, 1] as [number, number, number] };
    expect(sinkDepth(st)).toBeGreaterThan(1.53 * 1.5); // talus03's 1.53 m height at its scale
  });
});

describe('the stair-foot line (D-335): the roads and the approach meet the ground with no free edge', () => {
  it('every road ribbon near the Terrace ends in a feather sunk under the ground: no vertex of its outline stands above the ground', async () => {
    const { buildWaterAndRoads, FEATHER_DROP } = await import('../src/world/settlement/water');
    const { buildTownPlan } = await import('../src/world/settlement/plan');
    const { registerSettlementSurfaces } = await import('../src/world/settlement/surfaces');
    registerSettlementSurfaces();
    const H = (e: number, n: number) => T.heightAt(e, -n), wr = buildWaterAndRoads(buildTownPlan(), H);
    const g = (wr.group.getObjectByName('settlement:roads') as THREE.Mesh).geometry, P = g.getAttribute('position'), lat = g.getAttribute('lat');
    let edges = 0, above = 0, near = 0;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), z = P.getZ(i); if (Math.hypot(x, z) > 4000) continue; near++;
      if (Math.abs(lat.getX(i)) > lat.getY(i) + 0.3) { edges++; if (P.getY(i) > H(x, -z) - FEATHER_DROP * 0.9) above++; } }
    console.log(`road vertices within 4 km: ${near}, outline (feather) vertices ${edges}, above the ground ${above}`);
    expect(edges).toBeGreaterThan(near * 0.4); expect(above).toBe(0);
    // the approach to the Grand Stair: its outline at the stair-foot-ground view (grid e -62..-66) under the ground
    let seen = 0; for (let i = 0; i < P.count; i++) { const e = P.getX(i), n = -P.getZ(i); if (e < -56 && e > -80 && n > 108 && n < 130 && Math.abs(lat.getX(i)) > lat.getY(i)) { seen++; expect(P.getY(i)).toBeLessThan(H(e, n)); } }
    expect(seen).toBeGreaterThan(0);
  }, 120_000);
});
