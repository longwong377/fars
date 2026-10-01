// Bake of the outdoor light field (D-357; format: outdoor.ts). Ray tracing against the built world as analytic boxes
// (trace.ts): the Terrace's own parts, and per town site its walls (with the lintels over the doorways), roofs and the
// ground under and round it from the terrain. Per probe: the sky seen directly (Fibonacci directions), and one bounce of the
// sky and of the sun off every surface the probe sees (closest-hit directions; at each hit cosine rays to the sky and
// shadow rays to the sun, the sun importance-sampled over the year's mornings and afternoons separately). Bake-time
// smoothing of the bounce between neighbours that see each other; probes inside solids carry their neighbours' mean.
//
// Run: `node tools/blender/lightmaps.mjs` (or `npx tsx src/render/probes/outdoor_bake.ts [--only=<region,...>]`), output
// public/lightmaps/outdoor.{bin,json}. Model tier C (every constant below is C).
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir, cpus } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Part } from '../../arch/parts';
import { TraceScene, sceneFromParts, lum, RGB } from './trace';
import { BAKE, BakeContext, sphereDirs, sunSet, yearSunSamples, skyAt, sunAt, surfaceTable, albedoFn, probeSky } from './bake';
import { siteLight } from './outdoor_town';
import { OutRegion, OutMeta, OUT_TEX_W, OUT_TEXELS, A_S, A_U, TINT_MAX, encL1, probeTexel, colTexel, fromRegion } from './outdoor';

/** rays per probe (C): sky directions (exact visibility structure), bounce directions, and per bounce hit the sky and sun
 *  rays (per half day) */
export const OUT_RAYS = { sky: 192, bounce: 80, skyRays: 1, sunRays: 1 };
/** the town's probe layers above the floor or lane, and the Terrace's above the court datum (C) */
export const TERRACE_LAYERS = { L: 5, y0: 0.6, dy: 3 };

export interface RegionScene { R: OutRegion; scene: TraceScene; ground: Float32Array; flags: Uint8Array; ceil: Float32Array }

// ------------------------------------------------------------------ the town
async function townRegions(only?: Set<string>): Promise<RegionScene[]> {
  const { buildTownPlan } = await import('../../world/settlement/plan');
  const { registerSettlementSurfaces } = await import('../../world/settlement/surfaces');
  const { SURFACES } = await import('../materials');
  const { Ring, Terrain } = await import('../../terrain/heightfield');
  registerSettlementSurfaces();
  const meta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
  const ring = (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0)), meta.court_asl);
  const T = new Terrain(meta, ring('near'), ring('mid'), ring('far'));
  const H = (e: number, n: number) => T.heightAt(e, -n);
  const albedo = albedoFn(surfaceTable(SURFACES as any));
  const plan = buildTownPlan(), out: RegionScene[] = [];
  for (const s of plan.sites) {
    if (only && !only.has(s.id)) continue;
    const L = siteLight(s, H); if (!L) continue;
    out.push({ R: L.R, scene: sceneFromParts(L.parts, albedo, { protome: [1, 1], plain: 1, volute: [1, 1] }), ground: L.ground, flags: L.flags, ceil: L.ceil });
  }
  return out;
}

