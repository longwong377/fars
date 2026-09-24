// The plain's fields, crops, orchard floors and woodland drawn into the terrain material (Phase 7, D-038). Zero extra draw
// calls: the terrain chunks keep their geometry and get the earth material plus a `modify` layer (materials.ts) that,
// per pixel, finds the field plot (the same integer-hash Voronoi as fields.ts plotAt), reads the land use at the plot's
// seed from the zone texture, and colours the plot from the crop-state texture for today's date (+- the plot's own
// phenology offset). No runtime select() (D-012): masks are arithmetic.
//
// D-190 (session 6, the §8.2 rubric's "empty lawn" and "sand dunes"):
//  - Distance: a plot fades toward its zone's mean colour by the pixel footprint's MINOR axis (across the view) and keeps a
//    share of its own contrast along the major axis (the variance of the mean of k plots falls as 1/k). The old fade by
//    the footprint's length (its major axis, along the view: ~50 m per pixel at 1 km from the Grand Stair) blanked every
//    plot beyond ~250 m of the Terrace, and the plain read as one colour to the horizon.
//  - Rain-fed land alternates crop and fallow years by district (fields.ts ROTATION), and the far mean follows the
//    district, so 800 m blocks of green and of weedy fallow read at any distance.
//  - The town's used ground (townGround.ts): trampled earth at the Terrace foot, the approach and the quarters; worn
//    paths where the population walks; irrigated plots in the town's open ground between its built sites.
//  - The hills (terrain/terrainDetail.ts): limestone rock by slope and convexity, bedding ledges in cliff-forming
//    packages, gullies where the DEM's own drainage converges, scree on the concave middle slopes, soil and herbs on the
//    gentle ground, and shrubs (pistachio-almond, B pollen; C placement), more in the gullies and on shaded slopes.
import * as THREE from 'three/webgpu';
import { Fn, uniform, positionWorld, normalWorld, attribute, vec2, vec3, vec4, float, uint, int, ivec2, floor, fract, min, max, mix, step, smoothstep, length, fwidth, textureLoad, texture, abs, sin, cos, clamp, color, mx_noise_float, sqrt, dot } from 'three/tsl';
import { surfaceMaterial, type Layer } from '../../render/materials';
import { DISTRICT, SALT, STRIP, ZONE, ZoneMap, IRR_STEPS, ROTATION, VINE_SHARE, pcg } from './fields';
import { CROP_ROWS, YEAR, cropTable, cropState, PLOT_OFFSET_DAYS, foliage } from './seasonal';
import { GROUND, PATH_W } from './townGround';
import { CURV_SCALE, type Detail, type DetailMap } from '../../terrain/terrainDetail';

// ---------------------------------------------------------------- TSL mirrors of fields.ts
const pcgN = (v: any) => { const s = v.mul(747796405).add(2891336453); const w = s.shiftRight(s.shiftRight(28).add(4)).bitXor(s).mul(277803737); return w.shiftRight(22).bitXor(w); };
/** hash2(ix, iy, salt) with a JS-constant salt (its pcg folded at build time) or a uint node salt */
const hash2N = (ix: any, iy: any, salt: number | any) => pcgN(ix.add(pcgN(iy.add(typeof salt === 'number' ? uint(pcg(salt)) : pcgN(salt)))));
const unitN = (h: any) => h.shiftRight(8).toFloat().mul(1 / 16777216);
const cellUN = (c: any) => c.add(32768).toUint(); // c is already floor()ed

