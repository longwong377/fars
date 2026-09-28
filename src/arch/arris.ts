// D-321 rev 2 (B145 approach 1): the dressed stone's free arrises as real geometry near the eye. Every bevelled free arris of a
// dressed-stone box part (meshes.ts bevelledBox: an edge no other part continues) is recorded at build time; ArrisField keeps,
// around the eye, a band of real geometry along each of them: the arris rounded as a lightly worn, fresh-dressed edge (radius
// 1.8 x the chamfer: 18 mm), and chipped where the stone was knocked in handling and setting (conchoidal scoops, Poisson along
// the arris, ~1 per metre, 7-48 mm: the rates and sizes of the carved set's fine strips, D-321), the chips real cavities that
// cast shadows and break the silhouette. Within R of the eye the base mesh discards its own arris band (materials.ts: the
// part's 'adist' < ARRIS_W) and the band draws it (the same surface material, a 'band' variant that keeps only what lies
// within R), so near the eye the arrises are geometry and beyond R they are the maps (the LOD by distance). The shadow pass
// runs the same masks, so the chips' shadows fall. 467: fresh, lightly handled edges, no ruin weathering (UD-20). Tier C.
import * as THREE from 'three/webgpu';
import { uniform, positionWorld, interleavedGradientNoise, screenCoordinate, frameId, float, vec2, step } from 'three/tsl';
import type { Box } from './parts';
import BF from '../data/blockface.json';
import STRIP_CHIPS from '../data/blockface_chips.json';

/** the surfaces whose free arrises are geometry near the eye (the dressed stone of the block-face class, D-321) */
export const ARRIS_MATS = new Set(['limestone', 'terrace', 'terrace_foot']);

/** the band's width on each face (m from the sharp corner line); the base mesh discards its arris zone inside it */
export const ARRIS_W = 0.04;
/** the band runs this far (m) past ARRIS_W, over the base mesh's face (coplanar, the same shading): no crack where they meet */
export const ARRIS_LAP = 0.006;
/** the radius (m) within which the arrises are geometry; from ARRIS_R0 to ARRIS_R the hand-over to the maps is a crossfade
 *  (rev 3): the threshold dithered per pixel and per frame (interleaved gradient noise), so TRAA resolves it to a blend */
export const ARRIS_R = 12, ARRIS_R0 = 9.5;
/** 1 where this fragment of the arris is drawn by the band, 0 where by the base mesh's maps (the same pixel, the same frame:
 *  the two masks are exact complements) */
export function arrisNear(): any {
  const ign = interleavedGradientNoise(screenCoordinate.xy.add(vec2(float(frameId).mod(64).mul(5.588238))));
  return step(positionWorld.distance(ARRIS_EYE), float(ARRIS_R0).add(ign.mul(ARRIS_R - ARRIS_R0)));
}
/** the eye for the masks (world); far away (no band anywhere) until an ArrisField updates it */
export const ARRIS_EYE = uniform(new THREE.Vector3(1e7, 1e7, 1e7));
/** rev 3: the geometry's chips are the maps' own: the fine strip layer's chips (tools/blender/blockface.py records every one it
 *  carves: src/data/blockface_chips.json), at the places the shader reads them for this arris (its strip row and offset from the
 *  edge's seed, 'aseed'; along the arris's canonical direction ARRIS_K), so nothing moves at the hand-over */
export const CHIPS = { rate: 1.0, endGap: 0.02 };
/** the canonical direction along an arris: the edge direction, signed to point along ARRIS_K (the shader signs it the same way) */
export const ARRIS_K: [number, number, number] = [0.8, 0.13, 0.59];
/** an edge's seed from its midpoint (world), and its strip row and offset (fraction of the tile) */
export function edgeSeed(m: { x: number; y: number; z: number }): number { return Math.abs(Math.sin(m.x * 12.9898 + m.y * 78.233 + m.z * 37.719) * 43758.5453) % 1; }
export const seedRow = (seed: number) => Math.floor(((seed * 7.13) % 1) * BF.strip_rows);
export const seedOff = (seed: number) => (seed * 13.7) % 1;
/** 'aseed' packs row + offset x 0.999 */
export const aseedOf = (seed: number) => seedRow(seed) + seedOff(seed) * 0.999;

