// What each person looks like (D-092): body variant and stature, skin and hair, garment colours, which optional pieces
// they wear (headgear, beard, weapons), grime from their work. Deterministic from the person's seed, so a person looks
// the same every time they are attached to the crowd pool. Every choice carries its tier; the dev overlay (F3) prints
// the summary. Body variants are drawn from one range for everyone (C). Skin tone means shift with origin along the
// modern regional cline, with wide overlap (D-155, C, Q-240): the brief asks for the physical variety of a cosmopolitan
// centre, and no ancient evidence ties a colour to a people (the reliefs are painted by convention).
import { Rng } from '../core/rng';
import type { HumanAssets } from './humanAssets';
import { COSTUMES, pieceBit, PIECES, type Dress } from './outfits';
import { packLookBits, LOOK_BITS } from './humanFormat';
import delegationsData from '../data/delegations.json';

type RGB = [number, number, number];
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const L = (r: number, g: number, b: number): RGB => [lin(r), lin(g), lin(b)];

/** CIELAB (D65) → linear sRGB (clamped at 0) */
export function labToLinear(Ls: number, a: number, b: number): RGB {
  const fy = (Ls + 16) / 116, fx = fy + a / 500, fz = fy - b / 200, f = (t: number) => (t ** 3 > 0.008856 ? t ** 3 : (t - 16 / 116) / 7.787);
  const X = 0.95047 * f(fx), Y = f(fy), Z = 1.08883 * f(fz);
  return [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z].map(v => Math.max(0, v)) as RGB;
}
type Lab = [number, number, number];
/** Textiles by dye (D-189; C for every number unless stated). Each dye has a CIELAB colour for a strong and a weak dyeing
 *  on wool (for undyed wool and linen: clean/bleached and dingy/unbleached), and a fading susceptibility in light (0 fast
 *  … 1 fugitive). A person's garment lies between the two by the dye strength their rank affords, then fades toward the
 *  sun-bleached undyed ground (FADED) by the garment's age × the dye's susceptibility, with a small value jitter.
 *  - Which dyes: madder, insect red (kermes), indigo (woad) and yellows form the Iron Age working palette; madder and
 *    indigotin are identified by chromatography on the Pazyryk textiles of c. 400 BCE (Sci. Rep. 11, 2021, search extract:
 *    B for their availability in the Achaemenid world; that paper places the Pazyryk carpet's insect red in the steppe,
 *    not the Iranian plateau). MATERIAL_CULTURE "Dyes" (madder, indigo or woad, kermes, murex purple) is NS (C).
 *  - The colours: madder with alum on wool measures about a* 31, b* 29 (search extract of a colorimetric study, C for its
 *    use here); the others are typical values for natural dyes on wool (reviewer and dyer knowledge, C, Q-360). Strong
 *    madder is a brick red, not a pure red; woad a mid blue; weld a greenish yellow that fades fast (flavonoids are
 *    fugitive in light), indigo is the fastest. The first palette (D-092) rendered as saturated primaries (rubric s6
 *    pass 1: sRGB saturation p50 0.85 red, 0.88 blue in court-assembly).
 *  - Red or purple for the royal robe and the kandys (IR-CLOTH, IR-CAND: B); the Susa guard robes' turquoise and ochre
 *    (SUSA-ARCH: B for the glazed-brick colours, C for cloth). */
