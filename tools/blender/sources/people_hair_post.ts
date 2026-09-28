// Post-step of the people's hair (D-307, D-323): binds the cards Blender groomed (tools/blender/hair_groom.py: out/cards.json,
// anchored on the local triangles of the head it was given, src/head.json) to the body's render vertices, writes the card
// sets (out/people_hair.{bin,json}: per vertex the anchor triangle's three render vertices, two barycentrics, the offset in
// the reference's bind frame, uv, the atlas cell, the root-to-tip occlusion; two-sided cards get a back face of their own),
// and the atlases' mip chains:
//  * the strand atlas: coverage-preserving (after Castaño, "Computing alpha mipmaps", 2010: the trees' method,
//    src/world/trees/atlas.ts mipChain): each level box-filtered (colour and data weighted by coverage, so no dark halo),
//    then each card cell's alpha scaled so the share of its texels passing the material's fixed test (CARD.alphaTest) equals
//    the cell's coverage at full size: a card keeps its density at every distance (the first review saw a box-filtered card
//    fade to a grey film that the test then dithered);
//  * the normal atlas: box-filtered, weighted by coverage (the normal and the occlusion of the strands present).
// Writes out/<atlas>.mip<k>.png and out/<atlas>.levels.json for `ktx create --levels`, and the sets' measures into
// src/source_stats.json (the build's budget check reads them).
// Usage: npx tsx tools/blender/sources/people_hair_post.ts <srcDir> <outDir> <argsJson>
import { readFileSync, writeFileSync } from 'node:fs';
import { decodePNG, encodePNG } from '../../humans/png';
import { BinWriter, type CardsMeta, type CardSetMeta } from '../../../src/people/peopleModels';

const [srcDir, outDir, argJson] = process.argv.slice(2);
const ARGS = JSON.parse(readFileSync(argJson, 'utf8'));
const HEAD = JSON.parse(readFileSync(`${srcDir}/head.json`, 'utf8')), CARDS = JSON.parse(readFileSync(`${outDir}/cards.json`, 'utf8'));
const renderOf: number[] = HEAD.renderOf, ltris: number[] = HEAD.tris;
const COLS = ARGS.atlas.cols, ROWS = ARGS.atlas.rows.length, THR = ARGS.atlas.alphaTest ?? 0.5;

// ---------------------------------------------------------------- the card sets
const W = new BinWriter(); const sets: Record<string, CardSetMeta> = {}; const stats: Record<string, any> = { head: { vertices: renderOf.length, triangles: ltris.length / 3 } };
for (const [id, S] of Object.entries<any>(CARDS.sets)) {
  const cards: any[] = S.cards;
  // a two-sided card's back face covers only its free segments (where it hangs clear of the head: on the head its back is
  // never seen), from the first point whose next segment hangs
  const backFrom = (c: any) => { if (!c.both) return -1; for (let k = 0; k + 1 < c.n; k++) if (c.free[k + 1]) return k; return -1; };
  const nv = cards.reduce((s, c) => { const b = backFrom(c); return s + c.v.length + (b >= 0 ? (c.n - b) * 2 : 0); }, 0);
  if (nv > 65535) throw new Error(`${id}: ${nv} vertices (> 65535)`);
  const anchor = new Uint16Array(nv * 3), bary = new Float32Array(nv * 2), off = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), cell = new Uint8Array(nv), ao = new Uint8Array(nv); const index: number[] = [];
  let v = 0, lenSum = 0, maxOff = 0, back = 0;
  for (const c of cards) {
    const n = c.n; let L = 0;
    for (let k = 1; k < n; k++) { const a = c.v[(k - 1) * 2], b = c.v[k * 2]; const pa = a.o, pb = b.o; L += Math.hypot(pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]); } // (offsets from moving anchors: an estimate)
    lenSum += L;
    const b0 = backFrom(c);
    for (let f = 0; f < (b0 >= 0 ? 2 : 1); f++) {
      const base = v, k0 = f === 0 ? 0 : b0;
      for (let k = k0; k < n; k++) for (let s = 0; s < 2; s++) {
        const q = c.v[k * 2 + s], tri = q.t;
        for (let e = 0; e < 3; e++) anchor[v * 3 + e] = renderOf[ltris[tri * 3 + e]];
        bary[v * 2] = q.b[0]; bary[v * 2 + 1] = q.b[1]; off.set(q.o, v * 3); maxOff = Math.max(maxOff, Math.hypot(q.o[0], q.o[1], q.o[2]));
        uv[v * 2] = s; uv[v * 2 + 1] = k / (n - 1); cell[v] = c.cls * 8 + c.col; ao[v] = Math.round(255 * (c.ao[0] + (c.ao[1] - c.ao[0]) * k / (n - 1))); v++;
      }
      for (let k = k0; k + 1 < n; k++) { const l0 = base + (k - k0) * 2, r0 = l0 + 1, l1 = l0 + 2, r1 = l0 + 3;
        if (f === 0) index.push(l0, r0, l1, r0, r1, l1); else { index.push(l0, l1, r0, r0, l1, r1); back += 2; } }
    }
  }
  sets[id] = { n: nv, tris: index.length / 3, cards: cards.length, note: S.note,
    anchor: W.add(anchor), bary: W.add(bary), off: W.add(off), uv: W.add(uv), cell: W.add(cell), ao: W.add(ao), index: W.add(Uint16Array.from(index)) };
  stats[id] = { cards: cards.length, tris: index.length / 3, backTris: back, verts: nv, meanLen: +(lenSum / Math.max(1, cards.length)).toFixed(4), maxOff: +maxOff.toFixed(4) };
  console.log('[people_hair_post]', id, JSON.stringify(stats[id]));
}
const at = decodePNG(readFileSync(`${outDir}/people_hair_atlas.png`)), nm = decodePNG(readFileSync(`${outDir}/people_hair_normal.png`));
const meta: CardsMeta = { version: 1, ref: HEAD.ref, headH: HEAD.lm.headH,
  atlas: { file: 'people_hair_atlas.ktx2', w: at.width, h: at.height, cols: COLS, rows: ARGS.atlas.rows.map((r: any) => r.kind) },
  normal: { file: 'people_hair_normal.ktx2', w: nm.width, h: nm.height },
  classRows: ARGS.classRows, sets };