// ------------------------------------------------------------------ the Terrace
async function terraceRegion(): Promise<RegionScene> {
  const { buildTerrace } = await import('../../arch/terrace');
  const { memberMaterials } = await import('../../arch/sculpt');
  const { SPEC } = await import('../../arch/spec');
  const { SURFACES } = await import('../materials');
  const { traceScene } = await import('./bake');
  const { parts } = buildTerrace();
  const scene = traceScene(parts, surfaceTable(SURFACES as any), (SPEC as any).global.r_column_proportions.v.capital_boxes, p => memberMaterials(p.order));
  // the platform's extent: the parts at or above the court datum (the walls, palaces and courts), plus 4 m
  let e0 = Infinity, e1 = -Infinity, n0 = Infinity, n1 = -Infinity;
  for (const p of parts) { if ((p as any).y1 < -0.5) continue; const pts: [number, number][] = p.type === 'prism' ? p.polygon : p.type === 'box' ? [[p.c[0] - p.size[0] / 2, p.c[1] - p.size[1] / 2], [p.c[0] + p.size[0] / 2, p.c[1] + p.size[1] / 2]] : [[p.c[0], p.c[1]]];
    for (const [e, n] of pts) { e0 = Math.min(e0, e); e1 = Math.max(e1, e); n0 = Math.min(n0, n); n1 = Math.max(n1, n); } }
  const cell = 2, W = Math.ceil((e1 - e0 + 8) / cell), H = Math.ceil((n1 - n0 + 8) / cell);
  const R: OutRegion = { id: 'terrace', kind: 'terrace', c: [e0 - 4, n0 - 4], theta: 0, u0: 0, v0: 0, cell, W, H,
    L: TERRACE_LAYERS.L, y0: TERRACE_LAYERS.y0, dy: TERRACE_LAYERS.dy, gmin: 0, grange: 1, lo: [-2.5, -1.2], hi: [19, 26], edge: 4, probeBase: 0, colBase: 0, flags: false };
  return { R, scene, ground: new Float32Array(W * H), flags: new Uint8Array(W * H), ceil: new Float32Array(W * H).fill(Infinity) };
}

// ------------------------------------------------------------------ per probe
/** the year's sun split at the meridian (world x > 0: the sun east of it, the morning) */
export function halfDaySuns() {
  const all = yearSunSamples(), am = all.filter(s => s.dir[0] > 0), pm = all.filter(s => s.dir[0] <= 0);
  const mean = (a: typeof all): [number, number] => { let x = 0, z = 0; for (const s of a) { const h = Math.hypot(s.dir[0], s.dir[2]) || 1; x += s.dir[0] / h; z += s.dir[2] / h; } const l = Math.hypot(x, z) || 1; return [x / l, z / l]; };
  return { am: sunSet(am), pm: sunSet(pm), amDir: mean(am), pmDir: mean(pm) };
}
/** per probe: [S direct L1 (4), S bounce L1 (4), U am L1 (4), U pm L1 (4), tint r, g, b, L (4), valid] */
export const OUT_W = 21;
export function outProbe(ctx: BakeContext, sunPm: BakeContext['sun'], plain: RGB, x: number, y: number, z: number, seed: number, out: Float32Array, o: number) {
  out.fill(0, o, o + OUT_W);
  const sky = probeSky(ctx, x, y, z); if (!sky[4]) return; // inside a solid
  out[o] = sky[0]; out[o + 1] = sky[1]; out[o + 2] = sky[2]; out[o + 3] = sky[3]; out[o + 20] = 1;
  const D = ctx.dirs, N = D.length / 3, sc = ctx.scene, rho: RGB = [0, 0, 0], k2 = ctx.o.sunSkyRatio, pl = lum(...plain);
  const ctxPm = { ...ctx, sun: sunPm };
  const add = (dx: number, dy: number, dz: number, ls: number, la: number, lp: number, r: number, g: number, b: number) => {
    out[o + 4] += ls; out[o + 5] += 2 * ls * dx; out[o + 6] += 2 * ls * dy; out[o + 7] += 2 * ls * dz;
    out[o + 8] += la; out[o + 9] += 2 * la * dx; out[o + 10] += 2 * la * dy; out[o + 11] += 2 * la * dz;
    out[o + 12] += lp; out[o + 13] += 2 * lp * dx; out[o + 14] += 2 * lp * dy; out[o + 15] += 2 * lp * dz;
    out[o + 16] += r; out[o + 17] += g; out[o + 18] += b; out[o + 19] += lum(r, g, b);
  };
  for (let i = 0; i < N; i++) {
    const dx = D[i * 3], dy = D[i * 3 + 1], dz = D[i * 3 + 2], h = sc.intersect(x, y, z, dx, dy, dz);
    if (!h) { if (dy <= 0) add(dx, dy, dz, pl, pl, pl, plain[0] * (1 + k2), plain[1] * (1 + k2), plain[2] * (1 + k2)); continue; }
    const px = x + dx * h.t, py = y + dy * h.t, pz = z + dz * h.t;
    sc.albedoAt(h.prim, h.ny, rho); const rl = lum(rho[0], rho[1], rho[2]);
    const S = skyAt(ctx, px, py, pz, h.nx, h.ny, h.nz, seed * 257 + i), Ua = sunAt(ctx, px, py, pz, h.nx, h.ny, h.nz, seed * 263 + i), Up = sunAt(ctxPm, px, py, pz, h.nx, h.ny, h.nz, seed * 269 + i);
    const e = S + k2 * 0.5 * (Ua + Up);
    add(dx, dy, dz, rl * S, rl * Ua, rl * Up, rho[0] * e, rho[1] * e, rho[2] * e);
  }
  for (let k = 4; k < 16; k++) out[o + k] /= N;
}

