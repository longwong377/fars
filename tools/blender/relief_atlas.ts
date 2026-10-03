// The carved-relief atlas build (D-320; src/arch/relief_atlas.ts says what it is and how the game draws it).
//   npx tsx tools/blender/relief_atlas.ts [--device=CPU|GPU] [--jobs=N] [--only=kind|seed,...] [--census] [--reuse]
// 1. census: every relief figure the world draws (the Apadana, the Phase 4 stairs and jambs, Naqsh-e Rustam, the rosette
//    bands), grouped by definition (kind | seed) with the heights and depths it is drawn at;
// 2. per definition (node): the heightfield of src/arch/relief_field.ts rasterised at the atlas texel on the stone
//    (TEXEL_M, point-sampled detail: the curls, pleats and flutes at full resolution), cropped to the carving plus MARGIN
//    texels, as a dense surface in metres at the definition's most common depth ratio, clamped at the wall face, with the foot
//    of every outline step pulled in under its arris (UNDERCUT: the masons' undercut, which throws the dark contour line of
//    the Persepolis reliefs); and the paint on the same grid (colour, film coverage with its wear at raised arrises, gilding);
// 3. Blender (tools/blender/relief_bake.py, Cycles, CPU by default): the front-view normal and ambient occlusion of each surface;
// 4. packing into PAGE² array layers (shelf packing, tallest first), two PNG stacks, then KTX2 (UASTC + zstd, mipmaps) with the
//    KTX-Software CLI: public/models/reliefs/{nao,paint}.ktx2, and the index src/data/relief_atlas.json.
// Scratch (the surfaces, the bakes, the PNGs) goes to $RELIEF_WORK (default T:/fars-assets-s12/reliefs/work).
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { spawnSync, spawn } from 'node:child_process';
import { cpus } from 'node:os';
import { figureDef } from '../../src/arch/relief_figures';
import { rasterize, fieldCoverage, figureBounds, BG, STONE_SRGB } from '../../src/arch/relief_field';
import { v } from '../../src/arch/spec';
import { atlasCell, type AtlasIndex, type AtlasEntry } from '../../src/arch/relief_atlas';
import { reliefAtlasInputs } from './lib/relief_inputs';
import { census, bakeFrame, type DefUse } from './lib/relief_census';

const ARG = Object.fromEntries(process.argv.slice(2).map(a => { const [k, ...r] = a.replace(/^--/, '').split('='); return [k, r.length ? r.join('=') : '1']; }));
const WORK = process.env.RELIEF_WORK ?? 'T:/fars-assets-s12/reliefs/work';
const BLENDER = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe';
const KTX = process.env.KTX ?? ['C:/Program Files/KTX-Software/bin/ktx.exe', '/usr/local/bin/ktx'].find(p => existsSync(p)) ?? 'ktx';
const DEVICE = (ARG.device ?? 'CPU').toUpperCase();
/** the atlas texel on the stone (m): the old finest LOD's cell (RELIEF_LODS[0], 1.6 mm), where a curl of a register figure's
 *  beard (9.5 mm) spans six texels and a jamb king's (29 mm) eighteen (technical, C) */
export const TEXEL_M = 0.0016;
/** the largest grid side (texels): the blocked-out giants of the Hall of 100 Columns (3.4 m) at 1.7 mm */
export const MAX_TEXELS = 2049;
/** background texels kept round each figure: the mip chain down to a 16th keeps a texel of it (no bleeding between figures) */
export const MARGIN = 12;
/** page side (texels) and the gap between rectangles */
export const PAGE = 4096, GAP = 4;
/** the undercut: the foot of a step at least STEP_MIN relief-depths high is pulled under its arris by UNDERCUT of the step's
 *  height, at most UNDER_REACH texels (C: the outlines of the Apadana reliefs are cut square to slightly under, read on the
 *  photographs of the guards' and delegates' heads, fars-assets/photos/reliefs/73117298_King_guard.jpg, 94697337) */
