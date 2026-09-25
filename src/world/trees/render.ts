// Trees on screen (plain and town gardens): one kit of textures and materials shared by every tree layer.
//
// Near (3-D): all species in one draw per level of detail and part (wood, leaves). The template geometry holds only slot
// numbers; the vertex shader pulls each slot's branch segment or leaf card from float textures (one row per species
// variant: kitdata.ts) and places it with the instance's position, scale and yaw. LOD0 = 64 segments (6 sides) + 320
// cards; LOD1 = the first 16 segments (4 sides) + the first 120 cards at 1.31x (leaves) to 1.47x (bare twigs) size. Leaf
// cards show a leaf, blossom or bare-twig spray from the leaf atlas (atlas.ts: leaves in clumps on bare twigs), chosen per
// card from the day's foliage state of the species' group (seasonal.ts): leaves come out card by card and grow; blossom
// comes before the leaves; the species' share of the remaining cards shows bare-twig sprays near their branches, so a
// winter crown shows its branching. A crown is lit as a volume (shade.ts): per texel, the normal of the crown's envelope
// blended with the clump's, occlusion by depth into the crown, and light passed through the leaves toward the viewer.
//
// Far (impostors): one camera-facing quad per tree sampling the impostor atlas (impostor.ts), baked on the CPU from
// the same model, cards, atlas and season rules, blended between the two nearest of 8 views, lit with the baked
// normals. A quad collapses inside the near radius of the near set's centre (the trees drawn in 3-D there) and beyond
// an outer radius. No runtime select(): masks are arithmetic (D-012).
import * as THREE from 'three/webgpu';
import { attribute, uniform, varying, textureLoad, texture, cameraPosition, cameraViewMatrix, positionGeometry, vec2, vec3, vec4, float, int, ivec2, mix, step, max, min, normalize, cross, dot, sign, cos, sin, floor, mod, atan, time, length, mx_noise_float, clamp, smoothstep, exp, fract } from 'three/tsl';
import { allModels, K1, LOD1_LEAF, LOD1_TWIG, M0, M1, K0, SIDES0, SIDES1, VARIANTS, rowOf, TRIS, type TreeModel } from './model';
import { COLS, ROWS, TILT, type Atlas } from './atlas';
import { calibrateAndDrawAtlas, packCards, packSegments, packSpecies, SEG_TEX, CARD_TEX } from './kitdata';
import { ImpostorBaker, NV, groupStates, barkLinear, type GroupState } from './impostor';
import { SHADE } from './shade';
import { SPECIES, speciesIndex, speciesTag, groupIndex } from './species';
import { TREE_GROUPS, foliageTable } from '../plain/seasonal';

/** one tree as drawn: position (world; y = ground), scale (horizontal, vertical: 1 = the species' reference model),
 *  yaw, colour tint, model row (species x variant) */
export interface TreeInst { x: number; y: number; z: number; sxz: number; sy: number; yaw: number; tint: number; row: number; si: number; where?: string }

// ---------------------------------------------------------------- foliage state (per group, today)
export class FoliageState {
  readonly data = new Float32Array(2 * TREE_GROUPS.length * 4);
  readonly tex: THREE.DataTexture;
  doy = NaN;
  constructor() { this.tex = new THREE.DataTexture(this.data, 2, TREE_GROUPS.length, THREE.RGBAFormat, THREE.FloatType); this.tex.magFilter = this.tex.minFilter = THREE.NearestFilter; this.tex.needsUpdate = true; }
  setDay(doy: number) { this.doy = doy; this.data.set(foliageTable(doy)); this.tex.needsUpdate = true; }
  /** leaf colour+amount and blossom colour+amount of group g (TSL) */
  leaf(g: any) { return textureLoad(this.tex, ivec2(int(0), int(g))); }
  blossom(g: any) { return textureLoad(this.tex, ivec2(int(1), int(g))); }
}

