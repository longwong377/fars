// Things at the place of work (D-142): the loom, the brick mould's mud heap and drying bricks, the brick stack and the
// mortar tub, the threshing floor and its heaps, sheaves and stooks, the ard, the brewing vat, the hearth with its pot,
// the washing stone and the drying rack, the archery target, the timber on its blocks, the hides and the butcher's work,
// the bier. Each kind is procedural (C), with a tier and a note (WORK_NOTES; the dev overlay prints them), authored in the
// performer's frame (origin on the ground, +Z the performer's forward). The crowd places them every frame from the
// simulation's spot and heading of the people performing (activities.ts `work`), so an object is where the simulation
// says the work is and appears with it. One InstancedMesh per kind (lazily made): a draw per kind in view, not per
// object; only the near shadow cascades (nearCascadesOnly).
import * as THREE from 'three/webgpu';
import { attribute } from 'three/tsl';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { paintGeometry as paint, rodGeometry as rod, propGeometry } from './props';
import { nearCascadesOnly } from './humanGPU';

export type WorkKind = 'drum_sledge' | 'brick_stack' | 'mud_heap' | 'brick_field' | 'jar' | 'mortar_tub' | 'brick_course' | 'beam' | 'loom' | 'dung_cakes' | 'vat' | 'fodder'
  | 'fleece' | 'butchery' | 'hides' | 'basket_meat' | 'threshing_floor' | 'stooks' | 'sheaves' | 'sheaf' | 'grain_heap' | 'spoil' | 'basket_fruit' | 'press' | 'brushwood'
  | 'pigment_slab' | 'bier' | 'wash_stone' | 'drying_rack' | 'target' | 'hearth_pot' | 'ard' | 'throne'
  // D-210: the vehicles (gap audit items 16, 17) and the state poultry yard (item 11)
  | 'cart' | 'chariot' | 'wagon' | 'hurdles';
type RGB = [number, number, number];
const MUD: RGB = [0.5, 0.41, 0.31], MUD_WET: RGB = [0.36, 0.29, 0.22], BRICK: RGB = [0.62, 0.53, 0.4], STRAW: RGB = [0.72, 0.62, 0.38], STRAW_D: RGB = [0.62, 0.52, 0.3],
  WOOD: RGB = [0.45, 0.33, 0.21], WOOD_D: RGB = [0.34, 0.25, 0.16], STONE: RGB = [0.55, 0.54, 0.52], LIME: RGB = [0.66, 0.64, 0.6], POT: RGB = [0.62, 0.44, 0.3], WOOL: RGB = [0.8, 0.76, 0.66],
  HIDE: RGB = [0.5, 0.36, 0.23], MEAT: RGB = [0.42, 0.2, 0.16], FAT: RGB = [0.78, 0.72, 0.6], EARTH: RGB = [0.46, 0.39, 0.3], LINEN: RGB = [0.8, 0.77, 0.7];
const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
const mound = (r: number, h: number, seg = 9, x = 0, z = 0) => new THREE.LatheGeometry([[r * 1.02, 0], [r, 0.02], [r * 0.8, h * 0.45], [r * 0.45, h * 0.86], [0, h]].map(([a, b]) => new THREE.Vector2(a, b)), seg).translate(x, 0, z);
const lathe = (pts: number[][], seg: number) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg);
const P = (g: THREE.BufferGeometry, c: RGB, rough = 0.9, metal = 0) => paint(g, c, metal, rough);
const merge = (gs: THREE.BufferGeometry[]) => mergeGeometries(gs)!;
/** a small deterministic jitter */
const jit = (i: number, s = 1) => (Math.sin(i * 12.9898 + s * 78.233) * 43758.5453) % 1;
/** a sheaf of cut barley along +Y from its butt: the stalks narrowing to the band, the ears flaring beyond it (C) */
const EARS: RGB = [0.8, 0.68, 0.42];
const sheafG = (len = 0.9, seg = 6) => merge([P(lathe([[0, 0], [0.075, 0.01], [0.07, 0.25 * len], [0.05, 0.45 * len], [0.06, 0.52 * len]], seg), STRAW),
  P(lathe([[0.06, 0.52 * len], [0.11, 0.72 * len], [0.12, 0.86 * len], [0.07, 0.97 * len], [0, len]], seg), EARS)]);
/** the same lying on the ground along +X, its butt at x = 0 */
const sheafLying = (len = 0.9) => sheafG(len).rotateZ(-Math.PI / 2).scale(1, 0.75, 1).translate(0, 0.085, 0);

