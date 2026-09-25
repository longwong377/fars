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
  Fn, attribute, texture, uv, vec2, vec3, vec4, float, int, ivec2, mix, step, abs, max, min, floor, clamp, dot, normalize, exp2, smoothstep, sin, cos,
  varyingProperty, normalLocal, positionPrevious, positionView, normalView, normalViewGeometry, positionViewDirection, sign, mx_noise_float, diffuseColor,
  diffuseContribution, specularColor, specularColorBlended, specularF90, metalness, roughness, mod, fract, length, sqrt, atan, exp, pow, cross,
  cameraViewMatrix, BRDF_GGX, F_Schlick, BRDF_Lambert, cameraPosition,
} = TSL as any; // TSL's typings do not follow mixed float/vec3 arithmetic; the graph is checked when it builds
import { MAT, EYE_UNIT, SKIN_CURV_MAX, LOOK_BITS, PRM_UPPER } from './humanFormat';

/** height field → shading normal (view space; surface gradient from screen-space derivatives, Mikkelsen 2010) */
function bumped(h: any) {
  const dpdx = positionView.dFdx(), dpdy = positionView.dFdy(), n = normalView;
  const r1 = dpdy.cross(n), r2 = n.cross(dpdx), det = dpdx.dot(r1);
  const grad = sign(det).mul(h.dFdx().mul(r1).add(h.dFdy().mul(r2)));
  return abs(det).mul(n).sub(grad).normalize();
}
/** 1 when the (rounded) class id equals k, else 0 (arithmetic, no branches) */
const is = (m: any, k: number) => float(1).sub(step(0.5, abs(m.sub(k))));
const TAU = Math.PI * 2;

export interface HumanTextures {
  /** RGBA32F: xyz bind position, w packed normal; row-major over variant × NV vertices */
  source: THREE.DataTexture; sourceWidth: number; NV: number;
  /** RGBA32F: one row per slot, 177 texels (59 bones × 3 rows of a 3×4 matrix) */
  bones: THREE.DataTexture; prevBones: THREE.DataTexture;
  /** RGBA32F: one row per slot, 8 texels (see PERSON_TEXELS) */
  person: THREE.DataTexture;
  /** skin.png: a 2:1 atlas, left half albedo (RGB) + brows (A), right half detail (SKIN_DETAIL); eye.png is no longer
   *  sampled (the eye is procedural, D-155) */
  skin: THREE.Texture; eye: THREE.Texture;
}
/** person texel layout: 0 [variant, piece mask, look flags (LOOK_BITS), grime], 1 [skin tone, stubble], 2 main, 3 second,
 *  4 trim (w: the garment's fading susceptibility, D-189), 5 hair, 6 leather, 7 [grime brightness, scale, hat height (D-189), flags],
 *  8 felt/headgear, 9 wear [garment age, fit (m), fold amplitude (mm) + phase, hem soil] (looks.wearTexel, D-189).
 *  stubble (1.w): 0 none, 0..1 shaven stubble, 2 = bearded (the skin under the beard reads as roots) */
export const PERSON_TEXELS = 10;
/** reference skin tone the baked albedo was authored for (sRGB; tools/humans/skin.ts REF_TONE) */
export const REF_TONE: [number, number, number] = [0.72, 0.53, 0.42];
/** drape: a slack cloth vertex drops this far (m) when its main bone is horizontal (wide sleeves, seated skirts; C) */
export const SAG_MAX = 0.1;
/** Cloth wear and drape (D-189, C). Skirts: the hem is folded per person (two low orders round the hem at every LOD, two
 *  higher orders near the camera, where the 40-segment tube can carry them) and fitted (ease at the hem), growing with
 *  the square of the way down the skirt. Fading: sun-bleaching on up-facing cloth (the garment's age × its dye's
 *  susceptibility). Hem soil: dust toward the ground. Joint wrinkles: rings across a sleeve or trouser leg where it bends
 *  (the two bones' relative rotation where the skin weights mix). Micro-shadowing: the baked cavity also darkens the
 *  direct light (after Chan 2018's micro-shadows), so eye sockets, the nose's underside and cloth folds read in sun. */
