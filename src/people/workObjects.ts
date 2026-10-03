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
import { paintGeometry as paint, rodGeometry as rod, propGeometry, paintAs } from './props';
import { nearCascadesOnly } from './humanGPU';
import { scanShape, modelShape, modelParts, modelFit, mergedModel, model } from '../render/scanProps';

export type WorkKind = 'drum_sledge' | 'brick_stack' | 'mud_heap' | 'brick_field' | 'jar' | 'mortar_tub' | 'brick_course' | 'beam' | 'loom' | 'dung_cakes' | 'vat' | 'fodder'
  | 'fleece' | 'butchery' | 'hides' | 'basket_meat' | 'threshing_floor' | 'stooks' | 'sheaves' | 'sheaf' | 'grain_heap' | 'spoil' | 'basket_fruit' | 'press' | 'brushwood'
  | 'pigment_slab' | 'bier' | 'wash_stone' | 'drying_rack' | 'target' | 'hearth_pot' | 'ard' | 'throne'
  // D-210: the vehicles (gap audit items 16, 17) and the state poultry yard (item 11)
  | 'cart' | 'chariot' | 'wagon' | 'hurdles'
  // session 9 (G77): an ox cart with roof beams; s17 V3 (C3's ask): an ox cart with a rough-cut block from the quarry
  | 'cart_timber' | 'cart_stone'
  // D-215: children's play (gap audit item 26)
  | 'knucklebones' | 'toy_wheeled'
  // D-209: the lan set out before the fire, and the boiled meat of a sacrifice laid on soft grass
  | 'offering_set' | 'grass_bed'
  // D-255: the crafts and the records
  | 'anvil' | 'bellows_stand' | 'bellows' | 'stake' | 'weigh_table' | 'sealed_jars' | 'seal_bench' | 'tan_beam' | 'tan_vat' | 'hide_frames' | 'oil_press' | 'oil_jars'
  // D-256: the work on the land (the fold against the wolves, the drums from the quarry, milking, fishing, snaring, bees, nuts)
  | 'fold' | 'drum_haul' | 'sledge' | 'drum_rough' | 'milk_pot' | 'basket_fish' | 'fish_trap' | 'snare' | 'hives' | 'basket_nuts'
  // D-292: the body's care (the basin the face is washed over, the barber's jar)
  | 'basin';
type RGB = [number, number, number];
const MUD: RGB = [0.5, 0.41, 0.31], MUD_WET: RGB = [0.36, 0.29, 0.22], BRICK: RGB = [0.62, 0.53, 0.4], STRAW: RGB = [0.72, 0.62, 0.38], STRAW_D: RGB = [0.62, 0.52, 0.3],
  WOOD: RGB = [0.45, 0.33, 0.21], WOOD_D: RGB = [0.34, 0.25, 0.16], STONE: RGB = [0.55, 0.54, 0.52], LIME: RGB = [0.66, 0.64, 0.6], POT: RGB = [0.62, 0.44, 0.3], WOOL: RGB = [0.8, 0.76, 0.66],
  HIDE: RGB = [0.5, 0.36, 0.23], IRON: RGB = [0.3, 0.29, 0.28], MEAT: RGB = [0.42, 0.2, 0.16], FAT: RGB = [0.78, 0.72, 0.6], EARTH: RGB = [0.46, 0.39, 0.3], LINEN: RGB = [0.8, 0.77, 0.7];
const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0) => new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z);
const mound = (r: number, h: number, seg = 9, x = 0, z = 0) => new THREE.LatheGeometry([[r * 1.02, 0], [r, 0.02], [r * 0.8, h * 0.45], [r * 0.45, h * 0.86], [0, h]].map(([a, b]) => new THREE.Vector2(a, b)), seg).translate(x, 0, z);
const lathe = (pts: number[][], seg: number) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), seg);
const P = (g: THREE.BufferGeometry, c: RGB, rough = 0.9, metal = 0) => paint(g, c, metal, rough); // (paint multiplies a model's baked occlusion in: D-325)
const merge = (gs: THREE.BufferGeometry[]) => mergeGeometries(gs)!;
// session 12 (D-310): jars and baskets from CC0 scans' shapes (Poly Haven; render/scanProps.ts) fitted to the old forms' boxes
// (radius r, height h, base on y = 0), when loaded; else the procedural form
// (D-325: the jars are the period's modelled forms with their baked occlusion, at lod1; the baskets the scans' lod1)
const SJ = (seed: number, r: number, h: number, alt: () => THREE.BufferGeometry) => modelShape('jar', seed, [2 * r, h, 2 * r], 1) ?? scanShape('jar', seed, [2 * r, h, 2 * r], 1) ?? alt();
const SB = (seed: number, r: number, h: number, alt: () => THREE.BufferGeometry) => scanShape('basket', seed, [2 * r, h, 2 * r], 1) ?? alt();
/** a small deterministic jitter */
/** s17 V3: a rough-cut limestone block on a cart bed at bedY (quarry-faced: its faces bulged and pitched, the point marks C),
 *  on two chock timbers */