/** the hills (D-190, C unless noted): limestone (the Terrace is partly cut from Kuh-e Rahmat's own bedrock: IR-PERS, B) */
export const HILL = {
  /** sRGB albedo: weathered grey limestone, its darker weathered patches, fresh scree, colluvial soil on the slopes (C) */
  rock: [0.50, 0.48, 0.45], rockDark: [0.36, 0.35, 0.33], scree: [0.58, 0.55, 0.50], slopeSoil: [0.46, 0.40, 0.32],
  /** bedding: packages of beds (m) of which ~45 % form cliffs; beds 0.6-2.2 m; a gentle dip (C) */
  pkg: 12, cliffShare: 0.45, bed: [0.6, 1.6], dip: 0.05, dipDir: 0.52,
  /** shrubs: 5 m cells, crowns 0.6-1.6 m radius; cover on open slopes, in gullies, on shaded (north-facing) slopes (C) */
  shrubCell: 5, shrubCover: { slope: 0.035, gully: 0.09, north: 0.04 },
} as const;

export interface PlainGroundState { day: any; meanIrr: any; meanRain: any; meanOrch: any; oak: any }

const dataTex = (data: Uint8Array, n: number) => { const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; };

export class PlainGround {
  readonly day = uniform(0); // day of year (0..364)
  readonly meanIrr = uniform(new THREE.Vector4()); readonly meanRain = uniform(new THREE.Vector4()); readonly meanOrch = uniform(new THREE.Vector4());
  /** the rain-fed far mean in a district's crop year and in its fallow year (fields.ts ROTATION) */
  readonly meanRainCrop = uniform(new THREE.Vector4()); readonly meanRainFallow = uniform(new THREE.Vector4());
  readonly oakLeaf = uniform(new THREE.Vector4(0.2, 0.26, 0.12, 1)); // woodland canopy colour + leaf amount
  /** the canopy is painted only for trees farther than treeR from paintC (the tree layers' mid-ring centre and radius,
   *  D-120): nearer woodland trees stand as impostors or 3-D trees, so a painted dot never lies under a standing tree */
  readonly treeR = uniform(60);
  readonly paintC: any = uniform(new THREE.Vector3(1e9, 0, 1e9));
  readonly zoneTex: THREE.DataTexture; readonly cropTex: THREE.DataTexture;
  /** the hills' landform maps (terrainDetail.ts) and the town's used ground (townGround.ts); 1-texel neutral stand-ins
   *  when absent */
  readonly detNear: THREE.DataTexture; readonly detMid: THREE.DataTexture; readonly groundTex: THREE.DataTexture;
  private dn: { half: number; cell: number; n: number }; private dm: { half: number; cell: number; n: number };
  readonly material: THREE.MeshStandardNodeMaterial;
  constructor(readonly zones: ZoneMap, detail: Detail | null = null) {
    this.zoneTex = dataTex(zones.data, zones.n);
    this.cropTex = new THREE.DataTexture(cropTable(), YEAR, CROP_ROWS.length, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.cropTex.magFilter = THREE.NearestFilter; this.cropTex.minFilter = THREE.NearestFilter; this.cropTex.generateMipmaps = false; this.cropTex.needsUpdate = true;
    const flat = (m: DetailMap | undefined) => m ?? { data: new Uint8Array([0, 128, 0, 0]), n: 1, half: 0, cell: 1 } as DetailMap;
    const a = flat(detail?.near), b = flat(detail?.mid);
    this.detNear = dataTex(a.data, a.n); this.detMid = dataTex(b.data, b.n); this.dn = { half: a.half, cell: a.cell, n: a.n }; this.dm = { half: b.half, cell: b.cell, n: b.n };
    const g = zones.ground; this.groundTex = g ? dataTex(g.data, g.n) : dataTex(new Uint8Array([255, 255, 0, 255]), 1);
    this.material = surfaceMaterial('earth', { vertexColors: true, variant: 'plain', modify: (L: Layer) => this.modify(L) });
    this.material.userData = { tier: 'C', src: 'RECON;SUMNER1986;IR-FOODAG;SAEIDI2021;IR-PERS;COP-DEM', note: 'plain surface: loam and seasonal herbs; fields (plots C, crop calendar B/C, rain-fed crop/fallow by block C), orchard floors and woodland canopy from plain.json zones (C); the town\'s trampled ground, worn paths and garden plots (C); the hills: limestone rock, bedding, gullies from the DEM\'s drainage, scree and shrubs (lithology B, the rest C)' };
  }
  /** date → uniforms (called when the day changes) */
  setDay(doy: number) {
    this.day.value = Math.floor(((doy % YEAR) + YEAR) % YEAR);
    const mean = (weights: [number, number][]) => { const v = new THREE.Vector4(); let off = 0;
      for (const [row, w] of weights) { let h = 0, g = 0, s = 0, t = 0; for (off = -PLOT_OFFSET_DAYS; off <= PLOT_OFFSET_DAYS; off += 4) { const c = cropState(CROP_ROWS[row], doy + off); h += c.height; g += c.green; s += c.straw; t += c.tilled; }
        const k = w / Math.ceil((2 * PLOT_OFFSET_DAYS + 1) / 4); v.x += Math.min(1, h / 1.5) * k; v.y += g * k; v.z += s * k; v.w += t * k; }
      return v; };
    const irr = [IRR_STEPS[0], IRR_STEPS[1] - IRR_STEPS[0], IRR_STEPS[2] - IRR_STEPS[1], IRR_STEPS[3] - IRR_STEPS[2], 1 - IRR_STEPS[3]];
    this.meanIrr.value.copy(mean(irr.map((w, i) => [i, w] as [number, number])));
    this.meanRainCrop.value.copy(mean([[0, ROTATION.crop], [4, 1 - ROTATION.crop]]));
    this.meanRainFallow.value.copy(mean([[0, ROTATION.fallow], [4, 1 - ROTATION.fallow]]));
    this.meanRain.value.copy(this.meanRainCrop.value).add(this.meanRainFallow.value).multiplyScalar(0.5);
    this.meanOrch.value.copy(mean([[5, 1 - VINE_SHARE], [6, VINE_SHARE]]));
    const f = foliage('oak', doy); this.oakLeaf.value.set(f.colour[0], f.colour[1], f.colour[2], f.leaf);
  }

  private modify(L: Layer): Layer {
    const zoneTex = this.zoneTex, cropTex = this.cropTex, day = this.day, meanIrr = this.meanIrr, meanOrch = this.meanOrch, oak = this.oakLeaf;
    const meanRainC = this.meanRainCrop, meanRainF = this.meanRainFallow;
    const lin = (r: number, g: number, b: number) => color(new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace));
    const linA = (a: readonly number[]) => lin(a[0], a[1], a[2]);
    const H = ZONE.half, C = ZONE.cell, N = ZONE.n;
    const dn = this.dn, dm = this.dm, detNear = this.detNear, detMid = this.detMid, groundTex = this.groundTex;
    const field = Fn(([albIn]: any[]) => {
      const p = positionWorld.xz; // world x, z (z = -grid north)
      // --- the pixel footprint on the ground (m): its major axis (along the view at grazing angles) and minor axis (across)
      const dpx = p.dFdx(), dpy = p.dFdy();
      const major = max(length(dpx), length(dpy)).max(1e-4), minor = abs(dpx.x.mul(dpy.y).sub(dpx.y.mul(dpy.x))).div(major);
      const fw = length(fwidth(p)); // metres per pixel (|dx| + |dy|: the fine features' fade, as before)
      const near = float(1).sub(smoothstep(3.0, 10.0, fw));
      // a plot keeps its own state while it spans pixels across the view (minor < ~6-20 m); along the view a pixel mixes
      // ~major/40 m plots, whose mean keeps ~sqrt(40/major) of one plot's contrast (C)
      const plotKeep = float(1).sub(smoothstep(6.0, 20.0, minor)).mul(clamp(sqrt(float(40).div(major)), 0, 1));
      // --- district (800 m jittered-grid Voronoi)
      const qd = p.div(DISTRICT), cd = floor(qd);
      const f1 = float(1e9).toVar(), f2 = float(1e9).toVar(), bc = vec2(0).toVar(), bs = vec2(0).toVar();
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const c = cd.add(vec2(i, j)), ux = cellUN(c.x), uz = cellUN(c.y);
        const s = c.add(0.1).add(vec2(unitN(hash2N(ux, uz, SALT.dx)), unitN(hash2N(ux, uz, SALT.dz))).mul(0.8)).mul(DISTRICT);
        const d = length(p.sub(s)), m = step(d, f1);
        f2.assign(mix(min(f2, d), f1, m)); f1.assign(min(f1, d)); bc.assign(mix(bc, c, m)); bs.assign(mix(bs, s, m));
      }
      const dux = cellUN(bc.x), duz = cellUN(bc.y);
      const ang = unitN(hash2N(dux, duz, SALT.angle)).mul(Math.PI);
      const sw = float(STRIP.w[0]).add(unitN(hash2N(dux, duz, SALT.width)).mul(STRIP.w[1])), sl = float(STRIP.l[0]).add(unitN(hash2N(dux, duz, SALT.length)).mul(STRIP.l[1]));
      const salt = hash2N(dux, duz, SALT.plotSalt);
      const cropYear = step(unitN(hash2N(dux, duz, SALT.rotation)), 0.5); // 1: the district's rain-fed land is in its crop year (fields.ts rainfedThreshold)
      const ca = cos(ang), sa = sin(ang), dp = p.sub(bs);
      const uv = vec2(dp.x.mul(ca).add(dp.y.mul(sa)).div(sw), dp.x.mul(sa).negate().add(dp.y.mul(ca)).div(sl)), cu = floor(uv);
      // --- plot (anisotropic Voronoi in strip space)
      const g1 = float(1e9).toVar(), g2 = float(1e9).toVar(), pc = vec2(0).toVar(), ps = vec2(0).toVar();
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const c = cu.add(vec2(i, j)), a = cellUN(c.x), b = cellUN(c.y);
        const s = c.add(0.15).add(vec2(unitN(hash2N(a, b, salt.add(SALT.px))), unitN(hash2N(a, b, salt.add(SALT.pz)))).mul(0.7));
        const d = length(uv.sub(s)), m = step(d, g1);
        g2.assign(mix(min(g2, d), g1, m)); g1.assign(min(g1, d)); pc.assign(mix(pc, c, m)); ps.assign(mix(ps, s, m));
      }
      const ph = hash2N(cellUN(pc.x), cellUN(pc.y), salt);
      const su = ps.x.mul(sw), sv = ps.y.mul(sl);
      const seed = bs.add(vec2(su.mul(ca).sub(sv.mul(sa)), su.mul(sa).add(sv.mul(ca))));
      const edge = g2.sub(g1).mul(0.5).mul(sw), dEdge = f2.sub(f1).mul(0.5);
      // --- the town's used ground (townGround.ts; world z = -north: the map's rows run with z like the terrain rings)
      const gIn = step(abs(p.x), GROUND.half).mul(step(abs(p.y), GROUND.half));
      const gr = texture(groundTex, p.add(GROUND.half).div(GROUND.cell).add(0.5).div(GROUND.n));
      const allowed = mix(float(1), smoothstep(0.4, 0.6, gr.w), gIn);
      const trample = gr.z.mul(gIn);
      const pathD = mix(float(99), length(gr.xy.mul(255).sub(128).div(10)), gIn);
      // --- land use at the plot seed (nearest zone texel) and at this pixel (bilinear, for the far fade)
      const tc = clamp(floor(seed.add(H).div(C)), 0, N - 1);
      const z = textureLoad(zoneTex, ivec2(int(tc.x), int(tc.y)));
      const wIrr = step(0.5, z.x), wRain = step(0.5, z.y).mul(float(1).sub(wIrr)), wOrch = step(0.5, z.z);
      const wI = wIrr.mul(float(1).sub(wOrch)), wR = wRain.mul(float(1).sub(wOrch));
      const hc = unitN(hash2N(ph, uint(7), SALT.crop)), ho = unitN(hash2N(ph, uint(9), SALT.offset));
      const kIrr = step(IRR_STEPS[0], hc).add(step(IRR_STEPS[1], hc)).add(step(IRR_STEPS[2], hc)).add(step(IRR_STEPS[3], hc));
      const kRain = step(mix(float(ROTATION.fallow), float(ROTATION.crop), cropYear), hc).mul(4), kOrch = float(5).add(step(1 - VINE_SHARE, hc));
      const k = wI.mul(kIrr).add(wR.mul(kRain)).add(wOrch.mul(kOrch)).add(float(1).sub(wI).sub(wR).sub(wOrch).max(0).mul(7));
      const off = floor(ho.mul(2 * PLOT_OFFSET_DAYS + 1)).sub(PLOT_OFFSET_DAYS);
      const col = day.add(off).add(YEAR).mod(YEAR);
      const st = textureLoad(cropTex, ivec2(int(col), int(k))); // height/1.5, green, straw, tilled
      const mask = wI.add(wR).add(wOrch).mul(allowed);
      // far: the zone's mean state today, weighted by the bilinear zone at this pixel; rain-fed land by its district's year
      const zb = texture(zoneTex, p.add(H).div(2 * H));
      const bI = zb.x.mul(float(1).sub(zb.z)), bR = zb.y.mul(float(1).sub(zb.x)).mul(float(1).sub(zb.z)), bO = zb.z;
      const bSum = bI.add(bR).add(bO).max(1e-4);
      const meanRain = mix(meanRainF, meanRainC, cropYear);
      const stFar = meanIrr.mul(bI).add(meanRain.mul(bR)).add(meanOrch.mul(bO)).div(bSum);
      const S = mix(stFar, st, plotKeep), M = mix(bI.add(bR).add(bO).min(1).mul(allowed), mask, plotKeep);
      // --- colour of the plot from its state
      const soil = attribute('color', 'vec3').mul(float(1).add(mx_noise_float(positionWorld.mul(0.25)).mul(0.08)));
      const hgt = S.x.mul(1.5);
      const young = lin(0.30, 0.42, 0.15), mature = lin(0.22, 0.33, 0.13), ripe = lin(0.72, 0.60, 0.33), stubble = lin(0.66, 0.60, 0.46);
      const green = mix(young, mature, smoothstep(0.2, 0.8, hgt));
      const straw = mix(stubble, ripe, smoothstep(0.15, 0.4, hgt));
      // vineyard rows (row 6): leaves in stripes 2.5 m apart along the strip; tilled furrows 0.6 m apart (near only)
      const isVine = step(5.5, k).mul(step(k, 6.5)).mul(near);
      const across = uv.x.mul(sw);
      const vineRow = smoothstep(0.55, 0.85, abs(fract(across.div(2.5)).sub(0.5)).mul(2).oneMinus().add(0.3));
      const gCov = mix(S.y, S.y.mul(vineRow).mul(1.6).min(1), isVine), sCov = S.z;
      const furrow = sin(across.div(0.6).mul(Math.PI * 2)).mul(0.5).add(0.5);
      const tilled = S.w.mul(near);
      const bare = float(1).sub(gCov).sub(sCov).max(0);
      const soilT = soil.mul(float(1).sub(tilled.mul(0.28).mul(furrow.mul(0.6).add(0.4))));
      const speck = mx_noise_float(positionWorld.mul(3.1)).mul(0.12).add(1);
      // each plot its own shade (sowing density, soil, weeding: +-12 %, C), so neighbouring plots of one crop still read apart
      const tint = unitN(hash2N(ph, uint(5), 43)).mul(0.24).add(0.88).mul(plotKeep).add(float(1).sub(plotKeep));
      let plotAlb: any = soilT.mul(bare).add(green.mul(gCov).mul(speck)).add(straw.mul(sCov).mul(speck)).mul(tint);
      // bunds on plot edges (0.35 m) and a track along district edges (2.5 m wide), near only, in fields
      const bund = float(1).sub(smoothstep(0.3, 0.6, edge)).mul(near).mul(mask); // earth bunds between plots, ~1 m wide (C)
      const track = float(1).sub(smoothstep(1.0, 1.6, dEdge)).mul(near).mul(mask);
      plotAlb = mix(plotAlb, mix(soil.mul(1.05), lin(0.36, 0.40, 0.2), 0.45), bund.mul(0.85));
      plotAlb = mix(plotAlb, soil.mul(1.15).add(vec3(0.02, 0.018, 0.012)), track.mul(0.9));
      let alb: any = mix(albIn, plotAlb, M);
      // --- trampled ground and worn paths (the town, the Terrace foot): packed bare earth, the herbs trodden and grazed off,
      // dung and straw litter near; a path is a band of PATH_W m, box-filtered over the pixel (a faint line far away)
      const packed = soil.mul(1.12).add(vec3(0.015, 0.012, 0.008));
      const litter = smoothstep(0.55, 0.8, mx_noise_float(positionWorld.mul(0.9).add(vec3(3.1, 0, 7.7)))).mul(near).mul(0.5);
      const packedAlb = mix(packed, packed.mul(vec3(0.62, 0.58, 0.52)), litter);
      const tr = trample.mul(float(1).sub(M)).mul(0.85);
      alb = mix(alb, packedAlb, tr);
      const pxD = fwidth(pathD).max(1e-4), hw = PATH_W / 2;
      const pathCov = clamp(min(float(hw), pathD.add(pxD.mul(0.5))).sub(max(float(-hw), pathD.sub(pxD.mul(0.5)))).max(0).div(pxD), 0, 1);
      alb = mix(alb, packed.mul(1.08), pathCov.mul(0.8));

      // --- the hills (terrainDetail.ts maps: near ring 4 m, mid ring 16 m; beyond them the geometric normal alone)
      const detAt = (tex: THREE.DataTexture, R: { half: number; cell: number; n: number }) => texture(tex, p.add(R.half).div(R.cell).add(0.5).div(R.n));
      const cheb = max(abs(p.x), abs(p.y));
      const inNear = float(1).sub(smoothstep(dn.half - 96, dn.half - 24, cheb)), inMid = float(1).sub(smoothstep(dm.half - 400, dm.half - 48, cheb));
      const D = mix(detAt(detMid, dm), detAt(detNear, dn), inNear), has = max(inNear, inMid);
      const nw = normalWorld, geoSlope = sqrt(float(1).sub(nw.y.mul(nw.y)).max(0)).div(nw.y.max(0.05));
      const slope = mix(geoSlope, D.z.mul(1.5), has);
      const gully = D.x.mul(has), curv = D.y.mul(255).sub(128).div(CURV_SCALE).mul(has); // 1/m, + convex
      const cvx = clamp(curv.mul(40), -1, 1); // ±0.025 1/m spans it
      const hillOn = smoothstep(0.1, 0.22, slope).mul(float(1).sub(M)).mul(float(1).sub(trample));
      // bedding (C): a stratigraphic height with a gentle dip and a broad warp; packages of beds, ~45 % cliff-forming
      const P3 = positionWorld;
      const sy = P3.y.add(p.x.mul(Math.cos(HILL.dipDir)).add(p.y.mul(Math.sin(HILL.dipDir))).mul(HILL.dip)).add(mx_noise_float(vec3(p.x.mul(0.0031), 0.5, p.y.mul(0.0031))).mul(9));
      const pkgI = floor(sy.div(HILL.pkg)), pkgF = fract(sy.div(HILL.pkg));
      const hp = unitN(pcgN(pkgI.add(8192).toUint())), cliff = step(hp, HILL.cliffShare);
      const bedT = float(HILL.bed[0]).add(unitN(pcgN(pkgI.add(9001).toUint())).mul(HILL.bed[1]));
      const sb = sy.div(bedT), fb = fract(sb), bedI = floor(sb);
      const fwY = fwidth(sy).max(1e-4);
      const bedVis = float(1).sub(smoothstep(0.25, 0.6, fwY.div(bedT))), pkgVis = float(1).sub(smoothstep(0.2, 0.5, fwY.div(HILL.pkg)));
      // rock (C): slopes over ~21-40 deg, convex ground, cliff packages, broken by 20-80 m noise; gullies keep their fill
      const n1 = mx_noise_float(P3.mul(0.045)), n2 = mx_noise_float(P3.mul(0.013).add(3.3));
      const rockRaw = smoothstep(0.38, 0.85, slope).mul(1.1).add(cvx.mul(0.45).mul(smoothstep(0.15, 0.4, slope)))
        .add(cliff.mul(smoothstep(0.28, 0.55, slope)).mul(0.45).mul(pkgVis.mul(0.6).add(0.4))).add(n1.mul(0.25)).add(n2.mul(0.2)).sub(gully.mul(0.6)).sub(0.12);
      const rock = smoothstep(0.35, 0.65, rockRaw).mul(hillOn);
      // scree (C): concave middle slopes below the rock and the gully beds; soil and herbs on the rest
      const n3 = mx_noise_float(P3.mul(0.07).add(7.1));
      const scree = clamp(smoothstep(0.22, 0.5, slope).mul(float(0.45).sub(cvx.mul(0.6)).add(n3.mul(0.35))).add(gully.mul(0.5)), 0, 1).mul(float(1).sub(rock)).mul(hillOn);
      const bedTone = float(1).add(unitN(pcgN(bedI.add(16384).toUint())).mul(2).sub(1).mul(0.08).mul(bedVis));
      const weather = smoothstep(-0.3, 0.5, mx_noise_float(P3.mul(0.11).add(1.7)).add(n1.mul(0.4)));
      const recess = float(1).sub(smoothstep(0.0, 0.2, fb)).mul(bedVis).mul(cliff.mul(0.6).add(0.4)); // the shadowed foot of a ledge
      const rockAlb = mix(linA(HILL.rock), linA(HILL.rockDark), weather.mul(0.7)).mul(bedTone).mul(float(1).sub(recess.mul(0.35))).mul(float(1).add(pkgVis.mul(hp.sub(0.5)).mul(0.12)));
      const screeAlb = linA(HILL.scree).mul(float(1).add(mx_noise_float(P3.mul(1.7)).mul(0.1).mul(near)));
      const steepSoil = smoothstep(0.25, 0.6, slope).mul(hillOn).mul(0.55); // herbs thin out on steep colluvium
      alb = mix(alb, mix(linA(HILL.slopeSoil), soil, 0.3), steepSoil);
      alb = mix(alb, screeAlb, scree.mul(0.8));
      alb = mix(alb, rockAlb, rock);
      alb = alb.mul(float(1).sub(gully.mul(0.12).mul(hillOn))).mul(float(1).add(cvx.mul(0.05).mul(hillOn))); // gullies hold shade and moisture
      // relief below the DEM (bump only; the heights are never moved): ledges, outcrop masses, the gullies' cut (C)
      const fadeFine = float(1).sub(smoothstep(0.5, 2.0, fw)), fadeMid = float(1).sub(smoothstep(4.0, 16.0, fw));
      const ledge = fb.mul(bedT).mul(0.45).mul(bedVis).mul(rock);
      const masses = mx_noise_float(P3.mul(0.08)).mul(2.0).mul(fadeMid).add(mx_noise_float(P3.mul(0.4).add(2.2)).mul(0.5).mul(fadeFine)).mul(rock);
      const cut = gully.mul(1.4).mul(hillOn).negate();

      // --- woodland canopy (oak and pistachio-almond; woodland rule, thinned near the capital): crowns on a 10 m jittered grid
      const zn = textureLoad(zoneTex, ivec2(int(clamp(floor(p.x.add(H).div(C)), 0, N - 1)), int(clamp(floor(p.y.add(H).div(C)), 0, N - 1))));
      const cover = zn.w.mul(0.5);
      const tq = p.div(10), tcl = floor(tq), dotW = float(0).toVar();
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const c = tcl.add(vec2(i, j)), a = cellUN(c.x), b = cellUN(c.y);
        const s = c.add(0.2).add(vec2(unitN(hash2N(a, b, SALT.tx)), unitN(hash2N(a, b, SALT.tz))).mul(0.6)).mul(10);
        // ~cover of area under crowns (crowns ~ 0.45 of a cell); a tree inside the tree layers' ring is not painted
        const present = step(unitN(hash2N(a, b, SALT.tree)), cover.mul(2.2)).mul(step(this.treeR, length(s.sub(this.paintC.xz))));
        const r = float(2.5).add(unitN(hash2N(a, b, SALT.tsize)).mul(2.0));
        const d = length(p.sub(s));
        dotW.assign(max(dotW, float(1).sub(smoothstep(r.mul(0.7), r, d)).mul(present)));
      }
      const leaf = oak.w;
      const canopy = mix(lin(0.30, 0.27, 0.23), oak.xyz.mul(0.55), leaf);
      const outside = step(this.treeR, length(p.sub(this.paintC.xz))); // the mean-cover (far pixel) path, by pixel
      const dotAmt = mix(cover.mul(0.9).mul(outside), dotW, near).mul(mix(float(0.25), float(0.85), leaf)).mul(float(1).sub(rock.mul(0.8)));
      alb = mix(alb, canopy, dotAmt);
      // --- shrubs on the slopes (pistachio-almond scrub and Artemisia steppe, B pollen, SAEIDI2021; C placement): 5 m
      // cells, crowns 0.6-1.6 m; more in the gullies and on north-facing slopes (world z = -north: facing north is nw.z < 0)
      const north = smoothstep(0.05, 0.4, nw.z.negate());
      const shrubCover = float(HILL.shrubCover.slope).add(gully.mul(HILL.shrubCover.gully)).add(north.mul(HILL.shrubCover.north))
        .mul(smoothstep(0.08, 0.2, slope)).mul(float(1).sub(rock.mul(0.85))).mul(float(1).sub(M)).mul(float(1).sub(trample));
      const sq = p.div(HILL.shrubCell), scl = floor(sq), dotS = float(0).toVar();
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const c = scl.add(vec2(i, j)), a = cellUN(c.x), b = cellUN(c.y);
        const s = c.add(0.2).add(vec2(unitN(hash2N(a, b, 61)), unitN(hash2N(a, b, 62))).mul(0.6)).mul(HILL.shrubCell);
        const r = float(0.6).add(unitN(hash2N(a, b, 63)).mul(1.0));
        // present with probability cover / (mean crown area / cell area): crowns cover ~15 % of a cell on average
        const present = step(unitN(hash2N(a, b, 64)), shrubCover.div(0.15));
        dotS.assign(max(dotS, float(1).sub(smoothstep(r.mul(0.6), r, length(p.sub(s)))).mul(present)));
      }
      const shrubNear = float(1).sub(smoothstep(0.5, 1.5, fw));
      const shrubCol = mix(lin(0.34, 0.31, 0.27), lin(0.21, 0.25, 0.14), leaf.mul(0.6).add(0.4)); // twiggy grey-brown to dark leaf
      const shrubAmt = mix(shrubCover.mul(0.9), dotS, shrubNear).mul(0.9);
      alb = mix(alb, shrubCol, shrubAmt);
      const hOut = bund.mul(0.12).add(furrow.mul(tilled).mul(0.05)).sub(pathCov.mul(0.03)).add(ledge).add(masses).add(cut).add(dotS.mul(shrubNear).mul(0.5));
      return vec4(alb, hOut);
    });
    const out = field(L.alb);
    return { alb: out.xyz, rough: L.rough, height: L.height ? L.height.add(out.w) : out.w };
  }
}

/** JS mirror of the woodland crowns drawn by the shader (for the 3D trees near the camera) */
export { pcg };
void fract; void max; void abs; void vec3; void clamp; void dot;
