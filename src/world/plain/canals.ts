// Irrigation canals of the plain (Phase 7): the procedural rule of plain.json `irrigation_systems_sumner` (C). Sumner found
// two irrigation systems "probably of Achaemenid construction and a third that may also be" (SUMNER1986, B), and "large
// earthen channel networks branch out from these rivers near the main Achaemenid sites" (SHOBAIRI2018, B); their courses
// were not retrieved (Q-055), so off-takes are placed every 2-4 km along the Pulvar and the Kur, on the side where the
// irrigated-field polygon lies, and each canal follows the contour of the bare-earth DEM at 0.5 m/km (C), shallower than the
// river, so it gains height over the plain and can water it by gravity.
import type { Terrain } from '../../terrain/heightfield';
import { feature, pointInPolygon, settlementZones, RiverProfile, PointIndex, baseCourse, priorTerrain } from './data';
import { Rng } from '../../core/rng';

export interface Canal { id: string; river: string; pts: [number, number][]; width: number; /** water level (m asl) at each point */ level: number[]; length: number }

const STEP = 25; // m per trace step
export function buildCanals(terrain: Terrain, live: RiverProfile[], seed = 1): Canal[] {
  const rivers = live.map(baseCourse); // D-670: traced from the pre-meander course as before (their routes unchanged), heads joined below
  const rule = feature('irrigation_systems_sumner').procedural_rule;
  const polys: Record<string, [number, number][]> = { river_pulvar: feature('fields_irrigated_pulvar').polygon, river_kur: feature('fields_irrigated_kur').polygon };
  const zones = settlementZones();
  const rng = new Rng(seed, 'plain-canals');
  const ground = priorTerrain(terrain, live[0]?.prior), asl = (x: number, y: number) => ground.aslAt(x, -y); // D-670: the ground they were traced on
  const canals: Canal[] = [];
  const riverIdx = new PointIndex(300); for (const rv of rivers) riverIdx.addPolyline(rv, 20);
  const canalIdx = new PointIndex(300);
  const nearRiver = (x: number, y: number, r: number) => riverIdx.any(x, y, r);
  const nearCanal = (x: number, y: number, r: number, self: Canal | null) => canalIdx.any(x, y, r, self ? canals.length : undefined);
  const inZone = (x: number, y: number) => zones.some(z => pointInPolygon(x, y, z));
  for (const rv of rivers) {
    const poly = polys[rv.id]; if (!poly) continue;
    let s = rng.range(0, 1500), side = rng.chance(0.5) ? 1 : -1;
    const n = rv.x.length, total = (n - 1) * 20;
    while (s < total - 1500) {
      const k = Math.floor(s / 20), k2 = Math.min(n - 1, k + 3);
      const tx = rv.x[k2] - rv.x[k], ty = rv.y[k2] - rv.y[k], tl = Math.hypot(tx, ty) || 1, ux = tx / tl, uy = ty / tl;
      let made = false;
      for (const sd of [side, -side]) {
        const nx = -uy * sd, ny = ux * sd; // left of flow for sd = 1
        const ox = rv.x[k] + nx * (rv.topWidth / 2 + 40), oy = rv.y[k] + ny * (rv.topWidth / 2 + 40);
        if (!pointInPolygon(rv.x[k] + nx * 400, rv.y[k] + ny * 400, poly) || inZone(ox, oy)) continue;
        const c = trace(ox, oy, ux, uy, nx, ny, rv.bank[k] - 0.5);
        if (c) { for (const p of c.pts) canalIdx.add(p[0], p[1], canals.length); canals.push(c); made = true; side = -sd; break; }
      }
      void made;
      s += 1000 * rng.range(rule.offtake_spacing_km[0], rule.offtake_spacing_km[1]);
    }
    function trace(x0: number, y0: number, ux: number, uy: number, nx: number, ny: number, level0: number): Canal | null {
      const L = 1000 * rng.range(rule.length_km[0], rule.length_km[1]), grad = rule.gradient_m_per_km / 1000;
      const width = rng.range(rule.main_canal_width_m[0], rule.main_canal_width_m[1]);
      // head: leave the river at ~35 deg toward the field side
      let hx = ux * 0.82 + nx * 0.57, hy = uy * 0.82 + ny * 0.57;
      const pts: [number, number][] = [[x0, y0]], level = [level0];
      let x = x0, y = y0, lev = level0, len = 0;
      const self: Canal = { id: `canal_${rv.id}_${canals.length}`, river: rv.id, pts, width, level, length: 0 };
      while (len < L) {
        lev -= grad * STEP;
        let best: { x: number; y: number; hx: number; hy: number; cost: number } | null = null;
        for (const da of [-24, -16, -8, 0, 8, 16, 24]) {
          const a = (da * Math.PI) / 180, cx = hx * Math.cos(a) - hy * Math.sin(a), cy = hx * Math.sin(a) + hy * Math.cos(a);
          const px = x + cx * STEP, py = y + cy * STEP, g = asl(px, py);
          // water ~0.3 m below the local ground, never into the river, a little turning penalty
          let cost = Math.abs(g - (lev + 0.3)) + Math.abs(da) * 0.004;
          if (nearRiver(px, py, rv.topWidth / 2 + 35)) cost += 50;
          if (!best || cost < best.cost) best = { x: px, y: py, hx: cx, hy: cy, cost };
        }
        const b = best!;
        const g = asl(b.x, b.y);
        if (g - lev > 2.5 || lev - g > 1.2) break; // would need a deep cutting or an embankment: the canal ends here
        if (inZone(b.x, b.y) || nearCanal(b.x, b.y, 120, self) || !pointInPolygon(b.x, b.y, poly)) break;
        x = b.x; y = b.y; hx = b.hx; hy = b.hy; len += STEP; pts.push([x, y]); level.push(lev);
      }
      self.length = len;
      return len >= 800 ? self : null;
    }
  }
  if (!live.some(r => r.base)) return canals;
  const out = canals.map(c => joinHead(c, live.find(r => r.id === c.river)!)).filter((c): c is Canal => !!c);
  BASE_CANALS.set(out, canals); return out;
}
/** D-670: the canals as traced (before their heads were joined to the meandering water): what placeVillages measures water by */
export const BASE_CANALS = new WeakMap<Canal[], Canal[]>();

