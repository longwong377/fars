// The court's camps drawn (D-199; court setting only, D-003): every tent of camps.ts (the court's camp below the Terrace,
// the retinue's camps in the town and on the plain), and a box collider per tent streamed near the player (as the
// settlement's). All C: nothing of a court camp at Persepolis is known (Q-333); the tent forms are camps.ts TENT_KINDS'.
// D-330: each tent is pitched cloth: the Blender cloth simulation of its kind on its poles (tools/blender/decor.mjs tents,
// src/world/tentForms.ts: the cloth sags between the ridge, the pole tops and the ropes, the walls hang in folds, the hems
// lie between the pegs), with its poles, guy ropes and pegs; three levels by distance (the simulated cloth with the rig, a
// decimated cloth with the poles, and beyond LOD1_M the ≤ 20-triangle shell of D-199), instanced per kind and level, so
// every tent of every camp takes the same path. The cloth takes the woven scan of the tent surface (hessian: scans.ts) and
// its colour per tent. Where the models are not loaded (?nodecor, or a failed load) every tent is its shell.
import * as THREE from 'three/webgpu';
import { Batch, lin, type RGB } from './settlement/geom';
import { surfaceMaterial, SURFACES, type SurfaceDef } from '../render/materials';
import { CAMP_BY_ID, TENT_KINDS, type Tent, type TentKind } from '../people/camps';
import type { Physics } from '../player/physics';
import { tentForm, RIG, type V3 } from './tentForms';
import { tentModel, withBakedMap } from '../render/decorAssets';

/** tent cloth for the shared surface model (weather wetting, relief): undyed wool, linen or goat hair; colour per tent
 *  from the vertex colours (C) */
export const TENT_SURFACES: Record<string, SurfaceDef> = {
  tent_cloth: { albedo: [0.62, 0.57, 0.48], roughness: 0.94, porosity: 0.75, noiseScale: 1.6, noiseAmp: 0.1, bump: { amp: 0.003, freq: 4 }, tier: 'C', note: 'tent cloth: woven wool, linen or goat hair (C; D-199)' },
};
/** the cloth colours by kind (sRGB; C): undyed wool and linen, black goat hair, the dyed cloth of the larger tents */
const CLOTH: Record<Tent['kind'], RGB[]> = {
  ridge: [[0.72, 0.66, 0.55], [0.66, 0.6, 0.5], [0.76, 0.71, 0.61], [0.6, 0.55, 0.45]],
  black: [[0.13, 0.115, 0.1], [0.16, 0.14, 0.12], [0.11, 0.1, 0.09]],
  pavilion: [[0.55, 0.27, 0.21], [0.3, 0.34, 0.45], [0.7, 0.62, 0.45], [0.5, 0.33, 0.25]],
};
const jit = (i: number, s: number) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };
const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
/** a tent's cloth colour (sRGB) */
export const tentColour = (t: Tent): RGB => { const pal = CLOTH[t.kind]; return pal[Math.floor(jit(t.i, 7) * pal.length)]; };

/** append one tent's shell to a batch (world coordinates: x = e, z = −n; y from the ground); `col` (sRGB) overrides its
 *  cloth colour (white: the instanced far level, coloured per instance) */