const dataTex = (d: { data: Float32Array; width: number; height: number }) => { const t = new THREE.DataTexture(d.data, d.width, d.height, THREE.RGBAFormat, THREE.FloatType); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; };
const mipTex = (levels: { data: Uint8Array; width: number; height: number }[], srgb: boolean) => {
  const t = new THREE.DataTexture(levels[0].data, levels[0].width, levels[0].height, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.mipmaps = levels.map(l => ({ data: l.data, width: l.width, height: l.height })) as any; t.generateMipmaps = false;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 8; t.needsUpdate = true; return t; // anisotropic: an edge-on card keeps its detail instead of a coarse, blurred mip
};

/** instance attributes shared by every tree mesh: ipos (world base), iscl (sxz, sy, yaw, tint), itree (row, group, phase, species) */
export function instanceNodes() {
  return { ipos: attribute('ipos', 'vec3'), iscl: attribute('iscl', 'vec4'), itree: attribute('itree', 'vec4') };
}
/** tree-local -> world: scale, yaw (the same convention as the old plain trees: x' = x c + z s, z' = z c - x s), translate */
function toWorld(l: any, iscl: any, ipos: any) { const c = cos(iscl.z), s = sin(iscl.z), x = l.x.mul(iscl.x), z = l.z.mul(iscl.x); return vec3(x.mul(c).add(z.mul(s)), l.y.mul(iscl.y), z.mul(c).sub(x.mul(s))).add(ipos); }
/** a tree-local direction turned into the world by the instance's yaw */
function dirToWorld(n: any, iscl: any) { const c = cos(iscl.z), s = sin(iscl.z); return vec3(n.x.mul(c).add(n.z.mul(s)), n.y, n.z.mul(c).sub(n.x.mul(s))); }
function normalToView(n: any, iscl: any) { return normalize(cameraViewMatrix.mul(vec4(dirToWorld(n, iscl), 0)).xyz); }
/** each tree's own colour (C): a hue between yellower and bluer green and a value, from its instance phase (the same on
 *  the near trees and the impostors, so a tree keeps its colour across the hand-over) */
function treeHue(itree: any, iscl: any) { const h = fract(sin(itree.z.mul(12.9898).add(4.1)).mul(43758.5453)).mul(2).sub(1);
  return vec3(h.mul(0.07).add(1), h.mul(0.015).add(1), h.mul(-0.1).add(1)).mul(iscl.w); }
// shade.ts in TSL: the crown ellipsoid (species record 3: centre height, horizontal radius, radii above and below)
function crownRy(p: any, cr: any) { return mix(cr.w, cr.z, step(cr.x, p.y)); }
function crownNormalN(p: any, cr: any) { const ry = crownRy(p, cr), rx2 = cr.y.mul(cr.y); return normalize(vec3(p.x.div(rx2), p.y.sub(cr.x).div(ry.mul(ry)), p.z.div(rx2)).add(vec3(0, 1e-6, 0))); }
function crownAON(p: any, cr: any, CB: any, H: any, aoIn: number) {
  const ry = crownRy(p, cr), q = length(vec3(p.x.div(cr.y), p.y.sub(cr.x).div(ry), p.z.div(cr.y)));
  const hy = clamp(p.y.sub(CB).div(max(H.sub(CB), 0.1)), 0, 1);
  return smoothstep(SHADE.aoQ0, SHADE.aoQ1, q).mul(1 - aoIn).add(aoIn).mul(hy.mul(1 - SHADE.aoLow).add(SHADE.aoLow));
}
/** light passed through the leaves toward the viewer (shade.ts transmission), as radiance: albedo / pi x sun irradiance x
 *  the transmission factor of a texel whose world normal is nW, in the tint of transmitted light */
function transmissionN(alb: any, nW: any, kappa: any, sunDir: any, sunIrr: any) {
  const back = max(dot(nW, sunDir).negate(), 0), t = back.mul(exp(back.mul(kappa).negate())).mul(SHADE.trans / Math.PI);
  return alb.mul(vec3(...SHADE.transTint)).mul(sunIrr).mul(t);
}

export interface KitOptions { impostorPx: number }
/** impostor tile size (px) by quality: at the near radius a tile texel is about a screen pixel at 960x540 (test) and
 *  about half of one at 1440p (high) */
export const impostorPx = (q: string) => (q === 'ultra' ? 128 : q === 'high' ? 96 : q === 'medium' ? 80 : 64);
let shared: TreeKit | null = null;
export class TreeKit {
  readonly models: TreeModel[]; readonly atlas: Atlas; readonly atlasTex: THREE.DataTexture; readonly tiltTex: THREE.DataTexture;
  readonly segTex: THREE.DataTexture; readonly cardTex: THREE.DataTexture; readonly spTex: THREE.DataTexture;
  readonly foliage = new FoliageState();
  readonly wind: any = uniform(2);
  /** LOD0 radius (m): near cards turn partly toward the camera, fading out by this radius (set by the tree layers) */
  readonly lod0R: any = uniform(40);
  /** mip bias of the leaf atlas: +1 where nothing averages sub-pixel alpha over frames (MSAA qualities: the alpha-tested
   *  leaf edges speckled at test quality); 0 under temporal AA (medium and above), which averages them */
  readonly atlasBias: any = uniform(0);
  readonly baker: ImpostorBaker; readonly impCol: THREE.DataTexture; readonly impNrm: THREE.DataTexture;
  /** the sun as the leaves' transmission sees it (world direction toward the sun, irradiance = colour x intensity);
   *  synced from the scene's shadow-casting sun before each tree draw (syncSun) */
  readonly sunDir: any = uniform(new THREE.Vector3(0, 1, 0)); readonly sunIrr: any = uniform(new THREE.Color(0, 0, 0));
  /** copy the registered sun (registerShadowLight) into the transmission uniforms; no sun registered: no transmission */
  syncSun() { const L = SHADOW_LIGHTS[0]; if (!L) return;
    this.sunDir.value.copy(L.position).sub(L.target.position).normalize(); (this.sunIrr.value as THREE.Color).copy(L.color).multiplyScalar(L.visible ? L.intensity : 0); }
  private baked: (GroupState | null)[] = [];
  readonly buildMs: number; bakeMs = 0; bakes = 0;
  private mats = new Map<string, THREE.MeshStandardNodeMaterial>();
  /** the kit shared by every tree layer (built on first use; the impostor resolution of the first caller wins) */
  static get(opts: KitOptions = { impostorPx: 64 }) { return (shared ??= new TreeKit(opts)); }
  /** quality-dependent settings (the tree layers call this with their quality) */
  configure(quality: string) { this.atlasBias.value = quality === 'test' || quality === 'low' ? 1 : 0; }
  private constructor(opts: KitOptions) {
    const t0 = performance.now();
    this.models = allModels();
    this.atlas = calibrateAndDrawAtlas(this.models);
    this.atlasTex = mipTex(this.atlas.levels, false); this.tiltTex = mipTex(this.atlas.tilt, false);
    this.segTex = dataTex(packSegments(this.models)); this.cardTex = dataTex(packCards(this.models)); this.spTex = dataTex(packSpecies(this.models));
    this.baker = new ImpostorBaker(this.models, this.atlas, opts.impostorPx);
    this.foliage.setDay(105);
    const L = this.bakeAll(true);
    this.impCol = mipTex(L.col, true); this.impNrm = mipTex(L.nrm, false);
    this.buildMs = performance.now() - t0;
  }
  /** re-bake the impostor rows whose foliage group changed (force: all); returns the new mip levels */
  private bakeAll(force = false) {
    const t0 = performance.now(), st = groupStates(this.foliage.data);
    let n = 0;
    this.models.forEach((m, r) => { const g = groupIndex(m.species.group), s = st[g], prev = this.baked[r];
      const same = !force && prev && prev.leaf.every((v, i) => Math.abs(v - s.leaf[i]) < 0.004) && prev.blossom.every((v, i) => Math.abs(v - s.blossom[i]) < 0.004);
      if (same) return; this.baker.bakeRow(r, s); this.baked[r] = { leaf: [...s.leaf] as any, blossom: [...s.blossom] as any }; n++; });
    const L = n ? this.baker.levels() : null;
    this.bakeMs = performance.now() - t0; if (n) this.bakes++;
    return L ?? this.baker.levels();
  }
  /** the day of year: foliage state, and the impostors re-baked where a group changed. A day-to-day tick re-bakes in a
   *  worker (bake_worker.ts: up to ~1 s of work at high quality, off the main thread; the far trees follow within a
   *  second or two); a jump (loading, the test harness, a first call) bakes here at once, so a frame never shows far
   *  trees of another season than the near ones after a jump */
  setDay(doy: number) {
    if (doy === this.foliage.doy) return;
    const prev = this.foliage.doy; this.foliage.setDay(doy);
    const st = groupStates(this.foliage.data);
    const changed = this.models.some((m, r) => { const s = st[groupIndex(m.species.group)], p = this.baked[r]; return !p || p.leaf.some((v, i) => Math.abs(v - s.leaf[i]) >= 0.004) || p.blossom.some((v, i) => Math.abs(v - s.blossom[i]) >= 0.004); });
    if (!changed) return;
    const step = Number.isNaN(prev) ? 99 : Math.min(Math.abs(doy - prev), 365 - Math.abs(doy - prev)), w = step <= 1 ? this.bakeWorker() : null;
    const id = ++this.reqId;
    if (w) { w.postMessage({ id, px: this.baker.px, table: this.foliage.data.slice() }); return; }
    this.apply(this.bakeAll());
  }
  private reqId = 0; private worker: Worker | null | undefined;
  private apply(L: { col: { data: Uint8Array; width: number; height: number }[]; nrm: { data: Uint8Array; width: number; height: number }[] }) {
    for (const [tex, lv] of [[this.impCol, L.col], [this.impNrm, L.nrm]] as const) { tex.mipmaps = lv.map(l => ({ data: l.data, width: l.width, height: l.height })) as any; (tex.image as any).data = lv[0].data; tex.needsUpdate = true; }
  }
  private bakeWorker(): Worker | null {
    if (this.worker !== undefined) return this.worker;
    try {
      if (typeof Worker === 'undefined' || typeof window === 'undefined') return (this.worker = null);
      const w = new Worker(new URL('./bake_worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent) => { if (e.data.id !== this.reqId) return; this.apply(e.data); this.bakes++; this.asyncBakes++; };
      w.onerror = () => { this.worker = null; };
      return (this.worker = w);
    } catch { return (this.worker = null); }
  }
  asyncBakes = 0;
  /** texel k of model row `row` in a data texture (TSL) */
  private rec(tex: THREE.DataTexture, x: any, row: any) { return textureLoad(tex, ivec2(int(x), int(row))); }
  /** sway of a tree-local point (m): the crown bends with the wind, more toward the top (C) */
  private sway(l: any, H: any, phase: any) {
    const h: any = clamp(l.y.div(H), 0, 1.2), a: any = this.wind.mul(0.0025).mul(h).mul(h).mul(H);
    const sx: any = sin(time.mul(1.3).add(phase)).mul(a), sz: any = sin(time.mul(1.1).add(phase.mul(1.7))).mul(a).mul(0.6);
    return vec3(sx, 0, sz);
  }

  // ---------------------------------------------------------------- materials
  woodMaterial(): THREE.MeshStandardNodeMaterial {
    const key = 'wood'; if (this.mats.has(key)) return this.mats.get(key)!;
    const { ipos, iscl, itree } = instanceNodes(), P = positionGeometry, row = itree.x, slot = P.z.add(0.5).floor();
    const t0 = this.rec(this.segTex, slot.mul(SEG_TEX), row), t1 = this.rec(this.segTex, slot.mul(SEG_TEX).add(1), row), t2 = this.rec(this.segTex, slot.mul(SEG_TEX).add(2), row);
    const sp1 = this.rec(this.spTex, 1, row);
    const d = normalize(t1.xyz.sub(t0.xyz).add(vec3(0, 1e-5, 0))), u = t2.xyz, v = cross(d, u), ang = P.x.mul(Math.PI * 2);
    const n = u.mul(cos(ang)).add(v.mul(sin(ang)));
    // each tube runs a little past both ends (half its radius), so joints between segments of a bending branch close
    const e = P.y, ext = mix(t0.w.mul(-0.5), t1.w.mul(0.5), e), local = mix(t0.xyz, t1.xyz, e).add(d.mul(ext)).add(n.mul(mix(t0.w, t1.w, e)));
    const m = new THREE.MeshStandardNodeMaterial();
    m.positionNode = toWorld(local.add(this.sway(local, sp1.w, itree.z)), iscl, ipos);
    m.normalNode = normalToView(n, iscl);
    const barkLin = sp1.xyz; // packed linear (kitdata.packSpecies)
    // limbs and twigs inside the crown are darker (shade.ts crownAO, as the leaves and the impostor bake)
    const sp2 = this.rec(this.spTex, 2, row), sp3 = this.rec(this.spTex, 3, row), vAo = varying(crownAON(local, sp3, sp2.w, sp1.w, SHADE.woodAoIn));
    m.colorNode = vec4(barkLin.mul(mx_noise_float(local.mul(vec3(6, 1.5, 6)).add(itree.z)).mul(0.12).add(1)).mul(treeHue(itree, iscl)).mul(vAo), 1); // vec4: the shadow pass reads colorNode.a
    m.roughnessNode = float(0.9);
    this.mats.set(key, m); return m;
  }
  leafMaterial(lod: 0 | 1): THREE.MeshStandardNodeMaterial {
    const key = `leaf${lod}`; if (this.mats.has(key)) return this.mats.get(key)!;
    const { ipos, iscl, itree } = instanceNodes(), P = positionGeometry, row = itree.x, slot = P.z.add(0.5).floor(), b = slot.mul(CARD_TEX);
    const c0 = this.rec(this.cardTex, b, row), c1 = this.rec(this.cardTex, b.add(1), row), c2 = this.rec(this.cardTex, b.add(2), row), c3 = this.rec(this.cardTex, b.add(3), row), c4 = this.rec(this.cardTex, b.add(4), row);
    const sp0 = this.rec(this.spTex, 0, row), sp1 = this.rec(this.spTex, 1, row), sp2 = this.rec(this.spTex, 2, row), sp3 = this.rec(this.spTex, 3, row), sp4 = this.rec(this.spTex, 4, row), sp5 = this.rec(this.spTex, 5, row);
    const leaf = this.foliage.leaf(sp0.x), bl = this.foliage.blossom(sp0.x), B = bl.w;
    // this variant's leaf amount (model.ts variantLeaf): the variants of a species leaf out a little apart
    const L = clamp(leaf.w.add(sp4.z.mul(0.45).mul(leaf.w).mul(float(1).sub(leaf.w))), 0, 1);
    // model.ts cardState, arithmetically: blossom first, then leaves in ht order, of the rest the species' twig share
    // (in hv order) as bare twig sprays, the others not drawn
    const isB = step(c2.w.add(1e-5), B.mul(0.8)), isL = float(1).sub(isB).mul(step(c1.w.add(1e-5), L.mul(1.08))), isT = float(1).sub(isB).sub(isL);
    const showT = step(c4.x.add(1e-5), lod ? min(sp4.y.add(float(1).sub(sp4.y).mul(float(1).sub(L)).mul(0.25)), 1) : sp4.y); // model.ts lod1Twigs at LOD1
    const grow = isL.mul(L.mul(0.55).add(0.45)).add(isB.mul(0.8)).add(isT.mul(showT).mul(0.8));
    const place = isL.mul(L.mul(0.45).add(0.55)).add(isB.mul(0.8));
    const size = c0.w.mul(grow).mul(lod ? isT.mul(float(1).sub(L)).mul(LOD1_TWIG - LOD1_LEAF).add(LOD1_LEAF) : 1); // model.ts lod1Size
    const centre = mix(c1.xyz, c0.xyz, place);
    let side: any = c3.xyz, up: any = c2.xyz;
    if (lod === 0) {
      // close up, a card seen edge-on is a sliver: LOD0 cards turn up to 40 % toward the camera (in the tree's frame),
      // fading to their fixed orientation by the LOD0 radius, so LOD1 and the impostors (fixed cards) take over unchanged
      const cw = toWorld(centre, iscl, ipos), toCam = cameraPosition.sub(cw), d = length(toCam), dw = toCam.div(max(d, 1e-3));
      const cy = cos(iscl.z), sy = sin(iscl.z), dl = normalize(vec3(dw.x.mul(cy).sub(dw.z.mul(sy)), dw.y, dw.x.mul(sy).add(dw.z.mul(cy))).add(vec3(0, 1e-4, 0)));
      const r = normalize(cross(vec3(0, 1, 0), dl).add(vec3(1e-4, 0, 0))), u = cross(dl, r);
      const k = float(0.4).mul(float(1).sub(smoothstep(this.lod0R.mul(0.5), this.lod0R, d)));
      side = normalize(mix(side, r.mul(sign(dot(side, r)).add(0.001)), k)); up = normalize(mix(up, u.mul(sign(dot(up, u)).add(0.001)), k));
    }
    const asp = sp5.x.sqrt(), upLen = size.mul(asp); // the species' card shape (model.ts cardHalf): tall sprays for cypress, poplar, willow
    const local = centre.add(side.mul(P.x.mul(size).mul(0.5).div(asp))).add(up.mul(P.y.mul(upLen).mul(0.5)));
    // leaf flutter: a few cm along the card normal (C)
    const flutter = normalize(cross(c3.xyz, c2.xyz)).mul(sin(time.mul(3.1).add(slot.mul(1.7)).add(itree.z)).mul(this.wind).mul(0.006).mul(size));
    const m = new THREE.MeshStandardNodeMaterial({ side: THREE.DoubleSide });
    m.positionNode = toWorld(local.add(flutter).add(this.sway(local, sp1.w, itree.z)), iscl, ipos);
    const tile = isL.mul(sp0.y).add(isB.mul(max(sp0.w, 0))).add(isT.mul(sp0.z));
    // shade.ts leafShade, per fragment: the texel's tree-local position, its card's centre, outward axis and size, the
    // crown ellipsoid and the species' crown base and height. Varyings are packed into vec4s: WebGPU allows 16
    // inter-stage locations and three uses some of them
    // LOD0 hands over to LOD1 at the LOD0 radius: over its outer half the clump weight and the leaf tilt fade to LOD1's
    // (as the camera-facing turn does), so the switch does not change the crown's shading
    const kFar: any = lod === 0 ? smoothstep(this.lod0R.mul(0.55), this.lod0R, length(cameraPosition.sub(toWorld(centre, iscl, ipos)))) : float(1);
    const clumpEff = sp5.y.mul(lod === 0 ? mix(float(SHADE.clumpW), float(SHADE.clumpW1), kFar) : float(SHADE.clumpW1));
    const vPS: any = varying(vec4(local, upLen)), vCC: any = varying(vec4(centre, clumpEff)), vUT: any = varying(vec4(up, tile)), vST: any = varying(vec4(side, float(1).sub(kFar)));
    const vCr: any = varying(sp3), vM: any = varying(vec4(P.x.mul(0.5).add(0.5), P.y.mul(0.5).add(0.5), sp2.w, sp1.w)), vHK: any = varying(vec4(treeHue(itree, iscl).mul(c3.w), sp4.x));
    const vLeaf = varying(leaf.xyz), vBl = varying(bl.xyz), vBark = varying(vec4(sp1.xyz, sp5.y)), vCH = vBark.wwww; // bark colour + the species' clump weight
    const vP = vPS.xyz, vSize = vPS.w, vC = vCC.xyz, vClump = vCC.w, vU = vUT.xyz, vTile = vUT.w, vS = vST.xyz, vNear = vST.w, vUV = vM.xy, vCBH = vM.zw, vHue = vHK.xyz, vKappa = vHK.w;
    const ti = floor(vTile.add(0.5)), uvA = vec2(mod(ti, COLS).add(vUV.x).div(COLS), floor(ti.div(COLS)).add(vUV.y).div(ROWS));
    const tx = texture(this.atlasTex, uvA).bias(this.atlasBias);
    const cc = vC.sub(vU.mul(vSize.mul(SHADE.clumpBack * 0.5))), dcl = vP.sub(cc), dlen = max(length(dcl), 1e-3);
    const aoC = float(1).sub(vCH.x.mul(1 - (lod ? SHADE.aoClump1 : SHADE.aoClump))); // the clump's occlusion gradient, x the species' clump weight
    let nL: any = crownNormalN(vP, vCr).mul(SHADE.crownW).add(dcl.div(dlen).mul(vClump)); // vClump: the species' weight x LOD0's, fading to LOD1's
    const along = clamp(dot(dcl, vU).div(max(vSize.mul(0.5 * (1 + SHADE.clumpBack)), 1e-3)), 0, 1);
    const vAo = crownAON(vP, vCr, vCBH.x, vCBH.y, SHADE.aoIn).mul(along.mul(float(1).sub(aoC)).add(aoC));
    // LOD0: each drawn leaf has its own tilt (atlas.ts), so a card close up shades as many leaves facing their own ways.
    // LOD1 and the impostors (which bake LOD1) do without: lighting is not linear in the normal, so the tilt brightened
    // LOD1 by 3-6/255 while the impostor's filtered normals averaged it away (tree lab runs 2 and 3, at R3)
    if (lod === 0) { const tl = texture(this.tiltTex, uvA).bias(this.atlasBias).xy.mul(2).sub(1).mul(vNear); nL = normalize(nL).add(vS.mul(tl.x.mul(TILT))).add(vU.mul(tl.y.mul(TILT))); }
    nL = normalize(nL);
    m.normalNode = normalToView(nL, iscl);
    // impostor.ts leafAlbedo, the same formula
    const shade = tx.r.mul(0.6).add(0.55), petal = tx.g, bk = tx.b, lm = max(float(1).sub(petal).sub(bk), 0);
    const alb = vLeaf.mul(shade).mul(lm).add(vBl.mul(tx.r.mul(0.15).add(0.85)).mul(petal)).add(vBark.xyz.mul(shade).mul(bk)).mul(vAo).mul(vHue); // vHue: the tree's hue x the card's tint
    m.colorNode = vec4(alb, tx.a);
    // leaves pass light toward the viewer from the side away from the sun (shade.ts; bark and petals too, a simplification)
    m.emissiveNode = transmissionN(alb, dirToWorld(nL, iscl), vKappa, this.sunDir, this.sunIrr);
    // a plain alpha test: alpha-to-coverage drew an ordered screen-door dither under MSAA (test quality, tree lab)
    m.alphaTest = 0.5;
    // the shadow pass has no alpha test of its own; it reads a coarse mip (32 px tiles, coverage kept), so the shadow map
    // holds leaf clumps rather than single leaves it cannot resolve (per-leaf alpha speckled the crowns with acne)
    (m as any).maskShadowNode = texture(this.atlasTex, uvA).level(float(3)).a.greaterThan(0.5);
    m.roughnessNode = float(0.75);
    this.mats.set(key, m); return m;
  }
  /** far trees: quads facing the camera, collapsed within `cut.r` of `cut.c` (the near set) and beyond `outer` m */
  impostorMaterial(cut: { c: any; r: any }, outer: number | any): THREE.MeshStandardNodeMaterial {
    const { ipos, iscl, itree } = instanceNodes(), P = positionGeometry, row = itree.x;
    const sp2 = this.rec(this.spTex, 2, row), T = sp2.x, y0 = sp2.y;
    const toCam = cameraPosition.xz.sub(ipos.xz), dist = length(toCam), dir = toCam.div(max(dist, 1e-3));
    const vis = step(cut.r, length(ipos.xz.sub(cut.c.xz))).mul(float(1).sub(step(typeof outer === 'number' ? float(outer) : outer, dist)));
    const right = vec3(dir.y, 0, dir.x.negate());
    const m = new THREE.MeshStandardNodeMaterial();
    m.positionNode = ipos.add(right.mul(P.x.mul(T).mul(0.5).mul(iscl.x).mul(vis))).add(vec3(0, y0.add(P.y.mul(T)).mul(iscl.y).mul(vis), 0));
    // the view in the tree's frame: toCam rotated back by the yaw (inverse of toWorld)
    const c = cos(iscl.z), s = sin(iscl.z), lx = dir.x.mul(c).sub(dir.y.mul(s)), lz = dir.x.mul(s).add(dir.y.mul(c));
    const f = atan(lx, lz).div(Math.PI * 2).add(1).mul(NV); // 0..2NV, wrapped below
    const vF = varying(mod(f, NV)), vUV = varying(vec2(P.x.mul(0.5).add(0.5), P.y)), vRow = varying(row), vRight = varying(right), vDir = varying(vec3(dir.x, 0, dir.y)), vHue = varying(treeHue(itree, iscl)), vKappa = varying(this.rec(this.spTex, 4, row).x);
    const i0 = floor(vF), t = vF.sub(i0), i1 = mod(i0.add(1), NV), R = this.models.length;
    const uv0 = vec2(i0.add(vUV.x).div(NV), floor(vRow.add(0.5)).add(vUV.y).div(R)), uv1 = vec2(i1.add(vUV.x).div(NV), floor(vRow.add(0.5)).add(vUV.y).div(R));
    const a0 = texture(this.impCol, uv0), a1 = texture(this.impCol, uv1), n0 = texture(this.impNrm, uv0), n1 = texture(this.impNrm, uv1);
    const nV = normalize(mix(n0.xyz, n1.xyz, t).mul(2).sub(1).add(vec3(0, 0, 1e-4)));
    const nW = normalize(vRight.mul(nV.x).add(vec3(0, 1, 0).mul(nV.y)).add(vDir.mul(nV.z)));
    m.normalNode = normalize(cameraViewMatrix.mul(vec4(nW, 0)).xyz);
    const col = mix(a0.xyz, a1.xyz, t).mul(vHue);
    m.colorNode = vec4(col, mix(a0.w, a1.w, t));
    m.emissiveNode = transmissionN(col, nW, vKappa, this.sunDir, this.sunIrr); // as the near leaves (the baked normals are the same)
    m.alphaTest = 0.5; m.roughnessNode = float(0.8);
    return m;
  }
  /** sample the impostor of model `row` from view float `f` (0..NV) at tile uv (TSL helper for row impostors) */
  impostorSample(row: any, f: any, uvT: any) {
    const i0 = floor(f), t = f.sub(i0), i1 = mod(i0.add(1), NV), R = this.models.length, r = floor(row.add(0.5));
    const uv0 = vec2(i0.add(uvT.x).div(NV), r.add(uvT.y).div(R)), uv1 = vec2(i1.add(uvT.x).div(NV), r.add(uvT.y).div(R));
    const a0 = texture(this.impCol, uv0), a1 = texture(this.impCol, uv1), n0 = texture(this.impNrm, uv0), n1 = texture(this.impNrm, uv1);
    return { col: mix(a0.xyz, a1.xyz, t), a: mix(a0.w, a1.w, t), n: normalize(mix(n0.xyz, n1.xyz, t).mul(2).sub(1).add(vec3(0, 0, 1e-4))) };
  }
  /** light passed through the leaves (shade.ts) for a texel of albedo `alb` with world normal nW (TSL; other tree layers) */
  transmission(alb: any, nW: any, kappa: any) { return transmissionN(alb, nW, kappa, this.sunDir, this.sunIrr); }
  /** species texture record (kitdata.packSpecies): (group, leaf tile, twig tile, blossom tile), (bark, H), (T, y0, W, CB),
   *  (crown ellipsoid), (kappa, twig share, variant spread, -) */
  spRec(k: number, row: any) { return this.rec(this.spTex, k, row); }
}

// ---------------------------------------------------------------- shadow cascades
/** trees cast shadows from within 120 m of the camera (SHADOW_R), and those shadows fall within ~180 m: a cascade that
 *  starts farther out draws none of them (the instanced meshes' bounds span the world, so without this every caster was
 *  drawn into every cascade, as the people found: humanGPU.ts cascadeNeedsPeople) */
export const TREE_SHADOW_REACH = 180;
const SHADOW_LIGHTS: THREE.DirectionalLight[] = [];
/** register the scene's shadow-casting sun (its CSM node, if any, gives the cascades' distances) */
export function registerShadowLight(scene: THREE.Object3D) { scene.traverse(o => { const l = o as THREE.DirectionalLight; if (l.isDirectionalLight && l.castShadow && !SHADOW_LIGHTS.includes(l)) SHADOW_LIGHTS.push(l); }); }
/** where the cascade drawn by this shadow camera starts (m from the view camera); 0 if unknown or the first */
function cascadeStart(shadowCam: THREE.Camera) {
  for (const L of SHADOW_LIGHTS) { const n: any = (L.shadow as any).shadowNode; if (!n?.lights?.length || !n.camera) continue;
    const i = n.lights.findIndex((l: any) => l.shadow?.camera === shadowCam); if (i <= 0) continue;
    return (n.breaks[i - 1] ?? 0) * Math.min(n.camera.far, n.maxFar); }
  return 0;
}
/** the shadow passes draw `shadowN()` instances (the main pass draws geometry.instanceCount, a prefix of them: D-228), and
 *  none into a cascade that starts beyond TREE_SHADOW_REACH */
function nearCascadesOnly(mesh: THREE.Mesh, shadowN: () => number) {
  let saved = -1; const g = mesh.geometry as THREE.InstancedBufferGeometry;
  mesh.onBeforeShadow = (_r, _o, _c, shadowCam) => { saved = g.instanceCount; g.instanceCount = cascadeStart(shadowCam) < TREE_SHADOW_REACH ? shadowN() : 0; };
  mesh.onAfterShadow = () => { if (saved >= 0) { g.instanceCount = saved; saved = -1; } };
}

// ---------------------------------------------------------------- view culling of the near 3-D trees (D-228)
/** The near sets hold every tree within r3 all round the camera and are not frustum-culled (their bounds span the world),
 *  so a frame drew every one of them, behind the camera too, and every shadow caster into three cascades (village P22 at
 *  high: 2.56 M triangles for the plain, D-040's limit 2 M). Culled per tree instead: a tree is drawn in the main pass if
 *  its bounding sphere meets the view frustum widened by `marginDeg`; a shadow caster stays in the shadow passes if the
 *  sphere swept away from the sun until its shadow is on the ground meets that frustum (its shadow can be seen). Neither
 *  the tree nor its shadow can reach the frame otherwise, so nothing visible is lost. The cull is redone when the view
 *  turns by `turnDeg`, the camera moves `moveM` or the sun moves `sunDeg`; trees within `keepR` are always kept, so
 *  neither a turn nor a step brings an uncovered tree into the frame between two culls (margin 8° > 3° turn + atan(1/12)). */
export const VIEW_CULL = { marginDeg: 8, turnDeg: 3, moveM: 1, sunDeg: 0.5, keepR: 12, shadowCapM: 400 };
const _proxy = new THREE.PerspectiveCamera(), _pm = new THREE.Matrix4(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
/** the view frustum of `cam`, widened by `marginDeg` on every side */
export function widenedFrustum(cam: THREE.PerspectiveCamera, marginDeg = VIEW_CULL.marginDeg, out = new THREE.Frustum()) {
  const M = (marginDeg * Math.PI) / 180, tv = Math.tan((cam.fov * Math.PI) / 360) / (cam.zoom || 1), th = tv * cam.aspect;
  const v2 = Math.min(Math.atan(tv) + M, 1.55), h2 = Math.min(Math.atan(th) + M, 1.55);
  _proxy.fov = (2 * v2 * 180) / Math.PI; _proxy.aspect = Math.tan(h2) / Math.tan(v2); _proxy.near = cam.near; _proxy.far = cam.far; _proxy.updateProjectionMatrix();
  cam.updateMatrixWorld(); _proxy.matrixWorldInverse.copy(cam.matrixWorld).invert();
  return out.setFromProjectionMatrix(_pm.multiplyMatrices(_proxy.projectionMatrix, _proxy.matrixWorldInverse));
}
/** the registered shadow-casting sun's direction (toward the sun), or null (no sun: no shadows) */
export function shadowSunDir(out = new THREE.Vector3()) { const L = SHADOW_LIGHTS[0]; if (!L) return null; return out.copy(L.position).sub(L.target.position).normalize(); }
/** 1: the tree can be seen; 2: only its shadow can (casters only); 0: neither. `toSun` null: no shadows */
export function treeViewClass(r: TreeInst, models: TreeModel[], fr: THREE.Frustum, camPos: THREE.Vector3, toSun: THREE.Vector3 | null, caster: boolean): 0 | 1 | 2 {
  if (Math.hypot(r.x - camPos.x, r.z - camPos.z) < VIEW_CULL.keepR) return 1;
  const m = models[r.row], h = m.H * r.sy, rad = 0.5 * Math.hypot(m.W * r.sxz, h) + 0.5;
  _a.set(r.x, r.y + h / 2, r.z);
  const P = fr.planes; let inside = true;
  for (let i = 0; i < 6; i++) if (P[i].distanceToPoint(_a) < -rad) { inside = false; break; }
  if (inside) return 1;
  if (!caster || !toSun) return 0;
  // the capsule from the sphere along the light until every point of the sphere has reached 10 m below the tree's foot
  const sinEl = Math.max(toSun.y, Math.sin((2 * Math.PI) / 180)), L = Math.min(VIEW_CULL.shadowCapM, (h / 2 + rad + 10) / sinEl);
  _b.copy(toSun).multiplyScalar(-L).add(_a);
  for (let i = 0; i < 6; i++) if (P[i].distanceToPoint(_a) < -rad && P[i].distanceToPoint(_b) < -rad) return 0;
  return 2;
}

// ---------------------------------------------------------------- template geometry and instanced meshes
function woodTemplate(M: number, S: number) {
  const pos: number[] = [], idx: number[] = [];
  for (let k = 0; k < M; k++) { const b = pos.length / 3;
    for (let e = 0; e < 2; e++) for (let i = 0; i < S; i++) pos.push(i / S, e, k);
    for (let i = 0; i < S; i++) { const a = b + i, bb = b + ((i + 1) % S), c = a + S, d = bb + S; idx.push(a, bb, c, bb, d, c); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}
function cardTemplate(K: number) {
  const pos: number[] = [], idx: number[] = [];
  for (let k = 0; k < K; k++) { const b = pos.length / 3; pos.push(-1, -1, k, 1, -1, k, -1, 1, k, 1, 1, k); idx.push(b, b + 1, b + 2, b + 2, b + 1, b + 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); return g;
}
function quadTemplate() {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([-1, 0, 0, 1, 0, 0, -1, 1, 0, 1, 1, 0], 3)); g.setIndex([0, 1, 2, 2, 1, 3]); return g;
}

/** instance buffers + records; `apply` fills them from TreeInst records */
class Instances {
  readonly pos: THREE.InstancedBufferAttribute; readonly scl: THREE.InstancedBufferAttribute; readonly tree: THREE.InstancedBufferAttribute;
  recs: TreeInst[] = [];
  constructor(readonly cap: number) {
    this.pos = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, cap) * 3), 3); this.scl = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, cap) * 4), 4); this.tree = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, cap) * 4), 4);
    for (const a of [this.pos, this.scl, this.tree]) a.setUsage(THREE.DynamicDrawUsage);
  }
  geometry(template: THREE.BufferGeometry) {
    const ig = new THREE.InstancedBufferGeometry(); for (const [k, a] of Object.entries(template.attributes)) ig.setAttribute(k, a); ig.setIndex(template.index);
    ig.setAttribute('ipos', this.pos); ig.setAttribute('iscl', this.scl); ig.setAttribute('itree', this.tree); ig.instanceCount = 0;
    ig.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e7); return ig;
  }
  apply(recs: TreeInst[]) {
    const n = Math.min(this.cap, recs.length); this.recs = recs.slice(0, n);
    for (let i = 0; i < n; i++) { const r = recs[i]; this.pos.setXYZ(i, r.x, r.y, r.z); this.scl.setXYZW(i, r.sxz, r.sy, r.yaw, r.tint); this.tree.setXYZW(i, r.row, groupIndex(SPECIES[r.si].group), (r.x * 0.37 + r.z * 0.61) % 6.28, r.si); }
    for (const a of [this.pos, this.scl, this.tree]) a.needsUpdate = true;
    return n;
  }
}