export const STEP_MIN = 0.2, UNDERCUT = 0.55, UNDER_REACH = 5; // D-513: was 0.25, 0.3, 3 (the outlines read as flat cut-outs at 2-10 m: the undercut is what throws the dark contour)
/** Cycles samples per texel: normals antialiased within the texel, occlusion from 64 rays (technical, C) */
export const SAMPLES = { normal: 4, ao: 64 };
/** occlusion rays reach AO_DEPTHS relief depths (the step's own shadow line and the folds, not the neighbouring figure) */
export const AO_DEPTHS = 3; // D-513: was 2 (the folds and the contour hollows darker)
const log = (...a: unknown[]) => console.log('[relief_atlas]', ...a);
mkdirSync(WORK, { recursive: true });
const sha = (b: Buffer | Uint8Array) => createHash('sha256').update(b).digest('hex');

// ---------------------------------------------------------------- 1. census: tools/blender/lib/relief_census.ts

// ---------------------------------------------------------------- 2. surfaces and paint
interface Prepared { key: string; nx: number; ny: number; cell: number; fig: [number, number]; rho: number; S: number; zmax: number; id: string; paint: Uint8Array }
/** an sRGB value (the palette is held in sRGB) as a byte */
const u8 = (c: number) => Math.max(0, Math.min(255, Math.floor(c * 255 + 0.5)));
function prepare(u: DefUse): Prepared {
  const { rho, S, sMax, coarse } = bakeFrame(u), def = figureDef(u.kind, u.seed), b = figureBounds(def);
  const E = Math.max(b[2] - b[0], b[3] - b[1]), cellT = atlasCell(TEXEL_M, MAX_TEXELS, sMax, E, coarse);
  const n = Math.min(MAX_TEXELS + 1, Math.ceil(E / cellT) + 1), f = rasterize(def, n, false), cell = f.cell;
  // the carving's extent on the grid (anything carved or painted), plus the margin
  let i0 = n, i1 = -1, j0 = n, j1 = -1;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const g = j * n + i; if (f.h[g] > 0 || f.col[g] !== BG) { if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; } }
  i0 = Math.max(0, i0 - MARGIN); j0 = Math.max(0, j0 - MARGIN); i1 = Math.min(n - 1, i1 + MARGIN); j1 = Math.min(n - 1, j1 + MARGIN);
  const nx = i1 - i0 + 1, ny = j1 - j0 + 1, D = rho * S, zw = v<any>('apadana', 'r_relief_carving').embed, cm = cell * S;
  // the surface in metres (x along, y up, z out of the wall), clamped at the wall face
  const z = new Float32Array(nx * ny); let zmax = zw;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const h = f.h[(j + j0) * n + i + i0]; const q = Math.max(zw, h * D); z[j * nx + i] = q; if (q > zmax) zmax = q; }
  const xyz = new Float32Array(nx * ny * 3);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const k = (j * nx + i) * 3; xyz[k] = (f.x0 + (i + i0) * cell) * S; xyz[k + 1] = (f.y0 + (j + j0) * cell) * S; xyz[k + 2] = z[j * nx + i]; }
  // the undercut: a point at the foot of a step (the highest point within UNDER_REACH texels stands STEP_MIN relief depths or
  // more above it) moves toward that point, under the arris, by UNDERCUT of the rise, less as it climbs the step
  const R = UNDER_REACH;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const g = j * nx + i, zg = z[g]; let best = zg, bi = 0, bj = 0;
    for (let dj = -R; dj <= R; dj++) { const jj = j + dj; if (jj < 0 || jj >= ny) continue; for (let di = -R; di <= R; di++) { const ii = i + di; if (ii < 0 || ii >= nx || di * di + dj * dj > R * R) continue; const q = z[jj * nx + ii]; if (q > best) { best = q; bi = di; bj = dj; } } }
    const rise = best - zg; if (rise < STEP_MIN * D) continue;
    const dist = Math.hypot(bi, bj) * cm, climb = (zg - zw) / Math.max(1e-6, best - zw), s = Math.min(UNDERCUT * rise * (1 - climb), dist * 0.85);
    if (s <= 0) continue;
    xyz[g * 3] += (bi * cm / dist) * s; xyz[g * 3 + 1] += (bj * cm / dist) * s;
  }
  const id = u.key.replace(/[|~]/g, '_');
  writeFileSync(`${WORK}/${id}.xyz`, Buffer.from(xyz.buffer));
  // paint on the same grid: sRGB colour (the stone where nothing is painted; gilding is its gilt key colour, which the shader
  // recognises) and coverage (0 = bare stone)
  const cov = fieldCoverage(f), paint = new Uint8Array(nx * ny * 4);
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const g = (j + j0) * n + i + i0, k = j * nx + i, ci = f.col[g], c = ci === BG ? STONE_SRGB : f.palette[ci];
    paint[k * 4] = u8(c[0]); paint[k * 4 + 1] = u8(c[1]); paint[k * 4 + 2] = u8(c[2]);
    paint[k * 4 + 3] = ci === BG ? 0 : u8(cov[g]);
  }
  return { key: u.key, nx, ny, cell, fig: [f.x0 + i0 * cell, f.y0 + j0 * cell], rho, S, zmax, id, paint };
}