export const WORK_NOTES: Record<WorkKind, { tier: 'A' | 'B' | 'C'; note: string }> = {
  drum_sledge: { tier: 'C', note: 'a column drum of the Hall of a Hundred Columns on a wooden sledge, hauled with ropes (drums dressed on the Terrace: STONE, B; sledge C)' },
  brick_stack: { tier: 'C', note: 'a stack of sun-dried mud bricks (C)' },
  mud_heap: { tier: 'C', note: 'mud tempered with straw for the moulds (C)' },
  brick_field: { tier: 'C', note: 'moulded bricks drying in rows on the ground (E-63; C)' },
  jar: { tier: 'C', note: 'water jar (C)' },
  mortar_tub: { tier: 'C', note: 'a basket tub of mud mortar (C)' },
  brick_course: { tier: 'C', note: 'the course being laid, bricks in mud mortar (C)' },
  beam: { tier: 'C', note: 'a squared timber on two blocks, being dressed; chips on the ground (C)' },
  loom: { tier: 'C', note: 'horizontal ground loom: two beams pegged to the ground, the warp between, the woven cloth at the front, the heddle rod on two stones and a shed stick (the ground loom chosen over the warp-weighted loom: no loom weights are recorded for Fars in the research files; D-142, Q-190; C)' },
  dung_cakes: { tier: 'C', note: 'dung cakes set out to dry for fuel (C)' },
  vat: { tier: 'C', note: 'brewing vat, a large jar with the mash, and two smaller jars (PF 40: beer made, A; vessels C)' },
  fodder: { tier: 'C', note: 'fodder heap (C)' },
  fleece: { tier: 'C', note: 'shorn fleece (C)' },
  butchery: { tier: 'B', note: 'a hide spread on the ground with the joints of a divided carcass (PF 58-60: slaughter at the stockyard, A; shown without spectacle, C)' },
  hides: { tier: 'B', note: 'folded hides for the Treasury (PF 58-60: the hides of slaughtered small cattle delivered to the Treasury, A; stack C)' },
  basket_meat: { tier: 'C', note: 'a basket of meat (C)' },
  threshing_floor: { tier: 'C', note: 'the village threshing floor: a beaten circle 7 m across spread with sheaves and straw, a post in the middle (E-43; C)' },
  stooks: { tier: 'C', note: 'sheaves stood in stooks in the field (C)' },
  sheaves: { tier: 'C', note: 'handfuls and sheaves lying where the reapers laid them (C)' },
  sheaf: { tier: 'C', note: 'a sheaf being bound (C)' },
  grain_heap: { tier: 'C', note: 'the heap of threshed grain and chaff (C)' },
  spoil: { tier: 'C', note: 'earth and silt dug out (C)' },
  basket_fruit: { tier: 'C', note: 'a basket of picked grapes or figs (E-45, E-46; C)' },
  press: { tier: 'C', note: 'a plastered treading basin full of grapes (E-45; C)' },
  brushwood: { tier: 'C', note: 'brushwood for the fire (C)' },
  pigment_slab: { tier: 'B', note: 'a grinding slab with pigments, Egyptian blue among them (PW-PIGMENT2021: pigment making at Persepolis West, B; slab C)' },
  bier: { tier: 'C', note: 'a bier of two poles and a plank with the dead wrapped in a linen shroud (E-71; the dead are carried out: HDT 1.140, B claim; form C). Exposure is never shown' },
  wash_stone: { tier: 'C', note: 'a flat stone at the water’s edge for beating cloth (C)' },
  drying_rack: { tier: 'C', note: 'two forked posts and a pole with washed cloth hung to dry (C)' },
  target: { tier: 'C', note: 'a straw butt with a hide face on a post, for archery practice (C)' },
  hearth_pot: { tier: 'C', note: 'three hearth stones, ash and embers, a cooking pot on them (C; the fire is the settlement’s own)' },
  ard: { tier: 'C', note: 'a wooden ard with a stilt, a sole with a share and a beam to the yoke (the scratch plough of the ancient Near East: type B; form C)' },
  cart: { tier: 'C', note: 'an ox cart: a plank bed on two solid wheels of three boards, a pole to the yoke on the oxen’s necks, loaded with sacks of grain (carts are silent at Persepolis; the Assyrian reliefs show such carts: B analogy; form, size and load C)' },
  chariot: { tier: 'B', note: 'a two-wheeled chariot with spoked wheels, a box for the driver and a pole to the yoke of two horses (chariots on the Apadana reliefs and the royal chariot of HDT 7.40-41: B; form, size and the eight spokes C); court setting only' },
  wagon: { tier: 'C', note: 'a covered four-wheeled wagon (harmamaxa) for the royal women on the road (HDT 7.83, a claim; RECOLLECTION, NOT SEEN): a box on solid wheels under an arched cloth cover, a pole to the yoke (form and size C); court setting only' },
  hurdles: { tier: 'C', note: 'the state poultry yard: a ring of wattle hurdles and a low mud-brick coop (poultry and their fodder: PF 2034, IR-PET, B; where and how kept C)' },
  throne: { tier: 'B', note: 'the king’s throne and footstool at an audience (court setting, D-199): a high-backed chair on turned legs with lion’s-paw feet, and a footstool, as the Treasury audience relief carves them (TREAS-AUD, B); gilded wood and the sizes C: the seat 0.525 m and the footstool 0.105 m high, fitted to the enthroned pose measured on the rig (anim ENTHRONED); where it stood in the Apadana is not known (C)' },
};

