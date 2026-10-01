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
export const MAX_AGENTS = +(process.env.MAX_AGENTS ?? 4);
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