function stoneLoad(bedY: number): THREE.BufferGeometry[] {
  const b = new THREE.BoxGeometry(1.2, 0.62, 0.9, 6, 4, 5), p = b.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 0.045 * Math.sin(x * 9.1 + z * 5.3) * Math.cos(y * 11.7 + x * 3.1) + 0.02 * Math.sin(z * 23 + y * 17) + 0.01 * Math.sin(x * 41 + y * 29 + z * 37);
    const l = Math.hypot(x / 0.6, y / 0.31, z / 0.45) || 1; p.setXYZ(i, x * (1 + k / l), y * (1 + k / l), z * (1 + k / l)); }
  b.computeVertexNormals(); const g = b; // (the box's faces keep their own vertices: a sharp arris, as a quarried block has)
  return [P(g.rotateY(Math.PI / 2 + 0.05).translate(0.02, bedY + 0.1 + 0.31, -0.1), [0.6, 0.56, 0.49], 1), P(box(1.3, 0.1, 0.12, 0, bedY, 0.35), WOOD_D), P(box(1.3, 0.1, 0.12, 0, bedY, -0.6), WOOD_D)];
}
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
  cart_stone: { tier: 'C', note: 'an ox cart carrying one rough-cut limestone block from the quarry (about 1.2 × 0.6 × 0.9 m, ~1.7 t: a heavy load for one yoke at a slow walk), chocked with timbers, for the door and window frames (s17 V3, C3’s ask; the stone from Majdabad: construction.ts E-61, B; carts and loads C)' },
  cart_timber: { tier: 'C', note: 'an ox cart carrying five roof beams of ~6 m, lashed on and overhanging behind (session 9: roof timber for the building works, the Susa charter\'s timbers from far: A for Susa, B analogy; load C)' },
  chariot: { tier: 'B', note: 'a two-wheeled chariot with spoked wheels, a box for the driver and a pole to the yoke of two horses (chariots on the Apadana reliefs and the royal chariot of HDT 7.40-41: B; form, size and the eight spokes C); court setting only' },
  wagon: { tier: 'C', note: 'a covered four-wheeled wagon (harmamaxa) for the royal women on the road (HDT 7.83, a claim; RECOLLECTION, NOT SEEN): a box on solid wheels under an arched cloth cover, a pole to the yoke (form and size C); court setting only' },
  hurdles: { tier: 'C', note: 'the state poultry yard: a ring of wattle hurdles and a low mud-brick coop (poultry and their fodder: PF 2034, IR-PET, B; where and how kept C)' },
  knucklebones: { tier: 'B', note: 'five knucklebones (astragali of sheep or goats) in the dust, thrown and gathered by children: astragali are common finds of the period (B object; the children’s game C)' },
  toy_wheeled: { tier: 'C', note: 'a fired-clay animal on four clay wheels on axles, pulled by a cord (wheeled clay animals from Susa and Mesopotamia, RECOLLECTION, NOT SEEN: C; the form, a humped bull, C). The wheels do not turn' },
  offering_set: { tier: 'C', note: 'the lan set out before the fire: barley heaped on a cloth and wine in a clay bowl beside it (barley and wine issued for the lan: PF 1955, HENK2008, B; set out, not poured: Herodotus 1.132 "no libations", read, a Greek claim; the setting-out C: D-209)' },
  grass_bed: { tier: 'B', note: 'the boiled meat of a sacrifice laid on soft grass, trefoil (Herodotus 1.132, read, a Greek claim: B; the grass and the pieces C: D-209)' },
  // D-255
  anvil: { tier: 'C', note: 'the smith’s anvil: an iron block on a wooden stump, its face 0.62 m up, a few scales of iron and a spare bar at its foot (iron-working: B; the form C). The forge and its fire are the workshop’s own fitting beside it' },
  bellows_stand: { tier: 'C', note: 'a goatskin bag bellows on a low stand with a clay nozzle into the forge, worked by hand (bag bellows: Egyptian tomb paintings, B by analogy; RECOLLECTION, NOT SEEN; the stand C)' },
  bellows: { tier: 'C', note: 'a pair of goatskin bag bellows on the ground with clay nozzles into the forge, pressed in turn by a helper (B by analogy; C)' },
  stake: { tier: 'C', note: 'a goldsmith’s stake set in a wooden block, a silver bowl on it being chased, and a tray of finished phialai beside (the gold and silver vessels of the Treasury and the shiners who kept them: LIVIUS-TREAS, B; the stake and the work C)' },
  weigh_table: { tier: 'B', note: 'a low table with the stone weights in a row, the silver in a bowl and a clay tablet for the record (inscribed stone weights of Darius from the Treasury: RECOLLECTION, NOT SEEN, B; silver paid by weight in lieu of rations, PT: B; the table and its things C)' },
  sealed_jars: { tier: 'B', note: 'two store jars, their mouths closed with a stopper, a cord and a lump of clay rolled with a seal, and a sack tied and sealed the same way (sealings of jars and sacks, the Treasury’s and the Fortification’s: A as objects; RECOLLECTION of Schmidt’s finds, NOT SEEN; the jars C)' },
  seal_bench: { tier: 'C', note: 'the seal cutter’s low block: the bow drill’s shaft upright on a stone blank, a bowl of wet abrasive sand, two finished cylinder seals (seals in their thousands on the tablets, PFS: A; their cutting at Persepolis C)' },
  tan_beam: { tier: 'C', note: 'a tanner’s beam: a log sloping from the tanner’s thighs to the ground on two legs, a hide over it, the scrapings of flesh and hair in a heap at its foot and the ground dark round it (hides of the slaughter to the Treasury: PF 58-60, A; tanning C)' },
  tan_vat: { tier: 'C', note: 'a tanning vat sunk in the ground with a mud-brick rim, the hides soaking in dark liquor (lime or oak-gall tanning; which is not known: C)' },
  hide_frames: { tier: 'C', note: 'the tannery’s ground: three wooden frames with hides laced in them drying, a heap of lime, the ground stained dark (C)' },
  oil_press: { tier: 'C', note: 'a stone mortar for pounding roasted sesame, a sack of seed and a basket of the crushed paste beside it (sesame moved and issued in the Fortification texts: PF 56, A; the pounding and the hot-water method of getting the oil C)' },
  oil_jars: { tier: 'C', note: 'a row of oil jars stoppered and waiting to go to the stores and the lamp keepers, and a clay lamp (C)' },
  fold: { tier: 'C', note: 'a fold for the night: a ring of cut thorn brush about 12 m across, heaped chest-high, a gap for the gate closed with a bundle (folds against the wolves: the pastoral practice of the Zagros, RECOLLECTION NOT SEEN; C: D-256)' },
  drum_haul: { tier: 'C', note: 'a rough-cut column drum lying on a heavy wooden sledge, roped down, the traces running forward to the yokes (drums from the quarry: construction.ts E-61; the stone from Majdabad by petrography: B; sledge and haul C: D-256)' },
  sledge: { tier: 'C', note: 'the drum sledge going back empty to the quarry: two heavy runners and cross-pieces, the traces forward to the yokes (C: D-256)' },
  drum_rough: { tier: 'C', note: 'a column drum roughed out at the quarry, over-size, the point marks on it, chips about its foot (C: D-256)' },
  milk_pot: { tier: 'C', note: 'a round-bellied clay pot for the milk (C: D-256)' },
  basin: { tier: 'C', note: 'a wide shallow clay basin with a little water in it, the water jar beside: the face and hands washed over it, the water poured from a small jug (plain wide bowls and basins are ordinary finds: B; the use C: D-292)' },
  basket_fish: { tier: 'C', note: 'a basket with the catch, barbel and carp of the river (C: D-256)' },
  fish_trap: { tier: 'C', note: 'a conical wicker fish trap at the water\'s edge, weighted with a stone (C: D-256)' },
  snare: { tier: 'C', note: 'a pegged snare line: a cord between two pegs with horsehair nooses along it (C: D-256)' },
  hives: { tier: 'C', note: 'clay-pipe hives, a dozen long cylinders laid in rows in a low mud wall, their ends stopped with mud and a flight hole in each (the pipe hive of Iran and the Near East, RECOLLECTION NOT SEEN; C: D-256)' },
  basket_nuts: { tier: 'C', note: 'a basket of wild pistachios and almonds in their husks (C: D-256)' },
  throne: { tier: 'B', note: 'the king’s throne and footstool at an audience (court setting, D-199): a high-backed chair on turned legs with lion’s-paw feet, and a footstool, as the Treasury audience relief carves them (TREAS-AUD, B); gilded wood and the sizes C: the seat 0.525 m and the footstool 0.105 m high, fitted to the enthroned pose measured on the rig (anim ENTHRONED); where it stood in the Apadana is not known (C)' },
};

