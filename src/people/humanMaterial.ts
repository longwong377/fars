// The human material (D-091, D-155): one TSL node material for every body, garment, hair and worn object, so the whole
// crowd renders in a few instanced draws.
//
// Vertex stage (GPU skinning from textures; no per-person uniforms):
//   iSlot (instanced)  → person texel row: variant, piece mask, look flags (LOOK_BITS), grime; colours
//   iRoot, iRootPrev   → the person's feet position and yaw this frame and last frame (instanced; root motion every
//                        frame while the bone palette of distant people is refreshed less often)
//   tid                → bind position + packed normal of this vertex in this person's body variant (source texture)
//   skinIndex/Weight   → 4 × 3 texels of the person's skin palette (rows of 3×4 matrices, character space)
//   hmat               → material class, colour slot (texel of the person row), optional-piece bit, class parameter
//   hext               → cavity AO, drape slack or a body extra, beard region (stubble), shell edge or a body extra
//                        (body extras by class: humanFormat EYE_UNIT / SKIN_CURV_MAX)
// Hidden optional pieces collapse to a point (zero-area triangles). Previous-frame skinning feeds the velocity buffer
// (TRAA) when the pipeline asks for it.
// Fragment stage: arithmetic class masks (no runtime select(): D-012). Three shared noise evaluations serve every class
// (each class scales the noise input), so the cost does not grow with the number of classes.
//   skin  — the baked albedo (skin.png, left half) rescaled to the person's tone; the detail half (crease height, oil,
//           age lines, translucency); a band-limited pore octave; two specular lobes (broad sheen + sharp oily lobe,
//           F0 0.028); diffusion approximated by a per-channel wrap that widens with the surface curvature (red light
//           reaches past the terminator), and thin-part transmission (ears, nostrils, lids).
//   eye   — procedural iris (fibres, collarette, limbal ring, pupil) and sclera in the eye's planar coordinates;
//           analytic eyeball/cornea normals (humanAssets); a wet specular and a sky catchlight; the upper lid's shadow.
//   lash  — the MakeHuman lash strips cut into tapering clumps (alpha test), not a painted band.
//   hair  — natural curls, the court dressing in rows of snail curls (reliefs; C for real hair), straight strands;
//           frayed edges and a scalloped silhouette (alpha test); two shifted Kajiya–Kay lobes along the strands.
//   cloth — wool or linen: a band-limited weave micro-normal, drape folds, mottling, a sheen lobe; motifs; grime.
//   felt, leather, metal, wood, wicker.
import * as THREE from 'three/webgpu';
import * as TSL from 'three/tsl';
const {
  log2, Fn, attribute, texture, uv, vec2, vec3, vec4, float, int, ivec2, mix, step, abs, max, min, floor, clamp, dot, normalize, exp2, smoothstep, sin, cos,
  varyingProperty, normalLocal, positionPrevious, positionView, normalView, normalViewGeometry, positionViewDirection, sign, mx_noise_float, diffuseColor,
  diffuseContribution, specularColor, specularColorBlended, specularF90, metalness, roughness, mod, fract, length, sqrt, atan, exp, pow, cross,
  cameraViewMatrix, BRDF_GGX, F_Schlick, BRDF_Lambert, cameraPosition, interleavedGradientNoise, screenCoordinate, frameId, uniform,
} = TSL as any; // TSL's typings do not follow mixed float/vec3 arithmetic; the graph is checked when it builds
import { MAT, EYE_UNIT, SKIN_CURV_MAX, LOOK_BITS, PRM_UPPER, PRM_ROBE, PRM_CARD, HB, HBONES } from './humanFormat';
import { ROBE, BEARD, BELLY } from './drape';
import { CHEEK_R, NOSE_R, FACE_FIELD as FF } from './bodyShape';
import type { HumanScans } from './humanScans';

/** height field → shading normal (view space; surface gradient from screen-space derivatives, Mikkelsen 2010) */
function bumped(h: any, gx: any = null, gy: any = null) {
  const dpdx = positionView.dFdx(), dpdy = positionView.dFdy(), n = normalView;
  const r1 = dpdy.cross(n), r2 = n.cross(dpdx), det = dpdx.dot(r1);
  // (s17 V3: gx, gy an extra height gradient in screen space, given by the caller where a texture's height would step)
  const hx = gx ? h.dFdx().add(gx) : h.dFdx(), hy = gy ? h.dFdy().add(gy) : h.dFdy();
  const grad = sign(det).mul(hx.mul(r1).add(hy.mul(r2)));
  return abs(det).mul(n).sub(grad).normalize();
}
/** D-307: a bilinear, mip-selected read of a texture by textureLoad (4 loads): no sampler. The human material's fragment
 *  stage is at WebGPU's 16 samplers in the world (the CSM's cascades, the horizon, the probes; the first world render of the
 *  hair atlas failed validation with 19), so its own textures that can go without one do. `size` = level 0 in texels, `levels`
 *  the mip count. */
function loadBilinear(tex: THREE.Texture, uvIn: any, size: [number, number], levels: number) {
  const S0 = vec2(...size), du = uvIn.dFdx().mul(S0), dv = uvIn.dFdy().mul(S0);
  const lod = clamp(floor(log2(max(max(length(du), length(dv)), 1e-6)).add(0.5)), 0, levels - 1);
  const Sl = max(floor(S0.div(exp2(lod))), vec2(1)), p = uvIn.mul(Sl).sub(0.5), i0 = floor(p), fr = p.sub(i0), hi = Sl.sub(1);
  const L = (ox: number, oy: number) => texture(tex).load(ivec2(clamp(i0.add(vec2(ox, oy)), vec2(0), hi))).level(int(lod));
  return mix(mix(L(0, 0), L(1, 0), fr.x), mix(L(0, 1), L(1, 1), fr.x), fr.y);
}
/** 1 when the (rounded) class id equals k, else 0 (arithmetic, no branches) */
const is = (m: any, k: number) => float(1).sub(step(0.5, abs(m.sub(k))));
const TAU = Math.PI * 2;

export interface HumanTextures {
  /** RGBA32F: xyz bind position, w packed normal; row-major over variant × NV vertices */
  source: THREE.DataTexture; sourceWidth: number; NV: number;
  /** RGBA32F: one row per slot, 189 texels (59 bones × 3 rows of a 3×4 matrix, then D-363 the body's 12 extra texels: bodyShape EX) */
  bones: THREE.DataTexture; prevBones: THREE.DataTexture;
  /** RGBA32F: one row per slot, 8 texels (see PERSON_TEXELS) */
  person: THREE.DataTexture;
  /** skin.png: a 2:1 atlas, left half albedo (RGB) + brows (A), right half detail (SKIN_DETAIL); eye.png is no longer
   *  sampled (the eye is procedural, D-155) */
  skin: THREE.Texture; eye: THREE.Texture;
  /** D-304: the scanned skin and cloth layers (humanScans.ts; null in node and with ?noscans: the procedural path) and each
   *  body variant's [light, dark] skin layer */
  scans?: HumanScans | null; skinLayers?: [number, number][];
  /** D-307: the strand atlas of the hair cards (peopleModels.loadHairAtlas; R shade, G depth, B strand direction, A coverage)
   *  and its layout: columns, rows, card class → row per hair style (null: no cards in the costumes) */
  /** D-322: the garments carry their simulated folds in the geometry (people_cloth loaded): no shading stand-ins for them */
  simCloth?: boolean;
  /** D-322: each body variant's group (0 men, 1 women, 2 children) + 3 × its drape seed: the channel and layer pair of the fold layers its garments read */
  groups?: number[];
  hairAtlas?: THREE.Texture | null; cards?: { cols: number; rows: number; classRows: number[][]; w: number; h: number; levels: number; normal?: { w: number; h: number; levels: number } | null } | null;
  /** D-323: the cards' normal atlas (R, G the lock's normal across and along the card, B occlusion inside the lock, A coverage) */
  hairNormal?: THREE.Texture | null;
}
/** person texel layout: 0 [variant, piece mask, look flags (LOOK_BITS), grime], 1 [skin tone, stubble], 2 main, 3 second,
 *  4 trim (w: the garment's fading susceptibility, D-189), 5 hair (w: the belly of a woman with child, 0..1, D-292), 6 leather
 *  (w: the abdomen's height in bind space, m), 7 [grime brightness, scale, hat height (D-189), flags], 8 felt/headgear (w: the
 *  abdomen's front z in bind space, m), 9 wear [garment age, fit (m), fold amplitude (mm) + phase, hem soil] (looks.wearTexel, D-189).
 *  stubble (1.w): 0 none, 0..1 shaven stubble, 2 = bearded (the skin under the beard reads as roots) */
export const PERSON_TEXELS = 11;
/** s17 V3 (D-500): texel 10 [wound, scar, the variant's eye height (m, bind), 0]: the marks of the sim's hooks drawn on the
 *  skin (crowd.ts setMarks). wound: 1 a linen bandage round the head (a cut), 2 round the left forearm, 3 a splinted right
 *  forearm (a broken bone); scar: 1 an old healed wound or scald on the right forearm */
export const MARK = { headY: 0.05, headHalf: [0.016, 0.03] as [number, number], arm: [0.8, 0.97] as [number, number],
  linen: [0.5, 0.45, 0.37] as RGB, blood: [0.32, 0.1, 0.07] as RGB };
/** reference skin tone the baked albedo was authored for (sRGB; tools/humans/skin.ts REF_TONE) */
export const REF_TONE: [number, number, number] = [0.72, 0.53, 0.42];
/** drape: a slack cloth vertex drops this far (m) when its main bone is horizontal (wide sleeves, seated skirts; C) */
export const SAG_MAX = 0.1;
/** s17 V3 (D-500): how far inside its surface a shadow-only caster is drawn (m; C, measured against the LOD 2 body's
 *  deviation from the full-detail one on faces and garments) */
export const SHADOW_SHRINK = 0.014, SHADOW_SHRINK_HEAD = 0.032;
/** Cloth wear and drape (D-189, C). Skirts: the hem is folded per person (two low orders round the hem at every LOD, two
 *  higher orders near the camera, where the 40-segment tube can carry them) and fitted (ease at the hem), growing with
 *  the square of the way down the skirt. Fading: sun-bleaching on up-facing cloth (the garment's age × its dye's
 *  susceptibility). Hem soil: dust toward the ground. Joint wrinkles: rings across a sleeve or trouser leg where it bends
 *  (the two bones' relative rotation where the skin weights mix). Micro-shadowing: the baked cavity also darkens the
 *  direct light (after Chan 2018's micro-shadows), so eye sockets, the nose's underside and cloth folds read in sun. */
export const DRAPE = { foldLow: [2, 3] as [number, number], foldHigh: [7, 10] as [number, number], highNear: [15, 24] as [number, number],
  fade: 0.6, soil: 0.8, dust: [0.34, 0.28, 0.2] as RGB, wrinkle: 0.0014, wrinkleF: 26, micro: 1, hatH: 0.154,
  /** D-206 (C): hems — a shell's cut line (the outer 30 % of its ramp, and the turned edge) and a skirt's last hand's
   *  breadth — are doubled cloth: darker by hemDark and rolled (a ridge of hemRoll m); gathers above the belt on the upper
   *  garments (class parameter 5, uv.y = height above the belt, m): gatherN folds round the body, gather m deep, fading out
   *  over gatherH m */
  hemBand: 0.3, hemDark: 0.14, hemRoll: 0.0007, gather: 0.0024, gatherN: 22, gatherH: 0.07,
  /** D-225 (C): cloth that reads as woven, not felt. `weave`: a tabby (plain) weave height field, warp over weft in a
   *  checker, round threads with their crimp (threads per metre: wool, linen; relief m: wool, linen), band-limited so it is
   *  gone by ~0.5 m; `streak`: handspun yarn takes the dye unevenly, bars along the weft (noise cycles per metre across,
   *  along; albedo ± share); `dyeUneven`: the chroma of one garment varies ± these shares in 7 × 20 cm patches and along the weft bars (the yarn
   *  takes the dye unevenly; linear in the noise, so the mean colour is kept; the bars band-limited);
   *  `lump`: the old isotropic drape noise (3 mm, it read as felt) cut to this height (m); `hang`: folds hanging from the
   *  chest on the upper garments (count round, m deep, fading out over m above the belt) */
  weave: { fq: [700, 1500] as [number, number], h: [0.0003, 0.00015] as [number, number], alb: 0.16 },
  streak: { f: [14, 170] as [number, number], alb: 0.04, h: [0.00012, 0.00006] as [number, number] },
  dyeUneven: [0.07, 0.18] as [number, number], /* (s17 V3: was 0.04, 0.14: every garment read as one flat dyed sheet at 2-5 m) */ lump: 0.0015, hang: { n: 14, h: 0.003, top: 0.3 },
  /** D-225: hem soil — the last few centimetres of a skirt drag in the dust (share of the skirt's length, extra weight) */
  hemEdge: [0.93, 0.3] as [number, number] };

