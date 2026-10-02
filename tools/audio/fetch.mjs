// Fetch the world's recordings (D-620): every item of tools/audio/fetch_list.json is resolved to recordings under an allowed
// licence, downloaded, cut, normalised and encoded into public/audio/{beds,oneshots,foot}/, then listed in
// public/audio/manifest.json (src/audio/library.ts plays them), pinned in tools/audio/fetch_lock.json (a re-run downloads the
// same files: reproducible) and credited in ASSET_LEDGER.md (one row per recording, between the D-620 markers).
//
// Sources, in order (CC0 before CC BY before CC BY-NC within each; no SA/ND unless ALLOW_SA=1):
//  1. freesound.org: the API when FREESOUND_TOKEN is set (https://freesound.org/apiv2/apply, a free key), else its search pages;
//     the HQ Ogg/MP3 preview is downloaded (no login needed).
//  2. Wikimedia Commons: the API's file search (filetype:audio), the original file.
//  3. archive.org: the advanced search (audio, a public-domain or CC BY licence URL), the item's best audio file.
// Rejected: any candidate whose title, tags or description name a modern sound or speech (the list's `reject` + the item's),
// any bed whose envelope carries speech's syllable-rate modulation (speechiness > SPEECH_MAX: no intelligible voices, §10),
// one that is too short for its use. Each item takes `variants` recordings, preferring distinct authors.
//
// Usage (Vagon, open internet; ffmpeg on PATH or `npm i --no-save ffmpeg-static`):
//   node tools/audio/fetch.mjs                 every item not yet in the lock; then encode everything in the lock
//   node tools/audio/fetch.mjs --only town_day,bark   just these keys       --refresh   re-search the given/all items
//   node tools/audio/fetch.mjs --dry           search only: print the picks, download nothing
// Then: git add -f public/audio tools/audio/fetch_lock.json ASSET_LEDGER.md; npx tsx tools/dev/sound_census.ts
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, statSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { updateManifest, ffmpegPath, ffReport, probeDur } from './common.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIST = JSON.parse(readFileSync(join(ROOT, 'tools/audio/fetch_list.json'), 'utf8'));
const LOCK_P = join(ROOT, 'tools/audio/fetch_lock.json');
const UA = 'PARSA-time-capsule/1.0 (personal non-commercial project; https://github.com/longwong377/fars) node-fetch';
export const SPEECH_MAX = 5.5;
const arg = n => process.argv.includes(n), argv = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
const ONLY = argv('--only')?.split(',') ?? null, REFRESH = arg('--refresh'), DRY = arg('--dry'), ALLOW_SA = process.env.ALLOW_SA === '1';
const TMP = join(tmpdir(), 'fars-audio-fetch'); mkdirSync(TMP, { recursive: true });