export const DRAPE = { foldLow: [2, 3] as [number, number], foldHigh: [7, 10] as [number, number], highNear: [15, 24] as [number, number],
  fade: 0.6, soil: 0.55, dust: [0.34, 0.28, 0.2] as RGB, wrinkle: 0.0014, wrinkleF: 26, micro: 1, hatH: 0.154,
  /** D-206 (C): hems — a shell's cut line (the outer 30 % of its ramp, and the turned edge) and a skirt's last hand's
   *  breadth — are doubled cloth: darker by hemDark and rolled (a ridge of hemRoll m); gathers above the belt on the upper
   *  garments (class parameter 5, uv.y = height above the belt, m): gatherN folds round the body, gather m deep, fading out
   *  over gatherH m */
  hemBand: 0.3, hemDark: 0.14, hemRoll: 0.0007, gather: 0.0024, gatherN: 22, gatherH: 0.07 };

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
export const EYE = { irisR: 0.0059, pupilR: 0.0015, sclera: [0.64, 0.6, 0.55] as RGB, caruncle: [0.6, 0.36, 0.34] as RGB, lidShadow: 0.45, f0: 0.025 };
export const IRIS: RGB[] = [[0.04, 0.02, 0.009], [0.062, 0.032, 0.013], [0.095, 0.05, 0.02], [0.13, 0.072, 0.03], [0.14, 0.1, 0.045], [0.11, 0.115, 0.06], [0.11, 0.13, 0.105], [0.1, 0.14, 0.18]];
/** lash strips (MakeHuman helper UVs span u 0.704–0.762 along both lids): clumps along the lid, tapering to the tip */
export const LASH = { u0: 0.704, u1: 0.762, clumps: 72 };
/** hair: the court dressing's curl rows (m; the relief convention, C for real hair); curl bump heights (m) */
export const HAIR = { row: 0.008, bump: 0.0011, bumpStraight: 0.0008, kk: [0.09, 0.06] as [number, number] };

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
    const T = t0.add(b0.mul(S.hairTilt)).normalize();
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

export class HumanMaterial extends THREE.MeshStandardNodeMaterial {
  private S: Record<string, any> = {}; private f0Node: any;
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
    const vWear = varyingProperty('vec4', 'vHumanWear');
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
      const bind = s.xyz.add(vec3(rad.x, hatDy, rad.y).mul(vec3(dS, 1, dS)));
      const R = skinned(boneTex);
      const p = toWorld(vec3(dot(R[0], vec4(bind, 1)), dot(R[1], vec4(bind, 1)), dot(R[2], vec4(bind, 1))), root).toVar();
      const n = rotN(normalize(vec3(dot(R[0].xyz, nB), dot(R[1].xyz, nB), dot(R[2].xyz, nB))), root);
      // drape sag (cloth only: body vertices use the slack byte for other data): slack × SAG_MAX × horizontality of the
      // vertex's main bone (its −Y axis in world is −column 1)
      const b0 = int(si.x).mul(3);
      const col1 = vec3(boneTex.load(ivec2(b0, int(slot))).y, boneTex.load(ivec2(b0.add(1), int(slot))).y, boneTex.load(ivec2(b0.add(2), int(slot))).y);
      const horiz = float(1).sub(abs(normalize(col1).y));
      const clothV = step(0.5, hmat.x).mul(step(hmat.x, 3.5));
      const sag = hext.y.mul(SAG_MAX).mul(horiz).mul(scale).mul(clothV);
      p.y.subAssign(sag);
      // optional pieces: bit b of the person's mask (bit 0 = always worn); hidden pieces collapse to one point
      const bit = hmat.z, mask = person0.y;
      const shown = mod(floor(mask.div(exp2(bit))), 2);
      // the player's own head (flag): collapse head, jaw, eye and lid vertices (bones 5–12)
      const hideHead = mod(person7.w, 2).mul(step(4.5, si.x)).mul(step(si.x, 12.5));
      const keep = shown.mul(float(1).sub(hideHead));
      const far = vec3(0, -1e4, 0);
      p.assign(mix(far, p, keep));
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
      const kFade = colT.w.mul(clothC);
      vAux.assign(vec4(hext.x, hext.z, row(1).w, row(7).x)); vExt.assign(vec4(hext.y, hext.w, nB.y, kFade));
      // joint wrinkles: how much the two main bones of a mixed-weight cloth vertex are turned against each other
      const bA = int(si.x).mul(3), bB = int(si.y).mul(3);
      const yA = vec3(boneTex.load(ivec2(bA, int(slot))).y, boneTex.load(ivec2(bA.add(1), int(slot))).y, boneTex.load(ivec2(bA.add(2), int(slot))).y);
      const yB = vec3(boneTex.load(ivec2(bB, int(slot))).y, boneTex.load(ivec2(bB.add(1), int(slot))).y, boneTex.load(ivec2(bB.add(2), int(slot))).y);
      const mixW = sw.x.mul(sw.y).mul(4).clamp(0, 1), bend = float(1).sub(dot(normalize(yA), normalize(yB))).mul(2).clamp(0, 1).mul(mixW).mul(clothC).mul(float(1).sub(skirtV));
      vWear.assign(vec4(wear.x, bend, ampPh, wear.w));
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
    const n1 = mx_noise_float(mix(P.mul(fr(SKIN.pores[0][0], hairF1, 160, 900, 200, 60)), irisCoord, kEye));
    const n2 = mx_noise_float(mix(P.mul(fr(SKIN.pores[1][0], hairF2, vec3(14, 5, 14), 250, 60, 40)), vec3(ex, ey, P.x).mul(900), kEye));
    // per-person values from a hash of the person's skin and hair colours (drawn per person; the skin map is shared by
    // everyone, so its brows and blotches would otherwise repeat on every face)
    const pv = (k: number) => fract(sin(dot(vColor.add(vHair), vec3(12.9898 + k, 78.233, 37.719 + 2 * k))).mul(43758.5453));
    const n3 = mx_noise_float(P.mul(fr(30, 40, 9, 40, 20, 40)).add(vec3(pv(0).mul(57), pv(1).mul(31), pv(2).mul(13)).mul(kSkin)));
    const u1 = n1.mul(0.5).add(0.5), u2 = n2.mul(0.5).add(0.5), u3 = n3.mul(0.5).add(0.5);

