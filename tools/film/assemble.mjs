// The title film's edit and encode (D-761): the shots' frames (tools/film/film.py; each shot a folder with shot.json), laid
// end to end at their times in the main theme (every cut on a bar), raised to 24 fps by motion-compensated interpolation
// where the frames were rendered sparser, graded (a film curve, a warm print, the vignette, grain), the theme muxed in, and
// encoded twice for the web: AV1 + Opus in WebM, H.264 + AAC in MP4 (+faststart), with a poster still.
//   node tools/film/assemble.mjs <frames dir> [--out public/film] [--theme <main_theme.master.wav>] [--height 536] [--fps-in 8|24]
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const argv = process.argv.slice(2), arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const ROOT = resolve(import.meta.dirname, '../..'), FR = resolve(argv[0] ?? '/tmp/film_frames');
const OUT = resolve(arg('--out', join(ROOT, 'public/film'))), H = +arg('--height', '0'), FPS_IN = +arg('--fps-in', '8');
const THEME = arg('--theme', join(process.env.SCORE_WORK ?? join(homedir(), '.cache/parsa-score/work'), 'main_theme.master.wav'));
mkdirSync(OUT, { recursive: true });
const man = JSON.parse(readFileSync(join(ROOT, 'public/audio/score/manifest.json'), 'utf8')).cues.main_theme;

// the shots in film order, each frame held until the next rendered one (the concat demuxer's durations)
const shots = readdirSync(FR).filter(d => existsSync(join(FR, d, 'shot.json'))).map(d => ({ d, ...JSON.parse(readFileSync(join(FR, d, 'shot.json'), 'utf8')) })).sort((a, b) => a.t0 - b.t0);
if (!shots.length) throw new Error(`no shots in ${FR}`);
const lines = ['ffconcat version 1.0']; let t = 0, last = '';
for (const s of shots) {
  const frames = readdirSync(join(FR, s.d)).filter(f => f.endsWith('.png')).map(f => +f.slice(0, 5)).sort((a, b) => a - b);
  if (!frames.length) throw new Error(`${s.d}: no frames`);
  if (Math.abs(s.t0 - t) > 0.05) console.warn(`  ! a gap before ${s.d}: ${t.toFixed(2)} -> ${s.t0.toFixed(2)} s`);
  for (let i = 0; i < frames.length; i++) {
    const a = s.t0 + frames[i] / s.fps, b = i + 1 < frames.length ? s.t0 + frames[i + 1] / s.fps : s.t1;
    last = join(FR, s.d, `${String(frames[i]).padStart(5, '0')}.png`); lines.push(`file '${last}'`, `duration ${(b - a).toFixed(5)}`); t = b;
  }
  console.log(`${s.d.padEnd(14)} ${s.t0.toFixed(2)}-${s.t1.toFixed(2)} s, ${frames.length} frames`);
}
lines.push(`file '${last}'`); // (the demuxer wants the last file twice)
const list = join(FR, 'film.ffconcat'); writeFileSync(list, lines.join('\n') + '\n');
const dur = Math.max(t, man.seconds);

// the grade: a gentle S-curve with lifted, warm-tinted shadows (a print's), the vignette, fine grain; then the frame rate
const scale = H ? `,scale=-2:${H}:flags=lanczos` : '';
const vf = [
  ...(FPS_IN >= 24 ? ['fps=24'] : [`fps=${FPS_IN}`, 'minterpolate=fps=24:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1:scd=fdiff:scd_threshold=8']),
  "curves=r='0/0.02 0.25/0.22 0.5/0.52 0.75/0.79 1/0.98':g='0/0.015 0.25/0.21 0.5/0.5 0.75/0.77 1/0.96':b='0/0.03 0.25/0.21 0.5/0.47 0.75/0.72 1/0.9'",
  'eq=saturation=1.06:contrast=1.03', 'vignette=angle=PI/5:mode=forward', 'noise=c0s=7:c0f=t+u:c1s=2:c2s=2', `fade=t=in:st=0:d=1.2,fade=t=out:st=${(dur - 2.5).toFixed(2)}:d=2.5`,
].join(',') + scale + ',format=yuv420p';
const tmp = join(FR, 'graded.mkv');
console.log('grading and interpolating ...');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-vf', vf, '-t', dur.toFixed(2), '-c:v', 'ffv1', tmp], { stdio: 'inherit' });

const webm = join(OUT, 'parsa_title.webm'), mp4 = join(OUT, 'parsa_title.mp4'), jpg = join(OUT, 'parsa_title.jpg');
const audio = existsSync(THEME) ? ['-i', THEME] : []; if (!audio.length) console.warn(`  ! no theme at ${THEME}: a silent film`);
const map = audio.length ? ['-map', '0:v', '-map', '1:a', '-shortest'] : [];
console.log('AV1 + Opus ...');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', tmp, ...audio, ...map, '-c:v', 'libsvtav1', '-crf', '36', '-preset', '6', '-g', '96', '-svtav1-params', 'tune=0:film-grain=0',
  ...(audio.length ? ['-c:a', 'libopus', '-b:a', '128k'] : []), '-metadata', 'title=Pārsa', webm], { stdio: 'inherit' });
console.log('H.264 + AAC ...');
execFileSync('ffmpeg', ['-y', '-v', 'error', '-i', tmp, ...audio, ...map, '-c:v', 'libx264', '-crf', '22', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-g', '48',
  ...(audio.length ? ['-c:a', 'aac', '-b:a', '160k'] : []), '-movflags', '+faststart', '-metadata', 'title=Pārsa', mp4], { stdio: 'inherit' });
// the poster: the moment before the title (the summit), graded like the rest
execFileSync('ffmpeg', ['-y', '-v', 'error', '-ss', String(Math.max(0, Math.min(t - 1, (man.marks.title ?? 120) - 3))), '-i', tmp, '-frames:v', '1', '-q:v', '3', jpg]);
for (const f of [webm, mp4, jpg]) console.log(`${f}: ${(statSync(f).size / 1048576).toFixed(2)} MB`);
