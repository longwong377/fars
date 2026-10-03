// Every body different (D-363, UD-27, T-E15): a continuous shape vector per person, seeded from the person and shifted by
// their life (labour, household means, age, illness, children borne, nursing, a child carried), drawn on the body as
//   - girth per bone: each bone's flesh scaled across its axis (limbs) or in width and depth (trunk, head, jaw), folded into
//     the person's skin matrices (humanRig.ts), so the body and everything skinned over it (the garments) change together;
//   - fields in bind space (humanMaterial.ts, mirrored by bodyFieldOffset below): breasts (size, the fall with age and
//     nursing), buttocks, cheeks and jowls, and the fat belly (the D-292 dome, with the months of a child added);
//   - posture: the stoop of age and of carrying, added to the pose (humanRig.ts setPose);
//   - soft tissue (softbody.ts): springs on breasts, belly, buttocks, thighs, upper arms and jowls, driven by the motion.
// The base meshes are the 23 MakeHuman-derived variants (D-090); the vector is drawn relative to the population and the
// variant's own build (its macro weight and muscle) is subtracted, so the variant pick and the vector do not double count.
// Breadths vary about 4–6 % (one sd) of their mean in modern adult series (shoulder, hip and head breadths, face length;
// order of magnitude, C), the girths more with fat. Every number is C (reconstruction): no skeletal or anthropometric series from Achaemenid Fars was read (Q-1170); the
// spreads are modern adult anthropometry's order of magnitude (a body-fat sd about a third of its mean; breast volume
// varying several-fold), the shifts by life follow common physiology (heavy labour leaner and more muscled; plenty
// fatter; age fatter to the fifties, then wasting; illness wasting; parity widening and softening; nursing fuller).
import { Rng } from '../core/rng';
import { HB, PART, HBONES } from './humanFormat';
import type { HumanAssets, HumanVariant } from './humanAssets';

/** the life a body is drawn from (all optional: absent values come from the role, dress and age group) */
export interface BodyLife {
  /** age in years */ ageYears?: number;
  /** 0 sedentary (a scribe at his desk) … 1 heavy labour every day (porter, mason, the women at the querns) */ labour?: number;
  /** 0 the poorest ration … 1 the court's table */ wealth?: number;
  /** 0 well … 1 gravely ill or wasting today */ ill?: number;
  /** children borne (women) */ parity?: number;
  /** nursing a child now */ nursing?: boolean;
  /** months of a child carried, 0..1 (Population.gravid; the belly itself is the D-292 dome) */ gravid?: number;
}
/** the shape vector (z units of the population's spread for one sex, except beauty and firm, 0..1). Exported so the
 *  dev overlay and the variety test read the same numbers the render draws. */
export interface BodyShape {
  fat: number; muscle: number; frame: number; shoulders: number; bust: number; hips: number; belly: number; butt: number;
  posture: number; faceW: number; faceL: number; jaw: number; cheek: number; asym: number; /** the nose's size and projection */ nose: number; /** the chin's projection */ chin: number;
  /** 0 very plain … 1 very beautiful (an averageness and symmetry of the face; the quantile of a normal draw) */ beauty: number;
  /** tissue firmness 0 soft … 1 firm (age, children borne, nursing) */ firm: number;
  sex: 'm' | 'f'; child: boolean; ageYears: number;
}
export const SHAPE_KEYS = ['fat', 'muscle', 'frame', 'shoulders', 'bust', 'hips', 'belly', 'butt', 'posture', 'faceW', 'faceL', 'jaw', 'cheek', 'asym', 'nose', 'chin', 'beauty', 'firm'] as const;

/** labour by role (C) */
const LABOUR: Record<string, number> = { mason: 0.95, porter: 1, builder: 0.9, grinder: 0.8, baker: 0.65, farmer: 0.85, herder: 0.7, shepherd: 0.7, groom: 0.7, guard: 0.7,
  courier: 0.75, messenger: 0.75, weaver: 0.45, brewer: 0.6, miller: 0.8, servant: 0.6, homemaker: 0.6, craftsman: 0.6, gardener: 0.75, caretaker: 0.5,
  scribe: 0.15, official: 0.15, steward: 0.25, priest: 0.25, storekeeper: 0.35, foreman: 0.4, child: 0.35, elder: 0.25, traveller: 0.55, camp: 0.6 };
