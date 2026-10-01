// CPU slots for the 4-core box (session 14; the Windows counterpart of cpu_slot.sh, which needs flock): at most SLOTS heavy
// node jobs at once (soaks, long vitest files, bots, bakes), each at low priority, so renders and agents' edits keep a core.
//   node tools/dev/cpu_slot.mjs <label> -- <command and args...>
// Slots are directories under C:/Users/Administrator/fars-train/cpu-slots made atomically with mkdir; a dead holder's slot
// is reclaimed. CPU_SLOTS overrides the count (default 2). LONG=1 marks a job of more than ~10 min (people_days files, soaks,
// bakes): long jobs may hold only slots 0..CPU_SLOTS-2, so the last slot always stays free for short checks (merges, related tests).
import { mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { MIN_FREE_GB, freeGB, pipeWithProgress, recordChild } from './boxguard.mjs';
import { setPriority, constants } from 'node:os';
const SLOTS = +(process.env.CPU_SLOTS ?? 2), ROOT = process.env.CPU_SLOT_ROOT ?? 'C:/Users/Administrator/fars-train/cpu-slots';
const argv = process.argv.slice(2), sep = argv.indexOf('--');
if (sep < 0 || sep === argv.length - 1) { console.error('usage: cpu_slot.mjs <label> -- <command...>'); process.exit(2); }
const label = argv.slice(0, sep).join(' ') || 'job', cmd = argv.slice(sep + 1);
mkdirSync(ROOT, { recursive: true });
const alive = pid => { try { process.kill(pid, 0); return true; } catch { return false; } };

// FIFO (session 14): waiters take tickets; only the oldest live waiter may take a free slot, so a patient job never loses
// every race to newer pollers. A ticket of a dead process is dropped.
const QD = `${ROOT}/queue`; mkdirSync(QD, { recursive: true });
const ticket = `${QD}/${Date.now().toString().padStart(15, '0')}-${process.pid}.json`; writeFileSync(ticket, JSON.stringify({ pid: process.pid, label }));
const dropTicket = () => { try { rmSync(ticket, { force: true }); } catch {} };
process.on('exit', dropTicket);
const myTurn = () => { for (const t of readdirSync(QD).sort()) { const pid = +t.split('-')[1].replace('.json', ''); if (pid === process.pid) return true; if (alive(pid)) return false; try { rmSync(`${QD}/${t}`, { force: true }); } catch {} } return true; };
let slot, waited = 0;
for (;;) {
  if (myTurn() && freeGB() >= MIN_FREE_GB) for (let i = 0; i < (process.env.LONG ? Math.max(1, SLOTS - 1) : SLOTS) && !slot; i++) {
    const d = `${ROOT}/slot${i}`;
    try { mkdirSync(d); writeFileSync(`${d}/owner.json`, JSON.stringify({ pid: process.pid, label, since: new Date().toISOString() })); slot = d; dropTicket(); }
    catch { try { const o = JSON.parse(readFileSync(`${d}/owner.json`, 'utf8')); if (!alive(o.pid)) rmSync(d, { recursive: true, force: true }); } catch {} }
  }
  if (slot) break;
  if (waited % 60 === 0) console.error(`[cpu_slot] ${label}: waiting for a CPU slot or memory (${freeGB().toFixed(1)} GB free; ${waited} s)`);
  await new Promise(r => setTimeout(r, 5000)); waited += 5;
}
console.error(`[cpu_slot] ${label}: got ${slot}`);
const free = () => { try { rmSync(slot, { recursive: true, force: true }); } catch {} };
try { setPriority(constants.priority.PRIORITY_BELOW_NORMAL); } catch {} // children inherit the class (Windows)
const child = spawn(cmd[0], cmd.slice(1), { stdio: ['inherit', 'pipe', 'pipe'], shell: true });
pipeWithProgress(child, slot); recordChild(slot, child);
process.on('SIGINT', () => { child.kill(); free(); process.exit(130); }); process.on('SIGTERM', () => { child.kill(); free(); process.exit(143); });
child.on('exit', code => { free(); process.exit(code ?? 1); });
