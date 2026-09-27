// GLB reading and measuring for the asset pipeline (D-305): the JSON chunk, the binary chunk, triangle and vertex counts per
// mesh (read from the accessors, so a Draco-compressed primitive is counted from its declared counts), the images with their
// pixel sizes (PNG IHDR or KTX2 header), and a GPU-memory estimate. Also repacks a GLB with replaced image payloads (the
// KTX2 stage: tools/blender/build.mjs). Plain node, no dependencies: tests and the build share it.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const sha256 = buf => createHash('sha256').update(buf).digest('hex');

export function parseGLB(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  const len = buf.readUInt32LE(8); let o = 12, json = null, bin = null;
  while (o < len) {
    const cl = buf.readUInt32LE(o), ct = buf.readUInt32LE(o + 4), data = buf.subarray(o + 8, o + 8 + cl);
    if (ct === 0x4e4f534a) json = JSON.parse(data.toString('utf8')); else if (ct === 0x004e4942) bin = data;
    o += 8 + cl;
  }
  return { json, bin };
}
export const readGLB = path => parseGLB(readFileSync(path));

/** pixel size of a PNG or KTX2 payload */
export function imageSize(b) {
  if (b.readUInt32BE(0) === 0x89504e47) return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), format: 'png' };
  if (b.subarray(1, 7).toString('latin1') === 'KTX 20') return { w: b.readUInt32LE(20), h: b.readUInt32LE(24), format: 'ktx2', levels: b.readUInt32LE(40) };
  if (b.readUInt16BE(0) === 0xffd8) { // JPEG: first SOFn
    let o = 2; while (o < b.length) { const m = b.readUInt16BE(o), l = b.readUInt16BE(o + 2); if (m >= 0xffc0 && m <= 0xffcf && m !== 0xffc4 && m !== 0xffc8 && m !== 0xffcc) return { w: b.readUInt16BE(o + 7), h: b.readUInt16BE(o + 5), format: 'jpeg' }; o += 2 + l; }
  }
  return { w: 0, h: 0, format: 'unknown' };
}

/** per mesh (by name): triangles, vertices, attributes; images; bytes; GPU estimate (textures RGBA8 + mips, or 1 B/px for
 *  UASTC KTX2 + mips; vertex buffers at the decoded attribute sizes; 32-bit indices) */
export function measureGLB(buf) {
  const { json, bin } = parseGLB(buf), A = json.accessors ?? [], BV = json.bufferViews ?? [];
  const compSize = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }, nComp = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const meshes = {}; let gpu = 0;
  for (const node of json.nodes ?? []) {
    if (node.mesh === undefined) continue;
    const m = json.meshes[node.mesh], name = node.name ?? m.name; let tris = 0, verts = 0; const attrs = new Set(); const materials = [];
    for (const p of m.primitives) {
      const ia = p.indices !== undefined ? A[p.indices] : null, pa = A[p.attributes.POSITION];
      tris += ia ? ia.count / 3 : pa.count / 3; verts += pa.count;
      for (const [k, i] of Object.entries(p.attributes)) { attrs.add(k); gpu += A[i].count * nComp[A[i].type] * 4; }
      if (ia) gpu += ia.count * 4;
      if (p.material !== undefined) materials.push(p.material);
      if (p.extensions?.KHR_draco_mesh_compression) attrs.add('draco');
    }
    meshes[name] = { tris, verts, attrs: [...attrs].sort(), materials };
  }
  const images = (json.images ?? []).map((im, i) => {
    const bv = BV[im.bufferView], data = bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength), s = imageSize(data);
    const texBytes = s.w * s.h * (s.format === 'ktx2' ? 1 : 4) * 4 / 3; gpu += texBytes;
    return { index: i, name: im.name, mimeType: im.mimeType, bytes: data.length, ...s };
  });
  const materials = (json.materials ?? []).map(m => ({ name: m.name, normalTexture: m.normalTexture?.index ?? null }));
  const textures = (json.textures ?? []).map(t => ({ source: t.source ?? t.extensions?.KHR_texture_basisu?.source }));
  return { bytes: buf.length, meshes, images, materials, textures, gpuBytes: Math.round(gpu), extensionsUsed: json.extensionsUsed ?? [] };
}

/** a new GLB with the payloads of some images replaced (index → { data, mimeType }); every buffer view is re-laid in the
 *  binary chunk, 4-byte aligned; KTX2 images are routed through KHR_texture_basisu */