export function tentShell(b: Batch, t: Tent, groundAt: (e: number, n: number) => number, owner: number, col?: RGB) {
  const a = (t.heading * Math.PI) / 180, fe = Math.sin(a), fn = Math.cos(a), re = fn, rn = -fe; // forward (door) and right
  const hw = t.w / 2, hd = t.d / 2;
  let y0 = Infinity; for (const [u, v] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) y0 = Math.min(y0, groundAt(t.e + u * re + v * fe, t.n + u * rn + v * fn));
  const P = (u: number, v: number, y: number) => [t.e + u * re + v * fe, y0 + y, -(t.n + u * rn + v * fn)];
  const c = lin(col ?? tentColour(t)), cd = shade(c, 0.85), low = -0.12; // (walls reach below the lowest corner: no gap on a slope)
  const N = (p: number[], q: number[], r: number[]) => { const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]]; const x = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]], l = Math.hypot(x[0], x[1], x[2]) || 1; return [x[0] / l, x[1] / l, x[2] / l]; };
  const out = (p: number[]) => { const cx = t.e, cz = -t.n; return [p[0] - cx, 0, p[2] - cz]; }; // (the quad's own winding is fixed by the normal given)
  const quad = (p: number[], q: number[], r: number[], s: number[], col: RGB, n?: number[]) => { let nn = n ?? N(p, q, r); const m = [(p[0] + r[0]) / 2, 0, (p[2] + r[2]) / 2], o = out(m);
    if (!n && (Math.abs(nn[1]) >= 0.5 ? nn[1] < 0 : nn[0] * o[0] + nn[2] * o[2] < 0)) nn = nn.map(x => -x); // (roofs face up, walls out)
    b.quad(p, q, r, s, nn, col, col, col, col, owner); };
  const tri = (p: number[], q: number[], r: number[], col: RGB) => quad(p, q, r, r, col);
  if (t.kind === 'ridge') {
    const h = t.h, e = 0.4; // ridge height, low side walls
    quad(P(0, -hd, h), P(0, hd, h), P(-hw, hd, e), P(-hw, -hd, e), c); quad(P(0, -hd, h), P(0, hd, h), P(hw, hd, e), P(hw, -hd, e), c);
    quad(P(-hw, -hd, low), P(-hw, hd, low), P(-hw, hd, e), P(-hw, -hd, e), cd); quad(P(hw, -hd, low), P(hw, hd, low), P(hw, hd, e), P(hw, -hd, e), cd);
    // the back gable closed; the front gable's flaps tied back from a door 1 m wide
    quad(P(-hw, -hd, low), P(hw, -hd, low), P(hw, -hd, e), P(-hw, -hd, e), cd, [-fe, 0, fn]); tri(P(-hw, -hd, e), P(hw, -hd, e), P(0, -hd, h), cd);
    for (const sg of [-1, 1]) { quad(P(sg * hw, hd, low), P(sg * 0.5, hd, low), P(0, hd, h), P(sg * hw, hd, e), cd, [fe, 0, -fn]); }
  } else if (t.kind === 'black') {
    const h = t.h, front = 1.45, back = 0.35; // the ridge across the tent; the front raised on poles and open; the back pegged low
    quad(P(-hw, 0, h), P(hw, 0, h), P(hw, hd, front), P(-hw, hd, front), c); quad(P(-hw, 0, h), P(hw, 0, h), P(hw, -hd, back), P(-hw, -hd, back), c);
    quad(P(-hw, -hd, low), P(hw, -hd, low), P(hw, -hd, back), P(-hw, -hd, back), c, [-fe, 0, fn]);
    for (const sg of [-1, 1]) { quad(P(sg * hw, -hd, low), P(sg * hw, 0, low), P(sg * hw, 0, h), P(sg * hw, -hd, back), c); tri(P(sg * hw, 0, low), P(sg * hw, hd * 0.55, low), P(sg * hw, 0, h), c); }
  } else { // pavilion: walls on three sides and half the front, a pyramid roof
    const h = t.h, wall = 1.8, apex = P(0, 0, h), c2 = col ? c : lin([0.72, 0.64, 0.5]);
    const corners: [number, number][] = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
    for (let k = 0; k < 4; k++) { const [u0, v0] = corners[k], [u1, v1] = corners[(k + 1) % 4]; tri(P(u0, v0, wall), P(u1, v1, wall), apex, c2);
      if (k === 2) { for (const [ua, ub] of [[hw, 0.8], [-0.8, -hw]]) quad(P(ua, hd, low), P(ub, hd, low), P(ub, hd, wall), P(ua, hd, wall), c, [fe, 0, -fn]); } // the door in the front wall
      else quad(P(u0, v0, low), P(u1, v1, low), P(u1, v1, wall), P(u0, v0, wall), c); }
    quad(P(-0.8, hd, 2.0), P(0.8, hd, 2.0), P(0.8, hd, wall), P(-0.8, hd, wall), c, [fe, 0, -fn]); // (the lintel strip over the door)
  }
  return { y0 };
}