/** D-363: the soft tissue fades out between these distances (m): beyond them a few millimetres of motion are under a pixel */
export const SOFT_FADE: [number, number] = [18, 35];
/** person flags (texel 7 w): 1 = hide the head (the player's own body, seen from inside it) */
export const FLAG_HIDE_HEAD = 1;

type RGB = [number, number, number];
/** Skin (C unless noted). f0: n ≈ 1.4 (B: the value used by Donner & Jensen 2006 and d'Eon & Luebke 2007). Two GGX lobes:
 *  a broad sheen and a sharp oily lobe whose share follows the oil map (T-zone, lips). The diffusion approximation: the
 *  wrap per channel is base + curvature × scatter length (red scatters furthest: d'Eon & Luebke's sum-of-Gaussians
 *  widths are ~1–3 mm for red, well under 1 mm for blue), capped; flat skin keeps a small base wrap. */
export const SKIN = {
  f0: 0.028, roughSheen: 0.6, roughOil: 0.34, oilLobe: [0.1, 0.34] as [number, number],
  scatter: [0.0028, 0.0011, 0.0006] as RGB, wrapBase: [0.1, 0.035, 0.018] as RGB, wrapMax: 0.55,
  /** full-scale heights (m) of the detail map's crease and age channels; the age channel scales with the age decade */
  crease: 0.00045, age: 0.0004,
  /** thin-part transmission: tint (light through ~2–5 mm of tissue is red) and strength (C) */
  transTint: [1, 0.3, 0.14] as RGB, trans: 0.4,
  /** band-limited pore octaves (cycles/m, amplitude m): faded where a period spans fewer than ~3 px (as D-147) */
  pores: [[1100, 0.000025], [340, 0.00005]] as [number, number][],
};
/** Eyes (C unless noted): radii in m (iris diameter ~11.5–12 mm, B: standard anatomy; daylight pupil 3 mm, C), sclera
 *  albedo (linear: a white tissue that reflects most visible light, slightly warm; the MakeHuman texture's sclera was
 *  sRGB 0.66 and the old shader dimmed it to 0.3 linear, which read grey), iris colours (linear albedo; dark brown
 *  irises reflect only a few per cent) */
/** D-215: eye paint (the court's fashion, Xenophon Cyr. 1.3.2, 8.1.41: B claim; who wears it C): the lash strips' roots,
 *  `band` of the strip's depth, are filled solid and near black, a line along each lid at the lashes (C) */
export const KOHL = { band: 0.35, alb: [0.018, 0.016, 0.015] as RGB };
/** D-790: the brows' hairs: strand lines per metre across, hair lengths per metre along, clumps of hairs per metre across (C) */
export const BROW = { lines: 2800, len: 140, clumps: 650 };
/** the coordinate across the brow's hairs (their direction at angle th from the horizontal, outward) */
const bP = (y: any, ax: any, c: any, sn: any) => y.mul(c).sub(ax.mul(sn));
export const EYE = { irisR: 0.0059, pupilR: 0.0015, sclera: [0.64, 0.6, 0.55] as RGB, caruncle: [0.6, 0.36, 0.34] as RGB, lidShadow: 0.55, f0: 0.025, /** D-790 */ cornerShade: 0.38, lowerShade: 0.3 };
export const IRIS: RGB[] = [[0.04, 0.02, 0.009], [0.062, 0.032, 0.013], [0.095, 0.05, 0.02], [0.13, 0.072, 0.03], [0.14, 0.1, 0.045], [0.11, 0.115, 0.06], [0.11, 0.13, 0.105], [0.1, 0.14, 0.18]];
/** lash strips (MakeHuman helper UVs span u 0.704–0.762 along both lids): clumps along the lid, tapering to the tip */
export const LASH = { u0: 0.704, u1: 0.762, clumps: 72 };
/** hair: the court dressing's curl rows (m; the relief convention, C for real hair); curl bump heights (m) */
/** D-304 (C): the scanned layers. Skin: the dark-toned layer's share grows as the person's tone (linear luminance) falls
 *  from darkY[0] to darkY[1] (the ramp: a Persian mean p 0.4 ≈ 0.2, an Egyptian 0.62 ≈ 0.13, a Kushite 0.84 ≈ 0.06).
 *  Cloth: the scan's albedo detail blended by `alb` (per layer: linen, wool, felt, leather), its height (0..1 about 0.5)
 *  as bump of `h` m peak to peak, the tile (m per repeat, bind space) from the scan's measured thread count to the fabric's
 *  threads per metre (DRAPE.weave.fq; tools/build_humans_scans.py) */
export const SCAN = { darkY: [0.17, 0.075] as [number, number],
  cloth: { alb: [0.9, 1, 0.9, 0.9], h: [0.00045, 0.0007, 0.0006, 0.0004] } };
export const HAIR = { row: 0.008, bump: 0.0011, bumpStraight: 0.0008, bumpMass: 0.002, kk: [0.13, 0.09] as [number, number] }; // (s17 V3: kk ×1.45, the sheen of oiled dark hair in the sun)
/** D-307 (C): the strand cards. Albedo = hair colour × the atlas' shade × 2 (its mean is 0.5) × a back strand's darkening
 *  (depth 0 → back); the coverage is tested at `alphaTest`, the value the atlas' coverage-preserving mips were made for
 *  (tools/blender/sources/people_hair_post.ts: a card keeps its density at every distance; the first render's hashed test
 *  read as speckled noise at the strands' edges); the strand's direction across the card tilts the highlight's tangent */
export const CARD = { back: 0.55, alphaTest: 0.5, tilt: 0.9,
  /** D-323: the normal atlas's weight (the lock's roundness across the card: its edges turn away, so a card lights as a
   *  lock, not a sheet) and how much of its occlusion (inside a lock, the back strands) reaches the ambient and the albedo */
  normal: 1, aoAmb: 1, aoAlb: 0.35,
  /** D-323: the test's threshold dithered per pixel and per frame about alphaTest by this share of its range (interleaved
   *  gradient noise, offset each frame), so TRAA resolves a card's edge to its coverage: with a fixed threshold, minified
   *  locks passed or failed whole pixels and every hairline, beard edge and brow read as jagged pixel noise at 1.5 m
   *  (the D-323 GPU portraits). The D-307 hashed test was static per pixel: TRAA had nothing to average. */
  dither: 0.9,
  /** s17 V3 (D-500): per card class (tools/blender/people.json layers' cls: 0, 1 scalp hair, 2, 3 the long beard, 4 the brows,
   *  5 the bun, 6 the short beard) the test's [threshold, dither]: the beards' wide dither left the hanging beard a see-through net at 1-2 m (a
   *  moving head's TRAA history does not hold it), so beards test lower and steadier and read as a mass; the scalp hair
   *  between; the brows keep the D-323 values (a steady test cut them into dashes) */
  byClass: [[0.44, 0.5], [0.44, 0.5], [0.36, 0.2], [0.36, 0.2], [0.5, 0.9], [0.44, 0.5], [0.4, 0.3]] as [number, number][] };

class HumanLightingModel extends THREE.PhysicalLightingModel {
  constructor(private S: Record<string, any>) { super(); }
  direct(inputs: any) {
    const S = this.S; const { lightDirection: L, lightColor, reflectedLight } = inputs;
    const N = normalView, V = positionViewDirection;
    const ndl = N.dot(L), dotNL = ndl.clamp();
    const H = L.add(V).normalize(), dotVH = V.dot(H).clamp(), dotNH = N.dot(H).clamp(), dotNV = N.dot(V).clamp();
    const F = F_Schlick({ f0: specularColor, f90: specularF90, dotVH });
    // diffuse: wrapped per channel (w = 0 is Lambert); the skin's wrap widens with curvature, red furthest (SSS, C)
    const w = S.wrap; const prof = ndl.add(w).div(w.add(1)).clamp().pow(w.add(1));
    // micro-shadow: the cavity's visibility cone narrows the lit range, clamp(|n·l| + 2·ao² − 1) (Chan 2018; C)
    const ms = mix(float(1), abs(ndl).add(S.micro.mul(S.micro).mul(2)).sub(1).clamp(0, 1), S.microK);
    const diffuse = lightColor.mul(prof).mul(BRDF_Lambert({ diffuseColor: diffuseContribution })).mul(F.oneMinus()).mul(ms);
    // thin parts lit from behind (ears, nostril wings, lids): red transmission
    const back = ndl.negate().add(0.25).div(1.25).clamp();
    const trans = lightColor.mul(diffuseContribution).mul(S.trans).mul(back.mul(back)).mul(1 / Math.PI);
    // specular: GGX with the material roughness, blended with a sharper second lobe (skin oil)
    const specA = BRDF_GGX({ lightDirection: L, f0: specularColorBlended, f90: 1, roughness });
    const specB = BRDF_GGX({ lightDirection: L, f0: specularColorBlended, f90: 1, roughness: S.roughB });
    let spec: any = mix(specA, specB, S.lobeB);
    // hair: two shifted Kajiya–Kay lobes along the strand tangent (world down on the surface, swirled by the curls)
    const down = cameraViewMatrix.mul(vec4(0, -1, 0, 0)).xyz;
    const t0 = down.sub(N.mul(N.dot(down))).add(cameraViewMatrix.mul(vec4(0.001, 0, 0, 0)).xyz).normalize(), b0 = N.cross(t0);
    const T = mix(t0.add(b0.mul(S.hairTilt)).normalize(), S.cardT, S.kCard).normalize(); // (D-307: a card's strands give it)
    const kk = (shift: number, e: number) => { const ts = T.add(N.mul(shift)).normalize(), th = ts.dot(H); return smoothstep(-1, 0, th).mul(pow(float(1).sub(th.mul(th)).clamp(0, 1).sqrt(), e)); };
    const kkSpec = vec3(kk(-0.08, 80).mul(HAIR.kk[0]).mul(S.kkEdge)).add(diffuseColor.rgb.mul(6).clamp(0, 1).mul(kk(0.1, 14).mul(HAIR.kk[1])));
    spec = mix(spec, kkSpec, S.kHair);
    // cloth and felt: a sheen lobe (Charlie distribution, Neubelt visibility)
    const invA = float(1).div(S.sheenRough), sin2 = float(1).sub(dotNH.mul(dotNH)).max(0.0078125);
    const Dc = invA.add(2).mul(pow(sin2, invA.mul(0.5))).div(TAU);
    const Vn = float(1).div(dotNL.add(dotNV).sub(dotNL.mul(dotNV)).max(0.001).mul(4)).clamp(0, 1);
    const sheen = S.sheenCol.mul(Dc).mul(Vn);
    const irr = lightColor.mul(dotNL);
    reflectedLight.directDiffuse.addAssign(diffuse.add(trans));
    reflectedLight.directSpecular.addAssign(irr.mul(spec).mul(S.specOcc).mul(ms).mul((this as any).multiScatteringCompensation ?? 1).add(irr.mul(sheen)));
  }
  indirect(builder: any) {
    this.indirectDiffuse(builder); this.indirectSpecular(builder);
    // The scenes have no environment map, so nothing reflected the sky. Approximate the sky's reflection from the
    // irradiance at this normal (its mean radiance, irradiance/π), brighter for reflections pointing up (C): skin gets
    // its sheen in shade, eyes their catchlight, metal its colour.
    const S = this.S; const { irradiance, reflectedLight } = builder.context;
    const N = normalView, V = positionViewDirection, dotNV = N.dot(V).clamp();
    const up = cameraViewMatrix.mul(vec4(0, 1, 0, 0)).xyz, R = V.negate().reflect(N);
    const skyW = mix(0.55, 1.4, smoothstep(-0.15, 0.35, R.dot(up)));
    const f5 = float(1).sub(dotNV), f = f5.mul(f5).mul(f5).mul(f5).mul(f5), r = S.roughEnv;
    const env = specularColorBlended.add(max(float(1).sub(r), specularColorBlended).sub(specularColorBlended).mul(f)).mul(float(1).sub(r.mul(r).mul(0.6)));
    const sheenInd = S.sheenCol.mul(f5.mul(f5).mul(f5).mul(0.6).add(0.12));
    reflectedLight.indirectSpecular.addAssign(irradiance.mul(1 / Math.PI).mul(skyW).mul(env.mul(S.envMask).add(sheenInd)));
    this.ambientOcclusion(builder);
  }
}

