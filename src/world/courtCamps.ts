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
import { beforeDoor } from '../people/camps';
import { model, modelParts, aoFactor } from '../render/scanProps';
import { propMaterial } from '../render/materials';
import { CLOTHS } from './fillPlan';

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
  readonly info = { tents: 0, tris: 0, meshes: 0, colliders: 0, liveColliders: 0, buildMs: 0, standing: 0, modelled: [] as string[], byLevel: [0, 0, 0], dressing: 0 };
  /** D-570: the things before the standing tents */
  dressing: CampDressing | null = null;
  private cols: { c: [number, number]; r: number; boxes: Col[]; live: any[] | null; from: number; to: number; on: boolean; n: number }[] = [];
  private tNow = NaN;
  private tents: Tent[]; private M: THREE.Matrix4[] = []; private colour: THREE.Color[] = []; private group_of: number[] = []; private level: Uint8Array;
  private kinds = new Map<TentKind, { idx: number[]; levels: (Lvl | null)[]; rigs: (Lvl | null)[]; clothK: THREE.Color }>();
  private eye: [number, number] | null = null; private dirty = true;
  constructor(tents: Tent[], private ground: (e: number, n: number) => number, private phys: Physics | null = null) {
    const groundAt = ground; const t0 = performance.now(); Object.assign(SURFACES, TENT_SURFACES); this.tents = tents; this.level = new Uint8Array(tents.length).fill(2);
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
    const e = x, n = -z, pitched = this.dirty;
    if (!this.eye || Math.hypot(this.eye[0] - e, this.eye[1] - n) > 1.5 || this.dirty) { this.eye = [e, n]; this.assign(); }
    // D-570: the things before the standing tents (built once the props are in: scanProps loads them before the world's builders)
    if (!this.dressing && model('mat')) { this.dressing = new CampDressing(this.tents, this.ground, ti => this.cols[this.group_of[ti]]?.on ?? false); this.group.add(this.dressing.group); this.info.dressing = this.dressing.items.length; }
    this.dressing?.update(e, n, pitched);
    if (!this.phys) return;
    for (const c of this.cols) { if (!c.on) continue; const d = Math.hypot(c.c[0] - e, c.c[1] - n) - c.r;
      if (d < 150 && (!c.live || c.live.length < c.boxes.length) && budget > 0) { c.live ??= [];
        while (c.live.length < c.boxes.length && budget-- > 0) { const q = c.boxes[c.live.length]; c.live.push(this.phys.addBox({ x: q.x, y: q.y, z: q.z }, { x: q.hx, y: q.hy, z: q.hz }, q.rot)); this.info.liveColliders++; } }
      else if (d > 250 && c.live) { for (const k of c.live) this.phys.world.removeCollider(k, false); this.info.liveColliders -= c.live.length; c.live = null; } }
  }
}

