// D-336 (T-E11, UD-22): every person's voice measured. The sample is seeded, never chosen: the people of the conversation test
// set (converse/testset.ts buildTestSet: every class, every hour, every kind of place), and then, seeded, whoever it lacks of
// a language community (origin), a sex or an age band (child < 13, adult, elder >= 55). For each person, rendered by the
// same code the browser runs (audio/neural: their own identity, the units of their heard reply): their own period language
// (or wordless voice, for a people without a published corpus: T-K1a2), and the opt-in layer: the same in-character reply in
// English and in Farsi. Measured: the speaker embedding (WavLM-Base-Plus-SV; same speaker at cosine >= 0.86, its model card)
// of each person against every other (unique: below 0.86 to all), a second embedding (WeSpeaker ECAPA) reported, the
// naturalness (UTMOS22 strong, a MOS predictor trained on listeners' ratings; >= 3.5), and whether the opt-in voice is the
// same person (their English and Farsi embeddings nearer their own-language voice than any other person's).
//   npx tsx tools/dev/voices_eval.ts [--n 72] [--out REVIEWS/evidence/s12-voices/T-E11.json]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { execSync } from 'node:child_process';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { buildTestSet } from '../../src/people/converse/testset';
import { replyVoice, replyUnits, replyJobs, sentences } from '../../src/people/converse/voice';
import { voiceLang, unitsFor, WORDLESS } from '../../src/audio/voices';
import { phonemesFor } from '../../src/audio/neural/kokoro';
import { espeakIpa } from '../../src/audio/neural/g2p';
import { espeakToKokoro } from '../../src/audio/neural/kokoro';
import { fenceFa } from '../../src/people/converse/farsi';
import { kokoro, Instruments, to16k, cos, wav, MODELS } from './voices_measure';
import { Rng } from '../../src/core/rng';