/** dev overlay (F3) for instanced trees: a ray hits a tree's crown (vertical cylinder over the crown) or trunk; the
 *  species' tiers and sources are shown for the tree hit */
function pickable(mesh: THREE.Mesh, inst: () => TreeInst[], models: TreeModel[], layer: string) {
  const ray = new THREE.Ray(), hit = new THREE.Vector3(), box = new THREE.Box3();
  mesh.raycast = (rc, out) => {
    const recs = inst(); let best: any = null;
    for (let i = 0; i < recs.length; i++) { const r = recs[i], m = models[r.row];
      const w = (m.W / 2) * r.sxz, h = m.H * r.sy;
      if (Math.hypot(r.x - rc.ray.origin.x, r.z - rc.ray.origin.z) > rc.far + w) continue;
      box.set(new THREE.Vector3(r.x - w * 0.8, r.y + m.CB * r.sy, r.z - w * 0.8), new THREE.Vector3(r.x + w * 0.8, r.y + h, r.z + w * 0.8));
      ray.copy(rc.ray); if (!ray.intersectBox(box, hit)) { box.set(new THREE.Vector3(r.x - 0.3, r.y, r.z - 0.3), new THREE.Vector3(r.x + 0.3, r.y + m.CB * r.sy + 0.5, r.z + 0.3)); if (!ray.intersectBox(box, hit)) continue; }
      const d = hit.distanceTo(rc.ray.origin); if (d < rc.near || d > rc.far) continue;
      if (!best || d < best.distance) best = { distance: d, point: hit.clone(), object: mesh, instanceId: i }; }
    if (best) out.push(best);
  };
  const general = { tier: 'C', src: 'BOTANY-GEN', note: `${layer}: trees generated from src/data/trees.json (species presence B, form C, placement C)` };
  mesh.userData = { ...general, describe: (h: any) => { const r = inst()[h?.instanceId ?? -1]; if (!r) return general; const m = models[r.row];
    const t = speciesTag(m.species, r.where ?? layer); return { ...t, note: `${t.note}; this tree ${(m.H * r.sy).toFixed(1)} m tall, crown ${(m.W * r.sxz).toFixed(1)} m (placement C)` }; } };
}

