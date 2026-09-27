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
import { ptTabletGeometry } from '../world/writing';
import { HARP_V, HARP_H, LYRE, FRAME_DRUM, DOUBLE_PIPE, REED_PIPE, MOUTH, harpVString, harpHString, lyreString } from './instrumentForms';
import { scanShape, modelShape, aoFactor, modelParts, modelFit, mergedModel } from '../render/scanProps';

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
type RGB = [number, number, number];
/** vertex colour (linear), metalness/roughness and the per-vertex displacement direction for the instance parameter
 *  (`sv`: the bowstring's middle, the spindle below the hand) */
/** D-325: the scan kind of a painted piece (materials.ts PROP_SCAN_KINDS: 0 wood, 1 metal, 2 textile, 3 clay, 4 wicker, 5
 *  stone): given, or guessed from its metalness and colour (a warm mid brown wood, a grey stone, a pale warm straw) */
export const SCAN_KIND: Record<string, number> = { wood: 0, wood_d: 0, beam: 0, chips: 0, stick: 0, iron: 1, bronze: 1, silver: 1, gold: 1, gilt: 1, scale: 1, hot: 1, cloth: 2, linen: 2, wool: 2, wool_d: 2, red: 2, blue: 2,
  warp: 2, band: 2, hair: 2, cord: 2, skin: 2, leather: 2, hide: 2, hide_d: 2, hide_w: 2, feather: 2, petal: 2, fish: 2, meat: 2, fat: 2, meat_boiled: 2, clay: 3, pot: 3, mud: 3, mud_wet: 3, mud_roof: 3, brick: 3, clay_toy: 3,
  earth: 3, dung: 3, ash: 3, ember: 3, paste: 3, stain: 3, scrap: 3, tablet: 3, straw: 4, straw_d: 4, ears: 4, wicker: 4, reed: 4, cane: 4, grass: 4, wattle: 4, thorn: 4, thorn_d: 4, grain: 4, chaff: 4, nut: 4, green: 4,
  stone: 5, stone_d: 5, lime: 5, lapis: 5, diorite: 5, bone: 5 };
