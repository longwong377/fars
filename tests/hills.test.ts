// D-335 (session 12): the hills' bedrock as geometry — the ledge strips along the terrain shader's risers
// (src/world/hills/ledges.ts) and the ground rock (outcrops, talus, scree: src/world/hills/bedrock.ts). Headless, on the real
// DEM. What could pass while the intent fails: ledges that exist but not where the texture draws the risers (checked: every
// strip point on its package's riser foot, the package cliff-forming); ledges everywhere as parallel contour lines (checked:
// pinched out along the strike, a minority of the packages' length drawn); ledges on the Terrace or trodden ground (checked);
// a face that does not stand up, or faces uphill (checked); a triangle budget blown by the whole mountain (checked, per view).
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three/webgpu';
import { loadTerrain } from './plainLib';
import { ledgeRuns, stripGeometry, Ledges, LEDGES, LEDGE_FORM, type LedgeRun } from '../src/world/hills/ledges';
import { stratY, cliffPkg, bedrockTile, Bedrock, BEDROCK, type BedrockEnv } from '../src/world/hills/bedrock';
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
    expect(BEDROCK.R.ground).toBeLessThanOrEqual(BEDROCK.lod[1]);
  }, 120_000);
});
void LEDGE_FORM;