const arg = (k: string, d: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const N = +arg('--n', '72'), OUT = arg('--out', 'REVIEWS/evidence/s12-voices/T-E11.json'), WAVS = arg('--wavs', 'T:/fars-assets-s12/voices/eval');
// the same-speaker thresholds: each embedding's equal-error threshold calibrated on this synthesiser's 54 speakers
// (tools/dev/voices_calib.ts; WavLM-SV's published 0.86 is VoxCeleb's and does not hold here: every Kokoro voice scores
// above it against every other, the first run of this tool)
// (read when the scores are made: the calibration may still be running when the renders start)
let CAL: any = null, SAME = 0, SAME_W = 0;
const calib = async () => { const f = 'REVIEWS/evidence/s12-voices/calib.json'; while (!existsSync(f)) await new Promise(r => setTimeout(r, 30000));
  CAL = JSON.parse(readFileSync(f, 'utf8')); SAME = CAL.models.ecapa.eer.t; SAME_W = CAL.models.wavlm.eer.t; };
mkdirSync(WAVS, { recursive: true });
const t0 = performance.now(); const log = (...a: any[]) => console.log(((performance.now() - t0) / 1000).toFixed(0).padStart(5), 's', ...a);

const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(1), env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const S = new PeopleSim(1, nav, env); const P = S.pop; log('world built', P.persons.length, 'people');

// ---- the sample
const cases = buildTestSet(P, 1, N); const seen = new Set<number>(); const rows: any[] = [];
const band = (a: number) => (a < 13 ? 'child' : a >= 55 ? 'elder' : 'adult');
const add = (pid: number, day: number, why: string, job: string = P.persons[pid].job) => { if (seen.has(pid)) return; seen.add(pid); rows.push({ pid, day, job, why }); };
for (const c of cases) add(c.pid, c.day, 'testset', c.job);
const r = new Rng(7, 'voices.eval.fill');
const lacks = () => { const o = new Set(rows.map(x => P.persons[x.pid].origin)), sb = new Set(rows.map(x => P.persons[x.pid].sex + band(P.ageOn(x.pid, x.day))));
  return { origins: [...new Set(P.persons.map(p => p.origin))].filter(x => !o.has(x)), bands: ['mchild', 'fchild', 'madult', 'fadult', 'melder', 'felder'].filter(x => !sb.has(x)) }; };
for (let g = 0; g < 20000; g++) { const L = lacks(); if (!L.origins.length && !L.bands.length) break;
  const pid = r.int(0, P.persons.length - 1), day = r.int(0, 353), p = P.persons[pid]; if (!P.present(pid, day) || P.ageOn(pid, day) < 5) continue;
  if (L.origins.includes(p.origin) || L.bands.includes(p.sex + band(P.ageOn(pid, day)))) add(pid, day, 'coverage'); }
log('sample', rows.length, JSON.stringify(lacks()));

// ---- the replies each is heard giving (the in-character English of the GPU conversation runs, cycled; seeded)
const REPLIES: string[] = JSON.parse(readFileSync('REVIEWS/evidence/s12-voices/replies.json', 'utf8')).replies;
// their Farsi: the replies' Persian (tools/dev/voices_fa_cache.ts; the text's quality is measured apart, D-336)
const FA = new Map<string, string>((JSON.parse(readFileSync(arg('--fa', 'REVIEWS/evidence/s12-voices/replies_fa.json'), 'utf8')).rows as any[]).map(r => [r.en, r.fa]));
void MODELS;
const K = await kokoro(); const I = await Instruments.load(); log('models loaded');

const cat = (xs: Float32Array[]) => { const n = xs.reduce((a, x) => a + x.length, 0), o = new Float32Array(n); let k = 0; for (const x of xs) { o.set(x, k); k += x.length; } return o; };
for (const [i, row] of rows.entries()) {
  const p = P.persons[row.pid], agent = p.agent >= 0 ? S.agents.find(a => a.id === p.agent) ?? null : null;
  const english = REPLIES[i % REPLIES.length];
  const { id, neural: v } = replyVoice(P, row.pid, row.day, 1, agent); const { units, lang } = replyUnits(P, row.pid, row.day, english, 1, agent);
  // own language: the reply's units, and more of theirs up to ~3 s (a stable embedding)
  const own: Float32Array[] = [];
  for (const j of replyJobs('own', units, english) as { phonemes: string }[]) own.push(await K.speak(j.phonemes, v));
  // more of their own units (seeded) up to 6 s: an embedding of a second of speech is not the voice
  { const U = lang ? unitsFor(lang as any) : { lines: [], words: WORDLESS }, pool = [...U.lines, ...U.words], rr = new Rng(id.seed >>> 0, 'voices.eval.more'); let sec = own.reduce((a, x) => a + x.length, 0) / 24000;
    for (let k = 0; sec < 6 && k < 24 && pool.length; k++) { const u = pool[rr.int(0, pool.length - 1)]; const y = await K.speak(phonemesFor(u.ipa, u.intonation), v); own.push(y); sec += y.length / 24000; } }
  const x = to16k(cat(own), 24000);
  const fa = FA.get(english) ?? '';
  const enX: Float32Array[] = [], faX: Float32Array[] = [];
  for (const s of sentences(english)) enX.push(await K.speak(espeakToKokoro(await espeakIpa(s, 'en'), 'en'), v));
  for (const s of sentences(fa)) faX.push(await K.speak(espeakToKokoro(await espeakIpa(s, 'fa'), 'fa'), v));
  const en16 = to16k(cat(enX), 24000), fa16 = to16k(cat(faX), 24000);
  Object.assign(row, { origin: p.origin, sex: p.sex, age: P.ageOn(row.pid, row.day), band: band(P.ageOn(row.pid, row.day)), voiceAge: id.age, agent: agent?.id ?? null, lang: lang ?? 'wordless', via: voiceLang(id.lang, id.langs).via,
    units: units.map(u => u.id), english, fa, faHits: fenceFa(fa), mix: v.mix, tract: v.tract, speed: v.speed, seconds: +(x.length / 16000).toFixed(2),
    emb: Array.from(await I.wavlm(x)), ecapa: Array.from((await I.ecapa(x))!), ecapaEn: Array.from((await I.ecapa(en16))!), ecapaFa: Array.from((await I.ecapa(fa16))!),
    mos: +(await I.mos(x))!.toFixed(3), mosEn: +(await I.mos(en16))!.toFixed(3), mosFa: +(await I.mos(fa16))!.toFixed(3), backend: 'kokoro' });
  if (i < 12) { wav(`${WAVS}/${i}_${row.pid}_own.wav`, cat(own), 24000); wav(`${WAVS}/${i}_${row.pid}_en.wav`, cat(enX), 24000); wav(`${WAVS}/${i}_${row.pid}_fa.wav`, cat(faX), 24000); }
  log(i, row.pid, row.job, p.origin, p.sex, row.age, row.lang, 'mos', row.mos, row.mosEn, row.mosFa);
}
// ---- scores
await calib(); log('calibrated thresholds: ecapa', SAME, 'wavlm', SAME_W);
const F = (a: number[]) => Float32Array.from(a);
for (const a of rows) {
  let best = -1, who = -1, bestW = -1; for (const b of rows) if (b !== a) { const c = cos(F(a.ecapa), F(b.ecapa)); if (c > best) { best = c; who = b.pid; } bestW = Math.max(bestW, cos(F(a.emb), F(b.emb))); }
  a.maxSim = +best.toFixed(4); a.nearest = who; a.maxSimWavlm = +bestW.toFixed(4); a.unique = best < SAME;
  // the opt-in voice is the same person: their English / Farsi nearer their own-language voice than any other person's own
  for (const k of ['En', 'Fa'] as const) { const e = F(a['ecapa' + k]); const mine = cos(e, F(a.ecapa)); let other = -1; for (const b of rows) if (b !== a) other = Math.max(other, cos(e, F(b.ecapa)));
    a['same' + k] = +mine.toFixed(4); a['other' + k] = +other.toFixed(4); a['rank1' + k] = mine > other; }
  a.natural = a.mos >= 3.5 && a.mosEn >= 3.5 && a.mosFa >= 3.5;
  a.ownLang = a.lang !== 'wordless' || !['op', 'el', 'arc', 'bab', 'grc'].includes(voiceLang(a.origin).lang ?? '');
  a.optIn = a.rank1En && a.rank1Fa;
  a.pass = a.unique && a.natural && a.ownLang && a.optIn;
}
const n = rows.length, share = (f: (x: any) => boolean) => +(100 * rows.filter(f).length / n).toFixed(1);
let commit = ''; try { commit = execSync('git rev-parse --short HEAD').toString().trim(); } catch { /* */ }
const ev = {
  id: 'T-E11', value: share(x => x.pass), n, commit, tool: 'tools/dev/voices_eval.ts (tests/voices_unique.test.ts reads it)', unit: '%',
  status: 'measured: WeSpeaker ECAPA embeddings at the threshold calibrated on the synthesiser (WavLM-SV reported), UTMOS22 as the MOS predictor (not a human listening panel: see the note)',
  parts: { unique: share(x => x.unique), natural: share(x => x.natural), ownLanguage: share(x => x.ownLang), optInSamePerson: share(x => x.optIn), wordless: share(x => x.lang === 'wordless'),
    mosMean: +(rows.reduce((a, x) => a + x.mos, 0) / n).toFixed(3), mosEnMean: +(rows.reduce((a, x) => a + x.mosEn, 0) / n).toFixed(3), mosFaMean: +(rows.reduce((a, x) => a + x.mosFa, 0) / n).toFixed(3),
    maxSimMax: Math.max(...rows.map(x => x.maxSim)), maxSimMedian: rows.map(x => x.maxSim).sort((a, b) => a - b)[n >> 1], wavlmMaxSimMax: Math.max(...rows.map(x => x.maxSimWavlm)), faFenceHits: rows.filter(x => x.faHits.length).length },
  cover: { classes: [...new Set(rows.map(x => x.job))].sort(), origins: [...new Set(rows.map(x => x.origin))].sort(), bands: [...new Set(rows.map(x => x.sex + x.band))].sort(), langs: [...new Set(rows.map(x => x.lang))].sort() },
  models: { tts: 'onnx-community/Kokoro-82M-v1.0-ONNX fp32 (node, onnxruntime-node)', embedding: 'Wespeaker/wespeaker-ecapa-tdnn512-LM (threshold: calib.json equal-error point)', embedding2: 'Xenova/wavlm-base-plus-sv (reported; its VoxCeleb threshold 0.86 fails on synthetic speech)', mos: 'TigreGotico/utmos-onnx utmos22_strong', farsiText: 'Xenova/nllb-200-distilled-600M q8 (the text only; its quality is measured apart: D-336)' },
  note: 'natural = UTMOS22 >= 3.5 on the own-language, English and Farsi clips (a predictor trained on listener ratings; the brief\'s blind human rating is not run here); UTMOS was trained on English, so its Farsi and period-language scores measure acoustic naturalness, not pronunciation',
  thresholds: { ecapa: SAME, wavlm: SAME_W, calib: CAL.models },
  rows: rows.map(({ emb, ecapa, ecapaEn, ecapaFa, ...x }) => x),
};
mkdirSync(dirname(OUT), { recursive: true }); writeFileSync(OUT, JSON.stringify(ev, null, 1));
log('T-E11', ev.value, '%', JSON.stringify(ev.parts), JSON.stringify(ev.cover));
