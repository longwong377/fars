// The solid footprints of a site (D-249): every collider build.ts stands in a site besides its walls, in the site's local
// frame, from one list, so the colliders (build.ts), the routes (walk.ts clearance) and the door census agree by
// construction. Pure data: no three.js, no terrain. Heights are above the ground at the footprint's centre.
//  - the court fixtures that stop a visitor (houseplan.ts): a bench, a tethered animal's manger, the portico's posts;
//  - the fittings with colliders (quarter.ts, compounds): oven, kiln, trough, manger, well, column.
// A footprint is an oriented box: centre (u, v), half extents hu (along the local direction `rot`) and hv, `rot` the angle
// from local +u (the world box turns by the site's theta plus `rot`).
import type { Site, Wall } from './site';
import { fixturesOf } from './houseplan';

export interface Footprint { u: number; v: number; hu: number; hv: number; rot: number; y: number; hy: number; kind: string; fitting?: number }

/** the fixtures' and fittings' colliders of a site (not its walls: Site.walls()) */
export function siteFootprints(s: Site): Footprint[] {
  const out: Footprint[] = [], th = s.frame.theta;
  for (const f of fixturesOf(s)) { const nu = Math.cos(f.rot), nv = Math.sin(f.rot);
    if (f.kind === 'bench' || f.kind === 'tether') { const d = f.kind === 'bench' ? 0.27 + 0.225 : 0.52, hh = f.kind === 'bench' ? 0.21 : 0.31;
      out.push({ u: f.u + nu * d, v: f.v + nv * d, hu: f.kind === 'bench' ? 0.225 : 0.25, hv: f.kind === 'bench' ? f.len / 2 : 0.55, rot: f.rot, y: hh, hy: hh, kind: f.kind }); }
    if (f.kind === 'portico') for (const [u, v] of f.posts!) out.push({ u, v, hu: 0.12, hv: 0.12, rot: -th, y: 1.5, hy: 1.5, kind: 'post' }); }
  s.fittings.forEach((f, fi) => {
    switch (f.kind) {
      case 'shrine': out.push({ u: f.u, v: f.v, hu: 0.5, hv: 0.32, rot: f.rot, y: 0.4, hy: 0.45, kind: f.kind, fitting: fi }); break;
      case 'oven': out.push({ u: f.u, v: f.v, hu: 0.35, hv: 0.35, rot: -th, y: 0.4, hy: 0.45, kind: f.kind, fitting: fi }); break;
      case 'kiln': { const r = 1.2 * f.size * 0.8; out.push({ u: f.u, v: f.v, hu: r, hv: r, rot: -th, y: 1, hy: 1, kind: f.kind, fitting: fi }); break; }
      case 'trough': out.push({ u: f.u, v: f.v, hu: 0.7 * f.size, hv: 0.28, rot: f.rot, y: 0.25, hy: 0.3, kind: f.kind, fitting: fi }); break;
      case 'manger': out.push({ u: f.u, v: f.v, hu: 0.9, hv: 0.3, rot: f.rot, y: 0.4, hy: 0.45, kind: f.kind, fitting: fi }); break;
      case 'well': out.push({ u: f.u, v: f.v, hu: 0.85, hv: 0.85, rot: -th, y: 0.35, hy: 0.4, kind: f.kind, fitting: fi }); break;
      case 'column': out.push({ u: f.u, v: f.v, hu: 0.35, hv: 0.35, rot: -th, y: f.size / 2, hy: f.size / 2, kind: f.kind, fitting: fi }); break;
      default: break;
    }
  });
  return out;
}

/** a wall as an oriented box (local frame) */
export function wallBox(w: Wall): { u: number; v: number; hu: number; hv: number; rot: number } {
  const along = w.v0 === w.v1, len = along ? w.u1 - w.u0 : w.v1 - w.v0;
  return { u: (w.u0 + w.u1) / 2, v: (w.v0 + w.v1) / 2, hu: along ? len / 2 : w.thick / 2, hv: along ? w.thick / 2 : len / 2, rot: 0 };
}

/** distance from local (u, v) to an oriented box (0 inside); `c`, `s` its rotation's cosine and sine */
export function boxDist(u: number, v: number, b: { u: number; v: number; hu: number; hv: number }, c: number, sn: number): number {
  const du = u - b.u, dv = v - b.v, x = Math.abs(du * c + dv * sn) - b.hu, y = Math.abs(-du * sn + dv * c) - b.hv;
  return x <= 0 && y <= 0 ? 0 : Math.hypot(Math.max(x, 0), Math.max(y, 0));
}
