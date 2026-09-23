// How a leaf texel is lit (C): one model shared by the near leaf shader (render.ts, in TSL), the impostor baker
// (impostor.ts) and the tools/tests, so every level of detail shades a crown the same way.
//
// A crown is lit as a volume of foliage, not as a set of flat cards: the lighting normal of a leaf texel blends the
// normal of the crown's envelope at that point (an ellipsoid about the widest ring of the species' envelope) with the
// normal of its own clump (a sphere about a point behind the card, toward its twig), and at LOD0 each drawn leaf's tilt
// (atlas.ts). Occlusion darkens with depth into the crown, toward the crown's bottom and toward the twig end of a
// clump, per texel (no step between cards). Leaves pass light: a texel facing away from the sun glows with the light
// that reaches it through the foliage between it and the sun (Lambertian transmission, attenuated by the crown's own
// optical depth along the sun ray, which for a point on the envelope is its chord 2R max(0, -N.L)). Every constant is
// C (a judgement, tuned against the tree lab and the node previews, tools/tree_preview.ts).
import type { TreeModel, V3 } from './model';

export const SHADE = {
  /** normal blend: crown envelope, clump sphere (LOD0; LOD1 and the impostors, whose cards are 1.3x larger and seen
   *  from farther, take less of the clump: each card's own gradient read as a fish scale at 60 m) */ crownW: 0.62, clumpW: 0.38, clumpW1: 0.2,
  /** the clump's centre lies this many half-sizes behind the card centre, along -up (toward the twig) */ clumpBack: 0.6,
  /** occlusion by depth into the crown (q: 0 centre .. 1 envelope): aoIn at q <= q0, 1 at q >= q1 */ aoIn: 0.45, aoQ0: 0.2, aoQ1: 1.0,
  /** the crown's bottom against its top (skylight from above) */ aoLow: 0.76,
  /** a clump's twig end against its outer end (LOD0; LOD1 and the impostors) */ aoClump: 0.82, aoClump1: 0.9,
  /** leaf transmission against reflection (green light: a thin leaf transmits about as much as it reflects) */ trans: 1.3,
  /** foliage optical depth through the crown's diameter per unit leaf layer (clumped foliage leaves gaps) */ kappaPerLayer: 1.05,
  /** colour of transmitted light relative to the leaf's reflected colour (more saturated, yellower) */ transTint: [1.0, 1.12, 0.62] as [number, number, number],
  /** wood inside the crown: occlusion by depth, as leaves */ woodAoIn: 0.5,
};

/** a model's crown ellipsoid in tree-local metres: centre height, horizontal radius, radii above and below the centre;
 *  kappa: the transmission attenuation for the species' leaf layers */
export interface Crown { yc: number; rx: number; ryT: number; ryB: number; CB: number; H: number; kappa: number }
export function crownOf(m: TreeModel): Crown {
  const yc = m.CB + (m.H - m.CB) * m.species.envelope.widest;
  return { yc, rx: Math.max(0.3, m.W / 2), ryT: Math.max(0.3, m.H - yc), ryB: Math.max(0.3, yc - m.CB), CB: m.CB, H: m.H, kappa: SHADE.kappaPerLayer * m.species.leaf.layers };
}
/** ellipsoid coordinates of p (length 0 at the centre, 1 on the envelope) */
export function crownCoords(c: Crown, p: V3): V3 { const ry = p[1] > c.yc ? c.ryT : c.ryB; return [p[0] / c.rx, (p[1] - c.yc) / ry, p[2] / c.rx]; }
/** outward normal of the crown ellipsoid through p (unit) */
export function crownNormal(c: Crown, p: V3): V3 {
  const ry = p[1] > c.yc ? c.ryT : c.ryB, g: V3 = [p[0] / (c.rx * c.rx), (p[1] - c.yc) / (ry * ry), p[2] / (c.rx * c.rx)];
  const l = Math.hypot(g[0], g[1], g[2]); return l > 1e-9 ? [g[0] / l, g[1] / l, g[2] / l] : [0, 1, 0];
}
const smooth = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** occlusion by depth into the crown and height in it (leaves and wood) */
export function crownAO(c: Crown, p: V3, aoIn = SHADE.aoIn) {
  const q = crownCoords(c, p), d = Math.hypot(q[0], q[1], q[2]);
  const hy = Math.min(1, Math.max(0, (p[1] - c.CB) / Math.max(0.1, c.H - c.CB)));
  return (aoIn + (1 - aoIn) * smooth(SHADE.aoQ0, SHADE.aoQ1, d)) * (SHADE.aoLow + (1 - SHADE.aoLow) * hy);
}
/** the lighting normal (unit, tree-local, without the leaf tilt) and occlusion of a leaf texel at p on a card whose
 *  centre is `centre`, outward axis `up` and length along it `size` (all as drawn: the card's state and level of detail);
 *  clumpScale: the species' clump weight (trees.json card.clump) */
