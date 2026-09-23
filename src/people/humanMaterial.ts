// The human material (D-026): one TSL node material for every body, garment, hair and worn object, so the whole crowd
// renders in a few instanced draws.
//
// Vertex stage (GPU skinning from textures; no per-person uniforms):
//   iSlot (instanced)  → person texel row: variant, piece mask, pattern, grime; colours
//   iRoot, iRootPrev   → the person's feet position and yaw this frame and last frame (instanced; root motion every
//                        frame while the bone palette of distant people is refreshed less often)
//   tid                → bind position + packed normal of this vertex in this person's body variant (source texture)
//   skinIndex/Weight   → 4 × 3 texels of the person's skin palette (rows of 3×4 matrices, character space)
//   hmat               → material class, colour slot (texel of the person row), optional-piece bit, class parameter
//   hext               → cavity AO, drape slack (wide sleeves sag when the arm is raised), beard region (stubble)
// Hidden optional pieces collapse to a point (zero-area triangles). Previous-frame skinning feeds the velocity buffer
// (TRAA) when the pipeline asks for it.
// Fragment stage: arithmetic class masks (no runtime select(): D-012) pick albedo, roughness, metalness and a procedural
// height field (curls, fabric folds, wicker) for the shading normal. Skin: the baked albedo (skin.png) rescaled to the
// person's tone, eyebrows from its alpha, stubble from the beard region, and a wrap-lighting approximation of subsurface
// scattering in a custom lighting model.
import * as THREE from 'three/webgpu';
import {
  Fn, attribute, texture, uv, vec2, vec3, vec4, float, int, ivec2, mix, step, abs, max, min, floor, clamp, dot, normalize, exp2, smoothstep, sin, cos,
  varyingProperty, normalLocal, positionPrevious, positionView, normalView, sign, mx_noise_float, color, diffuseColor, mod, pow, fract, length,
} from 'three/tsl';
import { MAT } from './humanFormat';

/** height field → shading normal (view space; surface gradient from screen-space derivatives, Mikkelsen 2010) */
function bumped(h: any) {
  const dpdx = positionView.dFdx(), dpdy = positionView.dFdy(), n = normalView;
  const r1 = dpdy.cross(n), r2 = n.cross(dpdx), det = dpdx.dot(r1);
  const grad = sign(det).mul(h.dFdx().mul(r1).add(h.dFdy().mul(r2)));
  return abs(det).mul(n).sub(grad).normalize();
}
/** 1 when the (rounded) class id equals k, else 0 (arithmetic, no branches) */
const is = (m: any, k: number) => float(1).sub(step(0.5, abs(m.sub(k))));

export interface HumanTextures {
  /** RGBA32F: xyz bind position, w packed normal; row-major over variant × NV vertices */
  source: THREE.DataTexture; sourceWidth: number; NV: number;
  /** RGBA32F: one row per slot, 177 texels (59 bones × 3 rows of a 3×4 matrix) */
  bones: THREE.DataTexture; prevBones: THREE.DataTexture;
  /** RGBA32F: one row per slot, 8 texels (see PERSON_TEXELS) */
  person: THREE.DataTexture;
  skin: THREE.Texture; eye: THREE.Texture;
}
/** person texel layout: 0 [variant, piece mask, pattern, grime], 1 [skin tone, stubble], 2 main, 3 second, 4 trim, 5 hair,
 *  6 leather, 7 [grime brightness, scale, 0, flags], 8 felt/headgear, 9 reserved */
export const PERSON_TEXELS = 10;
/** reference skin tone the baked albedo was authored for (sRGB; tools/humans/skin.ts REF_TONE) */
export const REF_TONE: [number, number, number] = [0.72, 0.53, 0.42];
/** drape: a wide sleeve's free edge drops this far (m) when the forearm is horizontal (C) */
export const SAG_MAX = 0.1;
/** person flags (texel 7 w): 1 = hide the head (the player's own body, seen from inside it) */
export const FLAG_HIDE_HEAD = 1;

class HumanLightingModel extends THREE.PhysicalLightingModel {
  constructor(private skinMask: any, private scatter: any) { super(); }
  direct(inputs: any, builder: any) {
    super.direct(inputs, builder);
    // wrap lighting for skin (SSS approximation, C): diffuse from saturate((N·L + w)/(1 + w)) instead of saturate(N·L),
    // tinted toward red where light wraps past the terminator (light scattered under the skin exits reddened)
    const { lightDirection, lightColor, reflectedLight } = inputs;
    const ndl = normalView.dot(lightDirection);
    const wrap = 0.35;
    const wrapped = ndl.add(wrap).div(1 + wrap).clamp(0, 1), lambert = ndl.clamp(0, 1);
    const extra = wrapped.sub(lambert).max(0);
    reflectedLight.directDiffuse.addAssign(lightColor.mul(extra).mul(this.skinMask).mul(diffuseColor.rgb).mul(this.scatter).mul(1 / Math.PI));
  }
}