/** D-790: the hair's motion (m at a card's tip): the air's sway, the trail behind a walker (per m/s), the bounce of the step */
export const HAIR_SWAY = { air: 0.004, trail: 0.006, bounce: 0.004 };
export class HumanMaterial extends THREE.MeshStandardNodeMaterial {
  private S: Record<string, any> = {}; private f0Node: any;
  /** D-790: the clock of the hair's sway (s; humanGPU.end sets it) */ readonly hairTime = uniform(0);
  constructor(T: HumanTextures, opts: { shadowOnly?: boolean } = {}) {
    super();
    this.name = 'human';
    const srcW = T.sourceWidth, NV = T.NV;
    const srcTex = texture(T.source), boneTex = texture(T.bones), prevTex = texture(T.prevBones), perTex = texture(T.person);
    this.texNodes = [srcTex, boneTex, prevTex, perTex];
    const slot = attribute('iSlot', 'float'), tid = attribute('tid', 'float'), root = attribute('iRoot', 'vec4'), rootPrev = attribute('iRootPrev', 'vec4');
    const si = attribute('skinIndex', 'vec4').mul(255).add(0.5).floor(), sw = attribute('skinWeight', 'vec4');
    const hmat = attribute('hmat', 'vec4').mul(255).add(0.5).floor(), hext = attribute('hext', 'vec4');
    const row = (k: number) => perTex.load(ivec2(int(k), int(slot)));
    const person0 = row(0), person7 = row(7), scale: any = person7.y;
    /** character space → world: scale, yaw about +Y (x' = cos·x + sin·z, z' = −sin·x + cos·z), feet position */
    const V3: any = vec3;
    const rotN = (q: any, r: any): any => { const c: any = cos(r.w), sn: any = sin(r.w); return V3(c.mul(q.x).add(sn.mul(q.z)), q.y, sn.negate().mul(q.x).add(c.mul(q.z))); };
    const toWorld = (q: any, r: any): any => rotN(q, r).mul(scale).add(r.xyz);

    // ---- vertex: bind position + normal of this variant
    const src = Fn(() => {
      const t = int(person0.x).mul(NV).add(int(tid));
      return srcTex.load(ivec2(t.mod(srcW), t.div(srcW)));
    })();
    const decodeN = (w: any) => { // octahedral 12+12 bits packed as an exact integer (inverse of outfits.packNormal)
      const qu = floor(w.div(4096)), qv = w.sub(qu.mul(4096)); const e = vec2(qu, qv).div(4095).mul(2).sub(1);
      const z = float(1).sub(abs(e.x)).sub(abs(e.y)), t = max(z.negate(), 0); // lower hemisphere folded back
      return normalize(vec3(e.x.sub(sign(e.x).mul(t)), e.y.sub(sign(e.y).mul(t)), z)); };
    const skinned = (tex: any) => { // Σ w_k M_k (3×4 rows)
      const r = [0, 1, 2].map(k => {
        let acc: any = null;
        for (const c of ['x', 'y', 'z', 'w'] as const) { const b = int(si[c]).mul(3).add(k); const term = tex.load(ivec2(b, int(slot))).mul(sw[c]); acc = acc ? acc.add(term) : term; }
        return acc; });
      return r;
    };
    const vColor = varyingProperty('vec3', 'vHumanColor'), vHair = varyingProperty('vec3', 'vHumanCol2'), vMat = varyingProperty('vec4', 'vHumanMat'), vBind = varyingProperty('vec3', 'vHumanBind'), vAux = varyingProperty('vec4', 'vHumanAux'), vExt = varyingProperty('vec4', 'vHumanExt');
    const vWear = varyingProperty('vec4', 'vHumanWear'), vSkinL = varyingProperty('vec4', 'vHumanSkinL'); // (xy the skin layers; D-322 zw the fold atlas coordinate, packed: WebGPU's 16 varyings are all used)
    const FOLD = T.scans && T.scans.foldBase >= 0 && T.groups?.length ? T.scans : null;
    const SL = T.scans && T.skinLayers?.length ? T.skinLayers : null;
    this.positionNode = Fn((builder: any) => {
      const s = src.toVar(), nB = decodeN(s.w);
      // skirts (hext.z, D-189): the hem folded and fitted per person, in bind space before skinning (the lining moves
      // with the outer layer: both are displaced along the same radial direction, away from the skirt's axis)
      const wear = row(9), ampPh = wear.z, amp = floor(ampPh).mul(0.001), ph = fract(ampPh).mul(TAU);
      const skirtV = hext.z.mul(step(0.5, hmat.x)).mul(step(hmat.x, 3.5)), tS = attribute('uv', 'vec2').y, thS = atan(s.x, s.z.sub(0.02)); // θ about the skirt's axis from the bind position (the tube's uv seam would crease the shading)
      const rad = normalize(vec2(s.x, s.z.sub(0.02)).add(vec2(0, 1e-5)));
      const camD = length(root.xyz.sub(cameraPosition));
      const low = sin(thS.mul(DRAPE.foldLow[0]).add(ph)).mul(0.55).add(sin(thS.mul(DRAPE.foldLow[1]).add(ph.mul(1.7)).add(1)).mul(0.45));
      const high = sin(thS.mul(DRAPE.foldHigh[0]).add(ph.mul(2.3))).mul(0.6).add(sin(thS.mul(DRAPE.foldHigh[1]).add(ph.mul(3.1)).add(2)).mul(0.4))
        .mul(float(1).sub(smoothstep(DRAPE.highNear[0], DRAPE.highNear[1], camD)));
      const dS = tS.mul(tS).mul(wear.y.add(amp.mul(low.mul(0.7).add(high.mul(0.6)).add(0.6)))).mul(skirtV);
      // the fluted hat (felt, class parameter 1; a tube whose uv.y runs rim → crown) taller or lower per person (D-189)
      const hatV = is(hmat.x, MAT.felt).mul(is(hmat.w, 1)), hatDy = tS.mul(DRAPE.hatH).mul(person7.z).mul(hatV);
      // D-225: the court's long beard in rows: each row's roll (hext.z − 0.6, × BEARD.rowAmp) along the bind normal, only
      // for the court dressing (look flags' hairStyle 1); a working man's long beard keeps the plain mass
      const courtV = is(mod(floor(person0.z.add(0.5).div(2 ** LOOK_BITS.hairStyle[0])), 2 ** LOOK_BITS.hairStyle[1]), 1);
      const rowV = hext.z.sub(0.6).mul(BEARD.rowAmp).mul(is(hmat.x, MAT.hair)).mul(is(hmat.w, 3)).mul(courtV);
      // D-292: the belly of a woman with child (drape.ts bellyOffset, mirrored term for term): amount in texel 5 w, the
      // abdomen's frame (navel height, front surface z) in texels 6 w and 8 w; zero amount leaves every vertex where it was
      const bAmt = row(5).w.add(boneTex.load(ivec2(int(HBONES.length * 3 + 7), int(slot))).x), bYc = row(6).w, bZ0 = row(8).w;
      const bRx = float(BELLY.rx[0]).add(bAmt.mul(BELLY.rx[1])), bDy = s.y.sub(bYc.add(BELLY.rise[0]).add(bAmt.mul(BELLY.rise[1])));
      const bRy = mix(float(BELLY.ryLow[0]).add(bAmt.mul(BELLY.ryLow[1])), float(BELLY.ryUp[0]).add(bAmt.mul(BELLY.ryUp[1])), step(0, bDy));
      const bUx = s.x.div(bRx), bUy = bDy.div(bRy), bQ = max(float(1).sub(bUx.mul(bUx)).sub(bUy.mul(bUy)), 0), bSq = sqrt(bQ);
      const bS = smoothstep(bZ0.sub(BELLY.front[0]), bZ0.sub(BELLY.front[1]), s.z), bStand = max(s.z.sub(bZ0).sub(BELLY.skin), 0);
      // D-307: cloth under the dome's centre hangs from it (drape.ts bellyOffset's `fall`, cloth classes only)
      const bQx = max(float(1).sub(bUx.mul(bUx)), 0), bCloth = step(0.5, hmat.x).mul(step(hmat.x, 3.5)).mul(step(bDy, 0));
      const bFall = max(bAmt.mul(BELLY.term).mul(bQx).mul(sqrt(bQx)).mul(float(1).sub(smoothstep(0, BELLY.fall, bDy.negate()))).sub(bStand.mul(BELLY.take)), 0).mul(bS).mul(bCloth);
      const bDome = max(bAmt.mul(BELLY.term).mul(bQ).mul(bSq).sub(bStand.mul(BELLY.take)), 0).mul(bS).mul(step(1e-9, bQ));
      const bDz = max(bDome, bFall), bMoved = step(1e-6, bDz).mul(step(bFall, bDome));
      const bDh = bAmt.mul(-BELLY.term * BELLY.exp * 2).mul(bSq).mul(bS);
      const nBb = normalize(nB.sub(vec3(bDh.mul(s.x).div(bRx.mul(bRx)), bDh.mul(bDy).div(bRy.mul(bRy)), 0).mul(nB.z.mul(bMoved))));
      // D-363: the body's fields (bodyShape.bodyFieldOffset, term for term) from the palette row's extra texels: breasts,
      // buttocks and cheeks scaled about their centres (the breasts' fall), and the soft tissue's springs (breasts, belly,
      // buttocks, thighs, upper arms, jowls), faded out with distance; the fat belly joins the D-292 dome's amount
      const xe = (k: number) => boneTex.load(ivec2(int(HBONES.length * 3 + k), int(slot)));
      const e0 = xe(0), e1 = xe(1), e2 = xe(2), e3 = xe(3), e4 = xe(4), e5 = xe(5), e6 = xe(6), e7 = xe(7), e8 = xe(8);
      const sideP = step(0, s.x), side = sideP.mul(2).sub(1), bn = si.x, isB = (k: number) => is(bn, k);
      const fadeJ = e8.y.mul(float(1).sub(smoothstep(SOFT_FADE[0], SOFT_FADE[1], camD)));
      const torsoM = isB(HB.pelvis).add(isB(HB.spine_01)).add(isB(HB.spine_02)).add(isB(HB.spine_03)).add(isB(HB.clavicle_l)).add(isB(HB.clavicle_r));
      const dBr = vec3(s.x.sub(e0.x.mul(side)), s.y.sub(e0.y), s.z.sub(e0.z));
      const qBr = max(float(1).sub(dBr.x.mul(dBr.x).div(0.81).add(dBr.y.mul(dBr.y)).add(dBr.z.mul(dBr.z).div(1.44)).div(max(e0.w.mul(e0.w), 1e-6))), 0);
      const wBr = qBr.mul(qBr).mul(smoothstep(e0.z.sub(0.045), e0.z.sub(0.005), s.z)).mul(torsoM);
      const offBr = dBr.mul(e1.x).add(mix(e4.xyz, e3.xyz, sideP).mul(fadeJ)).add(vec3(0, e1.y.negate(), e1.y.mul(-0.3))).mul(wBr);
      const buttM = isB(HB.pelvis).add(isB(HB.spine_01)).add(isB(HB.thigh_l)).add(isB(HB.thigh_r));
      const dBt = vec3(s.x.sub(e2.x.mul(side)), s.y.sub(e2.y), s.z.sub(e2.z));
      const qBt = max(float(1).sub(dot(dBt, dBt).div(max(e2.w.mul(e2.w), 1e-6))), 0);
      const wBt = qBt.mul(qBt).mul(float(1).sub(smoothstep(e2.z.sub(0.005), e2.z.add(0.045), s.z))).mul(buttM);
      const offBt = dBt.mul(e1.z).add(vec3(0, e5.x, e5.y).mul(fadeJ)).mul(wBt);
      const faceM = float(1).sub(is(hmat.x, MAT.eye)).sub(is(hmat.x, MAT.teeth)).sub(is(hmat.x, MAT.mouth)).sub(is(hmat.x, MAT.lash)).mul(isB(HB.head).add(isB(HB.jaw)));
      const dCh = vec3(s.x.sub(e6.x.mul(side)), s.y.sub(e6.y), s.z.sub(e6.z));
      const qCh = max(float(1).sub(dot(dCh, dCh).div(CHEEK_R * CHEEK_R)), 0).mul(step(1e-6, abs(e8.w)));
      const wCh = qCh.mul(qCh).mul(smoothstep(e6.z.sub(0.012), e6.z.add(0.004), s.z)).mul(faceM);
      const offCh = dCh.mul(e1.w).add(vec3(0, e7.w.mul(fadeJ).mul(float(1).sub(smoothstep(e6.y.sub(0.02), e6.y.add(0.02), s.y))), 0)).mul(wCh);
      // the nose scaled about its base (wider × 0.7, longer, more projecting × 1.2; the cheek centre's w is its k − 1)
      const nZ = e8.w.sub(0.025), dNo = vec3(s.x, s.y.sub(e8.z), s.z.sub(nZ)), qNo = max(float(1).sub(dot(dNo, dNo).div(NOSE_R * NOSE_R)), 0);
      const offNo = dNo.mul(vec3(0.7, 1, 1.2)).mul(e6.w).mul(qNo.mul(qNo).mul(smoothstep(nZ.sub(0.005), nZ.add(0.01), s.z)).mul(faceM));
      // D-790: the face's motion field (bodyShape.faceOffset, term for term): the lips' visemes, the smile and the cheeks, the
      // brows; texel 9 the mouth's frame, 10 and 11 the controls the rig writes each solve (all zero: nothing moves)
      const e9 = xe(9), e10 = xe(10), e11 = xe(11), Wm = max(e9.z, 1e-4), fOn = e11.w.mul(step(1e-5, e9.z)).mul(faceM);
      const fdy = s.y.sub(e9.x), fax = abs(s.x), fFront = smoothstep(e9.y.sub(FF.front[0]), e9.y.sub(FF.front[1]), s.z);
      const fq = max(float(1).sub(s.x.div(Wm.mul(FF.kx)).mul(s.x.div(Wm.mul(FF.kx)))).sub(fdy.div(FF.lipY).mul(fdy.div(FF.lipY))), 0), wM = fq.mul(fq).mul(fFront);
      const fql = max(float(1).sub(s.x.div(Wm.mul(1.15)).mul(s.x.div(Wm.mul(1.15)))).sub(fdy.div(FF.lipYc).mul(fdy.div(FF.lipYc))), 0), wL = fql.mul(fFront);
      const fCorner = smoothstep(Wm.mul(0.35), Wm, fax), fUp = smoothstep(-0.002, 0.004, fdy), fLo = float(1).sub(fUp);
      const fOx = s.x.mul(wM).mul(e10.x.mul(-FF.round[0]).add(e10.y.mul(FF.wide)).add(e11.x.mul(FF.smile[1])));
      const fcx = fax.sub(Wm.mul(1.6)), fcy = s.y.sub(e9.x.add(0.028)), fqc = max(float(1).sub(fcx.div(0.025).mul(fcx.div(0.025))).sub(fcy.div(0.022).mul(fcy.div(0.022))), 0);
      const fOy = wM.mul(fdy.mul(0.15).mul(e10.x).add(fCorner.mul(FF.smile[0]).mul(e11.x)))
        .add(wL.mul(e10.z.mul(FF.press).mul(fLo.sub(fUp)).add(e10.w.mul(FF.tuck[0]).mul(fLo))))
        .add(fqc.mul(fqc).mul(fFront).mul(FF.cheekUp).mul(e11.x));
      const fOz = wL.mul(e10.x.mul(FF.round[1]).sub(e10.z.mul(FF.press)).sub(e10.w.mul(FF.tuck[1]).mul(fLo))).sub(wM.mul(fCorner).mul(e10.y.mul(0.002).add(e11.x.mul(FF.smile[2]))));
      const fbx = fax.sub(FF.browR[0]), fby = s.y.sub(e9.w), fqb = max(float(1).sub(fbx.div(FF.browR[1]).mul(fbx.div(FF.browR[1]))).sub(fby.div(FF.browR[2]).mul(fby.div(FF.browR[2]))), 0);
      const wB = fqb.mul(fqb).mul(smoothstep(e9.y.sub(0.06), e9.y.sub(0.035), s.z)), fIn = float(1).sub(smoothstep(0.012, 0.035, fax));
      const offFace = vec3(fOx.sub(wB.mul(side).mul(FF.knit[1]).mul(e11.z).mul(fIn)), fOy.add(wB.mul(e11.y.mul(FF.browUp).sub(e11.z.mul(FF.knit[0]).mul(fIn)))), fOz).mul(fOn);
      const thW = max(float(1).sub(s.y.sub(e8.x).div(0.16).mul(s.y.sub(e8.x).div(0.16))), 0);
      const limbY = thW.mul(isB(HB.thigh_l).mul(e5.z).add(isB(HB.thigh_r).mul(e5.w))).add(isB(HB.upperarm_l).mul(e7.y).add(isB(HB.upperarm_r).mul(e7.z)).mul(0.7)).mul(fadeJ);
      const bodyOff = offBr.add(offBt).add(offCh).add(offNo).add(offFace).add(vec3(0, limbY, 0));
      const bellyJ = vec3(0, xe(3).w, xe(4).w).mul(bQ.mul(bS)).mul(fadeJ);
      const bind = s.xyz.add(bodyOff).add(bellyJ).add(vec3(rad.x, hatDy, rad.y).mul(vec3(dS, 1, dS))).add(nB.mul(rowV)).add(vec3(0, bDz.mul(-BELLY.drop), bDz));
      const R = skinned(boneTex);
      const p = toWorld(vec3(dot(R[0], vec4(bind, 1)), dot(R[1], vec4(bind, 1)), dot(R[2], vec4(bind, 1))), root).toVar();
      const n = rotN(normalize(vec3(dot(R[0].xyz, nBb), dot(R[1].xyz, nBb), dot(R[2].xyz, nBb))), root);
      // drape sag (cloth only: body vertices use the slack byte for other data): slack × SAG_MAX × horizontality of the
      // vertex's main bone (its −Y axis in world is −column 1)
      const b0 = int(si.x).mul(3);
      const col1 = vec3(boneTex.load(ivec2(b0, int(slot))).y, boneTex.load(ivec2(b0.add(1), int(slot))).y, boneTex.load(ivec2(b0.add(2), int(slot))).y);
      const horiz = float(1).sub(abs(normalize(col1).y));
      const clothV = step(0.5, hmat.x).mul(step(hmat.x, 3.5));
      const sag = hext.y.mul(SAG_MAX).mul(horiz).mul(scale).mul(clothV);
      p.y.subAssign(sag);
      // D-790 (UD-27): hair and beards move: the strand cards' tips (uv.y root -> tip; the scalp's hanging locks fully, the
      // beards half, the brows not) swing in the air and trail the walk (the root's motion since the last frame); the court
      // beard's hanging mass a little. A few millimetres standing, ~1.5 cm walking; C
      const hairV = is(hmat.x, MAT.hair), cardCl = floor(hext.z.mul(255).add(0.5).div(8)), isCardV = step(PRM_CARD - 0.5, hmat.w).mul(hairV);
      const swayK = isCardV.mul(is(cardCl, 0).add(is(cardCl, 1)).add(is(cardCl, 2).add(is(cardCl, 3)).mul(0.5))).add(is(hmat.w, 3).mul(hairV).mul(0.35));
      const tipW = tS.mul(tS).mul(swayK).mul(float(1).sub(smoothstep(12, 30, camD))), vel = root.xyz.sub(rootPrev.xyz), spd = min(length(vel).mul(60), 3);
      const hph = this.hairTime.mul(1.7).add(slot.mul(1.37)), gust = sin(hph).mul(0.6).add(sin(hph.mul(2.3).add(1.1)).mul(0.4));
      const trail = vel.mul(-60 * HAIR_SWAY.trail).mul(min(spd, 1.5)).div(max(spd, 0.05)).mul(spd.mul(0.35).min(1));
      p.addAssign(vec3(gust.mul(HAIR_SWAY.air).add(trail.x), sin(hph.mul(3.1)).abs().mul(spd).mul(-HAIR_SWAY.bounce), gust.mul(HAIR_SWAY.air * 0.6).add(trail.z)).mul(tipW).mul(scale));
      // optional pieces: bit b of the person's mask (bit 0 = always worn); hidden pieces collapse to one point
      const bit = hmat.z, mask = person0.y;
      const shown = mod(floor(mask.div(exp2(bit))), 2);
      // the player's own head (flag): collapse head, jaw, eye and lid vertices (bones 5–12)
      const hideHead = mod(person7.w, 2).mul(step(4.5, si.x)).mul(step(si.x, 12.5));
      const keep = shown.mul(float(1).sub(hideHead));
      const far = vec3(0, -1e4, 0);
      p.assign(mix(far, p, keep));
      // s17 V3 (D-500): the shadow casters are coarser bodies (LOD 2 for the full-detail people): where their surface stood
      // outside the drawn one they shadowed it (stair-stepped blotches over every sunlit face and tunic at 1-10 m); each caster
      // is drawn SHADOW_SHRINK m inside its own surface, so a body shadows others and its own folds, not its own skin
      // (the head's caster further in: the coarse caster's nose and brow laid stair-stepped blots across cheeks and eyes at
      // conversation distance; a head still shadows the ground and the shoulders)
      if (opts.shadowOnly) { const headV = step(4.5, si.x).mul(step(si.x, 12.5)); p.subAssign(n.mul(mix(float(SHADOW_SHRINK), float(SHADOW_SHRINK_HEAD), headV)).mul(scale)); }
      normalLocal.assign(n);
      if (builder.needsPreviousData()) {
        const Q = skinned(prevTex);
        const pp = toWorld(vec3(dot(Q[0], vec4(bind, 1)), dot(Q[1], vec4(bind, 1)), dot(Q[2], vec4(bind, 1))), rootPrev);
        positionPrevious.assign(mix(far, pp.sub(V3(0, sag, 0)), keep));
      }
      // per-vertex colour from the person row (slot 0 = fixed colours chosen in the fragment)
      const colSlot = hmat.y;
      const colT = perTex.load(ivec2(int(max(colSlot, 1)), int(slot))).toVar();
      vColor.assign(colT.rgb.mul(step(0.5, colSlot)));
      // second colour: the trim colour on cloth (pattern motifs), the hair colour elsewhere (brows, stubble, lashes)
      const clothC = step(0.5, hmat.x).mul(step(hmat.x, 3.5));
      vHair.assign(mix(row(5).rgb, row(4).rgb, clothC));
      vMat.assign(vec4(hmat.x, hmat.w, person0.z, person0.w));
      vBind.assign(s.xyz);
      // the garment's fading susceptibility (its colour texel's w) and the bind normal's up component (D-189)
      const kFade = colT.w.mul(clothC).mul(step(colSlot, 4.5)); // (texels 5, 6 and 8 carry other data in w: D-292)
      vAux.assign(vec4(hext.x, hext.z, row(1).w, row(7).x));
      // s17 V3: the marks (texel 10), a per-vertex mask carried on skin in vExt.w (cloth's fading share there; 0 on skin):
      // + bandage coverage, − a healed scar
      const mk = row(10), wound = mk.x, skinV = is(hmat.x, MAT.skin);
      const headBand = is(wound, 1).mul(is(si.x, HB.head)).mul(float(1).sub(smoothstep(MARK.headHalf[0], MARK.headHalf[1], abs(s.y.sub(mk.z.add(MARK.headY))))));
      const armBand = is(wound, 2).mul(is(si.x, HB.lowerarm_l)).add(is(wound, 3).mul(is(si.x, HB.lowerarm_r))).mul(smoothstep(MARK.arm[0], MARK.arm[1], sw.x));
      const scarV = is(mk.y, 1).mul(is(si.x, HB.lowerarm_r)).mul(smoothstep(0.55, 0.9, sw.x));
      const bandV = max(headBand, armBand);
      vExt.assign(vec4(hext.y, hext.w, nB.y, kFade.add(skinV.mul(bandV.sub(scarV.mul(float(1).sub(bandV)))))));
      // joint wrinkles: how much the two main bones of a mixed-weight cloth vertex are turned against each other
      const bA = int(si.x).mul(3), bB = int(si.y).mul(3);
      const yA = vec3(boneTex.load(ivec2(bA, int(slot))).y, boneTex.load(ivec2(bA.add(1), int(slot))).y, boneTex.load(ivec2(bA.add(2), int(slot))).y);
      const yB = vec3(boneTex.load(ivec2(bB, int(slot))).y, boneTex.load(ivec2(bB.add(1), int(slot))).y, boneTex.load(ivec2(bB.add(2), int(slot))).y);
      const mixW = sw.x.mul(sw.y).mul(4).clamp(0, 1), bend = float(1).sub(dot(normalize(yA), normalize(yB))).mul(2).clamp(0, 1).mul(mixW).mul(clothC).mul(float(1).sub(skirtV));
      // s17 V3 (D-500): the living colour of a face (C): blood under the thin skin of the nose, the cheeks and the ears, the
      // lips' colour held down (the baked map read as lipstick in the sun), on head and jaw skin; carried in vWear.y and z
      // (cloth's joint bend and skirt folds: unused on skin)
      const hd = is(si.x, HB.head).add(is(si.x, HB.jaw)).mul(skinV), ey = mk.z, ax = abs(s.x), fr0 = smoothstep(0.1, 0.5, nB.z);
      const box = (x0: number, x1: number, y0: number, y1: number, e: number) => smoothstep(x0 - e, x0, ax).mul(float(1).sub(smoothstep(x1, x1 + e, ax))).mul(smoothstep(y0 - e, y0, s.y.sub(ey))).mul(float(1).sub(smoothstep(y1, y1 + e, s.y.sub(ey))));
      const flush = max(max(box(-1, 0.014, -0.055, -0.012, 0.016).mul(fr0).mul(0.55), box(0.026, 0.055, -0.055, -0.018, 0.014).mul(fr0).mul(0.65)), box(0.066, 0.2, -0.045, 0.012, 0.01).mul(0.8)).mul(hd);
      const lips = box(-1, 0.022, -0.088, -0.066, 0.006).mul(fr0).mul(hd);
      vWear.assign(vec4(wear.x, bend.add(flush), ampPh.mul(float(1).sub(skinV)).add(lips), wear.w));
      // D-304: the body variant's light- and dark-toned skin layers (one term per variant: arithmetic, no lookup texture)
      // D-322: the garments' fold atlas coordinate (fuv: x ≥ 2 on the lower levels of detail, which read the second layer; < 0
      // none) and the channel of the person's group
      //   packed into vSkinL.zw: z = u + 4 on the lower levels (the second fold layer), −8 none; w = v + 2 × the person's group
      if (SL || FOLD) { let sl: any = vec2(0); if (SL) SL.forEach(([a, b], k) => { sl = sl.add(vec2(a, b).mul(is(person0.x, k))); });
        let fz: any = float(-8), fw: any = float(0);
        if (FOLD) { const f = attribute('fuv', 'vec2'), lo = step(1.5, f.x), ok = step(-0.5, f.x); let gi: any = float(0); T.groups!.forEach((g, k) => { if (g) gi = gi.add(is(person0.x, k).mul(g)); });
          fz = mix(float(-8), f.x.add(lo.mul(2)), ok); fw = f.y.add(gi.mul(2)); }
        vSkinL.assign(vec4(sl, fz, fw)); }
      return p;
    })();

    // ---- fragment
    // (the look flags are an integer up to 2^17 carried by an interpolated varying: a constant interpolates to N·(b0+b1+b2),
    // which can land a hair under N, and floor() would then flip every bit above a run of zero bits; round it first)
    const m = vMat.x, prm = vMat.y, pat = floor(vMat.z.add(0.5)), e1 = vExt.x, e2 = vExt.y;
    const bits = (k: keyof typeof LOOK_BITS) => { const [lo, n] = LOOK_BITS[k]; return mod(floor(pat.div(2 ** lo)), 2 ** n); };
    const kSkin = is(m, MAT.skin), kEye = is(m, MAT.eye), kHair = is(m, MAT.hair), kTeeth = is(m, MAT.teeth), kMouth = is(m, MAT.mouth);
    const kLeather = is(m, MAT.leather), kFelt = is(m, MAT.felt), kMetal = is(m, MAT.metal), kLash = is(m, MAT.lash), kWood = is(m, MAT.wood), kWicker = is(m, MAT.wicker);
    const kCloth = is(m, MAT.cloth_main).add(is(m, MAT.cloth_second)).add(is(m, MAT.cloth_trim));
    const P = vBind, U = uv();
    const fw = max(length(P.fwidth()), 1e-6); // metres per pixel on the surface (about)
    /** 1 where a period of `f` cycles/m spans more than ~8 px, 0 under ~3 px (band-limited detail, as D-147) */
    const band = (f: any) => float(1).sub(smoothstep(0.12, 0.35, fw.mul(f)));
    const hairStyle = bits('hairStyle'), kCourt = is(hairStyle, 1), kStraight = is(hairStyle, 2);
    const isBeard = step(1.5, prm).mul(kHair), isMass = is(prm, 3).mul(kHair);
    const age01 = clamp(bits('age').sub(2).div(4), 0, 1); // 20s → 0 … 60s → 1

    // eye: planar coordinates from the eye's centre (bind frame, m) → iris polar coordinates
    const ex = e1.sub(0.5).mul(2 * EYE_UNIT), ey = e2.sub(0.5).mul(2 * EYE_UNIT);
    const er = length(vec2(ex, ey)), et = er.div(EYE.irisR), eang = atan(ey, ex);
    const irisCoord = vec3(cos(eang).mul(6), sin(eang).mul(6), et.mul(3.2));

    // ---- shared noise: three evaluations, each class scales the input (a fragment has one class)
    const fr = (skin: any, hair: any, cloth: any, felt: any, leather: any, other: any) =>
      vec3(skin).mul(kSkin).add(vec3(hair).mul(kHair.add(kLash))).add(vec3(cloth).mul(kCloth)).add(vec3(felt).mul(kFelt)).add(vec3(leather).mul(kLeather))
        .add(vec3(other).mul(float(1).sub(kSkin).sub(kHair).sub(kLash).sub(kCloth).sub(kFelt).sub(kLeather).max(0)));
    const hairF1 = mix(vec3(900, 300, 900), vec3(700, 40, 700), kStraight), hairF2 = mix(mix(vec3(260, 170, 260), vec3(190, 110, 190), isBeard), vec3(120, 15, 120), kStraight);
    const n1 = mx_noise_float(mix(P.mul(fr(SKIN.pores[0][0], hairF1, vec3(DRAPE.streak.f[0], DRAPE.streak.f[1], DRAPE.streak.f[0]), 900, 200, 60)), irisCoord, kEye)); // (cloth: bars along the weft, D-225)
    const n2 = mx_noise_float(mix(P.mul(fr(SKIN.pores[1][0], hairF2, vec3(14, 5, 14), 250, 60, 40)), vec3(ex, ey, P.x).mul(900), kEye));
    // per-person values from a hash of the person's skin and hair colours (drawn per person; the skin map is shared by
    // everyone, so its brows and blotches would otherwise repeat on every face)
    const pv = (k: number) => fract(sin(dot(vColor.add(vHair), vec3(12.9898 + k, 78.233, 37.719 + 2 * k))).mul(43758.5453));
    const n3 = mx_noise_float(P.mul(fr(30, 40, 9, 40, 20, 40)).add(vec3(pv(0).mul(57), pv(1).mul(31), pv(2).mul(13)).mul(kSkin)));
    const u1 = n1.mul(0.5).add(0.5), u2 = n2.mul(0.5).add(0.5), u3 = n3.mul(0.5).add(0.5);

    // ---- skin: baked albedo (atlas left half) and detail (right half: crease height, oil, age lines, translucency)
    // (D-307: read by textureLoad, bilinear with its own mip choice: no sampler; the atlas is 2:1, the halves 2048 × 1024 px each
    // half)
    const skW = (T.skin as any).image?.width ?? 2048, skH = (T.skin as any).image?.height ?? 1024, skL = Math.floor(Math.log2(Math.max(skW, skH))) + 1;
    const uvA = U.mul(vec2(0.5, 1));
    const sA = loadBilinear(T.skin, uvA, [skW, skH], skL), sD = loadBilinear(T.skin, uvA.add(vec2(0.5, 0)), [skW, skH], skL); // (a load indexes memory rows as a sample's uv does: no flip)
    const refLin = new THREE.Color().setRGB(...REF_TONE, THREE.SRGBColorSpace);
    const tone = vColor.div(vec3(refLin.r, refLin.g, refLin.b));
    const stub = vAux.z, roots = step(1.5, stub), stubV = min(stub, 1).mul(float(1).sub(roots));
    // blotchy redness (per person), and a fine mottling at the pore scale, band-limited like the pores (skin is not one
    // smooth colour up close; C)
    // D-304: the scanned skin (MakeHuman CC0, rescaled to REF_TONE) in place of the procedural albedo, its light- and
    // dark-toned sources blended by the person's tone; the brows stay the atlas's (per person below)
    let skinBase: any = sA.rgb;
    if (SL) { const sc = T.scans!.skin, lw = floor(vSkinL.xy.add(0.5));
      const yT = dot(vColor, vec3(0.2126, 0.7152, 0.0722)), wD = smoothstep(SCAN.darkY[0], SCAN.darkY[1], yT);
      const uS = vec2(U.x, float(1).sub(U.y)); // (the layers' rows run top-down, flipY off; the atlas's UV convention is bottom-up)
      skinBase = mix(texture(sc, uS).depth(lw.x).rgb, texture(sc, uS).depth(lw.y).rgb, wD); }
    let skinAlb: any = skinBase.mul(tone).mul(vec3(1).add(vec3(0.05, 0.03, 0.025).mul(n3))).mul(float(1).add(n2.mul(0.035).mul(band(SKIN.pores[1][0]))));
    const browA0 = smoothstep(pv(3).mul(0.4), float(1).sub(pv(4).mul(0.3)), sA.a); // sparser or denser brows per person
    // D-790: the brows as hairs, not a painted bar: strands ~0.35 mm apart and ~7 mm long, laid as brows grow (the inner ends
    // up, the body out and up, the tail out and down; C), spilling a little past the map's edge so the edge breaks into hairs;
    // band-limited: past ~1.5 m the map's soft bar is what a pixel sees
    const bax = abs(P.x), bth = mix(mix(float(1.2), float(0.42), smoothstep(0.012, 0.03, bax)), float(-0.2), smoothstep(0.04, 0.062, bax));
    const bcs = cos(bth), bsn = sin(bth), bAcross = bP(P.y, bax, bcs, bsn), bAlong = bax.mul(bcs).add(P.y.mul(bsn));
    const bStr = smoothstep(0.25, 0.9, sin(bAcross.mul(TAU * BROW.lines).add(u3.mul(7))).mul(0.5).add(0.5))
      .mul(smoothstep(0.05, 0.6, sin(bAlong.mul(TAU * BROW.len).add(u2.mul(6)).add(floor(bAcross.mul(BROW.lines)).mul(2.3))).mul(0.5).add(0.5)));
    const browEdge = smoothstep(0.04, 0.45, sA.a);
    // (the hairs lie in clumps of a few: a coarser octave that a pixel at conversation distance still resolves)
    const bClump = smoothstep(0.2, 0.8, sin(bAcross.mul(TAU * BROW.clumps).add(u3.mul(5))).mul(0.5).add(0.5)).mul(0.6).add(0.4);
    const browC = mix(browA0, min(browEdge.mul(bClump).mul(1.25), 1), band(BROW.clumps).mul(kSkin));
    const browA = mix(browC, min(browEdge.mul(bStr).mul(bClump).mul(1.7).add(browA0.mul(0.2)), 1), band(BROW.lines).mul(kSkin));
    skinAlb = mix(skinAlb, vHair.mul(0.9), browA.mul(pv(5).mul(0.25).add(0.7))); // brows
    skinAlb = mix(skinAlb, skinAlb.mul(vHair.mul(2.2).add(0.35).min(1)), vAux.y.mul(stubV).mul(0.55)); // shaven stubble
    skinAlb = mix(skinAlb, vHair.mul(0.7), vAux.y.mul(roots).mul(0.9)); // under a beard: roots
    skinAlb = mix(skinAlb, vHair.mul(0.55), e1.mul(kSkin).mul(bits('wearsHair')).mul(0.9)); // scalp under worn hair
    // s17 V3 (D-500): the marks — a linen bandage (its weave, a rusty stain where a cut bled through) and a healed scar's
    // paler, glossier skin in patches
    const kBand = smoothstep(0.3, 0.6, vExt.w).mul(kSkin), kScar = smoothstep(0.2, 0.6, vExt.w.negate()).mul(kSkin).mul(smoothstep(0.35, 0.65, n2.mul(0.5).add(0.5)));
    const bandWeave = sin(P.x.add(P.z).mul(900)).mul(sin(P.y.mul(900))).mul(0.06).mul(band(900));
    const bandCol = vec3(...MARK.linen).mul(float(0.92).add(n2.mul(0.08)).add(bandWeave));
    skinAlb = mix(skinAlb, mix(bandCol, vec3(...MARK.blood), smoothstep(0.55, 0.85, n1).mul(0.6)), kBand);
    skinAlb = mix(skinAlb, skinAlb.mul(vec3(1.18, 1.02, 0.97)).add(0.025), kScar.mul(0.8));
    // s17 V3: the face's living colour (vWear.y: flush; vWear.z: the lips) — skin only
    const flushK = vWear.y.mul(kSkin).clamp(0, 1), lipsK = vWear.z.mul(kSkin).clamp(0, 1), sLum = dot(skinAlb, vec3(0.2126, 0.7152, 0.0722));
    skinAlb = skinAlb.mul(mix(vec3(1), vec3(1.07, 0.88, 0.86), flushK.mul(0.55)));
    skinAlb = mix(skinAlb, mix(vec3(sLum), skinAlb, 0.55).mul(vec3(1.04, 0.97, 0.96)), lipsK.mul(0.6));
    const oil = sD.g, transl = sD.a;
    const poreH = n1.mul(SKIN.pores[0][1]).mul(band(SKIN.pores[0][0])).add(n2.mul(SKIN.pores[1][1]).mul(band(SKIN.pores[1][0])));
    const skinH = sD.r.sub(0.5).mul(2 * SKIN.crease).add(sD.b.sub(0.5).mul(2 * SKIN.age).mul(age01)).add(poreH);

    // ---- eye
    const irisI = bits('iris'); let irisBase: any = vec3(0);
    IRIS.forEach((c, k) => { irisBase = irisBase.add(vec3(...c).mul(is(irisI, k))); });
    const collar = exp(et.sub(0.42).div(0.08).mul(et.sub(0.42).div(0.08)).negate());
    let iris: any = irisBase.mul(u1.mul(0.55).add(0.7)).mul(collar.mul(0.4).add(1));
    iris = iris.mul(float(1).sub(smoothstep(0.78, 0.98, et).mul(0.5))); // limbal ring
    const pr = EYE.pupilR / EYE.irisR;
    iris = mix(iris, vec3(0.005), float(1).sub(smoothstep(pr - 0.04, pr + 0.04, et)));
    const irisM = float(1).sub(smoothstep(0.97, 1.04, et));
    const nasal = smoothstep(0.009, 0.0135, ex.mul(sign(P.x)).negate()); // toward the nose (left eye x > 0)
    const veins = smoothstep(0.62, 0.9, u2).mul(smoothstep(0.007, 0.012, abs(ex))).mul(0.35);
    let sclera: any = mix(vec3(...EYE.sclera), vec3(...EYE.sclera).mul(vec3(1, 0.62, 0.58)), veins);
    sclera = mix(sclera, vec3(...EYE.caruncle), nasal.mul(0.8));
    const lidSh = float(1).sub(smoothstep(-0.0015, 0.0018, ey).mul(EYE.lidShadow)) // the upper lid's shadow on the eyeball
      .mul(float(1).sub(smoothstep(0.0055, 0.0115, abs(ex)).mul(EYE.cornerShade))) // (D-790: the white turns away into the corners: a bright flat white read as a doll's)
      // (D-790: the eye's occlusion along the lower lid too: the lid and the lashes' rim shade the ball where they meet it)
      .mul(float(1).sub(smoothstep(-0.0028, -0.0058, ey).mul(EYE.lowerShade)));
    const eyeAlb = mix(sclera, iris, irisM).mul(lidSh);

    // ---- hair: natural curls, court rows of snail curls, straight strands
    const ridge = float(1).sub(abs(n2));
    const natural = ridge.mul(ridge).mul(0.75).add(u1.mul(0.25));
    const arc = atan(P.x, P.z.sub(0.02)).mul(0.085); // arc length (m) around the head
    // D-225: the court's long beard in stacked rows of spiral curls, as the reliefs carve it: on the hanging mass the rows
    // and columns come from the tube's uv (BEARD.rows rows aligned with its geometric rolls, BEARD.around curls round it);
    // the cheeks' and chin's curls in rows of BEARD.cheekRow (the scalp keeps HAIR.row)
    const massC = isMass.mul(kCourt), rowSz = mix(float(HAIR.row), float(BEARD.cheekRow), isBeard);
    const hx = mix(arc, P.x, isBeard), rowC = mix(P.y.div(rowSz), U.y.mul(BEARD.rows), massC), ri = floor(rowC);
    // cells in rows (alternate rows offset half a cell), each curl jittered in place, size and turn by a per-cell hash, and
    // blended with the natural curls so no two read alike (literal snail shells read as carving, not hair)
    const cellX = mix(hx.div(rowSz), U.x.mul(BEARD.around), massC).add(mod(ri, 2).mul(0.5)), ci = floor(cellX);
    const hsh = (a: number, b: number, c: number) => fract(sin(ri.mul(a).add(ci.mul(b))).mul(c));
    const h1 = hsh(12.9898, 78.233, 43758.5453), h2 = hsh(39.3468, 11.135, 24634.6345);
    const cu = fract(cellX).sub(0.5).add(h1.sub(0.5).mul(0.3)), cv = fract(rowC).sub(0.5).add(h2.sub(0.5).mul(0.3));
    const rr = length(vec2(cu, cv)).mul(h1.mul(0.3).add(1.7)), th = atan(cv, cu).add(h2.mul(TAU));
    // a spiral groove in each curl (beards: BEARD.turns turns, a deeper groove)
    const tuft = clamp(float(1).sub(rr.mul(rr)), 0, 1).mul(sin(th.add(rr.mul(mix(8, TAU * BEARD.turns, isBeard)))).mul(mix(0.25, 0.35, isBeard)).add(mix(0.75, 0.65, isBeard)));
    const court: any = mix(natural, tuft.mul(u1.mul(0.4).add(0.6)), mix(0.6, 0.75, massC));
    const straight = u1.mul(0.6).add(u2.mul(0.4));
    const curls = mix(mix(natural, court, kCourt), straight, kStraight);
    const hairAlb = vColor.mul(curls.mul(0.75).add(0.42)).mul(u3.mul(0.2).add(0.9));
    // (D-225: the court beard's rows as shading too: the vertex stage moved them, the vertex normal does not follow)
    const rowH = sin(fract(U.y.mul(BEARD.rows)).mul(Math.PI)).pow(0.6).sub(0.6).mul(smoothstep(0.04, 0.12, U.y)).mul(BEARD.rowAmp * 0.6).mul(massC).mul(band(BEARD.rows / 0.14 * 2));
    const hairH = curls.mul(mix(mix(HAIR.bump, HAIR.bumpStraight, kStraight), HAIR.bumpMass, massC)).mul(band(mix(200, 120, kCourt))).add(rowH);
    // ---- D-307: strand cards (hair class, PRM_CARD): the atlas cell of the card's class, the person's hair style and the
    // card's column; shade, depth, strand direction and coverage from it
    const CA = T.hairAtlas && T.cards ? T.cards : null;
    let cardCls: any = float(4), kCard: any = float(0), cardAlb: any = vec3(0), cardCov: any = float(1), cardDepth: any = float(1), cardT: any = vec3(0, -1, 0), cardN: any = null, cardAO: any = float(1);
    if (CA) {
      kCard = step(PRM_CARD - 0.5, prm).mul(kHair);
      const cellV = floor(vAux.y.mul(255).add(0.5)), cls = floor(cellV.div(8)), colC = cellV.sub(cls.mul(8)); cardCls = cls;
      let rowC: any = float(0); CA.classRows.forEach((rs, c) => rs.forEach((r, st) => { if (r) rowC = rowC.add(is(cls, c).mul(is(hairStyle, st)).mul(r)); }));
      const auv = vec2(colC.add(U.x.clamp(0.004, 0.996)).div(CA.cols), rowC.add(U.y.clamp(0.004, 0.996)).div(CA.rows));
      const at = loadBilinear(T.hairAtlas!, auv, [CA.w, CA.h], CA.levels); // (textureLoad: no sampler)
      cardDepth = at.g; cardCov = at.a;
      cardAlb = vColor.mul(at.r.mul(2)).mul(mix(float(CARD.back), float(1), at.g));
      // the strand direction: dp/dv (root → tip) and dp/du (across) from the screen derivatives, turned by the atlas' B
      const dpx = positionView.dFdx(), dpy = positionView.dFdy(), dux = U.dFdx(), duy = U.dFdy();
      const det = dux.x.mul(duy.y).sub(dux.y.mul(duy.x)).add(1e-12);
      const pV = normalize(dpy.mul(dux.x).sub(dpx.mul(duy.x)).div(det).add(vec3(0, 1e-9, 0))), pU = normalize(dpx.mul(duy.y).sub(dpy.mul(dux.y)).div(det).add(vec3(1e-9, 0, 0)));
      const tx = at.b.mul(2).sub(1).mul(CARD.tilt).clamp(-0.95, 0.95);
      cardT = normalize(pV.mul(sqrt(float(1).sub(tx.mul(tx)))).add(pU.mul(tx)));
      // D-323: the normal atlas (rendered from the hair curves' locks): the card's shading normal turned across and along it
      if (CA.normal && T.hairNormal) {
        const na = loadBilinear(T.hairNormal, auv, [CA.normal.w, CA.normal.h], CA.normal.levels);
        const nx = na.r.mul(2).sub(1).mul(CARD.normal), ny = na.g.mul(2).sub(1).mul(CARD.normal), nz = sqrt(float(1).sub(nx.mul(nx)).sub(ny.mul(ny)).max(0.04));
        cardN = normalize(normalView.mul(nz).add(pU.mul(nx)).add(pV.mul(ny)));
        cardAO = na.b;
        cardAlb = cardAlb.mul(mix(float(1), cardAO, CARD.aoAlb));
      }
    }
    const kShell = kHair.mul(float(1).sub(kCard));
    const kohlK = bits('kohl').mul(float(1).sub(smoothstep(KOHL.band * 0.7, KOHL.band * 1.3, e1))); // D-215
    const lashAlb = mix(vHair.mul(0.45), vec3(...KOHL.alb), kohlK);

    // ---- cloth: dyed wool or linen; weave, folds, mottling, motifs
    const isLinen = is(m, MAT.cloth_main).mul(mod(bits('linen'), 2)).add(is(m, MAT.cloth_second).mul(mod(floor(bits('linen').div(2)), 2))).add(is(m, MAT.cloth_trim).mul(floor(bits('linen').div(4))));
    const pat0 = mod(bits('motif'), 2);
    const cell = fract(vec2(P.x.add(P.z.mul(0.7)), P.y).mul(22)).sub(0.5), cr = length(cell), cth = atan(cell.y, cell.x);
    // D-304: a rosette of petals round an eye (the Susa glazed-brick and garment rosettes), not a dot: 8 petals, a ring of
    // ground colour between the petals and the eye (C for the woven form; a plain disc read as polka dots)
    const petal = cr.div(cos(cth.mul(8)).mul(0.28).add(0.72)), eye = float(1).sub(smoothstep(0.05, 0.075, cr));
    const rose = max(float(1).sub(smoothstep(0.21, 0.26, petal)).mul(smoothstep(0.08, 0.1, cr)), eye).mul(pat0).mul(is(m, MAT.cloth_main));
    const trimCol = vHair; // motif colour = the person's trim colour (C)
    // (s17 V3, D-500: worn cloth is not one colour: ±11 % in 11 cm mottles and ±6 % in the 7 × 20 cm patches of wear, sweat and
    // washing, was ±5 %: at 2-5 m a garment read as one flat, plastic sheet; C)
    let clothAlb: any = vColor.mul(float(1).add(n3.mul(0.11)).add(n2.mul(0.06)).add(n1.mul(DRAPE.streak.alb).mul(band(DRAPE.streak.f[1]))));
    // D-225: uneven dyeing — the chroma varies about the garment's own (linear in the noise: the mean colour is kept)
    const dLum = dot(clothAlb, vec3(0.2126, 0.7152, 0.0722));
    clothAlb = vec3(dLum).add(clothAlb.sub(vec3(dLum)).mul(float(1).add(n2.mul(DRAPE.dyeUneven[0])).add(n1.mul(DRAPE.dyeUneven[1]).mul(band(DRAPE.streak.f[1])))));
    clothAlb = mix(clothAlb, trimCol, rose);
    // sun-bleaching (D-189): up-facing outer cloth of an old garment fades toward a paler, greyer colour, by the dye's
    // susceptibility (weld fast, indigo slowly); linings (cavity 150/255) and the undersides keep their dye
    const upF = smoothstep(-0.25, 0.75, vExt.z).mul(smoothstep(0.66, 0.8, vAux.x)).mul(n3.mul(0.3).add(0.85));
    const fadeAmt = vWear.x.mul(vExt.w.max(0).mul(kCloth)).mul(upF).mul(DRAPE.fade).clamp(0, 0.8);
    const cLum = dot(clothAlb, vec3(0.2126, 0.7152, 0.0722));
    clothAlb = mix(clothAlb, mix(vec3(cLum), clothAlb, 0.4).mul(1.25).add(0.012).min(0.8), fadeAmt);
    const nb = normalize(cross(P.dFdx(), P.dFdy()).add(vec3(0, 1e-9, 0))), ax = abs(nb.x), az = abs(nb.z);
    const sH = P.x.mul(az).add(P.z.mul(ax)).div(ax.add(az).add(1e-4)); // horizontal coordinate on the garment
    // D-225: a tabby weave — warp thread i over weft thread j where i + j is even: each thread a round section whose height
    // follows its crimp over and under the crossing threads; the higher of warp and weft is the surface (C)
    const fq = mix(DRAPE.weave.fq[0], DRAPE.weave.fq[1], isLinen); // threads per metre: coarse wool, fine linen (C)
    const wu = sH.mul(fq), wv = P.y.mul(fq), su = float(1).sub(mod(floor(wu), 2).mul(2)), sv = float(1).sub(mod(floor(wv), 2).mul(2));
    const thread = (x: any) => sqrt(max(float(1).sub(fract(x).mul(2).sub(1).mul(fract(x).mul(2).sub(1))), 0));
    const weave01 = max(thread(wu).mul(sin(wv.mul(Math.PI)).mul(su).mul(0.5).add(0.5)), thread(wv).mul(sin(wu.mul(Math.PI)).mul(sv).mul(-0.5).add(0.5)));
    // D-304: the scanned textile (linen, wool), felt and leather, triplanar in bind space (the weave moves with the cloth):
    // RGB the scan over its own mean (× 1/k), A its height about 0.5; one array texture, the layer per class. It replaces
    // the procedural tabby where loaded (the mip chain band-limits it); the dye, streaks, folds and wear stay
    let scanDet: any = vec3(1), scanH: any = float(0);
    const SC = T.scans;
    if (SC) { const tl = SC.cloth_.map(c => c.tile ?? 0.25), lay = kCloth.mul(float(1).sub(isLinen)).add(kFelt.mul(2)).add(kLeather.mul(3));
      const tile = float(tl[0]).add(is(lay, 1).mul(tl[1] - tl[0])).add(is(lay, 2).mul(tl[2] - tl[0])).add(is(lay, 3).mul(tl[3] - tl[0]));
      const q = P.div(tile), w0 = pow(abs(nb), vec3(4)), wt = w0.div(max(dot(w0, vec3(1)), 1e-4));
      const smp = (c: any) => texture(SC.cloth, c).depth(lay.add(SC.clothBase ?? 0)); // (D-307: the cloth's layers follow the skin's in one array)
      const sT = smp(q.zy).mul(wt.x).add(smp(q.xz).mul(wt.y)).add(smp(q.xy).mul(wt.z));
      scanDet = sT.rgb.mul(1 / SC.clothK); scanH = sT.a.sub(0.5); }
    const weaveK = band(fq);
    const weaveH = SC ? scanH.mul(mix(SCAN.cloth.h[1], SCAN.cloth.h[0], isLinen)) : weave01.sub(0.5).mul(mix(DRAPE.weave.h[0], DRAPE.weave.h[1], isLinen)).mul(weaveK);
    clothAlb = SC ? clothAlb.mul(mix(vec3(1), scanDet, mix(SCAN.cloth.alb[1], SCAN.cloth.alb[0], isLinen)))
      : clothAlb.mul(float(1).add(weave01.sub(0.5).mul(DRAPE.weave.alb).mul(weaveK))); // the crossings lit, the gaps dark
    // pleated skirts (prm 1: the court robe, the woman's dress): a triangle-wave pleat field around the body, vertical in
    // the front and slanting up to the belt at the sides (the robe drawn up to the belt on the reliefs: B for the pattern,
    // C for its geometry). 26 pleats cannot be carried by a 40-segment tube (1.5 segments each), so they are shading.
    const thB = atan(P.x, P.z.sub(0.02)), sideS = smoothstep(0.35, 0.9, abs(sin(thB)));
    const pleatT = abs(fract(thB.mul(26 / TAU).add(P.y.mul(9).mul(sign(thB)).mul(sideS))).sub(0.5)).mul(2);
    const pleatH = pleatT.sub(0.5).mul(0.003).mul(is(prm, 1)).mul(band(21));
    // D-225: the court robe's skirt carries its pleats in the mesh (drape.ts ROBE); the material sharpens each fold's valley
    // into a crease and adds fine creases in the front pleat stack, from the tube's column parameter (uv.x = −½ … ½, so
    // |θ| is exact); the one seam quad at the back centre (uv.x jumps there) is masked by its uv derivative
    const uR = abs(U.x), aR = uR.mul(TAU).sub(sin(uR.mul(TAU)).mul(ROBE.warp)), tR = U.y;
    const pmR = float(1).sub(smoothstep(ROBE.panel, ROBE.panel + 0.12, aR)), sideR = smoothstep(ROBE.panel, ROBE.panel + 0.15, aR).mul(float(1).sub(smoothstep(2.3, 2.7, aR))), backR = smoothstep(2.3, 2.7, aR);
    const valley = (c: any) => float(1).sub(smoothstep(0, 0.3, abs(c)));
    const qR = aR.div(2 * ROBE.panel).mul(ROBE.panelPleats * 2);
    const robeH = valley(cos(aR.sub(ROBE.panel).sub(tR.mul(ROBE.sideTwist)).mul(ROBE.sideN / 2))).mul(sideR).mul(tR.mul(0.7).add(0.3))
      .add(valley(cos(aR.mul(ROBE.backN / 2))).mul(backR).mul(tR))
      .add(valley(sin(qR.mul(Math.PI))).mul(pmR).mul(0.6)).add(valley(sin(qR.mul(Math.PI * ROBE.fine))).mul(pmR).mul(0.2))
      .mul(-ROBE.crease).mul(is(prm, PRM_ROBE)).mul(band(60)).mul(float(1).sub(smoothstep(0.015, 0.04, U.x.fwidth())));
    // (a head-cloth, prm 4, takes shallower drape folds: on the head the vertical fold noise read as lumps)
    // the skirt's hem folds as shading too (the same field the vertex stage displaced; the vertex normal does not follow)
    const skirtF = vAux.y.mul(kCloth), tU = U.y, thU = atan(P.x, P.z.sub(0.02)), phF = fract(vWear.z).mul(TAU), ampF = floor(vWear.z).mul(0.001);
    const lowF = sin(thU.mul(DRAPE.foldLow[0]).add(phF)).mul(0.55).add(sin(thU.mul(DRAPE.foldLow[1]).add(phF.mul(1.7)).add(1)).mul(0.45));
    const highF = sin(thU.mul(DRAPE.foldHigh[0]).add(phF.mul(2.3))).mul(0.6).add(sin(thU.mul(DRAPE.foldHigh[1]).add(phF.mul(3.1)).add(2)).mul(0.4))
      .mul(float(1).sub(smoothstep(DRAPE.highNear[0], DRAPE.highNear[1], length(positionView))));
    const foldH = tU.mul(tU).mul(ampF).mul(lowF.mul(0.7).add(highF.mul(0.6)).add(0.6)).mul(skirtF);
    // joint wrinkles: rings across the limb where it bends (bind pose: limbs roughly along Y)
    const wrinkleH = sin(P.y.mul(DRAPE.wrinkleF * TAU).add(n2.mul(3))).mul(DRAPE.wrinkle).mul(vWear.y).mul(band(DRAPE.wrinkleF));
    // D-206: hems (doubled, rolled cloth at a shell's cut line and a skirt's hem) and the gathers the belt draws in above it
    const hem = max(float(1).sub(smoothstep(0, DRAPE.hemBand, e2)).mul(float(1).sub(vAux.y)), vAux.y.mul(smoothstep(0.93, 0.99, U.y))).mul(kCloth);
    const hemH = sin(hem.mul(Math.PI)).mul(DRAPE.hemRoll);
    const gz = float(1).sub(smoothstep(0, DRAPE.gatherH, U.y)).mul(step(-0.03, U.y)).mul(is(prm, PRM_UPPER)).mul(kCloth);
    const gatherH = sin(thB.mul(DRAPE.gatherN).add(n2.mul(1.5))).mul(DRAPE.gather).mul(gz).mul(band(DRAPE.gatherN / 0.9));
    // D-225: folds hanging from the chest down to the belt on the upper garments (their phase wanders with the drape noise)
    const hz = float(1).sub(smoothstep(0.04, DRAPE.hang.top, U.y)).mul(step(-0.03, U.y)).mul(is(prm, PRM_UPPER)).mul(kCloth);
    const hangH = sin(thB.mul(DRAPE.hang.n).add(n3.mul(2.5))).mul(DRAPE.hang.h).mul(hz).mul(band(DRAPE.hang.n / 0.9));
    clothAlb = clothAlb.mul(float(1).sub(hem.mul(DRAPE.hemDark)));
    // D-322: with the garments re-cut from Blender's cloth simulations (T.simCloth), their folds, pleats, gathers and blousing
    // are in the geometry: the shading stand-ins for them (the pleat field, the robe's creases, the gathers and the hanging
    // folds of the upper garments: "pleats as a shading stripe", B121) are left out
    const fake = T.simCloth ? 0 : 1;
    // D-322: the settled cloth's folds finer than the mesh (the fold layers: people_cloth's post-step), in the garment's own
    // atlas; faded where a triangle spans a chart's seam (its atlas coordinate jumps: the tubes' back seam, the body UV's)
    let simFoldH: any = float(0), foldGx: any = null, foldGy: any = null;
    if (FOLD) { const z = vSkinL.z, lo = step(3.5, z), ok = step(-0.5, z), gi = floor(vSkinL.w.mul(0.5).add(0.25)), fu = vec2(z.sub(lo.mul(4)), vSkinL.w.sub(gi.mul(2))), sd = floor(gi.div(3).add(0.01)), gr = gi.sub(sd.mul(3));
      const seamF = float(1).sub(smoothstep(0.02, 0.05, max(fu.x.fwidth(), fu.y.fwidth())));
      // s17 V3 (D-500): the fold layers' slope by central differences two texels apart, carried to the screen by the atlas
      // coordinate's own derivatives (smooth across texels): the screen derivative of the 8-bit, bilinear height stepped from
      // texel to texel and drew stair-stepped dark streaks over every dress and sleeve at 1-3 m
      const layer = lo.add(sd.mul(2)).add(FOLD.foldBase), wsel = vec3(is(gr, 0), is(gr, 1), is(gr, 2)), D = 2 / 1024;
      const Hs = (ou: number, ov: number) => dot(texture(FOLD.cloth, fu.add(vec2(ou, ov))).depth(layer).rgb, wsel);
      const kf = float(2 * FOLD.foldScale).mul(ok).mul(seamF).mul(kCloth);
      const hu = Hs(D, 0).sub(Hs(-D, 0)).div(2 * D).mul(kf), hv = Hs(0, D).sub(Hs(0, -D)).div(2 * D).mul(kf);
      foldGx = hu.mul(fu.x.dFdx()).add(hv.mul(fu.y.dFdx())); foldGy = hu.mul(fu.x.dFdy()).add(hv.mul(fu.y.dFdy())); }
    const clothH = n2.mul(mix(DRAPE.lump, 0.0012, is(prm, 4))).add(n1.mul(mix(DRAPE.streak.h[0], DRAPE.streak.h[1], isLinen)).mul(band(DRAPE.streak.f[1]))).add(weaveH).add(simFoldH).add(pleatH.mul(fake)).add(robeH.mul(fake)).add(foldH).add(wrinkleH).add(hemH).add(gatherH.mul(fake)).add(hangH.mul(fake)); // linen is smoother than wool

    // ---- felt, leather, metal, wood, wicker
    const feltAlb = vColor.mul(float(1).add(n3.mul(0.1)).add(n1.mul(0.05))).mul(mix(vec3(1), scanDet, SC ? SCAN.cloth.alb[2] : 0));
    const seam = exp(P.x.div(0.0022).mul(P.x.div(0.0022)).negate()).mul(0.00045).mul(is(prm, 0)); // the soft cap's centre seam (C)
    const feltH = n1.mul(0.00008).mul(band(900)).add(n2.mul(0.00015).mul(band(250))).add(seam).add(scanH.mul(SCAN.cloth.h[2]));
    const leatherAlb = vColor.mul(float(1).add(n2.mul(0.08))).mul(mix(vec3(1), scanDet, SC ? SCAN.cloth.alb[3] : 0));
    const leatherH = SC ? scanH.mul(SCAN.cloth.h[3]) : n1.mul(0.0002).mul(band(200));
    const metalAlb = mix(mix(vec3(0.62, 0.43, 0.24), vec3(0.8, 0.8, 0.78), is(prm, 1)), vec3(0.9, 0.7, 0.32), is(prm, 2)).mul(float(1).sub(is(prm, 3).mul(0.5)));
    const woodAlb = vec3(0.36, 0.25, 0.15).mul(float(1).add(sin(P.y.mul(900).add(n3.mul(3))).mul(0.06)));
    const wickerAlb = vec3(0.6, 0.5, 0.3).mul(float(0.85).add(abs(sin(P.x.mul(300))).mul(0.15)));

    let alb: any = skinAlb.mul(kSkin).add(eyeAlb.mul(kEye)).add(mix(hairAlb, cardAlb, kCard).mul(kHair)).add(vec3(0.7, 0.66, 0.58).mul(kTeeth)).add(vec3(0.32, 0.1, 0.09).mul(kMouth))
      .add(leatherAlb.mul(kLeather)).add(feltAlb.mul(kFelt)).add(metalAlb.mul(kMetal)).add(lashAlb.mul(kLash)).add(woodAlb.mul(kWood)).add(wickerAlb.mul(kWicker)).add(clothAlb.mul(kCloth));
    // grime by work (C): dust toward the hem and the feet, patchy; court dress stays clean (grime ≈ 0)
    const grime = vMat.w, grimeCol = vec3(vAux.w, vAux.w, vAux.w).mul(vec3(1, 0.97, 0.9));
    const low = float(1).sub(smoothstep(0.1, 0.9, P.y)), feet = float(1).sub(smoothstep(0.02, 0.14, P.y));
    // the trade's contact zones (bind pose: arms hanging, hands at the thighs; C): hands and forearms (stone), the front
    // below the chest and the forearms (flour), shoulders and upper back (loads)
    const zone = bits('grimeZone'), zHands = is(zone, 1).add(is(zone, 2)), zFront = is(zone, 2), zLoad = is(zone, 3);
    const arms = smoothstep(0.15, 0.2, abs(P.x)).mul(float(1).sub(smoothstep(1.02, 1.12, P.y)));
    const front = smoothstep(0.02, 0.08, P.z).mul(smoothstep(0.72, 0.8, P.y)).mul(float(1).sub(smoothstep(1.2, 1.3, P.y))).mul(float(1).sub(smoothstep(0.14, 0.18, abs(P.x))));
    const load = smoothstep(1.28, 1.36, P.y).mul(smoothstep(0.06, 0.1, abs(P.x)).max(float(1).sub(smoothstep(-0.05, 0.0, P.z))));
    const where = low.max(arms.mul(zHands)).max(front.mul(zFront)).max(load.mul(zLoad).mul(0.8));
    const grimeMask = grime.mul(where).mul(kCloth.add(kSkin.mul(feet.mul(0.65).add(0.35).max(arms.mul(zHands)))).add(kLeather.mul(0.8)).add(kFelt.mul(0.3))).mul(u3.mul(0.6).add(0.7));
    alb = mix(alb, grimeCol, grimeMask.mul(0.35));
    // hem soil (D-189): dust toward the ground on everyone who walks outdoors, strongest in the last hand's breadth of a
    // skirt; patchy
    const hemBand = float(1).sub(smoothstep(0.03, 0.3, P.y)).max(vAux.y.mul(kCloth).mul(smoothstep(0.72, 1, U.y).mul(0.7).add(smoothstep(DRAPE.hemEdge[0], 1, U.y).mul(DRAPE.hemEdge[1]))));
    const soilMask = vWear.w.mul(hemBand).mul(kCloth.add(kLeather.mul(0.8)).add(kSkin.mul(feet).mul(0.6))).mul(u2.mul(0.8).add(0.6)).mul(DRAPE.soil).clamp(0, 0.75);
    alb = mix(alb, vec3(...DRAPE.dust), soilMask);
    this.colorNode = alb;
    // roughness: skin broad lobe (the oily lobe is separate), eyes wet, cloth by fibre, dust makes things matte
    this.roughnessNode = soilMask.mul(0.15).add(kSkin.mul(float(SKIN.roughSheen).sub(oil.mul(0.08)).add(n1.mul(0.06).mul(band(SKIN.pores[0][0])))).add(kEye.mul(mix(0.1, 0.035, irisM))).add(kHair.mul(0.5)).add(kTeeth.mul(0.25)).add(kMouth.mul(0.3))
      .add(kLeather.mul(0.55)).add(kFelt.mul(0.95)).add(kMetal.mul(0.32)).add(kLash.mul(0.6)).add(kWood.mul(0.55)).add(kWicker.mul(0.85)).add(kCloth.mul(mix(0.92, 0.8, isLinen))).add(grimeMask.mul(0.2)).add(kBand.mul(0.4)).sub(kScar.mul(0.12))).min(1);
    this.metalnessNode = kMetal;
    // specular F0 (dielectrics): skin 0.028, cornea 0.025, hair cuticle 0.046, others 0.04 (setupSpecular)
    this.f0Node = float(0.04).sub(kSkin.mul(0.04 - SKIN.f0)).sub(kEye.mul(0.04 - EYE.f0)).add(kHair.mul(0.006));
    // cavity occlusion (indirect light), weaker on the eyeball (the socket's ray-cast cavity greyed the whites); curl valleys
    this.aoNode = mix(float(1), vAux.x, float(0.85).sub(kEye.mul(0.45))).mul(mix(float(1), curls.mul(0.45).add(0.55), kShell)).mul(mix(float(1), cardDepth.mul(0.35).add(0.65).mul(mix(float(1), cardAO, CARD.aoAmb)), kCard));
    // shading normal: curls on hair, creases and pores on skin, folds and weave on cloth, fibres on felt, grain on leather
    const h = hairH.mul(kShell).add(skinH.mul(kSkin)).add(clothH.mul(kCloth)).add(feltH.mul(kFelt)).add(leatherH.mul(kLeather));
    const bh = bumped(h, foldGx, foldGy); this.normalNode = cardN ? mix(bh, cardN, kCard).normalize() : bh;
    // lighting-model inputs
    const curv = e2.mul(SKIN_CURV_MAX);
    const skinWrap = vec3(...SKIN.scatter).mul(curv).min(SKIN.wrapMax).add(vec3(...SKIN.wrapBase));
    this.S = {
      // micro-shadowing of the direct light by the baked cavity (D-189): skin, cloth, felt, leather fully, hair half; not the eyeball
      micro: vAux.x, microK: kSkin.add(kCloth).add(kFelt).add(kLeather).add(kHair.mul(0.5)).mul(DRAPE.micro),
      wrap: skinWrap.mul(kSkin).add(vec3(kHair.mul(0.25).add(kFelt.mul(0.1)).add(kCloth.mul(0.05)))),
      trans: vec3(...SKIN.transTint).mul(transl.mul(kSkin).mul(SKIN.trans)),
      roughB: float(SKIN.roughOil), lobeB: kSkin.mul(mix(SKIN.oilLobe[0], SKIN.oilLobe[1], oil)),
      // the primary strand highlight fades toward a shell's frayed edge (D-189: at the moustache's cut line it read as frost)
      kkEdge: smoothstep(0.3, 1, e2).mul(band(260).mul(0.6).add(0.4)), /* (D-304: a sharp strand highlight on sub-pixel curls sparkles: dimmed where they are unresolved) */ kHair, hairTilt: curls.sub(0.5).mul(1.6),
      sheenCol: mix(vec3(1), clothAlb.mul(2).min(1), 0.5).mul(kCloth.mul(mix(0.22, 0.14, isLinen)).add(kFelt.mul(0.25))),
      sheenRough: kCloth.mul(mix(0.55, 0.35, isLinen)).add(kFelt.mul(0.7)).add(float(1).sub(kCloth).sub(kFelt).mul(0.5)),
      specOcc: mix(float(1), vAux.x, kSkin.mul(0.5)).mul(mix(float(1), curls.mul(0.6).add(0.4), kShell)).mul(mix(float(1), cardDepth.mul(0.6).add(0.4), kCard)),
      kCard, cardT,
      roughEnv: kSkin.mul(0.45).add(kEye.mul(0.04)).add(kHair.mul(0.5)).add(kTeeth.mul(0.3)).add(kMouth.mul(0.3)).add(kLeather.mul(0.55)).add(kMetal.mul(0.32)).add(kWood.mul(0.6)).add(kWicker.mul(0.8)).add(kCloth.add(kFelt).add(kLash).mul(0.9)),
      envMask: kSkin.add(kEye.mul(1.2)).add(kHair.mul(0.2)).add(kTeeth.mul(0.6)).add(kMouth.mul(0.4)).add(kLeather.mul(0.6)).add(kMetal).add(kWood.mul(0.3)).add(kWicker.mul(0.2)),
    };
    // alpha test (shadows follow): hair frays at a shell's cut line (vEdge → 0; sparse beards fray wider) and its outline
    // is scalloped by the curls where the surface turns away; lashes are cut into tapering clumps
    const silh = float(1).sub(abs(dot(normalViewGeometry, positionViewDirection)));
    // the fray band: the outer 70 % of a shell's ramp; a sparse beard frays over a wider band (its interior stays covered:
    // cutting holes through it read as spots); natural beards fray on the fine strand pattern, not the curl blobs
    const cover = smoothstep(0, float(0.7).add(bits('beard').mul(0.35).mul(isBeard)), e2);
    const frayPat = mix(curls.mul(0.55).add(u1.mul(0.35)), u1.mul(0.75).add(curls.mul(0.15)), isBeard.mul(float(1).sub(kCourt)));
    // natural beards also let the (darkened) skin show through at the strand scale, more where sparse; under TRAA this
    // averages to partial coverage (C)
    const speckle = isBeard.mul(float(1).sub(kCourt)).mul(step(float(0.92).sub(bits('beard').mul(0.1)), u1)).mul(step(0.5, band(900))); // (D-304: only where a strand spans pixels: sub-pixel holes read as salt in the beard under fire light)
    const edgeCut = max(step(cover.mul(1.15), frayPat), speckle);
    const silCut = step(curls.add(0.3), silh.sub(0.45).mul(2.8));
    // (lower strip, e2 = 1: fewer, finer clumps)
    const along = U.x.sub(LASH.u0).div(LASH.u1 - LASH.u0), tl = e1;
    const clumpC = abs(fract(along.mul(mix(LASH.clumps, LASH.clumps * 0.6, e2)).add(n1.mul(0.35))).sub(0.5)).mul(2);
    const lashW = float(1).sub(tl).mul(float(1).sub(tl).max(0).sqrt()).mul(0.8).add(0.1).mul(mix(1, 0.7, e2));
    const lashCut = max(step(lashW, clumpC), step(0.9, tl)).mul(float(1).sub(bits('kohl').mul(step(tl, KOHL.band)))); // (kohl: the root band solid)
    // D-307: a card is cut where the atlas' coverage is under the test its mips were made for (a fixed threshold: TRAA
    // antialiases the edges; a per-pixel hashed threshold read as speckled noise in the first review)
    let cThr: any = float(0), cDith: any = float(0); CARD.byClass.forEach(([t, d], c) => { cThr = cThr.add(is(cardCls, c).mul(t)); cDith = cDith.add(is(cardCls, c).mul(d)); });
    const cardThr = interleavedGradientNoise(screenCoordinate.xy.add(vec2(float(frameId).mod(64).mul(5.588238)))).sub(0.5).mul(cDith).add(cThr);
    const cardCut = step(cardCov, cardThr);
    this.maskNode = float(1).sub(kShell.mul(max(edgeCut, silCut))).sub(kCard.mul(cardCut)).sub(kLash.mul(lashCut)).greaterThan(0.5);
    // shadow-only copies (the player's head; the cheaper shadow casters of full-detail people): no colour, no depth, and
    // a constant fragment so the main pass only pays for vertices; the shadow pass uses this positionNode
    if (opts.shadowOnly) { this.colorWrite = false; this.depthWrite = false; this.fragmentNode = vec4(0, 0, 0, 1); }
    void clamp; void sqrt; void diffuseColor; void metalness; void roughness;
  }
  setupSpecular() {
    const f0 = vec3(this.f0Node);
    specularColor.assign(f0); specularColorBlended.assign(mix(f0, diffuseColor.rgb, metalness)); specularF90.assign(1.0);
  }
  setupLightingModel() { return new HumanLightingModel(this.S) as any; }
  private texNodes: any[] = [];
  /** point every texture node that samples `old` at `t` (the crowd grows its palette textures) */
  retexture(old: THREE.Texture, t: THREE.Texture) { for (const n of this.texNodes) if (n.value === old) n.value = t; }
}
