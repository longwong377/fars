// PARSA tree assets (D-327): the whole class of trees (15 species x 3 variants, src/world/trees) rebuilt with Blender from the
// game's own generators, and packed for the game (public/models/trees/, loaded by src/world/trees/assets.ts):
//   src    npx tsx tools/blender/sources/trees_src.ts: the leaf atlas's primitives and every model's branch skeleton (JSON)
//   atlas  tools/blender/trees_atlas.py: every leaf, blossom and twig tile modelled in 3-D and rendered in Cycles, then here:
//          leaf_col.png (shade, petal, bark, coverage) and leaf_tilt.png (the leaves' own facing), in the atlas layout
//   wood   tools/blender/trees_wood.py: every variant's branches skinned into one continuous bark-mapped mesh per level of
//          detail (the game's triangle budgets), with Cycles-baked occlusion per vertex, then here: wood.bin + wood.json
//   bark   the species' CC0 bark scans (src/data/tree_bark.json), resized for the game: bark/<scan>_{diff,nor}.jpg
//   manifest  public/models/trees/manifest.json: input hash, output hashes and sizes, measurements
//   node tools/blender/trees.mjs [src] [atlas] [wood] [bark] [manifest]   (none: all)  [--tile=512] [--spp=128] [--device=GPU|CPU]
// Heavy Cycles renders go through tools/dev/gpu_slot.mjs when --device=GPU (the watchdog: at most two heavy GPU jobs).
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readNpy } from './lib/npy.mjs';
import { treeInputHash } from './lib/tree_inputs.mjs';

const BLENDER = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe';
const WORK = process.env.TREES_WORK ?? 'T:/fars-assets-s12/trees/work', BARK_SRC = process.env.TREES_BARK ?? 'T:/fars-assets-s12/trees/bark';
const OUT = 'public/models/trees';
const args = process.argv.slice(2), flag = (k, d) => { const a = args.find(x => x.startsWith(`--${k}=`)); return a ? a.split('=')[1] : d; };
const steps = args.filter(a => !a.startsWith('--')); const all = !steps.length, want = s => all || steps.includes(s);
const TILE = +flag('tile', 512), SPP = +flag('spp', 128), DEVICE = flag('device', 'GPU');
mkdirSync(WORK, { recursive: true }); mkdirSync(OUT, { recursive: true });
const t0 = Date.now(), log = (...a) => console.log(`[trees ${((Date.now() - t0) / 1000).toFixed(0)}s]`, ...a);
const run = (cmd, argv, label) => { const r = spawnSync(cmd, argv, { stdio: 'inherit', shell: false }); if (r.status !== 0) throw new Error(`${label} exited ${r.status}`); };
const blender = (script, argv, label, gpu) => {
  const bl = [BLENDER, '-b', '--factory-startup', '--python', script, '--', ...argv];
  if (gpu) run(process.execPath, ['tools/dev/gpu_slot.mjs', `trees-${label}`, '--', ...bl.map(q => q.includes(' ') ? `"${q}"` : q)], label);
  else run(bl[0], bl.slice(1), label);
};
const SRC = `${WORK}/src.json`;

if (want('src')) { run(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'tools/blender/sources/trees_src.ts', SRC], 'trees_src'); }

// ---------------------------------------------------------------- the leaf atlas
/** the shade's scale (atlas.ts Atlas.shade: multiplier = SB x R): room above the tiles' means (~1) for the brightest texels */
export const SHADE_B = 1.8;
if (want('atlas')) {
  const dir = `${WORK}/atlas${TILE}`;
  blender('tools/blender/trees_atlas.py', [SRC, dir, String(TILE), String(SPP), DEVICE], 'atlas', DEVICE === 'GPU');
  atlasPost(dir);
}
if (steps.includes('atlaspost')) atlasPost(`${WORK}/atlas${TILE}`);
function atlasPost(dir) {
  const J = JSON.parse(readFileSync(SRC, 'utf8')), A = J.atlas, sh = readNpy(`${dir}/shade.npy`), cl = readNpy(`${dir}/cls.npy`), nr = readNpy(`${dir}/nrm.npy`);
  const [H, W] = sh.shape, T = W / A.cols, pad = Math.max(2, Math.round(A.pad * T / 256));
  const col = new Uint8Array(W * H * 4), tilt = new Uint8Array(W * H * 4), u8 = x => Math.max(0, Math.min(255, Math.round(x * 255)));
  const stats = [];
  for (let t = 0; t < A.names.length; t++) {
    const ox = (t % A.cols) * T, oy = Math.floor(t / A.cols) * T;
    // the tile's mean rendered radiance over its covered texels, against the procedural tile's mean shade multiplier
    let s = 0, n = 0, over = 0;
    for (let j = pad; j < T - pad; j++) for (let i = pad; i < T - pad; i++) { const o = ((oy + j) * W + ox + i) * 4, a = sh.data[o + 3]; if (a < 0.5) continue; s += sh.data[o] / a; n++; }
    const k = n ? A.procMean[t] / (s / n) : 1;
    for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) {
      const o = ((oy + j) * W + ox + i) * 4, a = sh.data[o + 3];
      if (a < 1e-3 || j < pad || i < pad || j >= T - pad || i >= T - pad) continue; // the tile's clear margin (atlas.ts PAD)
      const m = k * sh.data[o] / a; if (m > SHADE_B) over++;
      col[o] = u8(m / SHADE_B); col[o + 1] = u8(cl.data[o + 1] / a); col[o + 2] = u8(cl.data[o + 2] / a); col[o + 3] = u8(a);
      // the normal (0.5 + 0.5 n, premultiplied by coverage) -> the tilt along the tile's u and v (the leaf shader's)
      let nx = (nr.data[o] / a) * 2 - 1, ny = (nr.data[o + 1] / a) * 2 - 1, nz = (nr.data[o + 2] / a) * 2 - 1; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      const d = Math.max(0.35, nz);
      tilt[o] = u8(0.5 + 0.5 * Math.max(-1, Math.min(1, nx / d))); tilt[o + 1] = u8(0.5 + 0.5 * Math.max(-1, Math.min(1, ny / d))); tilt[o + 2] = 128; tilt[o + 3] = u8(a);
    }
    let f = 0; for (let j = 0; j < T; j++) for (let i = 0; i < T; i++) if (col[((oy + j) * W + ox + i) * 4 + 3] >= 128) f++;
    stats.push({ tile: A.names[t], scale: +k.toFixed(4), fill: +(f / (T * T)).toFixed(4), procFill: A.procFill[t], clipped: over });
  }
  writePng(`${OUT}/leaf_col.png`, col, W, H); writePng(`${OUT}/leaf_tilt.png`, tilt, W, H);
  writeFileSync(`${WORK}/atlas_stats.json`, JSON.stringify({ tile: T, shadeB: SHADE_B, render: JSON.parse(readFileSync(`${dir}/atlas_render.json`, 'utf8')), tiles: stats }, null, 1));
  log('atlas', `${W}x${H}`, stats.map(s => `${s.tile} fill ${s.fill} (proc ${s.procFill}) x${s.scale}${s.clipped ? ` clipped ${s.clipped}` : ''}`).join('; '));
}
/** RGBA8 rows bottom-up (v up) -> a PNG (rows top-down) */
function writePng(path, data, W, H) {
  const { PNG } = createRequireSync()('playwright-core/lib/utilsBundle');
  const png = new PNG({ width: W, height: H, colorType: 6 });
  for (let j = 0; j < H; j++) png.data.set(data.subarray((H - 1 - j) * W * 4, (H - j) * W * 4), j * W * 4);
  writeFileSync(path, PNG.sync.write(png, { colorType: 6, deflateLevel: 9 }));
}
import { createRequire } from 'node:module';
function createRequireSync() { return createRequire(import.meta.url); }
export { atlasPost };

