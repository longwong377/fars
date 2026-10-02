// The roadside (s17 C2, D-560): the paths a walker follows across the plain (the settlement.json roads, the village tracks,
// the town's desire lines) as one index, read by the ground cover (groundCover.ts), the flora (groundFlora.ts), the loose
// rocks (groundRocks.ts) and the standing crop (crops.ts), so that every road and track reads as used and lived beside:
//  - the tread is worn: no tuft, sward, stubble, crop or plant stands on it; dung of the pack animals, oxen and flocks lies
//    on it (more on the roads than the tracks); on the village tracks a strip of short sward survives between the two
//    wheel ruts (the track ribbon's ruts at 0.55 of its half width, ribbons.ts);
//  - the verge (the tread's edge to 3.5 m out) is the rankest ground of the plain: dense bunch grasses (standing dry from
//    June: they are never cut there), thistles and camelthorn (roadside weeds of disturbed ground), and the stones the
//    ploughs and the carts threw out to the edge;
// whatever the plot beside it holds. All C (the rules and densities). Before s17 the cover had no idea of the tracks: tufts
// and young wheat grew on the village tracks, and their verges were the field's own (one stretch of track_37 bare for 88 m).
import { distToSegment } from './data';

export type PathKind = 'road' | 'track' | 'path';
export interface VergePath { pts: [number, number][]; hw: number; kind: PathKind }
/** the bands (m): beyond the tread's edge the verge reaches VERGE.w; the tracks' sward strip is |lateral| < median * hw */
export const VERGE = { w: 3.5, median: 0.3, bucket: 32 } as const;
export interface PathHit { /** distance from the centreline (m) */ d: number; hw: number; kind: PathKind; /** the segment's direction (grid e, n; unit) */ dir: [number, number] }

class PathIndex {
  private b = new Map<number, { a: [number, number]; c: [number, number]; hw: number; kind: PathKind }[]>();
  readonly paths: VergePath[];
  constructor(paths: VergePath[]) {
    this.paths = paths; const B = VERGE.bucket;
    for (const p of paths) for (let i = 1; i < p.pts.length; i++) { const a = p.pts[i - 1], c = p.pts[i], r = p.hw + VERGE.w + 1;
      for (let x = Math.floor((Math.min(a[0], c[0]) - r) / B); x <= Math.floor((Math.max(a[0], c[0]) + r) / B); x++)
        for (let y = Math.floor((Math.min(a[1], c[1]) - r) / B); y <= Math.floor((Math.max(a[1], c[1]) + r) / B); y++) {
          const k = (x + 32768) * 65536 + (y + 32768); let l = this.b.get(k); if (!l) this.b.set(k, l = []); l.push({ a, c, hw: p.hw, kind: p.kind }); } }
  }
  /** the nearest path whose verge reaches grid (e, n), or null */
  at(e: number, n: number): PathHit | null {
    const B = VERGE.bucket, l = this.b.get((Math.floor(e / B) + 32768) * 65536 + (Math.floor(n / B) + 32768)); if (!l) return null;
    let best: PathHit | null = null, bx = Infinity;
    for (const s of l) { const d = distToSegment(e, n, s.a[0], s.a[1], s.c[0], s.c[1]), x = d - s.hw; // (the outside of the widest tread wins)
      if (x < VERGE.w && x < bx) { bx = x; const L = Math.hypot(s.c[0] - s.a[0], s.c[1] - s.a[1]) || 1; best = { d, hw: s.hw, kind: s.kind, dir: [(s.c[0] - s.a[0]) / L, (s.c[1] - s.a[1]) / L] }; } }
    return best;
  }
}
let INDEX: PathIndex | null = null;
/** the plain registers its paths once built (index.ts); tests and the census set their own; null clears */
export function setVergePaths(paths: VergePath[] | null) { INDEX = paths && paths.length ? new PathIndex(paths) : null; }
export const vergePaths = () => INDEX?.paths ?? [];
/** the path at grid (e, n) if its tread or verge reaches there */
export const pathAt = (e: number, n: number): PathHit | null => INDEX ? INDEX.at(e, n) : null;
/** where (e, n) lies relative to the nearest path: 'tread' (on it), 'median' (the tracks' sward strip between the ruts),
 *  'verge' (within VERGE.w of the edge) or null (the open ground) */
export function vergeZone(e: number, n: number): { zone: 'tread' | 'median' | 'verge'; hit: PathHit } | null {
  const h = pathAt(e, n); if (!h) return null;
  if (h.d < h.hw) return { zone: h.kind === 'track' && h.d < VERGE.median * h.hw ? 'median' : 'tread', hit: h };
  return { zone: 'verge', hit: h };
}