export function leafShade(c: Crown, p: V3, centre: V3, up: V3, size: number, lod: 0 | 1 = 0, clumpScale = 1): { n: V3; ao: number } {
  const k = SHADE.clumpBack * size * 0.5, o = [0, 0, 0, 0];
  leafShadeTo(o, c, p[0], p[1], p[2], centre[0] - up[0] * k, centre[1] - up[1] * k, centre[2] - up[2] * k, up[0], up[1], up[2], size, lod, clumpScale);
  return { n: [o[0], o[1], o[2]], ao: o[3] };
}
/** leafShade without allocation, for the impostor baker's inner loop: the texel at (px, py, pz), its clump's centre
 *  (the card centre moved clumpBack half-sizes back along -up) and the card's up axis; writes the unit normal to
 *  out[0..2] and the occlusion to out[3] */
export function leafShadeTo(out: { [i: number]: number }, c: Crown, px: number, py: number, pz: number, ccx: number, ccy: number, ccz: number,
  ux: number, uy: number, uz: number, size: number, lod: 0 | 1, clumpScale: number) {
  const dx = px - ccx, dy = py - ccy, dz = pz - ccz, dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  // crownNormal and crownCoords (one ry for both)
  const ry = py > c.yc ? c.ryT : c.ryB, r2 = c.rx * c.rx, gx = px / r2, gy = (py - c.yc) / (ry * ry), gz = pz / r2, gl = Math.sqrt(gx * gx + gy * gy + gz * gz);
  const ncx = gl > 1e-9 ? gx / gl : 0, ncy = gl > 1e-9 ? gy / gl : 1, ncz = gl > 1e-9 ? gz / gl : 0;
  const w1 = SHADE.crownW, w2 = (lod ? SHADE.clumpW1 : SHADE.clumpW) * clumpScale / dl, aoC = 1 - (1 - (lod ? SHADE.aoClump1 : SHADE.aoClump)) * clumpScale;
  const nx = ncx * w1 + dx * w2, ny = ncy * w1 + dy * w2, nz = ncz * w1 + dz * w2, nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
  // along the clump's axis: 0 at the twig end, 1 at the outer end of the card
  const along = Math.min(1, Math.max(0, (dx * ux + dy * uy + dz * uz) / Math.max(1e-3, size * 0.5 * (1 + SHADE.clumpBack))));
  // crownAO: by depth into the crown and height in it
  const qx = px / c.rx, qy = (py - c.yc) / ry, qz = pz / c.rx, dq = Math.sqrt(qx * qx + qy * qy + qz * qz);
  const hy = Math.min(1, Math.max(0, (py - c.CB) / Math.max(0.1, c.H - c.CB)));
  const ao = (SHADE.aoIn + (1 - SHADE.aoIn) * smooth(SHADE.aoQ0, SHADE.aoQ1, dq)) * (SHADE.aoLow + (1 - SHADE.aoLow) * hy);
  out[0] = nx / nl; out[1] = ny / nl; out[2] = nz / nl; out[3] = ao * (aoC + (1 - aoC) * along);
}
/** transmitted light factor of a texel with unit normal n under the sun direction l (unit, toward the sun) */
export function transmission(c: Crown, n: V3, l: V3) { const back = Math.max(0, -(n[0] * l[0] + n[1] * l[1] + n[2] * l[2])); return SHADE.trans * back * Math.exp(-c.kappa * back); }
