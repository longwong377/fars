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
