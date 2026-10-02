// The roofs' wear from the simulation (s17 C1, D-550; handoff/briefs/s16/deeds_render.md): a house whose roof lets the rain
// in (sim.deeds.joint.roofOf < ROOF.leak, D-462) shows a patch of darker, slumped roof plaster over its main room and a jar set
// on the floor under it to catch the drips; a roof plastered this year (by the household's yearly upkeep, by the neighbours or
// by the stranger: roofOf > FRESH) shows a pale fresh patch where the new coat was laid. One instanced patch mesh and the
// modelled water jar (lod1), within DRAW_R of the eye; rebuilt when the day changes or the eye moves 15 m. All C (the leak
// and the patch: the region's flat earth roofs, RECOLLECTION; the patch's form by reasoning).
import * as THREE from 'three/webgpu';
import { propMaterial } from '../../render/materials';
import { modelParts, aoFactor } from '../../render/scanProps';
import { hashString } from '../../core/rng';
import { HOUSE_KINDS } from './houseplan';
import type { SiteHouses } from './houses';

const DRAW_R = 110, LEAK = 0.45, FRESH = 0.93;
/** the jar's fired clay (linear) */
const CLAY = new THREE.Color().setRGB(0.66, 0.46, 0.32, THREE.SRGBColorSpace).toArray();
interface Spot { plot: string; e: number; n: number; y: number; floor: number; rot: number; s: number }
const h01 = (s: string, k: number) => hashString(`${s}:${k}`) / 4294967296;