/** household means by dress (C): the court's table to the working ration */
const WEALTH: Record<string, number> = { king: 1, court_woman: 0.9, persian: 0.8, median: 0.6, guard: 0.55, envoy: 0.65, envoy_short: 0.55, envoy_bare: 0.4, woman: 0.4, worker: 0.2, child: 0.3 };
const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
/** standard normal CDF (Abramowitz–Stegun 7.1.26 through erf) */
export function phi(z: number) { const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2), y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z / 2); return z >= 0 ? (1 + y) / 2 : (1 - y) / 2; }

/** the shape of one person: deterministic for (world seed, person seed, life) */
export function shapeFor(p: { seed: number; sex: 'm' | 'f'; role: string; dress: string; age?: 'adult' | 'elder' | 'child'; life?: BodyLife }, worldSeed: number): BodyShape {
  const r = new Rng(worldSeed, `shape:${p.seed}`), u = () => clamp(r.normal(), -3.2, 3.2);
  const L = p.life ?? {}, child = p.age === 'child' || p.dress === 'child' || p.role === 'child';
  const age = L.ageYears ?? (child ? 8 + (p.seed % 5) : p.age === 'elder' ? 58 + (p.seed % 14) : 20 + (p.seed % 31));
  const labour = L.labour ?? LABOUR[p.role] ?? 0.5, wealth = L.wealth ?? WEALTH[p.dress] ?? 0.35, ill = L.ill ?? 0, parity = p.sex === 'f' ? (L.parity ?? (age > 22 ? Math.floor(((p.seed >> 3) % 7) * clamp((age - 18) / 20, 0, 1)) : 0)) : 0;
  const nursing = !!L.nursing, f = p.sex === 'f';
  // independent draws (one each, in a fixed order: adding a component later appends a draw)
  const U = { fat: u(), mus: u(), frame: u(), sh: u(), bust: u(), hips: u(), belly: u(), butt: u(), post: u(), fw: u(), fl: u(), jaw: u(), cheek: u(), asym: u(), beauty: u(), firm: u(), nose: u(), chin: u() };
  // the shifts of a life (z units)
  const midAge = clamp((age - 25) / 25, 0, 1) - clamp((age - 60) / 20, 0, 1) * 0.8; // fattening to the fifties, wasting after sixty
  const shiftFat = 1.1 * (wealth - 0.4) - 0.8 * (labour - 0.5) + 0.7 * midAge - 1.4 * ill + (f ? 0.1 * Math.min(parity, 5) : 0);
  const shiftMus = 1.2 * (labour - 0.5) - 0.9 * clamp((age - 45) / 25, 0, 1) - 1 * ill;
  const fat = 0.9 * U.fat + shiftFat, muscle = 0.85 * U.mus + shiftMus;
  const sMul = 1; // (children vary in build and face as much as adults do, for their size; C)
  const firm = clamp(0.85 + 0.08 * U.firm - 0.011 * Math.max(0, age - 22) - 0.05 * Math.min(parity, 6) - (nursing ? 0.1 : 0) + 0.08 * muscle, 0.15, 1);
  const beauty = clamp(phi(U.beauty) - 0.25 * ill, 0, 1);
  const avg = 1.35 - 0.8 * beauty; // a beautiful face is near the average and symmetric (averageness; C)
  return {
    fat: fat * sMul, muscle: muscle * sMul, frame: U.frame * sMul, shoulders: (0.75 * U.sh + 0.45 * muscle) * sMul,
    bust: child ? 0 : f ? 0.75 * U.bust + 0.55 * fat + (nursing ? 0.9 : 0) + 0.8 * (L.gravid ?? 0) : 0.6 * U.bust + 0.5 * fat,
    hips: (0.8 * U.hips + 0.3 * fat + (f ? 0.12 * Math.min(parity, 5) : 0)) * sMul,
    belly: (0.6 * U.belly + 0.75 * fat + (f ? 0.12 * Math.min(parity, 6) : 0) + 0.3 * midAge) * sMul,
    butt: (0.7 * U.butt + 0.5 * fat + 0.2 * muscle) * sMul,
    posture: child ? 0.3 * U.post : 0.6 * U.post + 1.6 * clamp((age - 45) / 30, 0, 1.2) + 0.35 * (labour - 0.5) + 0.5 * ill,
    faceW: U.fw * avg, faceL: U.fl * avg, jaw: (U.jaw * avg + (f ? -0.3 : 0.3)) * sMul + 0.25 * fat, cheek: 0.6 * U.cheek * avg + 0.6 * fat, asym: U.asym * (1.2 - beauty), nose: U.nose * avg + 0.4 * clamp((age - 30) / 40, 0, 1) - (child ? 0.8 : 0), chin: U.chin * avg,
    beauty, firm, sex: p.sex, child, ageYears: age,
  };
}