// ------------------------------------------------------------------------------------------------ D-325: the modelled work objects
// Every kind below is the project's model (tools/blender/model_props.py `wo_<kind>`), in the performer's frame at the
// procedural form's sizes and places (the procedural forms stay as the stand-ins when the models are not loaded): bricks with
// worn arrises, straw in the mud, logs and poles with their bark, stones as field stones, heaps in lumps, sheaves fluted and
// bound, hides with their outlines, tripartite disc wheels with battens and hubs, spoked chariot wheels, wattle woven on
// stakes, cloths hung over the drying pole, goatskin bellows with their legs tied off, duck-shaped weights, fish, grapes
// and nuts in the baskets. Its parts are named for what they are and painted here, the baked occlusion multiplied in. The
// jars and baskets are the vessel models and the scans (SJ, SB), the pots, the sacks and the lamp the vessel models.
const WORK_PAINT: Record<string, [RGB, number, number]> = { // colour (sRGB), roughness, metalness
  mud: [MUD, 0.95, 0], mud_wet: [MUD_WET, 0.7, 0], mud_roof: [[0.55, 0.47, 0.34], 1, 0], brick: [BRICK, 0.95, 0], straw: [STRAW, 1, 0], straw_d: [STRAW_D, 1, 0], ears: [EARS, 1, 0],
  wood: [WOOD, 0.9, 0], wood_d: [WOOD_D, 0.9, 0], beam: [[0.5, 0.38, 0.26], 0.9, 0], stone: [STONE, 0.8, 0], stone_d: [[0.5, 0.49, 0.47], 0.7, 0], lime: [LIME, 0.85, 0], pot: [POT, 0.85, 0],
  wool: [WOOL, 1, 0], wool_d: [[0.7, 0.66, 0.56], 1, 0], hide: [HIDE, 0.8, 0], hide_d: [[0.42, 0.3, 0.2], 0.85, 0], hide_w: [[0.62, 0.52, 0.4], 0.7, 0], iron: [IRON, 0.5, 0.7], scale: [[0.18, 0.16, 0.15], 0.3, 0.8],
  meat: [MEAT, 0.6, 0], fat: [FAT, 0.6, 0], meat_boiled: [[0.74, 0.62, 0.52], 0.7, 0], earth: [EARTH, 0.95, 0], linen: [LINEN, 1, 0], cord: [[0.62, 0.54, 0.38], 0.95, 0], red: [[0.55, 0.16, 0.12], 0.95, 0],
  blue: [[0.2, 0.24, 0.42], 0.95, 0], warp: [[0.84, 0.8, 0.7], 0.95, 0], ash: [[0.24, 0.22, 0.2], 1, 0], ember: [[0.4, 0.12, 0.05], 0.7, 0], grape: [[0.26, 0.12, 0.2], 0.5, 0], nut: [[0.62, 0.55, 0.36], 0.8, 0],
  fish: [[0.5, 0.5, 0.44], 0.35, 0.2], thorn: [[0.36, 0.3, 0.22], 1, 0], thorn_d: [[0.42, 0.35, 0.25], 1, 0], grass: [[0.3, 0.44, 0.2], 1, 0], bone: [[0.82, 0.76, 0.64], 0.7, 0], silver: [[0.8, 0.79, 0.76], 0.3, 1],
  skin: [[0.46, 0.34, 0.24], 0.85, 0], liquor: [[0.2, 0.15, 0.1], 0.15, 0], stain: [[0.3, 0.24, 0.18], 1, 0], scrap: [[0.55, 0.42, 0.34], 0.8, 0], milk: [[0.92, 0.9, 0.84], 0.6, 0], water: [[0.32, 0.36, 0.36], 0.08, 0],
  clay_toy: [[0.66, 0.47, 0.33], 0.9, 0], lapis: [[0.28, 0.33, 0.52], 0.4, 0], dung: [[0.3, 0.25, 0.18], 0.9, 0], chips: [[0.62, 0.5, 0.34], 0.9, 0], grain: [[0.62, 0.5, 0.3], 1, 0], chaff: [[0.74, 0.66, 0.46], 1, 0],
  wicker: [[0.6, 0.52, 0.32], 0.9, 0], sand: [[0.52, 0.46, 0.36], 0.4, 0], diorite: [[0.16, 0.17, 0.16], 0.4, 0], tablet: [[0.56, 0.48, 0.37], 0.9, 0], gilt: [[0.62, 0.48, 0.28], 0.6, 0.3],
  leather: [[0.5, 0.2, 0.12], 0.8, 0], cloth: [[0.66, 0.55, 0.36], 1, 0], wine: [[0.28, 0.07, 0.09], 0.3, 0], wattle: [[0.52, 0.42, 0.28], 1, 0], dark: [[0.2, 0.14, 0.1], 0.9, 0], paste: [[0.66, 0.54, 0.36], 1, 0],
  pig_blue: [[0.12, 0.28, 0.62], 0.95, 0], pig_green: [[0.22, 0.48, 0.34], 0.95, 0], pig_red: [[0.55, 0.2, 0.13], 0.95, 0], pig_ochre: [[0.76, 0.58, 0.26], 0.95, 0],
};
const WORK_OVERRIDE: Partial<Record<WorkKind, Record<string, [RGB, number, number]>>> = {
  drum_rough: { chips: [[0.7, 0.68, 0.63], 1, 0] }, tan_beam: { stain: [[0.26, 0.2, 0.15], 1, 0] }, hurdles: { wood_d: [[0.2, 0.16, 0.12], 1, 0] }, wagon: { red: [[0.4, 0.2, 0.12], 0.8, 0] },
};
/** the kinds drawn from their own models (wo_<kind>) */
export const MODELLED_WORK: WorkKind[] = ['drum_sledge', 'brick_stack', 'mud_heap', 'brick_field', 'mortar_tub', 'brick_course', 'beam', 'loom', 'dung_cakes', 'fodder', 'fleece', 'butchery', 'hides',
  'threshing_floor', 'stooks', 'sheaves', 'sheaf', 'grain_heap', 'spoil', 'press', 'brushwood', 'pigment_slab', 'bier', 'wash_stone', 'drying_rack', 'target', 'ard', 'chariot', 'wagon', 'hurdles',
  'knucklebones', 'toy_wheeled', 'offering_set', 'grass_bed', 'anvil', 'bellows_stand', 'bellows', 'stake', 'weigh_table', 'seal_bench', 'tan_beam', 'tan_vat', 'hide_frames', 'fold', 'drum_haul',
  'sledge', 'drum_rough', 'fish_trap', 'snare', 'hives', 'cart_timber'];
