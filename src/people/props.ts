// Objects people hold while they work (activities.ts `prop`, `prop2`): the Phase 3 set (spear, sack, jar, tablet, mallet,
// basket) and the tools of the work cycles added with D-142 (hoe, sickle, winnowing fork, goad, staff, broom, drop spindle
// and distaff, trowel, brick mould, brick, rope, adze, bow and arrow, knife, weaving sword, paddle, cloth, wisp, phiale,
// rag, awl, ladle, stick, lead). Geometry per kind with vertex colours; every kind has a tier and a note (PROP_NOTES,
// printed by the dev overlay). All kinds of a size class are one instanced mesh (a union geometry: each instance shows
// its own kind, the others collapse; arithmetic mask, no select: D-012): two draws for every prop in view.
// Placement (placeProp) is data-driven (PROPS): a prop sits in one hand, between two hands (a hoe's handle through both
// palms), between the hands' midpoint (a jar held in both), hangs (the spindle), rests on a hip or palm, or is put where
// the cycle says (the brick mould on the ground). New tools are authored in a grip frame: origin at the grip, +Z along
// the tool toward its working end, +Y the tool's roll reference.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { HB } from './humanFormat';
import type { Pose } from './anim';

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
type RGB = [number, number, number];
/** vertex colour (linear), metalness/roughness and the per-vertex displacement direction for the instance parameter
 *  (`sv`: the bowstring's middle, the spindle below the hand) */
function paint(g: THREE.BufferGeometry, rgb: RGB, metal = 0, rough = 0.8, sv?: (x: number, y: number, z: number) => [number, number, number]): THREE.BufferGeometry {
  const gg = g.index ? g.toNonIndexed() : g; if (gg.getAttribute('uv')) gg.deleteAttribute('uv');
  const n = gg.getAttribute('position').count, c = new Float32Array(n * 3), m = new Float32Array(n * 2), d = new Float32Array(n * 3); const P = gg.getAttribute('position');
  for (let i = 0; i < n; i++) { c.set(rgb.map(lin), i * 3); m.set([metal, rough], i * 2); if (sv) d.set(sv(P.getX(i), P.getY(i), P.getZ(i)), i * 3); }
  gg.setAttribute('color', new THREE.BufferAttribute(c, 3)); gg.setAttribute('mr', new THREE.BufferAttribute(m, 2)); gg.setAttribute('sv', new THREE.BufferAttribute(d, 3)); return gg;
}
/** a cylinder from a to b (open ends unless `caps`) */
function rod(a: [number, number, number], b: [number, number, number], r0: number, r1 = r0, seg = 5, caps = false): THREE.BufferGeometry {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), L = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r1, r0, L, seg, 1, !caps).translate(0, L / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  return g.applyQuaternion(q).translate(A.x, A.y, A.z);
}
const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const WOOD: RGB = [0.45, 0.33, 0.21], WOOD_D: RGB = [0.36, 0.26, 0.16], IRON: RGB = [0.3, 0.29, 0.28], BRONZE: RGB = [0.62, 0.45, 0.26], MUD: RGB = [0.56, 0.47, 0.36], STRAW: RGB = [0.72, 0.62, 0.38];
const merge = (gs: THREE.BufferGeometry[]) => mergeGeometries(gs)!;

