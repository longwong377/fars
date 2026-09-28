// D-330: the stone frames of the doors, windows and niches (door_frame / window_frame / niche_frame parts: parts.ts
// doorFrames, openings.ts openingParts, plan_walls.ts) drawn as carved stone instead of their boxes. Every frame's boxes
// (two jambs, a lintel, a cornice block, a sill block under a window or niche) are found again as one assembly, and drawn:
//  - the jambs, the lintel's lower part and the sill with three stepped fasciae nested around the opening
//    (global.r_frame_profile: the rock tombs' doorways, references/Naqsh-e Rustam 3.webp; C), the fasciae mitred at the
//    corners, the arrises chamfered;
//  - the cornice block as the cavetto (Egyptian gorge) cornice of r_door_frame: torus, gorge, fillet, swept round the
//    lintel on every side the block projects, mitred;
//  - every face UV-mapped onto ONE trim texture baked in Blender (tools/blender/decor.mjs, frame_trim): the tongues of the
//    gorge, the worn and chipped arrises, the AO of the step feet, periodic along the frame (FRAME_TRIM.period);
//  - the boxes' faces that stay plain (the reveals, the soffit, the sides, the lintel's upper band, the cornice top) as flat
//    quads mapped on the trim's flat row. The colliders stay the parts' boxes (meshes.ts); nothing moves in plan.
// Everything here is node-safe (tests); the material (frameMaterial) needs the trim texture (render/decorAssets.ts).
import * as THREE from 'three/webgpu';
import type { Part, Box, FrameDims } from './parts';
import { v } from './spec';

export interface FrameProfileSpec { fasciae: number; step: number; chamfer: number; torus_h: number; torus_proj: number; fillet_h: number; tongue_pitch: number; tongue_relief: number; tongue_rows: number }
export const frameProfileSpec = (): FrameProfileSpec => v<FrameProfileSpec>('global', 'r_frame_profile');
export const FRAME_KINDS = new Set(['door_frame', 'window_frame', 'niche_frame']);

type P2 = [number, number];
/** the trim texture's layout (Blender v, 0 at the bottom; px). A strip row maps its profile's arc length linearly onto
 *  [v0, v0 + px); the flat row is one neutral band (normal up, AO 1) for the plain faces */
export interface TrimRow { id: 'cornice' | 'step' | 'convex' | 'flat'; v0: number; px: number; arc: number; pts: P2[]; cum: number[] }
export interface TrimLayout { W: number; H: number; period: number; lead: number; leadTop: number; rows: Record<TrimRow['id'], TrimRow>; spec: FrameProfileSpec; dims: FrameDims;
  /** the cornice profile's gorge (arc range) and torus (arc range), and the convex arrises (arc positions) per row: the Blender source's carving */
  gorge: [number, number]; torus: [number, number]; arrises: Record<string, { at: number; convex: boolean }[]> }
/** technical constants of the trim (not dimensions of the building): texture size, one period along the frame (m; 16
 *  tongue pitches), the strips' lead onto the faces either side of an arris (m), the row margins (px) */
export const FRAME_TRIM = { W: 2048, H: 1024, period: 1.2, lead: 0.035, leadTop: 0.05, margin: 24, mmPerPx: 1 } as const;