/** a work model's parts painted (null when not loaded) */
function woParts(id: string, kind: WorkKind | '', M?: THREE.Matrix4): THREE.BufferGeometry[] | null {
  const p = modelParts(id, 0, M); if (!p) return null;
  return Object.entries(p).map(([k, g]) => { const t = (kind && WORK_OVERRIDE[kind]?.[k]) || WORK_PAINT[k] || [WOOD, 0.9, 0]; return paintAs(k, g, t[0], t[2], t[1]); });
}
/** a vessel model fitted to a box and placed (x, y, z), painted */
function vesselAt(id: string, size: [number, number, number], at: [number, number, number], c: RGB, rough = 0.85): THREE.BufferGeometry | null {
  const f = modelFit(id, size, 0, at); if (!f) return null; return P(mergedModel(f), c, rough);
}
/** the composites: a model with the vessels, sacks and baskets the builders draw from their own models and scans */
function composite(kind: WorkKind): THREE.BufferGeometry | null {
  const has = (id: string) => !!model(id);
  switch (kind) {
    case 'vat': { const v = vesselAt('vat', [0.72, 0.75, 0.72], [0, 0, 0], POT); if (!v) return null;
      return merge([v, P(new THREE.CylinderGeometry(0.25, 0.25, 0.02, 16).translate(0, 0.64, 0), [0.42, 0.33, 0.2], 0.4),
        P(SJ(3, 0.2, 0.54, () => lathe([[0.1, 0], [0.2, 0.12], [0.2, 0.34], [0.1, 0.5], [0.08, 0.54]], 9)).translate(0.75, 0, 0.1), POT, 0.85), P(SJ(4, 0.18, 0.47, () => lathe([[0.1, 0], [0.18, 0.1], [0.18, 0.3], [0.1, 0.44], [0.08, 0.47]], 9)).translate(-0.72, 0, -0.1), POT, 0.85)]); }
    case 'basket_meat': case 'basket_fruit': case 'basket_nuts': case 'basket_fish': {
      const id = { basket_meat: 'wo_meat', basket_fruit: 'wo_grapes', basket_nuts: 'wo_nuts', basket_fish: 'wo_fish' }[kind], c = woParts(id, kind); if (!c) return null;
      const r = kind === 'basket_fish' ? 0.22 : 0.2, h = kind === 'basket_meat' ? 0.18 : 0.2;
      return merge([P(SB(kind === 'basket_meat' || kind === 'basket_fish' ? 0 : 1, r, h, () => new THREE.CylinderGeometry(r, r * 0.75, h, 10, 1, true).translate(0, h / 2, 0)), [0.6, 0.52, 0.32]), ...c]); }
    case 'hearth_pot': { const c = woParts('wo_hearth_pot', kind), pot = vesselAt('cookpot', [0.34, 0.25, 0.34], [0, 0.11, 0], [0.3, 0.22, 0.17], 0.8); if (!c || !pot) return null; return merge([...c, pot]); }
    case 'milk_pot': { const pot = vesselAt('milkpot', [0.28, 0.29, 0.28], [0, 0, 0], POT), m = woParts('wo_milk', kind, new THREE.Matrix4().makeTranslation(0, 0.25, 0)); if (!pot || !m) return null; return merge([pot, ...m]); }
    case 'basin': { const b = vesselAt('basin', [0.46, 0.105, 0.46], [0, 0, 0], POT), j = vesselAt('jug', [0.15, 0.17, 0.15], [0.3, 0, 0.05], POT); if (!b || !j) return null;
      return merge([b, P(new THREE.CylinderGeometry(0.185, 0.185, 0.003, 16).translate(0, 0.055, 0), [0.32, 0.36, 0.36], 0.08), j]); }
    case 'sealed_jars': { if (!has('sack')) return null; const CLAY: RGB = [0.52, 0.42, 0.3], jarG = (x: number, z: number, sc: number) => [P(SJ(Math.round(x * 10), 0.24, 0.66, () => lathe([[0.001, 0], [0.13, 0.03], [0.24, 0.3], [0.2, 0.55], [0.1, 0.62], [0.11, 0.66]], 12)).scale(sc, sc, sc).translate(x, 0, z), POT, 0.85),
        P(new THREE.CylinderGeometry(0.1 * sc, 0.1 * sc, 0.03, 10).translate(x, 0.67 * sc, z), CLAY, 0.9), P(new THREE.SphereGeometry(0.045 * sc, 6, 4).scale(1, 0.5, 1).translate(x + 0.02, 0.69 * sc, z), CLAY, 0.9)];
      return merge([...jarG(0, 0, 0.95), ...jarG(0.62, 0.2, 1.05), vesselAt('sack', [0.44, 0.56, 0.36], [-0.55, 0, 0.15], [0.62, 0.55, 0.42], 1)!, P(new THREE.SphereGeometry(0.03, 5, 3).translate(-0.55, 0.56, 0.1), CLAY, 0.9)]); }
    case 'oil_press': { const c = woParts('wo_oil_press', kind), sk = vesselAt('sack', [0.4, 0.52, 0.34], [0.55, 0, -0.1], [0.62, 0.55, 0.42], 1); if (!c || !sk) return null;
      return merge([...c, sk, P(SB(2, 0.18, 0.16, () => new THREE.CylinderGeometry(0.18, 0.14, 0.16, 10, 1, true).translate(0, 0.08, 0)).translate(-0.5, 0, -0.05), [0.6, 0.52, 0.32]), P(mound(0.16, 0.08, 7, -0.5, -0.05).translate(0, 0.08, 0), [0.6, 0.48, 0.3], 0.9)]); }
    case 'oil_jars': { const lamp = vesselAt('lamp', [0.17, 0.032, 0.14], [-0.3, 0, 0.1], POT, 0.8); if (!lamp) return null; const g: THREE.BufferGeometry[] = [];
      for (let i = 0; i < 4; i++) g.push(P(SJ(i, 0.14, 0.43, () => lathe([[0.001, 0], [0.09, 0.02], [0.14, 0.18], [0.1, 0.34], [0.05, 0.4], [0.055, 0.43]], 10)).translate(i * 0.32, 0, 0.03 * jit(i)), POT, 0.8), P(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8).translate(i * 0.32, 0.43, 0.03 * jit(i)), [0.52, 0.42, 0.3], 0.9));
      return merge([...g, lamp]); }
    case 'cart_stone': { const c = woParts('wo_cart', kind); if (!c) return null; c.push(...stoneLoad(0.62)); return merge(c); }
    case 'cart': { const c = woParts('wo_cart', kind); if (!c || !has('sack_lying')) return null; const bedY = 0.62;
      for (let i = 0; i < 5; i++) { const x = (i % 2 ? 0.3 : -0.3) + 0.03 * jit(i), z = -0.75 + i * 0.36;
        c.push(P(mergedModel(modelFit('sack_lying', [0.62, 0.3, 0.4], 1)!).rotateY(Math.PI / 2 + 0.2 * jit(i, 3)).translate(x, bedY, z), [0.64, 0.58, 0.46], 1)); }
      return merge(c); }
  }
  return null;
}
/** a kind's modelled geometry, or null (its procedural form is drawn) */
export function workModel(kind: WorkKind): THREE.BufferGeometry | null {
  const c = composite(kind); if (c) return c;
  if (!MODELLED_WORK.includes(kind)) return null;
  const p = woParts('wo_' + kind, kind); return p ? merge(p) : null;
}