export const PROP_NOTES: Record<string, { tier: 'A' | 'B' | 'C'; note: string }> = {
  spear: { tier: 'B', note: 'long spear with a pomegranate-shaped butt counterweight, silver for the ordinary guards (Herodotus via IR-IMM; SUSA-ARCH); shaft length and blade C' },
  sack: { tier: 'B', note: 'sack on the shoulder (porters on the tribute reliefs carry skins and bags)' },
  jar: { tier: 'C', note: 'storage/water jar, plain buff ware (C)' },
  tablet: { tier: 'B', note: 'clay tablet (PF/PT tablets: A; size C)' },
  mallet: { tier: 'C', note: 'wooden mallet (NOT SEEN, C)' },
  basket: { tier: 'C', note: 'basket (C)' },
  hoe: { tier: 'C', note: 'hoe: an iron blade on a 1.25 m wooden handle (iron field tools are usual in the period; form NOT SEEN, C)' },
  sickle: { tier: 'C', note: 'iron sickle with a wooden handle (the sickle is the reaping tool of the ancient Near East: type B; form C)' },
  fork: { tier: 'C', note: 'wooden winnowing fork, four tines (winnowing by fork and shovel is the traditional practice; no Achaemenid example read: C)' },
  goad: { tier: 'C', note: 'goad stick for driving the ox team or the threshing animals (C)' },
  staff: { tier: 'C', note: 'herder’s staff (C)' },
  broom: { tier: 'C', note: 'handleless broom of twigs bound at one end (C)' },
  spindle: { tier: 'B', note: 'drop spindle with a low whorl hanging on the yarn (spindle whorls are common finds of the period: B object; form and use C)' },
  distaff: { tier: 'C', note: 'distaff with a hank of combed wool (C)' },
  trowel: { tier: 'C', note: 'small trowel for mud mortar (C)' },
  mould: { tier: 'B', note: 'wooden brick mould, an open frame with two handles (the brick mould is attested in Babylonia: "the brick mould of the king", WP-CAL, B; for 33 cm bricks, C)' },
  brick: { tier: 'C', note: 'sun-dried mud brick 33 × 33 × 11 cm (size C; the 0.12 m course of construction.ts)' },
  rope: { tier: 'C', note: 'hauling rope of plant fibre (C)' },
  adze: { tier: 'C', note: 'carpenter’s adze with an iron blade (wood handlers in the Treasury: HENK2023, B; the tool NOT SEEN, C)' },
  bow: { tier: 'B', note: 'composite bow, recurved (the guards’ bows of the reliefs and the Susa bricks: SUSA-ARCH, B); a boy’s practice bow of that form C' },
  arrow: { tier: 'B', note: 'reed arrow with a bronze head (arrowheads by the hundred in the Treasury: ISAC-FINDS, B; the trilobate form C)' },
  knife: { tier: 'C', note: 'iron knife (C). Shearing with a knife: shears are not attested for Persepolis in the research files (Q-192)' },
  beater: { tier: 'C', note: 'wooden weaving sword used to open the shed and beat in the weft (C)' },
  paddle: { tier: 'C', note: 'wooden stirring paddle for the mash (C)' },
  cloth: { tier: 'C', note: 'wet cloth or a hank of wool being washed (C)' },
  wisp: { tier: 'C', note: 'a twist of straw for rubbing down an animal (C)' },
  bowl: { tier: 'B', note: 'silver phiale being shined (gold-and-silver “shiners” of the Treasury: LIVIUS-TREAS, B; phialai of the delegations, B/C)' },
  rag: { tier: 'C', note: 'polishing rag (C)' },
  awl: { tier: 'C', note: 'bone awl for mending baskets, harness and sandals (C)' },
  ladle: { tier: 'C', note: 'wooden ladle (C)' },
  stick: { tier: 'C', note: 'brushwood stick for the fire (C)' },
  lead: { tier: 'C', note: 'lead rope of an animal brought to the offering place (C)' },
};

