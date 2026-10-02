// Shared by tools/audio/*.mjs (D-620): where ffmpeg is, the manifest public/audio/manifest.json (src/audio/library.ts reads
// it), probing a file's length.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

/** ffmpeg: $FFMPEG, then the one on PATH, then the npm ffmpeg-static package if installed (`npm i --no-save ffmpeg-static`) */
export function ffmpegPath() {
  if (process.env.FFMPEG) return process.env.FFMPEG;
  const r = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }); if (r.status === 0) return 'ffmpeg';
  try { const p = (await_import_ffmpeg_static()); if (p && existsSync(p)) return p; } catch { /* none */ }
  throw new Error('ffmpeg not found: install it (winget install Gyan.FFmpeg), or `npm i --no-save ffmpeg-static`, or set FFMPEG=<path>');
}
function await_import_ffmpeg_static() {
  const r = spawnSync(process.execPath, ['-e', "process.stdout.write(require('ffmpeg-static'))"], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}
export function ffprobePath() {
  const ff = ffmpegPath(); if (ff === 'ffmpeg') return 'ffprobe';
  const p = ff.replace(/ffmpeg(\.exe)?$/i, m => m.replace('ffmpeg', 'ffprobe')); return existsSync(p) ? p : null;
}
/** ffmpeg's report (stderr) for an analysis run (volumedetect, ebur128, silencedetect) */
export function ffReport(ff, args) { return spawnSync(ff, ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', maxBuffer: 1 << 26 }).stderr ?? ''; }
/** a file's length (s): ffprobe when present, else ffmpeg's decode report */
export function probeDur(file) {
  const fp = ffprobePath();
  if (fp) { const r = spawnSync(fp, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' }); const d = parseFloat(r.stdout); if (Number.isFinite(d)) return d; }
  const rep = ffReport(ffmpegPath(), ['-i', file, '-f', 'null', '-']), m = [...rep.matchAll(/time=(\d+):(\d+):([\d.]+)/g)].pop();
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : 0;
}
/** write one section of public/audio/manifest.json (replace: drop the section's old keys first) */
export function updateManifest(root, section, entries, replace = false) {
  const p = join(root, 'public/audio/manifest.json'); mkdirSync(join(root, 'public/audio'), { recursive: true });
  const m = existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : { version: 1, note: 'D-620: the recordings the world plays (src/audio/library.ts); written by tools/audio/fetch.mjs and irs.mjs; every file in ASSET_LEDGER.md', sections: {} };
  m.sections[section] = replace ? entries : { ...(m.sections[section] ?? {}), ...entries };
  const sorted = {}; for (const k of Object.keys(m.sections[section]).sort()) sorted[k] = m.sections[section][k]; m.sections[section] = sorted;
  writeFileSync(p, JSON.stringify(m, null, 1) + '\n');
}
export { execFileSync };
