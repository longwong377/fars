// s18 Vagon: Poly Haven CC0 props (period-plausible: clay, brass, wood, wicker) and HDRIs (a day series, dry fields) for the cloud
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = dirname(fileURLToPath(import.meta.url)), OUT = join(HERE, 'SOURCES_MORE.md');
const row = (f, url) => { const b = readFileSync(f); if (b.length > 95 * 2 ** 20) return console.log('TOO BIG', f);
  appendFileSync(OUT, `| ${f.slice(HERE.length + 1).split(String.fromCharCode(92)).join('/')} | ${url} | CC0 1.0 | Poly Haven | ${createHash('sha256').update(b).digest('hex')} | ${(b.length / 2 ** 20).toFixed(2)} |\n`); };
const get = async (u, f) => { for (let k = 0; k < 3; k++) { try { const r = await fetch(u); if (!r.ok) return false; mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, Buffer.from(await r.arrayBuffer())); return true; } catch {} } return false; };
const props = ['antique_ceramic_vase_01', 'ceramic_pot', 'ceramic_vase_01', 'ceramic_vase_02', 'ceramic_vase_03', 'ceramic_vase_04', 'jug_01', 'planter_pot_clay', 'brass_pot_01', 'brass_pot_02',
  'brass_vase_01', 'brass_vase_02', 'brass_vase_03', 'brass_vase_04', 'brass_diya_lantern', 'wicker_basket_01', 'wicker_basket_02', 'wooden_bucket_01', 'wooden_bucket_02', 'wooden_bowl_01', 'wooden_bowl_02',
  'wooden_spoon', 'wooden_stool_01', 'wooden_stool_02', 'folding_wooden_stool', 'wooden_ladder', 'wooden_ladder_02', 'wooden_broom', 'wooden_crate_01', 'wooden_crate_02', 'spinning_wheel_01',
  'carved_wooden_plate', 'wooden_cutting_board', 'wooden_hammer_01', 'wooden_axe'];
const what = process.argv[2] ?? 'all';
if (what !== 'hdri') for (const id of props) { const j = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json(); const g = j?.gltf?.['2k']?.gltf ?? j?.gltf?.['1k']?.gltf; if (!g) { console.log('no gltf', id); continue; }
  const base = join(HERE, 'props', id); for (const [u, f] of [[g.url, join(base, g.url.split('/').pop())], ...Object.entries(g.include ?? {}).map(([p, v]) => [v.url, join(base, p)])]) if (await get(u, f)) row(f, `${u} (https://polyhaven.com/a/${id})`);
  console.log('prop', id); }
if (what !== 'props') for (const id of ['kiara_1_dawn', 'kiara_2_sunrise', 'kiara_3_morning', 'kiara_4_mid-morning', 'kiara_5_noon', 'kiara_6_afternoon', 'kiara_7_late-afternoon', 'kiara_8_sunset', 'kiara_9_dusk',
  'dry_field', 'dry_meadow', 'dry_hay_field', 'goegap', 'kloofendal_43d_clear', 'kloofendal_43d_clear_puresky', 'hausdorf_clear_sky']) {
  const j = await (await fetch(`https://api.polyhaven.com/files/${id}`)).json(); const h = j?.hdri?.['4k']?.exr ?? j?.hdri?.['4k']?.hdr ?? j?.hdri?.['2k']?.hdr; if (!h) continue;
  const res = h.url.includes('/4k/') ? h : j.hdri['2k'].hdr; const f = join(HERE, 'hdri', res.url.split('/').pop()); if (await get(res.url, f)) row(f, `${res.url} (https://polyhaven.com/a/${id})`); console.log('hdri', id); }
console.log('done', what);