export function repackGLB(buf, replace) {
  const { json, bin } = parseGLB(buf), BV = json.bufferViews;
  const slices = BV.map(v => bin.subarray(v.byteOffset ?? 0, (v.byteOffset ?? 0) + v.byteLength));
  for (const [i, r] of Object.entries(replace)) {
    const im = json.images[+i]; slices[im.bufferView] = r.data; im.mimeType = r.mimeType;
    if (r.mimeType === 'image/ktx2') for (const t of json.textures) if (t.source === +i) { t.extensions = { ...(t.extensions ?? {}), KHR_texture_basisu: { source: +i } }; delete t.source; }
  }
  if (Object.values(replace).some(r => r.mimeType === 'image/ktx2')) for (const k of ['extensionsUsed', 'extensionsRequired']) json[k] = [...new Set([...(json[k] ?? []), 'KHR_texture_basisu'])];
  const pad4 = n => (n + 3) & ~3; let off = 0; const parts = [];
  slices.forEach((s, i) => { BV[i].byteOffset = off; BV[i].byteLength = s.length; parts.push(s); const p = pad4(s.length) - s.length; if (p) parts.push(Buffer.alloc(p)); off = pad4(off + s.length); });
  json.buffers = [{ byteLength: off }];
  let jb = Buffer.from(JSON.stringify(json), 'utf8'); jb = Buffer.concat([jb, Buffer.alloc(pad4(jb.length) - jb.length, 0x20)]);
  const bb = Buffer.concat(parts), head = Buffer.alloc(12), jh = Buffer.alloc(8), bh = Buffer.alloc(8);
  head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + jb.length + 8 + bb.length, 8);
  jh.writeUInt32LE(jb.length, 0); jh.writeUInt32LE(0x4e4f534a, 4); bh.writeUInt32LE(bb.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([head, jh, jb, bh, bb]);
}

