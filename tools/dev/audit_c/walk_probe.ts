// Auditor's read-only probe: what a walker would see over an hour at one spot (population view, node).
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../../src/people/navgrid';
import { PeopleSim, type Env } from '../../../src/people/sim';
import { WeatherSystem } from '../../../src/weather/weatherState';
import { buildTownPlan } from '../../../src/world/settlement/plan';
import { PopGeo } from '../../../src/people/popgeo';
import { PopView } from '../../../src/people/popview';
import { buildCanals } from '../../../src/world/plain/canals';
import { placeVillages, villageCompounds } from '../../../src/world/plain/villages';
import { loadTerrain, loadRiversFile } from '../../../tests/plainLib';
process.chdir('/home/user/fars');
const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const sim = new PeopleSim(1, nav, env); const plan = buildTownPlan(); const terrain = loadTerrain(); const rivers = loadRiversFile(); const canals = buildCanals(terrain, rivers.rivers, 1);
const villages = placeVillages(terrain, rivers.rivers, canals, 1);
const geo = new PopGeo({ pop: sim.pop, nav, town: plan, ground: (e, n) => terrain.heightAt(e, -n), villages, compounds: vi => villageCompounds(villages[vi], terrain, 1), canals: canals.map(c => c.pts), seed: 1 });
const view = new PopView(sim, geo, 1); view.radius = 600; view.margin = 300;
const args = process.argv.slice(2); const E = +args[0], N = +args[1], day = +args[2], h0 = +args[3], mins = +(args[4] ?? 60), R = +(args[5] ?? 60), label = args[6] ?? '';
const t0 = day * 24 + h0; view.settle(t0, [E, N]);
const last = new Map<number, { e: number; n: number; act: string; moving: boolean; since: number; t: number }>();
let samples = 0, visSum = 0, movSum = 0; const acts: Record<string, number> = {}; const overlapPairs = new Set<string>(); const overlapStand = new Set<string>();
let jumps = 0, slide = 0, walkInPlace = 0, appearOpen = 0; const longStill: Record<string, number> = {}; const sameActPlace: Record<string, Set<number>> = {};
const whyStand: Record<string, number> = {};
for (let s = 0; s <= mins * 60; s += 1) {
  const t = t0 + s / 3600; view.update(t, [E, N]); const vis = view.query([E, N], R).filter(o => o.agent < 0);
  samples++; visSum += vis.length; 
  for (const o of vis) { if (o.moving) movSum++; if (s % 60 === 0) acts[o.act] = (acts[o.act] ?? 0) + 1;
    const p = last.get(o.pid);
    if (p && p.t === s - 1) { const d = Math.hypot(o.e - p.e, o.n - p.n); if (d > 3) { jumps++; if (jumps<=8) console.error('JUMP', s, o.pid, p.act, p.moving, '->', o.act, o.moving, d.toFixed(1), o.what, '|', o.why, 'dist', Math.hypot(o.e-E,o.n-N).toFixed(0)); } else if (!o.moving && !p.moving && d > 0.3) slide++; else if (o.moving && p.moving && d < 0.05) walkInPlace++; }
    else if (p === undefined && s > 0 && o.entry === 0) { appearOpen++; if (appearOpen<=8) console.error('APPEAR', s, o.pid, o.act, o.moving, o.entry, o.what, '|', o.why, 'dist', Math.hypot(o.e-E,o.n-N).toFixed(0)); }
    const since = p && p.act === o.act && !o.moving && !p.moving ? p.since : s;
    last.set(o.pid, { e: o.e, n: o.n, act: o.act, moving: o.moving, since, t: s });
    if (!o.moving && s - since >= 3600 - 1) longStill[o.act] = (longStill[o.act] ?? 0) + 1;
  }
  if (s % 5 === 0) { for (let i = 0; i < vis.length; i++) for (let j = i + 1; j < vis.length; j++) { const a = vis[i], b = vis[j]; if (!a.moving && !b.moving) continue; const d = Math.hypot(a.e - b.e, a.n - b.n); if (d < 0.45 && Math.abs(a.y - b.y) < 1) { const k = a.pid < b.pid ? `${a.pid}-${b.pid}` : `${b.pid}-${a.pid}`; (a.moving && b.moving ? overlapPairs : overlapStand).add(k); if (overlapPairs.size+overlapStand.size<=6) console.error('OVERLAP', s, a.act, a.moving, a.what, '/', b.act, b.moving, b.what, d.toFixed(2)); } } }
}
const people = last.size;
console.log(JSON.stringify({ label, at: [E, N], day, h0, mins, R, people, meanVisible: +(visSum / samples).toFixed(1), meanMovingShare: +(movSum / Math.max(1, visSum)).toFixed(2), actsPerMinuteSamples: acts, walkerWalkerInterpenetratingPairs: overlapPairs.size, walkerThroughStanderPairs: overlapStand.size, jumpsOver3mIn1s: jumps, stillPeopleSliding: slide, walkersNotMoving: walkInPlace, appearedInOpenWithoutEntry: appearOpen, stillWholeHourByAct: longStill, stats: { hurried: view.stats.hurried, crowded: view.stats.crowded, unresolved: view.stats.unresolved } }));