export interface ArrisEdge {
  mat: string; a: THREE.Vector3; b: THREE.Vector3; na: THREE.Vector3; nb: THREE.Vector3; r: number; seed: number; /** the rough strips' chips (the foot) */ rough?: boolean;
  /** the box's bounding planes (world: n·x <= d), the band is kept inside them */
  planes: { n: THREE.Vector3; d: number }[];
  y0a: number; y0b: number; pbox: [number, number, number, number]; ytop: number; stair: [number, number, number, number];
}
const FACE_N: [number, number, number][] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
/** the edges of a bevelled box part (meshes.ts): `edges` the free-arris flags in BOX_EDGES order, `boxEdges` BOX_EDGES, `r`
 *  the chamfer, `rg` its render geometry with the part attributes (y0 per face, pbox, ytop, stair) */
export function arrisEdgesOfBox(b: Box, edges: boolean[], boxEdges: [number, number][], r: number, rg: THREE.BufferGeometry): ArrisEdge[] {
  const h: [number, number, number] = [b.size[0] / 2, (b.y1 - b.y0) / 2, b.size[1] / 2], rot = b.rot ?? 0;
  const M = new THREE.Matrix4().makeRotationY(rot).setPosition(b.c[0], (b.y0 + b.y1) / 2, -b.c[1]), R3 = new THREE.Matrix3().setFromMatrix4(M);
  const dot = (n: number[], q: number[]) => n[0] * q[0] + n[1] * q[1] + n[2] * q[2];
  const local: { n: number[]; d: number }[] = FACE_N.map(n => ({ n, d: Math.abs(dot(n, h)) }));
  boxEdges.forEach(([i, j], k) => { if (!edges[k]) return; const s = Math.SQRT1_2, n = [0, 1, 2].map(c => (FACE_N[i][c] + FACE_N[j][c]) * s); local.push({ n, d: (local[i].d + local[j].d - r) * s }); });
  const planes = local.map(P => { const n = new THREE.Vector3(...(P.n as [number, number, number])).applyMatrix3(R3).normalize(); const o = new THREE.Vector3(...(P.n as [number, number, number])).multiplyScalar(P.d).applyMatrix4(M); return { n, d: n.dot(o) }; });
  // y0 per face: the render geometry's vertices of that face (its normal)
  const N = rg.getAttribute('normal'), Y0 = rg.getAttribute('y0'), PB = rg.getAttribute('pbox'), ST = rg.getAttribute('stair');
  const y0Of = (n: THREE.Vector3) => { for (let i = 0; i < N.count; i++) if (Math.abs(N.getX(i) - n.x) + Math.abs(N.getY(i) - n.y) + Math.abs(N.getZ(i) - n.z) < 1e-3) return Y0.getX(i); return -1000; };
  const pbox: [number, number, number, number] = [PB.getX(0), PB.getY(0), PB.getZ(0), PB.getW(0)], stair: [number, number, number, number] = [ST.getX(0), ST.getY(0), ST.getZ(0), ST.getW(0)];
  const out: ArrisEdge[] = [];
  boxEdges.forEach(([i, j], k) => {
    if (!edges[k]) return;
    const ax = [0, 1, 2].find(c => FACE_N[i][c] === 0 && FACE_N[j][c] === 0)!;
    const c = [0, 1, 2].map(q => (FACE_N[i][q] + FACE_N[j][q]) * h[q]);
    const p0 = [...c], p1 = [...c]; p0[ax] = -h[ax]; p1[ax] = h[ax];
    const a = new THREE.Vector3(...(p0 as [number, number, number])).applyMatrix4(M), bb = new THREE.Vector3(...(p1 as [number, number, number])).applyMatrix4(M);
    const na = planes[i].n.clone(), nb = planes[j].n.clone();
    const seed = edgeSeed(a.clone().add(bb).multiplyScalar(0.5));
    out.push({ mat: b.material, a, b: bb, na, nb, r, seed, planes, y0a: y0Of(na), y0b: y0Of(nb), pbox, ytop: b.y1, stair });
  });
  return out;
}

