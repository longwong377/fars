// Water, roads and the canal of the settlement (Phase 6). Earth roads (settlement.json, 6-8 m, courses C) and the
// Kuh-e Rahmat canal (2 m wide, C course) are ribbons draped on the terrain (heightAt samples, lifted a few centimetres
// and depth-offset); garden channels, pools, ditches and well water are flat water surfaces. Roads are cut into ~1 km
// pieces that hide beyond 6 km (they are sub-pixel there). One water mesh for everything.
import * as THREE from 'three/webgpu';
import { positionWorld, vec3, float, cameraViewMatrix, vec4, normalize, attribute, abs, fwidth, max, mix, smoothstep, mx_noise_float } from 'three/tsl';
import { surfaceMaterial, SEASON, type Layer } from '../../render/materials';
import { rippleNormal, waterBody, skyReflection, waterRoughness } from '../plain/waterShade';
import { hashString, Rng } from '../../core/rng';
import type { TownPlan } from './plan';
import type { P2 } from './site';
import { ROWS, FEATURES } from './plan';

const lerp2 = (a: P2, b: P2, t: number): P2 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
/** resample a polyline every `step` metres */
export function resample(pts: P2[], step: number): P2[] {
  const out: P2[] = [pts[0]];
  for (let i = 0; i + 1 < pts.length; i++) { const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]), n = Math.max(1, Math.ceil(L / step));
    for (let k = 1; k <= n; k++) out.push(lerp2(pts[i], pts[i + 1], k / n)); }
  return out;
}
/** a ribbon of width w along pts, draped: y = ground + lift; returns position/normal/index arrays */
function ribbon(pts: P2[], w: number, H: (e: number, n: number) => number, lift: number, off = 0, dropEdge = 0) {
  const pos: number[] = [], nor: number[] = [], idx: number[] = [], lat: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)], dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L; // left normal (grid)
    for (const s of [-1, 1]) { const e = pts[i][0] + nx * (off + s * w / 2), n = pts[i][1] + ny * (off + s * w / 2); pos.push(e, H(e, n) + lift - dropEdge, -n); nor.push(0, 1, 0); lat.push(s * w / 2, w / 2); }
    if (i > 0) { const k = (i - 1) * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  return { pos, nor, idx, lat };
}
function geo(parts: { pos: number[]; nor: number[]; idx: number[]; wd?: [number, number]; lat?: number[] }[]) {
  const pos: number[] = [], nor: number[] = [], idx: number[] = [], wd: number[] = [], lat: number[] = [];
  for (const p of parts) { const o = pos.length / 3; pos.push(...p.pos); nor.push(...p.nor); for (const i of p.idx) idx.push(i + o); for (let k = 0; k < p.pos.length / 3; k++) { wd.push(...(p.wd ?? [0.4, 0])); lat.push(p.lat?.[2 * k] ?? 0, p.lat?.[2 * k + 1] ?? 1); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('wdepth', new THREE.Float32BufferAttribute(wd, 2));
  g.setAttribute('lat', new THREE.Float32BufferAttribute(lat, 2)); // signed metres from the ribbon's axis, and its half-width (the roads' ruts and verges, D-223)
  g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1)); g.computeBoundingSphere(); g.computeVertexNormals(); return g;
}

/** D-223 (rubric s7 pass 2 fix 9: from the Terrace the roads read as "straight radial beige streaks", uniform strips with
 *  ruled edges, like seams of a projected texture): an earth road as a worn track. Across it (attribute `lat`, m from the
 *  axis): a wheel-rut pair in each half (ruts 1.4 m apart, the gauge of a two-wheeled cart, C; the royal roads carried
 *  carts and wagons: B), darker and damper and pressed 3 cm in; the crown between them and the shoulders lighter, loose
 *  and dusty; the last ~1.5 m a ragged verge where the herb layer returns (its edge wanders by ±0.7 m along the road over
 *  ~6 m, so the edge is no ruled line); broad patches along the road where it was widened round a soft spot or recently
 *  trodden (±8 % over ~40 m). Every term is box-filtered by the pixel's span of `lat` (a far road keeps its mean tone,
 *  never an aliased stripe). All C */
