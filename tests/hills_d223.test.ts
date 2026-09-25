// D-223 (rubric s7 pass 2, fix 8 and R9): the hills' rock and scrub on steep ground, and the Naqsh-e Rustam cliff's moiré.
// Headless: CPU mirrors of the terrain shader's functions (terrainPlain.ts shrubAt3, benchSlopes), the cliff mesh as built,
// and the terrain horizon map on the CPU.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import * as THREE from 'three/webgpu';
import { loadTerrain, loadRiversFile } from './plainLib';
import { HILL, SHRUB_MAX_COVER, shrubAt3, benchSlopes } from '../src/world/plain/terrainPlain';
import { hash2, unit, cellU } from '../src/world/plain/fields';
import { buildNaqsh } from '../src/world/plain/naqsh';
import { loadInscriptionFonts } from '../src/arch/decor';
import { surfaceMaterial } from '../src/render/materials';
import { decodeHorizonMap } from '../src/terrain/horizonMap';
import { sunHorizon } from '../src/sky/ephemeris';
import { WorldClock } from '../src/core/clock';

/** a binary crown mask sampled over a plane of slope angle `deg` (fall line along world +x), in the plane's own metres:
 *  u across the slope (world z), v down the fall line */
function maskOnSlope(deg: number, crown: (x: number, y: number, z: number) => number, size = 150, step = 0.15) {
  const th = deg * Math.PI / 180, n = Math.round(size / step), m = new Uint8Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const u = i * step, v = j * step; m[j * n + i] = crown(v * Math.cos(th), 40 - v * Math.sin(th), u) > 0.5 ? 1 : 0; }
  return { m, n, step };
}
/** mean length (m) of the runs of 1 along u (across) and along v (down the slope), and the covered share */
function runs(M: { m: Uint8Array; n: number; step: number }) {
  const { m, n, step } = M; let cov = 0, ru = 0, nu = 0, rv = 0, nv = 0;
  for (let j = 0; j < n; j++) { let run = 0; for (let i = 0; i < n; i++) { const b = m[j * n + i]; cov += b; if (b) run++; else if (run) { ru += run; nu++; run = 0; } } }
  for (let i = 0; i < n; i++) { let run = 0; for (let j = 0; j < n; j++) { const b = m[j * n + i]; if (b) run++; else if (run) { rv += run; nv++; run = 0; } } }
  return { across: ru / nu * step, down: rv / nv * step, cover: cov / (n * n) };
}
/** the D-190 shrub crowns (2-D jittered grid of 5 m on the plan, crowns 0.6-1.6 m): the stretched pattern replaced */
function shrubAt2(x: number, _y: number, z: number): number {
  const S = HILL.shrubCell, cx = Math.floor(x / S), cz = Math.floor(z / S); let best = 0;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const a = cellU(cx + i), b = cellU(cz + j);
    const sx = (cx + i + 0.2 + 0.6 * unit(hash2(a, b, 61))) * S, sz = (cz + j + 0.2 + 0.6 * unit(hash2(a, b, 62))) * S, r = 0.6 + unit(hash2(a, b, 63));
    const d = Math.hypot(x - sx, z - sz), t = Math.min(1, Math.max(0, (d - 0.6 * r) / (0.4 * r))); best = Math.max(best, 1 - t * t * (3 - 2 * t)); }
  return best;
}