/** the variant's own build in the vector's units (MakeHuman macro 0.5 = average, ±0.12 ≈ one sd; C) */
export const variantBuild = (v: HumanVariant) => ({ fat: (v.meta.macro.weight - 0.5) / 0.12, muscle: (v.meta.macro.muscle - 0.5) / 0.12 });
/** fat's effect grows faster above the mean than it shrinks below it (the right skew of body fat; C) */
const fatEff = (z: number) => z + (z > 0 ? 0.14 * z * z : 0);

/** the region frames of a variant in bind space (cached): breasts, buttocks, cheeks (centre x for the left side, y, z, and
 *  the radius), the thighs' and upper arms' middle heights */
export interface RegionFrame { breast: [number, number, number, number]; butt: [number, number, number, number]; cheek: [number, number, number, number]; thighY: number; /** the nose tip's height and depth */ nose: [number, number];
  /** D-790: the mouth (the lips' meeting line height, the lips' front depth, the half-width at the corners) and the brows' height */ mouth: [number, number, number, number] }
const frames = new WeakMap<HumanVariant, RegionFrame>();
export function regionFrame(A: HumanAssets, v: HumanVariant): RegionFrame {
  const hit = frames.get(v); if (hit) return hit;
  const J = v.joints, j = (b: number, k: number) => J[b * 3 + k], P = v.pos;
  const f = v.meta.sex === 'f' && v.meta.group !== 'child';
  // breast: the foremost chest point at 6–13 cm from the midline, between the clavicle and the spine_02 joint
  const yTop = j(HB.clavicle_l, 1), yLow = j(HB.spine_02, 1); let bx = 0.09, by = (yTop + yLow) / 2, bz = 0.1, best = -1;
  // buttock: the hindmost pelvis point 4–13 cm from the midline, below the pelvis joint
  let tx = 0.08, ty = j(HB.pelvis, 1) - 0.06, tz = -0.1, back = 1;
  for (let i = 0; i < A.NO; i++) { const pt = A.part[i], x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
    if (pt === PART.chest && x > 0.06 && x < 0.13 && y < yTop - 0.04 && y > yLow && z > best) { best = z; bx = x; by = y; bz = z; }
    if ((pt === PART.pelvis || pt === PART.thigh_l) && x > 0.04 && x < 0.13 && y < j(HB.pelvis, 1) && y > j(HB.pelvis, 1) - 0.2 && z < back) { back = z; tx = x; ty = y; tz = z; } }
  const br = f ? 0.075 : 0.07;
  const nose = A.meta.landmarks.nose_tip, chin = A.meta.landmarks.chin;
  const ny = nose !== undefined ? P[A.orig.indexOf(nose) * 3 + 1] : j(HB.head, 1) + 0.07, nz = nose !== undefined ? P[A.orig.indexOf(nose) * 3 + 2] : j(HB.head, 2) + 0.1;
  const cy = chin !== undefined ? P[A.orig.indexOf(chin) * 3 + 1] : ny - 0.06;
  // D-790: the mouth from the mesh: the lips meet between the lowest unweighted and the highest jaw-weighted front vertex on
  // the midline below the nose; their front is the foremost point within a centimetre of that line
  let yU = Infinity, yL = -Infinity;
  for (let i = 0; i < A.NO; i++) { if (A.part[i] !== PART.head) continue; const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; if (Math.abs(x) > 0.004 || y > ny - 0.01 || y < ny - 0.075 || z < nz - 0.04) continue;
    let jw = 0; for (let k = 0; k < 4; k++) if (A.skinIndex[i * 4 + k] === HB.jaw) jw += A.skinWeight[i * 4 + k] / 255;
    if (jw < 0.1) yU = Math.min(yU, y); else if (jw > 0.5) yL = Math.max(yL, y); }
  const my = Number.isFinite(yU) && Number.isFinite(yL) ? (yU + yL) / 2 : ny - 0.045; let mz = nz - 0.02;
  for (let i = 0; i < A.NO; i++) { if (A.part[i] !== PART.head) continue; const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2]; if (Math.abs(x) < 0.012 && Math.abs(y - my) < 0.01 && z < nz - 0.004) mz = Math.max(mz, z); }
  const eyeY = (j(HB.eye_l, 1) + j(HB.eye_r, 1)) / 2, child = v.meta.group === 'child';
  const fr: RegionFrame = { breast: [bx, by, bz - 0.035, br], butt: [tx, ty, tz + 0.05, 0.1], cheek: [0.042, (ny + cy) / 2, nz - 0.045, 0.034],
    thighY: (j(HB.thigh_l, 1) + j(HB.calf_l, 1)) / 2, nose: [ny, nz], mouth: [my, mz, child ? 0.02 : f ? 0.0225 : 0.0245, eyeY + (child ? 0.022 : 0.026)] };
  frames.set(v, fr); return fr;
}