export const ROAD_TRACK = { gauge: 1.4, rutW: 0.35, rutDark: 0.14, verge: 1.5, edgeWander: 0.7, patch: 0.08 } as const;
function roadMaterial() {
  return surfaceMaterial('road', { variant: 'track', modify: (L: Layer) => {
    const la = attribute('lat', 'vec2'), p = positionWorld, R = ROAD_TRACK;
    const a = abs(la.x), hw = la.y, px = fwidth(la.x).max(1e-3);
    const near = float(1).sub(smoothstep(0.25, 0.8, px.div(R.rutW)));
    // a rut pair each side of the axis at 0.9 ± gauge/2 m (0.2 and 1.6 m: one cart track each way on a 6-8 m road, C);
    // far off, their mean share of the width
    const rut = (c: number) => float(1).sub(smoothstep(R.rutW * 0.3, R.rutW * 0.5, abs(a.sub(c))));
    const ruts = max(rut(0.9 - R.gauge / 2), rut(0.9 + R.gauge / 2)).mul(near).add(float(1).sub(near).mul(R.rutW * 4).div(hw.mul(2).max(1)));
    // the verge: the outer R.verge m, its inner edge wandering along the road; the herb layer and the plain's loam return
    const wander = mx_noise_float(vec3(p.x.mul(0.17), 0, p.z.mul(0.17))).mul(R.edgeWander).add(mx_noise_float(vec3(p.x.mul(0.9), 2.1, p.z.mul(0.9))).mul(0.25).mul(near));
    const verge = float(1).sub(smoothstep(0, R.verge, hw.sub(a).add(wander))).mul(0.85);
    const loam = vec3(0.184, 0.122, 0.064); // the plain's loam (terrainMesh groundColour 0.43, 0.36, 0.27 sRGB) in linear
    const herb = mix(vec3(0.319, 0.264, 0.107), vec3(0.078, 0.107, 0.027), SEASON.green.div(SEASON.green.add(SEASON.dry).max(0.001))); // straw / green (materials.ts herbs)
    const vergeAlb = mix(loam, herb, SEASON.green.add(SEASON.dry).min(1).mul(0.55)).mul(float(1).add(mx_noise_float(p.mul(1.3)).mul(0.12)));
    const patch = float(1).add(mx_noise_float(vec3(p.x.mul(0.025), 1.3, p.z.mul(0.025))).mul(R.patch * 2));
    let alb: any = L.alb.mul(patch).mul(float(1).sub(ruts.mul(R.rutDark)));
    alb = mix(alb, vergeAlb, verge);
    const height = (L.height ?? float(0)).sub(ruts.mul(near).mul(0.03)).add(verge.mul(0.015));
    return { alb, rough: L.rough, height, tilt: L.tilt };
  } });
}
export function waterMaterial() {
  const m = new THREE.MeshStandardNodeMaterial({ metalness: 0 });
  // slow water (plain/waterShade.ts, as the rivers): wind ripples as band-limited noise drifting slowly, the Fresnel sky,
  // a body over its bed by depth (attribute `wdepth`: channels and pools over dressed stone 0.2-0.35 m, the canal and
  // ditches over mud; C)
  const p = positionWorld, wd = attribute('wdepth', 'vec2');
  const rip = rippleNormal(p.x, p.z, vec3(1, 0, 0), vec3(0, 0, 1), float(0.06), float(0.3));
  m.normalNode = normalize(cameraViewMatrix.mul(vec4(rip.n, 0)).xyz);
  const stoneBed = vec3(0.19, 0.18, 0.15), mudBed = vec3(0.047, 0.036, 0.022);
  m.colorNode = waterBody(wd.x, float(0.15), mudBed.add(stoneBed.sub(mudBed).mul(wd.y)));
  m.emissiveNode = skyReflection(rip.n);
  m.roughnessNode = waterRoughness(rip.lost);
  // its reflection is the Fresnel sky above, so it takes no screen-space reflection (the SSR composite, D-216)
  m.userData = { tier: 'C', note: 'still water (garden channels, pools, wells, canal), C', ssr: false };
  return m;
}

/** Stone-lined garden channels and their basins (C on B). The watercourses of the Pasargadae royal garden are limestone
 *  channels 25 cm wide, "probably flush with the ground surface", with a deep square basin every 13 or 14 m (search
 *  extracts of the excavation reports: PASARGADAE-CHANNELS, B for Pasargadae; used here as the analogy the plan already
 *  names, C). Built as dressed blocks about a metre long (C), their joints open 2 cm, each block's tone its own; the lip
 *  stands 7 cm proud of the ground and the water 3.5 cm below the lip, because the heightfield cannot be cut: flush
 *  stone would bury the water (C, logged in D-149). They were two raised 20 cm kerb strips 12 cm high, uniform grey and
 *  continuous for 300 m: from the path they read as white road paint (session 4 render). */
