// Builds the score (D-760; UD-38, UD-39): every cue in tools/score/cues is performed (lib/write.ts), each part rendered
// through its recorded instrument (sfizz for the SFZ libraries, fluidsynth for the soundfont), placed on the stage, sent
// into the hall, mixed, mastered to the cue's loudness and encoded for the web (Ogg Opus, and AAC for browsers without Opus
// in Ogg). Output: public/audio/score/<id>.ogg|.m4a and public/audio/score/manifest.json (the director's catalogue).
//
//   npx tsx tools/score/build.ts [cueId ...]      (all cues without arguments)
//   env: SCORE_LIB (the libraries: sso/, vsco/; tools/score/fetch.sh puts them there), SFIZZ_RENDER, SF3, SCORE_WORK
//        (stems cache), SCORE_WAV=1 (keep the master WAV next to the encodes, for listening), SCORE_ONLY_MIX=1 (skip encode)
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { midiBytes } from './lib/midi';
import { readWav, writeWav } from './lib/wav';
import { biquad, compress, convolve, db, limit, lufs, rng, truePeak } from './lib/dsp';
import { perform, type Cue, type Part } from './lib/write';
import { ORCH, kitSfz, type Inst } from './orchestra';

const ROOT = resolve(import.meta.dirname, '../..');
const LIB = process.env.SCORE_LIB ?? join(homedir(), '.cache/parsa-score');
const SSO = join(LIB, 'sso/Sonatina Symphonic Orchestra'), VSCO = join(LIB, 'vsco');
const SFIZZ = process.env.SFIZZ_RENDER ?? join(LIB, 'sfizz/build/library/bin/sfizz_render');
const SF3 = process.env.SF3 ?? '/usr/share/sounds/sf3/MuseScore_General.sf3';
const WORK = process.env.SCORE_WORK ?? join(LIB, 'work');
const OUT = join(ROOT, 'public/audio/score');
const SR = 48000;
mkdirSync(WORK, { recursive: true }); mkdirSync(OUT, { recursive: true });

// --------------------------------------------------------------------------------------------------------- rendering
const kitPath = join(WORK, 'kit.sfz');
writeFileSync(kitPath, kitSfz(VSCO));
function sfzOf(p: Part): string {
  const I: Inst = ORCH[p.inst];
  if (I.src.kit) return kitPath;
  const rel = I.src.sso?.[p.art]; if (!rel) throw new Error(`${p.id}: ${p.inst} has no ${p.art}`);
  return join(SSO, rel);
}
/** one part's stem (cached by what it is made of) */
function stem(p: Part, cue: Cue, seed: number): { L: Float32Array; R: Float32Array } {
  const I: Inst = ORCH[p.inst], mp = perform(p, cue.tempo, seed);
  if (I.src.sf) mp.program = I.src.sf.program;
  const mid = midiBytes(mp), src = I.src.sf ? SF3 : sfzOf(p);
  const key = createHash('sha1').update(mid).update(src).update(I.src.sf ? 'fs1' : 'sfz1').digest('hex').slice(0, 16);
  const wav = join(WORK, `${cue.id}.${p.id}.${key}.wav`);
  if (!existsSync(wav)) {
    const midPath = wav.replace(/\.wav$/, '.mid'); writeFileSync(midPath, mid);
    if (I.src.sf) execFileSync('fluidsynth', ['-ni', '-q', '-R', '0', '-C', '0', '-g', '1.0', '-r', String(SR), '-F', wav, src, midPath], { stdio: 'pipe' });
    else execFileSync(SFIZZ, ['--sfz', src, '--midi', midPath, '--wav', wav, '-s', String(SR), '-q', '3', '-p', '128', '--use-eot'], { stdio: 'pipe' });
  }
  const a = readWav(wav); if (a.sr !== SR) throw new Error(`${wav}: ${a.sr} Hz`);
  return { L: a.ch[0], R: a.ch[1] ?? a.ch[0] };
}