// ------------------------------------------------------------------------------------------------ licences, words
/** a licence string or URL → 'CC0' | 'CC BY' | 'CC BY-NC' | (with ALLOW_SA) 'CC BY-SA' | 'CC BY-NC-SA' | null (refused) */
export function licenceClass(s) {
  const t = String(s ?? '').toLowerCase();
  if (/publicdomain\/zero|cc0|creative commons 0|\bpublic domain\b|publicdomain\/mark|\bpd\b/.test(t)) return 'CC0';
  const nd = /-nd|noderiv|no deriv/.test(t), sa = /-sa|sharealike|share alike/.test(t), nc = /-nc|noncommercial|non-commercial|non commercial/.test(t);
  if (nd || /sampling/.test(t)) return null;
  if (!/(cc[- ]by|licenses\/by|attribution)/.test(t)) return null;
  if (sa) return ALLOW_SA ? (nc ? 'CC BY-NC-SA' : 'CC BY-SA') : null;
  return nc ? 'CC BY-NC' : 'CC BY';
}
const LIC_RANK = { 'CC0': 0, 'CC BY': 1, 'CC BY-NC': 2, 'CC BY-SA': 3, 'CC BY-NC-SA': 4 };
const norm = s => ' ' + String(s ?? '').toLowerCase().replace(/<[^>]*>/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
/** the reject words (whole words or phrases) a candidate's text names */
export function rejectedBy(text, words) { const t = norm(text); return words.filter(w => t.includes(norm(w))); }

// ------------------------------------------------------------------------------------------------ http
async function get(url, as = 'text', tries = 3) {
  for (let k = 0; k < tries; k++) {
    try { const r = await fetch(url, { headers: { 'User-Agent': UA } }); if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`); if (!r.ok) return null;
      return as === 'json' ? await r.json() : as === 'buf' ? Buffer.from(await r.arrayBuffer()) : await r.text(); }
    catch (e) { if (k === tries - 1) { console.warn('  !', url.slice(0, 120), String(e.message ?? e)); return null; } await new Promise(z => setTimeout(z, 2000 * 2 ** k)); }
  }
  return null;
}

// ------------------------------------------------------------------------------------------------ sources
/** freesound: the API (token) or the search pages; candidates { src, id, title, text, licence, author, page, audio, dur } */
async function freesound(q, minDur, maxDur) {
  const out = [], tok = process.env.FREESOUND_TOKEN;
  for (const lic of ['Creative Commons 0', 'Attribution', 'Attribution NonCommercial']) {
    if (tok) {
      const f = encodeURIComponent(`license:"${lic}" duration:[${minDur} TO ${maxDur}]`);
      const j = await get(`https://freesound.org/apiv2/search/text/?query=${encodeURIComponent(q)}&filter=${f}&sort=rating_desc&page_size=25&fields=id,name,tags,description,license,username,duration,previews,url,avg_rating,num_downloads&token=${tok}`, 'json');
      for (const s of j?.results ?? []) out.push({ src: 'freesound', id: String(s.id), title: s.name, text: `${s.name} ${(s.tags ?? []).join(' ')} ${s.description ?? ''}`, licence: licenceClass(s.license), author: s.username, page: s.url, audio: s.previews?.['preview-hq-ogg'] ?? s.previews?.['preview-hq-mp3'], dur: s.duration, score: (s.avg_rating ?? 3) + Math.log10(1 + (s.num_downloads ?? 0)) });
    } else {
      const html = await get(`https://freesound.org/search/?q=${encodeURIComponent(q)}&f=${encodeURIComponent(`license:"${lic}"`)}&s=${encodeURIComponent('Downloads (most first)')}`);
      const ids = [...new Set([...(html ?? '').matchAll(/href="\/people\/([^/"]+)\/sounds\/(\d+)\/"/g)].map(m => `${m[1]}/${m[2]}`))].slice(0, 12);
      for (const [rank, pi] of ids.entries()) {
        const [user, id] = pi.split('/'), page = `https://freesound.org/people/${user}/sounds/${id}/`, h = await get(page); if (!h) continue;
        const audio = /<meta property="og:audio" content="([^"]+)"/.exec(h)?.[1] ?? /(https:\/\/cdn\.freesound\.org\/previews\/[^"']+-hq\.(?:ogg|mp3))/.exec(h)?.[1];
        const licUrl = /(https?:\/\/creativecommons\.org\/[^"' ]+)/.exec(h)?.[1] ?? lic, title = /<meta property="og:title" content="([^"]+)"/.exec(h)?.[1] ?? id;
        const tags = [...h.matchAll(/\/browse\/tags\/([^/"?]+)\//g)].map(m => decodeURIComponent(m[1])).join(' '), desc = /<meta (?:name|property)="(?:og:)?description" content="([^"]*)"/.exec(h)?.[1] ?? '';
        const dur = parseFloat(/data-duration="([\d.]+)"/.exec(h)?.[1] ?? /"duration":\s*([\d.]+)/.exec(h)?.[1] ?? 'NaN');
        if (audio) out.push({ src: 'freesound', id, title, text: `${title} ${tags} ${desc}`, licence: licenceClass(licUrl), author: user, page, audio, dur: Number.isFinite(dur) ? dur : null, score: 4 - rank * 0.1 });
      }
    }
  }
  return out;
}
async function commons(q) {
  const u = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=25&gsrsearch=${encodeURIComponent(`${q} filetype:audio`)}&prop=imageinfo&iiprop=url|extmetadata|size|mediatype&iiextmetadatafilter=LicenseShortName|LicenseUrl|Artist|ImageDescription|Categories`;
  const j = await get(u, 'json'), out = [];
  for (const p of Object.values(j?.query?.pages ?? {})) {
    const ii = p.imageinfo?.[0]; if (!ii) continue; const m = ii.extmetadata ?? {}, v = k => m[k]?.value ?? '';
    out.push({ src: 'commons', id: p.title, title: p.title.replace(/^File:/, ''), text: `${p.title} ${v('ImageDescription')} ${v('Categories')}`, licence: licenceClass(`${v('LicenseShortName')} ${v('LicenseUrl')}`), author: norm(v('Artist')).trim() || 'Wikimedia Commons contributor', page: ii.descriptionurl, audio: ii.url, dur: ii.duration ?? null, score: 3 - (p.index ?? 0) * 0.05 });
  }
  return out;
}
async function archive(q) {
  const s = `(${q}) AND mediatype:(audio) AND (licenseurl:*publicdomain* OR licenseurl:*licenses/by/* OR licenseurl:*licenses/by-nc/*)`;
  const j = await get(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(s)}&fl[]=identifier&fl[]=title&fl[]=licenseurl&fl[]=creator&fl[]=subject&fl[]=description&rows=10&output=json`, 'json'), out = [];
  for (const d of j?.response?.docs ?? []) {
    const meta = await get(`https://archive.org/metadata/${d.identifier}`, 'json'); if (!meta?.files) continue;
    const f = meta.files.filter(f => /\.(flac|wav|ogg|mp3)$/i.test(f.name) && !/_spectrogram|sample/i.test(f.name)).sort((a, b) => (/(flac|wav)$/i.test(b.name) ? 1 : 0) - (/(flac|wav)$/i.test(a.name) ? 1 : 0))[0]; if (!f) continue;
    out.push({ src: 'archive', id: `${d.identifier}/${f.name}`, title: d.title ?? d.identifier, text: `${d.title} ${[].concat(d.subject ?? []).join(' ')} ${[].concat(d.description ?? []).join(' ')}`, licence: licenceClass(d.licenseurl), author: [].concat(d.creator ?? ['archive.org uploader']).join(', '), page: `https://archive.org/details/${d.identifier}`, audio: `https://archive.org/download/${d.identifier}/${encodeURIComponent(f.name)}`, dur: f.length ? parseFloat(f.length) : null, score: 2 });
  }
  return out;
}

// ------------------------------------------------------------------------------------------------ audio
const FF = () => ffmpegPath();
function ff(args) { const r = spawnSync(FF(), ['-hide_banner', '-v', 'error', '-y', ...args], { encoding: 'utf8', maxBuffer: 1 << 28 }); if (r.status !== 0) throw new Error(`ffmpeg: ${r.stderr?.slice(-400)}`); }
/** decode to mono float PCM at a rate */
function pcm(file, rate = 16000, from = 0, len = 0) {
  const a = ['-hide_banner', '-v', 'error', ...(from ? ['-ss', String(from)] : []), '-i', file, ...(len ? ['-t', String(len)] : []), '-ac', '1', '-ar', String(rate), '-f', 'f32le', '-'];
  const r = spawnSync(FF(), a, { maxBuffer: 1 << 30 }); if (r.status !== 0) throw new Error('decode failed'); const b = r.stdout; return new Float32Array(b.buffer, b.byteOffset, b.length >> 2);
}
/** speech's fingerprint (a screen, not a proof; C): the median over 4 s windows of the syllable-rate (3-7 Hz) modulation of the
 *  speech band's (250-900 Hz, where the voice's first formant and voicing carry) loudness envelope, in dB rms. Measured on
 *  this project's own speech clips (public/voices, 48 s): 11.0; the same under pink noise at -10 dB: 6.9; pink and brown
 *  noise 0.6, a wind swell 1.9, crickets at 4.5 kHz 4.7, a dog barking every 7 s 5.1. SPEECH_MAX 5.5 rejects talk that can
 *  be followed and keeps the beds' animals and insects */
export function speechiness(x, rate = 16000) {
  const bq = (type, f, q) => { const w = 2 * Math.PI * f / rate, c = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
    const [b0, b1, b2] = type === 'bp' ? [al, 0, -al] : type === 'lp' ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : [(1 + c) / 2, -(1 + c), (1 + c) / 2];
    return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: -2 * c / a0, a2: (1 - al) / a0, x1: 0, x2: 0, y1: 0, y2: 0 }; };
  const run = (f, x) => { const y = f.b0 * x + f.b1 * f.x1 + f.b2 * f.x2 - f.a1 * f.y1 - f.a2 * f.y2; f.x2 = f.x1; f.x1 = x; f.y2 = f.y1; f.y1 = y; return y; };
  const band = [bq('hp', 250, 0.7), bq('hp', 250, 0.7), bq('lp', 900, 0.7), bq('lp', 900, 0.7)], sm = bq('lp', 25, 0.7), env = [], step = rate / 100;
  for (let i = 0; i < x.length; i++) { let v = x[i]; for (const f of band) v = run(f, v); const e = run(sm, v * v); if (i % step < 1) env.push(10 * Math.log10(Math.max(e, 1e-10))); }
  const m = (() => { const w = 2 * Math.PI * 4.6 / 100, c = Math.cos(w), al = Math.sin(w) / 2.2, a0 = 1 + al; return { b0: al / a0, b1: 0, b2: -al / a0, a1: -2 * c / a0, a2: (1 - al) / a0, x1: 0, x2: 0, y1: 0, y2: 0 }; })();
  const z = env.map(v => run(m, v)).slice(100), W = 400, win = [];
  for (let s = 0; s + W <= z.length; s += W) { let a = 0; for (let i = s; i < s + W; i++) a += z[i] * z[i]; win.push(Math.sqrt(a / W)); }
  if (!win.length) return 0; win.sort((a, b) => a - b); return win[Math.floor(win.length / 2)];
}
/** events separated by silence (s): [start, end] pairs between minLen and maxLen, loudest first */
function events(file, minLen, maxLen) {
  const x = pcm(file, 16000); let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v)); if (pk <= 0) return [];
  const fr = 160, rms = []; for (let i = 0; i + fr <= x.length; i += fr) { let s = 0; for (let j = 0; j < fr; j++) s += x[i + j] ** 2; rms.push(Math.sqrt(s / fr) / pk); }
  const floor = [...rms].sort((a, b) => a - b)[Math.floor(rms.length * 0.2)] ?? 0, thr = Math.max(floor * 4, 0.03), out = [];
  for (let i = 0; i < rms.length;) { if (rms[i] < thr) { i++; continue; } let j = i, peak = 0; while (j < rms.length && (rms[j] >= thr * 0.5 || (j + 1 < rms.length && rms[j + 1] >= thr))) { peak = Math.max(peak, rms[j]); j++; }
    const a = Math.max(0, i * 0.01 - 0.03), b = j * 0.01 + 0.12; if (b - a >= minLen && b - a <= maxLen) out.push({ a, b, peak }); i = j + 1; }
  return out.sort((p, q) => q.peak - p.peak);
}
const sha = b => createHash('sha256').update(b).digest('hex');

// ------------------------------------------------------------------------------------------------ resolve, process
async function candidates(item) {
  const isBed = item.section === 'beds', minDur = isBed ? Math.min(60, item.take ?? 120) : 0.2, maxDur = isBed ? 3600 : 60, words = [...LIST.reject, ...(item.reject ?? [])];
  const seen = new Set(), all = [];
  for (const q of item.q) {
    for (const src of [() => freesound(q, minDur, maxDur), () => commons(q), () => archive(q)]) {
      for (const c of await src()) { if (seen.has(c.src + c.id)) continue; seen.add(c.src + c.id);
        c.q = q; c.rejected = !c.licence ? ['licence'] : rejectedBy(c.text, words); if (c.dur != null && (c.dur < minDur || c.dur > maxDur)) c.rejected.push(`length ${c.dur}`); all.push(c); }
    }
    if (all.filter(c => !c.rejected.length).length >= item.variants * 3) break;
  }
  return all.filter(c => !c.rejected.length).sort((a, b) => (LIC_RANK[a.licence] - LIC_RANK[b.licence]) || (b.score - a.score));
}
/** download and check one candidate; returns the lock entry or null */
async function take(item, c) {
  const raw = await get(c.audio, 'buf'); if (!raw || raw.length < 2000) return null;
  const ext = (/\.(ogg|mp3|wav|flac|oga|opus)(\?|$)/i.exec(c.audio)?.[1] ?? 'bin').toLowerCase(), f = join(TMP, `${sha(raw).slice(0, 16)}.${ext}`); writeFileSync(f, raw);
  const dur = probeDur(f); if (!(dur > 0)) return null;
  const e = { key: item.key, section: item.section, src: c.src, id: c.id, title: c.title, licence: c.licence, author: c.author, page: c.page, audio: c.audio, sha256: sha(raw), dur: +dur.toFixed(2), q: c.q };
  if (item.section === 'beds') {
    if (dur < Math.min(60, item.take ?? 120)) return null;
    const sp = speechiness(pcm(f, 16000, Math.min(2, dur * 0.05), Math.min(90, dur))); e.speechiness = +sp.toFixed(3);
    if (sp > SPEECH_MAX) { console.log(`   reject ${c.src} ${c.id}: speechiness ${sp.toFixed(2)}`); return null; }
  }
  return e;
}
function encode(item, lockEntries) {
  const dirS = { beds: 'beds', oneshots: 'oneshots', foot: 'foot' }[item.section], outDir = join(ROOT, 'public/audio', dirS); mkdirSync(outDir, { recursive: true });
  const recs = [];
  // the item's old files go first (a re-run with fewer variants leaves none behind)
  for (const f of readdirSync(outDir)) if (f.startsWith(`${item.key}_`) && /^\d/.test(f.slice(item.key.length + 1))) rmSync(join(outDir, f));
  for (const [vi, e] of lockEntries.entries()) {
    const src = join(TMP, `${e.sha256.slice(0, 16)}.${(/\.(ogg|mp3|wav|flac|oga|opus)(\?|$)/i.exec(e.audio)?.[1] ?? 'bin').toLowerCase()}`);
    if (!existsSync(src)) { console.warn(`   missing download for ${e.key} (${e.id}): run without --encode-only`); continue; }
    const base = { src: `${e.src}:${e.id}`, licence: e.licence, author: e.author, url: e.page };
    const dur = probeDur(src);
    if (item.section === 'beds') {
      const len = Math.max(1, Math.min(item.take ?? 120, dur - 4)), from = dur > len + 4 ? 2 : 0, mid = join(TMP, 'bed.wav'), file = `${dirS}/${item.key}_${vi}.ogg`, dst = join(ROOT, 'public/audio', file);
      ff(['-ss', String(from), '-t', String(len), '-i', src, '-af', 'highpass=f=40,aresample=48000', '-ac', '2', '-c:a', 'pcm_f32le', mid]);
      const m = JSON.parse(/\{[^{}]*"input_i"[^{}]*\}/s.exec(ffReport(FF(), ['-i', mid, '-af', 'loudnorm=I=-23:TP=-2:LRA=20:print_format=json', '-f', 'null', '-']))?.[0] ?? '{}');
      const ln = m.input_i ? `loudnorm=I=-23:TP=-2:LRA=20:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true` : 'loudnorm=I=-23:TP=-2';
      ff(['-i', mid, '-af', `${ln},afade=t=in:d=0.5,areverse,afade=t=in:d=0.5,areverse`, '-ar', '48000', '-c:a', 'libopus', '-b:a', '48k', dst]); rmSync(mid);
      recs.push({ file, dur: +probeDur(dst).toFixed(2), bytes: statSync(dst).size, lufs: -23, ...base });
    } else {
      const ev = events(src, 0.06, item.max ?? 6), want = Math.ceil(item.variants / lockEntries.length) + 1;
      for (const [k, v] of ev.slice(0, want).entries()) {
        if (recs.length >= item.variants) break;
        const file = `${dirS}/${item.key}_${vi}_${k}.ogg`, dst = join(ROOT, 'public/audio', file), mid = join(TMP, 'shot.wav');
        ff(['-ss', v.a.toFixed(3), '-t', (v.b - v.a).toFixed(3), '-i', src, '-af', 'highpass=f=30,aresample=48000', '-ac', '1', '-c:a', 'pcm_f32le', mid]);
        const pk = +(/max_volume: (-?[\d.]+) dB/.exec(ffReport(FF(), ['-i', mid, '-af', 'volumedetect', '-f', 'null', '-']))?.[1] ?? 0);
        ff(['-i', mid, '-af', `volume=${(-3 - pk).toFixed(2)}dB,afade=t=in:d=0.005,areverse,afade=t=in:d=0.06,areverse`, '-ar', '48000', '-c:a', 'libopus', '-b:a', '40k', dst]); rmSync(mid);
        recs.push({ file, dur: +(v.b - v.a).toFixed(3), bytes: statSync(dst).size, ...base });
      }
    }
  }
  return item.section === 'beds' ? recs : recs.slice(0, Math.max(item.variants, 1));
}

// ------------------------------------------------------------------------------------------------ ledger
function ledger(lock) {
  const p = join(ROOT, 'ASSET_LEDGER.md'), B = '<!-- D-620 recordings: begin (tools/audio/fetch.mjs writes this block) -->', E = '<!-- D-620 recordings: end -->';
  const rows = Object.values(lock.items).flat().map(e => `| Recording \`${e.key}\` (${e.section}; public/audio/${e.section}/${e.key}_*.ogg) | ${e.src}: [${String(e.title).replace(/\|/g, '/')}](${e.page}) sha256 ${e.sha256.slice(0, 12)} | ${e.licence} | ${String(e.author).replace(/\|/g, '/')} | C (a present-day recording standing for the period's sound) |`);
  const block = `${B}\n\n## Recorded sound (D-620)\n| Asset | Source | Licence | Credit | Tier |\n|---|---|---|---|---|\n${rows.join('\n')}\n\n${E}`;
  let s = readFileSync(p, 'utf8'); s = s.includes(B) ? s.replace(new RegExp(`${B}[\\s\\S]*?${E}`), block) : s.trimEnd() + '\n\n' + block + '\n'; writeFileSync(p, s);
}

// ------------------------------------------------------------------------------------------------ main
async function main() {
  const lock = existsSync(LOCK_P) ? JSON.parse(readFileSync(LOCK_P, 'utf8')) : { note: 'D-620: the recordings tools/audio/fetch.mjs resolved (re-runs download these; --refresh re-searches)', items: {} };
  const items = LIST.items.filter(it => !ONLY || ONLY.includes(it.key)), failed = [];
  for (const item of items) {
    let have = lock.items[item.key] ?? [];
    const want = item.section === 'beds' ? item.variants : Math.min(item.variants, 3); // one-shot variants come from events within a recording
    if (REFRESH || have.length < want) {
      console.log(`${item.section}/${item.key}: searching (${item.q.join(' | ')})`);
      const cs = await candidates(item), picked = [...(REFRESH ? [] : have)], authors = new Set(picked.map(e => e.author));
      const order = [...cs.filter(c => !authors.has(c.author)), ...cs.filter(c => authors.has(c.author))];
      for (const c of order) { if (picked.length >= want) break; if (picked.some(e => e.src === c.src && e.id === c.id)) continue;
        if (DRY) { console.log(`   would take ${c.licence} ${c.src} ${c.id} "${c.title}" by ${c.author}`); picked.push({ ...c, sha256: '' }); continue; }
        const e = await take(item, c); if (e) { picked.push(e); authors.add(e.author); console.log(`   took ${e.licence} ${e.src} ${e.id} "${e.title}" by ${e.author} (${e.dur} s${e.speechiness != null ? `, speechiness ${e.speechiness}` : ''})`); } }
      if (!DRY) have = lock.items[item.key] = picked;
      if (picked.length < 1) failed.push(item.key);
    } else {
      // in the lock: make sure the download is here (and unchanged)
      for (const e of have) { const ext = (/\.(ogg|mp3|wav|flac|oga|opus)(\?|$)/i.exec(e.audio)?.[1] ?? 'bin').toLowerCase(), f = join(TMP, `${e.sha256.slice(0, 16)}.${ext}`);
        if (!existsSync(f)) { const raw = await get(e.audio, 'buf'); if (raw && sha(raw) === e.sha256) writeFileSync(f, raw); else console.warn(`   ${item.key}: ${e.id} changed or gone at the source (re-run with --only ${item.key} --refresh)`); } }
    }
    if (!DRY) writeFileSync(LOCK_P, JSON.stringify(lock, null, 1) + '\n');
  }
  if (DRY) return;
  // encode everything in the lock that the list still names
  const sections = { beds: {}, oneshots: {}, foot: {} };
  for (const item of LIST.items) { const es = lock.items[item.key]; if (!es?.length) continue; try { const recs = encode(item, es); if (recs.length) sections[item.section][item.key] = recs; } catch (err) { console.warn(`   ${item.key}: encode failed: ${err.message}`); failed.push(item.key); } }
  for (const [s, v] of Object.entries(sections)) updateManifest(ROOT, s, v, !ONLY);
  ledger(lock);
  const bytes = Object.values(sections).flatMap(o => Object.values(o).flat()).reduce((a, r) => a + r.bytes, 0);
  console.log(`\n${Object.values(sections).reduce((a, o) => a + Object.keys(o).length, 0)} sets encoded, ${(bytes / 2 ** 20).toFixed(1)} MB; failed or empty: ${[...new Set(failed)].join(', ') || 'none'}`);
  console.log('next: npx tsx tools/dev/sound_census.ts; git add -f public/audio tools/audio/fetch_lock.json ASSET_LEDGER.md');
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main().catch(e => { console.error(e); process.exit(1); });
