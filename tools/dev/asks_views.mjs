// s17: the view asks in handoff/s17/asks_vagon.md (and the Vagon agents' own, same line form) -> the asks.json that
// `scoreboard.mjs focus` takes. A line `<agent> | view: e,n,eye,heading,pitch,day,hour[,weather] | why` becomes one view.
//   node tools/dev/asks_views.mjs [asks.md ...] [--out T:/fars-train/asks.json] [--skip <ask id already rendered>,...]
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a.splice(i, 2)[1] : d; };
const out = opt('--out', 'T:/fars-train/asks.json'), skip = new Set((opt('--skip', '') || '').split(',').filter(Boolean));
const files = a.length ? a : ['handoff/s17/asks_vagon.md'];
const views = [];
for (const f of files.filter(existsSync)) for (const line of readFileSync(f, 'utf8').split('\n')) {
  const m = /^\s*([\w-]+)\s*\|\s*view:\s*([-\d.,\sa-z]+?)\s*\|\s*(.*)$/i.exec(line); if (!m) continue;
  const [e, n, eye, az, pitch, day, hour, w = 'clear'] = m[2].split(',').map(s => s.trim());
  const id = `ask-${m[1].toLowerCase()}-${views.filter(v => v.agent === m[1]).length + 1}`;
  if (skip.has(id) || [e, n, eye, az, pitch, day, hour].some(x => !Number.isFinite(+x))) continue;
  views.push({ id, agent: m[1], e: +e, n: +n, eye: +eye, az: +az, pitch: +pitch, day: +day, hour: +hour, w, why: `${m[1]}: ${m[3].trim()}`.slice(0, 300) });
}
writeFileSync(out, JSON.stringify(views.map(({ agent, ...v }) => v), null, 1));
console.log(`${views.length} views -> ${out}`);