// -------------------------------------------------------------------------------------------------------------- the hall
/** a scoring stage's response (C: no measured hall IR is reachable from the cloud; a recorded one replaces this file when
 *  Vagon fetches it, tools/score/fetch_vagon.mjs): early reflections from the walls in the first 80 ms, then a diffuse
 *  tail whose decay is longer in the bass (RT60 3.1 s) than the treble (1.5 s above 5 kHz), four decorrelated channels */
function hallIR(seed: number, rtLow = 3.1, rtMid = 2.5, rtHigh = 1.5, len = 4.2): Float32Array {
  const n = Math.round(len * SR), R = rng(seed), w = () => R() * 2 - 1;
  const band = (rt: number) => { const x = new Float32Array(n); for (let i = 0; i < n; i++) x[i] = w() * Math.exp((-6.91 * i) / (rt * SR)); return x; };
  const lo = biquad(biquad(band(rtLow), SR, 'lp', 350), SR, 'lp', 350);
  const mid = biquad(biquad(band(rtMid), SR, 'hp', 350), SR, 'lp', 4500);
  const hi = biquad(biquad(band(rtHigh), SR, 'hp', 4500), SR, 'lp', 11000);
  const h = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR, fade = Math.min(1, Math.max(0, (t - 0.018) / 0.06)); h[i] = (lo[i] * 1.1 + mid[i] + hi[i] * 0.8) * fade * fade; }
  for (let k = 0; k < 14; k++) { const t = 0.009 + R() * 0.07, i = Math.round(t * SR); h[i] += (R() < 0.5 ? -1 : 1) * (0.9 - t * 7) * 2.2; }
  let e = 0; for (let i = 0; i < n; i++) e += h[i] * h[i]; const g = 1 / Math.sqrt(e); for (let i = 0; i < n; i++) h[i] *= g;
  return h;
}