    // ---- skin: baked albedo (atlas left half) and detail (right half: crease height, oil, age lines, translucency)
    const uvA = U.mul(vec2(0.5, 1)), sA = texture(T.skin, uvA), sD = texture(T.skin, uvA.add(vec2(0.5, 0)));
    const refLin = new THREE.Color().setRGB(...REF_TONE, THREE.SRGBColorSpace);
    const tone = vColor.div(vec3(refLin.r, refLin.g, refLin.b));
    const stub = vAux.z, roots = step(1.5, stub), stubV = min(stub, 1).mul(float(1).sub(roots));
    // blotchy redness (per person), and a fine mottling at the pore scale, band-limited like the pores (skin is not one
    // smooth colour up close; C)
    let skinAlb: any = sA.rgb.mul(tone).mul(vec3(1).add(vec3(0.05, 0.03, 0.025).mul(n3))).mul(float(1).add(n2.mul(0.035).mul(band(SKIN.pores[1][0]))));
    const browA = smoothstep(pv(3).mul(0.4), float(1).sub(pv(4).mul(0.3)), sA.a); // sparser or denser brows per person
    skinAlb = mix(skinAlb, vHair.mul(0.9), browA.mul(pv(5).mul(0.25).add(0.7))); // brows
    skinAlb = mix(skinAlb, skinAlb.mul(vHair.mul(2.2).add(0.35).min(1)), vAux.y.mul(stubV).mul(0.55)); // shaven stubble
    skinAlb = mix(skinAlb, vHair.mul(0.7), vAux.y.mul(roots).mul(0.9)); // under a beard: roots
    skinAlb = mix(skinAlb, vHair.mul(0.55), e1.mul(kSkin).mul(bits('wearsHair')).mul(0.9)); // scalp under worn hair
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
    const lidSh = float(1).sub(smoothstep(-0.0015, 0.0018, ey).mul(EYE.lidShadow)); // the upper lid's shadow on the eyeball
    const eyeAlb = mix(sclera, iris, irisM).mul(lidSh);