/** extra texels of the person's palette row (after the 59 bones' 177 texels): 4 virtual bones = 12 texels = 48 floats.
 *  [0] breast centre (left x, y, z, R)   [1] bust k−1, fall (m), buttocks k−1, cheeks k−1   [2] buttock centre, R
 *  [3] left breast spring (x, y, z), belly spring y   [4] right breast spring, belly spring z
 *  [5] buttock spring y, z, thigh springs l, r   [6] cheek centre, R   [7] fat belly (dome amount), upper arm springs l, r, jowl spring
 *  [8] thigh middle y, soft-tissue visibility (0 off), nose tip y, z (the cheek centre's w is the nose's k−1; the cheeks' radius is CHEEK_R)
 *  D-790 the face while speaking and listening (face.ts; humanRig writes [10] and [11] each solve):
 *  [9] mouth line y, lips' front z, mouth half-width, brow y   [10] round, wide, press, tuck   [11] smile, brow up, knit, face on (1) */
/** the cheeks' and the nose's field radii (m, C) */
export const CHEEK_R = 0.034, NOSE_R = 0.03;
export const EXTRA_BONES = 4, EXTRA_FLOATS = EXTRA_BONES * 12;
export const EX = { breastC: 0, k: 4, buttC: 8, sprBL: 12, sprBR: 16, spr5: 20, cheekC: 24, ex7: 28, ex8: 32, mouth: 36, vis: 40, brow: 44 } as const;

/** a person's body for the rig: per-bone bind-space girth transforms (12 floats each: 3×3 + translation, identity where
 *  unchanged), the stoop (rad, spread over spine and neck), the static extras, and the soft-tissue parameters */
export interface BodyRig {
  girth: Float32Array; /** bones with a non-identity girth */ bones: Uint8Array;
  stoop: number; extras: Float32Array;
  soft: { breast: SpringP; belly: SpringP; butt: SpringP; thigh: SpringP; uarm: SpringP; jowl: SpringP };
  shape: BodyShape;
}
export interface SpringP { hz: number; zeta: number; gain: number; max: number }

