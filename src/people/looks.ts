// What each person looks like (D-027): body variant and stature, skin and hair, garment colours, which optional pieces
// they wear (headgear, beard, weapons), grime from their work. Deterministic from the person's seed, so a person looks
// the same every time they are attached to the crowd pool. Every choice carries its tier; the dev overlay (F3) prints
// the summary. Nothing here is a claim about the looks of any people of the empire: body variants and skin tones are
// drawn from one range for everyone (C), because no evidence was read that would tie them to origin.
import { Rng } from '../core/rng';
import type { HumanAssets } from './humanAssets';
import { COSTUMES, pieceBit, PIECES, type Dress } from './outfits';

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
const FELT: RGB[] = [L(0.62, 0.56, 0.45), L(0.5, 0.44, 0.35), L(0.7, 0.65, 0.55), L(0.4, 0.34, 0.27)];
/** skin tones (sRGB) — one range for everyone (C); outdoor workers a little darker (sun) */
const SKIN: RGB[] = [[0.76, 0.58, 0.46], [0.72, 0.53, 0.42], [0.66, 0.48, 0.36], [0.6, 0.43, 0.31], [0.54, 0.38, 0.27], [0.47, 0.32, 0.22]];
/** hair: near-black to dark brown (C; the reliefs paint hair dark blue, a convention); greying with age */
const HAIR: RGB[] = [[0.045, 0.035, 0.03], [0.07, 0.05, 0.035], [0.1, 0.07, 0.05], [0.13, 0.09, 0.06]];

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
const grimeFor = (role: string): [number, number, string] => {
  switch (role) {
    case 'mason': return [0.55, 0.78, 'limestone dust'];
    case 'porter': return [0.35, 0.5, 'dust'];
    case 'grinder': case 'baker': return [0.4, 0.9, 'flour'];
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
  const skinS = rng.pick(SKIN).map(x => x * (outdoor ? rng.range(0.9, 0.98) : 1)) as RGB;
  const elder = group === 'elder';
  const hairS = rng.pick(HAIR).map(x => x) as RGB; const grey = elder ? rng.range(0.25, 0.7) : child ? 0 : rng.chance(0.08) ? rng.range(0.05, 0.2) : 0;
  const hair = hairS.map(x => lin(x + (0.42 - x) * grey)) as RGB;
  let mainK: string, secondK: string, trimK: string, pattern = 0;
  switch (dress) {
    case 'persian': mainK = rng.chance(0.08) ? 'purple' : pick(['madder', 'madder', 'woad', 'weld', 'linen', 'wool']); secondK = pick(['wool', 'linen']); trimK = pick(['weld', 'woad', 'madder']); break;
    case 'guard': if (rng.chance(0.6)) { pattern = 1; mainK = pick(['ochre', 'brown', 'linen']); trimK = pick(['turquoise', 'ochre', 'brown'].filter(k => k !== mainK)); } else { mainK = pick(['madder', 'woad', 'weld']); trimK = pick(['weld', 'woad']); } secondK = 'wool'; break;
    case 'median': mainK = pick(['madder', 'woad', 'green', 'weld', 'brown']); secondK = pick(['brown', 'woad', 'madder', 'wool', 'grey']); trimK = pick(['weld', 'madder', 'woad', 'brown']); break;
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
    case 'median': on.add('bun'); if (man) on.add(beardRoll < 0.8 ? 'beard_long' : 'beard_short'); on.add('cap_soft'); if (p.role === 'guard') { on.add('akinaka'); on.add('gorytos'); } break;
    case 'worker': if (man) { const egyptian = p.origin === 'Egyptian'; if (!egyptian && beardRoll < 0.3) on.add('beard_long'); else if (!egyptian && beardRoll < 0.8) on.add('beard_short'); }
      if (rng.chance(0.4)) on.add('work_trousers'); if (rng.chance(0.6)) on.add('shoes'); const h = rng.next(); if (h < 0.3) on.add('headband'); else if (h < 0.45) on.add('cap_soft'); break;
    case 'woman': if (rng.chance(0.8)) on.add('headcloth'); else { on.delete('hair'); on.add('hair_bob'); } if (rng.chance(0.6)) on.add('shoes'); break;
    case 'child': if (rng.chance(0.3)) on.add('shoes'); break;
  }
  let mask = 1; const pieces: string[] = [...COSTUMES[dress].always];
  for (const id of COSTUMES[dress].opt) if (on.has(id)) { mask |= 1 << pieceBit(dress, id); pieces.push(id); }
  const hasBeard = on.has('beard_long') || on.has('beard_short');
  const stubble = man && !hasBeard ? rng.range(0.5, 1) : 0;
  const [grime, grimeLevel, grimeWhat] = grimeFor(p.role);
  const col = { skin: skinS.map(lin) as RGB, main: T(mainK), second: T(secondK), trim: T(trimK), hair, leather: rng.pick(LEATHER), felt: rng.pick(FELT) };
  const tiers = pieces.map(id => `${id} ${PIECES[id]?.tier ?? 'C'}`).join(', ');
  const note = `body ${v.meta.id} (variant, C) × ${scale.toFixed(3)} → ${(v.height * scale).toFixed(2)} m (stature C, Q-066); ${tiers}; colours main ${mainK} (${TEXTILE[mainK].tier}), second ${secondK}, trim ${trimK}${pattern ? ', Susa-style rosettes (B)' : ''}; skin/hair tones C; grime ${grimeWhat} (C)`;
  return { dress, variant: v.index, variantId: v.meta.id, scale, stature: v.height * scale, mask, pieces, pattern, grime, grimeLevel, stubble, col, note };
}
