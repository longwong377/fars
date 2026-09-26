// River crossings (D-257; gap hunters A061 / B-022 / W-014, A519): where a road meets the Pulvar or the Kur it crosses by
// a ford. The rivers are small (Pulvar channel 23 m across, 0.4-1.2 m deep by month; Kur 42 m, 0.7-1.8 m: plain.json
// flow_by_month, C) and not navigable, so no bridge or ferry is assumed; Herodotus' royal road passes its navigable rivers
// "by ferries" (5.52, B, far to the west), and none of those is here. Each ford is reconstruction (C):
//  - a causeway of river cobbles and rubble laid across the channel at the road, square to the stream, its top 0.30 m
//    (Pulvar) / 0.35 m (Kur) over the bed: at low water (Aug-Oct) the Pulvar breaks over it, in the spring flood it is
//    under a metre; the ramps down the banks are paved the same way (the channel's own side slopes, 1:6.5 and 1:8.4, C);
//  - a line of stepping stones a few metres downstream for people on foot, their tops a hand over the low-water level;
//  - four stakes on the banks marking the ford's line;
//  - at the Kur, which is too deep to ford from March to May, a round hide boat (Herodotus 1.194's river boats of hide on
//    a willow frame, B for Mesopotamia; C here) lies upturned on the bank with its pole.
// The crossing points are where the settlement.json roads, as drawn (settlement/water.ts meander), cut the river centrelines.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Terrain } from '../../terrain/heightfield';
import { curvatureDrop } from '../../terrain/heightfield';
import { attribute, float, mix } from 'three/tsl';
import { surfaceMaterial, SURFACES, type Layer } from '../../render/materials';
import type { RiverProfile } from './data';
import { settlementRoads, PointIndex } from './data';
import { meander } from '../settlement/water';
import { Rng } from '../../core/rng';

/** causeway top over the bed (m) and the low-water depth the stepping stones stand clear of (plain.json Aug-Oct, C) */
export const FORD = {
  river_pulvar: { causeway: 0.30, lowDepth: 0.41, stepClear: 0.15 },
  river_kur: { causeway: 0.35, lowDepth: 0.75, stepClear: 0.15 },
} as const;
export const FORD_TAG = { tier: 'C', src: 'HDT;RECON', note: '' };

export interface Crossing { road: string; river: RiverProfile['id']; x: number; y: number; /** river index at the crossing */ i: number;
  /** downstream unit tangent (grid) */ tx: number; ty: number; roadW: number }

