// Watchdog (session 15): one line per problem, for the lead to pass to the user at once.
//   node tools/dev/watchdog.mjs            check once; exit 1 when something is wrong
//   node tools/dev/watchdog.mjs --loop     check every minute, print only new problems (run under Monitor)
// Problems: a GPU/CPU slot held > STALL_MIN (45) min with no output (pids to kill), free memory < MIN_FREE_GB,
// more than MAX_AGENTS active agent worktrees.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { SLOT_ROOTS, MIN_FREE_GB, MAX_AGENTS, freeGB, activeAgents, cpuBusy } from './boxguard.mjs';
const STALL_MIN = +(process.env.STALL_MIN ?? 45);
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };

let hot = 0;
// CPU of processes the app competes with: normal priority or higher (slot jobs run below normal and yield to the app)
const PS = "$a=Get-Process|Select Id,CPU;Start-Sleep 5;Get-Process|%{$p=$_;$o=$a|?{$_.Id -eq $p.Id};if($o -and $p.CPU -and $p.PriorityClass -and $p.PriorityClass -notin 'BelowNormal','Idle'){'{0}|{1}|{2}' -f $p.Name,$p.Id,[int](($p.CPU-$o.CPU)/5/[Environment]::ProcessorCount*100)}}";
function foreground() {
  try { const r = execFileSync('powershell', ['-NoProfile', '-Command', PS], { encoding: 'utf8' }).trim().split(/\r?\n/).map(l => l.split('|')).map(([n, id, p]) => ({ n, id, p: +p })).sort((a, b) => b.p - a.p);
    return { pct: r.reduce((s, x) => s + x.p, 0), top: r.slice(0, 3).map(x => `${x.n} ${x.id} ${x.p}%`).join(', ') }; } catch { return null; }
}
async function check() {
  const out = [];
  for (const [kind, root] of Object.entries(SLOT_ROOTS)) {
    if (!existsSync(root)) continue;
    for (const s of readdirSync(root).filter(d => d.startsWith('slot'))) {
      let o; try { o = JSON.parse(readFileSync(join(root, s, 'owner.json'), 'utf8')); } catch { continue; }
      const pf = join(root, s, 'progress'), last = existsSync(pf) ? statSync(pf).mtimeMs : Date.parse(o.since);
      const idle = (Date.now() - last) / 60000, held = (Date.now() - Date.parse(o.since)) / 60000;
      const pids = [o.pid, o.child].filter(p => p && alive(p));
      if (!pids.length) out.push(`${kind} ${s} '${o.label}': holder dead; slot reclaimable`);
      else if (idle > STALL_MIN) out.push(`${kind} ${s} '${o.label}': held ${held | 0} min, no output for ${idle | 0} min; kill pids ${pids.join(' ')} (and children: taskkill /T /F /PID ${o.pid})`);
    }
  }
  const c = await cpuBusy(10000); hot = c > 90 ? hot + 1 : 0; // sustained only: a commit's guard run spikes for seconds
  if (hot >= 2) { const fg = foreground(); if (!fg || fg.pct > 60) out.push(`cpu: ${c | 0} % busy for over a minute, ${fg ? fg.pct + ' % at normal priority or higher: ' + fg.top : 'foreground share unknown'}`); }
  const f = freeGB(); if (f < MIN_FREE_GB) out.push(`memory: ${f.toFixed(1)} GB free (< ${MIN_FREE_GB})`);
  const a = activeAgents(); if (a.length > MAX_AGENTS) out.push(`agents: ${a.length} active worktrees > ${MAX_AGENTS}: ${a.join(', ')}`);
  return out;
}

if (process.argv.includes('--loop')) {
  let seen = new Set();
  for (;;) {
    const key = l => l.replace(/[\d.]+/g, '#'), now = await check(), fresh = now.filter(l => !seen.has(key(l)));
    for (const l of fresh) console.log(`[watchdog ${new Date().toTimeString().slice(0, 5)}] ${l}`);
    seen = new Set(now.map(key));
    await new Promise(r => setTimeout(r, 50000)); // every minute
  }
} else {
  const p = await check(); for (const l of p) console.log(l); if (!p.length) console.log(`ok: ${freeGB().toFixed(1)} GB free, ${activeAgents().length} active agents`);
  process.exit(p.length ? 1 : 0);
}