    // ---- hair: natural curls, court rows of snail curls, straight strands
    const ridge = float(1).sub(abs(n2));
    const natural = ridge.mul(ridge).mul(0.75).add(u1.mul(0.25));
    const arc = atan(P.x, P.z.sub(0.02)).mul(0.085); // arc length (m) around the head
    const hx = mix(arc, P.x, isBeard), rowC = P.y.div(HAIR.row), ri = floor(rowC);
    // cells in rows (alternate rows offset half a cell), each curl jittered in place, size and turn by a per-cell hash, and
    // blended with the natural curls so no two read alike (literal snail shells read as carving, not hair)
    const cellX = hx.div(HAIR.row).add(mod(ri, 2).mul(0.5)), ci = floor(cellX);
    const hsh = (a: number, b: number, c: number) => fract(sin(ri.mul(a).add(ci.mul(b))).mul(c));
    const h1 = hsh(12.9898, 78.233, 43758.5453), h2 = hsh(39.3468, 11.135, 24634.6345);
    const cu = fract(cellX).sub(0.5).add(h1.sub(0.5).mul(0.3)), cv = fract(rowC).sub(0.5).add(h2.sub(0.5).mul(0.3));
    const rr = length(vec2(cu, cv)).mul(h1.mul(0.3).add(1.7)), th = atan(cv, cu).add(h2.mul(TAU));
    const tuft = clamp(float(1).sub(rr.mul(rr)), 0, 1).mul(sin(th.add(rr.mul(8))).mul(0.25).add(0.75));
    let court: any = mix(natural, tuft.mul(u1.mul(0.4).add(0.6)), 0.6);
    // the long beard's hanging mass: wavy locks between the curls at the chin and a row of curled ends. Each lock's wave
    // phase drifts with a slow noise (neighbours do not wave in step), its edges wander, its section is rounded and fine
    // strands run along it (one regular sine field over the mass read as corrugated sheet)
    const lockPh = P.y.mul(150).add(n3.mul(4));
    const lc = P.x.add(sin(lockPh).mul(0.0022)).add(n2.mul(0.001)).div(0.0075);
    const lf = fract(lc).sub(0.5).mul(2), lh = fract(sin(floor(lc).mul(91.345)).mul(47453.5453));
    const locks = max(float(1).sub(lf.mul(lf)), 0).mul(lh.mul(0.25).add(0.6)).mul(float(1).sub(abs(n1)).mul(0.4).add(0.6)).add(0.15);
    const lockZone = isMass.mul(smoothstep(0.2, 0.3, U.y)).mul(float(1).sub(smoothstep(0.86, 0.94, U.y)));
    court = mix(court, locks, lockZone);
    const straight = u1.mul(0.6).add(u2.mul(0.4));
    const curls = mix(mix(natural, court, kCourt), straight, kStraight);
    const hairAlb = vColor.mul(curls.mul(0.75).add(0.42)).mul(u3.mul(0.2).add(0.9));
    const hairH = curls.mul(mix(HAIR.bump, HAIR.bumpStraight, kStraight)).mul(band(mix(200, 120, kCourt)));
    const kohlK = bits('kohl').mul(float(1).sub(smoothstep(KOHL.band * 0.7, KOHL.band * 1.3, e1))); // D-215
    const lashAlb = mix(vHair.mul(0.45), vec3(...KOHL.alb), kohlK);

