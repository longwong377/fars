// dev: the town's door census (D-249; Q-640; T-H1r, T-H1s). Every door of every site of the town plan, measured on the
// geometry the colliders are built from (Site.walls() boxes and the fixtures' and fittings' footprints, footprints.ts),
// not on the plan's formula (Site.doorClear): the clear width of the opening is the free run through the door's midpoint
// along the door's line, the least over 25 lines across the door from 0.6 m outside to 0.6 m inside (through the wall's
// depth and past the jambs). Reports min / p1 / p5 / median and the counts under 0.8 m (the target: excavated Achaemenid
// and Elamite doors 0.7-1.0 m, C) and 0.62 m (the player's capsule with its skin), by kind (street doors, the doors
// inside a plot), and the worst doors with their grid position.
// Usage: npx tsx tools/dev/door_census.ts [--evidence pass]   (→ REVIEWS/evidence/<pass>/door_clearance.json)
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { buildTownPlan } from '../../src/world/settlement/plan';
import { siteFootprints, wallBox } from '../../src/world/settlement/footprints';
import type { Site } from '../../src/world/settlement/site';

type Box = { u: number; v: number; hu: number; hv: number; rot: number };
/** the parameter interval where the line p + x·d crosses a box, or null */
function cross(p: [number, number], d: [number, number], b: Box): [number, number] | null {
  const c = Math.cos(b.rot), s = Math.sin(b.rot), du = p[0] - b.u, dv = p[1] - b.v;
  const px = du * c + dv * s, py = -du * s + dv * c, dx = d[0] * c + d[1] * s, dy = -d[0] * s + d[1] * c;
  let lo = -Infinity, hi = Infinity;
  for (const [q, dq, h] of [[px, dx, b.hu], [py, dy, b.hv]] as const) {
    if (Math.abs(dq) < 1e-12) { if (Math.abs(q) > h) return null; continue; }
    const t0 = (-h - q) / dq, t1 = (h - q) / dq; lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1)); }
  return lo < hi ? [lo, hi] : null;
}
export function censusSite(s: Site) {
  const boxes: Box[] = [...s.walls().filter(w => !w.door).map(wallBox), ...siteFootprints(s)];
  // a coarse index: boxes by 4 m tile of their centre (walls up to their length: indexed along)
  const T = 4, idx = new Map<number, number[]>(), key = (a: number, b: number) => a * 100003 + b;
  boxes.forEach((b, bi) => { const r = Math.max(b.hu, b.hv) + 1; for (let x = Math.floor((b.u - r) / T); x <= Math.floor((b.u + r) / T); x++) for (let y = Math.floor((b.v - r) / T); y <= Math.floor((b.v + r) / T); y++) { const k = key(x, y); (idx.get(k) ?? idx.set(k, []).get(k)!).push(bi); } });
  const N = s.W * s.H, streets = new Set(s.plots.filter(p => p.door).map(p => s.edgeBetween(p.door!.cell, p.door!.out)));
  const out: { clear: number; street: boolean; at: [number, number]; e: number }[] = [];
  for (const e of s.doors) {
    const h = e < N, k = h ? e : e - N, i = k % s.W, j = (k / s.W) | 0;
    const m: [number, number] = h ? [s.u0 + i + 0.5, s.v0 + j + 1] : [s.u0 + i + 1, s.v0 + j + 0.5];
    const t: [number, number] = h ? [1, 0] : [0, 1], n: [number, number] = h ? [0, 1] : [1, 0];
    const near = new Set<number>(); for (let x = Math.floor((m[0] - 2) / T); x <= Math.floor((m[0] + 2) / T); x++) for (let y = Math.floor((m[1] - 2) / T); y <= Math.floor((m[1] + 2) / T); y++) for (const bi of idx.get(key(x, y)) ?? []) near.add(bi);
    let clear = 2;
    for (let y = -0.6; y <= 0.6001; y += 0.05) {
      const p: [number, number] = [m[0] + n[0] * y, m[1] + n[1] * y], iv: [number, number][] = [];
      for (const bi of near) { const c = cross(p, t, boxes[bi]); if (c) iv.push(c); }
      let lo = -1, hi = 1; let blocked = false;
      for (const [a, b] of iv) { if (a <= 0 && b >= 0) { blocked = true; break; } if (b < 0) lo = Math.max(lo, b); else hi = Math.min(hi, a); }
      clear = Math.min(clear, blocked ? 0 : hi - lo);
    }
    out.push({ clear, street: streets.has(e), at: s.grid(m[0], m[1]), e });
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2), ev = argv.indexOf('--evidence'), pass = ev >= 0 ? argv[ev + 1] : null;
  const t0 = Date.now(), plan = buildTownPlan();
  const all: { clear: number; street: boolean; at: [number, number]; site: string; kind: string }[] = [];
  for (const s of plan.sites) for (const d of censusSite(s)) all.push({ ...d, site: s.id, kind: s.meta.kind });
  const q = (xs: number[], f: number) => { const a = xs.slice().sort((x, y) => x - y); return a.length ? +a[Math.min(a.length - 1, Math.floor(f * a.length))].toFixed(3) : NaN; };
  const stat = (xs: number[]) => ({ n: xs.length, min: q(xs, 0), p1: q(xs, 0.01), p5: q(xs, 0.05), median: q(xs, 0.5), under_0_8: xs.filter(x => x < 0.8 - 1e-6).length, under_0_62: xs.filter(x => x < 0.62).length });
  const res = { all: stat(all.map(d => d.clear)), street: stat(all.filter(d => d.street).map(d => d.clear)), inside: stat(all.filter(d => !d.street).map(d => d.clear)),
    quarters: stat(all.filter(d => d.kind === 'quarter').map(d => d.clear)), compounds: stat(all.filter(d => d.kind === 'compound').map(d => d.clear)) };
  const worst = all.slice().sort((a, b) => a.clear - b.clear).slice(0, 15).map(d => `${d.site} ${d.street ? 'street' : 'inner'} door at grid (${d.at[0].toFixed(1)}, ${d.at[1].toFixed(1)}): ${d.clear.toFixed(2)} m`);
  console.log(JSON.stringify(res, null, 1)); console.log(worst.join('\n')); console.log(`(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  if (pass) { mkdirSync(`REVIEWS/evidence/${pass}`, { recursive: true });
    const commit = process.env.RUN_COMMIT ?? execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
    writeFileSync(`REVIEWS/evidence/${pass}/door_clearance.json`, JSON.stringify({ id: 'door_clearance', value: res.all.min, unit: 'm', n: res.all.n, commit, tool: 'tools/dev/door_census.ts', target: '>= 0.8 m every door (Q-640, D-249)',
      method: 'free run through the door midpoint along its line, least of 25 lines from 0.6 m outside to 0.6 m inside; solids: Site.walls() boxes and footprints.ts (the colliders build.ts makes)', ...res, worst }, null, 1) + '\n'); }
}