export function workGeometry(kind: WorkKind): THREE.BufferGeometry {
  switch (kind) {
    case 'drum_sledge': { const g = [P(new THREE.CylinderGeometry(0.62, 0.62, 0.9, 16).translate(0, 0.27 + 0.45, 0), LIME, 0.85)];
      for (const x of [-0.45, 0.45]) g.push(P(box(0.14, 0.14, 1.9, x, 0, 0), WOOD_D));
      for (const z of [-0.7, 0, 0.7]) g.push(P(box(1.1, 0.12, 0.2, 0, 0.14, z), WOOD));
      g.push(P(rod([0, 0.2, -0.95], [0, 0.35, -1.6], 0.018, 0.018, 4), [0.62, 0.54, 0.38]));
      return merge(g); }
    case 'brick_stack': { const g: THREE.BufferGeometry[] = []; for (let l = 0; l < 5; l++) for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) g.push(P(box(0.33, 0.105, 0.33, (i - 0.5) * 0.35 + (l % 2) * 0.02, l * 0.11, (j - 0.5) * 0.35), BRICK, 0.95)); return merge(g); }
    case 'mud_heap': return merge([P(mound(0.4, 0.2, 9), MUD_WET, 0.7), P(box(0.3, 0.01, 0.06, 0.1, 0.19, 0.05).rotateY(0.6), STRAW)]);
    case 'brick_field': { const g: THREE.BufferGeometry[] = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) g.push(P(box(0.33, 0.1, 0.33, c * 0.4 - 0.8, 0, r * 0.4 - 0.4), r === 0 && c < 2 ? MUD : BRICK, 0.95)); return merge(g); }
    case 'jar': return propGeometry('jar')!.clone();
    case 'mortar_tub': return merge([P(new THREE.CylinderGeometry(0.26, 0.2, 0.2, 10, 1, true).translate(0, 0.1, 0), [0.6, 0.52, 0.32]), P(new THREE.CylinderGeometry(0.24, 0.24, 0.02, 10).translate(0, 0.16, 0), MUD_WET, 0.6)]);
    case 'brick_course': { const g: THREE.BufferGeometry[] = [P(box(1.5, 0.012, 0.36, 0, 0, 0), MUD_WET, 0.7)]; for (let i = 0; i < 4; i++) g.push(P(box(0.33, 0.105, 0.33, i * 0.345 - 0.52, 0.012, 0), i === 3 ? MUD : BRICK, 0.95)); return merge(g); }
    case 'beam': { const g = [P(box(3.0, 0.24, 0.26, 0, 0.32, 0), WOOD), P(box(0.3, 0.32, 0.34, -1.1, 0, 0), STONE), P(box(0.3, 0.32, 0.34, 1.1, 0, 0), STONE)];
      for (let i = 0; i < 6; i++) g.push(P(box(0.05, 0.012, 0.03, 0.4 * jit(i) - 0.1, 0, 0.35 + 0.25 * jit(i, 2)).rotateY(jit(i, 3) * 3), [0.62, 0.5, 0.34]));
      return merge(g); }
    case 'loom': { // origin at the fell (the edge of the weaving): the weaver sits on the woven cloth behind it, the front
      // beam behind her at z −0.8, the warp runs to the back beam at z 1.9; the heddle rod on two stones, the shed stick
      const g: THREE.BufferGeometry[] = [];
      for (const z of [-0.8, 1.9]) { g.push(P(rod([-0.55, 0.06, z], [0.55, 0.06, z], 0.032, 0.032, 6), WOOD)); for (const x of [-0.58, 0.58]) g.push(P(rod([x, 0, z + (z > 0 ? 0.12 : -0.12)], [x, 0.12, z], 0.02, 0.02, 4), WOOD_D)); }
      g.push(P(box(0.9, 0.004, 0.8, 0, 0.03, -0.4), [0.55, 0.16, 0.12], 0.95)); // woven cloth (madder red, C)
      for (let i = 0; i < 4; i++) g.push(P(box(0.9, 0.005, 0.03, 0, 0.031, -0.7 + i * 0.18), [0.2, 0.24, 0.42], 0.95)); // stripes (woad, C)
      g.push(P(box(0.9, 0.003, 1.9, 0, 0.055, 0.95), [0.84, 0.8, 0.7], 0.95)); // the warp (undyed wool)
      g.push(P(rod([-0.55, 0.22, 0.28], [0.55, 0.22, 0.28], 0.014, 0.014, 4), WOOD)); for (const x of [-0.52, 0.52]) g.push(P(box(0.12, 0.2, 0.12, x, 0, 0.28), STONE));
      g.push(P(box(1.0, 0.035, 0.07, 0, 0.065, 0.62), WOOD_D)); // shed stick
      return merge(g); }
    case 'dung_cakes': { const g: THREE.BufferGeometry[] = []; for (let i = 0; i < 7; i++) g.push(P(new THREE.CylinderGeometry(0.1, 0.11, 0.035, 7).translate((i % 4) * 0.26 - 0.3, 0.018, Math.floor(i / 4) * 0.26), [0.3, 0.25, 0.18])); return merge(g); }
    case 'vat': { const big = lathe([[0.17, 0], [0.31, 0.15], [0.36, 0.42], [0.3, 0.66], [0.25, 0.71], [0.27, 0.75]], 12);
      return merge([P(big, POT, 0.85), P(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 12).translate(0, 0.64, 0), [0.42, 0.33, 0.2], 0.4),
        P(lathe([[0.1, 0], [0.2, 0.12], [0.2, 0.34], [0.1, 0.5], [0.08, 0.54]], 9).translate(0.75, 0, 0.1), POT, 0.85), P(lathe([[0.1, 0], [0.18, 0.1], [0.18, 0.3], [0.1, 0.44], [0.08, 0.47]], 9).translate(-0.72, 0, -0.1), POT, 0.85)]); }
    case 'fodder': return P(mound(0.34, 0.16, 8), STRAW_D);
    case 'fleece': return merge([P(mound(0.26, 0.12, 8), WOOL, 1), P(mound(0.16, 0.08, 7, 0.22, 0.12), [0.7, 0.66, 0.56], 1)]);
    case 'butchery': { const g = [P(box(1.05, 0.012, 0.72, 0, 0, 0).rotateY(0.1), HIDE, 0.8)];
      const joint = (x: number, z: number, r: number, l: number, a: number) => [P(new THREE.SphereGeometry(r, 6, 4).scale(1, 0.7, l / r).rotateY(a).translate(x, r * 0.6, z), MEAT, 0.6), P(new THREE.SphereGeometry(r * 0.45, 5, 3).translate(x + Math.sin(a) * l * 0.9, r * 0.5, z + Math.cos(a) * l * 0.9), FAT, 0.6)];
      g.push(...joint(-0.25, 0.1, 0.07, 0.17, 0.4), ...joint(0.02, -0.1, 0.06, 0.15, -0.3), ...joint(0.28, 0.12, 0.08, 0.2, 1.2), ...joint(0.05, 0.2, 0.05, 0.1, 2));
      return merge(g); }
    case 'hides': { const g: THREE.BufferGeometry[] = []; for (let i = 0; i < 4; i++) g.push(P(box(0.62, 0.035, 0.46, 0.02 * jit(i), i * 0.036, 0.02 * jit(i, 3)).rotateY(0.15 * jit(i, 5)), i % 2 ? HIDE : [0.42, 0.3, 0.2], 0.85)); return merge(g); }
    case 'basket_meat': return merge([P(new THREE.CylinderGeometry(0.2, 0.15, 0.18, 10, 1, true).translate(0, 0.09, 0), [0.6, 0.52, 0.32]), P(mound(0.17, 0.08, 7).translate(0, 0.1, 0), MEAT, 0.6)]);
    case 'threshing_floor': return merge([P(new THREE.CylinderGeometry(3.5, 3.55, 0.05, 28).translate(0, 0.025, 0), [0.66, 0.58, 0.4], 1), P(new THREE.CylinderGeometry(2.9, 3.3, 0.1, 22, 1, true).translate(0, 0.08, 0), STRAW, 1),
      P(new THREE.CylinderGeometry(2.9, 2.9, 0.02, 22).translate(0, 0.12, 0), STRAW_D, 1), P(rod([0, 0, 0], [0, 1.5, 0], 0.07, 0.06, 6), WOOD_D)]);
    case 'stooks': { const g: THREE.BufferGeometry[] = []; // three stooks of five sheaves standing ears up, leaning together
      for (let i = 0; i < 3; i++) for (let j = 0; j < 5; j++) g.push(sheafG(0.82 + 0.06 * jit(i * 5 + j, 2)).rotateX(-0.24).translate(0, 0, 0.17).rotateY((2 * Math.PI * j) / 5 + 0.3 * jit(i, 3)).translate(i * 0.9, 0, 0.15 * jit(i)));
      return merge(g); }
    case 'sheaves': { const g: THREE.BufferGeometry[] = []; for (let i = 0; i < 4; i++) g.push(sheafLying(0.82 + 0.08 * jit(i, 5)).rotateY(-Math.PI / 2 + 1.2 + 0.4 * jit(i)).translate(0.35 * i - 0.4, 0, 0.3 * jit(i, 4))); return merge(g); }
    case 'sheaf': return merge([sheafLying(0.9).translate(-0.45, 0, 0), P(rod([-0.07, 0.085, 0], [-0.03, 0.085, 0], 0.06, 0.06, 7), STRAW_D)]); // the band being tied
    case 'grain_heap': return merge([P(new THREE.ConeGeometry(0.65, 0.45, 12).translate(0, 0.225, 0), [0.62, 0.5, 0.3], 1), P(mound(0.9, 0.08, 10, 0.5, 0.3), [0.74, 0.66, 0.46], 1)]);
    case 'spoil': return P(mound(0.55, 0.3, 9), EARTH);
    case 'basket_fruit': return merge([P(new THREE.CylinderGeometry(0.2, 0.15, 0.2, 10, 1, true).translate(0, 0.1, 0), [0.6, 0.52, 0.32]), P(mound(0.18, 0.1, 8).translate(0, 0.12, 0), [0.26, 0.12, 0.2], 0.5)]);
    case 'press': { const g = [P(box(1.7, 0.02, 1.7, 0, 0, 0), LIME, 0.8), P(box(1.5, 0.03, 1.5, 0, 0.1, 0), [0.28, 0.12, 0.18], 0.4)];
      for (const [x, z, w, d] of [[0, 0.82, 1.74, 0.1], [0, -0.82, 1.74, 0.1], [0.82, 0, 0.1, 1.54], [-0.82, 0, 0.1, 1.54]]) g.push(P(box(w, 0.32, d, x, 0, z), LIME, 0.8));
      return merge(g); }
    case 'brushwood': { const g: THREE.BufferGeometry[] = []; for (let i = 0; i < 9; i++) { const a = jit(i) * 3, l = 0.55 + 0.3 * jit(i, 2); g.push(P(rod([-Math.cos(a) * l / 2, 0.03 + 0.03 * (i % 3), -Math.sin(a) * l / 2], [Math.cos(a) * l / 2, 0.05 + 0.04 * (i % 3), Math.sin(a) * l / 2], 0.012, 0.008, 3), [0.38, 0.29, 0.2])); } return merge(g); }
    case 'pigment_slab': { const g = [P(box(0.36, 0.07, 0.26, 0, 0, 0), STONE, 0.8), P(box(0.12, 0.03, 0.08, 0.04, 0.07, 0.02), [0.5, 0.49, 0.47], 0.7)];
      const pig: RGB[] = [[0.12, 0.28, 0.62], [0.22, 0.48, 0.34], [0.55, 0.2, 0.13], [0.76, 0.58, 0.26]]; pig.forEach((c, i) => g.push(P(mound(0.035, 0.025, 6, -0.12 + i * 0.08, -0.08).translate(0, 0.07, 0), c, 0.95)));
      return merge(g); }
    case 'bier': { const y = 1.4, g: THREE.BufferGeometry[] = [];
      for (const x of [-0.31, 0.31]) g.push(P(rod([x, y, -1.35], [x, y, 1.35], 0.024, 0.024, 5, true), WOOD));
      for (const z of [-0.85, -0.3, 0.3, 0.85]) g.push(P(box(0.66, 0.04, 0.09, 0, y - 0.05, z), WOOD_D));
      g.push(P(box(0.5, 0.02, 1.8, 0, y - 0.01, 0), WOOD));
      g.push(P(new THREE.CapsuleGeometry(0.16, 1.35, 3, 7).rotateX(Math.PI / 2).scale(1.05, 0.7, 1).translate(0, y + 0.12, 0), LINEN, 1));
      return merge(g); }
    case 'throne': { // origin under the seated king's root: the seat behind (z −0.22 … 0.22), the footstool in front (C)
      const GILT: RGB = [0.72, 0.56, 0.3], seatY = 0.525, g: THREE.BufferGeometry[] = [];
      g.push(paint(box(0.62, 0.05, 0.46, 0, seatY - 0.09, 0), GILT, 0.8, 0.4));
      g.push(paint(box(0.6, 0.045, 0.43, 0, seatY - 0.04, 0), [0.45, 0.16, 0.14], 0, 0.95)); // a cushion (C), its top the seat
      g.push(paint(box(0.6, 0.82, 0.045, 0, seatY - 0.04, -0.245), GILT, 0.8, 0.4));
      for (const x of [-0.29, 0.29]) g.push(paint(rod([x, seatY + 0.78, -0.245], [x, seatY + 0.86, -0.245], 0.024, 0.012, 6, true), GILT, 0.8, 0.35)); // finials (C)
      for (const x of [-0.27, 0.27]) for (const z of [-0.2, 0.2]) { g.push(paint(rod([x, 0.07, z], [x, seatY - 0.09, z], 0.022, 0.026, 6), GILT, 0.8, 0.4));
        g.push(paint(lathe([[0.045, 0], [0.05, 0.03], [0.03, 0.07], [0, 0.075]], 6).translate(x, 0, z), GILT, 0.8, 0.45)); } // lion's-paw feet as turned bases (C)
      g.push(paint(box(0.56, 0.085, 0.36, 0, 0.02, 0.37), GILT, 0.8, 0.4)); // the footstool, on four low feet
      for (const x of [-0.25, 0.25]) for (const z of [0.21, 0.53]) g.push(paint(box(0.05, 0.02, 0.05, x, 0, z), GILT, 0.8, 0.45));
      return merge(g); }
    case 'wash_stone': return merge([P(box(0.55, 0.14, 0.42, 0, -0.02, 0), STONE, 0.6), P(mound(0.18, 0.08, 7, 0.45, -0.1), [0.55, 0.5, 0.42], 1)]);
    case 'drying_rack': { const g: THREE.BufferGeometry[] = []; for (const x of [-0.95, 0.95]) g.push(P(rod([x, 0, 0], [x, 1.6, 0], 0.03, 0.025, 5), WOOD_D));
      g.push(P(rod([-1.05, 1.58, 0], [1.05, 1.58, 0], 0.022, 0.022, 5), WOOD));
      g.push(P(box(0.7, 0.8, 0.012, -0.45, 0.78, 0.03), [0.66, 0.6, 0.5], 1), P(box(0.7, 0.8, 0.012, -0.45, 0.78, -0.03), [0.66, 0.6, 0.5], 1), P(box(0.6, 0.6, 0.012, 0.45, 0.98, 0.03), [0.5, 0.2, 0.15], 1), P(box(0.6, 0.6, 0.012, 0.45, 0.98, -0.03), [0.5, 0.2, 0.15], 1));
      return merge(g); }
    case 'target': return merge([P(rod([0, 0, 0.12], [0, 1.1, 0.12], 0.05, 0.05, 6), WOOD_D), P(new THREE.CylinderGeometry(0.42, 0.42, 0.25, 12).rotateX(Math.PI / 2).translate(0, 1.2, 0), STRAW, 1),
      P(new THREE.CircleGeometry(0.36, 12).rotateY(Math.PI).translate(0, 1.2, -0.126), [0.62, 0.48, 0.32], 0.9), P(new THREE.CircleGeometry(0.08, 8).rotateY(Math.PI).translate(0, 1.2, -0.128), [0.2, 0.14, 0.1], 0.9)]);
    case 'hearth_pot': { const g = [P(new THREE.CylinderGeometry(0.3, 0.32, 0.03, 9).translate(0, 0.015, 0), [0.24, 0.22, 0.2], 1)];
      for (let i = 0; i < 3; i++) { const a = i * 2.1 + 0.3; g.push(P(box(0.14, 0.14, 0.12, Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17).rotateY(a), STONE, 0.8)); }
      g.push(P(lathe([[0.06, 0], [0.15, 0.06], [0.17, 0.14], [0.12, 0.22], [0.12, 0.25]], 10).translate(0, 0.13, 0), [0.3, 0.22, 0.17], 0.8));
      g.push(P(box(0.14, 0.03, 0.08, 0, 0.03, 0), [0.4, 0.12, 0.05], 0.7));
      for (let i = 0; i < 3; i++) g.push(P(rod([-0.3 + 0.05 * i, 0.03, -0.05 + 0.05 * i], [0.05 * i, 0.06, 0.02 * i], 0.015, 0.012, 3), [0.3, 0.22, 0.15]));
      return merge(g); }
    // D-210: the vehicles, origin on the ground under the axle (the cart's and chariot's; the wagon's middle), the pole
    // forward (+Z) to the yoke at the draught animals' necks (cart: animals.ts 'draught', CART_AT; C)
    case 'cart': { const g: THREE.BufferGeometry[] = [], R = 0.46, bedY = 0.62;
      for (const x of [-0.82, 0.82]) { g.push(P(new THREE.CylinderGeometry(R, R, 0.09, 14).rotateZ(Math.PI / 2).translate(x, R, 0), WOOD_D));
        g.push(P(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 8).rotateZ(Math.PI / 2).translate(x, R, 0), WOOD)); }
      g.push(P(rod([-0.9, R, 0], [0.9, R, 0], 0.045, 0.045, 6), WOOD));
      g.push(P(box(1.44, 0.07, 2.1, 0, bedY - 0.07, -0.05), WOOD)); for (const x of [-0.7, 0.7]) g.push(P(box(0.05, 0.28, 2.1, x, bedY, -0.05), WOOD_D));
      g.push(P(box(1.44, 0.28, 0.05, 0, bedY, -1.08), WOOD_D));
      g.push(P(rod([0, bedY - 0.04, 0.95], [0, 1.1, 3.45], 0.05, 0.04, 6), WOOD)); g.push(P(rod([-0.78, 1.14, 3.48], [0.78, 1.14, 3.48], 0.045, 0.045, 6), WOOD));
      for (const x of [-0.55, 0.55]) for (const d of [-0.2, 0.2]) g.push(P(rod([x + d, 1.14, 3.48], [x + d * 0.9, 0.88, 3.45], 0.012, 0.012, 3), WOOD_D));
      for (let i = 0; i < 5; i++) { const x = (i % 2 ? 0.3 : -0.3) + 0.03 * jit(i), z = -0.75 + i * 0.36;
        g.push(P(new THREE.CapsuleGeometry(0.2, 0.42, 2, 7).rotateZ(Math.PI / 2).scale(1, 0.75, 1).translate(x, bedY + 0.16, z), [0.64, 0.58, 0.46], 1)); }
      return merge(g); }
    case 'chariot': { const g: THREE.BufferGeometry[] = [], R = 0.5, GILT: RGB = [0.62, 0.48, 0.28];
      for (const x of [-0.7, 0.7]) { g.push(P(new THREE.TorusGeometry(R - 0.03, 0.035, 5, 18).rotateY(Math.PI / 2).translate(x, R, 0), WOOD_D));
        g.push(P(new THREE.CylinderGeometry(0.07, 0.07, 0.28, 8).rotateZ(Math.PI / 2).translate(x, R, 0), GILT, 0.6, 0.3));
        for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.push(P(rod([x, R, 0], [x, R + (R - 0.05) * Math.sin(a), (R - 0.05) * Math.cos(a)], 0.014, 0.014, 3), WOOD)); } }
      g.push(P(rod([-0.8, R, 0], [0.8, R, 0], 0.04, 0.04, 6), WOOD));
      g.push(P(box(1.0, 0.05, 0.8, 0, R + 0.02, -0.05), WOOD)); g.push(P(box(1.0, 0.72, 0.04, 0, R + 0.07, 0.34), [0.5, 0.2, 0.12], 0.8));
      for (const x of [-0.5, 0.5]) g.push(P(box(0.04, 0.6, 0.72, x, R + 0.07, -0.05), [0.5, 0.2, 0.12], 0.8));
      g.push(P(rod([0, R + 0.05, 0.36], [0, 1.02, 1.6], 0.04, 0.035, 6), WOOD)); g.push(P(rod([0, 1.02, 1.6], [0, 1.22, 2.9], 0.035, 0.03, 6), WOOD));
      g.push(P(rod([-0.62, 1.24, 2.9], [0.62, 1.24, 2.9], 0.04, 0.04, 6), WOOD));
      return merge(g); }
    case 'wagon': { const g: THREE.BufferGeometry[] = [], R = 0.42;
      for (const z of [-0.95, 0.95]) for (const x of [-0.82, 0.82]) g.push(P(new THREE.CylinderGeometry(R, R, 0.09, 12).rotateZ(Math.PI / 2).translate(x, R, z), WOOD_D));
      for (const z of [-0.95, 0.95]) g.push(P(rod([-0.88, R, z], [0.88, R, z], 0.04, 0.04, 5), WOOD));
      g.push(P(box(1.5, 0.45, 2.7, 0, 0.62, 0), [0.4, 0.2, 0.12], 0.8));
      g.push(P(new THREE.CylinderGeometry(0.75, 0.75, 2.6, 10, 1, true, -Math.PI / 2, Math.PI).rotateX(Math.PI / 2).rotateZ(0).translate(0, 1.07, 0), [0.66, 0.55, 0.36], 1));
      g.push(P(rod([0, 0.7, 1.4], [0, 1.08, 3.9], 0.045, 0.04, 6), WOOD)); g.push(P(rod([-0.7, 1.12, 3.92], [0.7, 1.12, 3.92], 0.04, 0.04, 6), WOOD));
      return merge(g); }
    case 'hurdles': { const g: THREE.BufferGeometry[] = [], R = 9, n = 26, WAT: RGB = [0.52, 0.42, 0.28];
      for (let i = 0; i < n; i++) { if (i === 0) continue; const a = (i / n) * Math.PI * 2, x = R * Math.cos(a), z = R * Math.sin(a), w = 2 * Math.PI * R / n + 0.05;
        g.push(P(box(w, 0.9, 0.06, 0, 0, 0).rotateY(-a + Math.PI / 2).translate(x, 0, z), WAT, 1));
        g.push(P(rod([x, 0, z], [x, 1.0, z], 0.03, 0.025, 4), WOOD_D)); }
      g.push(P(box(3.2, 1.6, 2.2, 0, 0, -R + 2.2), MUD, 1)); g.push(P(box(3.5, 0.12, 2.5, 0, 1.6, -R + 2.2), [0.55, 0.47, 0.34], 1));
      g.push(P(box(0.6, 0.7, 0.05, 0, 0, -R + 3.32), [0.2, 0.16, 0.12], 1)); // the coop's low door
      for (let i = 0; i < 3; i++) g.push(P(lathe([[0, 0], [0.22, 0.02], [0.2, 0.1], [0, 0.1]], 7).translate(-2 + i * 2, 0, 2.5 - i), POT)); // water and grain dishes
      return merge(g); }
    case 'ard': { // in the ploughman's frame: the stilt rises to his left hand (≈ 0.12, 0.92, 0.5), the share runs in the soil at z ≈ 1.2, the beam goes to the yoke
      // on the oxen's necks in front of the withers (the team walks at z 3.35: animals.ts 'team'; yoke at z 4.05)
      const g = [P(rod([0.12, 0.92, 0.52], [0.06, 0.08, 1.02], 0.025, 0.03, 5), WOOD), P(rod([0.12, 0.92, 0.52], [0.24, 0.98, 0.48], 0.02, 0.02, 4), WOOD_D),
        P(rod([0.06, 0.06, 0.95], [0.02, -0.04, 1.42], 0.04, 0.025, 5), WOOD_D), P(new THREE.ConeGeometry(0.03, 0.12, 4).rotateX(Math.PI / 2 + 0.2).translate(0.02, -0.06, 1.47), [0.3, 0.29, 0.28], 0.5, 0.6),
        P(rod([0.05, 0.12, 1.05], [0, 1.08, 4.02], 0.035, 0.03, 5), WOOD), P(rod([-0.72, 1.12, 4.05], [0.72, 1.12, 4.05], 0.04, 0.04, 6), WOOD)];
      for (const x of [-0.55, 0.55]) for (const s of [-0.2, 0.2]) g.push(P(rod([x + s, 1.12, 4.05], [x + s * 0.9, 0.86, 4.02], 0.012, 0.012, 3), WOOD_D));
      return merge(g); }
  }
}