export function workGeometry(kind: WorkKind): THREE.BufferGeometry {
  const wm = workModel(kind); if (wm) return wm;
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
    case 'basket_meat': return merge([P(SB(0, 0.2, 0.18, () => new THREE.CylinderGeometry(0.2, 0.15, 0.18, 10, 1, true).translate(0, 0.09, 0)), [0.6, 0.52, 0.32]), P(mound(0.17, 0.08, 7).translate(0, 0.1, 0), MEAT, 0.6)]);
    case 'threshing_floor': return merge([P(new THREE.CylinderGeometry(3.5, 3.55, 0.05, 28).translate(0, 0.025, 0), [0.66, 0.58, 0.4], 1), P(new THREE.CylinderGeometry(2.9, 3.3, 0.1, 22, 1, true).translate(0, 0.08, 0), STRAW, 1),
      P(new THREE.CylinderGeometry(2.9, 2.9, 0.02, 22).translate(0, 0.12, 0), STRAW_D, 1), P(rod([0, 0, 0], [0, 1.5, 0], 0.07, 0.06, 6), WOOD_D)]);
    case 'stooks': { const g: THREE.BufferGeometry[] = []; // three stooks of five sheaves standing ears up, leaning together
      for (let i = 0; i < 3; i++) for (let j = 0; j < 5; j++) g.push(sheafG(0.82 + 0.06 * jit(i * 5 + j, 2)).rotateX(-0.24).translate(0, 0, 0.17).rotateY((2 * Math.PI * j) / 5 + 0.3 * jit(i, 3)).translate(i * 0.9, 0, 0.15 * jit(i)));
      return merge(g); }
    case 'sheaves': { const g: THREE.BufferGeometry[] = []; for (let i = 0; i < 4; i++) g.push(sheafLying(0.82 + 0.08 * jit(i, 5)).rotateY(-Math.PI / 2 + 1.2 + 0.4 * jit(i)).translate(0.35 * i - 0.4, 0, 0.3 * jit(i, 4))); return merge(g); }
    case 'sheaf': return merge([sheafLying(0.9).translate(-0.45, 0, 0), P(rod([-0.07, 0.085, 0], [-0.03, 0.085, 0], 0.06, 0.06, 7), STRAW_D)]); // the band being tied
    case 'grain_heap': return merge([P(new THREE.ConeGeometry(0.65, 0.45, 12).translate(0, 0.225, 0), [0.62, 0.5, 0.3], 1), P(mound(0.9, 0.08, 10, 0.5, 0.3), [0.74, 0.66, 0.46], 1)]);
    case 'spoil': return P(mound(0.55, 0.3, 9), EARTH);
    case 'basket_fruit': return merge([P(SB(1, 0.2, 0.2, () => new THREE.CylinderGeometry(0.2, 0.15, 0.2, 10, 1, true).translate(0, 0.1, 0)), [0.6, 0.52, 0.32]), P(mound(0.18, 0.1, 8).translate(0, 0.12, 0), [0.26, 0.12, 0.2], 0.5)]);
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
      // D-325: the modelled throne and footstool (lion's paws on drums, turned legs, stretchers, finials; the footstool on bull's
      // legs), in this frame at these heights: tools/blender/model_props.py
      const th = modelParts('throne', 0); if (th) return merge([paint(th.gilt, GILT, 0.8, 0.4), paint(th.cushion, [0.45, 0.16, 0.14], 0, 0.95)]);
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
    case 'cart_stone': { const g: THREE.BufferGeometry[] = [], R = 0.46, bedY = 0.62; // the cart as above, its load one rough block
      for (const x of [-0.82, 0.82]) { g.push(P(new THREE.CylinderGeometry(R, R, 0.09, 14).rotateZ(Math.PI / 2).translate(x, R, 0), WOOD_D));
        g.push(P(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 8).rotateZ(Math.PI / 2).translate(x, R, 0), WOOD)); }
      g.push(P(rod([-0.9, R, 0], [0.9, R, 0], 0.045, 0.045, 6), WOOD)); g.push(P(box(1.44, 0.07, 2.1, 0, bedY - 0.07, -0.05), WOOD));
      g.push(P(rod([0, bedY - 0.04, 0.95], [0, 1.1, 3.45], 0.05, 0.04, 6), WOOD)); g.push(P(rod([-0.78, 1.14, 3.48], [0.78, 1.14, 3.48], 0.045, 0.045, 6), WOOD));
      g.push(...stoneLoad(bedY)); return merge(g); }
    case 'cart_timber': { const g: THREE.BufferGeometry[] = [], R = 0.46, bedY = 0.62; // the cart as above, its load five beams
      for (const x of [-0.82, 0.82]) { g.push(P(new THREE.CylinderGeometry(R, R, 0.09, 14).rotateZ(Math.PI / 2).translate(x, R, 0), WOOD_D));
        g.push(P(new THREE.CylinderGeometry(0.1, 0.1, 0.16, 8).rotateZ(Math.PI / 2).translate(x, R, 0), WOOD)); }
      g.push(P(rod([-0.9, R, 0], [0.9, R, 0], 0.045, 0.045, 6), WOOD)); g.push(P(box(1.44, 0.07, 2.1, 0, bedY - 0.07, -0.05), WOOD));
      g.push(P(rod([0, bedY - 0.04, 0.95], [0, 1.1, 3.45], 0.05, 0.04, 6), WOOD)); g.push(P(rod([-0.78, 1.14, 3.48], [0.78, 1.14, 3.48], 0.045, 0.045, 6), WOOD));
      for (let i = 0; i < 5; i++) { const x = -0.5 + i * 0.25 + 0.02 * jit(i), y = bedY + 0.14 + (i % 2) * 0.22, r = 0.12 + 0.02 * jit(i + 7); // (two layers)
        g.push(P(rod([x, y, 0.9], [x, y - 0.05, -5.1], r, r * 0.9, 7), [0.5, 0.38, 0.26])); }
      for (const z of [0.4, -0.8]) g.push(P(box(1.3, 0.03, 0.04, 0, bedY + 0.52, z), WOOD_D)); // the lashings
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
    // D-215: five astragali scattered in front of the player (C)
    case 'offering_set': return merge([P(box(0.56, 0.008, 0.42), LINEN, 1), P(mound(0.15, 0.08, 8, -0.1, 0), [0.76, 0.66, 0.44], 1),
      P(lathe([[0.001, 0], [0.06, 0.004], [0.085, 0.035], [0.09, 0.05], [0.082, 0.05], [0.07, 0.02], [0.001, 0.012]], 10).translate(0.15, 0.008, 0.03), POT, 0.8),
      P(new THREE.CylinderGeometry(0.075, 0.075, 0.004, 10).translate(0.15, 0.045, 0.03), [0.28, 0.07, 0.09], 0.3)]);
    case 'grass_bed': { const g = [P(box(0.95, 0.025, 0.62), [0.3, 0.44, 0.2], 1)]; for (let i = 0; i < 7; i++) g.push(P(mound(0.07 + 0.03 * Math.abs(jit(i)), 0.05, 6, 0.3 * jit(i, 2), 0.2 * jit(i, 3)).translate(0, 0.025, 0), [0.74, 0.62, 0.52], 0.7)); return merge(g); }
    case 'knucklebones': { const g: THREE.BufferGeometry[] = []; const BONE: RGB = [0.82, 0.76, 0.64];
      for (let i = 0; i < 5; i++) { const a = i * 2.4, r = 0.05 + 0.03 * (i % 3); g.push(P(box(0.024, 0.014, 0.017, 0, 0, 0).rotateY(a * 1.7).translate(Math.cos(a) * r, 0, Math.sin(a) * r), BONE, 0.7)); }
      return merge(g); }
    // D-215: a clay humped bull on four wheels, the cord rising from its muzzle toward the child's hand ahead (+Z) (C)
    case 'toy_wheeled': { const CLAY: RGB = [0.66, 0.47, 0.33], g = [P(new THREE.SphereGeometry(1, 7, 4).scale(0.05, 0.035, 0.085).translate(0, 0.07, 0), CLAY),
        P(new THREE.SphereGeometry(0.028, 6, 4).translate(0, 0.095, 0.085), CLAY), P(new THREE.SphereGeometry(0.02, 5, 3).translate(0, 0.108, -0.01), CLAY)];
      for (const z of [-0.05, 0.05]) { g.push(P(rod([-0.06, 0.025, z], [0.06, 0.025, z], 0.004, 0.004, 3), WOOD_D)); for (const x of [-0.055, 0.055]) g.push(P(new THREE.CylinderGeometry(0.025, 0.025, 0.012, 7).rotateZ(Math.PI / 2).translate(x, 0.025, z), CLAY)); }
      g.push(P(rod([0, 0.09, 0.11], [0, 0.45, 0.7], 0.0025, 0.0025, 3), [0.72, 0.64, 0.46]));
      return merge(g); }
    // ------------------------------------------------ D-255: the crafts and the records (performer's frame)
    case 'anvil': { const g = [P(new THREE.CylinderGeometry(0.19, 0.21, 0.5, 9).translate(0, 0.25, 0), WOOD_D, 0.9), P(box(0.16, 0.12, 0.26, 0, 0.5, 0), [0.24, 0.23, 0.22], 0.5, 0.7),
        P(new THREE.ConeGeometry(0.035, 0.09, 5).rotateZ(Math.PI / 2).translate(0, 0.59, 0.17).rotateY(Math.PI / 2), [0.24, 0.23, 0.22], 0.5, 0.7)];
      g.push(P(box(0.03, 0.03, 0.5, 0.3, 0, -0.1).rotateY(0.4), [0.3, 0.29, 0.28], 0.6, 0.6)); for (let i = 0; i < 5; i++) g.push(P(box(0.03, 0.006, 0.02, 0.25 * jit(i), 0, 0.25 + 0.1 * jit(i, 2)).rotateY(jit(i, 3) * 3), [0.18, 0.16, 0.15], 0.8, 0.3));
      return merge(g); }
    case 'bellows_stand': { const SKIN: RGB = [0.46, 0.34, 0.24]; return merge([P(box(0.34, 0.5, 0.3, 0, 0, 0), MUD, 1), P(new THREE.SphereGeometry(1, 8, 5).scale(0.16, 0.08, 0.2).translate(0, 0.56, 0), SKIN, 0.85),
        P(rod([0.02, 0.56, 0], [0.34, 0.5, -0.05], 0.03, 0.022, 5), POT, 0.9), P(rod([0, 0.64, 0.04], [0, 0.66, 0.14], 0.012, 0.012, 4), WOOD)]); }
    case 'bellows': { const SKIN: RGB = [0.46, 0.34, 0.24], g: THREE.BufferGeometry[] = [];
      for (const x of [-0.15, 0.15]) g.push(P(new THREE.SphereGeometry(1, 8, 5).scale(0.13, 0.12, 0.17).translate(x, 0.12, 0), SKIN, 0.85), P(rod([x, 0.1, 0.12], [x * 0.3, 0.12, 0.6], 0.025, 0.02, 5), POT, 0.9));
      return merge(g); }
    case 'stake': { const SILVER: RGB = [0.8, 0.79, 0.76]; const g = [P(new THREE.CylinderGeometry(0.14, 0.15, 0.2, 9).translate(0, 0.1, 0), WOOD_D), P(rod([0, 0.2, 0], [0, 0.27, 0], 0.012, 0.012, 5), IRON, 0.6, 0.6),
        paint(lathe([[0.001, 0.3], [0.03, 0.298], [0.07, 0.282], [0.085, 0.262], [0.083, 0.26]], 10), SILVER, 1, 0.3)];
      g.push(P(box(0.32, 0.02, 0.22, 0.38, 0, -0.2), WOOD)); for (const [x, z] of [[0.3, -0.24], [0.44, -0.16]]) g.push(paint(lathe([[0.001, 0.02], [0.03, 0.022], [0.07, 0.036], [0.085, 0.056], [0.083, 0.058]], 10).translate(x, 0, z), SILVER, 1, 0.3));
      return merge(g); }
    case 'weigh_table': { const DIOR: RGB = [0.16, 0.17, 0.16], SILVER: RGB = [0.78, 0.77, 0.74], top = 0.72; const g = [P(box(0.62, 0.035, 0.4, 0, top - 0.035, 0), WOOD)];
      for (const x of [-0.27, 0.27]) for (const z of [-0.16, 0.16]) g.push(P(box(0.04, top - 0.035, 0.04, x, 0, z), WOOD_D));
      for (let i = 0; i < 5; i++) { const r = 0.012 + 0.008 * i; g.push(P(new THREE.SphereGeometry(1, 7, 4).scale(r * 1.6, r, r).translate(-0.24 + i * 0.07 + r, top + r * 0.7, -0.1), DIOR, 0.4)); } // duck-shaped weights, graded
      g.push(P(lathe([[0.001, 0], [0.06, 0.005], [0.09, 0.035], [0.088, 0.038]], 10).translate(0.12, top, 0.05), POT, 0.8));
      for (let i = 0; i < 7; i++) g.push(paint(box(0.018, 0.008, 0.012, 0.12 + 0.04 * jit(i), top + 0.02 + 0.004 * i, 0.05 + 0.04 * jit(i, 2)).rotateY(0), SILVER, 1, 0.35));
      g.push(P(box(0.07, 0.022, 0.05, -0.15, top, 0.1), [0.56, 0.48, 0.37], 0.9));
      return merge(g); }
    case 'sealed_jars': { const CLAY: RGB = [0.52, 0.42, 0.3], jarG = (x: number, z: number, sc: number) => [P(SJ(Math.round(x * 10), 0.24, 0.66, () => lathe([[0.001, 0], [0.13, 0.03], [0.24, 0.3], [0.2, 0.55], [0.1, 0.62], [0.11, 0.66]], 12)).scale(sc, sc, sc).translate(x, 0, z), POT, 0.85),
        P(new THREE.CylinderGeometry(0.1 * sc, 0.1 * sc, 0.03, 10).translate(x, 0.67 * sc, z), CLAY, 0.9), P(new THREE.SphereGeometry(0.045 * sc, 6, 4).scale(1, 0.5, 1).translate(x + 0.02, 0.69 * sc, z), CLAY, 0.9)];
      return merge([...jarG(0, 0, 0.95), ...jarG(0.62, 0.2, 1.05), P(new THREE.SphereGeometry(1, 8, 5).scale(0.22, 0.28, 0.18).translate(-0.55, 0.26, 0.15), [0.62, 0.55, 0.42], 1),
        P(new THREE.SphereGeometry(0.03, 5, 3).translate(-0.55, 0.56, 0.1), CLAY, 0.9)]); }
    case 'seal_bench': { const g = [P(box(0.36, 0.24, 0.3, 0, 0, 0), STONE, 0.8), P(rod([0, 0.24, 0], [0, 0.44, 0], 0.006, 0.006, 4), WOOD), P(new THREE.CylinderGeometry(0.012, 0.012, 0.03, 6).translate(0, 0.255, 0), [0.28, 0.33, 0.52], 0.4)];
      g.push(P(lathe([[0.001, 0], [0.05, 0.004], [0.07, 0.03], [0.068, 0.032]], 9).translate(0.12, 0.24, 0.06), POT, 0.8), P(new THREE.CylinderGeometry(0.06, 0.06, 0.004, 9).translate(0.12, 0.265, 0.06), [0.52, 0.46, 0.36], 0.4));
      for (const x of [-0.1, -0.13]) g.push(P(new THREE.CylinderGeometry(0.009, 0.009, 0.03, 6).rotateZ(Math.PI / 2).translate(x, 0.25, 0.08), x < -0.12 ? [0.55, 0.3, 0.2] : [0.28, 0.33, 0.52], 0.4));
      return merge(g); }
    case 'tan_beam': { const HIDE_W: RGB = [0.62, 0.52, 0.4], STAIN: RGB = [0.26, 0.2, 0.15]; const a: [number, number, number] = [0, 0.86, 0.32], b: [number, number, number] = [0, 0.05, 1.3];
      const g = [P(rod(a, b, 0.11, 0.13, 8), WOOD_D), P(rod([-0.2, 0, 0.42], [0, 0.78, 0.4], 0.03, 0.03, 4), WOOD_D), P(rod([0.2, 0, 0.42], [0, 0.78, 0.4], 0.03, 0.03, 4), WOOD_D)];
      const L = Math.hypot(b[1] - a[1], b[2] - a[2]), ang = Math.atan2(a[1] - b[1], b[2] - a[2]);
      g.push(P(new THREE.CylinderGeometry(0.135, 0.135, L * 0.8, 10, 1, true, -Math.PI * 0.55, Math.PI * 1.1).rotateX(Math.PI / 2).rotateX(ang).translate(0, (a[1] + b[1]) / 2 + 0.01, (a[2] + b[2]) / 2), HIDE_W, 0.7));
      g.push(P(box(1.5, 0.004, 1.9, 0, 0, 0.9), STAIN, 1), P(mound(0.22, 0.09, 8, -0.35, 1.25), [0.55, 0.42, 0.34], 0.8));
      return merge(g); }
    case 'tan_vat': { const LIQ: RGB = [0.2, 0.15, 0.1]; const g = [P(new THREE.CylinderGeometry(0.62, 0.66, 0.45, 12, 1, true).translate(0, 0.225, 0), MUD, 1), P(new THREE.CylinderGeometry(0.62, 0.62, 0.02, 12).translate(0, 0.39, 0), LIQ, 0.15)];
      for (let i = 0; i < 3; i++) g.push(P(box(0.5, 0.02, 0.36, 0.2 * jit(i), 0.405, 0.2 * jit(i, 2)).rotateY(jit(i, 3) * 2), HIDE, 0.6));
      g.push(P(box(0.14, 0.45, 1.4, 0.7, 0, 0), BRICK, 0.95), P(box(0.14, 0.45, 1.4, -0.7, 0, 0), BRICK, 0.95));
      return merge(g); }
    case 'hide_frames': { const g: THREE.BufferGeometry[] = [P(box(4.2, 0.004, 2.6, 0, 0, 0), [0.3, 0.24, 0.18], 1), P(mound(0.45, 0.3, 9, -1.7, -0.8), [0.86, 0.85, 0.8], 1)];
      for (let i = 0; i < 3; i++) { const x = -1.2 + i * 1.2, z = 0.4 + 0.15 * jit(i), yaw = 0.2 * jit(i, 2), f: THREE.BufferGeometry[] = [];
        for (const sx of [-0.55, 0.55]) f.push(P(rod([sx, 0, 0], [sx, 1.5, 0], 0.03, 0.028, 4), WOOD_D));
        for (const y of [0.25, 1.4]) f.push(P(rod([-0.58, y, 0], [0.58, y, 0], 0.025, 0.025, 4), WOOD));
        f.push(P(box(0.95, 1.0, 0.012, 0, 0.32, 0), i === 1 ? [0.66, 0.56, 0.42] : HIDE, 0.8));
        g.push(merge(f).rotateY(yaw).translate(x, 0, z)); }
      return merge(g); }
    case 'oil_press': { const g = [P(new THREE.CylinderGeometry(0.22, 0.26, 0.35, 10, 1, true).translate(0, 0.175, 0), STONE, 0.75), P(new THREE.CylinderGeometry(0.14, 0.14, 0.02, 10).translate(0, 0.28, 0), [0.66, 0.54, 0.36], 1),
        P(new THREE.RingGeometry(0.14, 0.22, 10).rotateX(-Math.PI / 2).translate(0, 0.35, 0), STONE, 0.75)];
      g.push(P(new THREE.SphereGeometry(1, 8, 5).scale(0.2, 0.26, 0.17).translate(0.55, 0.24, -0.1), [0.62, 0.55, 0.42], 1), P(new THREE.CylinderGeometry(0.18, 0.14, 0.16, 10, 1, true).translate(-0.5, 0.08, -0.05), [0.6, 0.52, 0.32]),
        P(mound(0.16, 0.08, 7, -0.5, -0.05).translate(0, 0.08, 0), [0.6, 0.48, 0.3], 0.9));
      return merge(g); }
    case 'oil_jars': { const g: THREE.BufferGeometry[] = []; for (let i = 0; i < 4; i++) g.push(P(SJ(i, 0.14, 0.43, () => lathe([[0.001, 0], [0.09, 0.02], [0.14, 0.18], [0.1, 0.34], [0.05, 0.4], [0.055, 0.43]], 10)).translate(i * 0.32, 0, 0.03 * jit(i)), POT, 0.8),
        P(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8).translate(i * 0.32, 0.43, 0.03 * jit(i)), [0.52, 0.42, 0.3], 0.9));
      g.push(P(lathe([[0.001, 0], [0.04, 0.004], [0.05, 0.02], [0.048, 0.022]], 8).scale(1, 1, 1.3).translate(-0.3, 0, 0.1), POT, 0.8));
      return merge(g); }
    // D-256: a ring of thorn brush R 6 m (animals.ts FOLD_R) with a gate gap toward the performer (−z), in low heaped clumps
    case 'fold': { const g: THREE.BufferGeometry[] = [], R = 6, n = 30, THORN: RGB = [0.36, 0.3, 0.22];
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + Math.PI / 2; if (i === n / 2 || i === n / 2 + 1) continue; // (the gate, toward the performer: a = 3π/2)
        const x = R * Math.cos(a), z = R * Math.sin(a), h = 1.0 + 0.3 * Math.abs(jit(i, 4));
        g.push(P(new THREE.SphereGeometry(1, 7, 4).scale(0.75, h * 0.62, 0.6).rotateY(-a).translate(x, h * 0.62 - 0.08, z), jit(i) > 0 ? THORN : [0.42, 0.35, 0.25], 1)); }
      for (let i = 0; i < 3; i++) g.push(P(mound(0.45, 0.25, 7, -1.5 + 1.5 * i, 1.2 * jit(i, 7)), STRAW_D));
      return merge(g); }
    // D-256: the drum on its sledge, lying on its side (axis across the runners), the traces forward (+z) to the yoke
    case 'drum_haul': { const g = [P(new THREE.CylinderGeometry(0.86, 0.86, 1.3, 11).rotateZ(Math.PI / 2).translate(0, 0.28 + 0.86, 0), LIME, 0.95)];
      for (const x of [-0.6, 0.6]) g.push(P(box(0.2, 0.2, 3.1, x, 0, 0), WOOD_D));
      for (const z of [-1.0, 0, 1.0]) g.push(P(box(1.5, 0.12, 0.24, 0, 0.18, z), WOOD));
      for (const x of [-0.35, 0.35]) g.push(P(rod([x, 0.2, 1.55], [x * 0.3, 1.0, 3.0], 0.025, 0.025, 4), [0.62, 0.54, 0.38]));
      g.push(P(rod([-0.7, 1.4, 0], [0.7, 1.4, 0], 0.02, 0.02, 4), [0.6, 0.52, 0.36]));
      return merge(g); }
    case 'sledge': { const g: THREE.BufferGeometry[] = [];
      for (const x of [-0.6, 0.6]) g.push(P(box(0.2, 0.2, 3.1, x, 0, 0), WOOD_D));
      for (const z of [-1.0, 0, 1.0]) g.push(P(box(1.5, 0.12, 0.24, 0, 0.18, z), WOOD));
      for (const x of [-0.35, 0.35]) g.push(P(rod([x, 0.2, 1.55], [x * 0.3, 1.0, 3.0], 0.025, 0.025, 4), [0.62, 0.54, 0.38]));
      return merge(g); }
    case 'drum_rough': { const g = [P(new THREE.CylinderGeometry(0.84, 0.88, 1.3, 9).translate(0, 0.65, 0), LIME, 1)];
      for (let i = 0; i < 6; i++) g.push(P(mound(0.18 + 0.08 * Math.abs(jit(i)), 0.07, 5, 1.0 * Math.cos(i * 1.1), 1.0 * Math.sin(i * 1.1)), [0.7, 0.68, 0.63], 1));
      return merge(g); }
    case 'basin': return merge([P(lathe([[0.001, 0], [0.12, 0.005], [0.2, 0.05], [0.23, 0.1], [0.215, 0.105], [0.19, 0.06], [0.001, 0.02]], 12), POT, 0.85),
      P(new THREE.CylinderGeometry(0.185, 0.185, 0.003, 12).translate(0, 0.055, 0), [0.32, 0.36, 0.36], 0.08),
      P(lathe([[0.001, 0], [0.06, 0.01], [0.075, 0.07], [0.05, 0.13], [0.032, 0.15], [0.038, 0.17], [0.001, 0.16]], 8).translate(0.3, 0, 0.05), POT, 0.85)]);
    case 'milk_pot': return merge([P(lathe([[0.001, 0], [0.09, 0.02], [0.14, 0.12], [0.12, 0.22], [0.08, 0.26], [0.09, 0.29], [0.07, 0.29], [0.001, 0.2]], 10), POT, 0.85),
      P(new THREE.CylinderGeometry(0.075, 0.075, 0.004, 10).translate(0, 0.24, 0), [0.92, 0.9, 0.84], 0.6)]);
    case 'basket_fish': { const g = [P(SB(0, 0.22, 0.2, () => new THREE.CylinderGeometry(0.22, 0.17, 0.2, 10, 1, true).translate(0, 0.1, 0)), [0.6, 0.52, 0.32])];
      for (let i = 0; i < 4; i++) g.push(P(new THREE.SphereGeometry(1, 6, 3).scale(0.035, 0.03, 0.15).rotateY(i * 0.8).translate(0.06 * jit(i), 0.16 + 0.02 * i, 0.06 * jit(i, 2)), [0.5, 0.5, 0.44], 0.35, 0.2));
      return merge(g); }
    case 'fish_trap': return merge([P(new THREE.ConeGeometry(0.28, 1.1, 9, 1, true).rotateX(-Math.PI / 2).translate(0, 0.28, 0.2), [0.56, 0.48, 0.3], 1), P(box(0.2, 0.14, 0.16, 0, 0, -0.45), STONE, 0.9)]);
    case 'snare': { const g = [P(rod([-0.5, 0, 0], [-0.5, 0.2, 0], 0.012, 0.01, 3), WOOD), P(rod([0.5, 0, 0], [0.5, 0.2, 0], 0.012, 0.01, 3), WOOD), P(rod([-0.5, 0.12, 0], [0.5, 0.12, 0], 0.003, 0.003, 3), [0.3, 0.26, 0.2])];
      for (let i = 0; i < 5; i++) g.push(P(new THREE.TorusGeometry(0.035, 0.002, 3, 8).translate(-0.36 + 0.18 * i, 0.08, 0), [0.25, 0.22, 0.18]));
      return merge(g); }
    case 'hives': { const g = [P(box(2.4, 0.9, 0.8, 0, 0, 0), MUD, 1)];
      for (let r = 0; r < 2; r++) for (let c = 0; c < 6; c++) { const x = -1.0 + 0.4 * c, y = 0.25 + 0.36 * r;
        g.push(P(new THREE.CylinderGeometry(0.16, 0.16, 0.86, 9, 1, true).rotateX(Math.PI / 2).translate(x, y, 0.03), POT, 0.9)); g.push(P(new THREE.CircleGeometry(0.16, 9).translate(x, y, -0.41), MUD_WET, 1)); }
      return merge(g); }
    case 'basket_nuts': return merge([P(SB(1, 0.2, 0.2, () => new THREE.CylinderGeometry(0.2, 0.15, 0.2, 10, 1, true).translate(0, 0.1, 0)), [0.6, 0.52, 0.32]), P(mound(0.18, 0.1, 8).translate(0, 0.12, 0), [0.62, 0.55, 0.36], 0.8)]);
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
/** s18 C14 (D-790): the vehicles' wheels, drawn apart from the body so they turn: radius, axles (x, z of each wheel's
 *  centre; y = R), the half-width of a wheel's slab about its x (hub included) */
