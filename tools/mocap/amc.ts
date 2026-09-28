// D-333: the CMU Graphics Lab motion capture (ASF skeleton + AMC motion) read, posed by forward kinematics and
// retargeted onto the game's 17 pose channels (src/people/anim.ts; humanRig.ts maps them onto the MakeHuman skeleton).
// Method (world-direction retarget): every source bone's world rotation R_b(t) is relative to the ASF rest (where each
// bone's world orientation is the identity and its direction is stated in world axes). A target bone whose bind
// direction is d_t and whose source bone's rest direction is d_s gets the world rotation W = R_b(t) · Q, Q the least
// rotation taking d_t onto d_s; so it points exactly where the source bone points, with the source's twist. The
// channel's local rotation is W_parent⁻¹ · W (the target's bind orientations are the identity, humanFormat.ts).
// ASF/AMC conventions (Jernej Barbič's CMU viewer, which the database documents): a bone's local rotation is
// C · M · C⁻¹, C from its `axis` (applied X, then Y, then Z: C = Rz·Ry·Rx) and M from its dof angles in the same way.
import { readFileSync } from 'fs';

export type V3 = [number, number, number];
export type M3 = number[]; // row-major 3×3
export const I3 = (): M3 => [1, 0, 0, 0, 1, 0, 0, 0, 1];
export const mul = (A: M3, B: M3): M3 => {
  const o = new Array(9) as M3;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
  return o;
};
export const tr = (A: M3): M3 => [A[0], A[3], A[6], A[1], A[4], A[7], A[2], A[5], A[8]];
export const app = (A: M3, v: V3): V3 => [A[0] * v[0] + A[1] * v[1] + A[2] * v[2], A[3] * v[0] + A[4] * v[1] + A[5] * v[2], A[6] * v[0] + A[7] * v[1] + A[8] * v[2]];
const Rx = (a: number): M3 => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const Ry = (a: number): M3 => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const Rz = (a: number): M3 => { const c = Math.cos(a), s = Math.sin(a); return [c, -s, 0, s, c, 0, 0, 0, 1]; };
const D = Math.PI / 180;
export const norm = (v: V3): V3 => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
export const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** axis-angle rotation matrix */
export function axisAngle(ax: V3, ang: number): M3 {
  const [x, y, z] = norm(ax), c = Math.cos(ang), s = Math.sin(ang), t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
}
/** the least rotation taking unit a onto unit b */
export function between(a: V3, b: V3): M3 {
  a = norm(a); b = norm(b); const c = dot(a, b), ax = cross(a, b), s = Math.hypot(ax[0], ax[1], ax[2]);
  if (s < 1e-9) { if (c > 0) return I3(); const p = Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0]); return axisAngle(p, Math.PI); }
  return axisAngle(ax, Math.atan2(s, c));
}

export interface Bone { name: string; dir: V3; len: number; C: M3; Ci: M3; dof: string[]; parent: string | null; children: string[] }
export interface Skeleton { bones: Map<string, Bone>; order: string[]; rootOrder: string[]; unitM: number }

function rotOf(order: string[], vals: number[]): M3 {
  // applied in the listed order (x first for 'rx ry rz'): M = … · R2 · R1
  let M = I3();
  order.forEach((o, i) => { const a = vals[i] * D; const R = o.endsWith('x') ? Rx(a) : o.endsWith('y') ? Ry(a) : Rz(a); M = mul(R, M); });
  return M;
}