// ---------------------------------------------------------------- 3. Blender
/** the Blender jobs: one per device in `devices` ('GPU' through a GPU slot, 'CPU' with its share of the cores); the figures are
 *  dealt largest first to the job with the least work, a GPU job counted at `GPU_SPEED` CPU jobs */
const GPU_SPEED = 3;
function bake(ps: Prepared[], devices: string[]) {
  const jobs = devices.length, cpuJobs = devices.filter(d => d === 'CPU').length;
  const parts: Prepared[][] = Array.from({ length: jobs }, () => []), load = new Array(jobs).fill(0);
  for (const p of [...ps].sort((a, b) => b.nx * b.ny - a.nx * a.ny)) { const k = load.indexOf(Math.min(...load)); parts[k].push(p); load[k] += (p.nx * p.ny + 40000) / (devices[k] === 'GPU' ? GPU_SPEED : 1); }
  const runs = parts.map((part, k) => [part, k] as const).filter(([p]) => p.length).map(([part, k]) => {
    const job = { device: devices[k], normal_samples: SAMPLES.normal, ao_samples: SAMPLES.ao, seed: 0, stats: `${WORK}/bake_stats_${k}.json`,
      figures: part.map(p => ({ id: p.id, xyz: `${WORK}/${p.id}.xyz`, nx: p.nx, ny: p.ny, cell: p.cell * p.S, zmax: p.zmax, ao_distance: AO_DEPTHS * p.rho * p.S, out: `${WORK}/${p.id}.nao` })) };
    writeFileSync(`${WORK}/job_${k}.json`, JSON.stringify(job, null, 1));
    const cmd: [string, string[]] = devices[k] === 'GPU' ? ['node', ['tools/dev/gpu_slot.mjs', 'relief-atlas', '--', 'node', 'tools/blender/lib/run_blender.mjs', '-b', '--factory-startup', '--python', 'tools/blender/relief_bake.py', '--', `${WORK}/job_${k}.json`]]
      : [BLENDER, ['-b', '--factory-startup', '-t', String(Math.max(2, Math.floor(cpus().length / Math.max(1, cpuJobs)))), '--python', 'tools/blender/relief_bake.py', '--', `${WORK}/job_${k}.json`]];
    return new Promise<void>((res, rej) => { const c = spawn(cmd[0], cmd[1], { stdio: ['ignore', 'pipe', 'pipe'] });
      c.stdout.on('data', d => { for (const l of String(d).split('\n')) if (l.startsWith('[relief_bake]')) console.log(`  [${k}]`, l.slice(14)); });
      c.stderr.on('data', d => process.stderr.write(d)); c.on('exit', code => (code === 0 ? res() : rej(new Error(`blender job ${k} exited ${code}`)))); });
  });
  return Promise.all(runs);
}

// ---------------------------------------------------------------- 4. packing, PNG, KTX2
/** skyline bottom-left packing (tallest first; each rectangle at the lowest top it can have in the first layer it fits, GAP
 *  texels apart): 4 layers where the shelves of D-320's first build took 5 */