export const DYES: Record<string, { strong: Lab; weak: Lab; fade: number; tier: 'B' | 'C'; note: string }> = {
  madder: { strong: [40, 38, 28], weak: [52, 28, 26], fade: 0.5, tier: 'B', note: 'red: royal robe red or purple (IR-CLOTH); madder on wool (Pazyryk, B) with alum, colour C' },
  kermes: { strong: [34, 42, 16], weak: [48, 32, 14], fade: 0.45, tier: 'C', note: 'insect red, costlier than madder (MATERIAL_CULTURE NS, C)' },
  purple: { strong: [31, 20, -12], weak: [46, 15, -8], fade: 0.4, tier: 'B', note: 'purple robe/kandys (IR-CLOTH, IR-CAND); murex or red over indigo C' },
  woad: { strong: [34, -3, -21], weak: [50, -6, -16], fade: 0.3, tier: 'C', note: 'woad/indigo blue (indigotin at Pazyryk, B; colour C)' },
  weld: { strong: [70, 0, 50], weak: [76, -2, 36], fade: 0.9, tier: 'C', note: 'weld yellow (NOT SEEN; fugitive)' },
  green: { strong: [45, -17, 18], weak: [60, -11, 15], fade: 0.7, tier: 'C', note: 'green (weld over woad, NOT SEEN; the yellow fades first)' },
  wool: { strong: [74, 1, 12], weak: [60, 2, 10], fade: 0.1, tier: 'C', note: 'undyed wool, clean cream to worn and dingy' },
  linen: { strong: [81, 0, 7], weak: [66, 1, 10], fade: 0.1, tier: 'C', note: 'linen, bleached to unbleached and worn' },
  // D-206: the dark end of undyed brown wool, greyer than a tan (the tan it was, [36-50, 6-7, 16-17], is the colour of
  // skin: ΔE*ab under 12 against the wearer's skin for a fifth of the working men's garments; C, Q-360)
  brown: { strong: [30, 4, 9], weak: [43, 4, 10], fade: 0.2, tier: 'C', note: 'brown (undyed dark wool, greyish; a tannin tan would read as skin)' },
  grey: { strong: [54, 1, 5], weak: [62, 1, 6], fade: 0.1, tier: 'C', note: 'grey-brown undyed wool' },
  turquoise: { strong: [52, -22, -8], weak: [62, -16, -6], fade: 0.5, tier: 'B', note: 'turquoise of the Susa guard robes (SUSA-ARCH)' },
  ochre: { strong: [60, 9, 38], weak: [68, 6, 28], fade: 0.4, tier: 'B', note: 'yellow of the Susa guard robes (SUSA-ARCH)' },
};
/** the sun-bleached undyed ground a dye fades toward (C) */
export const FADED: Lab = [70, 2, 12];
/** a garment's colour: dye strength s (0 weak … 1 strong), fading f (0 new … 1 old, × the dye's susceptibility), value
 *  jitter dL (L* units) and chroma factor dC (one dye bath is not another) */
export function dyeColour(key: string, s: number, f: number, dL = 0, dC = 1): RGB {
  const D = DYES[key], t = Math.max(0, Math.min(1, s)), k = Math.max(0, Math.min(1, f)) * D.fade * 0.75;
  const lab = [0, 1, 2].map(i => { const c = D.weak[i] + (D.strong[i] - D.weak[i]) * t; return c + (FADED[i] - c) * k; });
  return labToLinear(lab[0] + dL, lab[1] * dC, lab[2] * dC);
}
/** mid colours per textile (linear; the dev overlay, the player's body and older callers) */
export const TEXTILE: Record<string, { c: RGB; tier: 'B' | 'C'; note: string }> = Object.fromEntries(Object.entries(DYES).map(([k, d]) => [k, { c: dyeColour(k, 0.6, 0.15), tier: d.tier, note: d.note }]));
/** the look's wear (D-189, C): garment age (fading), hem soil, fit (skirt ease at the hem, m), the hem's folds (amplitude m,
 *  phase 0..1), and each garment's fading susceptibility (main, second, trim: the dye's) */
export interface Wear { fade: number; soil: number; fit: number; foldAmp: number; foldPhase: number; k: RGB;
  /** the felt hat's height against the made one (fluted hat: ±12 %, hand-shaped felt; C) */
  hat: number }
