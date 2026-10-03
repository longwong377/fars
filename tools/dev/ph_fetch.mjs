// D-490 (s17 V2): fetch Poly Haven CC0 texture sets into public/textures/<id>/ (diff, arm, nor (OpenGL), disp) at 2K, and their
// records into T:/ph-info/<id>.json (author, dimensions) for the ledger and scans.json. Run: node tools/dev/ph_fetch.mjs <id> [<id> ...]
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
const res = process.env.RES ?? '2k';
for (const id of process.argv.slice(2)) {
  const files = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json();
  const info = await (await fetch(`https://api.polyhaven.com/info/${id}`)).json();
  mkdirSync(`public/textures/${id}`, { recursive: true }); mkdirSync('T:/ph-info', { recursive: true });
  writeFileSync(`T:/ph-info/${id}.json`, JSON.stringify(info, null, 1));
  for (const [k, f] of [['Diffuse', 'diff'], ['arm', 'arm'], ['nor_gl', 'nor'], ['Displacement', 'disp']]) {
    const u = files[k]?.[res]?.jpg?.url; if (!u) { console.log(id, 'no', k); continue; }
    const out = `public/textures/${id}/${f}.jpg`; if (existsSync(out)) continue;
    const b = Buffer.from(await (await fetch(u)).arrayBuffer()); writeFileSync(out, b); console.log(id, f, b.length);
  }
  console.log(id, info.name, Object.keys(info.authors ?? {}).join(', '), info.dimensions);
}