export interface Chip { s: number; a: number; b: number; D: number }
const FINE = (STRIP_CHIPS as any).strip_fine as number[][][], ROUGH = (STRIP_CHIPS as any).strip_rough as number[][][]; // per row: [x, a, b, D, th] in mm
/** the chips along an edge of length L: those of its strip row, where the shader's along coordinate reads them */
export function chipsOf(e: ArrisEdge, L: number): Chip[] {
  const S = BF.size_m, t = e.b.clone().sub(e.a).divideScalar(L), K = new THREE.Vector3(...ARRIS_K), g = Math.sign(t.dot(K)) || 1;
  const tc = t.clone().multiplyScalar(g), A0 = e.a.dot(tc), off = seedOff(e.seed) * S, out: Chip[] = [];
  // along(s) = A0 + g s; the texture's x = (along + off) mod S
  for (const [x, a, b, D] of (e.rough ? ROUGH : FINE)[seedRow(e.seed)] ?? []) {
    const X = x / 1000, lo = Math.min(A0, A0 + g * L) + off, hi = Math.max(A0, A0 + g * L) + off;
    for (let k = Math.floor((lo - X) / S); X + k * S <= hi; k++) {
      const s = (X + k * S - off - A0) / g, am = a / 1000;
      if (s > CHIPS.endGap + am && s < L - CHIPS.endGap - am) out.push({ s, a: am, b: Math.min(b / 1000, ARRIS_W * 0.9), D: D / 1000 });
    }
  }
  return out.sort((p, q) => p.s - q.s);
}
/** the scoop's depth at normalised radius rr (the carving's chip_cut: D (1 - rr)^1.4 + a 12 % hinge, blockface.py) */
const scoop = (rr2: number) => rr2 >= 1 ? 0 : Math.pow(1 - Math.sqrt(rr2), 1.4) + 0.12;
/** the band's cross-section: (u, v) = distances from face B's plane (into face A) and from face A's plane, for the nominal
 *  (unchipped) profile: face A from ARRIS_W to the rounding, the worn arc (radius rho, tangent to both faces), face B back out */
export function profile(r: number): [number, number][] {
  const rho = 1.8 * r, out: [number, number][] = [], K = 4;
  for (const u of [ARRIS_W + ARRIS_LAP, 0.026]) if (u > rho + 0.002) out.push([u, 0]);
  for (let i = 0; i <= K; i++) { const th = (Math.PI / 2) * i / K; out.push([rho * (1 - Math.sin(th)), rho * (1 - Math.cos(th))]); }
  for (const v of [0.026, ARRIS_W + ARRIS_LAP]) if (v > rho + 0.002) out.push([0, v]);
  return out;
}