export function readASF(path: string): Skeleton {
  const txt = readFileSync(path, 'utf8'); const lines = txt.split(/\r?\n/);
  const bones = new Map<string, Bone>(); let unit = 0.45; let rootOrder: string[] = ['TX', 'TY', 'TZ', 'RX', 'RY', 'RZ'];
  let i = 0; let section = '';
  while (i < lines.length) {
    const l = lines[i].trim(); i++;
    if (l.startsWith(':')) { section = l.split(/\s+/)[0]; if (section === ':root') continue; }
    if (section === ':units' && l.startsWith('length')) unit = parseFloat(l.split(/\s+/)[1]);
    if (section === ':root' && l.startsWith('order')) rootOrder = l.split(/\s+/).slice(1);
    if (section === ':bonedata' && l === 'begin') {
      const b: Bone = { name: '', dir: [0, 0, 0], len: 0, C: I3(), Ci: I3(), dof: [], parent: null, children: [] };
      while (i < lines.length) {
        const m = lines[i].trim(); i++; if (m === 'end') break;
        const w = m.split(/\s+/);
        if (w[0] === 'name') b.name = w[1];
        else if (w[0] === 'direction') b.dir = [+w[1], +w[2], +w[3]];
        else if (w[0] === 'length') b.len = +w[1];
        else if (w[0] === 'axis') { const ang = [+w[1], +w[2], +w[3]], ord = (w[4] ?? 'XYZ').toLowerCase().split('').map(c => 'r' + c); b.C = rotOf(ord, ord.map(o => ang['xyz'.indexOf(o[1])])); b.Ci = tr(b.C); }
        else if (w[0] === 'dof') b.dof = w.slice(1);
      }
      bones.set(b.name, b);
    }
    if (section === ':hierarchy' && l && l !== 'begin' && l !== 'end' && !l.startsWith(':')) {
      const w = l.split(/\s+/); for (const c of w.slice(1)) { const cb = bones.get(c); if (cb) { cb.parent = w[0]; } if (w[0] !== 'root') bones.get(w[0])!.children.push(c); }
    }
  }
  // depth-first order from the root's children
  const order: string[] = []; const kids = (p: string) => [...bones.values()].filter(b => b.parent === p).map(b => b.name);
  const walk = (p: string) => { for (const c of kids(p)) { order.push(c); walk(c); } }; walk('root');
  // the database's length unit: `length 0.45` means 1 unit = 1/0.45 inch
  return { bones, order, rootOrder, unitM: (1 / unit) * 0.0254 };
}

export interface Frame { root: number[]; vals: Map<string, number[]> }
export function readAMC(path: string): Frame[] {
  const lines = readFileSync(path, 'utf8').split(/\r?\n/); const frames: Frame[] = []; let cur: Frame | null = null;
  for (const raw of lines) { const l = raw.trim(); if (!l || l.startsWith('#') || l.startsWith(':')) continue;
    if (/^\d+$/.test(l)) { cur = { root: [], vals: new Map() }; frames.push(cur); continue; }
    if (!cur) continue; const w = l.split(/\s+/); const v = w.slice(1).map(Number);
    if (w[0] === 'root') cur.root = v; else cur.vals.set(w[0], v); }
  return frames;
}

/** world rotation (relative to rest) and bone head/tail positions (metres, source world) of every bone in a frame */
export interface Posed { R: Map<string, M3>; head: Map<string, V3>; tail: Map<string, V3>; rootR: M3; rootT: V3 }
export function fk(sk: Skeleton, f: Frame): Posed {
  const R = new Map<string, M3>(), head = new Map<string, V3>(), tail = new Map<string, V3>();
  const ro = sk.rootOrder, rv = f.root; const T: V3 = [0, 0, 0]; const rot: string[] = [], rvals: number[] = [];
  ro.forEach((o, i) => { const u = o.toUpperCase(); if (u[0] === 'T') T['XYZ'.indexOf(u[1])] = rv[i] * sk.unitM; else { rot.push('r' + u[1].toLowerCase()); rvals.push(rv[i]); } });
  const rootR = rotOf(rot, rvals);
  for (const n of sk.order) {
    const b = sk.bones.get(n)!; const pR = b.parent === 'root' || !b.parent ? rootR : R.get(b.parent)!;
    const pT = b.parent === 'root' || !b.parent ? T : tail.get(b.parent)!;
    const v = f.vals.get(n) ?? []; const M = b.dof.length ? rotOf(b.dof, b.dof.map((_, i) => v[i] ?? 0)) : I3();
    const Rw = mul(pR, mul(b.C, mul(M, b.Ci))); R.set(n, Rw); head.set(n, pT);
    const d = app(Rw, [b.dir[0] * b.len * sk.unitM, b.dir[1] * b.len * sk.unitM, b.dir[2] * b.len * sk.unitM]);
    tail.set(n, [pT[0] + d[0], pT[1] + d[1], pT[2] + d[2]]);
  }
  return { R, head, tail, rootR, rootT: T };
}