/** body rig of a shape on a variant */
export function bodyRigFor(A: HumanAssets, v: HumanVariant, s: BodyShape): BodyRig {
  const vb = variantBuild(v), fR = s.child ? s.fat : fatEff(s.fat) - fatEff(vb.fat) * 0.85, mR = s.child ? s.muscle : s.muscle - vb.muscle * 0.85, f = s.sex === 'f' && !s.child;
  const J = v.joints, girth = new Float32Array(HBONES.length * 12), bones = new Uint8Array(HBONES.length);
  const setM = (b: number, M: number[]) => { const jx = J[b * 3], jy = J[b * 3 + 1], jz = J[b * 3 + 2], o = b * 12;
    // G = T(j)·M·T(−j): rows [M | j − M j]
    for (let r = 0; r < 3; r++) { girth[o + r * 4] = M[r * 3]; girth[o + r * 4 + 1] = M[r * 3 + 1]; girth[o + r * 4 + 2] = M[r * 3 + 2];
      girth[o + r * 4 + 3] = [jx, jy, jz][r] - (M[r * 3] * jx + M[r * 3 + 1] * jy + M[r * 3 + 2] * jz); }
    bones[b] = 1; };
  const diag = (b: number, x: number, y: number, z: number, tx = 0) => { setM(b, [x, 0, 0, 0, y, 0, 0, 0, z]); girth[b * 12 + 3] += tx; };
  // across the bone's axis: I + (k − 1)(I − a aᵀ), a from the joint to the child's joint
  const perp = (b: number, child: number, k: number) => { let ax = J[child * 3] - J[b * 3], ay = J[child * 3 + 1] - J[b * 3 + 1], az = J[child * 3 + 2] - J[b * 3 + 2]; const n = Math.hypot(ax, ay, az) || 1; ax /= n; ay /= n; az /= n;
    const a = [ax, ay, az], M: number[] = []; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) M.push((r === c ? 1 : 0) + (k - 1) * ((r === c ? 1 : 0) - a[r] * a[c])); setM(b, M); };
  const g = (cf: number, cm: number, extra = 0) => clamp(1 + cf * fR + cm * mR + extra, 0.8, 1.45);
  for (const sd of ['l', 'r'] as const) {
    const B = (n: string) => HB[`${n}_${sd}` as keyof typeof HB];
    perp(B('thigh'), B('calf'), g(0.06, 0.03, 0.015 * s.hips));
    perp(B('calf'), B('foot'), g(0.03, 0.035));
    perp(B('upperarm'), B('lowerarm'), g(0.065, 0.055));
    perp(B('lowerarm'), B('hand'), g(0.03, 0.04));
    perp(B('clavicle'), B('upperarm'), g(0.02, 0.045, 0.02 * s.shoulders));
  }
  perp(HB.neck_01, HB.head, g(0.045, 0.045));
  diag(HB.pelvis, g(0.03, 0, 0.045 * s.hips + 0.03 * s.frame), 1, g(0.035, 0, 0.02 * s.butt));
  diag(HB.spine_01, g(0.035, 0, 0.035 * s.frame), 1, g(0.045, 0));
  diag(HB.spine_02, g(0.03, 0.01, 0.035 * s.frame + 0.015 * s.shoulders), 1, g(0.04, 0.01));
  diag(HB.spine_03, g(0.02, 0.02, 0.03 * s.frame + 0.035 * s.shoulders), 1, g(0.03, 0.025));
  diag(HB.head, 1 + 0.035 * s.faceW + 0.008 * s.fat, 1 + 0.035 * s.faceL, 1 + 0.015 * s.faceL);
  // jaw: width (the jaw's own and the cheeks' fat), its length, and a few millimetres off the midline (the face's asymmetry)
  diag(HB.jaw, clamp(1 + 0.06 * s.jaw + 0.025 * s.cheek, 0.85, 1.25), 1 + 0.02 * s.faceL, 1 + 0.025 * s.jaw, 0.0011 * clamp(s.asym, -3, 3)); girth[HB.jaw * 12 + 11] += 0.0022 * clamp(s.chin, -3, 3); girth[HB.jaw * 12 + 7] -= 0.0012 * clamp(s.chin, -3, 3);
  const F = regionFrame(A, v), ex = new Float32Array(EXTRA_FLOATS);
  ex.set(F.breast, EX.breastC); ex.set(F.butt, EX.buttC); ex.set(F.cheek, EX.cheekC);
  const bust = f ? clamp(0.14 * s.bust + (s.bust > 0 ? 0.02 * s.bust * s.bust : 0), -0.4, 0.75) : clamp(0.045 * s.bust + 0.035 * mR, -0.12, 0.25);
  const fall = f ? (1 - s.firm) * (0.022 + 0.012 * Math.max(0, s.bust)) : 0;
  ex[EX.k] = bust; ex[EX.k + 1] = fall; ex[EX.k + 2] = clamp(0.08 * s.butt, -0.25, 0.35); ex[EX.k + 3] = clamp(0.07 * s.cheek, -0.18, 0.3);
  ex[EX.ex7] = clamp(0.22 * (s.belly - 0.6), 0, 0.6); // the fat belly: the D-292 dome's amount (0.15 m × amount proud; C)
  ex[EX.ex8] = F.thighY; ex[EX.ex8 + 1] = 1; ex[EX.ex8 + 2] = F.nose[0]; ex[EX.ex8 + 3] = F.nose[1];
  ex[EX.cheekC + 3] = clamp(0.1 * s.nose, -0.3, 0.4);
  ex.set(F.mouth, EX.mouth); ex[EX.brow + 3] = 1;
  const soft = (1 - s.firm);
  const mass = (k: number) => Math.max(0, 1 + k);
  return { girth, bones, stoop: clamp(s.posture, -1, 3) * 0.06, extras: ex, shape: s,
    soft: {
      breast: { hz: clamp(2.6 - 0.25 * s.bust, 1.6, 3.4), zeta: 0.16 + 0.22 * s.firm, gain: f ? mass(bust) * (0.55 + 0.8 * soft) : 0.15 * mass(bust), max: f ? 0.012 + 0.03 * mass(bust) * (0.5 + soft) : 0.006 },
      belly: { hz: 2.4, zeta: 0.3, gain: 0.25 + 1.2 * ex[EX.ex7], max: 0.004 + 0.025 * ex[EX.ex7] },
      butt: { hz: 3, zeta: 0.3, gain: 0.3 + 0.4 * Math.max(0, s.butt) * (0.5 + soft), max: 0.006 + 0.006 * Math.max(0, s.butt) },
      thigh: { hz: 4, zeta: 0.32, gain: 0.15 + 0.12 * Math.max(0, fR), max: 0.002 + 0.002 * Math.max(0, fR) },
      uarm: { hz: 4.2, zeta: 0.3, gain: 0.15 + 0.15 * Math.max(0, fR) * (0.5 + soft), max: 0.002 + 0.0025 * Math.max(0, fR) },
      jowl: { hz: 5, zeta: 0.35, gain: 0.1 + 0.15 * Math.max(0, s.cheek), max: 0.001 + 0.0015 * Math.max(0, s.cheek) },
    } };
}