/** geometry of a kind; the Phase 3 kinds keep their old origins (spear: at the butt; others: at the grip) */
export function propGeometry(kind: string): THREE.BufferGeometry | null {
  switch (kind) {
    case 'spear': { // shaft 2.1 m, bronze blade, silver pomegranate butt (sphere with a small crown), C proportions
      const shaft = paint(new THREE.CylinderGeometry(0.014, 0.016, 2.1, 6).translate(0, 1.13, 0), [0.45, 0.33, 0.21], 0, 0.7);
      const socket = paint(new THREE.CylinderGeometry(0.017, 0.014, 0.08, 6).translate(0, 2.21, 0), [0.62, 0.45, 0.26], 1, 0.4);
      const blade = paint(new THREE.ConeGeometry(0.028, 0.26, 4).scale(1, 1, 0.35).translate(0, 2.38, 0), [0.62, 0.45, 0.26], 1, 0.35);
      const butt = paint(new THREE.SphereGeometry(0.045, 7, 5).translate(0, 0.05, 0), [0.8, 0.8, 0.78], 1, 0.3);
      const crown = paint(new THREE.CylinderGeometry(0.012, 0.022, 0.03, 6).translate(0, 0.1, 0), [0.8, 0.8, 0.78], 1, 0.3);
      return merge([shaft, socket, blade, butt, crown]);
    }
    case 'sack': return paint(new THREE.SphereGeometry(0.22, 8, 5).scale(1, 0.75, 0.7), [0.62, 0.55, 0.42], 0, 0.95);
    case 'jar': return paint(new THREE.LatheGeometry([[0, 0], [0.1, 0.02], [0.16, 0.18], [0.12, 0.36], [0.06, 0.42], [0.07, 0.46]].map(([x, y]) => new THREE.Vector2(x, y)), 14), [0.66, 0.46, 0.3], 0, 0.85);
    case 'tablet': return paint(new THREE.BoxGeometry(0.06, 0.02, 0.05), [0.56, 0.48, 0.37], 0, 0.9);
    case 'mallet': return merge([paint(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6).translate(0, -0.15, 0), [0.42, 0.31, 0.2], 0, 0.7), paint(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8).rotateZ(Math.PI / 2).translate(0, -0.3, 0), [0.4, 0.29, 0.18], 0, 0.7)]);
    case 'basket': return paint(new THREE.CylinderGeometry(0.18, 0.13, 0.18, 12, 1, true), [0.6, 0.52, 0.32], 0, 0.9);
    // ------------------------------------------------ work tools (grip frame: +Z toward the working end)
    case 'hoe': return merge([paint(rod([0, 0, -0.45], [0, 0, 0.8], 0.016, 0.018, 5), WOOD, 0, 0.7),
      paint(box(0.17, 0.2, 0.012, 0, -0.1, 0.8).rotateX(0).translate(0, 0, 0), IRON, 0.6, 0.55), paint(rod([0, 0, 0.78], [0, -0.03, 0.82], 0.025, 0.025, 5, true), IRON, 0.6, 0.55)]);
    case 'sickle': { // handle along −Z…+Z through the fist; the blade leaves the thumb end and curves toward +Y (the palm side)
      const g: THREE.BufferGeometry[] = [paint(rod([0, 0, -0.07], [0, 0, 0.07], 0.016, 0.016, 5, true), WOOD, 0, 0.7)];
      const n = 7; for (let i = 0; i < n; i++) { const a0 = (i / n) * Math.PI * 1.05, a1 = ((i + 1) / n) * Math.PI * 1.05, r = 0.13;
        const p0: [number, number, number] = [0, r - r * Math.cos(a0), 0.07 + r * Math.sin(a0)], p1: [number, number, number] = [0, r - r * Math.cos(a1), 0.07 + r * Math.sin(a1)];
        g.push(paint(rod(p0, p1, 0.012 * (1 - i / n * 0.6), 0.012 * (1 - (i + 1) / n * 0.6), 3), IRON, 0.6, 0.5)); }
      return merge(g);
    }
    case 'fork': { const g = [paint(rod([0, 0, -0.55], [0, 0, 1.15], 0.015, 0.017, 5), WOOD, 0, 0.75), paint(box(0.22, 0.03, 0.05, 0, 0, 1.15), WOOD_D, 0, 0.75)];
      for (const x of [-0.09, -0.03, 0.03, 0.09]) g.push(paint(rod([x, 0, 1.16], [x * 1.2, 0.04, 1.48], 0.008, 0.005, 3), WOOD_D, 0, 0.75));
      return merge(g); }
    case 'goad': return paint(rod([0, 0, -0.25], [0, 0, 1.15], 0.011, 0.007, 4), WOOD_D, 0, 0.8);
    case 'staff': return paint(rod([0, 0, -0.12], [0, 0, 1.5], 0.018, 0.016, 5, true), WOOD, 0, 0.8);
    case 'broom': return merge([paint(rod([0, 0, -0.1], [0, 0, 0.18], 0.028, 0.03, 6), [0.5, 0.42, 0.26], 0, 0.9), paint(rod([0, 0, 0.18], [0, 0, 0.56], 0.03, 0.1, 7), [0.6, 0.5, 0.3], 0, 0.95)]);
    case 'spindle': { // yarn from the hand down; the spindle below it, lowered by the instance parameter (the yarn's length)
      const down = (_x: number, y: number): [number, number, number] => [0, y < -0.001 ? -1 : 0, 0];
      return merge([paint(box(0.002, 0.01, 0.002, 0, -0.005, 0), [0.8, 0.75, 0.62], 0, 0.9, (_x, y) => [0, y < -0.005 ? -1 : 0, 0]),
        paint(rod([0, -0.01, 0], [0, -0.3, 0], 0.005, 0.004, 4, true), WOOD, 0, 0.6, down), paint(new THREE.CylinderGeometry(0.024, 0.024, 0.012, 8).translate(0, -0.24, 0), [0.55, 0.5, 0.45], 0, 0.8, down),
        paint(new THREE.CylinderGeometry(0.012, 0.009, 0.05, 6).translate(0, -0.06, 0), [0.8, 0.75, 0.62], 0, 0.95, down)]);
    }
    case 'distaff': return merge([paint(rod([0, 0, -0.1], [0, 0, 0.32], 0.009, 0.009, 4), WOOD, 0, 0.7), paint(new THREE.SphereGeometry(0.05, 7, 5).scale(1, 1, 2).translate(0, 0, 0.34), [0.8, 0.76, 0.66], 0, 1)]);
    case 'trowel': return merge([paint(rod([0, 0, -0.06], [0, 0, 0.06], 0.014, 0.014, 5, true), WOOD, 0, 0.7), paint(box(0.08, 0.006, 0.13, 0, -0.01, 0.13), BRONZE, 0.8, 0.45)]);
    case 'mould': { const g: THREE.BufferGeometry[] = []; const w = 0.36, h = 0.11, t = 0.022; // origin: the frame's centre at its bottom
      for (const s of [-1, 1]) { g.push(paint(box(t, h, w, s * (w / 2 - t / 2), h / 2, 0), WOOD, 0, 0.8)); g.push(paint(box(w, h, t, 0, h / 2, s * (w / 2 - t / 2)), WOOD, 0, 0.8)); g.push(paint(box(0.09, 0.03, 0.05, s * (w / 2 + 0.045), h * 0.7, 0), WOOD_D, 0, 0.8)); }
      return merge(g); }
    case 'brick': return paint(box(0.33, 0.11, 0.33), [0.62, 0.53, 0.4], 0, 0.95);
    case 'rope': { const g: THREE.BufferGeometry[] = []; const pts: [number, number, number][] = [[0, -0.55, -0.62], [0, -0.1, -0.42], [0, 0, -0.26], [0, 0, 0.3], [0, -0.06, 1.5], [0, -0.22, 3], [0, -0.5, 4.6]];
      for (let i = 0; i + 1 < pts.length; i++) g.push(paint(rod(pts[i], pts[i + 1], 0.013, 0.013, 4), [0.62, 0.54, 0.38], 0, 0.95)); return merge(g); }
    case 'adze': return merge([paint(rod([0, 0, -0.08], [0, 0, 0.36], 0.015, 0.017, 5), WOOD, 0, 0.7), paint(box(0.05, 0.12, 0.018, 0, -0.06, 0.36).rotateX(-0.25).translate(0, 0, 0.09), IRON, 0.6, 0.5)]);
    case 'bow': { // grip at the origin; limbs ±Y (1.05 m), recurved tips toward +Z (the target); string at z −0.14, its middle drawn back by the parameter (m)
      const g: THREE.BufferGeometry[] = []; const P = (u: number): [number, number, number] => { const y = 0.52 * u, a = Math.abs(u); return [0, y, 0.06 * a * a - 0.1 * a + (a > 0.8 ? 0.35 * (a - 0.8) : 0)]; };
      for (let i = -5; i < 5; i++) g.push(paint(rod(P(i / 5), P((i + 1) / 5), 0.016 - 0.008 * Math.abs(i + 0.5) / 5, 0.016 - 0.008 * Math.abs(i + 1.5) / 5, 4), [0.3, 0.2, 0.12], 0, 0.6));
      const tip = P(1), bot = P(-1), mid: [number, number, number] = [0, 0, -0.14];
      g.push(paint(rod(tip, mid, 0.0025, 0.0025, 3), [0.82, 0.78, 0.66], 0, 0.8, (_x, y) => [0, 0, Math.abs(y) < 0.02 ? -1 : 0]));
      g.push(paint(rod(mid, bot, 0.0025, 0.0025, 3), [0.82, 0.78, 0.66], 0, 0.8, (_x, y) => [0, 0, Math.abs(y) < 0.02 ? -1 : 0]));
      return merge(g); }
    case 'arrow': return merge([paint(rod([0, 0, 0], [0, 0, 0.7], 0.004, 0.004, 3), [0.62, 0.55, 0.36], 0, 0.8), paint(new THREE.ConeGeometry(0.009, 0.04, 3).rotateX(Math.PI / 2).translate(0, 0, 0.72), BRONZE, 0.8, 0.4),
      paint(box(0.002, 0.03, 0.09, 0, 0, 0.06), [0.3, 0.28, 0.25], 0, 0.9)]);
    case 'knife': return merge([paint(rod([0, 0, -0.06], [0, 0, 0.05], 0.013, 0.013, 5, true), WOOD_D, 0, 0.7), paint(box(0.004, 0.03, 0.15, 0, -0.004, 0.125), IRON, 0.6, 0.45)]);
    case 'beater': return paint(box(0.62, 0.012, 0.06), WOOD, 0, 0.6);
    case 'paddle': return merge([paint(rod([0, 0, -0.55], [0, 0, 0.9], 0.017, 0.017, 5), WOOD, 0, 0.75), paint(box(0.12, 0.018, 0.26, 0, 0, 1.0), WOOD_D, 0, 0.75)]);
    case 'cloth': return paint(new THREE.CylinderGeometry(0.05, 0.05, 0.36, 6, 1, false).rotateZ(Math.PI / 2).scale(1, 0.7, 1), [0.62, 0.58, 0.5], 0, 1);
    case 'wisp': return paint(rod([0, 0, -0.06], [0, 0, 0.16], 0.022, 0.03, 5, true), STRAW, 0, 1);
    case 'bowl': return paint(new THREE.LatheGeometry([[0, 0], [0.03, 0.002], [0.08, 0.018], [0.1, 0.04], [0.098, 0.042]].map(([x, y]) => new THREE.Vector2(x, y)), 12), [0.82, 0.8, 0.76], 1, 0.28);
    case 'rag': return paint(new THREE.SphereGeometry(0.035, 5, 4).scale(1, 0.7, 1.2), [0.7, 0.66, 0.58], 0, 1);
    case 'awl': return merge([paint(rod([0, 0, -0.05], [0, 0, 0.04], 0.012, 0.012, 4, true), [0.8, 0.76, 0.66], 0, 0.7), paint(rod([0, 0, 0.04], [0, 0, 0.12], 0.004, 0.001, 3), [0.8, 0.76, 0.66], 0, 0.7)]);
    case 'ladle': return merge([paint(rod([0, 0, -0.08], [0, 0, 0.36], 0.011, 0.011, 4), WOOD, 0, 0.7), paint(new THREE.SphereGeometry(0.045, 6, 3, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(0, 0.02, 0.4), WOOD_D, 0, 0.7)]);
    case 'stick': return paint(rod([0, 0, -0.15], [0, 0, 0.55], 0.012, 0.008, 4), [0.4, 0.3, 0.2], 0, 0.9);
    case 'lead': return paint(rod([0, 0, 0], [0, -0.1, 0.65], 0.007, 0.007, 3), [0.6, 0.52, 0.36], 0, 0.95);
    default: return null;
  }
}
export const PROP_KINDS = ['spear', 'sack', 'jar', 'tablet', 'mallet', 'basket'] as const;