// ------------------------------------------------------------------------------------------------ the camps lived in (D-570)
// What stands before a pitched tent while its household lives in it (all C, D-570: nothing of a court camp at Persepolis is
// known, Q-333; the herders' and soldiers' camps of the region by analogy): a mat or a carpet before the door, the bedding rolled
// and aired, a water jar, the baggage (sacks, bales, a chest before a pavilion), and at every third tent a cooking hearth with
// its pot and the fuel by it; at the black tents the milk pot and fodder. The project's modelled props (tools/blender/
// model_props.py, fill_props.py; ASSET_LEDGER.md), placed by rule per tent and shown only while that tent stands (D-252).
/** what each part is made of (fill.ts's table, the parts these props use): [material kind, default sRGB colour] */
const DRESS_PART: Record<string, [string, RGB]> = {
  wood: ['wood', [0.47, 0.37, 0.27]], wood_d: ['wood', [0.38, 0.3, 0.22]], mud: ['mud', [0.6, 0.48, 0.36]], dung: ['mud', [0.36, 0.3, 0.22]], stone: ['stone', [0.74, 0.7, 0.62]],
  cloth: ['textile', [0.72, 0.64, 0.5]], cord: ['textile', [0.58, 0.5, 0.36]], textile: ['textile', [0.7, 0.6, 0.46]], textile_a: ['textile', [0.78, 0.7, 0.56]], textile_b: ['textile', [0.55, 0.22, 0.16]],
  cloth_a: ['textile', [0.82, 0.78, 0.68]], cloth_b: ['textile', [0.6, 0.3, 0.2]], linen: ['textile', [0.84, 0.8, 0.7]], red: ['textile', [0.56, 0.2, 0.15]],
  wicker: ['wicker', [0.64, 0.54, 0.36]], grain: ['mud', [0.78, 0.66, 0.42]], reed: ['reed', [0.72, 0.62, 0.42]], matting: ['reed', [0.72, 0.62, 0.42]], clay: ['clay', [0.66, 0.46, 0.32]],
};
const TEXTILE = /^(cloth|textile|linen|red)/;
export interface CampItem { m: string; e: number; n: number; rot: number; s: number; tent: number; cloth: RGB }
/** the things before each tent (tent index into `tents`), by its kind; pure in the tent */
export function campItems(tents: Tent[]): CampItem[] {
  const out: CampItem[] = [];
  tents.forEach((t, ti) => { const a = (t.heading * Math.PI) / 180, j = (k: number) => jit(t.i * 7 + k, 31), cl = (k: number) => CLOTHS[Math.floor(j(k) * CLOTHS.length)];
    const add = (m: string, out_: number, across: number, rot = 0, s = 1, k = 0) => { const [e, n] = beforeDoor(t, out_, across); out.push({ m, e, n, rot: a + rot, s: s * (0.9 + 0.2 * j(40 + k)), tent: ti, cloth: cl(k) }); };
    const side = j(1) < 0.5 ? 1 : -1, hw = t.w / 2;
    if (t.kind === 'pavilion') { add('carpet', 1.4, 0, 0, 1, 1); add('chest', 0.5, side * (hw - 0.6), 0.2, 1, 2); add('jar_store', 0.6, -side * (hw - 0.4), 0, 1, 3); add('stool', 2.6, side * 0.9, j(4) * 6, 1, 4); if (j(5) < 0.6) add('rug_folded', 0.7, side * (hw - 1.6), 0.1, 1, 5); }
    else if (t.kind === 'black') { add('mat', 1.0, 0, 0, 1, 1); add('roll', 0.5, side * (hw - 0.8), Math.PI / 2, 1, 2); add('milkpot', 0.6, -side * (hw - 0.6), 0, 1, 3); add('bale', -0.4, side * (hw + 0.7), 0.3, 1, 4); add('jar_water', 0.8, -side * (hw - 1.4), 0, 1, 6); if (j(7) < 0.5) add('wo_fodder', 2.4, side * (hw + 0.4), j(8) * 6, 1, 7); }
    else { add('mat', 0.9, 0, 0, 0.9, 1); add('roll', 0.45, side * 1.4, Math.PI / 2, 1, 2); if (j(3) < 0.55) add('roll', 0.45, side * 1.9, Math.PI / 2 + 0.1, 1, 3); add('jar_water', 0.6, -side * 1.7, 0, 1, 4); add('sack', -1.2, side * (hw + 0.5), 0.2, 1, 5); if (j(6) < 0.5) add('bale', -2.4, side * (hw + 0.5), 0, 1, 6); }
    if (t.kind !== 'pavilion' && t.i % 3 === 0) { add('hearth', 3.4, -side * 0.6, 0, 1, 8); add('cookpot', 3.4, -side * 0.6, j(9) * 6, 1, 9); add('fill_bundle', 3.6, -side * 2.0, j(10) * 6, 1, 10); }
  });
  return out;
}
/** the levels by the eye's distance (m) and how far the things are drawn */
export const DRESS_R = { lod0: 8, lod1: 25, far: 60, move: 3 } as const;
/** the camps' things drawn round the eye (one InstancedMesh per model, part and level), only before the standing tents */
export class CampDressing {
  readonly group = new THREE.Group(); readonly items: CampItem[]; readonly missing: string[] = []; drawn = 0;
  private y: Float32Array; private grid = new Map<string, number[]>(); private slots = new Map<string, { mesh: THREE.InstancedMesh; part: string; col: THREE.Color }[][]>();
  private eye: [number, number] = [1e9, 1e9]; private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private up = new THREE.Vector3(0, 1, 0); private p = new THREE.Vector3(); private sc = new THREE.Vector3(); private c = new THREE.Color();
  constructor(tents: Tent[], ground: (e: number, n: number) => number, private standing: (tent: number) => boolean) {
    this.group.name = 'court-camps:dressing'; this.items = campItems(tents); this.y = new Float32Array(this.items.length);
    const count = new Map<string, number>();
    this.items.forEach((it, i) => { this.y[i] = ground(it.e, it.n); count.set(it.m, (count.get(it.m) ?? 0) + 1); const k = `${Math.floor(it.e / 32)},${Math.floor(it.n / 32)}`; (this.grid.get(k) ?? this.grid.set(k, []).get(k)!).push(i); });
    for (const [m, n] of count) { if (!model(m)) { this.missing.push(m); continue; } const cap = Math.min(n, 600), levels: { mesh: THREE.InstancedMesh; part: string; col: THREE.Color }[][] = [];
      for (let l = 0; l < 3; l++) { const parts = modelParts(m, l); const L: { mesh: THREE.InstancedMesh; part: string; col: THREE.Color }[] = []; if (!parts) { levels.push(L); continue; }
        for (const [part, g0] of Object.entries(parts)) { const def = DRESS_PART[part] ?? ['clay', [0.6, 0.5, 0.4]], g = new THREE.BufferGeometry(), N = g0.getAttribute('position').count, col = new Float32Array(N * 3);
          for (let i = 0; i < N; i++) col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = aoFactor(g0, i);
          g.setAttribute('position', g0.getAttribute('position')); if (!g0.getAttribute('normal')) g0.computeVertexNormals(); g.setAttribute('normal', g0.getAttribute('normal')); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); if (g0.index) g.setIndex(g0.index); g.computeBoundingSphere();
          const mesh = new THREE.InstancedMesh(g, propMaterial(def[0], { vertexColors: true }), cap); mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = l < 2 && /carpet|chest|jar_store|bale|hearth/.test(m);
          mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); mesh.name = `court-camps:${m}:${part}:lod${l}`;
          mesh.userData = { tier: 'C', src: 'RECON', note: `${m} (${part}) before a court tent (D-570): placed by rule per tent while it stands, modelled (tools/blender/model_props.py)` };
          this.group.add(mesh); L.push({ mesh, part, col: new THREE.Color().setRGB(...def[1], THREE.SRGBColorSpace) }); }
        levels.push(L); }
      this.slots.set(m, levels); }
  }
  /** rebuild the instances round the eye (grid e, n) when it has moved DRESS_R.move m or `force` (a tent pitched or struck) */
  update(e: number, n: number, force = false) {
    if (!force && Math.hypot(e - this.eye[0], n - this.eye[1]) < DRESS_R.move) return; this.eye = [e, n];
    const cnt = new Map<THREE.InstancedMesh, number>(); this.drawn = 0; const R = DRESS_R.far, c0 = Math.floor((e - R) / 32), c1 = Math.floor((e + R) / 32), r0 = Math.floor((n - R) / 32), r1 = Math.floor((n + R) / 32);
    for (let ci = c0; ci <= c1; ci++) for (let ri = r0; ri <= r1; ri++) for (const i of this.grid.get(`${ci},${ri}`) ?? []) { const it = this.items[i], d = Math.hypot(it.e - e, it.n - n);
      if (d > R || !Number.isFinite(this.y[i]) || !this.standing(it.tent)) continue; const lv = d < DRESS_R.lod0 ? 0 : d < DRESS_R.lod1 ? 1 : 2, L = this.slots.get(it.m)?.[lv]; if (!L?.length) continue;
      this.q.setFromAxisAngle(this.up, Math.PI - it.rot); this.m4.compose(this.p.set(it.e, this.y[i], -it.n), this.q, this.sc.set(it.s, it.s, it.s)); this.drawn++;
      for (const S of L) { const k = cnt.get(S.mesh) ?? 0; if (k >= S.mesh.instanceMatrix.count) continue; S.mesh.setMatrixAt(k, this.m4);
        if (TEXTILE.test(S.part)) this.c.setRGB(...lin(it.cloth)).multiplyScalar(1); else this.c.copy(S.col); S.mesh.setColorAt(k, this.c); cnt.set(S.mesh, k + 1); } }
    for (const [, levels] of this.slots) for (const L of levels) for (const S of L) { const k = cnt.get(S.mesh) ?? 0; S.mesh.count = k; S.mesh.visible = k > 0; if (k) { S.mesh.instanceMatrix.needsUpdate = true; S.mesh.instanceColor!.needsUpdate = true; } }
  }
}