/** a person's body for the look: the shape and its rig on the chosen variant */
export function bodyFor(A: HumanAssets, v: HumanVariant, p: Parameters<typeof shapeFor>[0], worldSeed: number) { const shape = shapeFor(p, worldSeed); return { shape, rig: bodyRigFor(A, v, shape) }; }

// ---- the bind-space fields (humanMaterial mirrors this term for term) ----
const sstep = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** bones whose flesh the breast field may move (pelvis, spine, clavicles) and the buttock field (+ thighs) */
export const TORSO_BONES = [HB.pelvis, HB.spine_01, HB.spine_02, HB.spine_03, HB.clavicle_l, HB.clavicle_r];
export const BUTT_BONES = [HB.pelvis, HB.spine_01, HB.thigh_l, HB.thigh_r];
export const HEAD_BONES = [HB.head, HB.jaw];
/** the breast, buttock and cheek fields' displacement of a bind point (x, y, z) whose main bone is `bone`, for a person's
 *  extras (including the springs); `face` false for eyes, teeth, mouth and lashes (the cheek field leaves them alone) */
export function bodyFieldOffset(x: number, y: number, z: number, bone: number, ex: Float32Array, face = true, out: number[] = [0, 0, 0]) {
  out[0] = out[1] = out[2] = 0; const side = x >= 0 ? 1 : -1;
  if (TORSO_BONES.includes(bone)) { const cx = ex[EX.breastC] * side, cy = ex[EX.breastC + 1], cz = ex[EX.breastC + 2], R = ex[EX.breastC + 3];
    if (R > 0) { const dx = x - cx, dy = y - cy, dz = z - cz, q = Math.max(0, 1 - (dx * dx / (0.9 * 0.9) + dy * dy + dz * dz / (1.2 * 1.2)) / (R * R)), w = q * q * sstep(cz - 0.045, cz - 0.005, z);
      const o = side > 0 ? EX.sprBL : EX.sprBR, k = ex[EX.k], fall = ex[EX.k + 1];
      out[0] += w * (k * dx + ex[o]); out[1] += w * (k * dy - fall + ex[o + 1]); out[2] += w * (k * dz + ex[o + 2] - 0.3 * fall); } }
  if (BUTT_BONES.includes(bone)) { const cx = ex[EX.buttC] * side, cy = ex[EX.buttC + 1], cz = ex[EX.buttC + 2], R = ex[EX.buttC + 3];
    if (R > 0) { const dx = x - cx, dy = y - cy, dz = z - cz, q = Math.max(0, 1 - (dx * dx + dy * dy + dz * dz) / (R * R)), w = q * q * (1 - sstep(cz - 0.005, cz + 0.045, z));
      const k = ex[EX.k + 2]; out[0] += w * k * dx; out[1] += w * (k * dy + ex[EX.spr5]); out[2] += w * (k * dz + ex[EX.spr5 + 1]); } }
  if (face && HEAD_BONES.includes(bone)) { const cx = ex[EX.cheekC] * side, cy = ex[EX.cheekC + 1], cz = ex[EX.cheekC + 2], R = ex[EX.ex8 + 3] ? CHEEK_R : 0;
    { const ny = ex[EX.ex8 + 2], nz = ex[EX.ex8 + 3] - 0.025, dx = x, dy = y - ny, dz = z - nz, q = Math.max(0, 1 - (dx * dx + dy * dy + dz * dz) / (NOSE_R * NOSE_R)), w = q * q * sstep(nz - 0.005, nz + 0.01, z), k = ex[EX.cheekC + 3];
      out[0] += w * k * 0.7 * dx; out[1] += w * k * dy; out[2] += w * k * 1.2 * dz; }
    if (R > 0) { const dx = x - cx, dy = y - cy, dz = z - cz, q = Math.max(0, 1 - (dx * dx + dy * dy + dz * dz) / (R * R)), w = q * q * sstep(cz - 0.012, cz + 0.004, z);
      const k = ex[EX.k + 3]; out[0] += w * k * dx; out[1] += w * (k * dy + ex[EX.ex7 + 3] * (1 - sstep(cy - 0.02, cy + 0.02, y))); out[2] += w * k * dz; } }
  if (face && HEAD_BONES.includes(bone)) faceOffset(x, y, z, ex, out);
  // thighs and upper arms: the whole section rides its spring (a few millimetres), fading toward the joints
  const ty = ex[EX.ex8];
  if (bone === HB.thigh_l || bone === HB.thigh_r) { const w = Math.max(0, 1 - ((y - ty) / 0.16) ** 2); out[1] += w * ex[EX.spr5 + (bone === HB.thigh_l ? 2 : 3)]; }
  if (bone === HB.upperarm_l || bone === HB.upperarm_r) out[1] += 0.7 * ex[EX.ex7 + (bone === HB.upperarm_l ? 1 : 2)];
  return out;
}