// ------------------------------------------------------------------ driver
const self = fileURLToPath(import.meta.url);
async function regionScenes(only?: Set<string>): Promise<RegionScene[]> {
  const out: RegionScene[] = [];
  if (!only || only.has('terrace')) out.push(await terraceRegion());
  out.push(...(await townRegions(only)));
  return out;
}
function context(scene: TraceScene, suns: ReturnType<typeof halfDaySuns>): BakeContext {
  return { scene, dirs: sphereDirs(OUT_RAYS.bounce), skyDirs: sphereDirs(OUT_RAYS.sky), sun: suns.am, o: { ...BAKE, skyRays: OUT_RAYS.skyRays, sunRays: OUT_RAYS.sunRays }, plain: [0, 0, 0] };
}
function probeWorld(rs: RegionScene, i: number, j: number, k: number): [number, number, number] {
  const R = rs.R, [x, z] = fromRegion(R, R.u0 + (i + 0.5) * R.cell, R.v0 + (j + 0.5) * R.cell);
  return [x, rs.ground[j * R.W + i] + R.y0 + k * R.dy, z];
}

async function child(args: string[]) {
  const bands: { rid: string; j0: number; j1: number; file: string }[] = JSON.parse(readFileSync(args[0], 'utf8'));
  const scenes = await regionScenes(new Set(bands.map(b => b.rid))), suns = halfDaySuns();
  const { SURFACES } = await import('../materials');
  const plain = albedoFn(surfaceTable(SURFACES as any))('earth' as any, true);
  for (const bd of bands) {
    const rs = scenes.find(x => x.R.id === bd.rid)!, R = rs.R, ctx = context(rs.scene, suns), n = (bd.j1 - bd.j0) * R.W * R.L, out = new Float32Array(n * OUT_W);
    let q = 0;
    for (let j = bd.j0; j < bd.j1; j++) for (let k = 0; k < R.L; k++) for (let i = 0; i < R.W; i++, q++) {
      const [x, y, z] = probeWorld(rs, i, j, k);
      outProbe(ctx, suns.pm, plain, x, y, z, ((j * R.W + i) * 7 + k) | 0, out, q * OUT_W);
    }
    writeFileSync(bd.file, Buffer.from(out.buffer));
  }
}

