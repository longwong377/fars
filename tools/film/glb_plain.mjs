// A copy of a game .glb that Blender's glTF importer can read (D-761): the game's KTX2 (KHR_texture_basisu) textures are
// dropped (the film lights and shades its own surfaces), the geometry, normals and UVs are kept.
//   node tools/film/glb_plain.mjs <in.glb> <out.glb>
import { readFileSync, writeFileSync } from 'node:fs';
const [inp, out] = process.argv.slice(2), b = readFileSync(inp);
const jlen = b.readUInt32LE(12), json = JSON.parse(b.subarray(20, 20 + jlen).toString('utf8')), rest = b.subarray(20 + jlen);
const drop = e => (e ?? []).filter(x => x !== 'KHR_texture_basisu');
json.extensionsUsed = drop(json.extensionsUsed); json.extensionsRequired = drop(json.extensionsRequired);
delete json.textures; delete json.images; delete json.samplers;
for (const m of json.materials ?? []) { const p = m.pbrMetallicRoughness; if (p) { delete p.baseColorTexture; delete p.metallicRoughnessTexture; } delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture; }
let s = Buffer.from(JSON.stringify(json), 'utf8'); const pad = (4 - (s.length % 4)) % 4; s = Buffer.concat([s, Buffer.alloc(pad, 0x20)]);
const head = Buffer.alloc(20); head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(20 + s.length + rest.length, 8); head.writeUInt32LE(s.length, 12); head.write('JSON', 16);
writeFileSync(out, Buffer.concat([head, s, rest]));