export const CHANNEL = { inner: 0.25, lip: 0.13, block: [0.9, 1.15] as [number, number], joint: 0.02, top: 0.07, water: 0.035, basinEvery: 13.5, basin: 0.7, basinRim: 0.16 };
function channelStones(plan: TownPlan, H: (e: number, n: number) => number) {
  const pos: number[] = [], col: number[] = [], idx: number[] = [];
  const st = new THREE.Color().setRGB(0.44, 0.43, 0.4, THREE.SRGBColorSpace); // the Terrace's dressed grey limestone (materials.ts), weathered here per block
  const quad = (a: number[], b: number[], c: number[], d: number[], k: number, kb = k) => { const o = pos.length / 3; pos.push(...a, ...b, ...c, ...d);
    for (const q of [k, k, kb, kb]) col.push(st.r * q, st.g * q, st.b * q); idx.push(o, o + 1, o + 2, o, o + 2, o + 3); };
  const pools = plan.water.filter(w => w.kind === 'pool').map(w => w.pts[0]);
  const basins: { c: [number, number]; d: [number, number]; y: number }[] = [];
  for (const w of plan.water) {
    if (w.kind !== 'channel') continue;
    const [a, b] = [w.pts[0], w.pts[w.pts.length - 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.5) continue;
    const dx = (b[0] - a[0]) / L, dy = (b[1] - a[1]) / L, nx = -dy, ny = dx, rng = new Rng(hashString(`${a[0].toFixed(1)},${a[1].toFixed(1)}`), 'channel-blocks');
    // basins every 13.5 m, away from the 5 m pools where channels cross
    for (let sb = CHANNEL.basinEvery / 2; sb < L - 1; sb += CHANNEL.basinEvery) { const c: [number, number] = [a[0] + dx * sb, a[1] + dy * sb];
      if (pools.some(p => Math.hypot(p[0] - c[0], p[1] - c[1]) < 4)) continue; basins.push({ c, d: [dx, dy], y: H(c[0], c[1]) + CHANNEL.top }); }
    const inBasin = (s0: number, s1: number) => basins.some(q => { const t = (q.c[0] - a[0]) * dx + (q.c[1] - a[1]) * dy, off = Math.abs((q.c[0] - a[0]) * nx + (q.c[1] - a[1]) * ny); return off < 0.1 && s1 > t - CHANNEL.basin / 2 - CHANNEL.basinRim && s0 < t + CHANNEL.basin / 2 + CHANNEL.basinRim; });
    for (let s0 = 0; s0 < L; ) {
      const len = Math.min(L - s0, rng.range(CHANNEL.block[0], CHANNEL.block[1])), s1 = s0 + len - CHANNEL.joint; const sm = (s0 + s1) / 2;
      if (!inBasin(s0, s1) && s1 > s0) {
        const cx = a[0] + dx * sm, cy = a[1] + dy * sm, y = H(cx, cy) + CHANNEL.top, k = rng.range(0.82, 1.08), wi = CHANNEL.inner / 2, wo = wi + CHANNEL.lip;
        const P = (s: number, u: number, yy: number) => [a[0] + dx * s + nx * u, yy, -(a[1] + dy * s + ny * u)];
        for (const sd of [-1, 1]) {
          const ui = sd * wi, uo = sd * wo, flip = sd < 0;
          const top = [P(s0, ui, y), P(s1, ui, y), P(s1, uo, y), P(s0, uo, y)];
          flip ? quad(top[0], top[3], top[2], top[1], k) : quad(top[0], top[1], top[2], top[3], k);
          // inner wall down into the water (darker: wet, with a film of algae), outer face into the ground (soil-stained)
          const wIn = [P(s0, ui, y - 0.12), P(s1, ui, y - 0.12), P(s1, ui, y), P(s0, ui, y)];
          flip ? quad(wIn[0], wIn[1], wIn[2], wIn[3], 0.5 * k, 0.72 * k) : quad(wIn[0], wIn[3], wIn[2], wIn[1], 0.5 * k, 0.72 * k);
          const gy = Math.min(H(a[0] + dx * sm + nx * uo, a[1] + dy * sm + ny * uo), y) - 0.05;
          const wOut = [P(s0, uo, gy), P(s1, uo, gy), P(s1, uo, y), P(s0, uo, y)];
          flip ? quad(wOut[0], wOut[3], wOut[2], wOut[1], 0.55 * k, 0.85 * k) : quad(wOut[0], wOut[1], wOut[2], wOut[3], 0.55 * k, 0.85 * k);
        }
      }
      s0 += len;
    }
  }
  // the basins: a square rim of four dressed stones round a deep square pool (the water is in the water mesh)
  for (const q of basins) { const [dx, dy] = q.d, nx = -dy, ny = dx, h = CHANNEL.basin / 2, o = h + CHANNEL.basinRim, y = q.y;
    const P = (s: number, u: number, yy: number) => [q.c[0] + dx * s + nx * u, yy, -(q.c[1] + dy * s + ny * u)];
    for (const [s0, s1, u0, u1] of [[-o, o, h, o], [-o, o, -o, -h], [-o, -h, -h, h], [h, o, -h, h]] as [number, number, number, number][]) {
      const k = 0.9 + 0.1 * Math.sin(s0 * 7 + u0 * 3);
      quad(P(s0, u0, y), P(s0, u1, y), P(s1, u1, y), P(s1, u0, y), k); }
    for (const [s0, u0, s1, u1] of [[-h, -h, h, -h], [h, -h, h, h], [h, h, -h, h], [-h, h, -h, -h]] as [number, number, number, number][]) quad(P(s0, u0, y - 0.4), P(s1, u1, y - 0.4), P(s1, u1, y), P(s0, u0, y), 0.45, 0.7);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(pos.length / 3 > 65535 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1)); g.computeVertexNormals(); g.computeBoundingSphere();
  return { geometry: g, basins, tris: idx.length / 3 };
}

export function buildWaterAndRoads(plan: TownPlan, H: (e: number, n: number) => number) {
  const group = new THREE.Group(); group.name = 'settlement:water_roads'; let tris = 0, meshes = 0;
  // water
  const wparts: { pos: number[]; nor: number[]; idx: number[]; wd?: [number, number] }[] = [];
  const cs = channelStones(plan, H);
  for (const w of plan.water) {
    if (w.kind === 'well') { const [e, n] = w.pts[0], y = H(e, n) + 0.04, r = 0.55, pos: number[] = [e, y, -n], nor: number[] = [0, 1, 0], idx: number[] = [];
      for (let s = 0; s <= 10; s++) { const a = (s / 10) * Math.PI * 2; pos.push(e + Math.cos(a) * r, y, -n + Math.sin(a) * r); nor.push(0, 1, 0); if (s > 0) idx.push(0, s + 1, s); }
      wparts.push({ pos, nor, idx, wd: [2, 0] }); continue; }
    // garden channels: the water between the stone lips, 3.5 cm below them, stepping with the blocks (one sample a metre)
    if (w.kind === 'channel') { const pts = resample(w.pts, 1), p = ribbon(pts, CHANNEL.inner + 0.002, (e, n) => H(e, n), CHANNEL.top - CHANNEL.water); wparts.push({ ...p, wd: [0.25, 1] }); continue; }
    const step = w.kind === 'canal' ? 8 : 3;
    wparts.push({ ...ribbon(resample(w.pts, step), w.width, H, w.kind === 'canal' ? 0.12 : w.kind === 'ditch' ? 0.03 : 0.1), wd: w.kind === 'pool' ? [0.35, 1] : w.kind === 'canal' ? [0.6, 0] : [0.15, 0] });
  }
  // the basins' water, level with the channel's
  for (const q of cs.basins) { const [dx, dy] = q.d, nx = -dy, ny = dx, h = CHANNEL.basin / 2 + 0.01, y = q.y - CHANNEL.water, pos: number[] = [], nor: number[] = [];
    for (const [s, u] of [[-h, -h], [h, -h], [h, h], [-h, h]]) { pos.push(q.c[0] + dx * s + nx * u, y, -(q.c[1] + dy * s + ny * u)); nor.push(0, 1, 0); }
    wparts.push({ pos, nor, idx: [0, 2, 1, 0, 3, 2], wd: [0.5, 1] }); }
  const wg = geo(wparts); const wm = new THREE.Mesh(wg, waterMaterial()); wm.name = 'settlement:water'; wm.receiveShadow = true; wm.matrixAutoUpdate = false;
  wm.userData = { tier: 'C', src: 'MAYS2010;PW2017;RECON', note: 'water: Kuh-e Rahmat canal (C course), garden channels and pools (Pasargadae analogy B, C here), Area C ditches (PW2017 B), wells (C)' };
  group.add(wm); tris += (wg.index!.count / 3); meshes++;
  // the channels' dressed stone blocks and basin rims (one mesh; they cast no shadow: flush stone, C)
  const sm = new THREE.Mesh(cs.geometry, surfaceMaterial('stone_plain', { vertexColors: true })); sm.name = 'settlement:channel_stones'; sm.receiveShadow = true; sm.castShadow = false; sm.matrixAutoUpdate = false;
  sm.userData = { tier: 'C', src: 'PASARGADAE-CHANNELS;RECON', note: `garden channels of dressed limestone blocks, 25 cm channel (Pasargadae, B), block length, joints and a lip 7 cm proud of the ground C; basins every ${CHANNEL.basinEvery} m (Pasargadae 13-14 m, B)` };
  group.add(sm); tris += cs.tris; meshes++;
  // canal banks: dug earth thrown up either side (C: 1.2 m wide, 0.45 m high)
  const cf = FEATURES.canal_kuh_e_rahmat; const cpts = resample(cf.polyline, 8); const bw = cf.width_m / 2 + 0.7;
  const banks = geo([ribbon(cpts, 1.2, H, 0.45, bw), ribbon(cpts, 1.2, H, 0.45, -bw), ribbon(cpts, 0.35, H, 0.25, bw + 0.75), ribbon(cpts, 0.35, H, 0.25, -bw - 0.75), ribbon(cpts, 0.35, H, 0.25, bw - 0.75), ribbon(cpts, 0.35, H, 0.25, -bw + 0.75)]);
  const bm = new THREE.Mesh(banks, surfaceMaterial('bank')); bm.name = 'settlement:canal_banks'; bm.receiveShadow = true; bm.castShadow = false; bm.matrixAutoUpdate = false;
  bm.userData = { tier: 'C', src: cf.src, note: 'Kuh-e Rahmat canal banks (course and section C; existence B)' }; group.add(bm); tris += banks.index!.count / 3; meshes++;
  // roads: one mesh for all of them (a single draw call, receive-only); samples every 8 m within 4 km, 40 m beyond
  const roadMat = roadMaterial(); (roadMat as any).polygonOffset = true; (roadMat as any).polygonOffsetFactor = -2; (roadMat as any).polygonOffsetUnits = -2;
  const rparts: { pos: number[]; nor: number[]; idx: number[] }[] = [];
  for (const r of plan.roads) {
    const all = resample(r.pts, 8), near = all.filter(p => Math.hypot(p[0], p[1]) <= 4000), farPts = all.filter((p, i) => Math.hypot(p[0], p[1]) > 4000 && i % 5 === 0);
    // keep the order along the road: split into runs of near / far samples
    let run: P2[] = [], runFar = false;
    const flush = () => { if (run.length > 1) rparts.push(ribbon(run, r.width, H, runFar ? 0.4 : 0.06)); };
    all.forEach((p, i) => { const far = Math.hypot(p[0], p[1]) > 4000; if (far && i % 5 !== 0 && i !== all.length - 1) return; if (far !== runFar && run.length) { run.push(p); flush(); run = [p]; runFar = far; return; } runFar = far; run.push(p); });
    flush(); void near; void farPts;
  }
  const rg = geo(rparts); const rm = new THREE.Mesh(rg, roadMat); rm.name = 'settlement:roads'; rm.receiveShadow = true; rm.matrixAutoUpdate = false;
  rm.userData = { tier: 'C', src: 'LIVIUS-TR;PLEIADES-FARS;ROYALROAD-GIS;SUMNER1986;RECON', note: 'earth roads 6-8 m (settlement.json): to Naqsh-e Rustam, to Pasargadae up the Pulvar, the royal road W toward Susa, S to Tirazziš; courses C (Q-054); spur to the Tol-e Ajori gate C' };
  group.add(rm); tris += rg.index!.count / 3; meshes++;
  const update = (_cam: THREE.Vector3) => {};
  return { group, tris, meshes, update };
}