async function main() {
  const T0 = Date.now(), argv = process.argv.slice(2);
  const onlyArg = argv.find(a => a.startsWith('--only='))?.slice(7), only = onlyArg ? new Set(onlyArg.split(',')) : undefined;
  const workers = Math.max(1, Math.min(+(process.env.WORKERS ?? cpus().length - 1), 8));
  const scenes = await regionScenes(only), suns = halfDaySuns();
  console.log(`outdoor field: ${scenes.length} regions, ${scenes.reduce((a, s) => a + s.R.W * s.R.H * s.R.L, 0)} probes; ${workers} workers; build ${((Date.now() - T0) / 1000).toFixed(0)} s`);
  const dir = mkdtempSync(join(tmpdir(), 'outlight-')), rawDir = process.env.RAW_DIR ?? '';
  const encodeOnly = argv.includes('--encode-only');
  // bands of rows, dealt round the workers in equal shares of probes (a child builds the town plan once)
  const bands: { rid: string; j0: number; j1: number; file: string; n: number }[] = [];
  for (const rs of scenes) { const rows = Math.max(1, Math.floor(4000 / (rs.R.W * rs.R.L))); for (let j = 0; j < rs.R.H; j += rows) { const j1 = Math.min(rs.R.H, j + rows); bands.push({ rid: rs.R.id, j0: j, j1, file: join(dir, `${rs.R.id}_${j}.f32`), n: (j1 - j) * rs.R.W * rs.R.L }); } }
  const totalN = bands.reduce((a, b) => a + b.n, 0), shares: typeof bands[] = Array.from({ length: workers }, () => []);
  { let acc = 0; for (const b of bands) { shares[Math.min(workers - 1, Math.floor((acc / totalN) * workers))].push(b); acc += b.n; } }
  let done = 0;
  if (!encodeOnly) await Promise.all(shares.filter(s => s.length).map((sh, w) => new Promise<void>((res, rej) => {
    const jf = join(dir, `share${w}.json`); writeFileSync(jf, JSON.stringify(sh));
    const c = spawn(process.execPath, [...process.execArgv, self, 'child', jf], { stdio: ['ignore', 'inherit', 'inherit'] });
    c.on('exit', code => { if (code === 0) { done++; console.log(`  worker ${w} done (${done}, ${((Date.now() - T0) / 1000).toFixed(0)} s)`); res(); } else rej(new Error(`worker ${w} exited ${code}`)); });
  })));
  const chunks = bands;
  // assemble per region
  let probeBase = 0; const raw = new Map<string, Float32Array>();
  for (const rs of scenes) { const R = rs.R, a = new Float32Array(R.W * R.H * R.L * OUT_W); raw.set(R.id, a); }
  if (!encodeOnly) for (const c of chunks) { const rs = scenes.find(s => s.R.id === c.rid)!, R = rs.R, b = readFileSync(c.file), f = new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4), a = raw.get(R.id)!;
    let q = 0; for (let j = c.j0; j < c.j1; j++) for (let k = 0; k < R.L; k++) for (let i = 0; i < R.W; i++, q++) a.set(f.subarray(q * OUT_W, q * OUT_W + OUT_W), ((k * R.H + j) * R.W + i) * OUT_W); }
  rmSync(dir, { recursive: true, force: true });
  // the traced values per region (RAW_DIR): a change of the encoding or the smoothing re-runs without tracing (--encode-only)
  if (rawDir) { mkdirSync(rawDir, { recursive: true }); for (const [id, a] of raw) { const fn = join(rawDir, `${id}.f32`); if (encodeOnly) { const b = readFileSync(fn); a.set(new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4)); } else writeFileSync(fn, Buffer.from(a.buffer)); } }
  for (const rs of scenes) { const R = rs.R; R.probeBase = probeBase; probeBase += R.W * R.H * R.L * OUT_TEXELS; }
  for (const rs of scenes) { const R = rs.R; R.colBase = probeBase; probeBase += R.W * R.H; }
  const height = Math.ceil(probeBase / OUT_TEX_W), tex = new Uint8Array(OUT_TEX_W * height * 4);
  for (const rs of scenes) encodeRegion(rs, raw.get(rs.R.id)!, tex);
  const meta: OutMeta = { tier: 'C', note: 'outdoor light field: sky past the walls and one bounce of sky and sun (morning / afternoon), ray-traced against the built Terrace and town (D-357; model C)', built: new Date().toISOString(), width: OUT_TEX_W, height, regions: scenes.map(s => s.R), sunAm: suns.amDir, sunPm: suns.pmDir, seconds: Math.round((Date.now() - T0) / 1000), rays: { sky: OUT_RAYS.sky, bounce: OUT_RAYS.bounce } };
  const outDir = process.env.OUT_DIR ?? 'public/lightmaps'; mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'outdoor.bin'), tex); writeFileSync(join(outDir, 'outdoor.json'), JSON.stringify(meta, null, 1));
  console.log(`wrote ${outDir}/outdoor.{bin,json}: ${OUT_TEX_W}×${height} (${(tex.length / 1048576).toFixed(1)} MB) in ${meta.seconds} s`);
}

/** smoothing of the bounce (4 neighbours in the layer that see each other: no wall between, both valid), dilation of the
 *  probes inside solids, encoding */