/** D-330: the rig of a kind (poles, guy ropes, pegs) in the tent's local frame (x right, y up, z = −forward), as geometry
 *  with linear vertex colours: level 0 everything (poles 8-sided, ropes 3-sided), level 1 the poles only (4-sided) */
export function rigGeometry(kind: TentKind, level: 0 | 1): THREE.BufferGeometry {
  const F = tentForm(kind), pos: number[] = [], nrm: number[] = [], col: number[] = [];
  const wood = lin([0.42, 0.33, 0.24]), rope = lin([0.64, 0.57, 0.44]), pegc = lin([0.36, 0.28, 0.2]);
  const tube = (a: V3, b: V3, r: number, sides: number, c: RGB, caps = false) => {
    const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], L = Math.hypot(d[0], d[1], d[2]) || 1, w = d.map(x => x / L);
    const ref = Math.abs(w[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], u = [w[1] * ref[2] - w[2] * ref[1], w[2] * ref[0] - w[0] * ref[2], w[0] * ref[1] - w[1] * ref[0]], ul = Math.hypot(u[0], u[1], u[2]);
    for (let k = 0; k < 3; k++) u[k] /= ul; const v = [w[1] * u[2] - w[2] * u[1], w[2] * u[0] - w[0] * u[2], w[0] * u[1] - w[1] * u[0]];
    const ring = (k: number) => { const t = (2 * Math.PI * k) / sides; return [Math.cos(t) * u[0] + Math.sin(t) * v[0], Math.cos(t) * u[1] + Math.sin(t) * v[1], Math.cos(t) * u[2] + Math.sin(t) * v[2]]; };
    for (let k = 0; k < sides; k++) { const n0 = ring(k), n1 = ring(k + 1);
      const p = (o: V3, n: number[]) => [o[0] + n[0] * r, o[1] + n[1] * r, o[2] + n[2] * r];
      for (const [o, n] of [[a, n0], [b, n0], [b, n1], [a, n0], [b, n1], [a, n1]] as [V3, number[]][]) { pos.push(...p(o, n)); nrm.push(...n); col.push(...c); } }
    if (caps) for (let k = 0; k < sides; k++) { const n0 = ring(k), n1 = ring(k + 1); for (const q of [b.map((x, i) => x) as number[], [b[0] + n1[0] * r, b[1] + n1[1] * r, b[2] + n1[2] * r], [b[0] + n0[0] * r, b[1] + n0[1] * r, b[2] + n0[2] * r]]) { pos.push(...q); nrm.push(...w); col.push(...c); } }
  };
  for (const p of F.poles) tube(p.a, p.b, p.r, level === 0 ? 8 : 4, wood, level === 0);
  if (level === 0) {
    for (const r of F.ropes) tube(r.a, r.b, RIG.ropeR, 3, rope);
    for (const g of F.pegs) tube([g[0], -0.12, g[2]], [g[0], 0.06, g[2]], 0.018, 4, pegc, true); // (a peg driven in, its head standing out)
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
/** the far level of a kind: its shell (D-199, ≤ 20 triangles) in the local frame, white (the instance colour tints it) */
export function shellGeometry(kind: TentKind): THREE.BufferGeometry {
  const K = TENT_KINDS[kind], b = new Batch();
  tentShell(b, { camp: '', i: 0, e: 0, n: 0, heading: 0, kind, w: K.w, d: K.d, h: K.h }, () => 0, 0, [1, 1, 1]);
  return b.toGeometry();
}

interface Col { x: number; y: number; z: number; hx: number; hy: number; hz: number; rot: number }
/** D-252: the hour of the year a tent stands from, rounded UP to the hour (a household's tents appear at the top of the hour
 *  after it has reached the camp: never before it; placeholder: no pitching is animated, B70) */
const pitchKey = (t: Tent) => (t.pitch === undefined ? -1 : Math.ceil(t.pitch));
/** D-330: the distances (m) at which a tent's cloth goes from the simulated level with its rig to the decimated level with
 *  its poles, and to the shell; hysteresis (m) */
export const TENT_LOD = { lod0: 40, lod1: 110, hyst: 3 } as const;
type Lvl = { mesh: THREE.InstancedMesh; tris: number; of: number[] /* instance → tent index */ };
/** the tents of the court setting's camps (court.ts CourtResidents.tents): instanced per kind and level (D-330); a tent stands
 *  from the hour its household reaches the camp until the leave day (D-252); colliders near the player for the tents standing */
export class CourtCampTents {
  readonly group = new THREE.Group();
  readonly info = { tents: 0, tris: 0, meshes: 0, colliders: 0, liveColliders: 0, buildMs: 0, standing: 0, modelled: [] as string[], byLevel: [0, 0, 0] };
  private cols: { c: [number, number]; r: number; boxes: Col[]; live: any[] | null; from: number; to: number; on: boolean; n: number }[] = [];
  private tNow = NaN;
  private tents: Tent[]; private M: THREE.Matrix4[] = []; private colour: THREE.Color[] = []; private group_of: number[] = []; private level: Uint8Array;
  private kinds = new Map<TentKind, { idx: number[]; levels: (Lvl | null)[]; rigs: (Lvl | null)[]; clothK: THREE.Color }>();
  private eye: [number, number] | null = null; private dirty = true;
  constructor(tents: Tent[], groundAt: (e: number, n: number) => number, private phys: Physics | null = null) {
    const t0 = performance.now(); Object.assign(SURFACES, TENT_SURFACES); this.tents = tents; this.level = new Uint8Array(tents.length).fill(2);
    this.group.name = 'court-camps'; this.group.userData = { tier: 'C', src: 'RECON;HDT', note: 'the court’s camps (court setting only, D-199): tents in lines (camps.ts), all C; Q-333' };
    // each tent's placement: on the ground's plane under its four corners (the frame tilts with a slope of ≤ 5 %), its colour
    for (const t of tents) {
      const a = (t.heading * Math.PI) / 180, fe = Math.sin(a), fn = Math.cos(a), hw = t.w / 2, hd = t.d / 2;
      const g = (u: number, v: number) => groundAt(t.e + u * fn + v * fe, t.n - u * fe + v * fn);
      const gA = g(-hw, -hd), gB = g(hw, -hd), gC = g(hw, hd), gD = g(-hw, hd), gu = ((gB + gC) - (gA + gD)) / (2 * t.w), gv = ((gC + gD) - (gA + gB)) / (2 * t.d);
      const y = (gA + gB + gC + gD) / 4 - 0.02;
      const m = new THREE.Matrix4().makeTranslation(t.e, y, -t.n).multiply(new THREE.Matrix4().makeRotationY(-a))
        .multiply(new THREE.Matrix4().makeRotationZ(Math.atan(gu))).multiply(new THREE.Matrix4().makeRotationX(Math.atan(gv)));
      this.M.push(m); const c = lin(tentColour(t)); this.colour.push(new THREE.Color(c[0], c[1], c[2]));
    }
    // per kind: the levels (the models when loaded), instanced over the kind's tents
    const cloth = lin(TENT_SURFACES.tent_cloth.albedo as RGB), clothK = new THREE.Color(1 / cloth[0], 1 / cloth[1], 1 / cloth[2]);
    const shellMat = surfaceMaterial('tent_cloth', { vertexColors: true }); shellMat.side = THREE.DoubleSide; // (the open doors and fronts show the undersides)
    const rigMat = surfaceMaterial('timber', { vertexColors: true });
    for (const kind of Object.keys(TENT_KINDS) as TentKind[]) {
      const idx = tents.map((t, i) => (t.kind === kind ? i : -1)).filter(i => i >= 0); if (!idx.length) continue;
      const TM = tentModel(kind), n = idx.length;
      const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, name: string, tint: boolean): Lvl => {
        const im = new THREE.InstancedMesh(geo, mat, n); im.count = 0; im.name = name; im.castShadow = im.receiveShadow = true;
        if (tint) im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
        const of: number[] = []; const L: Lvl = { mesh: im, tris: (geo.index ? geo.index.count : geo.getAttribute('position').count) / 3, of };
        im.userData = { tier: 'C', src: 'RECON;HDT', describe: (hit: any) => { const t = this.tents[of[hit?.instanceId ?? -1]]; if (!t) return null; const def = CAMP_BY_ID.get(t.camp);
          return { tier: 'C', src: def?.src ?? 'RECON', note: `a ${t.kind} tent of ${def?.label ?? t.camp}: ${TENT_KINDS[t.kind].note}${TM ? '; pitched cloth, simulated in Blender on its poles, ropes and pegs (D-330)' : ''} (court setting, D-199)` }; } };
        this.group.add(im); this.info.meshes++; return L;
      };
      const levels: (Lvl | null)[] = [null, null, null], rigs: (Lvl | null)[] = [null, null];
      if (TM && TM.lods.length >= 2) {
        for (const l of [0, 1] as const) { const mat = withBakedMap('tent_cloth', TM.maps[l], `tent_${kind}_${l}`); mat.side = THREE.DoubleSide; levels[l] = mk(TM.lods[l], mat, `court-camps:${kind}:cloth${l}`, true); rigs[l] = mk(rigGeometry(kind, l), rigMat, `court-camps:${kind}:rig${l}`, false); }
        this.info.modelled.push(kind);
      }
      levels[2] = mk(shellGeometry(kind), shellMat, `court-camps:${kind}:shell`, true);
      this.kinds.set(kind, { idx, levels, rigs, clothK });
    }
    // the colliders, streamed per camp and hour of pitching (as D-199/D-252)
    const byCamp = new Map<string, number[]>(); tents.forEach((t, i) => { const k = `${t.camp}|${pitchKey(t)}|${t.strike ?? -1}`; (byCamp.get(k) ?? byCamp.set(k, []).get(k)!).push(i); });
    for (const [, list] of byCamp) {
      const t0_ = tents[list[0]], def = CAMP_BY_ID.get(t0_.camp)!, from = pitchKey(t0_) < 0 ? -Infinity : pitchKey(t0_), to = t0_.strike ?? Infinity, boxes: Col[] = []; let r = 0;
      for (const i of list) { const t = tents[i], y = this.M[i].elements[13]; r = Math.max(r, Math.hypot(t.e - def.c[0], t.n - def.c[1]) + Math.max(t.w, t.d));
        boxes.push({ x: t.e, y: y + t.h / 2, z: -t.n, hx: t.w / 2, hy: t.h / 2, hz: t.d / 2, rot: Math.PI - (t.heading * Math.PI) / 180 }); }
      const ci = this.cols.length; for (const i of list) this.group_of[i] = ci;
      this.cols.push({ c: def.c, r, boxes, live: null, from, to, on: true, n: list.length }); this.info.colliders += boxes.length;
    }
    this.info.tents = tents.length; this.assign();
    this.info.buildMs = performance.now() - t0;
  }
  /** D-252: show the tents standing at hour `t` of the year (day * 24 + hour): a camp's are pitched as its households come and
   *  struck on the leave day. NaN: every tent shown (the camps as a whole, for tools that do not keep time) */
  setTime(t: number) {
    if (t === this.tNow) return; this.tNow = t; let standing = 0, changed = false;
    for (const c of this.cols) { const on = Number.isNaN(t) || (t >= c.from && t < c.to); if (on !== c.on) changed = true; c.on = on; if (on) standing += c.n;
      else if (c.live && this.phys) { for (const k of c.live) this.phys.world.removeCollider(k, false); this.info.liveColliders -= c.live.length; c.live = null; } }
    this.info.standing = standing; if (changed) { this.dirty = true; this.assign(); }
  }
  /** the level of every standing tent from the eye's distance (x, z world), and the instances per kind and level */
  private assign() {
    const E = this.eye, byLevel = [0, 0, 0]; let tris = 0;
    for (const [, K] of this.kinds) {
      const cnt = [0, 0, 0];
      for (const L of [...K.levels, ...K.rigs]) if (L) L.of.length = 0;
      for (const i of K.idx) {
        if (!this.cols[this.group_of[i]].on) continue;
        const t = this.tents[i]; let lv = 2;
        if (E && K.levels[0]) { const d = Math.hypot(t.e - E[0], t.n - E[1]), cur = this.level[i], h = TENT_LOD.hyst;
          lv = d < TENT_LOD.lod0 + (cur === 0 ? h : -h) ? 0 : d < TENT_LOD.lod1 + (cur <= 1 ? h : -h) ? 1 : 2; }
        this.level[i] = lv; const L = K.levels[lv]!, k = cnt[lv]++;
        L.mesh.setMatrixAt(k, this.M[i]); L.of[k] = i;
        const c = this.colour[i]; if (lv < 2) L.mesh.setColorAt(k, new THREE.Color(c.r * K.clothK.r, c.g * K.clothK.g, c.b * K.clothK.b)); else L.mesh.setColorAt(k, c);
        const R = lv < 2 ? K.rigs[lv] : null; if (R) { R.mesh.setMatrixAt(k, this.M[i]); R.of[k] = i; }
      }
      K.levels.forEach((L, l) => { if (!L) return; L.mesh.count = cnt[l]; L.mesh.visible = cnt[l] > 0; L.mesh.instanceMatrix.needsUpdate = true; if (L.mesh.instanceColor) L.mesh.instanceColor.needsUpdate = true; L.mesh.computeBoundingSphere(); tris += cnt[l] * L.tris; byLevel[l] += cnt[l]; });
      K.rigs.forEach((R, l) => { if (!R) return; R.mesh.count = cnt[l]; R.mesh.visible = cnt[l] > 0; R.mesh.instanceMatrix.needsUpdate = true; R.mesh.computeBoundingSphere(); tris += cnt[l] * R.tris; });
    }
    this.info.tris = tris; this.info.byLevel = byLevel; this.dirty = false;
  }
  /** colliders for the standing tents within 150 m of the player (at most `budget` boxes a call), dropped beyond 250 m; `t`: the
   *  hour of the year (D-252); the levels by the player's distance (re-assigned when the player has moved 1.5 m) */
  update(x: number, z: number, budget = 400, t?: number) {
    if (t !== undefined) this.setTime(t);
    const e = x, n = -z;
    if (!this.eye || Math.hypot(this.eye[0] - e, this.eye[1] - n) > 1.5 || this.dirty) { this.eye = [e, n]; this.assign(); }
    if (!this.phys) return;
    for (const c of this.cols) { if (!c.on) continue; const d = Math.hypot(c.c[0] - e, c.c[1] - n) - c.r;
      if (d < 150 && (!c.live || c.live.length < c.boxes.length) && budget > 0) { c.live ??= [];
        while (c.live.length < c.boxes.length && budget-- > 0) { const q = c.boxes[c.live.length]; c.live.push(this.phys.addBox({ x: q.x, y: q.y, z: q.z }, { x: q.hx, y: q.hy, z: q.hz }, q.rot)); this.info.liveColliders++; } }
      else if (d > 250 && c.live) { for (const k of c.live) this.phys.world.removeCollider(k, false); this.info.liveColliders -= c.live.length; c.live = null; } }
  }
}