/** dye strength, garment age and hem soil by dress (C): court dress wears stronger, newer dyes; everyone walks on dust */
const WEAR_BY: Record<string, { s: [number, number]; f: [number, number]; soil: [number, number] }> = {
  persian: { s: [0.55, 1], f: [0, 0.3], soil: [0.12, 0.3] }, guard: { s: [0.5, 0.95], f: [0.05, 0.35], soil: [0.18, 0.35] },
  // D-199: the king's robe newest and strongest; the delegations' best clothes, but after the road (C)
  king: { s: [0.9, 1], f: [0, 0.05], soil: [0.05, 0.12] }, court_woman: { s: [0.7, 1], f: [0, 0.2], soil: [0.04, 0.12] }, envoy: { s: [0.4, 0.9], f: [0.05, 0.35], soil: [0.2, 0.4] },
  envoy_short: { s: [0.4, 0.9], f: [0.05, 0.35], soil: [0.2, 0.4] }, envoy_bare: { s: [0.3, 0.8], f: [0.05, 0.4], soil: [0.2, 0.45] },
  median: { s: [0.45, 0.95], f: [0.05, 0.35], soil: [0.15, 0.35] }, woman: { s: [0.2, 0.8], f: [0.1, 0.5], soil: [0.2, 0.45] },
  worker: { s: [0, 0.55], f: [0.15, 0.7], soil: [0.3, 0.6] }, child: { s: [0, 0.5], f: [0.2, 0.7], soil: [0.35, 0.6] },
};
const LEATHER: RGB[] = [L(0.36, 0.24, 0.15), L(0.45, 0.31, 0.2), L(0.28, 0.19, 0.13), L(0.52, 0.38, 0.25)];
/** undyed felt, tan to dark brown (C; no cream or light tan: a pale fluted cylinder in sunlight read as a modern cook's hat) */
const FELT: RGB[] = [L(0.54, 0.47, 0.37), L(0.5, 0.44, 0.35), L(0.33, 0.27, 0.21), L(0.4, 0.34, 0.27)];
/** skin tones (sRGB) along a pigmentation ramp p 0 (light) … 1 (dark), D-155. The old ramp was too orange (blue/red
 *  0.47–0.6 in sRGB against ~0.65–0.7 for measured facial skin colour under daylight); the new stops keep G/R ≈ 0.76 and
 *  B/R ≈ 0.6–0.7 (C: after published facial skin colour measurements, not read in full). */
export const SKIN_RAMP: RGB[] = [[0.82, 0.66, 0.56], [0.76, 0.59, 0.49], [0.68, 0.51, 0.41], [0.58, 0.42, 0.33], [0.46, 0.32, 0.24], [0.34, 0.23, 0.17]];
/** Mean pigmentation p by origin (C, OPEN_QUESTIONS Q-240): the physical variety of a cosmopolitan centre. No skin colour
 *  of any people of the empire is attested (the reliefs are painted by convention), so the means follow the modern
 *  regional cline of skin reflectance with ultraviolet exposure (Jablonski & Chaplin 2000: darker toward the tropics),
 *  on the assumption that the regional pattern is old; the spread (sd 0.16) overlaps widely, so no origin reads as one
 *  tone. Egyptians darker on average; Anatolians, Ionians and Thracians lighter; Iranians and Mesopotamians between. */
export const ORIGIN_TONE: Record<string, number> = { Thracian: 0.2, Ionian: 0.28, Lydian: 0.3, Carian: 0.3, Lycian: 0.3, Cappadocian: 0.32, Sogdian: 0.36, Bactrian: 0.38, Median: 0.38, Persian: 0.4,
  Syrian: 0.44, Babylonian: 0.46, Elamite: 0.48, Egyptian: 0.62,
  // the court setting's delegations only (D-199; the same cline, C)
  Scythian: 0.3, Armenian: 0.34, Cilician: 0.34, Parthian: 0.4, Arian: 0.4, Sagartian: 0.4, Arachosian: 0.46, Arab: 0.52, Libyan: 0.5, Gandharan: 0.56, Indian: 0.68, Kushite: 0.84 };
export const TONE_SD = 0.16;
const rampAt = (p: number): RGB => { const f = Math.max(0, Math.min(1, p)) * (SKIN_RAMP.length - 1), i = Math.min(SKIN_RAMP.length - 2, Math.floor(f)), t = f - i;
  return [0, 1, 2].map(c => SKIN_RAMP[i][c] + (SKIN_RAMP[i + 1][c] - SKIN_RAMP[i][c]) * t) as RGB; };
/** iris colour index (humanMaterial IRIS) by origin (C): dark to light brown for nearly everyone; a small share of
 *  lighter eyes among the northern and Anatolian groups (Xenophanes fr. 16 DK calls the Thracians' gods blue-eyed and
 *  red-haired: a Greek stereotype, tier C) */