/** D-670: a canal traced from the pre-meander course meets the river as it now runs: the points inside the meandering
 *  channel's corridor are dropped, a straight head (25 m steps) runs from the water's edge to the first point left, and the
 *  canal ends before any later point that the meanders now reach (none shorter than 300 m kept) */
function joinHead(c: Canal, r: RiverProfile): Canal | null {
  const idx = new PointIndex(200); idx.addPolyline(r, 10);
  const clear = r.topWidth / 2 + 22, keep = (p: [number, number]) => !idx.any(p[0], p[1], clear);
  // the head: past the last point within its first 260 m that the water now covers (a bend may cross it twice)
  let j = 0, s = 0; for (let i = 0; i < c.pts.length && s <= 260; i++) { if (i) s += Math.hypot(c.pts[i][0] - c.pts[i - 1][0], c.pts[i][1] - c.pts[i - 1][1]); if (!keep(c.pts[i])) j = i + 1; }
  let e = j; while (e < c.pts.length && keep(c.pts[e])) e++;
  if (e - j < 2) return null;
  const pts = c.pts.slice(j, e), level = c.level.slice(j, e);
  const [, k] = idx.nearest(pts[0][0], pts[0][1], 2000); if (k < 0) return null;
  const rx = idx.xs[k], ry = idx.ys[k], dx = pts[0][0] - rx, dy = pts[0][1] - ry, d = Math.hypot(dx, dy);
  // the head in whole trace steps (25 m, 0.5 m/km like the rest: the canal's levels stay one gradient), its first point at
  // or just inside the water's edge
  const grad = (level[0] - level[level.length - 1]) / Math.max(1, (level.length - 1) * STEP), steps = Math.max(1, Math.floor((d - (r.topWidth / 2 - 1)) / STEP) + 1);
  const head: [number, number][] = [], hl: number[] = [];
  for (let i = steps; i >= 1; i--) { const t = (d - STEP * i) / d; head.push([rx + dx * t, ry + dy * t]); hl.push(level[0] + grad * STEP * i); }
  const all = [...head, ...pts], len = (all.length - 1) * STEP;
  return len >= 800 ? { ...c, pts: all, level: [...hl, ...level], length: len } : null;
}