/** the work objects: one instanced mesh per kind, filled every frame by the crowd (begin / push / end) */
export class WorkObjects {
  readonly group = new THREE.Group();
  private meshes = new Map<WorkKind, { mesh: THREE.InstancedMesh; n: number; radius: number; box: THREE.Box3 }>();
  /** objects not drawn this frame because their kind's instance cap was full (reported by stats: never silent) */
  dropped = 0;
  constructor(private material: THREE.Material, private cap = 256) { this.group.name = 'work:objects-dynamic'; }
  private mesh(kind: WorkKind) {
    let m = this.meshes.get(kind); if (m) return m;
    const g = workGeometry(kind); g.computeBoundingSphere();
    const mesh = new THREE.InstancedMesh(g, this.material, this.cap); mesh.count = 0; mesh.visible = false; mesh.castShadow = mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.name = `work:${kind}`; mesh.userData = { tier: WORK_NOTES[kind].tier, src: 'RECON', note: WORK_NOTES[kind].note }; mesh.raycast = () => {};
    mesh.frustumCulled = true; mesh.boundingSphere = new THREE.Sphere(); nearCascadesOnly(mesh);
    this.group.add(mesh); m = { mesh, n: 0, radius: g.boundingSphere!.radius, box: new THREE.Box3() }; this.meshes.set(kind, m); return m;
  }
  begin() { this.dropped = 0; for (const m of this.meshes.values()) { m.n = 0; m.box.makeEmpty(); } }
  push(kind: WorkKind, M: THREE.Matrix4) {
    const m = this.mesh(kind); if (m.n >= this.cap) { this.dropped++; return; }
    m.mesh.setMatrixAt(m.n++, M); m.box.expandByPoint(_p.setFromMatrixPosition(M));
  }
  end() {
    for (const m of this.meshes.values()) { const im = m.mesh; im.count = m.n; im.visible = m.n > 0; if (!m.n) continue;
      im.instanceMatrix.needsUpdate = true; im.instanceMatrix.clearUpdateRanges(); im.instanceMatrix.addUpdateRange(0, m.n * 16);
      m.box.getBoundingSphere(im.boundingSphere!); im.boundingSphere!.radius += m.radius; }
  }
  /** kinds drawn, instances and triangles (main pass) */
  stats() { let draws = 0, instances = 0, triangles = 0; const kinds: Record<string, number> = {};
    for (const [k, m] of this.meshes) if (m.n) { draws++; instances += m.n; const g = m.mesh.geometry; triangles += m.n * (g.index ? g.index.count : g.getAttribute('position').count) / 3; kinds[k] = m.n; }
    return { draws, instances, triangles, kinds, dropped: this.dropped }; }
}
const _p = new THREE.Vector3();
void attribute;