export class HumanMaterial extends THREE.MeshStandardNodeMaterial {
  private skinMask: any; private scatter: any;
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
    const vColor = varyingProperty('vec3', 'vHumanColor'), vHair = varyingProperty('vec3', 'vHumanCol2'), vMat = varyingProperty('vec4', 'vHumanMat'), vBind = varyingProperty('vec3', 'vHumanBind'), vAux = varyingProperty('vec4', 'vHumanAux');
    this.positionNode = Fn((builder: any) => {
      const s = src.toVar(), bind = s.xyz, nB = decodeN(s.w);
      const R = skinned(boneTex);
      const p = toWorld(vec3(dot(R[0], vec4(bind, 1)), dot(R[1], vec4(bind, 1)), dot(R[2], vec4(bind, 1))), root).toVar();
      const n = rotN(normalize(vec3(dot(R[0].xyz, nB), dot(R[1].xyz, nB), dot(R[2].xyz, nB))), root);
      // drape sag: slack × SAG_MAX × horizontality of the vertex's main bone (its −Y axis in world is −column 1)
      const b0 = int(si.x).mul(3);
      const col1 = vec3(boneTex.load(ivec2(b0, int(slot))).y, boneTex.load(ivec2(b0.add(1), int(slot))).y, boneTex.load(ivec2(b0.add(2), int(slot))).y);
      const horiz = float(1).sub(abs(normalize(col1).y));
      const sag = hext.y.mul(SAG_MAX).mul(horiz).mul(scale);
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
      vColor.assign(perTex.load(ivec2(int(max(colSlot, 1)), int(slot))).rgb.mul(step(0.5, colSlot)));
      // second colour: the trim colour on cloth (pattern motifs), the hair colour elsewhere (brows, stubble, lashes)
      const clothV = step(0.5, hmat.x).mul(step(hmat.x, 3.5));
      vHair.assign(mix(row(5).rgb, row(4).rgb, clothV));
      vMat.assign(vec4(hmat.x, hmat.w, person0.z, person0.w));
      vBind.assign(bind);
      vAux.assign(vec4(hext.x, hext.z, row(1).w, row(7).x));
      return p;
    })();

