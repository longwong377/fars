// s18 Vagon: collect the face sources for the cloud (no Blender work here). Copies the MakeHuman 2020 CC0 system assets that
// this box holds, downloads the scanned head, and writes SOURCES.md (one line a file: URL, licence, author, sha256).
//   node assets-raw/faces/collect.mjs
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url)), MH = 'C:/Users/Administrator/fars-assets/humans/makehuman_cc0';
const MH_SRC = 'MakeHuman system assets, 2020 CC0 release (http://www.makehumancommunity.org/; the local pack on Vagon)';
const MH_AUTH = 'Data Collection AB, Joel Palmius, Jonas Hauquier (MakeHuman)';
const rows = [];
const sha = f => createHash('sha256').update(readFileSync(f)).digest('hex');
const walk = d => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
// 1-6: the MakeHuman CC0 parts (skins: albedo only, 20 sets of ages and tones; eyes: iris textures + high/low-poly eye proxies;
// brows and lashes: cards; hair: the cards' images and meshes; proxymeshes; teeth and tongue for the mouth at 0.5 m)
for (const [from, to] of [['skins', 'skin/makehuman'], ['eyes', 'eyes/makehuman'], ['eyebrows', 'brows'], ['eyelashes', 'lashes'], ['hair', 'hair/makehuman'], ['proxymeshes', 'mesh/makehuman_proxies'], ['teeth', 'mouth/teeth'], ['tongue', 'mouth/tongue']]) {
  const src = join(MH, from), dst = join(HERE, to); if (!existsSync(src)) continue; cpSync(src, dst, { recursive: true });
  for (const f of walk(dst)) rows.push({ f, url: `${MH_SRC}: ${from}/${relative(dst, f).replace(/\\/g, '/')}`, lic: 'CC0 1.0', who: MH_AUTH }); }
// the scanned head with its maps (the only licence-clean scanned face with normal + spec maps we know of): Lee Perry-Smith by
// Infinite-Realities, CC BY 3.0, as distributed with three.js (examples/models/gltf/LeePerrySmith)
const LPS = 'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/gltf/LeePerrySmith/';
for (const n of ['LeePerrySmith.glb', 'Map-COL.jpg', 'Map-SPEC.jpg', 'Infinite-Level_02_Tangent_SmoothUV.jpg']) {
  const dst = join(HERE, 'skin/scan_lee_perry_smith', n); mkdirSync(dirname(dst), { recursive: true });
  const r = await fetch(LPS + n); if (!r.ok) { console.log('FAILED', n, r.status); continue; }
  writeFileSync(dst, Buffer.from(await r.arrayBuffer()));
  rows.push({ f: dst, url: LPS + n, lic: 'CC BY 3.0 (https://creativecommons.org/licenses/by/3.0/)', who: 'Lee Perry-Smith, Infinite-Realities (ir-ltd.net); via three.js' }); }
let md = '# assets-raw/faces: sources (s18, Vagon)\n\nOne line a file: path | source URL | licence | author | sha256. Over 95 MB: none. Raw inputs for the cloud\'s face work (skin projection, normal bake, hair regroom, eyes); nothing here is shipped as is.\n\nNotes: the MakeHuman skins are albedo only (no normal/roughness); the scanned head (Lee Perry-Smith) has albedo (Map-COL), specular (Map-SPEC) and a tangent-space normal (Infinite-Level_02_Tangent_SmoothUV) on its own UVs, not MakeHuman\'s: it needs a projection onto hm08 (Blender, the cloud). CC BY: credit "Lee Perry-Smith head scan by Infinite-Realities, CC BY 3.0" in ASSET_LEDGER when used.\n\n| file | source | licence | author | sha256 | MB |\n|---|---|---|---|---|---|\n';
for (const r of rows) { const s = statSync(r.f).size; if (s > 95 * 2 ** 20) console.log('TOO BIG', r.f);
  md += `| ${relative(HERE, r.f).replace(/\\/g, '/')} | ${r.url} | ${r.lic} | ${r.who} | ${sha(r.f)} | ${(s / 2 ** 20).toFixed(2)} |\n`; }
writeFileSync(join(HERE, 'SOURCES.md'), md);
console.log(`${rows.length} files, ${(rows.reduce((a, r) => a + statSync(r.f).size, 0) / 2 ** 20).toFixed(1)} MB`);