export const WHEELS: Partial<Record<WorkKind, { R: number; axles: [number, number][]; half: number }>> = {
  cart: { R: 0.46, axles: [[0.82, 0], [-0.82, 0]], half: 0.085 }, cart_stone: { R: 0.46, axles: [[0.82, 0], [-0.82, 0]], half: 0.085 },
  cart_timber: { R: 0.46, axles: [[0.82, 0], [-0.82, 0]], half: 0.085 }, chariot: { R: 0.5, axles: [[0.7, 0], [-0.7, 0]], half: 0.15 },
  wagon: { R: 0.42, axles: [[0.82, 0.95], [-0.82, 0.95], [0.82, -0.95], [-0.82, -0.95]], half: 0.06 },
};
/** s18 C14: a vehicle's geometry split: the body without its wheels, and one wheel (the +x first axle's triangles) centred on
 *  its own axle (the wheels are alike and mirror-symmetric) */
export function splitWheels(g: THREE.BufferGeometry, W: { R: number; axles: [number, number][]; half: number }): { body: THREE.BufferGeometry; wheel: THREE.BufferGeometry } {
  const src = g.index ? g.toNonIndexed() : g, pos = src.getAttribute('position'), n = pos.count / 3, keepB: number[] = [], keepW: number[] = [];
  for (let t = 0; t < n; t++) { let cx = 0, cy = 0, cz = 0; for (let v = 0; v < 3; v++) { cx += pos.getX(t * 3 + v) / 3; cy += pos.getY(t * 3 + v) / 3; cz += pos.getZ(t * 3 + v) / 3; }
    let wi = -1; W.axles.forEach(([x, z], i) => { if (wi < 0 && Math.abs(cx - x) < W.half && Math.hypot(cy - W.R, cz - z) < W.R + 0.03) wi = i; });
    if (wi < 0) keepB.push(t); else if (wi === 0) keepW.push(t); }
  const pick = (tris: number[], shift: [number, number, number]) => { const out = new THREE.BufferGeometry();
    for (const name of Object.keys(src.attributes)) { const a = src.getAttribute(name), k = a.itemSize, arr = new Float32Array(tris.length * 3 * k);
      tris.forEach((t, i) => { for (let v = 0; v < 3; v++) for (let c = 0; c < k; c++) arr[(i * 3 + v) * k + c] = a.getComponent(t * 3 + v, c) - (name === 'position' ? shift[c] : 0); });
      out.setAttribute(name, new THREE.BufferAttribute(arr, k, a.normalized)); }
    return out; };
  const [x0, z0] = W.axles[0];
  return { body: pick(keepB, [0, 0, 0]), wheel: pick(keepW, [x0, W.R, z0]) };
}
const _wm = new THREE.Matrix4(), _wr = new THREE.Matrix4();
export class WorkObjects {
  readonly group = new THREE.Group();
  private meshes = new Map<WorkKind, { mesh: THREE.InstancedMesh; n: number; radius: number; box: THREE.Box3; wheel?: { mesh: THREE.InstancedMesh; n: number } }>();
  /** objects not drawn this frame because their kind's instance cap was full (reported by stats: never silent) */
  dropped = 0;
  constructor(private material: THREE.Material, private cap = 256) { this.group.name = 'work:objects-dynamic'; }
  private mesh(kind: WorkKind) {
    let m = this.meshes.get(kind); if (m) return m;
    let g = workGeometry(kind); const W = WHEELS[kind]; let wheel: { mesh: THREE.InstancedMesh; n: number } | undefined;
    if (W) { const sp = splitWheels(g, W); if (sp.wheel.getAttribute('position').count) { g = sp.body; const wm = new THREE.InstancedMesh(sp.wheel, this.material, this.cap * W.axles.length);
      wm.count = 0; wm.visible = false; wm.castShadow = wm.receiveShadow = true; wm.instanceMatrix.setUsage(THREE.DynamicDrawUsage); wm.name = `work:${kind}:wheels`; wm.userData = { tier: WORK_NOTES[kind].tier, src: 'RECON', note: WORK_NOTES[kind].note + ' (its wheels, turning)' }; wm.raycast = () => {};
      wm.frustumCulled = false; nearCascadesOnly(wm); this.group.add(wm); wheel = { mesh: wm, n: 0 }; } }
    g.computeBoundingSphere();
    const mesh = new THREE.InstancedMesh(g, this.material, this.cap); mesh.count = 0; mesh.visible = false; mesh.castShadow = mesh.receiveShadow = true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); mesh.name = `work:${kind}`; mesh.userData = { tier: WORK_NOTES[kind].tier, src: 'RECON', note: WORK_NOTES[kind].note }; mesh.raycast = () => {};
    mesh.frustumCulled = true; mesh.boundingSphere = new THREE.Sphere(); nearCascadesOnly(mesh);
    this.group.add(mesh); m = { mesh, n: 0, radius: g.boundingSphere!.radius, box: new THREE.Box3(), wheel }; this.meshes.set(kind, m); return m;
  }
  begin() { this.dropped = 0; for (const m of this.meshes.values()) { m.n = 0; m.box.makeEmpty(); if (m.wheel) m.wheel.n = 0; } }
  /** `roll` (rad): how far a vehicle's wheels have turned (its distance travelled / R; s18 C14) */
  push(kind: WorkKind, M: THREE.Matrix4, roll = 0) {
    const m = this.mesh(kind); if (m.n >= this.cap) { this.dropped++; return; }
    m.mesh.setMatrixAt(m.n++, M); m.box.expandByPoint(_p.setFromMatrixPosition(M));
    const W = WHEELS[kind], w = m.wheel; if (W && w) W.axles.forEach(([x, z], i) => { const mir = x * W.axles[0][0] < 0;
      _wr.makeRotationX(mir ? -roll : roll); if (mir) _wr.premultiply(_wm.makeRotationY(Math.PI)); _wr.setPosition(x, W.R, z);
      w.mesh.setMatrixAt(w.n++, _wm.multiplyMatrices(M, _wr)); void i; });
  }
  end() {
    for (const m of this.meshes.values()) { const im = m.mesh; im.count = m.n; im.visible = m.n > 0;
      if (m.wheel) { const wm = m.wheel.mesh; wm.count = m.wheel.n; wm.visible = m.wheel.n > 0; if (m.wheel.n) { wm.instanceMatrix.needsUpdate = true; wm.instanceMatrix.clearUpdateRanges(); wm.instanceMatrix.addUpdateRange(0, m.wheel.n * 16); } }
      if (!m.n) continue;
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
