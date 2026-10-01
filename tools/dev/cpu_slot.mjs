// CPU slots for the 4-core box (session 14; the Windows counterpart of cpu_slot.sh, which needs flock): at most SLOTS heavy
// node jobs at once (soaks, long vitest files, bots, bakes), each at low priority, so renders and agents' edits keep a core.
//   node tools/dev/cpu_slot.mjs <label> -- <command and args...>
// Slots are directories under C:/Users/Administrator/fars-train/cpu-slots made atomically with mkdir; a dead holder's slot
// is reclaimed. CPU_SLOTS overrides the count (default 2).
import { mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { setPriority, constants } from 'node:os';
const SLOTS = +(process.env.CPU_SLOTS ?? 2), ROOT = 'C:/Users/Administrator/fars-train/cpu-slots';
const argv = process.argv.slice(2), sep = argv.indexOf('--');
if (sep < 0 || sep === argv.length - 1) { console.error('usage: cpu_slot.mjs <label> -- <command...>'); process.exit(2); }
const label = argv.slice(0, sep).join(' ') || 'job', cmd = argv.slice(sep + 1);
mkdirSync(ROOT, { recursive: true });
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };
let slot, waited = 0;
for (;;) {
  for (let i = 0; i < SLOTS && !slot; i++) {
    const d = `${ROOT}/slot${i}`;
    try { mkdirSync(d); writeFileSync(`${d}/owner.json`, JSON.stringify({ pid: process.pid, label, since: new Date().toISOString() })); slot = d; }
    catch { try { const o = JSON.parse(readFileSync(`${d}/owner.json`, 'utf8')); if (!alive(o.pid)) rmSync(d, { recursive: true, force: true }); } catch {} }
  }
  if (slot) break;
  if (waited % 60 === 0) console.error(`[cpu_slot] ${label}: waiting for a CPU slot (${waited} s)`);
  await new Promise(r => setTimeout(r, 5000)); waited += 5;
}
console.error(`[cpu_slot] ${label}: got ${slot}`);
const free = () => { try { rmSync(slot, { recursive: true, force: true }); } catch {} };
try { setPriority(constants.priority.PRIORITY_BELOW_NORMAL); } catch {} // children inherit the class (Windows)
const child = spawn(cmd[0], cmd.slice(1), { stdio: 'inherit', shell: true });
process.on('SIGINT', () => { child.kill(); free(); process.exit(130); }); process.on('SIGTERM', () => { child.kill(); free(); process.exit(143); });
child.on('exit', code => { free(); process.exit(code ?? 1); });