writeFileSync(`${outDir}/people_hair.bin`, W.bytes());
writeFileSync(`${outDir}/people_hair.json`, JSON.stringify(meta, null, 1) + '\n');
writeFileSync(`${srcDir}/source_stats.json`, JSON.stringify(stats, null, 1));

// ---------------------------------------------------------------- mip chains
function chain(name: string, im: { width: number; height: number; data: Uint8Array }, preserve: boolean) {
  let w0 = im.width, h0 = im.height; let cur = new Float32Array(w0 * h0 * 4); for (let i = 0; i < cur.length; i++) cur[i] = im.data[i] / 255;
  const cw0 = w0 / COLS, ch0 = h0 / ROWS, cov0 = new Float32Array(COLS * ROWS);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { let s = 0; for (let y = r * ch0; y < (r + 1) * ch0; y++) for (let x = c * cw0; x < (c + 1) * cw0; x++) s += cur[(y * w0 + x) * 4 + 3]; cov0[r * COLS + c] = s / (cw0 * ch0); }
  const levels: string[] = []; const st: any[] = [];
  const save = (k: number, buf: Float32Array, w: number, h: number) => { const o = new Uint8Array(w * h * 4); for (let i = 0; i < o.length; i++) o[i] = Math.max(0, Math.min(255, Math.round(buf[i] * 255)));
    const f = `${name}.mip${k}.png`; writeFileSync(`${outDir}/${f}`, encodePNG(w, h, o)); levels.push(f); };
  save(0, cur, w0, h0);
  for (let k = 1; w0 > 1 || h0 > 1; k++) {
    const w = Math.max(1, w0 >> 1), h = Math.max(1, h0 >> 1), nx = new Float32Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0; const rgb = [0, 0, 0];
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const sx = Math.min(w0 - 1, x * 2 + dx), sy = Math.min(h0 - 1, y * 2 + dy), i = (sy * w0 + sx) * 4, al = cur[i + 3]; a += al; for (let e = 0; e < 3; e++) rgb[e] += cur[i + e] * al; }
      const o = (y * w + x) * 4; for (let e = 0; e < 3; e++) nx[o + e] = a > 1e-6 ? rgb[e] / a : 0.5; nx[o + 3] = a / 4; }
    const out = nx.slice(), cw = w / COLS, ch = h / ROWS;
    if (preserve && cw >= 1 && ch >= 1) for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const target = cov0[r * COLS + c], idx: number[] = []; for (let y = Math.floor(r * ch); y < Math.floor((r + 1) * ch); y++) for (let x = Math.floor(c * cw); x < Math.floor((c + 1) * cw); x++) idx.push((y * w + x) * 4 + 3);
      const pass = (s: number) => idx.reduce((n, i) => n + (nx[i] * s >= THR ? 1 : 0), 0) / idx.length;
      let lo = 0, hi = 64; for (let it = 0; it < 24; it++) { const m = (lo + hi) / 2; if (pass(m) < target) lo = m; else hi = m; }
      const s = (lo + hi) / 2; for (const i of idx) out[i] = Math.min(1, nx[i] * s);
      if (k <= 5 && c === 0) st.push({ level: k, row: r, cov0: +target.toFixed(3), scale: +s.toFixed(2), passing: +pass(s).toFixed(3) });
    }
    cur = nx; w0 = w; h0 = h; // (the next level filters the plain box-filtered level: the scale is not compounded)
    save(k, out, w, h);
  }
  writeFileSync(`${outDir}/${name}.levels.json`, JSON.stringify({ levels, alphaTest: THR, coverage: Array.from(cov0, x => +x.toFixed(3)), stats: st }, null, 1));
  console.log('[people_hair_post]', name, levels.length, 'levels; coverage per cell', Array.from(cov0, x => x.toFixed(2)).join(' '));
}
chain('people_hair_atlas', at, true);
chain('people_hair_normal', nm, false);