    // ---- cloth: dyed wool or linen; weave, folds, mottling, motifs
    const isLinen = is(m, MAT.cloth_main).mul(mod(bits('linen'), 2)).add(is(m, MAT.cloth_second).mul(mod(floor(bits('linen').div(2)), 2))).add(is(m, MAT.cloth_trim).mul(floor(bits('linen').div(4))));
    const pat0 = mod(bits('motif'), 2);
    const cell = fract(vec2(P.x.add(P.z.mul(0.7)), P.y).mul(22)).sub(0.5), rose = float(1).sub(smoothstep(0.18, 0.26, length(cell))).mul(pat0).mul(is(m, MAT.cloth_main));
    const trimCol = vHair; // motif colour = the person's trim colour (C)
    let clothAlb: any = vColor.mul(float(1).add(n3.mul(0.05)).add(n1.mul(0.035)));
    clothAlb = mix(clothAlb, trimCol, rose);
    // sun-bleaching (D-189): up-facing outer cloth of an old garment fades toward a paler, greyer colour, by the dye's
    // susceptibility (weld fast, indigo slowly); linings (cavity 150/255) and the undersides keep their dye
    const upF = smoothstep(-0.25, 0.75, vExt.z).mul(smoothstep(0.66, 0.8, vAux.x)).mul(n3.mul(0.3).add(0.85));
    const fadeAmt = vWear.x.mul(vExt.w).mul(upF).mul(DRAPE.fade).clamp(0, 0.8);
    const cLum = dot(clothAlb, vec3(0.2126, 0.7152, 0.0722));
    clothAlb = mix(clothAlb, mix(vec3(cLum), clothAlb, 0.4).mul(1.25).add(0.012).min(0.8), fadeAmt);
    const nb = normalize(cross(P.dFdx(), P.dFdy()).add(vec3(0, 1e-9, 0))), ax = abs(nb.x), az = abs(nb.z);
    const sH = P.x.mul(az).add(P.z.mul(ax)).div(ax.add(az).add(1e-4)); // horizontal coordinate on the garment
    const fq = mix(700, 1500, isLinen); // threads per metre: coarse wool, fine linen (C)
    const weaveH = sin(P.y.mul(fq).mul(TAU)).mul(sin(sH.mul(fq).mul(TAU))).mul(mix(0.00012, 0.00006, isLinen)).mul(band(fq));
    // pleated skirts (prm 1: the court robe, the woman's dress): a triangle-wave pleat field around the body, vertical in
    // the front and slanting up to the belt at the sides (the robe drawn up to the belt on the reliefs: B for the pattern,
    // C for its geometry). 26 pleats cannot be carried by a 40-segment tube (1.5 segments each), so they are shading.
    const thB = atan(P.x, P.z.sub(0.02)), sideS = smoothstep(0.35, 0.9, abs(sin(thB)));
    const pleatT = abs(fract(thB.mul(26 / TAU).add(P.y.mul(9).mul(sign(thB)).mul(sideS))).sub(0.5)).mul(2);
    const pleatH = pleatT.sub(0.5).mul(0.003).mul(is(prm, 1)).mul(band(21));
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
    clothAlb = clothAlb.mul(float(1).sub(hem.mul(DRAPE.hemDark)));
    const clothH = n2.mul(mix(0.003, 0.0012, is(prm, 4))).add(n1.mul(mix(0.00025, 0.00012, isLinen))).add(weaveH).add(pleatH).add(foldH).add(wrinkleH).add(hemH).add(gatherH); // linen is smoother than wool

    // ---- felt, leather, metal, wood, wicker
    const feltAlb = vColor.mul(float(1).add(n3.mul(0.1)).add(n1.mul(0.05)));
    const seam = exp(P.x.div(0.0022).mul(P.x.div(0.0022)).negate()).mul(0.00045).mul(is(prm, 0)); // the soft cap's centre seam (C)
    const feltH = n1.mul(0.00008).mul(band(900)).add(n2.mul(0.00015).mul(band(250))).add(seam);
    const leatherAlb = vColor.mul(float(1).add(n2.mul(0.08)));
    const leatherH = n1.mul(0.0002).mul(band(200));
    const metalAlb = mix(mix(vec3(0.62, 0.43, 0.24), vec3(0.8, 0.8, 0.78), is(prm, 1)), vec3(0.9, 0.7, 0.32), is(prm, 2)).mul(float(1).sub(is(prm, 3).mul(0.5)));
    const woodAlb = vec3(0.36, 0.25, 0.15).mul(float(1).add(sin(P.y.mul(900).add(n3.mul(3))).mul(0.06)));
    const wickerAlb = vec3(0.6, 0.5, 0.3).mul(float(0.85).add(abs(sin(P.x.mul(300))).mul(0.15)));