/** D-790: the face's motion field (face.ts controls in the extras [10], [11]; the frame in [9]), added to `out` for a bind
 *  point on the head or jaw (humanMaterial mirrors it term for term). The lips: rounding draws the corners in and pushes the
 *  lips forward; spreading and the smile draw them out (the smile up and back, the cheeks rising); pressing rolls the lips
 *  together; the tuck lifts the lower lip back under the upper teeth. The brows: lifted, or knit (inner ends down and in). */
export const FACE_FIELD = { lipY: 0.03, lipYc: 0.012, kx: 1.55, front: [0.035, 0.012], round: [0.42, 0.0075], wide: 0.2, smile: [0.0045, 0.08, 0.003],
  press: 0.0018, tuck: [0.0035, 0.0045], browR: [0.032, 0.035, 0.022], browUp: 0.0055, knit: [0.0028, 0.003], cheekUp: 0.0028 } as const;
export function faceOffset(x: number, y: number, z: number, ex: ArrayLike<number>, out: number[]) {
  const on = ex[EX.brow + 3], W = ex[EX.mouth + 2]; if (!on || !(W > 0)) return out;
  const F = FACE_FIELD, my = ex[EX.mouth], mz = ex[EX.mouth + 1], by = ex[EX.mouth + 3];
  const rd = ex[EX.vis], wd = ex[EX.vis + 1], pr = ex[EX.vis + 2], tk = ex[EX.vis + 3], sm = ex[EX.brow], bu = ex[EX.brow + 1], kn = ex[EX.brow + 2];
  const dx = x, dy = y - my, ax = Math.abs(x), sg = x >= 0 ? 1 : -1;
  const front = sstep(mz - F.front[0], mz - F.front[1], z);
  const q = Math.max(0, 1 - (dx / (F.kx * W)) ** 2 - (dy / F.lipY) ** 2), wM = q * q * front;
  const ql = Math.max(0, 1 - (dx / (1.15 * W)) ** 2 - (dy / F.lipYc) ** 2), wL = ql * front;
  const corner = sstep(0.35 * W, W, ax), up = sstep(-0.002, 0.004, dy), lo = 1 - up;
  out[0] += dx * wM * (-F.round[0] * rd + F.wide * wd + F.smile[1] * sm);
  out[1] += wM * (0.15 * dy * rd + corner * F.smile[0] * sm) + wL * (-F.press * pr * up + F.press * pr * lo + F.tuck[0] * tk * lo);
  out[2] += wL * (F.round[1] * rd - F.press * pr - F.tuck[1] * tk * lo) - wM * corner * (0.002 * wd + F.smile[2] * sm);
  // the cheeks rise with the smile (over the cheekbone, above the mouth's corners)
  const cx = ax - 1.6 * W, cy = y - (my + 0.028), qc = Math.max(0, 1 - (cx / 0.025) ** 2 - (cy / 0.022) ** 2);
  out[1] += qc * qc * front * F.cheekUp * sm;
  // the brows
  const bx = ax - F.browR[0], byy = y - by, qb = Math.max(0, 1 - (bx / F.browR[1]) ** 2 - (byy / F.browR[2]) ** 2), wB = qb * qb * sstep(mz - 0.06, mz - 0.035, z);
  const inner = 1 - sstep(0.012, 0.035, ax);
  out[1] += wB * (F.browUp * bu - F.knit[0] * kn * inner); out[0] -= wB * sg * F.knit[1] * kn * inner;
  return out;
}

