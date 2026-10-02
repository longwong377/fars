// No copies within sight (s17 C2, D-560): two instances of one model standing within 20 m of each other at the same size,
// proportions, turn and lean read as a copy-paste (the done line's "no repeated instance within 20 m"). Placement stays a
// pure hash of the cell; these helpers then turn ("bump") any instance that would twin an earlier one, deterministically:
//  - twinFree: a whole list (a plot's orchard, the river and canal lines), in its own order;
//  - resolveCell: one cell of a hashed grid (the flora, the rocks: 8 m cells), against the raw items of the cells before it
//    (row-major) within reach and the earlier items of its own cell; the page and the census call the same function, and the
//    result does not depend on where the viewer stands (nothing turns as the walker comes near).
export interface Placed { e: number; n: number }

/** a list with every twin (isTwin within R m of an earlier kept item, or of one of `fixed`) bumped (k = 0, 1, ... up to 10 tries) */
export function twinFree<T extends Placed>(list: T[], isTwin: (a: T, b: T) => boolean, bump: (t: T, k: number) => T, R = 20, fixed: T[] = []): T[] {
  const grid = new Map<number, T[]>(), key = (x: number, y: number) => (x + 32768) * 65536 + (y + 32768), out: T[] = [];
  for (const t of fixed) { const k2 = key(Math.floor(t.e / R), Math.floor(t.n / R)); let l = grid.get(k2); if (!l) grid.set(k2, l = []); l.push(t); } // (`fixed`: the items before, never bumped)
  for (let t of list) {
    const gx = Math.floor(t.e / R), gy = Math.floor(t.n / R);
    const twin = (q: T) => { for (let x = gx - 1; x <= gx + 1; x++) for (let y = gy - 1; y <= gy + 1; y++) for (const o of grid.get(key(x, y)) ?? []) if (Math.hypot(o.e - q.e, o.n - q.n) <= R && isTwin(o, q)) return true; return false; };
    for (let k = 0; k < 10 && twin(t); k++) t = bump(t, k);
    out.push(t); const k2 = key(gx, gy); let l = grid.get(k2); if (!l) grid.set(k2, l = []); l.push(t);
  }
  return out;
}

/** the items of cell (ix, iy) of a grid of `cell` m with twins of earlier items bumped (see above) */
export function resolveCell<T extends Placed>(ix: number, iy: number, cell: number, raw: (ix: number, iy: number) => T[], isTwin: (a: T, b: T) => boolean, bump: (t: T, k: number) => T, R = 20): T[] {
  const own = raw(ix, iy); if (!own.length) return own;
  const reach = Math.ceil(R / cell), before: T[] = [];
  for (let y = iy - reach; y <= iy; y++) for (let x = ix - reach; x <= ix + reach; x++) { if (y === iy && x >= ix) break; before.push(...raw(x, y)); }
  const out: T[] = [];
  for (let t of own) {
    const twin = (q: T) => before.some(o => Math.abs(o.e - q.e) <= R && Math.abs(o.n - q.n) <= R && Math.hypot(o.e - q.e, o.n - q.n) <= R && isTwin(o, q)) || out.some(o => Math.hypot(o.e - q.e, o.n - q.n) <= R && isTwin(o, q));
    for (let k = 0; k < 10 && twin(t); k++) t = bump(t, k);
    out.push(t);
  }
  return out;
}

/** the census's twin test (tools/dev/plain_census.ts): same model, scale and proportions within 6 %, yaw within 15 deg, lean within 4 deg */
export const TWIN = { scale: 0.06, asp: 0.06, yaw: 0.26, lean: 0.07 } as const;
export function sameLook(a: { s: number; asp: number; yaw: number; lean?: [number, number] }, b: { s: number; asp: number; yaw: number; lean?: [number, number] }) {
  const dy = Math.abs(((b.yaw - a.yaw) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
  const la = a.lean ?? [0, 0], lb = b.lean ?? [0, 0];
  return Math.abs(b.s / a.s - 1) < TWIN.scale && Math.abs(b.asp / a.asp - 1) < TWIN.asp && dy < TWIN.yaw && Math.hypot(la[0] - lb[0], la[1] - lb[1]) < TWIN.lean;
}
/** a bump: a golden-angle turn each try (137.5 deg): the tries spread evenly round the circle */
export const bumpYaw = (yaw: number, k: number) => { void k; return (yaw + 2.39996) % (2 * Math.PI); };
