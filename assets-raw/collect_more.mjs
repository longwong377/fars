// s18 Vagon, last minutes: raw inputs the cloud cannot fetch itself. Writes assets-raw/<kind>/... + assets-raw/SOURCES_MORE.md
// (path | source | licence | author | sha256 | MB). CC0 / CC BY / CC BY-NC only; every file < 95 MB.
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, statSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, 'SOURCES_MORE.md');
const only = process.argv[2] ?? 'all';
const row = (f, url, lic, who) => { const b = readFileSync(f); if (b.length > 95 * 2 ** 20) { console.log('TOO BIG, dropped', f); return; }
  appendFileSync(OUT, `| ${f.slice(HERE.length + 1).replace(/\\/g, '/')} | ${url} | ${lic} | ${who} | ${createHash('sha256').update(b).digest('hex')} | ${(b.length / 2 ** 20).toFixed(2)} |\n`); };
const get = async (url, f) => { for (let k = 0; k < 4; k++) { try { const r = await fetch(url, { headers: { 'User-Agent': 'PARSA-time-capsule/1.0 (personal non-commercial)' } }); if (r.status === 429) { await new Promise(z => setTimeout(z, 3000 * (k + 1))); continue; } if (!r.ok) return false;
  mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, Buffer.from(await r.arrayBuffer())); return true; } catch { await new Promise(z => setTimeout(z, 2000)); } } return false; };