/** the life of a person of the population on a day, for the body (D-363; popview.lookInput's hook). Means: the ration
 *  (Persepolis Fortification rations, qa of grain a month: 20 the least, 50 a group's head) or, for a household that
 *  feeds itself, its rank and whether it is Persian (C); labour: the job's (LABOUR, C) */
export function lifeOf(pop: { persons: { sex: 'm' | 'f'; job: string; rank: number; qa: number; persian: boolean }[]; ageOn(pid: number, d: number): number; sick(pid: number, d: number): boolean;
  childrenOf(pid: number): number[]; nurslings?(pid: number, d: number): number[]; gravid?(pid: number, d: number): number }, pid: number, d: number): BodyLife {
  const p = pop.persons[pid], age = pop.ageOn(pid, d);
  const wealth = clamp(p.qa > 0 ? (p.qa - 20) / 40 + 0.12 * p.rank : 0.3 + 0.2 * p.rank + (p.persian ? 0.1 : 0), 0, 1);
  return { ageYears: age, labour: LABOUR[p.job] ?? 0.5, wealth, ill: pop.sick(pid, d) ? 0.4 : 0,
    parity: p.sex === 'f' ? pop.childrenOf(pid).length : 0, nursing: p.sex === 'f' && age >= 15 && (pop.nurslings?.(pid, d).length ?? 0) > 0, gravid: p.sex === 'f' ? (pop.gravid?.(pid, d) ?? 0) : 0 };
}