/** a slumped patch of roof plaster, ~1.6 x 1.3 m, its middle sunk 4.5 cm, its edge a soft lobed line (unit scale) */
function patchGeometry(): THREE.BufferGeometry {
  const N = 22, rings = [1, 0.62, 0.28], drop = [0, -0.025, -0.045], pos: number[] = [0, -0.05, 0], col: number[] = [0.8, 0.8, 0.8], idx: number[] = [];
  for (let r = 0; r < rings.length; r++) for (let i = 0; i < N; i++) { const a = (i / N) * Math.PI * 2, w = 1 + 0.18 * Math.sin(3 * a + 0.7) + 0.1 * Math.sin(5 * a + 2.1) + 0.06 * Math.sin(9 * a);
    pos.push(Math.cos(a) * 0.8 * w * rings[r], drop[r] + (r === 0 ? 0.004 * Math.sin(7 * a) : 0), Math.sin(a) * 0.65 * w * rings[r]); const c = r === 0 ? 0.92 : 0.78 + 0.05 * r; col.push(c, c, c); }
  const at = (r: number, i: number) => 1 + r * N + (i % N);
  for (let i = 0; i < N; i++) { idx.push(0, at(2, i + 1), at(2, i)); for (let r = 0; r < 2; r++) idx.push(at(r, i), at(r + 1, i), at(r + 1, i + 1), at(r, i), at(r + 1, i + 1), at(r, i + 1)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  // (wound for an upward face)
  g.computeVertexNormals(); const n = g.getAttribute('normal'); let up = 0; for (let i = 0; i < n.count; i++) up += n.getY(i); if (up < 0) { const ix = g.getIndex()!.array as unknown as number[]; for (let t = 0; t < ix.length; t += 3) { const a = ix[t + 1]; ix[t + 1] = ix[t + 2]; ix[t + 2] = a; } g.getIndex()!.needsUpdate = true; g.computeVertexNormals(); }
  g.computeBoundingSphere(); return g;
}

export class RoofWear {
  readonly group = new THREE.Group();
  readonly spots: Spot[] = [];
  private patch: THREE.InstancedMesh; private jars: THREE.InstancedMesh[] = [];
  private roofOf: ((plot: string) => number) | null = null;
  private lastDay = -1; private last: [number, number] = [1e9, 1e9];
  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private up = new THREE.Vector3(0, 1, 0); private v = new THREE.Vector3(); private sc = new THREE.Vector3(); private c = new THREE.Color();
  readonly stats = { leaking: 0, fresh: 0, drawnLeak: 0, drawnFresh: 0 };
  constructor(houses: SiteHouses[]) {
    this.group.name = 'roofwear';
    this.group.userData = { tier: 'C', src: 'RECON', note: 'the roofs\' wear from the simulation: a leaking roof\'s slumped dark plaster and the drip jar under it, a fresh pale coat after a replastering (s17 C1, D-550; D-462 roofOf)' };
    for (const hs of houses) { const s = hs.s;
      const best = new Map<number, (typeof hs.rooms)[0]>(); for (const r of hs.rooms) { if (!r.full || r.i1 - r.i0 < 2 || r.j1 - r.j0 < 2 || !HOUSE_KINDS.has(s.plots[r.plot].kind)) continue; const b = best.get(r.plot);
        if (!b || (r.i1 - r.i0) * (r.j1 - r.j0) > (b.i1 - b.i0) * (b.j1 - b.j0)) best.set(r.plot, r); }
      for (const [pl, r] of best) { const id = s.plots[pl].id, w = r.i1 - r.i0, d = r.j1 - r.j0;
        const u = s.u0 + r.i0 + 0.9 + (w - 1.8) * h01(id, 1), v = s.v0 + r.j0 + 0.9 + (d - 1.8) * h01(id, 2), [e, n] = s.grid(u, v);
        this.spots.push({ plot: id, e, n, y: r.R - 0.03, floor: hs.base[pl], rot: h01(id, 3) * Math.PI * 2, s: Math.min(1, Math.min(w, d) / 2.4) * (0.75 + 0.3 * h01(id, 4)) }); } }
    const cap = 160;
    this.patch = new THREE.InstancedMesh(patchGeometry(), propMaterial('mud', { vertexColors: true }), cap); this.patch.count = 0; this.patch.frustumCulled = false; this.patch.receiveShadow = true;
    this.patch.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); this.patch.name = 'roofwear:patch'; this.patch.userData = this.group.userData;
    (this.patch.material as THREE.Material).polygonOffset = true; (this.patch.material as THREE.Material).polygonOffsetFactor = -2; this.group.add(this.patch);
    const parts = modelParts('jar_water', 1);
    if (parts) for (const [part, g0] of Object.entries(parts)) { const g = new THREE.BufferGeometry(), N = g0.getAttribute('position').count, col = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) { const a = aoFactor(g0, i); col[i * 3] = CLAY[0] * a; col[i * 3 + 1] = CLAY[1] * a; col[i * 3 + 2] = CLAY[2] * a; }
      g.setAttribute('position', g0.getAttribute('position')); g.setAttribute('normal', g0.getAttribute('normal') ?? (g0.computeVertexNormals(), g0.getAttribute('normal'))); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); if (g0.index) g.setIndex(g0.index); g.computeBoundingSphere();
      const m = new THREE.InstancedMesh(g, propMaterial('clay', { vertexColors: true }), 80); m.count = 0; m.frustumCulled = false; m.receiveShadow = true; m.castShadow = true; m.name = `roofwear:drip_jar:${part}`;
      m.userData = { tier: 'C', src: 'RECON', note: 'a jar set under the leaking roof to catch the drips (C; D-550)' }; this.jars.push(m); this.group.add(m); }
  }
  /** the simulation's roofs: `roofOf(plotId)` -> 0..1 today (the household living there; 1 when none) */
  setSource(roofOf: (plot: string) => number) { this.roofOf = roofOf; this.lastDay = -1; this.onSource?.(roofOf); }
  /** s17 C1: others that follow the same roofs (the walls' fresh coat: wallwear.ts) */
  onSource: ((roofOf: (plot: string) => number) => void) | null = null;
  /** households (Population.households: id, plot) and the sim's joint deeds' roofOf(hh, day); `today` the sim's day */
  static source(households: ArrayLike<{ id: number; plot?: string } | undefined>, roofOf: (hh: string, day: number) => number, today: () => number) {
    const byPlot = new Map<string, number>(); for (let i = 0; i < households.length; i++) { const H = households[i]; if (H?.plot) byPlot.set(H.plot, H.id); }
    return (plot: string) => { const hh = byPlot.get(plot); return hh === undefined ? 1 : roofOf(`h:${hh}`, today()); };
  }
  update(day: number, eye: { x: number; z: number }, force = false): boolean {
    const ce = eye.x, cn = -eye.z; if (!this.roofOf) { this.patch.visible = false; for (const j of this.jars) j.visible = false; return false; }
    if (!force && day === this.lastDay && Math.hypot(ce - this.last[0], cn - this.last[1]) < 15) return false;
    this.lastDay = day; this.last = [ce, cn]; let np = 0, nj = 0; const st = this.stats; st.drawnLeak = st.drawnFresh = 0;
    for (const sp of this.spots) { if (Math.hypot(sp.e - ce, sp.n - cn) > DRAW_R || np >= this.patch.instanceMatrix.count) continue;
      const r = this.roofOf(sp.plot); if (r >= LEAK && r <= FRESH) continue; const leak = r < LEAK;
      this.q.setFromAxisAngle(this.up, sp.rot); this.m4.compose(this.v.set(sp.e, sp.y, -sp.n), this.q, this.sc.set(sp.s, leak ? 1 : 0.4, sp.s));
      this.patch.setMatrixAt(np, this.m4); if (leak) this.c.setRGB(0.36, 0.29, 0.22, THREE.SRGBColorSpace); else this.c.setRGB(0.8, 0.72, 0.6, THREE.SRGBColorSpace); this.patch.setColorAt(np, this.c); np++;
      if (leak) { st.drawnLeak++; if (nj < 80) { this.m4.compose(this.v.set(sp.e, sp.floor, -sp.n), this.q, this.sc.set(0.85, 0.85, 0.85)); for (const j of this.jars) { j.setMatrixAt(nj, this.m4); } nj++; } } else st.drawnFresh++; }
    this.patch.count = np; this.patch.visible = np > 0; if (np) { this.patch.instanceMatrix.needsUpdate = true; this.patch.instanceColor!.needsUpdate = true; }
    for (const j of this.jars) { j.count = nj; j.visible = nj > 0; if (nj) j.instanceMatrix.needsUpdate = true; }
    return true;
  }
  /** the whole town's count today (tests, F3) */
  census(): { leaking: number; fresh: number; houses: number } { let l = 0, f = 0; if (this.roofOf) for (const sp of this.spots) { const r = this.roofOf(sp.plot); if (r < LEAK) l++; else if (r > FRESH) f++; }
    this.stats.leaking = l; this.stats.fresh = f; return { leaking: l, fresh: f, houses: this.spots.length }; }
}