// ---------------------------------------------------------------- the wood
if (want('wood')) {
  const dir = `${WORK}/wood`;
  blender('tools/blender/trees_wood.py', [SRC, 'src/data/tree_bark.json', dir, DEVICE], 'wood', DEVICE === 'GPU');
  for (const f of ['wood.bin', 'wood.json']) writeFileSync(`${OUT}/${f}`, readFileSync(`${dir}/${f}`));
  const m = JSON.parse(readFileSync(`${dir}/wood.json`, 'utf8'));
  log('wood', m.lods.map((l, i) => `lod${i}: ${l.reduce((a, e) => a + e.tris, 0)} triangles over ${l.length} models (max ${Math.max(...l.map(e => e.tris))}, budget ${m.budget[i]})`).join('; '));
}
// ---------------------------------------------------------------- the bark scans (CC0), at the game's size
if (want('bark')) {
  const sharp = createRequireSync()('sharp'), B = JSON.parse(readFileSync('src/data/tree_bark.json', 'utf8')), px = B.px;
  mkdirSync(`${OUT}/bark`, { recursive: true });
  for (const scan of [...new Set(Object.values(B.species).map(s => s.scan))]) {
    await sharp(`${BARK_SRC}/${scan}/diff.jpg`).resize(px, px).jpeg({ quality: 84, mozjpeg: true }).toFile(`${OUT}/bark/${scan}_diff.jpg`);
    await sharp(`${BARK_SRC}/${scan}/nor.jpg`).resize(px, px).jpeg({ quality: 88, mozjpeg: true }).toFile(`${OUT}/bark/${scan}_nor.jpg`);
  }
  log('bark', readdirSync(`${OUT}/bark`).length, 'files');
}
// ---------------------------------------------------------------- the manifest
if (want('manifest') || all) {
  const files = {}, walk = d => { for (const f of readdirSync(d)) { const p = `${d}/${f}`; if (statSync(p).isDirectory()) walk(p); else if (!p.endsWith('manifest.json')) { const b = readFileSync(p); files[p.slice(OUT.length + 1)] = { sha256: createHash('sha256').update(b).digest('hex'), bytes: b.length }; } } };
  walk(OUT);
  const st = existsSync(`${WORK}/atlas_stats.json`) ? JSON.parse(readFileSync(`${WORK}/atlas_stats.json`, 'utf8')) : null;
  const wood = JSON.parse(readFileSync(`${OUT}/wood.json`, 'utf8'));
  const settings = { tile: st?.tile ?? TILE, shadeB: SHADE_B };
  const man = { about: 'Generated by tools/blender/trees.mjs (D-327); do not edit. Leaf atlas rendered in Cycles from modelled leaves (tools/blender/trees_atlas.py), branch meshes skinned from the game skeletons with baked occlusion (trees_wood.py), CC0 bark scans from Poly Haven (src/data/tree_bark.json; raw downloads with sha256: T:/fars-assets-s12/trees/bark/manifest.json).',
    inHash: treeInputHash(settings), settings, tile: settings.tile, shadeB: SHADE_B, blender: st?.render?.blender, atlas: st, wood: { budget: wood.budget, lods: wood.lods.map(l => l.map(e => ({ row: e.row, tris: e.tris, ao_mean: e.ao_mean }))), device: wood.device, ao_samples: wood.ao_samples },
    bytes: Object.values(files).reduce((a, f) => a + f.bytes, 0), files };
  writeFileSync(`${OUT}/manifest.json`, JSON.stringify(man, null, 1));
  log('manifest', Object.keys(files).length, 'files', (man.bytes / 1e6).toFixed(2), 'MB');
}
