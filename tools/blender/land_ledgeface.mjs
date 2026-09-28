// The ledges' face maps (session 12, D-335): bakes the scanned bedded cliff in Blender (tools/blender/land_ledgeface.py; on the
// GPU through gpu_slot, or CPU=1 on the CPU) and finishes the maps for the game: crops to the face the bake's rays hit, fills
// the holes from their neighbours, turns the relief into a high-pass (the face's own ledges and recesses about its local mean,
// in metres) and writes public/models/land/ledgeface_{diff,nor}.jpg, ledgeface_height.png and ledgeface.json.
//   node tools/blender/land_ledgeface.mjs      (NOBLEND=1: finish an earlier bake in $WORK)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
const BLENDER = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe';
const WORK = process.env.WORK ?? 'T:/fars-assets-s12/land/face', OUT = 'public/models/land', W = +(process.env.OUTW ?? 2048);
mkdirSync(WORK, { recursive: true }); mkdirSync(OUT, { recursive: true });
if (!process.env.NOBLEND) { const r = spawnSync(BLENDER, ['-b', '--factory-startup', '--python', 'tools/blender/land_ledgeface.py', '--', WORK], { stdio: 'inherit', env: process.env }); if (r.status !== 0) throw new Error(`blender exited ${r.status}`); }
const meta = JSON.parse(readFileSync(`${WORK}/ledgeface.json`, 'utf8'));
const raw = async f => { const { data, info } = await sharp(`${WORK}/${f}`).removeAlpha().toColourspace('rgb16').raw({ depth: 'ushort' }).toBuffer({ resolveWithObject: true }); return { d: new Uint16Array(data.buffer, data.byteOffset, data.length / 2), w: info.width, h: info.height }; };
const D = await raw('ledgeface_diff.png'), N = await raw('ledgeface_nor.png'), H = await raw('ledgeface_height.png');
const w = D.w, h = D.h, valid = new Uint8Array(w * h);
for (let i = 0; i < w * h; i++) valid[i] = (D.d[i * 3] + D.d[i * 3 + 1] + D.d[i * 3 + 2]) > 300 && H.d[i * 3] > 30 ? 1 : 0;
// the crop: columns and rows where most pixels were hit
const colOK = c => { let n = 0; for (let r = 0; r < h; r++) n += valid[r * w + c]; return n > h * 0.6; }, rowOK = r => { let n = 0; for (let c = 0; c < w; c++) n += valid[r * w + c]; return n > w * 0.85; };
let c0 = 0, c1 = w - 1, r0 = 0, r1 = h - 1; while (!colOK(c0)) c0++; while (!colOK(c1)) c1--; while (!rowOK(r0)) r0++; while (!rowOK(r1)) r1--;
const cw = c1 - c0 + 1, ch = r1 - r0 + 1;
console.log(`face crop: cols ${c0}..${c1}, rows ${r0}..${r1} of ${w} x ${h}`);
// fill: every unhit pixel takes its nearest hit neighbour (passes of 8-neighbour dilation)
const crop = (A, n) => { const o = new Float32Array(cw * ch * n); for (let r = 0; r < ch; r++) for (let c = 0; c < cw; c++) for (let k = 0; k < n; k++) o[(r * cw + c) * n + k] = A.d[((r + r0) * w + c + c0) * 3 + k] / 65535; return o; };
const d = crop(D, 3), nn = crop(N, 3), hh = crop(H, 1), ok = new Uint8Array(cw * ch); for (let r = 0; r < ch; r++) for (let c = 0; c < cw; c++) ok[r * cw + c] = valid[(r + r0) * w + c + c0];
for (let pass = 0; pass < 64; pass++) { let left = 0; const nok = ok.slice();
  for (let r = 0; r < ch; r++) for (let c = 0; c < cw; c++) { const i = r * cw + c; if (ok[i]) continue; left++;
    for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr >= ch || cc >= cw) continue; const j = rr * cw + cc; if (!ok[j]) continue;
      for (let k = 0; k < 3; k++) { d[i * 3 + k] = d[j * 3 + k]; nn[i * 3 + k] = nn[j * 3 + k]; } hh[i] = hh[j]; nok[i] = 1; break; } }
  ok.set(nok); if (!left) break; }
// the relief as metres about the local mean (a box of ~2.5 m of face), clamped to +-1.2 m
const depth = meta.depth_m, mPerPx = meta.width_m / w, box = Math.max(2, Math.round(2.5 / mPerPx)), rel = new Float32Array(cw * ch);
const I = new Float64Array((cw + 1) * (ch + 1)); for (let r = 0; r < ch; r++) for (let c = 0; c < cw; c++) I[(r + 1) * (cw + 1) + c + 1] = hh[r * cw + c] + I[r * (cw + 1) + c + 1] + I[(r + 1) * (cw + 1) + c] - I[r * (cw + 1) + c];
for (let r = 0; r < ch; r++) for (let c = 0; c < cw; c++) { const a = Math.max(0, r - box), b = Math.min(ch, r + box + 1), e = Math.max(0, c - box), f = Math.min(cw, c + box + 1);
  const mean = (I[b * (cw + 1) + f] - I[a * (cw + 1) + f] - I[b * (cw + 1) + e] + I[a * (cw + 1) + e]) / ((b - a) * (f - e)); rel[r * cw + c] = Math.max(-1.2, Math.min(1.2, (hh[r * cw + c] - mean) * depth)); }
const RANGE = 1.2, oh = Math.round(W * ch / cw);
const to8 = (A, n, f = v => v) => Buffer.from(Array.from(A, (v, i) => Math.round(Math.max(0, Math.min(1, f(v))) * 255)));
await sharp(to8(d, 3), { raw: { width: cw, height: ch, channels: 3 } }).resize(W, oh).jpeg({ quality: 88 }).toFile(`${OUT}/ledgeface_diff.jpg`);
await sharp(to8(nn, 3), { raw: { width: cw, height: ch, channels: 3 } }).resize(W, oh).jpeg({ quality: 90 }).toFile(`${OUT}/ledgeface_nor.jpg`);
await sharp(to8(rel, 1, v => 0.5 + v / (2 * RANGE)), { raw: { width: cw, height: ch, channels: 1 } }).resize(W, oh).png().toFile(`${OUT}/ledgeface_height.png`);
const out = { about: 'D-335: the ledges\' face, baked from Poly Haven coastal_cliff_04 (CC0) by tools/blender/land_ledgeface.*', src: meta.src, width_m: cw * mPerPx, height_m: ch * (meta.height_m / h), W, H: oh, relief_range_m: RANGE, relief_note: 'height png: 0.5 = the face\'s local mean (a 2.5 m box), 0 / 1 = -/+ relief_range_m out of it' };
writeFileSync(`${OUT}/ledgeface.json`, JSON.stringify(out, null, 1));
console.log('ledge face:', JSON.stringify(out));