    // ---- fragment
    const m = vMat.x, prm = vMat.y;
    const kSkin = is(m, MAT.skin), kEye = is(m, MAT.eye), kHair = is(m, MAT.hair), kTeeth = is(m, MAT.teeth), kMouth = is(m, MAT.mouth);
    const kLeather = is(m, MAT.leather), kFelt = is(m, MAT.felt), kMetal = is(m, MAT.metal), kLash = is(m, MAT.lash), kWood = is(m, MAT.wood), kWicker = is(m, MAT.wicker);
    const kCloth = is(m, MAT.cloth_main).add(is(m, MAT.cloth_second)).add(is(m, MAT.cloth_trim));
    const P = vBind;
    // skin: baked albedo × tone / reference tone (linear), brows (alpha) and stubble toward the hair colour
    const skinT = texture(T.skin, uv());
    const refLin = new THREE.Color().setRGB(...REF_TONE, THREE.SRGBColorSpace);
    const tone = vColor.div(vec3(refLin.r, refLin.g, refLin.b));
    const stubble = vAux.z; // per person 0 (shaven/none) … 1 (short stubble), × beard region (vAux.y)
    let skinAlb: any = skinT.rgb.mul(tone);
    skinAlb = mix(skinAlb, vHair.mul(0.9), skinT.a.mul(0.85));
    skinAlb = mix(skinAlb, skinAlb.mul(vHair.mul(2.2).add(0.35).min(1)), vAux.y.mul(stubble).mul(0.55));
    // eyes: MakeHuman iris/sclera texture; the sclera toned down (a pure white sclera reads as uncanny, C)
    const eyeT = texture(T.eye, uv()).rgb; const sclera = smoothstep(0.55, 0.75, eyeT.r.add(eyeT.g).add(eyeT.b).div(3));
    const eyeAlb = mix(eyeT, eyeT.mul(vec3(0.82, 0.78, 0.74)), sclera);
    // hair: clumps of curls and strands (height field in bind space; ridged noise reads as curled locks, elongated
    // vertically on beards; relief beards are carved in rows of curls, B; the rendering is C)
    const hs = mix(vec3(260, 170, 260), vec3(190, 110, 190), step(1.5, prm)); // beard and bun (prm ≥ 1.5 beard) vs scalp
    const ridge = float(1).sub(abs(mx_noise_float(P.mul(hs)))), fine = mx_noise_float(P.mul(vec3(900, 300, 900))).mul(0.5).add(0.5);
    const curls = ridge.mul(ridge).mul(0.75).add(fine.mul(0.25));
    const hairAlb = vColor.mul(curls.mul(0.6).add(0.55));
    // cloth: dyed wool/linen, gentle mottling; patterned robes (pattern 1: rosettes/stars in the trim colour, after the Susa guard robes, B)
    const mott = mx_noise_float(P.mul(9)).mul(0.05).add(mx_noise_float(P.mul(160)).mul(0.035));
    const pat = vMat.z;
    const cell = fract(vec2(P.x.add(P.z.mul(0.7)), P.y).mul(22)).sub(0.5), rose = float(1).sub(smoothstep(0.18, 0.26, length(cell))).mul(step(0.5, pat)).mul(is(m, MAT.cloth_main));
    const trimCol = vHair; // motif colour = the person's trim colour (C)
    const grime = vMat.w, grimeCol = vec3(vAux.w, vAux.w, vAux.w).mul(vec3(1, 0.97, 0.9)); // dust/flour toward the hem and hands
    const grimeMask = grime.mul(float(1).sub(smoothstep(0.1, 0.9, P.y))) // (reversed smoothstep edges are undefined in WGSL).mul(kCloth.add(kSkin.mul(0.5)));
    let clothAlb: any = vColor.mul(float(1).add(mott));
    clothAlb = mix(clothAlb, trimCol, rose);
    const leatherAlb = vColor.mul(float(1).add(mx_noise_float(P.mul(60)).mul(0.08)));
    const feltAlb = vColor.mul(float(1).add(mx_noise_float(P.mul(40)).mul(0.07)));
    const metalAlb = mix(mix(vec3(0.62, 0.43, 0.24), vec3(0.8, 0.8, 0.78), is(prm, 1)), vec3(0.9, 0.7, 0.32), is(prm, 2)).mul(float(1).sub(is(prm, 3).mul(0.5)));
    const woodAlb = vec3(0.36, 0.25, 0.15).mul(float(1).add(sin(P.y.mul(900).add(mx_noise_float(P.mul(40)).mul(3))).mul(0.06)));
    const wickerAlb = vec3(0.6, 0.5, 0.3).mul(float(0.85).add(abs(sin(P.x.mul(300))).mul(0.15)));
    let alb: any = skinAlb.mul(kSkin).add(eyeAlb.mul(kEye)).add(hairAlb.mul(kHair)).add(vec3(0.72, 0.68, 0.58).mul(kTeeth)).add(vec3(0.32, 0.1, 0.09).mul(kMouth))
      .add(leatherAlb.mul(kLeather)).add(feltAlb.mul(kFelt)).add(metalAlb.mul(kMetal)).add(vHair.mul(0.5).mul(kLash)).add(woodAlb.mul(kWood)).add(wickerAlb.mul(kWicker)).add(clothAlb.mul(kCloth));
    alb = mix(alb, grimeCol, grimeMask.mul(0.35));
    this.colorNode = alb;
    // roughness: skin 0.52 (oilier on the nose), eyes wet, hair 0.55, cloth 0.9, leather 0.62, felt 0.95, metal 0.32
    const noseOil = float(0); // (no per-region map yet; C)
    this.roughnessNode = kSkin.mul(float(0.52).sub(noseOil)).add(kEye.mul(0.06)).add(kHair.mul(0.55)).add(kTeeth.mul(0.25)).add(kMouth.mul(0.3)).add(kLeather.mul(0.62))
      .add(kFelt.mul(0.95)).add(kMetal.mul(0.32)).add(kLash.mul(0.6)).add(kWood.mul(0.55)).add(kWicker.mul(0.85)).add(kCloth.mul(0.9));
    this.metalnessNode = kMetal;
    // cavity occlusion (indirect light only)
    this.aoNode = mix(float(1), vAux.x, 0.85);
    // shading normal: curls on hair, folds and weave on cloth, grain on leather, flutes are geometry
    const foldH = mx_noise_float(P.mul(vec3(14, 5, 14))).mul(0.003).add(mx_noise_float(P.mul(70)).mul(0.0004));
    const h = curls.mul(0.0016).mul(kHair).add(foldH.mul(kCloth)).add(mx_noise_float(P.mul(200)).mul(0.0002).mul(kLeather.add(kFelt)));
    this.normalNode = bumped(h);
    this.skinMask = kSkin; this.scatter = vec3(1.0, 0.45, 0.3);
    if (opts.shadowOnly) { this.colorWrite = false; this.depthWrite = false; }
    void clamp; void min; void pow; void color; void cos;
  }
  setupLightingModel() { return new HumanLightingModel(this.skinMask, this.scatter) as any; }
  private texNodes: any[] = [];
  /** point every texture node that samples `old` at `t` (the crowd grows its palette textures) */
  retexture(old: THREE.Texture, t: THREE.Texture) { for (const n of this.texNodes) if (n.value === old) n.value = t; }
}