/** one edge's band over s in [s0, s1] (m along it): positions, normals and the part attributes (non-indexed triangles) */
export function bandGeometry(e: ArrisEdge, s0: number, s1: number, out: { pos: number[]; nrm: number[]; y0: number[]; pbox: number[]; ytop: number[]; stair: number[]; adist: number[]; aseed: number[]; index: number[] }, adistOff: number): number {
  const L = e.a.distanceTo(e.b), t = e.b.clone().sub(e.a).divideScalar(L);
  s0 = Math.max(0, s0); s1 = Math.min(L, s1); if (s1 - s0 < 0.01) return 0;
  const P = profile(e.r), chips = chipsOf(e, L).filter(c => c.s + c.a > s0 && c.s - c.a < s1);
  // stations along the edge: the ends, and across each chip (a straight arris needs no others)
  const S = new Set<number>([s0, s1]);
  // and near the edge's own ends, where the corner's other chamfers clip the band (clamped there, straight beyond: without these
  // stations the clamp at the end station tilted the whole run, 5 mm into the stone)
  for (const d of [0.012, 0.045]) for (const s of [d, L - d]) if (s > s0 && s < s1) S.add(s);
  for (const c of chips) for (const f of [-1.1, -0.65, -0.3, 0, 0.3, 0.65, 1.1]) { const s = c.s + f * c.a; if (s > s0 && s < s1) S.add(s); }
  const st = [...S].sort((x, y) => x - y).filter((s, i, a) => i === 0 || s - a[i - 1] > 5e-4);
  const nS = st.length, nP = P.length, V: THREE.Vector3[] = [];
  const X = new THREE.Vector3();
  for (const s of st) {
    const C0 = e.a.clone().addScaledVector(t, s);
    for (const [u0, v0] of P) {
      let u = u0, v = v0;
      for (const c of chips) {
        const q = ((s - c.s) / c.a) ** 2; if (q >= 1) continue;
        // both faces read the same strip row at the same place (the maps): the scoop into each, as the carving cut it
        v = Math.max(v, c.D * scoop(q + (u0 / c.b) ** 2)); u = Math.max(u, c.D * scoop(q + (v0 / c.b) ** 2));
      }
      X.copy(C0).addScaledVector(e.nb, -u).addScaledVector(e.na, -v);
      for (let it = 0; it < 2; it++) for (const pl of e.planes) { const o = pl.n.dot(X) - pl.d; if (o > 0) X.addScaledVector(pl.n, -o); } // inside the part's own chamfered box
      V.push(X.clone());
    }
  }
  // normals: area-weighted over the grid's quads
  const Nn = V.map(() => new THREE.Vector3()), q = new THREE.Vector3(), w = new THREE.Vector3();
  const id = (i: number, j: number) => i * nP + j;
  for (let i = 0; i + 1 < nS; i++) for (let j = 0; j + 1 < nP; j++) {
    const a = V[id(i, j)], b = V[id(i + 1, j)], c = V[id(i + 1, j + 1)], d = V[id(i, j + 1)];
    q.subVectors(c, a); w.subVectors(d, b); const n = new THREE.Vector3().crossVectors(q, w);
    // (the winding: outward is away from the corner line; flip to agree with na + nb)
    if (n.dot(e.na) + n.dot(e.nb) < 0) n.negate();
    for (const k of [id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)]) Nn[k].add(n);
  }
  for (const n of Nn) n.normalize();
  // indexed: the grid's vertices, then two triangles per quad (counter-clockwise seen from outside)
  let tris = 0; const v0i = out.pos.length / 3;
  for (let k = 0; k < V.length; k++) {
    const p = V[k], n = Nn[k], [u0, v0] = P[k % nP]; out.pos.push(p.x, p.y, p.z); out.nrm.push(n.x, n.y, n.z);
    out.y0.push(v0 < u0 ? e.y0a : e.y0b); out.pbox.push(...e.pbox); out.ytop.push(e.ytop); out.stair.push(...e.stair);
    out.adist.push(Math.min(u0, v0) - adistOff, 0, 0, 0); out.aseed.push(aseedOf(e.seed), 0, 0, 0);
  }
  const ab = new THREE.Vector3(), ad = new THREE.Vector3(), cr = new THREE.Vector3();
  for (let i = 0; i + 1 < nS; i++) for (let j = 0; j + 1 < nP; j++) {
    const a = id(i, j), b = id(i + 1, j), c = id(i + 1, j + 1), d = id(i, j + 1);
    const flip = cr.crossVectors(ab.subVectors(V[b], V[a]), ad.subVectors(V[d], V[a])).dot(Nn[a]) < 0;
    for (const k of flip ? [a, d, c, a, c, b] : [a, b, c, a, c, d]) out.index.push(v0i + k);
    tris += 2;
  }
  return tris;
}

