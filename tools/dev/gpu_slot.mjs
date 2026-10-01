// Shared GPU slots for every agent on this box (session 11): at most SLOTS heavy renders at once, so the Windows GPU
// watchdog does not reset the card (DXGI_ERROR_DEVICE_HUNG). Usage, from any worktree:
//   node C:/Users/Administrator/fars-assets/gpu_slot.mjs <label> -- <command and args...>
// e.g. node C:/Users/Administrator/fars-assets/gpu_slot.mjs terrace -- npx playwright test tests/e2e/moments.spec.ts --project=gpu
// It waits for a free slot (a directory under T:\gpu-slots made atomically with mkdir), runs the command with the current
// environment, and frees the slot on exit. A slot whose holder process is gone is reclaimed.
import { mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { setPriority, constants } from 'node:os';
import { MIN_FREE_GB, freeGB, pipeWithProgress, recordChild, MAX_CPU, cpuBusy } from './boxguard.mjs';
// session 15: 1 slot on the 4-core box (two renders + agents starved the Claude app)
const SLOTS = +(process.env.GPU_SLOTS ?? 1), ROOT = 'T:/gpu-slots';
const argv = process.argv.slice(2), sep = argv.indexOf('--');
if (sep < 0 || sep === argv.length - 1) { console.error('usage: gpu_slot.mjs <label> -- <command...>'); process.exit(2); }
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
async function acquire() {
  let waited = 0;
  for (;;) {
    if (myTurn() && freeGB() >= MIN_FREE_GB && await cpuBusy() < MAX_CPU) for (let i = 0; i < SLOTS; i++) {
      const d = `${ROOT}/slot${i}`;
      try { mkdirSync(d); writeFileSync(`${d}/owner.json`, JSON.stringify({ pid: process.pid, label, since: new Date().toISOString() })); dropTicket(); return d; }
      catch { try { const o = JSON.parse(readFileSync(`${d}/owner.json`, 'utf8')); if (!alive(o.pid)) rmSync(d, { recursive: true, force: true }); } catch { if (existsSync(d)) { /* being written; retry */ } } }
    }
    if (waited % 60 === 0) console.error(`[gpu_slot] ${label}: waiting for a GPU slot, memory or CPU (${freeGB().toFixed(1)} GB free; ${waited} s)`);
    await new Promise(r => setTimeout(r, 5000)); waited += 5;
  }
}
const slot = await acquire();
console.error(`[gpu_slot] ${label}: got ${slot}`);
const free = () => { try { rmSync(slot, { recursive: true, force: true }); } catch {} };
process.on('SIGINT', () => { free(); process.exit(130); }); process.on('SIGTERM', () => { free(); process.exit(143); });
try { setPriority(constants.priority.PRIORITY_BELOW_NORMAL); } catch {} // children inherit the class (Windows): the app stays responsive
const child = spawn(cmd[0], cmd.slice(1), { stdio: ['inherit', 'pipe', 'pipe'], shell: true, env: process.env });
pipeWithProgress(child, slot); recordChild(slot, child);
child.on('exit', code => { free(); process.exit(code ?? 1); });