/** near 3-D trees at one level of detail: wood + leaves, one draw each */
export class NearTreeSet {
  readonly wood: THREE.Mesh; readonly leaves: THREE.Mesh; private inst: Instances; private shadowN = 0;
  constructor(kit: TreeKit, readonly lod: 0 | 1, cap: number, castShadow: boolean, name: string) {
    this.inst = new Instances(cap);
    this.wood = new THREE.Mesh(this.inst.geometry(woodTemplate(lod ? M1 : M0, lod ? SIDES1 : SIDES0)), kit.woodMaterial());
    this.leaves = new THREE.Mesh(this.inst.geometry(cardTemplate(lod ? K1 : K0)), kit.leafMaterial(lod));
    this.wood.name = `${name}-wood-lod${lod}`; this.leaves.name = `${name}-leaves-lod${lod}`;
    for (const m of [this.wood, this.leaves]) { m.castShadow = castShadow; m.receiveShadow = true; m.frustumCulled = false; pickable(m, () => this.inst.recs, kit.models, name); if (castShadow) nearCascadesOnly(m, () => this.shadowN); m.onBeforeRender = () => kit.syncSun(); }
  }
  /** the records to draw; the main pass draws the first `mainN` of them (the trees in view), the shadow passes all (D-228) */
  set(recs: TreeInst[], mainN = recs.length) { const n = this.inst.apply(recs), k = Math.min(n, mainN); this.shadowN = n;
    (this.wood.geometry as THREE.InstancedBufferGeometry).instanceCount = k; (this.leaves.geometry as THREE.InstancedBufferGeometry).instanceCount = k; return n; }
  /** trees held (drawn in the shadow passes if this set casts shadows) */
  count() { return this.shadowN; }
  /** the records held: the first drawn() of them are drawn in the main pass */
  records(): readonly TreeInst[] { return this.inst.recs; }
  /** trees drawn in the main pass */
  drawn() { return (this.wood.geometry as THREE.InstancedBufferGeometry).instanceCount; }
  tris() { return this.count() * (this.lod ? TRIS.lod1 : TRIS.lod0); }
}
/** far trees: one camera-facing impostor quad each */
export class ImpostorSet {
  readonly mesh: THREE.Mesh; private inst: Instances;
  constructor(kit: TreeKit, cap: number, cut: { c: any; r: any }, outer: number | any, name: string) {
    this.inst = new Instances(cap);
    this.mesh = new THREE.Mesh(this.inst.geometry(quadTemplate()), kit.impostorMaterial(cut, outer));
    this.mesh.name = name; this.mesh.frustumCulled = false; this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.onBeforeRender = () => kit.syncSun();
    pickable(this.mesh, () => this.inst.recs, kit.models, name);
  }
  set(recs: TreeInst[]) { const n = this.inst.apply(recs); (this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = n; return n; }
  count() { return (this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount; }
}

/** a tree record from a species, a height, a crown width and a seed (variant, yaw and tint from the seed) */
export function treeInst(sp: string, x: number, groundY: number, z: number, h: number, w: number, seed: number, where?: string): TreeInst {
  const si = speciesIndex(sp), variant = (seed >>> 3) % VARIANTS, row = rowOf(si, variant), m = allModels()[row];
  const s = seed >>> 0;
  return { x, y: groundY, z, sy: h / m.H, sxz: w / m.W, yaw: ((s % 628) / 100), tint: 0.9 + 0.2 * (((s >>> 10) % 1000) / 1000), row, si, where };
}
/** a species' height and crown width for a seed, inside its data ranges (trees.json, C) */
export function speciesSize(sp: string, u1: number, u2: number) {
  const s = SPECIES[speciesIndex(sp)], h = s.height_m[0] + (s.height_m[1] - s.height_m[0]) * u1;
  return { h, w: h * (s.crown_width_ratio[0] + (s.crown_width_ratio[1] - s.crown_width_ratio[0]) * u2) };
}
export { barkLinear, TRIS, K0, K1, M0, M1 };
