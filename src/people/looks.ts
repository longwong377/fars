// What each person looks like (D-092): body variant and stature, skin and hair, garment colours, which optional pieces
// they wear (headgear, beard, weapons), grime from their work. Deterministic from the person's seed, so a person looks
// the same every time they are attached to the crowd pool. Every choice carries its tier; the dev overlay (F3) prints
// the summary. Body variants are drawn from one range for everyone (C). Skin tone means shift with origin along the
// modern regional cline, with wide overlap (D-155, C, Q-240): the brief asks for the physical variety of a cosmopolitan
// centre, and no ancient evidence ties a colour to a people (the reliefs are painted by convention).
import { Rng } from '../core/rng';
import type { HumanAssets } from './humanAssets';
import { COSTUMES, pieceBit, PIECES, type Dress } from './outfits';
import { packLookBits } from './humanFormat';

type RGB = [number, number, number];
const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const L = (r: number, g: number, b: number): RGB => [lin(r), lin(g), lin(b)];

/** dyed and undyed textiles (sRGB, C unless stated): madder red, woad/indigo blue, weld yellow, undyed wool, linen, brown,
 *  murex/kermes purple (costly), green (weld over woad), turquoise and yellow-brown from the Susa guard robes (B) */
export const TEXTILE: Record<string, { c: RGB; tier: 'B' | 'C'; note: string }> = {
  madder: { c: L(0.55, 0.15, 0.1), tier: 'B', note: 'red: royal robe red or purple (IR-CLOTH); madder dye C' },
  purple: { c: L(0.36, 0.13, 0.28), tier: 'B', note: 'purple robe/kandys (IR-CLOTH, IR-CAND); on officials C' },
  woad: { c: L(0.17, 0.22, 0.42), tier: 'C', note: 'woad/indigo blue (NOT SEEN)' },
  weld: { c: L(0.74, 0.6, 0.24), tier: 'C', note: 'weld yellow (NOT SEEN)' },
  green: { c: L(0.3, 0.38, 0.22), tier: 'C', note: 'green (weld over woad, NOT SEEN)' },
  wool: { c: L(0.72, 0.66, 0.55), tier: 'C', note: 'undyed wool' },
  linen: { c: L(0.83, 0.8, 0.72), tier: 'C', note: 'undyed linen' },
  brown: { c: L(0.42, 0.31, 0.22), tier: 'C', note: 'brown (undyed dark wool or walnut dye)' },
  grey: { c: L(0.5, 0.48, 0.44), tier: 'C', note: 'grey-brown undyed wool' },
  turquoise: { c: L(0.24, 0.52, 0.5), tier: 'B', note: 'turquoise of the Susa guard robes (SUSA-ARCH)' },
  ochre: { c: L(0.66, 0.5, 0.26), tier: 'B', note: 'yellow of the Susa guard robes (SUSA-ARCH)' },
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
  Syrian: 0.44, Babylonian: 0.46, Elamite: 0.48, Egyptian: 0.62 };
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
  dress: Dress; variant: number; variantId: string; scale: number; stature: number;
  mask: number; pieces: string[]; pattern: number; grime: number; grimeLevel: number; stubble: number;
  col: { skin: RGB; main: RGB; second: RGB; trim: RGB; hair: RGB; leather: RGB; felt: RGB };
  /** overlay summary: pieces with tiers, colour choices */
  note: string;
}
export interface LookInput { id: number; sex: 'm' | 'f'; role: string; dress: Dress; origin?: string; seed: number; age?: 'adult' | 'elder' | 'child' }

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
  const dress = p.dress, child = dress === 'child' || p.role === 'child', sex = p.sex;
  const group: 'adult' | 'elder' | 'child' = child ? 'child' : p.age ?? (['official', 'scribe', 'foreman'].includes(p.role) && rng.chance(0.35) ? 'elder' : 'adult');
  const S = STATURE[sex];
  const stature = child ? 0 : Math.max(S.mean - 2.2 * S.sd, Math.min(S.mean + 2.2 * S.sd, S.mean + S.sd * rng.normal()));
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
    case 'persian': mainK = rng.chance(0.08) ? 'purple' : pick(['madder', 'madder', 'woad', 'weld', 'linen', 'wool']); secondK = pick(['wool', 'linen']); trimK = pick(['weld', 'woad', 'madder']); break;
    case 'guard': if (rng.chance(0.6)) { pattern = 1; mainK = pick(['ochre', 'brown', 'linen']); trimK = pick(['turquoise', 'ochre', 'brown'].filter(k => k !== mainK)); } else { mainK = pick(['madder', 'woad', 'weld']); trimK = pick(['weld', 'woad']); } secondK = 'wool'; break;
    case 'median': mainK = pick(['madder', 'woad', 'green', 'weld', 'brown']); secondK = pick(['brown', 'woad', 'madder', 'wool', 'grey']); trimK = pick(['purple', 'madder', 'woad', 'brown', 'purple']); break; // trim also colours the kandys (often purple, B)
    case 'woman': mainK = pick(['madder', 'woad', 'wool', 'weld', 'brown', 'linen']); secondK = pick(['linen', 'wool', 'woad', 'madder', 'grey']); trimK = pick(['weld', 'madder', 'woad']); break;
    case 'child': mainK = pick(['wool', 'linen', 'brown']); secondK = 'wool'; trimK = 'brown'; break;
    default: mainK = pick(['wool', 'linen', 'brown', 'grey', 'wool']); secondK = pick(['brown', 'wool', 'grey']); trimK = pick(['brown', 'wool', 'madder']); break;
  }
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
  }
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
  const court = dress === 'persian' || dress === 'guard' || dress === 'median';
  const hairStyle = on.has('hair_bob') ? 2 : court ? 1 : 0;
  const beardDensity = dress === 'worker' && hasBeard ? rng.int(0, 2) : 0;
  const lookBits = packLookBits({ motif: pattern, hairStyle, iris, wearsHair: on.has('hair') || on.has('hair_bob') ? 1 : 0,
    linen: (mainK === 'linen' ? 1 : 0) + (secondK === 'linen' ? 2 : 0) + (trimK === 'linen' ? 4 : 0), age: Math.floor(v.meta.ageYears / 10), beard: beardDensity, grimeZone: GRIME_ZONE[p.role] ?? 0 });
  const tiers = pieces.map(id => `${id} ${PIECES[id]?.tier ?? 'C'}`).join(', ');
  const note = `body ${v.meta.id} (variant, C) × ${scale.toFixed(3)} → ${(v.height * scale).toFixed(2)} m (stature C, Q-066); ${tiers}; colours main ${mainK} (${TEXTILE[mainK].tier}), second ${secondK}, trim ${trimK}${pattern ? ', Susa-style rosettes (B)' : ''}; skin tone p ${toneP.toFixed(2)} for ${origin} (C, Q-240), hair ${['natural curls', 'court rows of curls', 'straight'][hairStyle]} (C), iris ${iris}; grime ${grimeWhat} (C)`;
  return { dress, variant: v.index, variantId: v.meta.id, scale, stature: v.height * scale, mask, pieces, pattern: lookBits, grime, grimeLevel, stubble, col, note };
}