describe('scrub on steep ground: no stretching (terrainPlain.ts, D-223)', () => {
  it('the 3-D crowns keep round (down/across run ratio 0.85-1.18) and one ground cover from flat ground to 75 deg; the D-190 plan grid stretched them 1/cos(slope)', () => {
    const rows: string[] = [];
    const flat = runs(maskOnSlope(0, (x, y, z) => shrubAt3(x, y, z, 1)));
    for (const deg of [0, 30, 45, 60, 75]) {
      const n3 = runs(maskOnSlope(deg, (x, y, z) => shrubAt3(x, y, z, 1))), o2 = runs(maskOnSlope(deg, shrubAt2));
      rows.push(`${deg} deg: 3-D down/across ${(n3.down / n3.across).toFixed(2)} cover ${n3.cover.toFixed(3)} | D-190 2-D down/across ${(o2.down / o2.across).toFixed(2)} cover ${o2.cover.toFixed(3)}`);
      expect(n3.down / n3.across, `${deg} deg`).toBeGreaterThan(0.85); expect(n3.down / n3.across, `${deg} deg`).toBeLessThan(1.18);
      expect(n3.cover / flat.cover, `${deg} deg cover`).toBeGreaterThan(0.85); expect(n3.cover / flat.cover, `${deg} deg cover`).toBeLessThan(1.15);
      if (deg >= 60) expect(o2.down / o2.across, 'the old pattern did stretch').toBeGreaterThan(1.6);
    }
    console.log(rows.join('\n'));
  }, 120_000);
  it('with every cell holding a crown the ground cover is about SHRUB_MAX_COVER less the soft crown edge; the cover rule (up to 22.5 % in a north-facing gully) fits under it', () => {
    const c = runs(maskOnSlope(40, (x, y, z) => shrubAt3(x, y, z, 1))).cover;
    expect(SHRUB_MAX_COVER).toBeGreaterThan(0.24); expect(SHRUB_MAX_COVER).toBeLessThan(0.26);
    // the mask (value > 0.5) is the crown's inner ~80 % radius on average over the offsets from the ground: cover 0.45-0.8 of the max
    expect(c / SHRUB_MAX_COVER).toBeGreaterThan(0.4); expect(c / SHRUB_MAX_COVER).toBeLessThan(0.85);
    expect(HILL.shrubCover.slope + HILL.shrubCover.gully + HILL.shrubCover.north).toBeLessThan(SHRUB_MAX_COVER);
    // a crown's reach into a neighbouring cell stays under half a cell (the 8-cell octant search is complete)
    expect(HILL.shrubR[1] - 0.2 * HILL.shrubCell3).toBeLessThan(HILL.shrubCell3 / 2);
  });
});

describe('the cliff bands as benches and risers (terrainPlain.ts tiltFn, D-223)', () => {
  it('a package keeps the DEM mean gradient: riser × sR + (1 − riser) × sB = s; the riser steeper, the bench gentler', () => {
    for (let s = 0.2; s <= 1.5; s += 0.05) { const { sR, sB } = benchSlopes(s);
      expect(HILL.riser * sR + (1 - HILL.riser) * sB).toBeCloseTo(s, 9); expect(sR).toBeGreaterThan(2 * s); expect(sB).toBeLessThan(0.5 * s); expect(sB).toBeGreaterThanOrEqual(0);
      expect(Math.atan(sR) * 180 / Math.PI).toBeLessThanOrEqual(76.1); }
  });
});