let paintKind = -1;
/** paint with a given scan kind (the modelled parts' names: SCAN_KIND) */
export function paintAs(kind: string, g: THREE.BufferGeometry, rgb: RGB, metal = 0, rough = 0.8, sv?: (x: number, y: number, z: number) => [number, number, number]) { paintKind = SCAN_KIND[kind] ?? -1; try { return paint(g, rgb, metal, rough, sv); } finally { paintKind = -1; } }
function guessKind(rgb: RGB, metal: number): number {
  if (metal >= 0.3) return 1; const [r, g, b] = rgb, sat = Math.max(r, g, b) - Math.min(r, g, b), l = (r + g + b) / 3;
  if (sat < 0.06) return l > 0.5 ? 2 : 5; if (r > 0.55 && g > 0.45 && b < 0.45 && g / r > 0.8) return 4; if (r > 0.5 && g / r < 0.78) return 3; return l < 0.5 ? 0 : 2;
}
function paint(g: THREE.BufferGeometry, rgb: RGB, metal = 0, rough = 0.8, sv?: (x: number, y: number, z: number) => [number, number, number]): THREE.BufferGeometry {
  const gg = g.index ? g.toNonIndexed() : g; if (gg.getAttribute('uv')) gg.deleteAttribute('uv');
  const n = gg.getAttribute('position').count, c = new Float32Array(n * 3), m = new Float32Array(n * 2), d = new Float32Array(n * 3); const P = gg.getAttribute('position'), L = rgb.map(lin);
  // (D-325: a modelled prop's baked occlusion multiplied into its colour)
  for (let i = 0; i < n; i++) { const k = aoFactor(gg, i); c[i * 3] = L[0] * k; c[i * 3 + 1] = L[1] * k; c[i * 3 + 2] = L[2] * k; m.set([metal, rough], i * 2); if (sv) d.set(sv(P.getX(i), P.getY(i), P.getZ(i)), i * 3); }
  if (gg.getAttribute('ao')) gg.deleteAttribute('ao');
  gg.setAttribute('ak', new THREE.BufferAttribute(new Float32Array(n).fill(paintKind >= 0 ? paintKind : guessKind(rgb, metal)), 1)); // (D-325: its scan kind)
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
const GUT: RGB = [0.86, 0.8, 0.64], CANE: RGB = [0.74, 0.66, 0.42];

export const PROP_NOTES: Record<string, { tier: 'A' | 'B' | 'C'; note: string }> = {
  spear: { tier: 'B', note: 'long spear with a pomegranate-shaped butt counterweight, silver for the ordinary guards (Herodotus via IR-IMM; SUSA-ARCH); shaft length and blade C' },
  sack: { tier: 'B', note: 'sack on the shoulder (porters on the tribute reliefs carry skins and bags)' },
  jar: { tier: 'C', note: 'storage/water jar, plain buff ware (C)' },
  tablet: { tier: 'C', note: 'PT tablet (memorandum) at its carried LOD: the scribes\' room tablet (writing.json objects.pt_letter; form and size SITE_SPEC treasury.r_scribes_room, C) as a coarse form with no relief at this size; the text the scribes\' room tablets carry is RECONSTRUCTED by the project on the Treasury tablets\' published formulary, not a surviving text (C; writing.json recon_texts, D-198; the PT texts themselves unreachable, BLOCKERS B18); clay tablets as such A' },
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
  // ------------------------------------------------ instruments (D-200; instrumentForms.ts; SOUNDSCAPE §8)
  harp_v: { tier: 'C', note: 'vertical angular harp: the type is B (seven played by the Elamite royal orchestra on the Madaktu relief of Ashurbanipal, 653 BCE, BM 124802, via extracts of Alvarez-Mon 2017: M-19); the form after extracts of harp-history summaries: soundbox upright against the player and leaning forward, strings vertical from a rod at its foot, 21 strings, navel to a head above the head (M-20). Sizes, wood, the plain soundbox (the relief\'s incised figure on its side is not modelled) and gut strings C; the music uses nine of the strings (the tuning texts\' nine-string cycle, M-04; Q-390). NOT SEEN: no image of the relief could be opened (B6)' },
  harp_h: { tier: 'C', note: 'horizontal angular harp: one at Madaktu (M-19, B type); held level under the left arm and struck with a plectrum, 7-9 strings (the Assyrian horizontal harp, Cheng 2012 via extracts: M-21). The plain rising string arm and the fan of 9 strings are C (the Assyrian forearm finial is not given to it). Modelled and animated; no performer plays it here (no source for who did at Persepolis)' },
  plectrum: { tier: 'C', note: 'plectrum stick for the horizontal harp or the lyre (the horizontal harp is struck with one: M-21; form C)' },
  lyre: { tier: 'C', note: 'round-bodied lyre with two arms and a yoke, nine strings (among the instruments of Achaemenid depictions per an extract, source not seen: SOUND-R); every part of the form C. Modelled and animated; no performer plays it here' },
  frame_drum: { tier: 'C', note: 'hand-held frame drum, a membrane on a wooden hoop 0.36 m across (a drum is played at Madaktu: M-19; the frame drum is the Mesopotamian standard: SOUND-R); size C. Modelled and animated; no performer plays it here' },
  double_pipe: { tier: 'C', note: 'double pipe of two cane pipes diverging from the mouth (two played at Madaktu: M-19, B type; never at a sacrifice, Herodotus 1.132: M-05); length and splay C. Modelled and animated; no performer plays it here' },
  reed_pipe: { tier: 'C', note: 'a herder\'s single cane pipe with a cut reed and five finger-holes, 0.3 m (herdsmen playing pipes: Iliad 18.525-526, read, M-18; the shepherd\'s reed pipe of Mesopotamia, a maker\'s site: M-10). Every part of the form C; nothing specific to Fars is attested' },
  // D-199 (court setting): the king's and his attendants' things as the door-jamb and audience reliefs carve them
  sceptre: { tier: 'B', note: 'the king’s long staff, held upright in the right hand (door-jamb and audience reliefs, HADISH-JAMB, TREAS-AUD: B; 1.7 m, gilded wood with a knob: C)' },
  lotus: { tier: 'B', note: 'a lotus flower on its stem in the king’s left hand (the same reliefs: B; size and colour C)' },
  parasol: { tier: 'B', note: 'the parasol held over the king by an attendant (door-jamb reliefs, HADISH-JAMB: B); a pole of 2 m and a canopy 1.2 m across with a fringe, cloth over ribs: C' },
  whisk: { tier: 'B', note: 'the fly-whisk held behind the king by an attendant (door-jamb reliefs: B); a short handle and a horsehair tuft, C' },
  towel: { tier: 'B', note: 'the towel or napkin the fly-whisk bearer carries (door-jamb and Treasury audience reliefs: B); folded linen over the hand, C' },
  // D-215 (gap audit items 21, 26, 4; D-207)
  spear_apple: { tier: 'B', note: 'the spear of the king’s own spearmen with an apple of gold at the butt: “those following nearest to Xerxes had apples of gold” (Herodotus 7.41, read: a claim, B); the apple’s size and the gilding C' },
  spear_gpom: { tier: 'B', note: 'a spear with a golden pomegranate at the butt: of the ten thousand “one thousand had golden pomegranates … the nine thousand silver” (Herodotus 7.41, read: B); given to one guard in ten of the Persian-dress files (C)' },
  ball: { tier: 'C', note: 'a child’s stitched leather ball, 10 cm (balls of leather or linen stuffed with chaff or hair are known from Egypt and the Greek world: RECOLLECTION, NOT SEEN; none attested at Persepolis; C)' },
  toy_bow: { tier: 'C', note: 'a boy’s small bow of the recurved form, 0.6 m (boys taught to shoot: HDT 1.136, a Greek claim, B; the toy C)' },
  // D-221 (rubric s7 pass 2 item 11): the scribes' writing things
  stylus: { tier: 'C', note: 'a reed stylus for writing cuneiform on clay, cut to a wedge at the tip (a reed or bone stylus: the wedge impressions of the tablets, A; Mesopotamian practice, B by analogy; 14 cm and the cut C), in the right hand while the left holds the tablet (D-221)' },
  pen: { tier: 'C', note: 'a reed pen for writing Aramaic in ink (Aramaic ink epigraphs on Persepolis tablets: B; pen and ink on leather in the Achaemenid chancery, the Arshama letters: B by analogy; the pen 18 cm, its inked tip C: D-221)' },
  leather: { tier: 'C', note: 'a sheet of prepared leather being written in Aramaic, one end still rolled (Treasury tablets tied to leather documents with an Aramaic duplicate, Cameron’s inference: B; the Arshama letters on leather: B by analogy; size C). The writing on it is NOT drawn: no Aramaic Treasury document is reachable and nothing is invented (D-221)' },
  barsom: { tier: 'C', note: 'the barsom: a bundle of thin twigs held upright in the right hand by a magus at the fire and at offerings (a man in Median dress holding the barsom on the gold plaques of the Oxus Treasure, OXUS-PLAQUE: B; a bundle on Achaemenid seals, NOT SEEN); a bundle 0.46 m long, drawn as two splayed rods (the twigs are not resolved at a carried prop’s size): C (D-209)' },
  rattle: { tier: 'C', note: 'a hollow fired-clay rattle with pellets inside and a stub handle (clay rattles are known from Near Eastern and Iranian sites: RECOLLECTION, NOT SEEN; C)' },
  // D-255: the crafts' and the records' tools (a class of their own: drawn only where someone works a craft)
  hammer: { tier: 'C', note: 'a smith’s hammer, an iron head on a wooden haft, 0.34 m (iron-working in the Achaemenid heartland: iron tools and slag are common finds, B; the form NOT SEEN, C)' },
  tongs: { tier: 'C', note: 'a smith’s iron tongs, 0.5 m, holding a bar at a red heat in the jaws (tongs are known from Near Eastern smithing depictions, RECOLLECTION, NOT SEEN; C)' },
  hammer_s: { tier: 'C', note: 'a goldsmith’s small hammer for chasing and raising, 0.22 m (goldsmiths among the Treasury craftsmen: PT, via PEOPLE.md, B; the tool C)' },
  punch: { tier: 'C', note: 'a bronze chasing punch, 0.1 m, held on the metal and struck (chased and repoussé gold and silver vessels of the period, e.g. the Achaemenid phialai: B; the tool C)' },
  balance: { tier: 'C', note: 'a hand balance: a bronze beam 0.32 m on a cord, two pans on cords (equal-arm balances of the ancient Near East and Egypt: B by analogy; silver paid by weight at the Treasury, PT via PEOPLE.md: B; the form C). The pans rock as a weight is laid in' },
  seal_cyl: { tier: 'B', note: 'a stone cylinder seal, 3 cm, rolled across the clay (cylinder seals and their rollings on the Fortification and Treasury tablets: PFS, A; the stone and size C)' },
  drill_bow: { tier: 'C', note: 'the seal cutter’s bow for the drill, a bent stick with a thong wound round the drill’s shaft (bow drills for stone: B by analogy; C)' },
  scraper: { tier: 'C', note: 'a tanner’s two-handled scraper for fleshing and dehairing a hide on the beam (C: the tool NOT SEEN)' },
  pestle: { tier: 'C', note: 'a long wooden pestle, 1.3 m, for pounding the roasted sesame in a stone mortar (C: the method reconstructed, research/CRAFTS.md)' },
  babe: { tier: 'C', note: 'a baby of 3-12 months or a small child carried, in a little tunic, bare-legged (C; D-215: its size by age, its skin the carer’s tone)' },
  babe_wrapped: { tier: 'C', note: 'a baby under three months swaddled in a cloth, the face showing (swaddling by analogy with Greek and Egyptian practice: C, Q-431)' },
  babe_sling: { tier: 'C', note: 'a baby or small child in a cloth sling on the carer’s back or front, knotted over her shoulders (the plan’s “on her back”, “at her front”; the sling C)' },
  babe_wrapped_sling: { tier: 'C', note: 'a swaddled baby in a cloth sling on the back (C)' },
  babe_mat: { tier: 'C', note: 'a swaddled baby lying on a reed mat on the ground beside the one minding it (the plan: “lying on a mat beside her while she works”; C)' },
  babe_cradle: { tier: 'C', note: 'a baby asleep in a shallow oval basket cradle on the ground at home (gap audit item 4; basketry is attested in the period, the cradle C)' },
};

// ------------------------------------------------------------------------------------------------ D-325: the modelled tools
// Every tool, weapon and held thing of the lists below is the project's model (tools/blender/model_props.py `tool_<kind>`:
// the spear's leaf blade with its midrib, socket and ring and the pomegranate or apple butt; the recurved bow's tapering
// limbs and wrapped grip; the sickle's toothed crescent; the hoe's socket eye; the fork's lashed crosspiece and curving
// tines; the spindle's domed whorl and cop; the balance's pans on their cords; ...), in the same frame and at the same size
// as the procedural form it replaces (which stays as the stand-in when the models are not loaded). Its parts are named for
// what they are made of and painted here; the baked occlusion is multiplied into the colour (paint).
const TOOL_PAINT: Record<string, [RGB, number, number]> = {
  wood: [WOOD, 0, 0.7], wood_d: [WOOD_D, 0, 0.7], iron: [IRON, 0.6, 0.5], bronze: [BRONZE, 0.8, 0.4], silver: [[0.8, 0.8, 0.78], 1, 0.3], gold: [[0.9, 0.72, 0.36], 1, 0.3],
  straw: [STRAW, 0, 1], cloth: [[0.62, 0.58, 0.5], 0, 1], wool: [[0.8, 0.76, 0.66], 0, 1], bone: [[0.8, 0.76, 0.66], 0, 0.7], clay: [[0.66, 0.46, 0.32], 0, 0.9], cord: [[0.62, 0.54, 0.38], 0, 0.95],
  leather: [[0.5, 0.36, 0.23], 0, 0.8], reed: [[0.7, 0.62, 0.43], 0, 0.7], cane: [CANE, 0, 0.55], linen: [[0.8, 0.77, 0.7], 0, 1], hair: [[0.82, 0.8, 0.74], 0, 1], feather: [[0.3, 0.28, 0.25], 0, 0.9],
  stone: [[0.55, 0.5, 0.45], 0, 0.8], mud: [[0.62, 0.53, 0.4], 0, 0.95], green: [[0.3, 0.42, 0.2], 0, 0.8], petal: [[0.82, 0.8, 0.72], 0, 0.8], band: [[0.75, 0.62, 0.36], 0, 0.9],
  hot: [[1.0, 0.42, 0.12], 0.2, 0.6], ink: [[0.08, 0.07, 0.06], 0, 0.5], skin: [[0.78, 0.7, 0.55], 0, 0.8],
};
const TOOL_OVERRIDE: Record<string, Record<string, [RGB, number, number]>> = {
  bow: { wood: [[0.3, 0.2, 0.12], 0, 0.6] }, toy_bow: { wood: [[0.42, 0.3, 0.18], 0, 0.6] }, parasol: { cloth: [[0.62, 0.2, 0.2], 0, 0.9], wood: [[0.45, 0.33, 0.21], 0, 0.7] },
  seal_cyl: { stone: [[0.28, 0.33, 0.52], 0.1, 0.35] }, whisk: { gold: [[0.62, 0.48, 0.26], 0.7, 0.4] }, sceptre: { gold: [[0.62, 0.48, 0.26], 0.7, 0.4] }, mallet: { wood: [[0.42, 0.31, 0.2], 0, 0.7], wood_d: [[0.4, 0.29, 0.18], 0, 0.7] },
  rattle: { clay: [[0.66, 0.46, 0.32], 0, 0.9] }, ball: { leather: [[0.55, 0.4, 0.26], 0, 0.85] }, brick: { mud: [[0.62, 0.53, 0.4], 0, 0.95] }, stick: { wood_d: [[0.4, 0.3, 0.2], 0, 0.9] },
  lead: { cord: [[0.6, 0.52, 0.36], 0, 0.95] }, drill_bow: { leather: [[0.5, 0.36, 0.22], 0, 0.9] }, barsom: { wood: [[0.5, 0.42, 0.26], 0, 0.9] }, cloth: { cloth: [[0.62, 0.58, 0.5], 0, 1] },
};
/** the kinds drawn from their models (the rest keep their procedural forms: the tablet (writing.ts), the leather sheet, the
 *  instruments, the carried children) */
export const MODELLED_TOOLS = ['spear', 'spear_apple', 'spear_gpom', 'mallet', 'sickle', 'spindle', 'distaff', 'trowel', 'brick', 'knife', 'cloth', 'wisp', 'rag', 'awl', 'arrow', 'lead', 'ladle', 'stick',
  'barsom', 'stylus', 'hoe', 'fork', 'goad', 'staff', 'broom', 'mould', 'rope', 'adze', 'bow', 'toy_bow', 'beater', 'paddle', 'sceptre', 'parasol', 'lotus', 'whisk', 'towel', 'ball', 'rattle',
  'hammer', 'tongs', 'hammer_s', 'punch', 'balance', 'seal_cyl', 'drill_bow', 'scraper', 'pestle', 'pen', 'plectrum',
  // the instruments' bodies (their strings and finger-holes stay the builder's: placed by instrumentForms.ts)
  'harp_v', 'harp_h', 'lyre', 'frame_drum', 'double_pipe', 'reed_pipe'];
const TOOL_SV: Record<string, (x: number, y: number, z: number) => [number, number, number]> = {
  spindle: (_x, y) => [0, y < -0.005 ? -1 : 0, 0], // (below the hand: lowered by the yarn's length)
  balance: (x, y) => [0, y < -0.13 ? (x > 0 ? 1 : -1) : 0, 0], // (the pans rock: the right one up, the left one down)
};
function toolModel(kind: string): THREE.BufferGeometry | null {
  if (!MODELLED_TOOLS.includes(kind)) return null;
  const p = modelParts('tool_' + kind, 0); if (!p) return null;
  const gs = Object.entries(p).map(([k, g]) => { const t = TOOL_OVERRIDE[kind]?.[k] ?? TOOL_PAINT[k] ?? [WOOD, 0, 0.8]; return paintAs(k, g, t[0], t[1], t[2], TOOL_SV[kind]); });
  if (kind === 'bow' || kind === 'toy_bow') gs.push(...bowString(kind === 'toy_bow' ? 0.3 : 0.52));
  if (kind === 'harp_v') for (let i = 0; i < HARP_V.strings; i++) { const s = harpVString(i); gs.push(paint(rod(s.foot, s.head, 0.0012, 0.0012, 3), GUT, 0, 0.5)); }
  if (kind === 'harp_h') for (let i = 0; i < HARP_H.strings; i++) { const s = harpHString(i); gs.push(paint(rod(s.foot, s.head, 0.0012, 0.0012, 3), GUT, 0, 0.5)); }
  if (kind === 'lyre') for (let i = 0; i < LYRE.strings; i++) { const s = lyreString(i); gs.push(paint(rod(s.foot, s.head, 0.0011, 0.0011, 3), GUT, 0, 0.5)); }
  if (kind === 'reed_pipe') for (let i = 0; i < REED_PIPE.holes; i++) gs.push(paint(box(0.007, 0.002, 0.007, 0, REED_PIPE.r + 0.0005, REED_PIPE.hole0 + i * REED_PIPE.holeStep), [0.2, 0.16, 0.1], 0, 0.9));
  return merge(gs);
}
/** the bowstring (its middle drawn back by the instance parameter), from the limbs' tips to z −0.14 */
function bowString(half: number): THREE.BufferGeometry[] {
  const P = (u: number): [number, number, number] => { const y = half * u, a = Math.abs(u); return [0, y, 0.06 * a * a - 0.1 * a + (a > 0.8 ? 0.35 * (a - 0.8) : 0)]; };
  const tip = P(1), bot = P(-1), mid: [number, number, number] = [0, 0, -0.14], sv = (_x: number, y: number): [number, number, number] => [0, 0, Math.abs(y) < 0.02 ? -1 : 0];
  return [paint(rod(tip, mid, 0.0025, 0.0025, 3), [0.82, 0.78, 0.66], 0, 0.8, sv), paint(rod(mid, bot, 0.0025, 0.0025, 3), [0.82, 0.78, 0.66], 0, 0.8, sv)];
}

/** geometry of a kind; the Phase 3 kinds keep their old origins (spear: at the butt; others: at the grip) */
export function propGeometry(kind: string): THREE.BufferGeometry | null {
  const tm = toolModel(kind); if (tm) return tm;
  if (kind === 'bowl') { const ph = modelParts('phiale', 1); if (ph) return paint(ph.metal, [0.82, 0.8, 0.76], 1, 0.28); } // (D-325: the lobed phiale, modelled)
  switch (kind) {
    case 'spear': { // shaft 2.1 m, bronze blade, silver pomegranate butt (sphere with a small crown), C proportions
      const shaft = paint(new THREE.CylinderGeometry(0.014, 0.016, 2.1, 6).translate(0, 1.13, 0), [0.45, 0.33, 0.21], 0, 0.7);
      const socket = paint(new THREE.CylinderGeometry(0.017, 0.014, 0.08, 6).translate(0, 2.21, 0), [0.62, 0.45, 0.26], 1, 0.4);
      const blade = paint(new THREE.ConeGeometry(0.028, 0.26, 4).scale(1, 1, 0.35).translate(0, 2.38, 0), [0.62, 0.45, 0.26], 1, 0.35);
      const butt = paint(new THREE.SphereGeometry(0.045, 7, 5).translate(0, 0.05, 0), [0.8, 0.8, 0.78], 1, 0.3);
      const crown = paint(new THREE.CylinderGeometry(0.012, 0.022, 0.03, 6).translate(0, 0.1, 0), [0.8, 0.8, 0.78], 1, 0.3);
      return merge([shaft, socket, blade, butt, crown]);
    }
    case 'sack': { // D-325: the modelled filled sack lying (the cloth solver's settle; tools/blender/model_props.py), at lod1, in the old form's box
      const sk = modelShape('sack_lying', 0, [0.44, 0.33, 0.31], 1); if (sk) return paint(sk.translate(0, -0.165, 0), [0.62, 0.55, 0.42], 0, 0.95); }
      return paint(new THREE.SphereGeometry(0.22, 8, 5).scale(1, 0.75, 0.7), [0.62, 0.55, 0.42], 0, 0.95);
    // session 12 (D-310): the jar and the basket are CC0 scans' shapes (Poly Haven; render/scanProps.ts) fitted to the old forms' boxes, when loaded
    case 'jar': { const sj = modelShape('jar', 1, [0.32, 0.46, 0.32], 1) ?? scanShape('jar', 1, [0.32, 0.46, 0.32], 1); if (sj) return paint(sj, [0.66, 0.46, 0.3], 0, 0.85); } // (D-325: the period's water jar, modelled, at lod1)
      return paint(new THREE.LatheGeometry([[0, 0], [0.1, 0.02], [0.16, 0.18], [0.12, 0.36], [0.06, 0.42], [0.07, 0.46]].map(([x, y]) => new THREE.Vector2(x, y)), 14), [0.66, 0.46, 0.3], 0, 0.85);
    case 'tablet': return paintAs('clay', ptTabletGeometry('full', modelParts('tool_brick', 1) ? 1 : 2), [0.56, 0.48, 0.37], 0, 0.9); // the written tablet's pillowed form (writing.ts; D-325: with the modelled props its middle level, rounded, not the 12-triangle box; the procedural set keeps the box and its 1,000-triangle union)
    case 'mallet': return merge([paint(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6).translate(0, -0.15, 0), [0.42, 0.31, 0.2], 0, 0.7), paint(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8).rotateZ(Math.PI / 2).translate(0, -0.3, 0), [0.4, 0.29, 0.18], 0, 0.7)]);
    case 'basket': { const sb = scanShape('basket', 0, [0.36, 0.18, 0.36], 1); /* (D-325: lod1, since the weld fixed the scans' lod1) */ if (sb) return paint(sb.translate(0, -0.09, 0), [0.6, 0.52, 0.32], 0, 0.9); }
      return paint(new THREE.CylinderGeometry(0.18, 0.13, 0.18, 12, 1, true), [0.6, 0.52, 0.32], 0, 0.9);
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
    case 'bow': case 'toy_bow': { // grip at the origin; limbs ±Y (1.05 m; the toy 0.6 m), recurved tips toward +Z (the target); string at z −0.14, its middle drawn back by the parameter (m)
      const toy = kind === 'toy_bow', half = toy ? 0.3 : 0.52, n = toy ? 3 : 5, sides = toy ? 3 : 4, th = toy ? 0.6 : 1;
      const g: THREE.BufferGeometry[] = []; const P = (u: number): [number, number, number] => { const y = half * u, a = Math.abs(u); return [0, y, 0.06 * a * a - 0.1 * a + (a > 0.8 ? 0.35 * (a - 0.8) : 0)]; };
      for (let i = -n; i < n; i++) g.push(paint(rod(P(i / n), P((i + 1) / n), (0.016 - 0.008 * Math.abs(i + 0.5) / n) * th, (0.016 - 0.008 * Math.abs(i + 1.5) / n) * th, sides), toy ? [0.42, 0.3, 0.18] : [0.3, 0.2, 0.12], 0, 0.6));
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
    case 'bowl': return paint(new THREE.LatheGeometry([[0, 0], [0.03, 0.002], [0.08, 0.018], [0.1, 0.04], [0.098, 0.042]].map(([x, y]) => new THREE.Vector2(x, y)), 11), [0.82, 0.8, 0.76], 1, 0.28); // (11 sides, D-221: 8 triangles for the scribes' stylus in the small objects' union)
    case 'rag': return paint(new THREE.SphereGeometry(0.035, 5, 4).scale(1, 0.7, 1.2), [0.7, 0.66, 0.58], 0, 1);
    case 'awl': return merge([paint(rod([0, 0, -0.05], [0, 0, 0.04], 0.012, 0.012, 4, true), [0.8, 0.76, 0.66], 0, 0.7), paint(rod([0, 0, 0.04], [0, 0, 0.12], 0.004, 0.001, 3), [0.8, 0.76, 0.66], 0, 0.7)]);
    case 'ladle': return merge([paint(rod([0, 0, -0.08], [0, 0, 0.36], 0.011, 0.011, 4), WOOD, 0, 0.7), paint(new THREE.SphereGeometry(0.045, 6, 3, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).translate(0, 0.02, 0.4), WOOD_D, 0, 0.7)]);
    case 'stick': return paint(rod([0, 0, -0.15], [0, 0, 0.55], 0.012, 0.008, 4), [0.4, 0.3, 0.2], 0, 0.9);
    case 'lead': return paint(rod([0, 0, 0], [0, -0.1, 0.65], 0.007, 0.007, 3), [0.6, 0.52, 0.36], 0, 0.95);
    // ------------------------------------------------ instruments (their own frames: instrumentForms.ts)
    case 'harp_v': { const H = HARP_V, g: THREE.BufferGeometry[] = [];
      g.push(paint(box(H.boxW, H.boxLen, H.boxD, 0, H.boxLen / 2 - 0.03, 0).rotateX(H.lean), WOOD, 0, 0.6)); // soundbox, leaning over the strings
      g.push(paint(rod([0, 0, -H.rodBack], [0, 0, H.rodLen], H.rodR, H.rodR * 0.8, 5, true), WOOD_D, 0, 0.6)); // the string rod through its foot
      for (let i = 0; i < H.strings; i++) { const s = harpVString(i); g.push(paint(rod(s.foot, s.head, 0.0012, 0.0012, 3), GUT, 0, 0.5)); }
      return merge(g); }
    case 'harp_h': { const H = HARP_H, g: THREE.BufferGeometry[] = [paint(box(H.boxW, H.boxH, H.boxLen, 0, 0, H.boxLen / 2), WOOD, 0, 0.6), paint(rod(H.armFoot, H.armTop, H.armR, H.armR * 0.8, 5, true), WOOD_D, 0, 0.6)];
      for (let i = 0; i < H.strings; i++) { const s = harpHString(i); g.push(paint(rod(s.foot, s.head, 0.0012, 0.0012, 3), GUT, 0, 0.5)); }
      return merge(g); }
    case 'plectrum': return paint(rod([0, 0, -0.03], [0, 0, 0.13], 0.005, 0.003, 4, true), [0.7, 0.62, 0.48], 0, 0.6);
    case 'lyre': { const L = LYRE; // the round body: a disc in the X-Z plane (its faces toward ±Y), its foot at the origin
      const g: THREE.BufferGeometry[] = [paint(new THREE.CylinderGeometry(L.r, L.r, L.thick, 12).translate(0, 0, L.r), WOOD, 0, 0.6)];
      for (const s of [-1, 1]) g.push(paint(rod([s * L.arm[0][0], 0, L.arm[0][1]], [s * L.arm[1][0], 0, L.arm[1][1]], 0.014, 0.011, 4, true), WOOD_D, 0, 0.6));
      g.push(paint(rod([-0.16, 0, L.yokeZ], [0.16, 0, L.yokeZ + 0.02], 0.012, 0.012, 4, true), WOOD_D, 0, 0.6));
      g.push(paint(box(0.14, 0.012, 0.012, 0, L.face - 0.006, L.bridgeZ), WOOD_D, 0, 0.6)); // the bridge
      for (let i = 0; i < L.strings; i++) { const s = lyreString(i); g.push(paint(rod(s.foot, s.head, 0.0011, 0.0011, 3), GUT, 0, 0.5)); }
      return merge(g); }
    case 'frame_drum': { const F = FRAME_DRUM; // hoop (open cylinder along Z) and the membrane on its +Z face
      return merge([paint(new THREE.CylinderGeometry(F.r, F.r, F.depth, 16, 1, true).rotateX(Math.PI / 2).translate(0, 0, -F.depth / 2), WOOD, 0, 0.6),
        paint(new THREE.CircleGeometry(F.r * 0.995, 16).translate(0, 0, 0.001), [0.78, 0.7, 0.55], 0, 0.8), paint(new THREE.CircleGeometry(F.r * 0.995, 16).rotateY(Math.PI).translate(0, 0, -F.depth + 0.001), [0.7, 0.62, 0.48], 0, 0.8)]); }
    case 'double_pipe': { const P = DOUBLE_PIPE, g: THREE.BufferGeometry[] = [];
      for (const s of [-1, 1]) { const e: [number, number, number] = [s * Math.sin(P.splay / 2) * P.len, 0, Math.cos(P.splay / 2) * P.len];
        g.push(paint(rod([0, 0, 0.005], e, P.r * 0.8, P.r, 5), CANE, 0, 0.55)); g.push(paint(rod([0, 0, -0.012], [0, 0, 0.012], P.r * 0.7, P.r * 0.8, 4, true), [0.62, 0.55, 0.36], 0, 0.7)); }
      return merge(g); }
    case 'reed_pipe': { const P = REED_PIPE, g: THREE.BufferGeometry[] = [paint(rod([0, 0, -0.005], [0, 0, P.len], P.r, P.r, 6), CANE, 0, 0.55)];
      for (let i = 0; i < P.holes; i++) g.push(paint(box(0.007, 0.002, 0.007, 0, P.r + 0.0005, P.hole0 + i * P.holeStep), [0.2, 0.16, 0.1], 0, 0.9)); // the finger-holes, dark, on top
      return merge(g); }
    // D-199: held upright (rule 'one', `up`): +Z up from the fist; the staff's foot below the hand, the knob above
    case 'sceptre': return merge([paint(rod([0, 0, -0.75], [0, 0, 0.9], 0.013, 0.012, 5), [0.62, 0.48, 0.26], 0.7, 0.4), paint(new THREE.SphereGeometry(0.03, 6, 4).translate(0, 0, 0.93), [0.75, 0.6, 0.32], 0.9, 0.3)]);
    case 'lotus': { const g = [paint(rod([0, 0, -0.04], [0, 0, 0.2], 0.004, 0.004, 3), [0.3, 0.42, 0.2], 0, 0.8)];
      for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; g.push(paint(new THREE.ConeGeometry(0.018, 0.06, 3).rotateX(Math.PI / 2).rotateY(0).translate(Math.cos(a) * 0.012, Math.sin(a) * 0.012, 0.23), [0.82, 0.8, 0.72], 0, 0.8)); }
      return merge(g); }
    case 'parasol': return merge([paint(rod([0, 0, -0.3], [0, 0, 1.75], 0.016, 0.014, 5), [0.45, 0.33, 0.21], 0, 0.7),
      paint(new THREE.ConeGeometry(0.6, 0.18, 12, 1, true).rotateX(Math.PI / 2).translate(0, 0, 1.66), [0.62, 0.2, 0.2], 0, 0.9),
      paint(new THREE.CylinderGeometry(0.6, 0.6, 0.07, 12, 1, true).rotateX(Math.PI / 2).translate(0, 0, 1.54), [0.75, 0.62, 0.36], 0, 0.9)]);
    case 'whisk': return merge([paint(rod([0, 0, -0.08], [0, 0, 0.26], 0.012, 0.011, 5), [0.62, 0.48, 0.26], 0.7, 0.4), paint(rod([0, 0, 0.26], [0, 0, 0.62], 0.02, 0.05, 6), [0.82, 0.8, 0.74], 0, 1)]);
    case 'towel': return paint(box(0.08, 0.02, 0.34, 0, 0, -0.12), [0.8, 0.77, 0.7], 0, 1);
    // D-215: the royal spearmen's gilded butts (the ordinary spear's form, the butt gold: an apple, or a pomegranate with its crown)
    case 'spear_apple': case 'spear_gpom': { const G: RGB = [0.9, 0.72, 0.36];
      const parts = [paint(new THREE.CylinderGeometry(0.014, 0.016, 2.1, 6).translate(0, 1.13, 0), [0.45, 0.33, 0.21], 0, 0.7), paint(new THREE.CylinderGeometry(0.017, 0.014, 0.08, 6).translate(0, 2.21, 0), [0.62, 0.45, 0.26], 1, 0.4),
        paint(new THREE.ConeGeometry(0.028, 0.26, 4).scale(1, 1, 0.35).translate(0, 2.38, 0), [0.62, 0.45, 0.26], 1, 0.35)];
      if (kind === 'spear_apple') parts.push(paint(new THREE.SphereGeometry(0.048, 7, 5).scale(1, 0.88, 1).translate(0, 0.045, 0), G, 1, 0.3), paint(new THREE.CylinderGeometry(0.004, 0.006, 0.02, 4).translate(0, 0.093, 0), G, 1, 0.3));
      else parts.push(paint(new THREE.SphereGeometry(0.045, 7, 5).translate(0, 0.05, 0), G, 1, 0.3), paint(new THREE.CylinderGeometry(0.012, 0.022, 0.03, 6).translate(0, 0.1, 0), G, 1, 0.3));
      return merge(parts); }
    // D-215: children's toys (gap audit item 26)
    case 'ball': return paint(new THREE.SphereGeometry(0.05, 6, 4), [0.55, 0.4, 0.26], 0, 0.85);
    // D-209: the barsom, a bundle of thin twigs held upright (the Oxus plaques: B; length and form C)
    // (12 triangles: the small objects' union has 14 to spare of its 1,000; at a carried prop's size the bundle reads as two
    // splayed rods 2.4 and 1.6 cm thick, the twigs are not resolved)
    // D-221: the scribes' writing things (grip frame: +Z toward the working end)
    case 'stylus': return paint(rod([0, 0, -0.07], [0, 0, 0.075], 0.0045, 0.0012, 3), [0.7, 0.62, 0.43], 0, 0.7); // (one tapered reed, 6 triangles: the small objects' union is at its budget)
    case 'pen': return merge([paint(rod([0, 0, -0.1], [0, 0, 0.07], 0.0035, 0.003, 3), [0.7, 0.63, 0.44], 0, 0.7), paint(rod([0, 0, 0.07], [0, 0, 0.085], 0.003, 0.001, 3), [0.08, 0.07, 0.06], 0, 0.5)]);
    case 'leather': { // a sheet 0.2 x 0.13 m lying on the palm (x across, z along), its far end rolled
      const sheet = new THREE.PlaneGeometry(0.2, 0.13, 2, 2).rotateX(-Math.PI / 2).translate(0, 0.004, 0.01), pos = sheet.getAttribute('position');
      for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) / 0.1; pos.setY(i, pos.getY(i) + 0.012 * x * x); } // (a little cupped across)
      sheet.computeVertexNormals();
      return merge([paint(sheet, [0.76, 0.64, 0.47], 0, 0.8), paint(rod([-0.1, 0.014, 0.075], [0.1, 0.014, 0.075], 0.012, 0.012, 5), [0.7, 0.58, 0.42], 0, 0.8)]); }
    case 'barsom': return merge([paint(rod([0, 0, -0.1], [0.004, 0, 0.36], 0.012, 0.009, 3), [0.5, 0.42, 0.26], 0, 0.9), paint(rod([0, 0, -0.08], [-0.016, 0.008, 0.33], 0.008, 0.006, 3), [0.56, 0.47, 0.29], 0, 0.9)]);
    case 'rattle': return merge([paint(new THREE.SphereGeometry(0.034, 5, 4).scale(1, 0.85, 1).translate(0, 0, 0.1), [0.66, 0.46, 0.32], 0, 0.9), paint(rod([0, 0, -0.03], [0, 0, 0.07], 0.012, 0.014, 3, true), [0.62, 0.43, 0.3], 0, 0.9)]);
    // D-215: the carried child (gap audit item 4): its own frame, origin at its seat (the bottom), +Y up its spine, +Z its
    // front; made at a reference length (babes.ts babeKind) and scaled per instance. Skin vertices carry metalness −1: the
    // babes' material tints them by the carer's tone (the instance parameter)
    case 'babe': return babeG(false);
    case 'babe_wrapped': return babeG(true);
    case 'babe_sling': return merge([babeG(false), slingG(false)]);
    case 'babe_wrapped_sling': return merge([babeG(true), slingG(true)]);
    case 'babe_mat': return merge([paint(box(0.5, 0.012, 0.8, 0, 0.006, 0), [0.68, 0.6, 0.4], 0, 0.95), babeG(true).rotateX(-Math.PI / 2).translate(0, 0.08, 0.26)]);
    case 'babe_cradle': { const mc = modelFit('basket_cradle', [0.8, 0.17, 0.48], 1); // (D-325: the modelled coiled-reed basket cradle and its cloth)
      if (mc) return merge([paintAs('wicker', mc.wicker.rotateY(Math.PI / 2), [0.62, 0.52, 0.32], 0, 0.9), paintAs('cloth', mc.cloth.rotateY(Math.PI / 2), [0.8, 0.77, 0.7], 0, 1), babeG(true).rotateX(-Math.PI / 2).translate(0, 0.085, 0.24)]);
      const prof = [[0.16, 0.01], [0.2, 0.03], [0.225, 0.12], [0.24, 0.17]], inner = [...prof].reverse().map(([r, y]) => [r - 0.014, y + (y < 0.02 ? 0.01 : 0)]);
      const lathe = (pts: number[][]) => new THREE.LatheGeometry(pts.map(([a, b]) => new THREE.Vector2(a, b)), 8).scale(1, 1, 1.65);
      return merge([paint(lathe(prof), [0.62, 0.52, 0.32], 0, 0.9), paint(lathe(inner), [0.56, 0.47, 0.29], 0, 0.95), paint(box(0.3, 0.012, 0.52, 0, 0.012, 0), [0.8, 0.77, 0.7], 0, 1), babeG(true).rotateX(-Math.PI / 2).translate(0, 0.085, 0.24)]); }
    // ------------------------------------------------ D-255: the crafts' and the records' tools (grip frame: +Z to the working end)
    case 'hammer': return merge([paint(rod([0, 0, -0.06], [0, 0, 0.3], 0.013, 0.016, 5), WOOD, 0, 0.7), paint(box(0.036, 0.12, 0.042, 0, -0.015, 0.29), IRON, 0.7, 0.45)]);
    case 'tongs': { const HOT: RGB = [1.0, 0.42, 0.12]; const g: THREE.BufferGeometry[] = [];
      for (const s of [-1, 1]) g.push(paint(rod([0, 0.008 * s, -0.08], [0, 0.012 * s, 0.34], 0.007, 0.006, 4), IRON, 0.7, 0.5), paint(rod([0, 0.012 * s, 0.34], [0, 0.004 * s, 0.44], 0.006, 0.005, 3), IRON, 0.7, 0.5));
      g.push(paint(box(0.018, 0.018, 0.16, 0, 0, 0.5), HOT, 0.2, 0.6)); return merge(g); } // (the bar at a red heat; the glow is its colour: C)
    case 'hammer_s': return merge([paint(rod([0, 0, -0.04], [0, 0, 0.18], 0.008, 0.009, 4), WOOD, 0, 0.7), paint(box(0.02, 0.06, 0.022, 0, -0.01, 0.18), BRONZE, 0.8, 0.4)]);
    case 'punch': return paint(rod([0, 0, -0.04], [0, 0, 0.07], 0.0055, 0.003, 4, true), BRONZE, 0.8, 0.4);
    case 'balance': { // hung from the hand: the cord down to the beam (x across), the pans on their cords below it; the pans
      // rock with the instance parameter (sv: the left pan up, the right pan down, m)
      const CORD: RGB = [0.66, 0.58, 0.42], up = (_x: number, y: number): [number, number, number] => [0, y < -0.13 ? 1 : 0, 0], dn = (_x: number, y: number): [number, number, number] => [0, y < -0.13 ? -1 : 0, 0];
      const g = [paint(rod([0, 0, 0], [0, -0.1, 0], 0.002, 0.002, 3), CORD, 0, 0.9), paint(rod([-0.16, -0.1, 0], [0.16, -0.1, 0], 0.004, 0.004, 4, true), BRONZE, 0.8, 0.4)];
      for (const s of [-1, 1]) { const f = s > 0 ? up : dn;
        for (const dz of [-0.03, 0.03]) g.push(paint(rod([0.16 * s, -0.1, 0], [0.16 * s + 0.03 * Math.sign(dz) * 0, -0.26, dz], 0.0015, 0.0015, 3), CORD, 0, 0.9, f));
        g.push(paint(new THREE.LatheGeometry([[0, 0], [0.04, 0.004], [0.058, 0.02], [0.056, 0.022]].map(([x, y]) => new THREE.Vector2(x, y)), 9).translate(0.16 * s, -0.285, 0), BRONZE, 0.8, 0.4, f)); }
      return merge(g); }
    case 'seal_cyl': return paint(new THREE.CylinderGeometry(0.009, 0.009, 0.032, 7).rotateZ(Math.PI / 2), [0.28, 0.33, 0.52], 0.1, 0.35); // (lapis-coloured stone, C)
    case 'drill_bow': { const g: THREE.BufferGeometry[] = []; const n = 5; for (let i = 0; i < n; i++) { const a0 = i / n, a1 = (i + 1) / n, y = (a: number) => 0.05 * Math.sin(Math.PI * a);
        g.push(paint(rod([0, y(a0), a0 * 0.46 - 0.02], [0, y(a1), a1 * 0.46 - 0.02], 0.008, 0.008, 4), WOOD_D, 0, 0.7)); }
      g.push(paint(rod([0, 0, -0.02], [0, 0, 0.44], 0.002, 0.002, 3), [0.5, 0.36, 0.22], 0, 0.9)); return merge(g); }
    case 'scraper': return merge([paint(box(0.26, 0.05, 0.006, 0, -0.03, 0.03), IRON, 0.6, 0.5), paint(rod([-0.15, -0.05, 0.02], [-0.15, 0.06, 0], 0.014, 0.014, 5), WOOD, 0, 0.7), paint(rod([0.15, -0.05, 0.02], [0.15, 0.06, 0], 0.014, 0.014, 5), WOOD, 0, 0.7)]);
    case 'pestle': return merge([paint(rod([0, 0, -0.62], [0, 0, 0.5], 0.03, 0.032, 6), WOOD, 0, 0.75), paint(rod([0, 0, 0.5], [0, 0, 0.66], 0.032, 0.045, 6, true), WOOD_D, 0, 0.8)]);
    default: return null;
  }
}
/** the carried child's skin (sRGB; linear ≈ babes.ts BABE_SKIN) and cloth (C) */
const BABE_SKIN_S: RGB = [0.63, 0.48, 0.4], BABE_CLOTH: RGB = [0.78, 0.74, 0.66], BABE_HAIR: RGB = [0.14, 0.1, 0.08], SLING: RGB = [0.56, 0.46, 0.36];
/** the child (reference 0.7 m sitting astride: a tunic, bare legs and arms) or the swaddled baby (reference 0.55 m) */
function babeG(wrapped: boolean): THREE.BufferGeometry {
  const skin = (g: THREE.BufferGeometry) => paint(g, BABE_SKIN_S, -1, 0.7);
  if (wrapped) return merge([paint(new THREE.SphereGeometry(1, 6, 4).scale(0.075, 0.2, 0.068).translate(0, 0.2, 0), BABE_CLOTH, 0, 0.95), skin(new THREE.SphereGeometry(0.052, 6, 4).translate(0, 0.44, 0.012)),
    paint(new THREE.SphereGeometry(0.058, 6, 3, 0, Math.PI * 2, 0, Math.PI * 0.55).rotateX(-0.5).translate(0, 0.445, -0.006), BABE_CLOTH, 0, 0.95)]);
  const g = [paint(new THREE.SphereGeometry(1, 6, 4).scale(0.08, 0.12, 0.065).translate(0, 0.13, 0), BABE_CLOTH, 0, 0.95), skin(new THREE.SphereGeometry(0.068, 6, 4).translate(0, 0.315, 0.01)),
    paint(new THREE.SphereGeometry(0.071, 6, 3, 0, Math.PI * 2, 0, Math.PI * 0.45).rotateX(-0.35).translate(0, 0.318, 0), BABE_HAIR, 0, 0.8)];
  for (const s of [1, -1]) g.push(skin(rod([0.045 * s, 0.035, 0.02], [0.1 * s, 0.01, 0.13], 0.03, 0.026, 4)), skin(rod([0.1 * s, 0.01, 0.13], [0.09 * s, -0.1, 0.15], 0.024, 0.02, 4)),
    skin(rod([0.078 * s, 0.2, 0], [0.1 * s, 0.12, 0.06], 0.02, 0.018, 3)), skin(rod([0.1 * s, 0.12, 0.06], [0.06 * s, 0.1, 0.12], 0.017, 0.015, 3)));
  return merge(g);
}
/** the sling: a cloth band round the child and two ends knotted over the carer's shoulders (C) */
function slingG(wrapped: boolean): THREE.BufferGeometry {
  const y = wrapped ? 0.2 : 0.11, top = wrapped ? 0.36 : 0.24, r = wrapped ? 0.088 : 0.098;
  const g = [paint(new THREE.CylinderGeometry(r, r, 0.18, 8, 1, true).scale(1, 1, 0.85).translate(0, y, 0), SLING, 0, 1)];
  for (const s of [1, -1]) g.push(paint(rod([0.07 * s, top, -0.03], [0.16 * s, top + 0.22, 0.2], 0.014, 0.012, 3), SLING, 0, 1));
  return merge(g);
}
export const PROP_KINDS = ['spear', 'sack', 'jar', 'tablet', 'mallet', 'basket'] as const;