// 1. Poly Haven plant models (CC0), glTF 2K with their textures: arid and Mediterranean kinds for the plain, the lanes and the gardens
async function plants() {
  const ids = ['shrub_01', 'shrub_02', 'shrub_03', 'shrub_04', 'shrub_sorrel_01', 'searsia_burchellii', 'searsia_lucida', 'wild_rooibos_bush', 'didelta_spinosa', 'othonna_cerarioides',
    'grass_medium_01', 'grass_medium_02', 'grass_bermuda_01', 'dry_branches_medium_01', 'dead_tree_trunk', 'dead_tree_trunk_02', 'tree_small_02', 'tree_stump_01', 'nettle_plant', 'weed_plant_02',
    'celandine_01', 'dandelion_01', 'food_pomegranate_01', 'root_cluster_01', 'bark_debris_01', 'moss_01'];
  for (const id of ids) {
    const j = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json(); const g = j?.gltf?.['2k']?.gltf ?? j?.gltf?.['1k']?.gltf; if (!g) { console.log('no gltf', id); continue; }
    const base = join(HERE, 'plants', id), files = [[g.url, join(base, g.url.split('/').pop())], ...Object.entries(g.include ?? {}).map(([p, v]) => [v.url, join(base, p)])];
    for (const [u, f] of files) if (await get(u, f)) row(f, `${u} (https://polyhaven.com/a/${id})`, 'CC0 1.0', 'Poly Haven');
    console.log('plant', id, files.length);
  }
}
// 2. ambientCG surfaces (CC0, 2K JPG): the living city's finishes: lime plaster, painted plaster, textiles, carpet, reed and wicker,
// timber, leather, gold and bronze, glazed tile, straw
async function surfaces() {
  const want = { plaster: 4, fabric: 10, carpet: 3, wicker: 3, wood: 4, leather: 2, metal: 0, tiles: 3, straw: 2, rope: 2, paint: 2 };
  for (const [q, n] of Object.entries(want)) {
    const j = await (await fetch(`https://ambientcg.com/api/v2/full_json?type=Material&q=${q}&limit=${Math.max(n, 1) * 3}&include=downloadData`)).json();
    let took = 0;
    for (const a of j.foundAssets ?? []) { if (took >= (n || 0)) break;
      const d = (a.downloadFolders?.default?.downloadFiletypeCategories?.zip?.downloads ?? []).find(x => x.attribute === '2K-JPG'); if (!d) continue;
      const zip = join(HERE, 'surfaces', `${a.assetId}.zip`); if (!(await get(d.downloadLink, zip))) continue;
      const dir = join(HERE, 'surfaces', a.assetId); mkdirSync(dir, { recursive: true }); execFileSync('unzip', ['-oq', zip, '-d', dir]); (await import('node:fs')).rmSync(zip);
      for (const f of (await import('node:fs')).readdirSync(dir)) row(join(dir, f), `${d.downloadLink} (https://ambientcg.com/view?id=${a.assetId})`, 'CC0 1.0', 'ambientCG (Lennart Demes)');
      took++; console.log('surface', q, a.assetId); }
  }
  for (const id of ['Metal034', 'Metal038', 'Metal047', 'Metal048']) { // gold and bronze leaf
    const j = await (await fetch(`https://ambientcg.com/api/v2/full_json?id=${id}&include=downloadData`)).json(); const a = j.foundAssets?.[0];
    const d = (a?.downloadFolders?.default?.downloadFiletypeCategories?.zip?.downloads ?? []).find(x => x.attribute === '2K-JPG'); if (!d) continue;
    const zip = join(HERE, 'surfaces', `${id}.zip`); if (!(await get(d.downloadLink, zip))) continue;
    const dir = join(HERE, 'surfaces', id); mkdirSync(dir, { recursive: true }); execFileSync('unzip', ['-oq', zip, '-d', dir]); (await import('node:fs')).rmSync(zip);
    for (const f of (await import('node:fs')).readdirSync(dir)) row(join(dir, f), `${d.downloadLink} (https://ambientcg.com/view?id=${id})`, 'CC0 1.0', 'ambientCG (Lennart Demes)'); console.log('surface metal', id); }
}
// 3. Freesound (API key): solo instrument recordings for the score (UD-38/39: real players) and hall impulse responses; HQ previews
async function sounds() {
  const tok = process.env.FREESOUND_TOKEN; if (!tok) { console.log('no FREESOUND_TOKEN'); return; }
  const Q = { duduk: 'duduk', ney: 'ney flute', frame_drum: 'frame drum daf', tombak: 'tombak', harp: 'harp solo', lyre: 'lyre', oud: 'oud', kamancheh: 'kamancheh', shawm: 'zurna shawm', double_pipe: 'aulos double pipe',
    finger_cymbals: 'finger cymbals', santur: 'santur', ir_hall: 'impulse response hall', ir_stone: 'impulse response church stone', ir_cave: 'impulse response cave' };
  let last = 0; const wait = async () => { const w = last + 1200 - Date.now(); if (w > 0) await new Promise(z => setTimeout(z, w)); last = Date.now(); };
  for (const [k, q] of Object.entries(Q)) { let took = 0;
    for (const lic of ['Creative Commons 0', 'Attribution', 'Attribution NonCommercial']) { if (took >= 6) break; await wait();
      const r = await fetch(`https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(q)}&filter=${encodeURIComponent(`license:"${lic}" duration:[1 TO 600]`)}&sort=rating_desc&page_size=10&fields=id,name,username,license,previews,url,duration&token=${tok}`);
      if (!r.ok) { console.log('freesound', r.status, k); continue; } const j = await r.json();
      for (const s of j.results ?? []) { if (took >= 6) break; if (/(guitar|piano|synth|electronic|loop|beat|remix|song)/i.test(s.name)) continue;
        const u = s.previews?.['preview-hq-ogg']; if (!u) continue; const f = join(HERE, 'score', k, `${s.id}_${s.name.replace(/[^\w.-]+/g, '_').slice(0, 60)}.ogg`);
        if (await get(u, f)) { row(f, `${u} (${s.url})`, s.license, s.username); took++; } }
    } console.log('sound', k, took); }
}
if (only === 'all' || only === 'plants') await plants().catch(e => console.log('plants failed', e.message));
if (only === 'all' || only === 'surfaces') await surfaces().catch(e => console.log('surfaces failed', e.message));
if (only === 'all' || only === 'sounds') await sounds().catch(e => console.log('sounds failed', e.message));
console.log('done', only);