function segHit(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): [number, number] | null {
  const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy, den = rx * sy - ry * sx; if (den === 0) return null;
  const t = ((cx - ax) * sy - (cy - ay) * sx) / den, u = ((cx - ax) * ry - (cy - ay) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [ax + t * rx, ay + t * ry] : null;
}
/** every point where a present road, as drawn, crosses a river centreline; crossings of one road within 60 m merge */
export function roadRiverCrossings(rivers: RiverProfile[], roads = settlementRoads(), tracks: { id: string; pts: [number, number][]; width: number }[] = []): Crossing[] {
  const out: Crossing[] = [];
  // roads are drawn meandered (settlement/water.ts); the village tracks' lines are already as drawn (ribbons.ts trackLines)
  for (const r of [...roads.map(q => ({ ...q, drawn: meander(q.pts as [number, number][], 8) })), ...tracks.map(q => ({ ...q, drawn: q.pts }))]) {
    const P = r.drawn;
    for (const rv of rivers) {
      // bounding box prefilter per road segment
      for (let s = 1; s < P.length; s++) {
        const [ax, ay] = P[s - 1], [bx, by] = P[s], x0 = Math.min(ax, bx) - 30, x1 = Math.max(ax, bx) + 30, y0 = Math.min(ay, by) - 30, y1 = Math.max(ay, by) + 30;
        for (let k = 1; k < rv.x.length; k++) {
          if (Math.max(rv.x[k - 1], rv.x[k]) < x0 || Math.min(rv.x[k - 1], rv.x[k]) > x1 || Math.max(rv.y[k - 1], rv.y[k]) < y0 || Math.min(rv.y[k - 1], rv.y[k]) > y1) continue;
          const h = segHit(ax, ay, bx, by, rv.x[k - 1], rv.y[k - 1], rv.x[k], rv.y[k]); if (!h) continue;
          if (out.some(c => c.road === r.id && c.river === rv.id && Math.hypot(c.x - h[0], c.y - h[1]) < 60)) continue;
          const a = Math.max(0, k - 4), b = Math.min(rv.x.length - 1, k + 3); let tx = rv.x[b] - rv.x[a], ty = rv.y[b] - rv.y[a]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
          out.push({ road: r.id, river: rv.id, x: h[0], y: h[1], i: k, tx, ty, roadW: r.width });
        }
      }
    }
  }
  return out;
}

/** village tracks are straight lines between villages (ribbons.ts trackLines) that know nothing of the rivers: where one runs
 *  along a channel (within 45 deg of the stream) it is moved out onto the bank it is on, 8 m past the channel's top edge;
 *  where it crosses (a steeper angle) it is left to its ford */
export function keepOffChannels(lines: [number, number][][], rivers: RiverProfile[]): [number, number][][] {
  const idx = new PointIndex(200), ri: number[] = [], ki: number[] = [];
  rivers.forEach((rv, r) => { for (let k = 0; k < rv.x.length; k++) { idx.add(rv.x[k], rv.y[k]); ri.push(r); ki.push(k); } });
  return lines.map(line => line.map((p, j) => {
    const rv0 = rivers.reduce((m, r) => Math.max(m, r.topWidth), 0), [d, i] = idx.nearest(p[0], p[1], rv0 / 2 + 8); if (i < 0) return p;
    const rv = rivers[ri[i]], k = ki[i], clear = rv.topWidth / 2 + 8; if (d >= clear) return p;
    const a = Math.max(0, k - 3), b = Math.min(rv.x.length - 1, k + 3); let tx = rv.x[b] - rv.x[a], ty = rv.y[b] - rv.y[a]; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
    const q0 = line[Math.max(0, j - 1)], q1 = line[Math.min(line.length - 1, j + 1)]; let dx = q1[0] - q0[0], dy = q1[1] - q0[1]; const dl = Math.hypot(dx, dy) || 1; dx /= dl; dy /= dl;
    if (Math.abs(dx * tx + dy * ty) < Math.SQRT1_2) return p; // crossing: the ford takes it
    let s = Math.sign(tx * (p[1] - rv.y[k]) - ty * (p[0] - rv.x[k])); if (!s) s = Math.sign(tx * (line[0][1] - rv.y[k]) - ty * (line[0][0] - rv.x[k])) || 1;
    return [rv.x[k] - ty * s * clear, rv.y[k] + tx * s * clear] as [number, number];
  }));
}

type Box = { c: THREE.Vector3; h: THREE.Vector3; rot: number };
export interface CrossingBuild { group: THREE.Group; crossings: Crossing[]; boxes: Box[]; stats: { stones: number; steps: number; boats: number } }

const COBBLE = [new THREE.Color().setRGB(0.62, 0.58, 0.52, THREE.SRGBColorSpace), new THREE.Color().setRGB(0.50, 0.47, 0.42, THREE.SRGBColorSpace), new THREE.Color().setRGB(0.70, 0.66, 0.58, THREE.SRGBColorSpace)];
const WOOD = new THREE.Color().setRGB(0.36, 0.28, 0.20, THREE.SRGBColorSpace), HIDE = new THREE.Color().setRGB(0.40, 0.30, 0.21, THREE.SRGBColorSpace);

/** vertex colour, and `soft` = 1 for timber and hide (the stone's relief and grain switched off: one mesh, one draw) */
function paint(g: THREE.BufferGeometry, c: THREE.Color, jitter = 0, rng?: Rng, soft = 0): THREE.BufferGeometry {
  g = g.index ? g.toNonIndexed() : g; if (g.getAttribute('uv')) g.deleteAttribute('uv');
  const n = g.getAttribute('position').count, col = new Float32Array(n * 3), sf = new Float32Array(n).fill(soft), k = rng ? 1 + rng.range(-jitter, jitter) : 1;
  for (let i = 0; i < n; i++) { col[i * 3] = c.r * k; col[i * 3 + 1] = c.g * k; col[i * 3 + 2] = c.b * k; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('soft', new THREE.BufferAttribute(sf, 1)); return g;
}

/** `share`: another stone mesh of the plain (the quarries, D-257) merged into the fords' one draw: the plain's mesh budget
 *  (tests/plain.test.ts, <= 40) was full. Its faces come first and keep their own F3 description; its material was the
 *  limestone, whose albedo the rubble surface shares */
export function buildCrossings(terrain: Terrain, rivers: RiverProfile[], seed = 1, tracks: { id: string; pts: [number, number][]; width: number }[] = [], share: THREE.Mesh | null = null): CrossingBuild {
  const group = new THREE.Group(); group.name = 'plain-crossings';
  const court = terrain.meta.court_asl, crossings = roadRiverCrossings(rivers, settlementRoads(), tracks), boxes: Box[] = [];
  const stones: THREE.BufferGeometry[] = [], wood: THREE.BufferGeometry[] = [];
  let nStones = 0, nSteps = 0, nBoats = 0;
  for (const c of crossings) {
    const rv = rivers.find(r => r.id === c.river)!, F = FORD[c.river], ch = rv.channel, rng = new Rng(seed, `ford:${c.road}:${c.river}:${c.i}`);
    const wy = (asl: number, x: number, y: number) => asl - court - curvatureDrop(x, -y);
    const bankAsl = rv.bank[c.i], bedY = wy(bankAsl - ch.bank_height_m, c.x, c.y), bankY = wy(bankAsl, c.x, c.y);
    const bHalf = ch.bed_width_m / 2, topHalf = rv.topWidth / 2, sl = ch.side_slope_h_per_v;
    const nx = -c.ty, ny = c.tx; // across the stream (grid)
    const rot = Math.atan2(ny, nx); // box local +x along the ford (world: x = e, z = -n, so the yaw is +atan2(n, e))
    /** the ground at a point of the ford: the channel's trapezoid inside, the terrain outside (whichever is higher) */
    const ground = (u: number, v: number) => { const x = c.x + nx * u + c.tx * v, y = c.y + ny * u + c.ty * v, au = Math.abs(u);
      const chan = au <= bHalf ? bedY : au <= topHalf ? bedY + Math.min(ch.bank_height_m, (au - bHalf) / sl) : bankY;
      return Math.max(chan, au <= topHalf ? chan : terrain.heightAt(x, -y)); };
    const put = (u: number, v: number, lx: number, lz: number, top: number, bottom: number, col: THREE.Color, into: THREE.BufferGeometry[], yaw = 0, collide = true) => {
      const x = c.x + nx * u + c.tx * v, y = c.y + ny * u + c.ty * v, h = Math.max(0.05, top - bottom);
      const g = new THREE.BoxGeometry(lx, h, lz); g.rotateY(rot + yaw); g.translate(x, bottom + h / 2, -y); into.push(paint(g, col, 0.08, rng, into === wood ? 1 : 0));
      if (collide) boxes.push({ c: new THREE.Vector3(x, bottom + h / 2, -y), h: new THREE.Vector3(lx / 2, h / 2, lz / 2), rot: rot + yaw });
    };
    // the causeway and its paved ramps: slabs 1 m along the ford, the road's width across it
    const reach = topHalf + 5, W = c.roadW - 0.5;
    for (let u = -reach; u <= reach + 1e-6; u += 1) {
      const g0 = ground(u, 0), top = Math.max(g0 + 0.08, Math.abs(u) <= topHalf ? bedY + F.causeway : -Infinity);
      put(u, rng.range(-0.1, 0.1), 1.02, W, top + rng.range(-0.03, 0.02), Math.min(g0, top) - 0.25, COBBLE[rng.int(0, 2)], stones, rng.range(-0.04, 0.04)); nStones++;
      // cobbles spilled along the downstream lip, where the water falls off the causeway
      if (Math.abs(u) <= topHalf) for (let k = 0; k < 2; k++) { const s = rng.range(0.25, 0.45); put(u + rng.range(-0.4, 0.4), W / 2 + rng.range(0.1, 0.8), s, s * rng.range(0.7, 1.1), bedY + F.causeway * rng.range(0.5, 0.9), bedY - 0.1, COBBLE[rng.int(0, 2)], stones, rng.range(0, 3), false); nStones++; }
    }
    // stepping stones downstream, across the wetted channel
    const vStep = W / 2 + 2.5, stepTop = bedY + F.lowDepth + F.stepClear;
    for (let u = -topHalf + 0.4; u <= topHalf - 0.4; u += 0.85) {
      if (ground(u, vStep) > stepTop - 0.2) continue; // the dry bank: no stone needed
      put(u + rng.range(-0.08, 0.08), vStep + rng.range(-0.15, 0.15), rng.range(0.5, 0.65), rng.range(0.42, 0.55), stepTop + rng.range(-0.04, 0.04), bedY - 0.15, COBBLE[rng.int(0, 2)], stones, rng.range(-0.3, 0.3)); nSteps++;
    }
    // the ford's stakes, two each side on the bank tops
    for (const su of [-1, 1]) for (const sv of [-1, 1]) { const u = su * (topHalf + 1.2), v = sv * (W / 2 + 0.7), g0 = ground(u, v); put(u, v, 0.11, 0.11, g0 + 1.6 + rng.range(-0.15, 0.1), g0 - 0.3, WOOD, wood, rng.range(0, 1), true); }
    // the Kur: an upturned round hide boat on the bank upstream of the ford, and its pole
    if (c.river === 'river_kur') {
      const u = topHalf + 4, v = -(W / 2 + 5), g0 = ground(u, v), x = c.x + nx * u + c.tx * v, y = c.y + ny * u + c.ty * v, R = 1.35;
      const dome = new THREE.SphereGeometry(R, 14, 5, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(1, 0.55, 1); dome.translate(x, g0 + 0.02, -y); wood.push(paint(dome, HIDE, 0.05, rng, 1)); nBoats++;
      const rim = new THREE.TorusGeometry(R, 0.05, 4, 20); rim.rotateX(Math.PI / 2); rim.translate(x, g0 + 0.05, -y); wood.push(paint(rim, WOOD, 0, undefined, 1));
      boxes.push({ c: new THREE.Vector3(x, g0 + 0.37, -y), h: new THREE.Vector3(R * 0.8, 0.37, R * 0.8), rot: 0 });
      const pole = new THREE.CylinderGeometry(0.04, 0.05, 4.2, 5); pole.rotateZ(Math.PI / 2); pole.rotateY(rot + 0.3); pole.translate(x + c.tx * 1.8, g0 + 0.06, -(y + c.ty * 1.8)); wood.push(paint(pole, WOOD, 0, undefined, 1));
    }
  }
  const note = (n: number) => `fords where the roads meet the rivers (${n}): a cobble causeway across the channel at the road, paved ramps, stepping stones downstream, marker stakes; at the Kur a round hide boat upturned on the bank for the spring flood (Herodotus 1.194, B for Mesopotamia). All reconstruction (C, D-257)`;
  // one mesh (the plain's mesh budget, tests/plain.test.ts): the stones as rubble, the stakes and the boat without its relief
  const lime = new THREE.Color().setRGB(...(SURFACES.limestone.albedo as [number, number, number]), THREE.SRGBColorSpace);
  const shared = share ? paint(share.geometry.clone(), lime) : null, sharedFaces = shared ? shared.getAttribute('position').count / 3 : 0;
  const all = [...(shared ? [shared] : []), ...stones, ...wood];
  if (all.length) {
    const mat = surfaceMaterial('rubble', { vertexColors: true, variant: 'ford', modify: (L: Layer) => { const sf = attribute('soft', 'float');
      return { alb: L.alb, rough: mix(L.rough, float(0.75), sf), height: L.height ? L.height.mul(float(1).sub(sf)) : null, tilt: L.tilt }; } });
    const m = new THREE.Mesh(mergeGeometries(all)!, mat); m.name = 'plain-fords'; m.castShadow = m.receiveShadow = true;
    const own = { tier: 'C', src: FORD_TAG.src, note: note(crossings.length), placeholder: false };
    if (share) { const sd = share.userData; m.name = 'plain-stone'; m.userData = { ...own, note: `${own.note}; with ${sd.note}`, describe: (hit: any) => (hit?.faceIndex ?? Infinity) < sharedFaces ? (sd.describe?.(hit) ?? sd) : own };
      share.parent?.remove(share); share.geometry.dispose(); }
    else m.userData = own;
    group.add(m);
  }
  return { group, crossings, boxes, stats: { stones: nStones, steps: nSteps, boats: nBoats } };
}