type Buf = { pos: number[]; nrm: number[]; y0: number[]; pbox: number[]; ytop: number[]; stair: number[]; adist: number[]; aseed: number[] };
const ATTR: [keyof Buf, number][] = [['pos', 3], ['nrm', 3], ['y0', 1], ['pbox', 4], ['ytop', 1], ['stair', 4], ['adist', 4], ['aseed', 4]];
/** a piece of an edge's band, built once and kept while it stays near */
interface Piece { mat: string; data: Record<keyof Buf, Float32Array>; index: Uint32Array; tris: number }
/** the near-field bands. The edges are cut in pieces of PIECE m; the pieces are grouped by CELL m plan cells, and a cell is drawn by
 *  its own mesh per surface once all its pieces are built. A cell is built when it comes within reach of the eye (at most
 *  `budgetMs` of building per call: call update() every frame; the first call builds all it needs) and dropped when it is well
 *  out of reach, so a step of the eye costs building the few pieces at the rim and assembling their cells (~1-5 ms each). Draws:
 *  the cells within reach (~15 at the stairs), their triangles 10-110 k */
export const PIECE = 1.5;
export class ArrisField {
  readonly group = new THREE.Group();
  private cell = 8; private last = new THREE.Vector3(1e9, 0, 0); private first = true;
  private pieces: { e: number; s0: number; s1: number; mid: THREE.Vector3; half: number }[] = [];
  private cells = new Map<number, { ids: number[]; cx: number; cz: number; built: Map<number, Piece>; meshes: THREE.Mesh[] | null }>();
  private want: number[] = [];
  stats = { cells: 0, triangles: 0, ms: 0, pending: 0, draws: 0, ready: false };
  constructor(private edges: ArrisEdge[], private material: (mat: string) => THREE.Material, private adistOff: number, readonly step = 1.5, readonly budgetMs = 3) {
    this.group.name = 'arris-bands';
    this.index(edges, 0);
  }
  /** more edges (the foot's blocks, the wall joints: rev 4), before the first update */
  add(edges: ArrisEdge[]): void { const i0 = this.edges.length; this.edges.push(...edges); this.index(edges, i0); }
  private index(edges: ArrisEdge[], i0: number): void {
    edges.forEach((e, ii) => { const i = i0 + ii;
      const L = e.a.distanceTo(e.b), n = Math.max(1, Math.ceil(L / PIECE));
      for (let k = 0; k < n; k++) {
        const s0 = (L * k) / n, s1 = (L * (k + 1)) / n, mid = e.a.clone().lerp(e.b, (s0 + s1) / 2 / L), id = this.pieces.length;
        this.pieces.push({ e: i, s0, s1, mid, half: (s1 - s0) / 2 });
        const cx = Math.floor(mid.x / this.cell), cz = Math.floor(mid.z / this.cell), kk = cx * 100003 + cz;
        (this.cells.get(kk) ?? this.cells.set(kk, { ids: [], cx, cz, built: new Map(), meshes: null }).get(kk)!).ids.push(id);
      }
    });
  }
  get count() { return this.edges.length; }
  private build(id: number): Piece {
    const P = this.pieces[id], e = this.edges[P.e], B: Buf & { index: number[] } = { pos: [], nrm: [], y0: [], pbox: [], ytop: [], stair: [], adist: [], aseed: [], index: [] };
    const tris = bandGeometry(e, P.s0, P.s1, B, this.adistOff);
    const data = Object.fromEntries(ATTR.map(([k]) => [k, new Float32Array(B[k])])) as Record<keyof Buf, Float32Array>;
    return { mat: e.mat, data, index: new Uint32Array(B.index), tris };
  }
  /** `eye` null: the bands off (the Now view, or no arrises wanted): the base meshes draw their whole arrises */
  update(eye: THREE.Vector3 | null, budgetMs = this.budgetMs): void {
    if (!eye) { this.group.visible = false; ARRIS_EYE.value.set(1e7, 1e7, 1e7); this.last.set(1e9, 0, 0); return; }
    const t0 = performance.now(), reach = ARRIS_R + this.step + 1 + PIECE, C = this.cell;
    if (eye.distanceTo(this.last) >= this.step) {
      this.last.copy(eye);
      const dist = (c: { cx: number; cz: number }) => Math.hypot(Math.max(0, Math.abs(eye.x - (c.cx + 0.5) * C) - C / 2), Math.max(0, Math.abs(eye.z - (c.cz + 0.5) * C) - C / 2));
      this.want = [];
      for (const [k, c] of this.cells) {
        const d = dist(c);
        if (d < reach) this.want.push(k);
        else if (d > reach + C && (c.meshes || c.built.size)) { for (const m of c.meshes ?? []) { m.geometry.dispose(); this.group.remove(m); } c.meshes = null; c.built.clear(); }
      }
      this.want.sort((a, b) => dist(this.cells.get(a)!) - dist(this.cells.get(b)!));
    }
    let pending = 0; const budget = this.first ? 1e9 : budgetMs; this.first = false;
    for (const k of this.want) {
      const c = this.cells.get(k)!; if (c.meshes) continue;
      for (const id of c.ids) if (!c.built.has(id)) { if (performance.now() - t0 < budget) c.built.set(id, this.build(id)); else pending++; }
      if (c.built.size === c.ids.length) { if (performance.now() - t0 < budget) this.assemble(c); else pending++; } // (a cell's assembly waits for a frame with time left)
    }
    // the bands take over only when every cell within R of the eye is drawn (a teleport or a load waits for them; a walk builds
    // the cells ahead at the rim, beyond R): until then the base meshes draw every arris from the maps, so nothing is ever missing
    let ready = true;
    for (const k of this.want) { const c = this.cells.get(k)!; if (!c.meshes && Math.hypot(Math.max(0, Math.abs(eye.x - (c.cx + 0.5) * C) - C / 2), Math.max(0, Math.abs(eye.z - (c.cz + 0.5) * C) - C / 2)) < ARRIS_R + 0.5) { ready = false; break; } }
    this.group.visible = ready; if (ready) ARRIS_EYE.value.copy(eye); else ARRIS_EYE.value.set(1e7, 1e7, 1e7);
    let tris = 0, draws = 0, cells = 0; for (const k of this.want) { const c = this.cells.get(k)!; if (c.meshes) { cells++; for (const m of c.meshes) { draws++; tris += (m.geometry.index?.count ?? 0) / 3; } } }
    this.stats = { cells, triangles: tris, ms: Math.round(performance.now() - t0), pending, draws, ready };
  }
  private assemble(c: { ids: number[]; built: Map<number, Piece>; meshes: THREE.Mesh[] | null }): void {
    const by = new Map<string, Piece[]>();
    for (const id of c.ids) { const p = c.built.get(id)!; if (p.tris) (by.get(p.mat) ?? by.set(p.mat, []).get(p.mat)!).push(p); }
    c.meshes = [];
    for (const [mat, ps] of by) {
      const g = new THREE.BufferGeometry();
      for (const [k, w] of ATTR) {
        const len = ps.reduce((s, p) => s + p.data[k].length, 0), a = new Float32Array(len); let o = 0; for (const p of ps) { a.set(p.data[k], o); o += p.data[k].length; }
        g.setAttribute(k === 'pos' ? 'position' : k === 'nrm' ? 'normal' : k, new THREE.BufferAttribute(a, w));
      }
      const ilen = ps.reduce((s, p) => s + p.index.length, 0), I = new Uint32Array(ilen); let io = 0, vo = 0;
      for (const p of ps) { for (let q = 0; q < p.index.length; q++) I[io + q] = p.index[q] + vo; io += p.index.length; vo += p.data.pos.length / 3; }
      g.setIndex(new THREE.BufferAttribute(I, 1)); g.computeBoundingSphere();
      const m = new THREE.Mesh(g, this.material(mat)); m.castShadow = m.receiveShadow = true; m.raycast = () => {}; m.matrixAutoUpdate = false;
      m.name = `arris-band:${mat}`; m.userData = { tier: 'C', src: 'RECON', placeholder: false, note: 'D-321 rev 2: the free arrises near the eye as geometry: worn round (18 mm), chipped in handling (C)' };
      c.meshes.push(m); this.group.add(m);
    }
    c.built.clear(); // (the pieces' arrays are in the meshes now)
  }
}