/** how a prop is held: legacy (the Phase 3 placements), one hand (axis toward the cycle's tip or along the fist),
 *  two hands (the axis threads rear → front grip), mid (between the palms), hang (below the hand, turning), hip, palm,
 *  at (placed by the cycle), bow, arrow */
type Rule = 'legacy' | 'one' | 'two' | 'mid' | 'hang' | 'hip' | 'palm' | 'at' | 'bow' | 'arrow' | 'inst' | 'mouth' | 'toss' | 'dangle';
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
  // instruments (D-200)
  harp_v: { geom: 'harp_v', rule: 'inst' }, harp_h: { geom: 'harp_h', rule: 'inst' }, lyre: { geom: 'lyre', rule: 'inst' }, frame_drum: { geom: 'frame_drum', rule: 'inst' },
  plectrum: { geom: 'plectrum', rule: 'one', hand: 'r', roll: 'up' }, double_pipe: { geom: 'double_pipe', rule: 'mouth' }, reed_pipe: { geom: 'reed_pipe', rule: 'mouth' },
  sceptre: { geom: 'sceptre', rule: 'one', hand: 'r', roll: 'up', up: 1 }, lotus: { geom: 'lotus', rule: 'one', hand: 'l', roll: 'up', up: 1 },
  parasol: { geom: 'parasol', rule: 'one', hand: 'r', roll: 'up', up: 1 }, whisk: { geom: 'whisk', rule: 'one', hand: 'r', roll: 'up', up: 1 }, towel: { geom: 'towel', rule: 'one', hand: 'l', roll: 'down' },
  // D-215: the gilded spear butts, the children's toys
  spear_apple: { geom: 'spear_apple', rule: 'legacy', grip: [0.15, 1] }, spear_gpom: { geom: 'spear_gpom', rule: 'legacy', grip: [0.15, 1] },
  ball: { geom: 'ball', rule: 'toss' }, toy_bow: { geom: 'toy_bow', rule: 'bow', hand: 'l' }, rattle: { geom: 'rattle', rule: 'one', hand: 'r', roll: 'up' },
  // D-209: the magus's barsom, upright in the right fist
  barsom: { geom: 'barsom', rule: 'one', hand: 'r', roll: 'up', up: 1 },
  // D-221: the scribes' stylus and pen in the right hand, the leather on the left palm
  stylus: { geom: 'stylus', rule: 'one', hand: 'r', roll: 'up' }, pen: { geom: 'pen', rule: 'one', hand: 'r', roll: 'up' }, leather: { geom: 'leather', rule: 'palm', hand: 'l' },
  // D-255: the crafts' and the records' tools (a balance hangs upright from the hand: rule 'dangle')
  hammer: { geom: 'hammer', rule: 'one', hand: 'r', roll: 'up' }, tongs: { geom: 'tongs', rule: 'one', hand: 'l', roll: 'up' }, hammer_s: { geom: 'hammer_s', rule: 'one', hand: 'r', roll: 'up' },
  punch: { geom: 'punch', rule: 'one', hand: 'l', roll: 'up' }, balance: { geom: 'balance', rule: 'dangle', hand: 'l' }, seal_cyl: { geom: 'seal_cyl', rule: 'one', hand: 'r', roll: 'up' },
  drill_bow: { geom: 'drill_bow', rule: 'one', hand: 'r', roll: 'up' }, scraper: { geom: 'scraper', rule: 'mid' }, pestle: { geom: 'pestle', rule: 'two', front: 'r', roll: 'up' },
};
/** the two carried-prop meshes: small objects (with the Phase 3 set) and long tools. Every kind of a class is in one union */
export const PROP_CLASSES: string[][] = [
  ['spear', 'sack', 'jar', 'tablet', 'mallet', 'basket', 'sickle', 'spindle', 'distaff', 'trowel', 'brick', 'knife', 'cloth', 'wisp', 'bowl', 'rag', 'awl', 'arrow', 'lead', 'ladle', 'stick',
    // (D-209: the magus's barsom, 12 triangles: the long tools' union is at its 700)
    'barsom',
    // (D-221: the scribes' stylus, 6 triangles, paid for by the phiale's twelfth side)
    'stylus'],
  // (D-199: the king's and his attendants' things join the long tools' union: the small objects' is at its budget)
  ['hoe', 'fork', 'goad', 'staff', 'broom', 'mould', 'rope', 'adze', 'bow', 'beater', 'paddle', 'sceptre', 'parasol', 'lotus', 'whisk', 'towel',
    // (D-215: the children's toys, small, in the long tools' union: the small objects' is full)
    'ball', 'toy_bow', 'rattle'],
  // instruments (D-200): a class of their own, so the everyday props do not carry the harps' strings (one more draw only
  // where someone plays)
  ['harp_v', 'harp_h', 'lyre', 'frame_drum', 'double_pipe', 'reed_pipe', 'plectrum',
    // (D-215: the royal spearmen's gilded spears, court setting only: the court's things, drawn where the court is)
    'spear_apple', 'spear_gpom',
    // (D-221: the Aramaic secretary's pen and leather, drawn only in the Treasury's scribes' room: the everyday unions are full)
    'pen', 'leather'],
  // D-215: the carried children (a class of their own: one draw more only where a child is carried; the skin tinted per
  // instance by the carer's tone)
  ['babe', 'babe_wrapped', 'babe_sling', 'babe_wrapped_sling', 'babe_mat', 'babe_cradle'],
  // D-255: the crafts' and the records' tools (a class of their own: one draw more only where a craft is worked in view)
  ['hammer', 'tongs', 'hammer_s', 'punch', 'balance', 'seal_cyl', 'drill_bow', 'scraper', 'pestle'],
];
/** the class of the carried children (crowd.ts tints its skin) */
export const BABE_CLASS = 3;
/** class and index in the class of a prop kind */
export function propSlot(kind: string): [number, number] | null {
  const g = PROPS[kind]?.geom ?? kind; for (let c = 0; c < PROP_CLASSES.length; c++) { const i = PROP_CLASSES[c].indexOf(g); if (i >= 0) return [c, i]; } return null;
}
/** the kinds of a class in one geometry, with the kind's index per vertex ('pk'); an instance shows the kind whose index
 *  it carries ('ik') and the other kinds' vertices collapse to a point */