const IRIS_P: Record<string, number[]> = { default: [0.3, 0.36, 0.24, 0.1], Thracian: [0.15, 0.2, 0.2, 0.15, 0.12, 0.06, 0.07, 0.05], north: [0.25, 0.3, 0.24, 0.12, 0.06, 0.02, 0.01] };
const NORTH = new Set(['Ionian', 'Lydian', 'Carian', 'Lycian', 'Cappadocian', 'Sogdian', 'Bactrian', 'Median']);
/** hair (sRGB): black-brown to dark brown (C; the reliefs paint hair dark blue, a convention); greying with age. Measured
 *  dark hair is about 0.02–0.05 linear albedo; the first range (0.003 linear) rendered beards as flat black masks */
const HAIR: RGB[] = [[0.13, 0.1, 0.08], [0.16, 0.115, 0.085], [0.2, 0.14, 0.095], [0.24, 0.165, 0.11]];

/** statures (m) by sex, mean and sd (C: no skeletal series from Achaemenid Fars was read; values typical of Iron Age
 *  West Asian series; OPEN_QUESTIONS Q-066) */
export const STATURE = { m: { mean: 1.66, sd: 0.055 }, f: { mean: 1.54, sd: 0.05 } } as const;

export interface PersonLook {
  dress: Dress;
  /** the impostor row that stands for this dress far away (D-199: the delegations' and the king's dresses have none of
   *  their own; the nearest silhouette: the long garment the woman's, the knee tunic the Median, the bare wrap the
   *  working man's, the king the Persian robe); absent = `dress` */
  far?: Dress;
  variant: number; variantId: string; scale: number; stature: number;
  mask: number; pieces: string[]; pattern: number; grime: number; grimeLevel: number; stubble: number;
  col: { skin: RGB; main: RGB; second: RGB; trim: RGB; hair: RGB; leather: RGB; felt: RGB };
  /** fading, hem soil, fit and hem folds (D-189) */
  wear: Wear;
  /** overlay summary: pieces with tiers, colour choices */
  note: string;
}
export interface LookInput { id: number; sex: 'm' | 'f'; role: string; dress: Dress; origin?: string; seed: number; age?: 'adult' | 'elder' | 'child';
  /** D-199 (court setting): a man of one of the 23 delegations (delegations.json id): his people's dress; `dress` is
   *  then taken from it */
  delegation?: string;
  /** D-199 (court setting): the optional pieces worn, in place of the dress's own draw (the king's attendants: a fillet),
   *  no beard (the beardless attendants of the reliefs), a fixed stature (the king: fitted to the throne, anim ENTHRONED) */
  pieces?: string[]; beardless?: boolean; stature?: number }
/** the delegations of the Apadana reliefs (D-199): dress, pieces, beard, dyes and gifts per people */
export interface DelegationDef { id: string; origin: string; relief: string; dress: Dress; pieces: string[]; beard: 'long' | 'short' | 'none'; dyes: { main: string[]; second: string[]; trim: string[] }; gifts: [string, string][]; note: string }
export const DELEGATIONS: DelegationDef[] = (delegationsData as any).peoples;
export const DELEGATION_OF_ORIGIN: Record<string, DelegationDef> = Object.fromEntries(DELEGATIONS.map(d => [d.origin, d]));
/** D-215 (gap audit item 21): the share of each dress wearing ear rings (`ear`), bracelets (`brace`), the wicker shield
 *  (`shield`) and eye paint (`kohl`), by rank. The things: ring earrings on guards and nobles and bracelets (MATERIAL_CULTURE,
 *  NOT SEEN, C); "the necklaces about their necks, and the bracelets on their wrists" and the "pencillings beneath his eyes"
 *  of the Median court (Xenophon, Cyr. 1.3.2, read this session: a claim, B), the eye pencilling Cyrus's courtiers took up
 *  (Cyr. 8.1.41, B); the Persians' wicker bucklers (Herodotus 7.61, read: B). Every share is C: gold for the court (the
 *  king and the court women always), bronze for a share of the town's women; working men and children none (the workers'
 *  dress has "no ornaments": MATERIAL_CULTURE); eye paint for the court and a share of the town's women (Mesopotamian eye
 *  paint, Akkadian guḫlu: RECOLLECTION, NOT SEEN; C). Median dress: the guards' shares, else the base (scribes, couriers) */
