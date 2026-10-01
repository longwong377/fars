// Box safeguards (session 15, after the session-14 freeze: 9 agents and their jobs on 4 cores / 16 GB froze the app for hours).
//   - waitForMemory(label): a slot job does not start while free memory is under MIN_FREE_GB (default 4); it waits.
//   - activeAgents(): agent worktrees marked active (mkwt writes .agent; `mkwt.mjs --done <name>` clears it).
//   - MAX_AGENTS (default 4): mkwt refuses a 5th active agent worktree; the render train refuses to run while agents build.
// Slots record their child's pid and a progress stamp (touched on every line of output); tools/dev/watchdog.mjs reports a slot
// held > 45 min without output, one line with the pids to kill.
import { freemem } from 'node:os';
import { existsSync, readdirSync, readFileSync, writeFileSync, utimesSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const MIN_FREE_GB = +(process.env.MIN_FREE_GB ?? 4);
export const MAX_AGENTS = +(process.env.MAX_AGENTS ?? 2); // session 15: 4 agents + their jobs pinned 4 cores at 100 %
export const WT_ROOT = resolve(process.env.WT_ROOT ?? 'C:/Users/Administrator/fars-wt');
export const SLOT_ROOTS = { gpu: 'T:/gpu-slots', cpu: process.env.CPU_SLOT_ROOT ?? 'C:/Users/Administrator/fars-train/cpu-slots' };
export const freeGB = () => freemem() / 2 ** 30;

export async function waitForMemory(label, tag) {
  let waited = 0;
  while (freeGB() < MIN_FREE_GB) {
    if (waited % 60 === 0) console.error(`[${tag}] ${label}: ${freeGB().toFixed(1)} GB free < ${MIN_FREE_GB} GB; waiting (${waited} s)`);
    await new Promise(r => setTimeout(r, 5000)); waited += 5;
  }
}

export function activeAgents() {
  if (!existsSync(WT_ROOT)) return [];
  return readdirSync(WT_ROOT).filter(d => existsSync(join(WT_ROOT, d, '.agent')));
}

// stdio piped through, each chunk refreshes <slot>/progress (the watchdog reads its mtime)
export function pipeWithProgress(child, slot) {
  const p = join(slot, 'progress'); writeFileSync(p, '');
  const touch = () => { try { const t = new Date(); utimesSync(p, t, t); } catch {} };
  child.stdout?.on('data', d => { process.stdout.write(d); touch(); });
  child.stderr?.on('data', d => { process.stderr.write(d); touch(); });
}

export function recordChild(slot, child) {
  try { const f = join(slot, 'owner.json'), o = JSON.parse(readFileSync(f, 'utf8')); o.child = child.pid; writeFileSync(f, JSON.stringify(o)); } catch {}
}

// CPU (session 15: the memory floor alone let a 4-core box sit at 100 % and starve the Claude app). Busy share of all cores
// over `ms`; slot jobs wait while it is above MAX_CPU (default 75 %).
import { cpus } from 'node:os';
export const MAX_CPU = +(process.env.MAX_CPU ?? 75);
export async function cpuBusy(ms = 3000) {
  const t = () => cpus().reduce((a, c) => { const s = Object.values(c.times).reduce((x, y) => x + y, 0); return [a[0] + s - c.times.idle, a[1] + s]; }, [0, 0]);
  const [b0, s0] = t(); await new Promise(r => setTimeout(r, ms)); const [b1, s1] = t();
  return 100 * (b1 - b0) / Math.max(1, s1 - s0);
}