function pack(ps: Prepared[]) {
  const order = [...ps].sort((a, b) => b.ny - a.ny || b.nx - a.nx), place = new Map<string, { layer: number; x: number; y: number }>();
  const sky: { x: number; y: number; w: number }[][] = [];
  const fit = (L: { x: number; y: number; w: number }[], i: number, w: number) => { // the top of the skyline under [x, x + w) from segment i, or -1
    const x = L[i].x; if (x + Math.min(w, PAGE - x) > PAGE || x >= PAGE) return -1;
    let y = 0; for (let j = i; j < L.length && L[j].x < x + w; j++) y = Math.max(y, L[j].y);
    return x + w - GAP > PAGE ? -1 : y;
  };
  for (const p of order) {
    if (p.nx > PAGE || p.ny > PAGE) throw new Error(`${p.key}: ${p.nx}x${p.ny} does not fit a ${PAGE} page`);
    const w = p.nx + GAP, h = p.ny + GAP; let done = false;
    for (let li = 0; li <= sky.length && !done; li++) {
      if (li === sky.length) sky.push([{ x: 0, y: 0, w: PAGE }]);
      const L = sky[li]; let best = -1, by = Infinity;
      for (let i = 0; i < L.length; i++) { const y = fit(L, i, w); if (y >= 0 && y + p.ny <= PAGE && y < by) { by = y; best = i; } }
      if (best < 0) continue;
      const x = L[best].x; place.set(p.key, { layer: li, x, y: by });
      // the skyline under the new rectangle becomes one segment at its top
      const out: typeof L = [], x1 = x + w;
      for (const g of L) { const g1 = g.x + g.w;
        if (g1 <= x || g.x >= x1) { out.push(g); continue; }
        if (g.x < x) out.push({ x: g.x, y: g.y, w: x - g.x });
        if (g1 > x1) out.push({ x: x1, y: g.y, w: g1 - x1 }); }
      out.push({ x, y: by + h, w: Math.min(w, PAGE - x) }); out.sort((a, b) => a.x - b.x);
      const merged: typeof L = []; for (const g of out) { const m = merged[merged.length - 1]; if (m && m.y === g.y && m.x + m.w === g.x) m.w += g.w; else merged.push({ ...g }); }
      sky[li] = merged; done = true;
    }
  }
  return { place, layers: sky.length };
}
/** the bake of one figure (normal x, y, z and occlusion per texel). Where a front ray met the underside of an undercut step
 *  (the pulled-in foot of a thin feature folds over its neighbour: ~0.5 % of the texels, all on outlines), the normal is
 *  that of the surface without the undercut (the heightfield's own, Sobel over the grid) */
export let badNormals = 0;
function bakedNormals(p: Prepared): Uint8Array {
  const nb = new Uint8Array(readFileSync(`${WORK}/${p.id}.nao`)); if (nb.length !== p.nx * p.ny * 4) throw new Error(`${p.key}: bake ${nb.length} bytes, want ${p.nx * p.ny * 4}`);
  let xyz: Float32Array | null = null; const { nx, ny } = p, cm = p.cell * p.S;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const s = j * nx + i; if (nb[s * 4 + 2] / 127.5 - 1 >= 0.12) continue;
    badNormals++;
    xyz ??= new Float32Array(readFileSync(`${WORK}/${p.id}.xyz`).buffer.slice(0));
    const Z = (ii: number, jj: number) => xyz![(Math.min(ny - 1, Math.max(0, jj)) * nx + Math.min(nx - 1, Math.max(0, ii))) * 3 + 2];
    const gx = (Z(i + 1, j - 1) + 2 * Z(i + 1, j) + Z(i + 1, j + 1) - Z(i - 1, j - 1) - 2 * Z(i - 1, j) - Z(i - 1, j + 1)) / (8 * cm);
    const gy = (Z(i - 1, j + 1) + 2 * Z(i, j + 1) + Z(i + 1, j + 1) - Z(i - 1, j - 1) - 2 * Z(i, j - 1) - Z(i + 1, j - 1)) / (8 * cm);
    const l = Math.hypot(gx, gy, 1);
    nb[s * 4] = u8(0.5 - 0.5 * gx / l); nb[s * 4 + 1] = u8(0.5 - 0.5 * gy / l); nb[s * 4 + 2] = u8(0.5 + 0.5 / l);
  }
  return nb;
}
function crc32(b: Uint8Array) { let c = ~0; for (let i = 0; i < b.length; i++) { c ^= b[i]; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; }
function png(w: number, h: number, rgba: Uint8Array) {
  const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const chunk = (t: string, d: Buffer) => { const len = Buffer.alloc(4); len.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t, 'ascii'), d]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}