/** how a prop is held: legacy (the Phase 3 placements), one hand (axis toward the cycle's tip or along the fist),
 *  two hands (the axis threads rear → front grip), mid (between the palms), hang (below the hand, turning), hip, palm,
 *  at (placed by the cycle), bow, arrow */
type Rule = 'legacy' | 'one' | 'two' | 'mid' | 'hang' | 'hip' | 'palm' | 'at' | 'bow' | 'arrow';
export interface PropSpec { geom: string; rule: Rule; hand?: 'l' | 'r'; front?: 'l' | 'r'; roll?: 'up' | 'palm' | 'away' | 'down'; up?: number; grip?: [number, number] }
/** every prop an activity can name (activities.ts); geometry is shared between kinds that are held differently */
export const PROPS: Record<string, PropSpec> = {
  spear: { geom: 'spear', rule: 'legacy', grip: [0.15, 1] }, sack: { geom: 'sack', rule: 'legacy', grip: [0.1, 0.7] }, jar: { geom: 'jar', rule: 'legacy', grip: [0.15, 1] },
  jar_head: { geom: 'jar', rule: 'legacy' }, tablet: { geom: 'tablet', rule: 'legacy', grip: [0.6, 0.3] }, mallet: { geom: 'mallet', rule: 'legacy', grip: [0.15, 1] },
  basket: { geom: 'basket', rule: 'legacy', grip: [0.8, 0.8] }, bread: { geom: 'basket', rule: 'legacy', grip: [0.8, 0.8] },
  hoe: { geom: 'hoe', rule: 'two', front: 'r', roll: 'away' }, sickle: { geom: 'sickle', rule: 'one', hand: 'r', roll: 'palm' }, fork: { geom: 'fork', rule: 'two', front: 'r', roll: 'up' },
  goad: { geom: 'goad', rule: 'one', hand: 'r', roll: 'up' }, staff: { geom: 'staff', rule: 'one', hand: 'r', roll: 'up' }, broom: { geom: 'broom', rule: 'one', hand: 'r', roll: 'up' },
  spindle: { geom: 'spindle', rule: 'hang', hand: 'r' }, distaff: { geom: 'distaff', rule: 'one', hand: 'l', roll: 'up', up: 1 }, trowel: { geom: 'trowel', rule: 'one', hand: 'r', roll: 'up' },
  mould: { geom: 'mould', rule: 'at' }, brick: { geom: 'brick', rule: 'mid' }, brick_l: { geom: 'brick', rule: 'palm', hand: 'l' },
  rope: { geom: 'rope', rule: 'two', front: 'l', roll: 'up' }, adze: { geom: 'adze', rule: 'one', hand: 'r', roll: 'up' }, bow: { geom: 'bow', rule: 'bow', hand: 'l' }, arrow: { geom: 'arrow', rule: 'arrow', hand: 'r' },
  knife: { geom: 'knife', rule: 'one', hand: 'r', roll: 'palm' }, beater: { geom: 'beater', rule: 'mid' }, paddle: { geom: 'paddle', rule: 'two', front: 'l', roll: 'up' },
  cloth: { geom: 'cloth', rule: 'mid' }, wisp: { geom: 'wisp', rule: 'one', hand: 'r', roll: 'up' }, bowl: { geom: 'bowl', rule: 'palm', hand: 'l' }, rag: { geom: 'rag', rule: 'one', hand: 'r', roll: 'up' },
  awl: { geom: 'awl', rule: 'one', hand: 'r', roll: 'up' }, ladle: { geom: 'ladle', rule: 'one', hand: 'r', roll: 'up' }, stick: { geom: 'stick', rule: 'one', hand: 'r', roll: 'up' },
  lead: { geom: 'lead', rule: 'one', hand: 'r', roll: 'up' }, jar_both: { geom: 'jar', rule: 'mid' }, sack_both: { geom: 'sack', rule: 'mid' },
  basket_hip: { geom: 'basket', rule: 'hip', hand: 'l' }, basket_both: { geom: 'basket', rule: 'mid' }, basket_lap: { geom: 'basket', rule: 'palm', hand: 'l' },
};
/** the two carried-prop meshes: small objects (with the Phase 3 set) and long tools. Every kind of a class is in one union */
export const PROP_CLASSES: string[][] = [
  ['spear', 'sack', 'jar', 'tablet', 'mallet', 'basket', 'sickle', 'spindle', 'distaff', 'trowel', 'brick', 'knife', 'cloth', 'wisp', 'bowl', 'rag', 'awl', 'arrow', 'lead', 'ladle', 'stick'],
  ['hoe', 'fork', 'goad', 'staff', 'broom', 'mould', 'rope', 'adze', 'bow', 'beater', 'paddle'],
];
/** class and index in the class of a prop kind */
export function propSlot(kind: string): [number, number] | null {
  const g = PROPS[kind]?.geom ?? kind; for (let c = 0; c < PROP_CLASSES.length; c++) { const i = PROP_CLASSES[c].indexOf(g); if (i >= 0) return [c, i]; } return null;
}
/** the kinds of a class in one geometry, with the kind's index per vertex ('pk'); an instance shows the kind whose index
 *  it carries ('ik') and the other kinds' vertices collapse to a point */