export function propUnionGeometry(cls = 0): THREE.BufferGeometry {
  const g = mergeGeometries(PROP_CLASSES[cls].map((k, i) => { let g = propGeometry(k)!.clone(); if (!g.getAttribute('sv')) g = withSv(g); const n = g.getAttribute('position').count;
    g.setAttribute('pk', new THREE.BufferAttribute(new Float32Array(n).fill(i), 1)); return g; }))!;
  interleave(g, ['color', 'mr', 'sv', 'pk', 'ak']); return g;
}
/** packs named float attributes into one interleaved buffer under the same names. WebGPU allows 8 vertex buffers per
 *  pipeline; an instanced mesh with one buffer per attribute (the carried props, the animals) exceeds it and its
 *  pipeline fails. `instanced`: a per-instance buffer (attributes of `count` instances, zero-filled) */
export function interleave(g: THREE.BufferGeometry, names: string[], instanced?: { count: number; sizes: number[] }): THREE.InterleavedBuffer {
  const sizes = instanced ? instanced.sizes : names.map(n => g.getAttribute(n).itemSize), n = instanced ? instanced.count : g.getAttribute(names[0]).count;
  const stride = sizes.reduce((a, b) => a + b, 0), arr = new Float32Array(n * stride);
  const buf = instanced ? new THREE.InstancedInterleavedBuffer(arr, stride) : new THREE.InterleavedBuffer(arr, stride);
  let off = 0;
  names.forEach((name, j) => { const a = instanced ? null : g.getAttribute(name);
    if (a) for (let i = 0; i < n; i++) for (let k = 0; k < sizes[j]; k++) arr[i * stride + off + k] = a.getComponent(i, k);
    g.setAttribute(name, new THREE.InterleavedBufferAttribute(buf, sizes[j], off)); off += sizes[j]; });
  return buf;
}
function withSv(g: THREE.BufferGeometry) { g.setAttribute('sv', new THREE.BufferAttribute(new Float32Array(g.getAttribute('position').count * 3), 3)); return g; }
/** D-325: a modelled prop fitted to a box (w, h, d; base on y = 0), all its parts painted in one colour as `kind`; null when
 *  the model is not loaded */