export const JEWELS: Partial<Record<Dress, { base: { ear: number; brace: number; shield?: number; kohl?: number }; guard?: { ear: number; brace: number; shield?: number; kohl?: number } }>> = {
  persian: { base: { ear: 0.7, brace: 0.5, kohl: 0.5 } }, guard: { base: { ear: 0.6, brace: 0.25, shield: 0.35 } }, king: { base: { ear: 1, brace: 1, kohl: 1 } },
  court_woman: { base: { ear: 1, brace: 1, kohl: 1 } }, median: { base: { ear: 0.1, brace: 0.1 }, guard: { ear: 0.5, brace: 0.2 } }, woman: { base: { ear: 0.5, brace: 0.35, kohl: 0.25 } },
};
/** the impostor row of each dress (PersonLook.far) */
export const FAR_OF: Partial<Record<Dress, Dress>> = { envoy: 'woman', envoy_short: 'median', envoy_bare: 'worker', king: 'persian', court_woman: 'woman' };

function pickVariant(A: HumanAssets, rng: Rng, sex: 'm' | 'f', group: 'adult' | 'elder' | 'child', target: number) {
  let cand = A.variants.filter(v => v.meta.group === group && (group === 'child' || v.meta.sex === sex));
  if (!cand.length) cand = A.variants.filter(v => v.meta.sex === sex && v.meta.group !== 'child');
  // nearest three by standing height, one of them at random (keeps the scale close to 1)
  const near = [...cand].sort((a, b) => Math.abs(a.height - target) - Math.abs(b.height - target)).slice(0, Math.min(3, cand.length));
  return rng.pick(near);
}
/** where each trade's dirt sits besides hems and feet (LOOK_BITS grimeZone; C) */
const GRIME_ZONE: Record<string, number> = { mason: 1, grinder: 2, baker: 2, porter: 3 };
const grimeFor = (role: string): [number, number, string] => {
  switch (role) {
    case 'mason': return [0.55, 0.78, 'limestone dust on hems, feet, hands and forearms'];
    case 'porter': return [0.35, 0.5, 'dust on hems, feet, shoulders and back'];
    case 'grinder': case 'baker': return [0.4, 0.9, 'flour on the front, forearms and hems'];
    case 'child': return [0.25, 0.5, 'dust'];
    case 'guard': return [0.04, 0.5, 'dust'];
    default: return [0.08, 0.5, 'dust'];
  }
};