export function encodeRegion(rs: RegionScene, a: Float32Array, tex: Uint8Array) {
  const R = rs.R, { W, H, L } = R, idx = (i: number, j: number, k: number) => ((k * H + j) * W + i) * OUT_W;
  const valid = (i: number, j: number, k: number) => a[idx(i, j, k) + 20] > 0;
  const open = (i: number, j: number, di: number, dj: number) => { // no wall between (i, j) and its neighbour
    if (!R.flags) return true;
    if (di === 1) return !(rs.flags[j * W + i] & 1); if (di === -1) return !(rs.flags[j * W + i - 1] & 1);
    if (dj === 1) return !(rs.flags[j * W + i] & 2); return !(rs.flags[(j - 1) * W + i] & 2);
  };
  const b = new Float32Array(a); const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let k = 0; k < L; k++) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    if (!valid(i, j, k)) continue; const o = idx(i, j, k); let w = 2; for (let c = 4; c < 20; c++) b[o + c] = a[o + c] * 2;
    for (const [di, dj] of N4) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= H || !valid(ii, jj, k) || !open(i, j, di, dj)) continue;
      const q = idx(ii, jj, k); for (let c = 4; c < 20; c++) b[o + c] += a[q + c]; w++; }
    for (let c = 4; c < 20; c++) b[o + c] /= w;
  }
  // dilation: an invalid probe takes the mean of its valid (or already filled) neighbours in the layer, a few rings out
  const filled = new Uint8Array(W * H * L); for (let k = 0; k < L; k++) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) filled[(k * H + j) * W + i] = valid(i, j, k) ? 1 : 0;
  for (let ring = 0; ring < 4; ring++) { const add: [number, Float32Array][] = [];
    for (let k = 0; k < L; k++) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) { const f = (k * H + j) * W + i; if (filled[f]) continue;
      const acc = new Float32Array(OUT_W); let n = 0;
      for (const [di, dj] of N4) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= W || jj >= H || !filled[(k * H + jj) * W + ii]) continue; const q = idx(ii, jj, k); for (let c = 0; c < 20; c++) acc[c] += b[q + c]; n++; }
      if (n) { for (let c = 0; c < 20; c++) acc[c] /= n; add.push([f, acc]); } }
    for (const [f, acc] of add) { const k = Math.floor(f / (W * H)), r = f % (W * H), o = idx(r % W, Math.floor(r / W), k); for (let c = 0; c < 20; c++) b[o + c] = acc[c]; filled[f] = 1; } }
  for (let k = 0; k < L; k++) for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const o = idx(i, j, k), v = b.subarray(o, o + OUT_W);
    const Sa = v[0] + v[4], fb = Sa > 1e-6 ? v[4] / Sa : 0;
    encL1(Sa, v[1] + v[5], v[2] + v[6], v[3] + v[7], A_S, tex, probeTexel(R, i, j, k, 0) * 4);
    encL1(v[8], v[9], v[10], v[11], A_U, tex, probeTexel(R, i, j, k, 1) * 4);
    encL1(v[12], v[13], v[14], v[15], A_U, tex, probeTexel(R, i, j, k, 2) * 4);
    const Lm = v[19] > 1e-9 ? v[19] : 0, tr = Lm ? v[16] / Lm : 1, tb = Lm ? v[18] / Lm : 1, t3 = probeTexel(R, i, j, k, 3) * 4;
    tex[t3] = Math.round(Math.min(1, tr / TINT_MAX) * 255); tex[t3 + 1] = Math.round(Math.min(1, tb / TINT_MAX) * 255);
    tex[t3 + 2] = Math.round(Math.min(1, Math.max(0, fb)) * 255); tex[t3 + 3] = valid(i, j, k) ? 255 : 0;
  }
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const t = colTexel(R, i, j) * 4, g = Math.round(Math.min(1, Math.max(0, (rs.ground[j * W + i] - R.gmin) / R.grange)) * 65535);
    tex[t] = g >> 8; tex[t + 1] = g & 255; tex[t + 2] = rs.flags[j * W + i];
    const c = rs.ceil[j * W + i]; tex[t + 3] = isFinite(c) ? Math.max(0, Math.min(254, Math.round(c / 0.025))) : 255;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1] || process.argv[1]?.endsWith('outdoor_bake.ts')) {
  if (process.argv[2] === 'child') child(process.argv.slice(3)).then(() => process.exit(0), e => { console.error(e); process.exit(1); });
  else main().then(() => process.exit(0), e => { console.error(e); process.exit(1); });
}