export function paintedModel(id: string, w: number, h: number, d: number, rgb: [number, number, number], rough: number, kind: string, lod = 1): THREE.BufferGeometry | null {
  const p = modelFit(id, [w, h, d], lod); return p ? paintAs(kind, mergedModel(p), rgb, 0, rough) : null;
}
/** a box painted for the prop material (work objects) */
export function paintedBox(w: number, h: number, d: number, rgb: [number, number, number], rough: number) { return paint(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), rgb, 0, rough); }
export { paint as paintGeometry, rod as rodGeometry };

// ------------------------------------------------------------------------------------------------ placement
/** the solved rig in character space (RigSolver.wt / wr: bone heads and world rotations, before the root and scale) */
export interface RigView { wt: ArrayLike<number>; wr: ArrayLike<number> }
const V = THREE.Vector3;
const bone = (R: RigView, b: number) => new V(R.wt[b * 3], R.wt[b * 3 + 1], R.wt[b * 3 + 2]);
const axis = (R: RigView, b: number, x: number, y: number, z: number) => { const w = R.wr, o = b * 9; return new V(w[o] * x + w[o + 1] * y + w[o + 2] * z, w[o + 3] * x + w[o + 4] * y + w[o + 5] * z, w[o + 6] * x + w[o + 7] * y + w[o + 8] * z); };
/** the jar borne on the shoulder (D-217, all C): the jar's size (× `scale`: 0.33–0.42 m tall, 0.23–0.29 m across the belly)
 *  the one whose neck the carrier's raised hand reaches, its base on the top of the right shoulder (`lift` above the shoulder joint, `medial` toward the neck, reference
 *  body; the flesh of the shoulder's top over the variants, tools/dev/jar_probe.ts), its axis to the raised hand's grip.
 *  Before (legacy rule): hung 0.45 m below the raised palm, it stood beside the head at head height with the hand and
 *  forearm inside it (rubric s7 pass 2, R1) */