    let alb: any = skinAlb.mul(kSkin).add(eyeAlb.mul(kEye)).add(hairAlb.mul(kHair)).add(vec3(0.7, 0.66, 0.58).mul(kTeeth)).add(vec3(0.32, 0.1, 0.09).mul(kMouth))
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
    const hemBand = float(1).sub(smoothstep(0.03, 0.3, P.y)).max(vAux.y.mul(kCloth).mul(smoothstep(0.72, 1, U.y)).mul(0.7));
    const soilMask = vWear.w.mul(hemBand).mul(kCloth.add(kLeather.mul(0.8)).add(kSkin.mul(feet).mul(0.6))).mul(u2.mul(0.8).add(0.6)).mul(DRAPE.soil).clamp(0, 0.75);
    alb = mix(alb, vec3(...DRAPE.dust), soilMask);
    this.colorNode = alb;
    // roughness: skin broad lobe (the oily lobe is separate), eyes wet, cloth by fibre, dust makes things matte
    this.roughnessNode = soilMask.mul(0.15).add(kSkin.mul(float(SKIN.roughSheen).sub(oil.mul(0.08)).add(n1.mul(0.06).mul(band(SKIN.pores[0][0])))).add(kEye.mul(mix(0.1, 0.035, irisM))).add(kHair.mul(0.5)).add(kTeeth.mul(0.25)).add(kMouth.mul(0.3))
      .add(kLeather.mul(0.55)).add(kFelt.mul(0.95)).add(kMetal.mul(0.32)).add(kLash.mul(0.6)).add(kWood.mul(0.55)).add(kWicker.mul(0.85)).add(kCloth.mul(mix(0.92, 0.8, isLinen))).add(grimeMask.mul(0.2))).min(1);
    this.metalnessNode = kMetal;
    // specular F0 (dielectrics): skin 0.028, cornea 0.025, hair cuticle 0.046, others 0.04 (setupSpecular)
    this.f0Node = float(0.04).sub(kSkin.mul(0.04 - SKIN.f0)).sub(kEye.mul(0.04 - EYE.f0)).add(kHair.mul(0.006));
    // cavity occlusion (indirect light), weaker on the eyeball (the socket's ray-cast cavity greyed the whites); curl valleys
    this.aoNode = mix(float(1), vAux.x, float(0.85).sub(kEye.mul(0.45))).mul(mix(float(1), curls.mul(0.45).add(0.55), kHair));
    // shading normal: curls on hair, creases and pores on skin, folds and weave on cloth, fibres on felt, grain on leather
    const h = hairH.mul(kHair).add(skinH.mul(kSkin)).add(clothH.mul(kCloth)).add(feltH.mul(kFelt)).add(leatherH.mul(kLeather));
    this.normalNode = bumped(h);
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
      kkEdge: smoothstep(0.3, 1, e2), kHair, hairTilt: mix(curls.sub(0.5).mul(1.6), cos(lockPh).mul(0.33), lockZone.mul(kCourt)), // along the locks' waves
      sheenCol: mix(vec3(1), clothAlb.mul(2).min(1), 0.5).mul(kCloth.mul(mix(0.22, 0.14, isLinen)).add(kFelt.mul(0.25))),
      sheenRough: kCloth.mul(mix(0.55, 0.35, isLinen)).add(kFelt.mul(0.7)).add(float(1).sub(kCloth).sub(kFelt).mul(0.5)),
      specOcc: mix(float(1), vAux.x, kSkin.mul(0.5)).mul(mix(float(1), curls.mul(0.6).add(0.4), kHair)),
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
    const speckle = isBeard.mul(float(1).sub(kCourt)).mul(step(float(0.92).sub(bits('beard').mul(0.1)), u1));
    const edgeCut = max(step(cover.mul(1.15), frayPat), speckle);
    const silCut = step(curls.add(0.3), silh.sub(0.45).mul(2.8));
    // (lower strip, e2 = 1: fewer, finer clumps)
    const along = U.x.sub(LASH.u0).div(LASH.u1 - LASH.u0), tl = e1;
    const clumpC = abs(fract(along.mul(mix(LASH.clumps, LASH.clumps * 0.6, e2)).add(n1.mul(0.35))).sub(0.5)).mul(2);
    const lashW = float(1).sub(tl).mul(float(1).sub(tl).max(0).sqrt()).mul(0.8).add(0.1).mul(mix(1, 0.7, e2));
    const lashCut = max(step(lashW, clumpC), step(0.9, tl)).mul(float(1).sub(bits('kohl').mul(step(tl, KOHL.band)))); // (kohl: the root band solid)
    this.maskNode = float(1).sub(kHair.mul(max(edgeCut, silCut))).sub(kLash.mul(lashCut)).greaterThan(0.5);
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