/** the look of one person (deterministic for a seed) */
export function lookFor(A: HumanAssets, p: LookInput, worldSeed: number): PersonLook {
  const rng = new Rng(worldSeed, `look:${p.seed}`);
  const del = p.delegation ? DELEGATIONS.find(x => x.id === p.delegation) ?? null : null;
  const dress: Dress = del ? del.dress : p.dress, child = dress === 'child' || p.role === 'child', sex = p.sex;
  const group: 'adult' | 'elder' | 'child' = child ? 'child' : p.age ?? (['official', 'scribe', 'foreman'].includes(p.role) && rng.chance(0.35) ? 'elder' : 'adult');
  const S = STATURE[sex];
  const drawn = child ? 0 : Math.max(S.mean - 2.2 * S.sd, Math.min(S.mean + 2.2 * S.sd, S.mean + S.sd * rng.normal())), stature = p.stature ?? drawn;
  const v = pickVariant(A, rng, sex, group, child ? 1.2 : stature);
  const scale = child ? rng.range(0.96, 1.04) : Math.max(0.93, Math.min(1.07, stature / v.height));
  // colours
  const T = (k: string) => TEXTILE[k].c, pick = (ks: string[]) => rng.pick(ks);
  const outdoor = ['mason', 'porter', 'guard', 'courier', 'child', 'grinder', 'baker'].includes(p.role);
  // pigmentation: one draw (the old tone pick's), mapped through a normal quantile about the origin's mean; outdoor
  // workers a little darker (sun), with the old per-channel draws
  const toneU = rng.next(), toneP = (ORIGIN_TONE[p.origin ?? 'Persian'] ?? 0.42) + TONE_SD * Math.log(Math.max(1e-6, toneU) / Math.max(1e-6, 1 - toneU)) / 1.702;
  const skinS = rampAt(toneP).map(x => x * (outdoor ? rng.range(0.9, 0.98) : 1)) as RGB;
  const elder = group === 'elder';
  const hairS = rng.pick(HAIR).map(x => x) as RGB; const grey = elder ? rng.range(0.25, 0.7) : child ? 0 : rng.chance(0.08) ? rng.range(0.05, 0.2) : 0;
  const hair = hairS.map(x => lin(x + (0.42 - x) * grey)) as RGB;
  let mainK: string, secondK: string, trimK: string, pattern = 0;
  switch (dress) {
    case 'persian': mainK = rng.chance(0.08) ? 'purple' : pick(['madder', 'madder', 'kermes', 'woad', 'weld', 'linen', 'wool']); secondK = pick(['wool', 'linen']); trimK = pick(['weld', 'woad', 'madder']); break;
    case 'guard': if (rng.chance(0.6)) { pattern = 1; mainK = pick(['ochre', 'brown', 'linen']); trimK = pick(['turquoise', 'ochre', 'brown'].filter(k => k !== mainK)); } else { mainK = pick(['madder', 'woad', 'weld']); trimK = pick(['weld', 'woad']); } secondK = 'wool'; break;
    case 'median': mainK = pick(['madder', 'woad', 'green', 'weld', 'brown']); secondK = pick(['brown', 'woad', 'madder', 'wool', 'grey']); trimK = pick(['purple', 'madder', 'woad', 'brown', 'purple']); break; // trim also colours the kandys (often purple, B)
    case 'woman': mainK = pick(['madder', 'woad', 'wool', 'weld', 'brown', 'linen']); secondK = pick(['linen', 'wool', 'woad', 'madder', 'grey']); trimK = pick(['weld', 'madder', 'woad']); break;
    case 'child': mainK = pick(['wool', 'linen', 'brown']); secondK = 'wool'; trimK = 'brown'; break;
    // D-199: the king's robe purple (or red), the colour the sources give the royal robe (IR-CLOTH, B; the dye C)
    case 'king': mainK = rng.chance(0.7) ? 'purple' : 'madder'; secondK = 'wool'; trimK = 'purple'; break;
    // D-215: the court women's robe in the court's strong dyes, the veil fine wool or linen (C)
    case 'court_woman': mainK = pick(['purple', 'madder', 'kermes', 'woad', 'madder']); secondK = pick(['linen', 'wool', 'weld', 'linen']); trimK = pick(['purple', 'weld', 'woad', 'madder']); break;
    default: mainK = pick(['wool', 'linen', 'brown', 'grey', 'wool']); secondK = pick(['brown', 'wool', 'grey']); trimK = pick(['brown', 'wool', 'madder']); break;
  }
  if (del) { mainK = pick(del.dyes.main); secondK = pick(del.dyes.second); trimK = pick(del.dyes.trim); } // D-199: the people's own palette (C)
  if (mainK === secondK && dress !== 'child') secondK = mainK === 'wool' ? 'brown' : 'wool';
  // optional pieces (C unless the piece itself is attested for the dress)
  const on = new Set<string>();
  const man = sex === 'm' && !child;
  const beardRoll = rng.next();
  if (!child || rng.chance(1)) on.add('hair');
  switch (dress) {
    case 'persian': on.add('bun'); if (man) on.add(beardRoll < 0.9 ? 'beard_long' : 'beard_short'); if (rng.chance(0.85)) on.add('hat_fluted'); if (rng.chance(0.3)) on.add('torque'); break;
    case 'guard': on.add('bun'); if (man) on.add(beardRoll < 0.85 ? 'beard_long' : 'beard_short'); on.add(rng.chance(0.7) ? 'hat_fluted' : 'fillet'); if (rng.chance(0.15)) on.add('torque'); break;
    case 'median': on.add('bun'); if (man) on.add(beardRoll < 0.8 ? 'beard_long' : 'beard_short'); on.add('cap_soft'); if (p.role === 'guard') { on.add('akinaka'); on.add('gorytos'); }
      else if (rng.chance(0.45)) on.add('kandys'); break;
    case 'worker': if (man) { const egyptian = p.origin === 'Egyptian'; if (!egyptian && beardRoll < 0.3) on.add('beard_long'); else if (!egyptian && beardRoll < 0.8) on.add('beard_short'); }
      if (rng.chance(0.4)) on.add('work_trousers'); if (rng.chance(0.6)) on.add('shoes'); const h = rng.next(); if (h < 0.3) on.add('headband'); else if (h < 0.45) on.add('cap_soft'); break;
    case 'woman': if (rng.chance(0.8)) { on.add('headcloth'); on.delete('hair'); /* hidden under it (it poked through) */ } else { on.delete('hair'); on.add('hair_bob'); } if (rng.chance(0.6)) on.add('shoes'); break;
    case 'child': if (rng.chance(0.3)) on.add('shoes'); break;
    // D-199: the king as the reliefs carve him: hair gathered at the nape, the long squared beard, the crown (always)
    case 'king': on.add('bun'); on.add('beard_long'); break;
  }
  if (p.pieces) { const beard = [...on].filter(id => id.startsWith('beard')); on.clear(); for (const id of [...p.pieces, 'hair', ...beard]) on.add(id); } // D-199
  if (p.beardless) { on.delete('beard_long'); on.delete('beard_short'); }
  // D-199: a delegate wears his people's pieces (delegations.json; B form) and its beard; nothing else of the dress's
  if (del) { on.clear(); for (const id of del.pieces) on.add(id); on.add('hair');
    if (man && del.beard !== 'none') on.add(del.beard === 'short' ? (beardRoll < 0.8 ? 'beard_short' : 'beard_long') : (beardRoll < 0.85 ? 'beard_long' : 'beard_short')); }
  let mask = 1; const pieces: string[] = [...COSTUMES[dress].always];
  for (const id of COSTUMES[dress].always) mask |= (1 << pieceBit(dress, id)) & ~1; // always worn, but a bit of the shared costume (guards' bow and quiver)
  for (const id of COSTUMES[dress].opt) if (on.has(id)) { mask |= 1 << pieceBit(dress, id); pieces.push(id); }
  const hasBeard = on.has('beard_long') || on.has('beard_short');
  // stubble: shaven men 0.5–1; a beard's wearer 2, so the skin under the beard reads as roots where the beard thins
  const stubble = man && !hasBeard ? rng.range(0.5, 1) : hasBeard ? 2 : 0;
  const [grime, grimeLevel, grimeWhat] = grimeFor(p.role);
  const col = { skin: skinS.map(lin) as RGB, main: T(mainK), second: T(secondK), trim: T(trimK), hair, leather: rng.pick(LEATHER), felt: rng.pick(FELT) };
  // D-155 look flags (new draws come last, so every earlier choice of an existing seed is unchanged)
  const origin = p.origin ?? 'Persian', ip = IRIS_P[origin] ?? (NORTH.has(origin) ? IRIS_P.north : IRIS_P.default);
  let iu = rng.next(), iris = 0; for (let k = 0; k < ip.length; k++) { if (iu < ip[k]) { iris = k; break; } iu -= ip[k]; iris = k; }
  if (origin === 'Thracian' && !elder && rng.chance(0.25)) col.hair = [0.36, 0.2, 0.12].map(lin) as RGB; // auburn (Xenophanes fr. 16, C)
  // court dressing: Persian and Median dress wear hair and beard curled in rows (the reliefs' convention: A for the
  // carving, C for real hair); working men natural; the bob straight
  const court = dress === 'persian' || dress === 'guard' || dress === 'median' || dress === 'king';
  const hairStyle = on.has('hair_bob') ? 2 : court ? 1 : 0;
  const beardDensity = dress === 'worker' && hasBeard ? rng.int(0, 2) : 0;
  const lookBits = packLookBits({ motif: pattern, hairStyle, iris, wearsHair: on.has('hair') || on.has('hair_bob') ? 1 : 0,
    linen: (mainK === 'linen' ? 1 : 0) + (secondK === 'linen' ? 2 : 0) + (trimK === 'linen' ? 4 : 0), age: Math.floor(v.meta.ageYears / 10), beard: beardDensity, grimeZone: GRIME_ZONE[p.role] ?? 0, kohl: 0 });
  // D-189 (new draws last again): dye strength by rank, garment age (fading), a value jitter per garment, hem soil, the
  // skirt's fit and hem folds, and a hair lightness spread (C); the colours above were the mid colour of each textile
  const WB = WEAR_BY[dress] ?? WEAR_BY.worker, sMain = rng.range(...WB.s), age = rng.range(...WB.f), soil = rng.range(...WB.soil);
  const garment = (k: string, s: number) => dyeColour(k, s, age, Math.max(-7, Math.min(7, 3 * rng.normal())), Math.max(0.8, Math.min(1.2, 1 + 0.1 * rng.normal())));
  col.main = garment(mainK, sMain); col.second = garment(secondK, sMain + rng.range(-0.25, 0.25)); col.trim = garment(trimK, sMain + rng.range(-0.2, 0.2));
  const wear: Wear = { fade: age, soil, fit: rng.range(-0.004, 0.022), foldAmp: rng.range(0.012, 0.026), foldPhase: rng.next(), k: [DYES[mainK].fade, DYES[secondK].fade, DYES[trimK].fade], hat: 0 };
  wear.hat = rng.range(-0.12, 0.12);
  const hl = rng.range(0.85, 1.3); col.hair = col.hair.map(x => Math.min(0.2, x * hl)) as RGB;
  // D-215 (gap audit item 21; new draws last): ornaments by rank, the guards' wicker shield and eye paint for the court
  // (the placement by rank is C; the things: JEWELS)
  const J = JEWELS[dress], free = !p.pieces && !del, add = (id: string) => { if (COSTUMES[dress].opt.includes(id) && !pieces.includes(id)) { mask |= 1 << pieceBit(dress, id); pieces.push(id); } };
  const shares = J ? (dress === 'median' ? (p.role === 'guard' ? J.guard! : J.base) : J.base) : null;
  const uE = rng.next(), uB = rng.next(), uS = rng.next(), uK = rng.next();
  if (shares && free) { if (uE < shares.ear) add(dress === 'woman' ? 'earrings_b' : 'earrings'); if (uB < shares.brace) add(dress === 'woman' ? 'bracelets_b' : 'bracelets'); if (uS < (shares.shield ?? 0)) add('shield'); }
  const kohl = shares && (free || dress === 'king') && uK < (shares.kohl ?? 0) ? 1 : 0;
  const tiers = pieces.map(id => `${id} ${PIECES[id]?.tier ?? 'C'}`).join(', ');
  const delNote = del ? `; the ${del.id} of the Apadana reliefs (relief ${del.relief}; form B, colours C: D-199)` : dress === 'king' ? '; the king as the reliefs carve him (robe, crown, beard: B; colours C: D-199)' : '';
  const note = `body ${v.meta.id} (variant, C) × ${scale.toFixed(3)} → ${(v.height * scale).toFixed(2)} m (stature C, Q-066); ${tiers}; colours main ${mainK} (${TEXTILE[mainK].tier}), second ${secondK}, trim ${trimK}, dye strength ${sMain.toFixed(2)}, age ${age.toFixed(2)}, hem soil ${soil.toFixed(2)} (C, D-189)${pattern ? ', Susa-style rosettes (B)' : ''}; skin tone p ${toneP.toFixed(2)} for ${origin} (C, Q-240), hair ${['natural curls', 'court rows of curls', 'straight'][hairStyle]} (C), iris ${iris}; grime ${grimeWhat} (C)${delNote}`;
  return { dress, ...(FAR_OF[dress] ? { far: FAR_OF[dress] } : {}), variant: v.index, variantId: v.meta.id, scale, stature: v.height * scale, mask, pieces, pattern: lookBits + kohl * 2 ** LOOK_BITS.kohl[0], grime, grimeLevel, stubble, col, wear,
    note: note + (kohl ? '; eyes lined with eye paint (the court\'s fashion: Xenophon, Cyr. 1.3.2, 8.1.41, read, a claim: B; who wears it C; D-215)' : '') };
}
/** the person row's wear texel (humanMaterial PERSON_TEXELS, texel 9): [garment age, fit (m), fold amplitude (mm) + phase
 *  (the fraction), hem soil] */
export const wearTexel = (w: Wear): [number, number, number, number] => [w.fade, w.fit, Math.round(w.foldAmp * 1000) + Math.min(0.98, Math.max(0.02, w.foldPhase)), w.soil];
