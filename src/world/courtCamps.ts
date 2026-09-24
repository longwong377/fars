// The court's camps drawn (D-199; court setting only, D-003): every tent of camps.ts (the court's camp below the Terrace,
// the retinue's camps in the town and on the plain) as low-poly cloth and goat-hair shells on the terrain, merged into one
// mesh per camp (the settlement's Batch, with an owner per face so the dev overlay F3 names the tent, its kind and its
// tier), and a box collider per tent streamed near the player (as the settlement's). All C: nothing of a court camp at
// Persepolis is known (Q-333); the tent forms are camps.ts TENT_KINDS'.
import * as THREE from 'three/webgpu';
import { Batch, lin, type RGB } from './settlement/geom';
import { surfaceMaterial, SURFACES, type SurfaceDef } from '../render/materials';
import { CAMP_BY_ID, TENT_KINDS, type Tent } from '../people/camps';
import type { Physics } from '../player/physics';

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

/** append one tent's shell to a batch (world coordinates: x = e, z = −n; y from the ground) */
export function tentShell(b: Batch, t: Tent, groundAt: (e: number, n: number) => number, owner: number) {
  const a = (t.heading * Math.PI) / 180, fe = Math.sin(a), fn = Math.cos(a), re = fn, rn = -fe; // forward (door) and right
  const hw = t.w / 2, hd = t.d / 2;
  let y0 = Infinity; for (const [u, v] of [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]]) y0 = Math.min(y0, groundAt(t.e + u * re + v * fe, t.n + u * rn + v * fn));
  const P = (u: number, v: number, y: number) => [t.e + u * re + v * fe, y0 + y, -(t.n + u * rn + v * fn)];
  const pal = CLOTH[t.kind], c = lin(pal[Math.floor(jit(t.i, 7) * pal.length)] as RGB), cd = shade(c, 0.85), low = -0.12; // (walls reach below the lowest corner: no gap on a slope)
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
    const h = t.h, wall = 1.8, apex = P(0, 0, h), c2 = lin([0.72, 0.64, 0.5]);
    const corners: [number, number][] = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
    for (let k = 0; k < 4; k++) { const [u0, v0] = corners[k], [u1, v1] = corners[(k + 1) % 4]; tri(P(u0, v0, wall), P(u1, v1, wall), apex, c2);
      if (k === 2) { for (const [ua, ub] of [[hw, 0.8], [-0.8, -hw]]) quad(P(ua, hd, low), P(ub, hd, low), P(ub, hd, wall), P(ua, hd, wall), c, [fe, 0, -fn]); } // the door in the front wall
      else quad(P(u0, v0, low), P(u1, v1, low), P(u1, v1, wall), P(u0, v0, wall), c); }
    quad(P(-0.8, hd, 2.0), P(0.8, hd, 2.0), P(0.8, hd, wall), P(-0.8, hd, wall), c, [fe, 0, -fn]); // (the lintel strip over the door)
  }
  return { y0 };
}

interface Col { x: number; y: number; z: number; hx: number; hy: number; hz: number; rot: number }
/** the tents of the court setting's camps (court.ts CourtResidents.tents): a mesh per camp and colliders near the player */
export class CourtCampTents {
  readonly group = new THREE.Group();
  readonly info = { tents: 0, tris: 0, meshes: 0, colliders: 0, liveColliders: 0, buildMs: 0 };
  private cols: { c: [number, number]; r: number; boxes: Col[]; live: any[] | null }[] = [];
  constructor(tents: Tent[], groundAt: (e: number, n: number) => number, private phys: Physics | null = null) {
    const t0 = performance.now(); Object.assign(SURFACES, TENT_SURFACES);
    this.group.name = 'court-camps'; this.group.userData = { tier: 'C', src: 'RECON;HDT', note: 'the court’s camps (court setting only, D-199): tents in lines (camps.ts), all C; Q-333' };
    const mat = surfaceMaterial('tent_cloth', { vertexColors: true }); mat.side = THREE.DoubleSide; // (the open doors and fronts show the undersides)
    const byCamp = new Map<string, Tent[]>(); for (const t of tents) (byCamp.get(t.camp) ?? byCamp.set(t.camp, []).get(t.camp)!).push(t);
    for (const [id, list] of byCamp) {
      const def = CAMP_BY_ID.get(id)!, b = new Batch(), desc: { tier: string; src: string; note: string }[] = [], boxes: Col[] = []; let r = 0;
      for (const t of list) { const K = TENT_KINDS[t.kind], d = desc.length; desc.push({ tier: 'C', src: def.src, note: `a ${t.kind} tent of ${def.label}: ${K.note} (court setting, D-199)` });
        const { y0 } = tentShell(b, t, groundAt, d); r = Math.max(r, Math.hypot(t.e - def.c[0], t.n - def.c[1]) + Math.max(t.w, t.d));
        boxes.push({ x: t.e, y: y0 + t.h / 2, z: -t.n, hx: t.w / 2, hy: t.h / 2, hz: t.d / 2, rot: Math.PI - (t.heading * Math.PI) / 180 }); }
      const m = new THREE.Mesh(b.toGeometry(), mat); m.name = `court-camp:${id}`; m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false;
      const owner = b.owner; m.userData = { tier: 'C', src: def.src, note: `${def.label}: ${list.length} tents (court setting, D-199; C)`, describe: (hit: any) => desc[owner[hit?.faceIndex ?? -1]] ?? null };
      this.group.add(m); this.info.tents += list.length; this.info.tris += b.tris; this.info.meshes++;
      this.cols.push({ c: def.c, r, boxes, live: null }); this.info.colliders += boxes.length;
    }
    this.info.buildMs = performance.now() - t0;
  }
  /** colliders for the camps within 150 m of the player (at most `budget` boxes a call), dropped beyond 250 m */
  update(x: number, z: number, budget = 400) {
    if (!this.phys) return; const e = x, n = -z;
    for (const c of this.cols) { const d = Math.hypot(c.c[0] - e, c.c[1] - n) - c.r;
      if (d < 150 && (!c.live || c.live.length < c.boxes.length) && budget > 0) { c.live ??= [];
        while (c.live.length < c.boxes.length && budget-- > 0) { const q = c.boxes[c.live.length]; c.live.push(this.phys.addBox({ x: q.x, y: q.y, z: q.z }, { x: q.hx, y: q.hy, z: q.hz }, q.rot)); this.info.liveColliders++; } }
      else if (d > 250 && c.live) { for (const k of c.live) this.phys.world.removeCollider(k, false); this.info.liveColliders -= c.live.length; c.live = null; } }
  }
}
