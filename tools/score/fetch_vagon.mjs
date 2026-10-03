// What the score needs that the cloud cannot reach (D-760), fetched on Vagon (open internet, FREESOUND_TOKEN in the env):
//  - a recorded concert-hall impulse response, to replace the score's modelled hall (tools/score/build.ts uses
//    tools/score/ext/ir/hall.wav when it exists);
//  - frame-drum strokes (low open stroke, rim, finger rolls) for the score's sparing period colour (tools/score/orchestra.ts
//    kit maps them when tools/score/ext/drums/ holds them).
// Not fetched, by design: duduk, ney, oud or santur recordings (the brief's §11 cliché ban; D-760).
// Freesound API v2 with token auth: search, then the HQ preview (OGG ~192 kbps; the original download needs OAuth). Licences
// CC0 first, then CC-BY (credited); anything else is skipped. Writes tools/score/ext/{ir,drums}/, ext/licences.json (one
// row per file: id, name, author, licence, url) for ASSET_LEDGER, and prints the sizes (expect under 10 MB in all).
//   FREESOUND_TOKEN=... node tools/score/fetch_vagon.mjs        then commit tools/score/ext (git add -f) and push.
import { mkdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const TOKEN = process.env.FREESOUND_TOKEN; if (!TOKEN) { console.error('FREESOUND_TOKEN is not set'); process.exit(1); }
const EXT = resolve(import.meta.dirname, 'ext'), API = 'https://freesound.org/apiv2';
const OK = l => /creativecommons\.org\/(publicdomain\/zero|licenses\/by\/)/.test(l); // CC0 or CC-BY (no NC, no sampling+)
const rows = [];

async function search(query, filter, n) {
  const u = `${API}/search/text/?query=${encodeURIComponent(query)}&filter=${encodeURIComponent(filter)}&fields=id,name,username,license,previews,duration,url,avg_rating,num_downloads&sort=rating_desc&page_size=40&token=${TOKEN}`;
  const r = await fetch(u); if (!r.ok) throw new Error(`${r.status} ${query}`); const j = await r.json();
  return j.results.filter(x => OK(x.license)).sort((a, b) => (b.license.includes('zero') - a.license.includes('zero')) || (b.num_downloads - a.num_downloads)).slice(0, n);
}
async function take(dir, name, x) {
  mkdirSync(dir, { recursive: true });
  const src = x.previews['preview-hq-ogg'] ?? x.previews['preview-hq-mp3'], ogg = join(dir, `${name}.src`), wav = join(dir, `${name}.wav`);
  const r = await fetch(src); writeFileSync(ogg, Buffer.from(await r.arrayBuffer()));
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', ogg, '-ar', '48000', '-c:a', 'pcm_f32le', wav]);
  rows.push({ file: wav.replace(EXT + '/', ''), id: x.id, name: x.name, author: x.username, licence: x.license, url: x.url });
  console.log(`${name}: ${x.name} by ${x.username} (${x.license.includes('zero') ? 'CC0' : 'CC-BY'})`);
}

// the hall: a concert hall or large church, stereo, 2-8 s
const irs = await search('impulse response concert hall', 'duration:[2 TO 10] channels:2', 4);
if (irs[0]) await take(join(EXT, 'ir'), 'hall', irs[0]);
for (let i = 1; i < irs.length; i++) await take(join(EXT, 'ir'), `hall_alt${i}`, irs[i]);
// the frame drum: the low open stroke, the rim, a roll (one-shots under 4 s)
for (const [q, name, n] of [['frame drum low hit', 'frame_low', 4], ['frame drum rim tak', 'frame_rim', 4], ['frame drum roll', 'frame_roll', 2]]) {
  const hits = await search(q, 'duration:[0.1 TO 4]', n);
  for (let i = 0; i < hits.length; i++) await take(join(EXT, 'drums'), `${name}_${i + 1}`, hits[i]);
}
writeFileSync(join(EXT, 'licences.json'), JSON.stringify(rows, null, 1) + '\n');
let bytes = 0; for (const r of rows) bytes += statSync(join(EXT, r.file)).size;
console.log(`${rows.length} files, ${(bytes / 1048576).toFixed(1)} MB in tools/score/ext (WAV; the score build reads them). ASSET_LEDGER rows: tools/score/ext/licences.json`);