// ---------------------------------------------------------------------------------------------------------------- mix
function mixCue(cue: Cue) {
  const t0 = Date.now(), len = Math.round((cue.seconds + 6) * SR);
  const dryL = new Float32Array(len), dryR = new Float32Array(len), sendL = new Float32Array(len), sendR = new Float32Array(len);
  const report: string[] = [];
  cue.parts.forEach((p, i) => {
    const I: Inst = ORCH[p.inst], s = stem(p, cue, 1000 + i * 7919 + cue.id.length);
    const pan = p.pan ?? I.pan, depth = p.depth ?? I.depth, width = I.width;
    // distance: a little less level and air the further back; the hall send grows with it
    let L = s.L, Rr = s.R;
    if (depth > 0.2) { L = biquad(L, SR, 'highshelf', 6000, 0.7, -5 * depth); Rr = biquad(Rr, SR, 'highshelf', 6000, 0.7, -5 * depth); }
    const g = db((p.gain ?? 0) + I.trim - 4 * depth + 26), a = ((pan + 1) * Math.PI) / 4, gl = Math.cos(a) * Math.SQRT2, gr = Math.sin(a) * Math.SQRT2;
    const send = 0.18 + 0.75 * depth, n = Math.min(len, L.length); let pk = 0;
    for (let k = 0; k < n; k++) {
      const m = (L[k] + Rr[k]) / 2, sd = ((L[k] - Rr[k]) / 2) * width, l = (m + sd) * gl * g, r = (m - sd) * gr * g;
      dryL[k] += l; dryR[k] += r; sendL[k] += l * send; sendR[k] += r * send; pk = Math.max(pk, Math.abs(l), Math.abs(r));
    }
    report.push(`${p.id.padEnd(14)} ${p.inst}/${p.art} peak ${(20 * Math.log10(pk + 1e-9)).toFixed(1)} dB`);
    if (pk < 1e-4) throw new Error(`${cue.id}/${p.id}: the stem is silent`);
  });
  const [ia, ib, ic, id] = [11, 23, 37, 41].map(s => hallIR(s));
  const wl = convolve(sendL, ia), wr = convolve(sendR, ib), xl = convolve(sendR, ic), xr = convolve(sendL, id), wet = 0.55;
  let L = new Float32Array(len), R = new Float32Array(len);
  for (let k = 0; k < len; k++) { L[k] = dryL[k] + wet * (wl[k] + 0.45 * xl[k]); R[k] = dryR[k] + wet * (wr[k] + 0.45 * xr[k]); }
  // the master: a warm tilt, the glue, the level, the ceiling
  L = <any>biquad(biquad(L, SR, 'lowshelf', 90, 0.7, 1.5), SR, 'highshelf', 9000, 0.7, 1.0); R = <any>biquad(biquad(R, SR, 'lowshelf', 90, 0.7, 1.5), SR, 'highshelf', 9000, 0.7, 1.0);
  L = <any>biquad(L, SR, 'hp', 24, 0.7); R = <any>biquad(R, SR, 'hp', 24, 0.7);
  let ch = compress([L, R], SR, { thr: -20, ratio: 1.8, att: 0.03, rel: 0.35, knee: 8 });
  const target = cue.lufs ?? -18, now = lufs(ch, SR), gain = db(target - now);
  ch = ch.map(c => c.map(x => x * gain));
  ch = limit(ch, SR, -1.5);
  // fade the tail to silence over the last 3 s
  const fadeN = 3 * SR; for (const c of ch) for (let k = 0; k < fadeN; k++) c[len - 1 - k] *= k / fadeN;
  const meas = { lufs: +lufs(ch, SR).toFixed(1), tp: +truePeak(ch).toFixed(1) };
  console.log(`${cue.id}: ${cue.parts.length} parts, ${cue.seconds.toFixed(1)} s, ${meas.lufs} LUFS, ${meas.tp} dBTP (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  if (process.env.SCORE_VERBOSE) console.log(report.join('\n'));
  return { ch, meas };
}

// ------------------------------------------------------------------------------------------------------------- encode
function encode(cue: Cue, ch: Float32Array[], meas: { lufs: number; tp: number }) {
  const wav = join(WORK, `${cue.id}.master.wav`); writeWav(wav, { sr: SR, ch });
  if (process.env.SCORE_WAV) writeWav(join(OUT, `${cue.id}.wav`), { sr: SR, ch });
  const ogg = join(OUT, `${cue.id}.ogg`), m4a = join(OUT, `${cue.id}.m4a`), br = cue.tags.includes('main') ? '128k' : '96k';
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', wav, '-c:a', 'libopus', '-b:a', br, '-vbr', 'on', '-application', 'audio', '-metadata', `title=${cue.title}`, '-metadata', 'artist=PĀRSA score', ogg]);
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', wav, '-c:a', 'aac', '-b:a', br, '-movflags', '+faststart', '-metadata', `title=${cue.title}`, m4a]);
  return { ogg: statSync(ogg).size, m4a: statSync(m4a).size, ...meas };
}

// --------------------------------------------------------------------------------------------------------------- main
const cueFiles = readdirSync(join(import.meta.dirname, 'cues')).filter(f => f.endsWith('.ts')).sort();
const want = new Set(process.argv.slice(2));
const manPath = join(OUT, 'manifest.json');
const manifest: { cues: Record<string, any> } = existsSync(manPath) ? JSON.parse(readFileSync(manPath, 'utf8')) : { cues: {} };
for (const f of cueFiles) {
  const mod = await import(join(import.meta.dirname, 'cues', f));
  const cues: Cue[] = mod.default ? (Array.isArray(mod.default) ? mod.default : [mod.default]) : [];
  for (const cue of cues) {
    if (want.size && !want.has(cue.id) && !want.has(f.replace(/\.ts$/, ''))) continue;
    const { ch, meas } = mixCue(cue);
    if (process.env.SCORE_ONLY_MIX) { writeWav(join(WORK, `${cue.id}.master.wav`), { sr: SR, ch }); continue; }
    const e = encode(cue, ch, meas);
    manifest.cues[cue.id] = { title: cue.title, tags: cue.tags, seconds: +cue.seconds.toFixed(2), marks: cue.marks ?? {}, bytes: { ogg: e.ogg, m4a: e.m4a }, lufs: e.lufs, tp: e.tp };
    console.log(`  -> ${cue.id}.ogg ${(e.ogg / 1024).toFixed(0)} KB, .m4a ${(e.m4a / 1024).toFixed(0)} KB`);
    writeFileSync(manPath, JSON.stringify(manifest, null, 1) + '\n');
  }
}