export const SHOULDER_JAR = { scale: [0.72, 0.92] as [number, number], lift: 0.09, medial: 0.005, palm: 0.085 };
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
      const k = kind === 'bread' ? 'basket' : kind.startsWith('spear') ? 'spear' : kind; let pos: THREE.Vector3; let rot = new THREE.Matrix4(); let sc = 1;
      switch (k) {
        case 'spear': { const h = palm0(R, 'r'); pos = new V(h.x, 0, h.z).multiplyScalar(s); pos.y = 0; break; } // upright, butt on the ground by the right hand
        case 'sack': { pos = bone(R, HB.upperarm_r).multiplyScalar(s).add(new V(0.02, 0.13, -0.02)); rot.makeRotationZ(0.3); break; }
        case 'jar': {
          if (po.shoulder) { // borne on the right shoulder (D-217): the base on the shoulder's top, the axis to the raised hand, which holds the neck
            const base = bone(R, HB.upperarm_r).add(new V(SHOULDER_JAR.medial, SHOULDER_JAR.lift, 0)).multiplyScalar(s);
            const y = gripPoint(R, 'r').add(palmNormal(R, 'r').multiplyScalar(SHOULDER_JAR.palm)).multiplyScalar(s).sub(base), reach = y.length();
            if (reach < 1e-3) y.set(0, 1, 0); y.normalize();
            // the jar whose rim his hand reaches (the lip at 0.46 of the jar's height, the neck below it)
            const k = Math.min(SHOULDER_JAR.scale[1], Math.max(SHOULDER_JAR.scale[0], reach / 0.46));
            const x = new V(0, 0, 1).cross(y); if (x.lengthSq() < 1e-6) x.set(1, 0, 0); x.normalize(); const z = new V().crossVectors(x, y);
            out.makeBasis(x.multiplyScalar(k), y.multiplyScalar(k), z.multiplyScalar(k)).setPosition(base); return true;
          }
          pos = palm0(R, 'r').multiplyScalar(s).add(new V(0, -0.45, 0.08)); break; }
        // on a head pad on the crown (D-187): the crown stands 0.132–0.158 m above the head bone over the body variants
        // (humans.json; 0.145 × scale taken), the pad ~2 cm (C); along the head's own up axis, so the jar tilts with the
        // head. Before: 0.25 m straight up from the bone, which left the jar floating 9–12 cm above the crown
        case 'jar_head': { pos = bone(R, HB.head).multiplyScalar(s).add(axis(R, HB.head, 0, 1, 0).multiplyScalar(0.145 * s + 0.02)); sc = 0.8; break; }
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
    case 'toss': { // D-215: a ball between the palms, thrown up by the cycle's second parameter (m above the hands)
      const m = gripPoint(R, 'l').add(gripPoint(R, 'r')).multiplyScalar(0.5 * s); m.y += po.aux ?? 0; out.makeTranslation(m.x, m.y, m.z); return true; }
    case 'hang': { const g = gripPoint(R, P.hand ?? 'r').multiplyScalar(s); out.makeRotationY((time * 21) % (2 * Math.PI)).setPosition(g); if (param) param.v = po.aux ?? 0.4; return true; }
    // D-255: hung upright from the hand, square to the body (the balance: its beam across, the pans rocked by the pose's ip)
    case 'dangle': { const g = gripPoint(R, P.hand ?? 'l').multiplyScalar(s); out.makeTranslation(g.x, g.y, g.z); if (param) param.v = po.ip ?? 0; return true; }
    case 'hip': { const g = gripPoint(R, 'l').multiplyScalar(s).add(new V(0.03, -0.1, 0)); out.makeRotationZ(0.15).setPosition(g); return true; }
    case 'at': { const a = po.at; if (!a) return false; out.makeRotationY(a[3]).setPosition(a[0] * s, a[1] * s, a[2] * s); return true; }
    case 'inst': { const f = po.inst; if (!f) return false; // the cycle frames the instrument (reference-body units, scaled)
      frame(new V(f[0][0] * s, f[0][1] * s, f[0][2] * s), new V(...f[1]), new V(...f[2]), out); return true; }
    case 'mouth': { // at the lips on the solved head; along the line to the hands' midpoint (the fingers are on the pipe)
      const m = bone(R, HB.head).add(axis(R, HB.head, MOUTH[0], MOUTH[1], MOUTH[2])).multiplyScalar(s);
      const h = gripPoint(R, 'l').add(gripPoint(R, 'r')).multiplyScalar(0.5 * s), z = h.sub(m); if (z.lengthSq() < 1e-6) z.set(0, -0.7, 0.7);
      frame(m, z, new V(0, 1, 0), out); return true; }
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