const cumArc = (pts: P2[]) => { const c = [0]; for (let i = 1; i < pts.length; i++) c.push(c[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return c; };
/** the cornice profile (o outward from the lintel face, y up from the cornice's foot), low-poly, traversed upward (the
 *  outside on the right): lead on the lintel, torus, gorge, fillet, chamfer, lead on the top */
export function corniceProfile(S: FrameProfileSpec, F: FrameDims, lead: number, leadTop: number, torusSeg = 6, gorgeSeg = 8): { pts: P2[]; torus: [number, number]; gorge: [number, number] } {
  const H = F.cornice_height, CP = F.cornice_projection, th = S.torus_h, tp = S.torus_proj, fh = S.fillet_h, c = S.chamfer;
  const pts: P2[] = [[0, -lead], [0, 0]];
  for (let i = 1; i <= torusSeg; i++) { const t = -Math.PI / 2 + (Math.PI * i) / torusSeg; pts.push([tp * Math.cos(t), th / 2 + (th / 2) * Math.sin(t)]); }
  const iT = pts.length - 1;
  for (let i = 1; i <= gorgeSeg; i++) { const f = (Math.PI / 2) * (i / gorgeSeg); pts.push([CP - CP * Math.cos(f), th + (H - fh - th) * Math.sin(f)]); }
  const iG = pts.length - 1;
  pts.push([CP, H - c], [CP - c, H], [CP - leadTop, H]);
  for (const p of pts) { p[0] = +p[0].toFixed(6); p[1] = +p[1].toFixed(6); }
  const cum = cumArc(pts); return { pts, torus: [cum[1], cum[iT]], gorge: [cum[iT], cum[iG]] };
}
export function trimLayout(): TrimLayout {
  const S = frameProfileSpec(), F = v<FrameDims>('global', 'r_door_frame'), T = FRAME_TRIM, l = T.lead, c = S.chamfer, s = S.step;
  const cor = corniceProfile(S, F, l, T.leadTop);
  const step: P2[] = [[l, s], [c, s], [0, s - c], [0, 0], [-l, 0]]; // (upper face → chamfer → riser → foot → lower face)
  const convex: P2[] = [[l, 0], [c, 0], [0, -c], [0, -l]];
  const rows = {} as TrimLayout['rows']; let v0 = T.margin;
  for (const [id, pts] of [['convex', convex], ['step', step], ['cornice', cor.pts], ['flat', null]] as const) {
    const cum = pts ? cumArc(pts as P2[]) : [0], arc = cum[cum.length - 1], px = pts ? Math.ceil((arc * 1000) / T.mmPerPx) : 32;
    rows[id] = { id, v0, px, arc, pts: (pts ?? []) as P2[], cum }; v0 += px + T.margin;
  }
  if (v0 > T.H) throw new Error(`frame trim: rows need ${v0} px > ${T.H}`);
  const at = (row: TrimRow, i: number) => row.cum[i];
  return { W: T.W, H: T.H, period: T.period, lead: l, leadTop: T.leadTop, rows, spec: S, dims: F, gorge: cor.gorge, torus: cor.torus,
    arrises: { convex: [{ at: at(rows.convex, 1) + c * Math.SQRT1_2, convex: true }], step: [{ at: at(rows.step, 1) + c * Math.SQRT1_2, convex: true }, { at: at(rows.step, 3), convex: false }],
      cornice: [{ at: at(rows.cornice, 1), convex: false }, { at: cor.gorge[0], convex: false }, { at: at(rows.cornice, rows.cornice.pts.length - 3) + c * Math.SQRT1_2, convex: true }] } };
}
/** Blender v (0..1, bottom up) of arc length `a` along a strip row */
const vOf = (L: TrimLayout, r: TrimRow, a: number) => (r.v0 + (Math.min(Math.max(a, 0), r.arc) / r.arc) * r.px) / L.H;
const vFlat = (L: TrimLayout) => (L.rows.flat.v0 + L.rows.flat.px / 2) / L.H;

// ---- a side's fascia profile ----------------------------------------------------------------------------------------
/** one segment of a side's profile in (d, z): d outward in the face plane from the opening edge, z out of the face (0 = the
 *  frame face). Endpoints carry keys (the same key on every side is the same structural point: mitres join them) and the
 *  trim v at each end */
interface PSeg { p: P2; q: P2; kp: string; kq: string; vp: number; vq: number }
/** the fasciae profile of a side `W` wide, traversed from the outer edge to the reveal (the outside on the right). `outer`:
 *  the side ends in a free arris at d = W (a jamb's outer side, the sill's underside), else it continues flat (the lintel) */
function sideProfile(L: TrimLayout, W: number, outer: boolean): PSeg[] {
  const S = L.spec, n = S.fasciae, s = S.step, l = L.lead, out: PSeg[] = [], vf = vFlat(L);
  if (W / n < 2 * l + 1e-6) throw new Error(`frame fascia ${(W / n).toFixed(3)} m narrower than two strip leads`);
  // (the outer strip's last point is keyed apart from the flat that starts there: against a side without an outer strip, the
  // strip runs on to the lintel's top while the flat mitres)
  const strip = (row: TrimRow, map: (h: number, z: number) => P2, key: string, last = `${key}${row.pts.length - 1}`) => {
    for (let i = 0; i + 1 < row.pts.length; i++) out.push({ p: map(...row.pts[i]), q: map(...row.pts[i + 1]), kp: `${key}${i}`, kq: i + 2 === row.pts.length ? last : `${key}${i + 1}`, vp: vOf(L, row, row.cum[i]), vq: vOf(L, row, row.cum[i + 1]) });
  };
  const flat = (p: P2, q: P2, kp: string, kq: string) => out.push({ p, q, kp, kq, vp: vf, vq: vf });
  if (outer) strip(L.rows.convex, (h, z) => [W + z, -h], 'O', 'Oe');
  let prev: P2 = [W - l, 0], pk = 'O3';
  for (let k = n - 1; k >= 1; k--) { const d = (W * k) / n, z0 = -(n - 1 - k) * s; // the step at d from the face at z0 down to z0 − s
    flat(prev, [d + l, z0], pk, `S${k}_0`); strip(L.rows.step, (h, z) => [d + h, z0 - s + z], `S${k}_`); prev = [d - l, z0 - s]; pk = `S${k}_4`; }
  const zr = -(n - 1) * s; flat(prev, [l, zr], pk, 'R0'); strip(L.rows.convex, (h, z) => [h, zr + z], 'R');
  return out;
}

// ---- assemblies ------------------------------------------------------------------------------------------------------
/** one frame: `ax` the along axis (0: grid e, 1: grid n); a0/a1 the opening along, c0/c1 the frame across (the jambs'),
 *  yb/yh the opening's foot and head; framed[0/1]: the c0 / c1 face carries the carving (a niche's back lies in the wall) */
export interface FrameAsm { building: string; kind: string; ax: 0 | 1; a0: number; a1: number; c0: number; c1: number; yb: number; yh: number;
  jambs: [Box, Box]; lintel: Box; cornice: Box | null; sill: Box | null; framed: [boolean, boolean] }
const TOL = 2e-3;
const ext = (b: Box, k: 0 | 1): [number, number] => [b.c[k] - b.size[k] / 2, b.c[k] + b.size[k] / 2];
const near = (x: number, y: number) => Math.abs(x - y) < TOL;
/** the frames of `parts` found as assemblies (grid-aligned boxes of the frame kinds); the frame boxes left over (none, if
 *  every generator's frames are recognised: tests/frames.test.ts) */
export function frameAssemblies(parts: Part[], index: { inside(x: number, y: number, z: number, except: Part): boolean }): { asms: FrameAsm[]; loose: Box[] } {
  const boxes = parts.filter((p): p is Box => p.type === 'box' && FRAME_KINDS.has(p.kind) && !(p.rot ?? 0));
  const used = new Set<Box>(), asms: FrameAsm[] = [];
  const within = (i: Box, o: Box) => [0, 1].every(k => { const [a, b] = ext(i, k as 0 | 1), [c, d] = ext(o, k as 0 | 1); return a > c - TOL && b < d + TOL; });
  const sameKind = (a: Box, b: Box) => a.kind === b.kind && a.building === b.building;
  for (const L of boxes) {
    const js = boxes.filter(j => j !== L && sameKind(j, L) && near(j.y1, L.y0) && within(j, L));
    if (js.length !== 2) continue;
    const ax: 0 | 1 = Math.abs(js[0].c[0] - js[1].c[0]) > Math.abs(js[0].c[1] - js[1].c[1]) ? 0 : 1, cx = (1 - ax) as 0 | 1;
    const [J0, J1] = js[0].c[ax] < js[1].c[ax] ? [js[0], js[1]] : [js[1], js[0]];
    const [la0, la1] = ext(L, ax), a0 = ext(J0, ax)[1], a1 = ext(J1, ax)[0];
    if (!(near(ext(J0, ax)[0], la0) && near(ext(J1, ax)[1], la1) && a1 > a0 + 0.1)) continue;
    const [c0, c1] = ext(L, cx); if (![J0, J1].every(j => near(ext(j, cx)[0], c0) && near(ext(j, cx)[1], c1))) continue;
    const K = boxes.find(k => k !== L && sameKind(k, L) && near(k.y0, L.y1) && within(L, k)) ?? null;
    const Sb = boxes.find(k => sameKind(k, L) && near(k.y1, J0.y0) && near(ext(k, ax)[0], la0) && near(ext(k, ax)[1], la1) && near(ext(k, cx)[0], c0) && near(ext(k, cx)[1], c1)) ?? null;
    // the faces carved: the space 3 cm in front of each face, at the jamb's middle, is not inside another part (a wall)
    const probe = (side: 0 | 1) => { const cc = side ? c1 + 0.03 : c0 - 0.03, aa = (ext(J0, ax)[0] + a0) / 2, y = (J0.y0 + J0.y1) / 2; const e = ax === 0 ? aa : cc, nn = ax === 0 ? cc : aa; return !index.inside(e, y, -nn, J0); };
    asms.push({ building: L.building, kind: L.kind, ax, a0, a1, c0, c1, yb: J0.y0, yh: L.y0, jambs: [J0, J1], lintel: L, cornice: K, sill: Sb, framed: [probe(0), probe(1)] });
    for (const b of [J0, J1, L, K, Sb]) if (b) used.add(b);
  }
  return { asms, loose: boxes.filter(b => !used.has(b)) };
}

// ---- geometry ----------------------------------------------------------------------------------------------------------
/** quads in the assembly's local frame (a along, c across, y up) collected per part, with uv (u, Blender v), normal and the
 *  tangent's handedness; mapped to world (x = e, z = −n) at the end */
class QuadSink {
  readonly per = new Map<Box, { pos: number[]; nrm: number[]; uv: number[]; tan: number[] }>();
  constructor(private A: FrameAsm) {}
  /** p: 4 corners [a, y, c] in order around the quad; uvs per corner [u, vb]; n: the outward normal [a, y, c]; `owner` the part */
  quad(owner: Box, p: number[][], uvs: number[][], n: number[]) {
    const W = (q: number[]) => this.A.ax === 0 ? [q[0], q[1], -q[2]] : [q[2], q[1], -q[0]]; // (a, y, c) → world
    const P = p.map(W), N = W(n), e = this.per.get(owner) ?? this.per.set(owner, { pos: [], nrm: [], uv: [], tan: [] }).get(owner)!;
    // tangent: dP/du, bitangent dP/dvb, from the quad's first corner (a planar quad with affine uv)
    const d1 = [0, 1, 2].map(k => P[1][k] - P[0][k]), d2 = [0, 1, 2].map(k => P[3][k] - P[0][k]);
    const du1 = uvs[1][0] - uvs[0][0], dv1 = uvs[1][1] - uvs[0][1], du2 = uvs[3][0] - uvs[0][0], dv2 = uvs[3][1] - uvs[0][1], det = du1 * dv2 - du2 * dv1 || 1e-12;
    const T = [0, 1, 2].map(k => (d1[k] * dv2 - d2[k] * dv1) / det), B = [0, 1, 2].map(k => (d2[k] * du1 - d1[k] * du2) / det);
    const tl = Math.hypot(T[0], T[1], T[2]) || 1, Tn = T.map(x => x / tl);
    const cr = [N[1] * Tn[2] - N[2] * Tn[1], N[2] * Tn[0] - N[0] * Tn[2], N[0] * Tn[1] - N[1] * Tn[0]], w = cr[0] * B[0] + cr[1] * B[1] + cr[2] * B[2] < 0 ? -1 : 1;
    // winding: counter-clockwise seen from the outside
    const cx = [d1[1] * d2[2] - d1[2] * d2[1], d1[2] * d2[0] - d1[0] * d2[2], d1[0] * d2[1] - d1[1] * d2[0]], flip = cx[0] * N[0] + cx[1] * N[1] + cx[2] * N[2] < 0;
    const order = flip ? [0, 2, 1, 0, 3, 2] : [0, 1, 2, 0, 2, 3];
    for (const i of order) { e.pos.push(...P[i]); e.nrm.push(...N); e.uv.push(uvs[i][0], 1 - uvs[i][1]); e.tan.push(...Tn, w); }
  }
}
export interface FrameGeoStats { assemblies: number; loose: number; parts: number; triangles: number; byKind: Record<string, number> }
/** the carved render geometry of every frame part (world coordinates; attributes position, normal, uv, tangent), and the
 *  frame parts that keep their boxes (not recognised) */
export function frameGeometries(parts: Part[], index: { inside(x: number, y: number, z: number, except: Part): boolean }, L: TrimLayout = trimLayout()): { byPart: Map<Box, THREE.BufferGeometry>; stats: FrameGeoStats } {
  const { asms, loose } = frameAssemblies(parts, index), byPart = new Map<Box, THREE.BufferGeometry>(), stats: FrameGeoStats = { assemblies: asms.length, loose: loose.length, parts: 0, triangles: 0, byKind: {} };
  for (const A of asms) {
    const sink = new QuadSink(A); buildAssembly(A, L, sink);
    for (const [b, e] of sink.per) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(e.pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(e.nrm, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(e.uv, 2)); // (no tangents: the material takes the frame from the uv's derivatives, a vertex buffer fewer: WebGPU's 8, D-330)
      byPart.set(b, g); stats.parts++; stats.triangles += e.pos.length / 9;
    }
    // a part of the assembly that received no quad (hidden entirely) still gets its (empty) geometry: its box is not drawn
    for (const b of [...A.jambs, A.lintel, A.cornice, A.sill]) if (b && !byPart.has(b)) { const g = new THREE.BufferGeometry(); for (const [k, n] of [['position', 3], ['normal', 3], ['uv', 2]] as const) g.setAttribute(k, new THREE.Float32BufferAttribute([], n)); byPart.set(b, g); stats.parts++; }
    stats.byKind[A.kind] = (stats.byKind[A.kind] ?? 0) + 1;
  }
  return { byPart, stats };
}

/** the quads of one assembly */
function buildAssembly(A: FrameAsm, L: TrimLayout, Q: QuadSink) {
  const S = L.spec, l = L.lead, P = L.period, vf = vFlat(L), F = L.dims, lc = L.lead;
  const J = A.a0 - ext(A.jambs[0], A.ax)[0], LH = A.lintel.y1 - A.lintel.y0, Wt = Math.min(J, LH - l - lc - 0.02);
  const Wb = A.sill ? A.sill.y1 - A.sill.y0 : 0, yTop = A.lintel.y1 - (A.cornice ? lc : 0);
  const reveal = (S.fasciae - 1) * S.step + l; // how far the carving reaches into the reveal from a carved face
  const flatUV = (n: number) => Array.from({ length: n }, () => [0, vf]);
  const owner = (a: number, y: number): Box => { // the part a point of the frame belongs to
    if (A.sill && y < A.yb - 1e-6) return A.sill; if (y > A.yh + 1e-6) return A.lintel; return a < (A.a0 + A.a1) / 2 ? A.jambs[0] : A.jambs[1]; };
  // the sides: left (d → −a), right (+a), top (+y), bottom (−y; only under a sill); `W` the fasciae's width, `outer` a free arris at W
  type Side = { id: 'l' | 'r' | 't' | 'b'; W: number; outer: boolean; prof: PSeg[] };
  const sides: Side[] = [{ id: 'l', W: J, outer: true, prof: [] }, { id: 'r', W: J, outer: true, prof: [] }, { id: 't', W: Wt, outer: false, prof: [] }];
  if (A.sill) sides.push({ id: 'b', W: Wb, outer: true, prof: [] });
  for (const s of sides) s.prof = sideProfile(L, s.W, s.outer);
  const off = (id: Side['id'], key: string): number | null => { const s = sides.find(x => x.id === id); if (!s) return null; for (const g of s.prof) { if (g.kp === key) return g.p[0]; if (g.kq === key) return g.q[0]; } return null; };
  for (const f of [0, 1] as const) {
    if (!A.framed[f]) continue;
    const cf = f ? A.c1 : A.c0, sg = f ? 1 : -1;
    for (const s of sides) for (const g of s.prof) {
      // the two endpoints' runs along the side (from … to), mitred with the neighbours where they share the key
      const run = (d: number, key: string): [number, number] => {
        if (s.id === 't') { const dl = off('l', key) ?? d, dr = off('r', key) ?? d; return [A.a0 - dl, A.a1 + dr]; }
        if (s.id === 'b') { const dl = off('l', key) ?? d, dr = off('r', key) ?? d; return [A.a0 - dl, A.a1 + dr]; }
        const dt = off('t', key), db = A.sill ? off('b', key) : null;
        return [A.sill ? A.yb - (db ?? Wb) : A.yb, dt === null ? yTop : A.yh + dt];
      };
      const rp = run(g.p[0], g.kp), rq = run(g.q[0], g.kq);
      // local (a, y, c) of a profile point at run position t
      const at = (d: number, z: number, t: number): number[] => {
        const c = cf + sg * z;
        if (s.id === 'l') return [A.a0 - d, t, c]; if (s.id === 'r') return [A.a1 + d, t, c];
        if (s.id === 't') return [t, A.yh + d, c]; return [t, A.yb - d, c];
      };
      const dd = g.q[0] - g.p[0], dz = g.q[1] - g.p[1], nl = Math.hypot(dd, dz) || 1, nd = dz / nl, nz = -dd / nl; // outward: right of the traversal
      const dir = s.id === 'l' ? [-1, 0, 0] : s.id === 'r' ? [1, 0, 0] : s.id === 't' ? [0, 1, 0] : [0, -1, 0];
      const n = [dir[0] * nd, dir[1] * nd, sg * nz];
      const ui = s.id === 'l' || s.id === 'r' ? 1 : 0, u = (q: number[]) => (q[ui] - (ui ? A.yb : A.a0)) / P;
      // a jamb side's quad is cut where the sill, the jamb and the lintel meet, so each part draws its own (its y0, ytop)
      const cuts = s.id === 'l' || s.id === 'r' ? [-Infinity, ...(A.sill ? [A.yb] : []), A.yh, Infinity] : [-Infinity, Infinity];
      for (let k = 0; k + 1 < cuts.length; k++) {
        const P0 = [Math.max(rp[0], cuts[k]), Math.min(rp[1], cuts[k + 1])], Q0 = [Math.max(rq[0], cuts[k]), Math.min(rq[1], cuts[k + 1])];
        if (P0[1] - P0[0] < 1e-6 && Q0[1] - Q0[0] < 1e-6) continue;
        const pts = [at(g.p[0], g.p[1], P0[0]), at(g.p[0], g.p[1], P0[1]), at(g.q[0], g.q[1], Q0[1]), at(g.q[0], g.q[1], Q0[0])];
        const uvs = [[u(pts[0]), g.vp], [u(pts[1]), g.vp], [u(pts[2]), g.vq], [u(pts[3]), g.vq]];
        const m = [(pts[0][0] + pts[2][0]) / 2, (pts[0][1] + pts[2][1]) / 2];
        Q.quad(s.id === 't' ? A.lintel : s.id === 'b' ? A.sill! : owner(m[0], m[1]), pts, uvs, n);
      }
    }
  }
  // the plain faces (flat row)
  const cA = A.framed[0] ? A.c0 + reveal : A.c0, cB = A.framed[1] ? A.c1 - reveal : A.c1; // the reveals between the carvings
  const sA = A.framed[0] ? A.c0 + l : A.c0, sB = A.framed[1] ? A.c1 - l : A.c1; // the outer sides between the outer strips
  const la0 = ext(A.lintel, A.ax)[0], la1 = ext(A.lintel, A.ax)[1];
  const face = (owner: Box, p: number[][], n: number[]) => { if (Math.abs(p[0][0] - p[2][0]) + Math.abs(p[0][1] - p[2][1]) + Math.abs(p[0][2] - p[2][2]) < 1e-6) return; Q.quad(owner, p, flatUV(4), n); };
  const yb = A.yb;
  face(A.jambs[0], [[A.a0, yb, cA], [A.a0, A.yh, cA], [A.a0, A.yh, cB], [A.a0, yb, cB]], [1, 0, 0]); // reveals
  face(A.jambs[1], [[A.a1, yb, cA], [A.a1, A.yh, cA], [A.a1, A.yh, cB], [A.a1, yb, cB]], [-1, 0, 0]);
  face(A.lintel, [[A.a0, A.yh, cA], [A.a1, A.yh, cA], [A.a1, A.yh, cB], [A.a0, A.yh, cB]], [0, -1, 0]); // soffit
  if (A.sill) face(A.sill, [[A.a0, yb, cA], [A.a1, yb, cA], [A.a1, yb, cB], [A.a0, yb, cB]], [0, 1, 0]); // sill top
  const ybot = A.sill ? A.sill.y0 : yb;
  for (const [lo, hi, j] of [[ybot, yb, -1], [yb, A.yh, 0], [A.yh, yTop, 1]] as const) { // outer sides (sill end, jamb, lintel end)
    if (hi - lo < 1e-6) continue; const o0 = j < 0 ? A.sill! : j > 0 ? A.lintel : A.jambs[0], o1 = j < 0 ? A.sill! : j > 0 ? A.lintel : A.jambs[1];
    face(o0, [[la0, lo, sA], [la0, hi, sA], [la0, hi, sB], [la0, lo, sB]], [-1, 0, 0]); face(o1, [[la1, lo, sA], [la1, hi, sA], [la1, hi, sB], [la1, lo, sB]], [1, 0, 0]); }
  if (A.sill) face(A.sill, [[la0, ybot, sA], [la1, ybot, sA], [la1, ybot, sB], [la0, ybot, sB]], [0, -1, 0]); // underside
  for (const f of [0, 1] as const) { // the lintel's upper band, above the fasciae, on each carved face (unframed faces lie in the wall)
    if (!A.framed[f]) continue; const c = f ? A.c1 : A.c0;
    face(A.lintel, [[la0 + l, A.yh + Wt - l, c], [la1 - l, A.yh + Wt - l, c], [la1 - l, yTop, c], [la0 + l, yTop, c]], [0, 0, f ? 1 : -1]);
  }
  for (const f of [0, 1] as const) { // a face not carved (it lies against another part: a niche's back in the wall) keeps its plain box faces
    if (A.framed[f]) continue; const c = f ? A.c1 : A.c0, nn = [0, 0, f ? 1 : -1];
    face(A.jambs[0], [[la0, yb, c], [A.a0, yb, c], [A.a0, A.yh, c], [la0, A.yh, c]], nn); face(A.jambs[1], [[A.a1, yb, c], [la1, yb, c], [la1, A.yh, c], [A.a1, A.yh, c]], nn);
    face(A.lintel, [[la0, A.yh, c], [la1, A.yh, c], [la1, A.lintel.y1, c], [la0, A.lintel.y1, c]], nn);
    if (A.sill) face(A.sill, [[la0, A.sill.y0, c], [la1, A.sill.y0, c], [la1, yb, c], [la0, yb, c]], nn);
  }
  if (!A.cornice) { // no cornice block: the lintel's top is seen
    face(A.lintel, [[la0, A.lintel.y1, A.c0], [la1, A.lintel.y1, A.c0], [la1, A.lintel.y1, A.c1], [la0, A.lintel.y1, A.c1]], [0, 1, 0]); return; }
  // the cornice: the profile swept round the lintel on every side the block projects (≥ 1 cm), mitred
  const K = A.cornice, cx = (1 - A.ax) as 0 | 1, [ka0, ka1] = ext(K, A.ax), [kc0, kc1] = ext(K, cx);
  const proj = { a0: la0 - ka0, a1: ka1 - la1, c0: A.c0 - kc0, c1: kc1 - A.c1 }, on = (k: keyof typeof proj) => proj[k] > 0.01;
  const cor = L.rows.cornice, H = K.y1 - K.y0, sy = H / F.cornice_height;
  // per side: the lintel face line (from, to) along the side, the outward direction, the mitre neighbours
  const csides: { k: keyof typeof proj; o: number[]; line: (t: number, o: number, y: number) => number[]; lo: number; hi: number; prev: keyof typeof proj; next: keyof typeof proj }[] = [
    { k: 'c1', o: [0, 0, 1], line: (t, o, y) => [t, y, A.c1 + o], lo: la0, hi: la1, prev: 'a0', next: 'a1' },
    { k: 'c0', o: [0, 0, -1], line: (t, o, y) => [t, y, A.c0 - o], lo: la0, hi: la1, prev: 'a0', next: 'a1' },
    { k: 'a1', o: [1, 0, 0], line: (t, o, y) => [la1 + o, y, t], lo: A.c0, hi: A.c1, prev: 'c0', next: 'c1' },
    { k: 'a0', o: [-1, 0, 0], line: (t, o, y) => [la0 - o, y, t], lo: A.c0, hi: A.c1, prev: 'c0', next: 'c1' },
  ];
  for (const s of csides) {
    if (!on(s.k)) continue;
    const scale = proj[s.k] / F.cornice_projection, len = s.hi - s.lo, nT = Math.max(1, Math.round(len / S.tongue_pitch)), uk = (nT * S.tongue_pitch) / len / P; // (a whole number of tongues along the side)
    for (let i = 0; i + 1 < cor.pts.length; i++) {
      const [o0, y0] = cor.pts[i], [o1, y1] = cor.pts[i + 1], O0 = o0 * scale, O1 = o1 * scale, Y0 = K.y0 + y0 * sy, Y1 = K.y0 + y1 * sy;
      const ext0 = (O: number, o: number, nb: keyof typeof proj) => on(nb) ? (o * proj[nb]) / F.cornice_projection : 0; // (a mitre with a projecting neighbour; flush against an unswept one)
      const r0 = [s.lo - ext0(O0, o0, s.prev), s.hi + ext0(O0, o0, s.next)], r1 = [s.lo - ext0(O1, o1, s.prev), s.hi + ext0(O1, o1, s.next)];
      const pts = [s.line(r0[0], O0, Y0), s.line(r0[1], O0, Y0), s.line(r1[1], O1, Y1), s.line(r1[0], O1, Y1)];
      const dO = O1 - O0, dY = Y1 - Y0, nl = Math.hypot(dO, dY) || 1, no = dY / nl, ny = -dO / nl;
      const n = [s.o[0] * no, ny, s.o[2] * no];
      const uvs = [[(r0[0] - s.lo) * uk, vOf(L, cor, cor.cum[i])], [(r0[1] - s.lo) * uk, vOf(L, cor, cor.cum[i])], [(r1[1] - s.lo) * uk, vOf(L, cor, cor.cum[i + 1])], [(r1[0] - s.lo) * uk, vOf(L, cor, cor.cum[i + 1])]];
      Q.quad(y1 <= 0 ? A.lintel : K, pts, uvs, n);
    }
  }
  // the top: the block's top inside the profiles' top leads
  const oTop = cor.pts[cor.pts.length - 1][0] / F.cornice_projection, reach = (k: keyof typeof proj) => oTop * proj[k]; // (the top lead's inner edge, per side)
  const inA0 = on('a0') ? la0 - reach('a0') : ka0, inA1 = on('a1') ? la1 + reach('a1') : ka1, inC0 = on('c0') ? A.c0 - reach('c0') : kc0, inC1 = on('c1') ? A.c1 + reach('c1') : kc1;
  face(K, [[inA0, K.y1, inC0], [inA1, K.y1, inC0], [inA1, K.y1, inC1], [inA0, K.y1, inC1]], [0, 1, 0]);
}