describe('Naqsh-e Rustam cliff: the fine wavy moiré (R9)', () => {
  const T = loadTerrain(), R = loadRiversFile() as any;
  let cliff: THREE.Mesh;
  beforeAll(async () => {
    await loadInscriptionFonts(async p => { const b = readFileSync('public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; });
    cliff = buildNaqsh(T, R.nrAncientFootAsl).group.getObjectByName('nr-cliff') as THREE.Mesh;
  }, 120_000);
  it('the cliff draws its back faces only into the shadow maps, and every part of it faces out of the rock (face +z, top up, returns outward)', () => {
    const m = cliff.material as THREE.Material; expect(m.side).toBe(THREE.DoubleSide); expect(m.shadowSide).toBe(THREE.BackSide);
    const p = cliff.geometry.getAttribute('position'), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), box = new THREE.Box3().setFromBufferAttribute(p as THREE.BufferAttribute);
    let inward = 0, total = 0;
    for (let i = 0; i < p.count; i += 3) { a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2);
      const n = b.clone().sub(a).cross(c.clone().sub(a)), A = n.length() / 2; if (A < 1e-6) continue; n.normalize(); total += A;
      const mid = a.clone().add(b).add(c).divideScalar(3);
      // outward: up on the top, +z on the face, -x at the west return, +x at the east return
      const west = mid.x < box.min.x + 0.5, east = mid.x > box.max.x - 0.5;
      const out = west ? n.x < 0.2 : east ? n.x > -0.2 : n.y > -0.3 && (n.z > -0.3 || n.y > 0.5);
      if (!out) inward += A; }
    console.log({ total: Math.round(total), inward: Math.round(inward) });
    expect(inward / total).toBeLessThan(0.01);
  });
  it('the terrain horizon is not the cause: the sun is fully visible on every face vertex at 10:00 and 15:00 (day 0); at 15:00 it grazes the face (the acne condition)', () => {
    const hmeta = JSON.parse(readFileSync('public/generated/horizon_map.json', 'utf8'));
    const MAP = decodeHorizonMap(hmeta, new Uint8Array(inflateSync(readFileSync(`public/${hmeta.file}`))));
    const p = cliff.geometry.getAttribute('position'), nrm = cliff.geometry.getAttribute('normal'), v = new THREE.Vector3(), n = new THREE.Vector3();
    const ndl: Record<number, number> = {};
    for (const hour of [10, 15]) {
      const s = sunHorizon(new WorldClock(0, hour).jdUT), g = (s.azimuth - 341) * Math.PI / 180, ce = Math.cos(s.altitude * Math.PI / 180);
      const L = new THREE.Vector3(Math.sin(g) * ce, Math.sin(s.altitude * Math.PI / 180), -Math.cos(g) * ce);
      let min = 1, k = 0, sum = 0;
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); n.fromBufferAttribute(nrm, i); if (n.z < 0.5) continue;
        min = Math.min(min, MAP.visibility(v.x, v.y + T.meta.court_asl, v.z, s.altitude, s.azimuth, { x: L.x, z: L.z })); sum += Math.max(0, n.dot(L)); k++; }
      ndl[hour] = sum / k;
      expect(k).toBeGreaterThan(10000); expect(min, `${hour}:00`).toBeGreaterThan(0.99);
    }
    console.log({ meanNdotL: ndl });
    expect(ndl[15]).toBeLessThan(0.2); expect(ndl[10]).toBeGreaterThan(0.4);
  }, 60_000);
});

describe('the roads as worn tracks (settlement water.ts roadMaterial, D-223)', () => {
  it('the road material generates WGSL with the rut and verge attribute', async () => {
    const { buildWaterAndRoads } = await import('../src/world/settlement/water');
    const { buildTownPlan } = await import('../src/world/settlement/plan');
    const { registerSettlementSurfaces } = await import('../src/world/settlement/surfaces');
    registerSettlementSurfaces();
    const plan = buildTownPlan(); const wr = buildWaterAndRoads(plan, () => 0);
    const roads = wr.group.getObjectByName('settlement:roads') as THREE.Mesh;
    expect(roads.geometry.getAttribute('lat').itemSize).toBe(2);
    const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
    const r: any = new (THREE as any).WebGPURenderer({ canvas, antialias: false }); r.hasFeature = () => true;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(46, 16 / 9, 0.05, 110000);
    scene.add(new THREE.HemisphereLight(0xbfd6ff, 0x6b5a45, 0.6), new THREE.DirectionalLight(0xffffff, 3));
    const b = new (THREE as any).WGSLNodeBuilder(roads, r); b.scene = scene; b.camera = camera; b.material = roads.material; b.lightsNode = r.lighting.getNode(scene, camera); b.build();
    expect(String(b.vertexShader)).toContain('lat'); expect(String(b.fragmentShader)).toContain('dpdx');
    void surfaceMaterial;
  });
});