function run(cmd: string, args: string[]) { const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1 << 26 }); if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')}: status ${r.status} ${r.signal ?? ''} ${r.error ?? ''} ${r.stderr || r.stdout}`); return r.stdout; }

// ---------------------------------------------------------------- main
(async () => {
  const t0 = Date.now();
  const uses = await census();
  log(`census: ${uses.size} definitions, ${[...uses.values()].reduce((s, u) => s + u.inst.length, 0)} placements (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (ARG.census) { for (const u of uses.values()) { const b = bakeFrame(u); log(u.key, u.inst.length, 'rho', b.rho.toFixed(4), 'S', b.S.toFixed(2), 'sMax', b.sMax.toFixed(2)); } return; }
  const only = ARG.only ? new Set(String(ARG.only).split(',')) : null;
  const todo = [...uses.values()].filter(u => !only || only.has(u.key));
  const ps: Prepared[] = []; let t1 = Date.now();
  for (const u of todo) ps.push(prepare(u));
  const texels = ps.reduce((s, p) => s + p.nx * p.ny, 0);
  log(`surfaces: ${ps.length}, ${(texels / 1e6).toFixed(1)} M texels (${((Date.now() - t1) / 1000).toFixed(1)} s)`);
  t1 = Date.now();
  const stale = ARG.reuse ? ps.filter(p => !existsSync(`${WORK}/${p.id}.nao`)) : ps;
  // one GPU job (it holds one of the two GPU slots), with --cpujobs=N CPU jobs beside it; or --jobs=N CPU jobs
  if (stale.length) await bake(stale, DEVICE === 'GPU' ? ['GPU', ...Array(+(ARG.cpujobs ?? 0)).fill('CPU')] : Array(Math.max(1, +(ARG.jobs ?? 2))).fill('CPU'));
  log(`bake: ${stale.length} figures in ${((Date.now() - t1) / 1000).toFixed(1)} s (${DEVICE})`);
  if (only) { log('--only: bake checked, atlas not written'); return; }
  const { place, layers } = pack(ps);
  log(`packing: ${layers} layers of ${PAGE}², fill ${(texels / (layers * PAGE * PAGE) * 100).toFixed(0)} %`);
  // the pages: background everywhere (the wall's flat normal, open sky, bare stone), then each rectangle
  const S0 = STONE_SRGB.map(u8), naoPng: string[] = [], paintPng: string[] = [];
  for (let L = 0; L < layers; L++) {
    const nao = new Uint8Array(PAGE * PAGE * 4), paint = new Uint8Array(PAGE * PAGE * 4);
    for (let k = 0; k < PAGE * PAGE; k++) { nao[k * 4] = 128; nao[k * 4 + 1] = 128; nao[k * 4 + 2] = 255; nao[k * 4 + 3] = 255; paint[k * 4] = S0[0]; paint[k * 4 + 1] = S0[1]; paint[k * 4 + 2] = S0[2]; paint[k * 4 + 3] = 0; }
    for (const p of ps) { const q = place.get(p.key)!; if (q.layer !== L) continue;
      const nb = bakedNormals(p);
      for (let j = 0; j < p.ny; j++) for (let i = 0; i < p.nx; i++) { const s = j * p.nx + i, d = ((q.y + j) * PAGE + q.x + i) * 4;
        nao[d] = nb[s * 4]; nao[d + 1] = nb[s * 4 + 1]; nao[d + 2] = nb[s * 4 + 2]; nao[d + 3] = nb[s * 4 + 3];
        paint[d] = p.paint[s * 4]; paint[d + 1] = p.paint[s * 4 + 1]; paint[d + 2] = p.paint[s * 4 + 2]; paint[d + 3] = p.paint[s * 4 + 3]; } }
    naoPng.push(`${WORK}/nao_${L}.png`); paintPng.push(`${WORK}/paint_${L}.png`);
    writeFileSync(naoPng[L], png(PAGE, PAGE, nao)); writeFileSync(paintPng[L], png(PAGE, PAGE, paint));
  }
  const OUT = 'public/models/reliefs'; mkdirSync(OUT, { recursive: true });
  const enc = ['--encode', 'uastc', '--uastc-quality', '2', '--uastc-rdo', '--uastc-rdo-l', String(ARG.rdo ?? '0.75'), '--zstd', '18', '--generate-mipmap', '--mipmap-filter', 'box'];
  const lay = layers > 1 ? ['--layers', String(layers)] : [];
  t1 = Date.now();
  // (encoded into the scratch folder, then copied: the served folder only ever holds a whole file)
  run(KTX, ['create', '--format', 'R8G8B8A8_UNORM', '--assign-tf', 'linear', ...lay, ...enc, ...naoPng, `${WORK}/nao.ktx2`]);
  run(KTX, ['create', '--format', 'R8G8B8A8_SRGB', ...lay, ...enc, ...paintPng, `${WORK}/paint.ktx2`]);
  for (const k of ['nao', 'paint']) copyFileSync(`${WORK}/${k}.ktx2`, `${OUT}/${k}.ktx2`);
  log(`KTX2: ${((Date.now() - t1) / 1000).toFixed(1)} s`);
  const fb = (p: string) => readFileSync(p), stats = [0, 1, 2, 3, 4, 5].map(k => existsSync(`${WORK}/bake_stats_${k}.json`) ? JSON.parse(readFileSync(`${WORK}/bake_stats_${k}.json`, 'utf8')) : null).filter(Boolean);
  const defs: Record<string, AtlasEntry> = {};
  for (const p of ps) { const q = place.get(p.key)!; defs[p.key] = { layer: q.layer, px: [q.x, q.y, p.nx, p.ny], fig: [+p.fig[0].toFixed(7), +p.fig[1].toFixed(7)], cell: +p.cell.toPrecision(8), rho: +p.rho.toFixed(6) }; }
  const index: AtlasIndex = {
    about: 'The carved-relief atlas (D-320): per relief figure definition (kind|seed) its texel rectangle in the array pages, the figure-frame position of its first texel, figure units per texel and the depth ratio its normals were baked at. Built by tools/blender/relief_atlas.ts (census of the world, heightfield + undercut surfaces, Cycles bakes in tools/blender/relief_bake.py, KTX2 by the KTX-Software CLI); tests/relief_atlas.test.ts checks it is complete, current and reproduced.',
    version: 1, inHash: reliefAtlasInputs([...uses.values()].map(u => ({ key: u.key, ...bakeFrame(u) }))).hash, size: PAGE, layers, texel_m: TEXEL_M, maxTexels: MAX_TEXELS,
    files: { nao: 'models/reliefs/nao.ktx2', paint: 'models/reliefs/paint.ktx2' },
    sha: { nao: sha(fb(`${OUT}/nao.ktx2`)), paint: sha(fb(`${OUT}/paint.ktx2`)) },
    bytes: { nao: statSync(`${OUT}/nao.ktx2`).size, paint: statSync(`${OUT}/paint.ktx2`).size },
    blender: stats[0]?.blender ?? '', device: stats[0]?.device ?? DEVICE, defs,
  };
  writeFileSync('src/data/relief_atlas.json', JSON.stringify(index, null, 1) + '\n');
  log(`done (${badNormals} texels took the heightfield normal): ${ps.length} definitions, ${layers} layers, nao ${(index.bytes.nao / 1e6).toFixed(1)} MB, paint ${(index.bytes.paint / 1e6).toFixed(1)} MB, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
})().catch(e => { console.error(e); process.exit(1); });