export function propUnionGeometry(cls = 0): THREE.BufferGeometry {
  return mergeGeometries(PROP_CLASSES[cls].map((k, i) => { let g = propGeometry(k)!.clone(); if (!g.getAttribute('sv')) g = withSv(g); const n = g.getAttribute('position').count;
    g.setAttribute('pk', new THREE.BufferAttribute(new Float32Array(n).fill(i), 1)); return g; }))!;
}
function withSv(g: THREE.BufferGeometry) { g.setAttribute('sv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3), 3)); return g; }
/** a box painted for the prop material (work objects) */
export function paintedBox(w: number, h: number, d: number, rgb: [number, number, number], rough: number) { return paint(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), rgb, 0, rough); }
export { paint as paintGeometry, rod as rodGeometry };

// ------------------------------------------------------------------------------------------------ placement
/** the solved rig in character space (RigSolver.wt / wr: bone heads and world rotations, before the root and scale) */
export interface RigView { wt: ArrayLike<number>; wr: ArrayLike<number> }
const V = THREE.Vector3;
const bone = (R: RigView, b: number) => new V(R.wt[b * 3], R.wt[b * 3 + 1], R.wt[b * 3 + 2]);
const axis = (R: RigView, b: number, x: number, y: number, z: number) => { const w = R.wr, o = b * 9; return new V(w[o] * x + w[o + 1] * y + w[o + 2] * z, w[o + 3] * x + w[o + 4] * y + w[o + 5] * z, w[o + 6] * x + w[o + 7] * y + w[o + 8] * z); };
/** the palm of the Phase 3 placements (legacy) */
const palm0 = (R: RigView, s: 'l' | 'r') => bone(R, HB[`hand_${s}`]).lerp(bone(R, HB[`middle_01_${s}`]), 0.75);
/** where a closed hand holds a handle (unscaled character space): across the palm at the knuckles, a little in front */
export function gripPoint(R: RigView, s: 'l' | 'r') { return bone(R, HB[`hand_${s}`]).lerp(bone(R, HB[`middle_01_${s}`]), 0.85).add(axis(R, HB[`hand_${s}`], s === 'r' ? 0.022 : -0.022, 0, 0)); }
/** out of the palm (the palm normal) and along the fist toward the thumb (the grip axis) */
export const palmNormal = (R: RigView, s: 'l' | 'r') => axis(R, HB[`hand_${s}`], s === 'r' ? 1 : -1, 0, 0);
export const gripAxis = (R: RigView, s: 'l' | 'r') => axis(R, HB[`hand_${s}`], 0, 0, 1);
const frame = (o: THREE.Vector3, z: THREE.Vector3, yRef: THREE.Vector3, out: THREE.Matrix4) => {
  const Z = z.clone().normalize(); let Y = yRef.clone().sub(Z.clone().multiplyScalar(yRef.dot(Z))); if (Y.lengthSq() < 1e-8) Y = Math.abs(Z.y) < 0.9 ? new V(0, 1, 0).sub(Z.clone().multiplyScalar(Z.y)) : new V(1, 0, 0).sub(Z.clone().multiplyScalar(Z.x)); Y.normalize();
  const X = new V().crossVectors(Y, Z); return out.makeBasis(X, Y, Z).setPosition(o);
};
/** a prop's transform in character space (scaled body: bone positions × s; the prop keeps its size). Returns false when
 *  the cycle hides it this frame. `slot` 0 or 1 (prop or prop2). `param` receives the instance parameter (bow draw,
 *  spindle drop) */
export function placeProp(kind: string, R: RigView, po: Pose, s: number, time: number, slot: 0 | 1, out: THREE.Matrix4, param?: { v: number }): boolean {
  if (po.show && !po.show[slot]) return false;
  const P = PROPS[kind] ?? { geom: kind, rule: 'legacy' as Rule }; if (param) param.v = 0;
  const tip = po.tip?.[slot] ?? null;
  switch (P.rule) {
    case 'legacy': {
      const k = kind === 'bread' ? 'basket' : kind; let pos: THREE.Vector3; let rot = new THREE.Matrix4(); let sc = 1;
      switch (k) {
        case 'spear': { const h = palm0(R, 'r'); pos = new V(h.x, 0, h.z).multiplyScalar(s); pos.y = 0; break; } // upright, butt on the ground by the right hand
        case 'sack': { pos = bone(R, HB.upperarm_r).multiplyScalar(s).add(new V(0.02, 0.13, -0.02)); rot.makeRotationZ(0.3); break; }
        case 'jar': { pos = palm0(R, 'r').multiplyScalar(s).add(new V(0, -0.45, 0.08)); break; }
        case 'jar_head': { pos = bone(R, HB.head).multiplyScalar(s).add(new V(0, 0.25, 0.02)); sc = 0.8; break; }
        case 'tablet': { pos = palm0(R, 'l').multiplyScalar(s).add(new V(0, 0.02, 0.03)); break; }
        case 'mallet': { pos = palm0(R, 'r').multiplyScalar(s); const w = R.wr, o = HB.hand_r * 9; rot = new THREE.Matrix4().set(w[o], w[o + 1], w[o + 2], 0, w[o + 3], w[o + 4], w[o + 5], 0, w[o + 6], w[o + 7], w[o + 8], 0, 0, 0, 0, 1); break; }
        default: { pos = palm0(R, 'l').add(palm0(R, 'r')).multiplyScalar(0.5 * s).add(new V(0, 0.05, 0)); break; }
      }
      out.compose(pos, new THREE.Quaternion().setFromRotationMatrix(rot), new V(sc, sc, sc)); return true;
    }
    case 'one': case 'palm': {
      const h = P.hand ?? 'r', g = gripPoint(R, h).multiplyScalar(s);
      if (P.rule === 'palm') { const n = palmNormal(R, h); const o = g.clone().add(n.clone().multiplyScalar(0.035)); // resting on the palm, upright
        if (P.geom === 'brick' || P.geom === 'basket') o.y -= P.geom === 'brick' ? 0.02 : 0.05;
        out.makeRotationY(Math.atan2(n.x, n.z) * 0).setPosition(o); return true; }
      const z = tip ? new V(tip[0] * s, tip[1] * s, tip[2] * s).sub(g) : P.up ? new V(0, 1, 0.35) : gripAxis(R, h);
      const yRef = P.roll === 'palm' ? palmNormal(R, h) : P.roll === 'down' ? new V(0, -1, 0) : new V(0, 1, 0);
      frame(g, z, yRef, out); return true;
    }
    case 'two': {
      const f = P.front ?? 'r', r = f === 'r' ? 'l' : 'r', F = gripPoint(R, f).multiplyScalar(s), B = gripPoint(R, r).multiplyScalar(s);
      const z = F.clone().sub(B); if (z.lengthSq() < 1e-6) z.set(0, 0, 1);
      const yRef = P.roll === 'away' ? F.clone().sub(bone(R, HB.pelvis).multiplyScalar(s)) : new V(0, 1, 0);
      frame(F, z, yRef, out); return true;
    }
    case 'mid': {
      const L = gripPoint(R, 'l').multiplyScalar(s), Rr = gripPoint(R, 'r').multiplyScalar(s), m = L.clone().add(Rr).multiplyScalar(0.5);
      const x = L.clone().sub(Rr); x.y = 0; if (x.lengthSq() < 1e-6) x.set(1, 0, 0); x.normalize();
      const y = new V(0, 1, 0), z = new V().crossVectors(x, y);
      if (P.geom === 'jar') m.y -= 0.2; else if (P.geom === 'sack') m.add(z.clone().multiplyScalar(0.12)); else if (P.geom === 'basket') m.y -= 0.06; else if (P.geom === 'brick') m.y -= 0.03; else if (P.geom === 'beater' || P.geom === 'cloth') { /* between the hands */ }
      out.makeBasis(x, y, z).setPosition(m); return true;
    }
    case 'hang': { const g = gripPoint(R, P.hand ?? 'r').multiplyScalar(s); out.makeRotationY((time * 21) % (2 * Math.PI)).setPosition(g); if (param) param.v = po.aux ?? 0.4; return true; }
    case 'hip': { const g = gripPoint(R, 'l').multiplyScalar(s).add(new V(0.03, -0.1, 0)); out.makeRotationZ(0.15).setPosition(g); return true; }
    case 'at': { const a = po.at; if (!a) return false; out.makeRotationY(a[3]).setPosition(a[0] * s, a[1] * s, a[2] * s); return true; }
    case 'bow': case 'arrow': {
      const L = gripPoint(R, 'l').multiplyScalar(s), Rr = gripPoint(R, 'r').multiplyScalar(s), d = L.clone().sub(Rr);
      // the bow: gripped by the left hand, its axis along the line to the drawing hand (the arrow's line), limbs upright;
      // the parameter is how far the string's middle is drawn back (m): the pose's draw (0..1) of the distance to that hand
      // (undrawn, the bow stays upright facing the target, the body's +X in the archery cycle, whatever the hands do)
      if (P.rule === 'bow') { const w = Math.min(1, Math.max(0, po.ip ?? 0)), full = Math.max(0, d.length() - 0.14);
        const z = new V(d.x + 0.15 * (1 - w), d.y * w, d.z); if (z.lengthSq() < 1e-6) z.set(1, 0, 0); frame(L, z, new V(0, 1, 0), out); if (param) param.v = w * full; return true; }
      frame(Rr, d.lengthSq() > 1e-6 ? d : new V(1, 0, 0), new V(0, 1, 0), out); return true;
    }
  }
  return false;
}
