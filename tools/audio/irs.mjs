// The rooms' measured impulse responses (D-620): one per kind of space (src/audio/soundplan.ts IR_KINDS), cut from the OpenAIR
// library files archived on branch assets-archive (audio/irs/openair/**, CC BY 4.0, www.openairlib.net; retrieved 2026-09-27,
// sha256 in that branch's audio/irs/manifest.json). Each is read from git, its leading silence cut (the direct sound at
// t = 0), resampled to 48 kHz stereo (a mono or omni file is doubled), cut to the length its space needs with a fade over
// its last 30 %, peak-normalised to -1 dBFS and encoded Ogg Opus 96 kb/s to public/audio/ir/<kind>.ogg; the manifest's `ir`
// section and the ledger rows name the source of each.
// Usage: node tools/audio/irs.mjs [--ref origin/assets-archive]   (needs ffmpeg on PATH, or FFMPEG=<path>)
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { updateManifest, ffmpegPath, probeDur, ffReport } from './common.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ref = process.argv.includes('--ref') ? process.argv[process.argv.indexOf('--ref') + 1] : 'origin/assets-archive';
const A = 'audio/irs/openair/';
/** kind → the archived file, the venue, why it stands for the kind, the tail kept (s) */
export const IRS = {
  // measured T20 of the cuts (Schroeder, this script's output): the marble hall ~3.7 s (the Apadana's Sabine estimate is 3-10 s,
  // tests/audio.test.ts), the tennis court ~1.7 s, so the marble hall stands for the great halls
  hall_large: { file: 'elveden-hall-suffolk-england/stereo/1a_marble_hall.wav', venue: 'Elveden Hall, the marble hall (Suffolk)', why: 'a great columned hall of stone and plaster: the Apadana, the Hall of 100 Columns, the Gate', tail: 4.5 },
  hall_medium: { file: 'falkland-palace-royal-tennis-court/stereo/falkland_tennis_court_ortf.wav', venue: 'Falkland Palace royal tennis court (Scotland)', why: 'a roofed stone hall of middle size: the Tachara, the Hadish, the Harem, the Treasury', tail: 3 },
  room_small: { file: 'elveden-hall-suffolk-england/stereo/18a_smoking_room.wav', venue: 'Elveden Hall, the smoking room', why: 'a furnished room: the town\'s and villages\' rooms, storerooms, workshops', tail: 1.2 },
  court: { file: 'cliffords-tower/examples/RIR_1_w_channel.wav', venue: 'Clifford\'s Tower, York (a roofless stone keep)', why: 'walls without a roof: the Terrace\'s courts and porticoes, the town\'s lanes and courtyards', tail: 1.1 },
  gorge: { file: 'trollers-gill/mono/dales_site1_4way_mono.wav', venue: 'Trollers Gill (a limestone gorge, Yorkshire Dales)', why: 'limestone rock faces: Kuh-e Rahmat\'s slopes, the Naqsh-e Rustam cliff, the quarries', tail: 2.5 },
  open: { file: 'koli-national-park-summer/mono/koli_summer_site1_4way_mono.wav', venue: 'Koli National Park in summer (open ground by a lake, Finland)', why: 'open ground with far reflections: the plain', tail: 1.5 },
  wood: { file: 'wheldrake-wood/examples/Forest_IR_M30_S1R2.wav', venue: 'Wheldrake Wood (Yorkshire)', why: 'among trees: the orchards, the gardens, the paradise', tail: 1.5 },
  chamber: { file: 'maes-howe/stereo/mh3_000_ortf_48k.wav', venue: 'Maeshowe (a stone chambered tomb, Orkney)', why: 'a small stone chamber: rock-cut tombs, storerooms of stone', tail: 2 },
};

function run() {
  const ff = ffmpegPath(), out = join(ROOT, 'public/audio/ir'), tmp = join(tmpdir(), 'fars-irs'); mkdirSync(out, { recursive: true }); mkdirSync(tmp, { recursive: true });
  const entries = {}, ledger = [];
  for (const [kind, ir] of Object.entries(IRS)) {
    const src = join(tmp, `${kind}.wav`), dst = join(out, `${kind}.ogg`);
    writeFileSync(src, execFileSync('git', ['show', `${ref}:${A}${ir.file}`], { cwd: ROOT, maxBuffer: 1 << 28 }));
    // pass 1: cut the leading silence, stereo 48 kHz, the tail with its fade; measure the peak
    const mid = join(tmp, `${kind}_cut.wav`), fadeAt = ir.tail * 0.7;
    execFileSync(ff, ['-y', '-v', 'error', '-i', src, '-af', `silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.002,aresample=48000,atrim=0:${ir.tail},afade=t=out:st=${fadeAt}:d=${(ir.tail - fadeAt).toFixed(3)}`, '-ac', '2', '-c:a', 'pcm_f32le', mid]);
    const peak = +(/max_volume: (-?[\d.]+) dB/.exec(ffReport(ff, ['-i', mid, '-af', 'volumedetect', '-f', 'null', '-']))?.[1] ?? 0);
    execFileSync(ff, ['-y', '-v', 'error', '-i', mid, '-af', `volume=${(-1 - peak).toFixed(2)}dB`, '-c:a', 'libopus', '-b:a', '96k', '-ar', '48000', dst]);
    const dur = probeDur(dst), bytes = statSync(dst).size;
    entries[kind] = [{ file: `ir/${kind}.ogg`, dur: +dur.toFixed(3), bytes, src: `openair:${ir.file}`, licence: 'CC BY 4.0', author: 'OpenAIR (www.openairlib.net), University of York', url: `https://webfiles.york.ac.uk/OPENAIR/IRs/${ir.file}`, venue: ir.venue, why: ir.why }];
    ledger.push(`| Room impulse response \`public/audio/ir/${kind}.ogg\` (${ir.why}; D-620) | OpenAIR: ${ir.venue}, \`${ir.file}\` (archived on branch assets-archive, audio/irs/openair) cut by tools/audio/irs.mjs | CC BY 4.0 | www.openairlib.net (Audiolab, University of York) | C (a measured analogue of the space, not the space) |`);
    rmSync(src); rmSync(mid);
    console.log(kind, dur.toFixed(2), 's', (bytes / 1024).toFixed(0), 'KB', `peak was ${peak} dB`);
  }
  updateManifest(ROOT, 'ir', entries, true);
  writeFileSync(join(tmp, 'ledger_ir.md'), ledger.join('\n') + '\n'); console.log('ledger rows:', join(tmp, 'ledger_ir.md'));
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) run();