// ---- Draco decoding in node (D-306): three's own decoder (node_modules/three/examples/jsm/libs/draco/draco_decoder.js)
import { createRequire } from 'node:module';
let DRACO = null;
async function draco() {
  if (DRACO) return DRACO;
  const vm = await import('node:vm'), { dirname, resolve } = await import('node:path');
  const here = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  const src = readFileSync(resolve(here, '../../../node_modules/three/examples/jsm/libs/draco/draco_decoder.js'), 'utf8');
  const ctx = { console, module: {}, exports: {}, require: createRequire(import.meta.url) }; vm.createContext(ctx);
  vm.runInContext(src + ';this.DracoDecoderModule = DracoDecoderModule;', ctx);
  DRACO = await ctx.DracoDecoderModule();
  return DRACO;
}
// ---- content comparison (D-306): --verify's test when the bytes differ. Measured on the colossi: identical inputs gave a
// different Draco bitstream, decoding to the same geometry but for one tangent component in ~190 k one quantisation step
// (4.9e-4) apart, and in one build of four one texel of 4.2 M one level apart in the baked map (float noise of the
// multithreaded tangent and CPU bake passes at a quantisation step). A rebuild counts as a reproduction when its geometry
// decodes to the same counts and indices with at most GEO_TOL.frac of its attribute values differing, by at most GEO_TOL.max,
// and its maps, transcoded from KTX2 (three's Basis transcoder), differ in at most MAP_TOL.frac of texels by at most
// MAP_TOL.max levels. tests/blender_assets.test.ts holds the recorded comparison to them.
export const MAP_TOL = { frac: 1e-4, max: 8 }, GEO_TOL = { frac: 1e-4, max: 1e-3 };
let BASIS = null;
async function basis() {
  if (BASIS) return BASIS;
  const vm = await import('node:vm'), { dirname, resolve } = await import('node:path');
  const here = dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
  const file = resolve(here, '../../../node_modules/three/examples/jsm/libs/basis/basis_transcoder.js');
  const ctx = { console, process, require: createRequire(file), __filename: file, __dirname: dirname(file), URL, WebAssembly, TextDecoder, setTimeout, clearTimeout, performance }; vm.createContext(ctx);
  vm.runInContext(readFileSync(file, 'utf8') + ';this.BASIS = BASIS;', ctx);
  BASIS = await ctx.BASIS(); BASIS.initializeBasis();
  return BASIS;
}
/** the GLB's content: each Draco primitive decoded (attributes as float32, indices) and each KTX2 map's level 0 as RGBA8 */
export async function glbContent(buf) {
  const { json, bin } = parseGLB(buf), D = await draco(), BV = json.bufferViews ?? [], view = i => bin.subarray(BV[i].byteOffset ?? 0, (BV[i].byteOffset ?? 0) + BV[i].byteLength);
  const geo = [], maps = [];
  for (const m of json.meshes ?? []) for (const p of m.primitives) {
    const e = p.extensions?.KHR_draco_mesh_compression; if (!e) continue;
    const data = view(e.bufferView), db = new D.DecoderBuffer(), arr = new Int8Array(data.buffer, data.byteOffset, data.byteLength); db.Init(arr, arr.length);
    const dec = new D.Decoder(), mesh = new D.Mesh(), st = dec.DecodeBufferToMesh(db, mesh); if (!st.ok()) throw new Error('draco: ' + st.error_msg());
    const parts = [];
    for (const [, id] of Object.entries(e.attributes)) { const a = dec.GetAttributeByUniqueId(mesh, id), n = mesh.num_points() * a.num_components(), f = new D.DracoFloat32Array(); dec.GetAttributeFloatForAllPoints(mesh, a, f); const o = new Float32Array(n); for (let k = 0; k < n; k++) o[k] = f.GetValue(k); parts.push(o); D.destroy(f); }
    const fa = new D.DracoInt32Array(), idx = new Float32Array(mesh.num_faces() * 3);
    for (let t = 0; t < mesh.num_faces(); t++) { dec.GetFaceFromMesh(mesh, t, fa); idx[t * 3] = fa.GetValue(0); idx[t * 3 + 1] = fa.GetValue(1); idx[t * 3 + 2] = fa.GetValue(2); }
    parts.push(idx); geo.push({ mesh: m.name, parts }); D.destroy(fa); D.destroy(mesh); D.destroy(dec); D.destroy(db);
  }
  for (const im of json.images ?? []) {
    const data = view(im.bufferView);
    if (im.mimeType !== 'image/ktx2') { maps.push({ raw: data }); continue; }
    const B = await basis(), k = new B.KTX2File(new Uint8Array(data)); if (!k.isValid() || !k.startTranscoding()) throw new Error('ktx2 invalid');
    const w = k.getWidth(), h = k.getHeight(), dst = new Uint8Array(k.getImageTranscodedSizeInBytes(0, 0, 0, 13));
    if (!k.transcodeImage(dst, 0, 0, 0, 13, 0, -1, -1)) throw new Error('ktx2 transcode failed'); k.close(); k.delete();
    maps.push({ w, h, rgba: dst });
  }
  return { json: JSON.stringify({ ...json, bufferViews: undefined, buffers: undefined }), geo, maps };
}
/** compare two GLBs' content (see MAP_TOL) */
export async function compareContent(a, b) {
  const A = await glbContent(a), B = await glbContent(b), r = { json: A.json === B.json, geometry: A.geo.length === B.geo.length, geo: [], maps: [] };
  A.geo.forEach((g, i) => {
    const h = B.geo[i]; if (!h || g.parts.length !== h.parts.length || g.parts.some((p, j) => p.length !== h.parts[j].length)) { r.geometry = false; return; }
    const idx = g.parts.length - 1; let n = 0, differ = 0, max = 0;
    g.parts.forEach((p, j) => { for (let k = 0; k < p.length; k++) { const d = Math.abs(p[k] - h.parts[j][k]); if (j === idx ? d !== 0 : false) r.geometry = false; if (d) { differ++; max = Math.max(max, d); } } n += p.length; });
    const frac = differ / n; r.geo.push({ mesh: g.mesh, differ, frac, max }); if (frac > GEO_TOL.frac || max > GEO_TOL.max) r.geometry = false;
  });
  A.maps.forEach((m, i) => {
    const n = B.maps[i]; if (m.raw || !n || n.raw) { r.maps.push({ equal: !!n && Buffer.compare(Buffer.from(m.raw ?? []), Buffer.from(n.raw ?? [1])) === 0 }); return; }
    let differ = 0, max = 0; for (let t = 0; t < m.rgba.length; t += 4) { let d = 0; for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(m.rgba[t + c] - n.rgba[t + c])); if (d) { differ++; max = Math.max(max, d); } }
    r.maps.push({ w: m.w, h: m.h, differ, frac: differ / (m.w * m.h), max });
  });
  r.ok = r.json && r.geometry && r.maps.every(m => m.equal ?? (m.frac <= MAP_TOL.frac && m.max <= MAP_TOL.max));
  return r;
}
