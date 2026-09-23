// The plain's fields, crops, orchard floors and woodland drawn into the terrain material (Phase 7, D-038). Zero extra draw
// calls: the terrain chunks keep their geometry and get the earth material plus a `modify` layer (materials.ts) that,
// per pixel, finds the field plot (the same integer-hash Voronoi as fields.ts plotAt), reads the land use at the plot's
// seed from the zone texture, and colours the plot from the crop-state texture for today's date (+- the plot's own
// phenology offset). Far away, where a plot is a few pixels, it fades to the date's mean colour of the zone (bilinear
// zone weights), so the patchwork does not shimmer. No runtime select() (D-012): masks are arithmetic.
import * as THREE from 'three/webgpu';
import { Fn, uniform, positionWorld, cameraPosition, attribute, vec2, vec3, vec4, float, uint, int, ivec2, floor, fract, min, max, mix, step, smoothstep, length, fwidth, textureLoad, texture, abs, sin, cos, clamp, color, mx_noise_float } from 'three/tsl';
import { surfaceMaterial, type Layer } from '../../render/materials';
import { DISTRICT, SALT, STRIP, ZONE, ZoneMap, IRR_STEPS, RAINFED_BARLEY, VINE_SHARE, pcg } from './fields';
import { CROP_ROWS, YEAR, cropTable, cropState, PLOT_OFFSET_DAYS, foliage } from './seasonal';

// ---------------------------------------------------------------- TSL mirrors of fields.ts
const pcgN = (v: any) => { const s = v.mul(747796405).add(2891336453); const w = s.shiftRight(s.shiftRight(28).add(4)).bitXor(s).mul(277803737); return w.shiftRight(22).bitXor(w); };
/** hash2(ix, iy, salt) with a JS-constant salt (its pcg folded at build time) or a uint node salt */
const hash2N = (ix: any, iy: any, salt: number | any) => pcgN(ix.add(pcgN(iy.add(typeof salt === 'number' ? uint(pcg(salt)) : pcgN(salt)))));
const unitN = (h: any) => h.shiftRight(8).toFloat().mul(1 / 16777216);
const cellUN = (c: any) => c.add(32768).toUint(); // c is already floor()ed

export interface PlainGroundState { day: any; meanIrr: any; meanRain: any; meanOrch: any; oak: any }

export class PlainGround {
  readonly day = uniform(0); // day of year (0..364)
  readonly meanIrr = uniform(new THREE.Vector4()); readonly meanRain = uniform(new THREE.Vector4()); readonly meanOrch = uniform(new THREE.Vector4());
  readonly oakLeaf = uniform(new THREE.Vector4(0.2, 0.26, 0.12, 1)); // woodland canopy colour + leaf amount
  /** radius (m) within which the plain draws 3-D trees: the painted canopy dots fade out inside it (they drew a grey disc
   *  under every near tree, read as 'grey domes', session 3) */
  readonly treeR = uniform(60);
  readonly zoneTex: THREE.DataTexture; readonly cropTex: THREE.DataTexture;
  readonly material: THREE.MeshStandardNodeMaterial;
  constructor(readonly zones: ZoneMap) {
    this.zoneTex = new THREE.DataTexture(zones.data, zones.n, zones.n, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.zoneTex.magFilter = THREE.LinearFilter; this.zoneTex.minFilter = THREE.LinearFilter; this.zoneTex.generateMipmaps = false; this.zoneTex.needsUpdate = true;
    this.cropTex = new THREE.DataTexture(cropTable(), YEAR, CROP_ROWS.length, THREE.RGBAFormat, THREE.UnsignedByteType);
    this.cropTex.magFilter = THREE.NearestFilter; this.cropTex.minFilter = THREE.NearestFilter; this.cropTex.generateMipmaps = false; this.cropTex.needsUpdate = true;
    this.material = surfaceMaterial('earth', { vertexColors: true, variant: 'plain', modify: (L: Layer) => this.modify(L) });
    this.material.userData = { tier: 'C', src: 'RECON;SUMNER1986;IR-FOODAG;SAEIDI2021', note: 'plain surface: loam and seasonal herbs; fields (plots C, crop calendar B/C), orchard floors and woodland canopy from plain.json zones (C)' };
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
    this.meanRain.value.copy(mean([[0, RAINFED_BARLEY], [4, 1 - RAINFED_BARLEY]]));
    this.meanOrch.value.copy(mean([[5, 1 - VINE_SHARE], [6, VINE_SHARE]]));
    const f = foliage('oak', doy); this.oakLeaf.value.set(f.colour[0], f.colour[1], f.colour[2], f.leaf);
  }

  private modify(L: Layer): Layer {
    const zoneTex = this.zoneTex, cropTex = this.cropTex, day = this.day, meanIrr = this.meanIrr, meanRain = this.meanRain, meanOrch = this.meanOrch, oak = this.oakLeaf;
    const lin = (r: number, g: number, b: number) => color(new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace));
    const H = ZONE.half, C = ZONE.cell, N = ZONE.n;
    const field = Fn(([albIn]: any[]) => {
      const p = positionWorld.xz; // world x, z (z = -grid north)
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
      // --- land use at the plot seed (nearest zone texel) and at this pixel (bilinear, for the far fade)
      const tc = clamp(floor(seed.add(H).div(C)), 0, N - 1);
      const z = textureLoad(zoneTex, ivec2(int(tc.x), int(tc.y)));
      const wIrr = step(0.5, z.x), wRain = step(0.5, z.y).mul(float(1).sub(wIrr)), wOrch = step(0.5, z.z);
      const wI = wIrr.mul(float(1).sub(wOrch)), wR = wRain.mul(float(1).sub(wOrch));
      const hc = unitN(hash2N(ph, uint(7), SALT.crop)), ho = unitN(hash2N(ph, uint(9), SALT.offset));
      const kIrr = step(IRR_STEPS[0], hc).add(step(IRR_STEPS[1], hc)).add(step(IRR_STEPS[2], hc)).add(step(IRR_STEPS[3], hc));
      const kRain = step(RAINFED_BARLEY, hc).mul(4), kOrch = float(5).add(step(1 - VINE_SHARE, hc));
      const k = wI.mul(kIrr).add(wR.mul(kRain)).add(wOrch.mul(kOrch)).add(float(1).sub(wI).sub(wR).sub(wOrch).max(0).mul(7));
      const off = floor(ho.mul(2 * PLOT_OFFSET_DAYS + 1)).sub(PLOT_OFFSET_DAYS);
      const col = day.add(off).add(YEAR).mod(YEAR);
      const st = textureLoad(cropTex, ivec2(int(col), int(k))); // height/1.5, green, straw, tilled
      const mask = wI.add(wR).add(wOrch);
      // far: the zone's mean state today, weighted by the bilinear zone at this pixel
      const zb = texture(zoneTex, p.add(H).div(2 * H));
      const bI = zb.x.mul(float(1).sub(zb.z)), bR = zb.y.mul(float(1).sub(zb.x)).mul(float(1).sub(zb.z)), bO = zb.z;
      const bSum = bI.add(bR).add(bO).max(1e-4);
      const stFar = meanIrr.mul(bI).add(meanRain.mul(bR)).add(meanOrch.mul(bO)).div(bSum);
      const fw = length(fwidth(p)); // metres per pixel
      const near = float(1).sub(smoothstep(3.0, 10.0, fw));
      const S = mix(stFar, st, near), M = mix(bI.add(bR).add(bO).min(1), mask, near);
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
      const tint = unitN(hash2N(ph, uint(5), 43)).mul(0.24).add(0.88).mul(near).add(float(1).sub(near));
      let plotAlb: any = soilT.mul(bare).add(green.mul(gCov).mul(speck)).add(straw.mul(sCov).mul(speck)).mul(tint);
      // bunds on plot edges (0.35 m) and a track along district edges (2.5 m wide), near only, in fields
      const bund = float(1).sub(smoothstep(0.3, 0.6, edge)).mul(near).mul(mask); // earth bunds between plots, ~1 m wide (C)
      const track = float(1).sub(smoothstep(1.0, 1.6, dEdge)).mul(near).mul(mask);
      plotAlb = mix(plotAlb, mix(soil.mul(1.05), lin(0.36, 0.40, 0.2), 0.45), bund.mul(0.85));
      plotAlb = mix(plotAlb, soil.mul(1.15).add(vec3(0.02, 0.018, 0.012)), track.mul(0.9));
      let alb: any = mix(albIn, plotAlb, M);
      // --- woodland canopy (oak and pistachio-almond; woodland rule, thinned near the capital): crowns on a 10 m jittered grid
      const zn = textureLoad(zoneTex, ivec2(int(clamp(floor(p.x.add(H).div(C)), 0, N - 1)), int(clamp(floor(p.y.add(H).div(C)), 0, N - 1))));
      const cover = zn.w.mul(0.5);
      const tq = p.div(10), tcl = floor(tq), dot = float(0).toVar();
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const c = tcl.add(vec2(i, j)), a = cellUN(c.x), b = cellUN(c.y);
        const present = step(unitN(hash2N(a, b, SALT.tree)), cover.mul(2.2)); // ~cover of area under crowns (crowns ~ 0.45 of a cell)
        const s = c.add(0.2).add(vec2(unitN(hash2N(a, b, SALT.tx)), unitN(hash2N(a, b, SALT.tz))).mul(0.6)).mul(10);
        const r = float(2.5).add(unitN(hash2N(a, b, SALT.tsize)).mul(2.0));
        const d = length(p.sub(s));
        dot.assign(max(dot, float(1).sub(smoothstep(r.mul(0.7), r, d)).mul(present)));
      }
      const leaf = oak.w;
      const canopy = mix(lin(0.30, 0.27, 0.23), oak.xyz.mul(0.55), leaf);
      const camD = length(positionWorld.xz.sub(cameraPosition.xz));
      const dotAmt = mix(cover.mul(0.9), dot, near).mul(mix(float(0.25), float(0.85), leaf)).mul(smoothstep(this.treeR.mul(0.8), this.treeR, camD));
      alb = mix(alb, canopy, dotAmt);
      const hOut = bund.mul(0.12).add(furrow.mul(tilled).mul(0.05)).add(dot.mul(near).mul(0.0));
      return vec4(alb, hOut);
    });
    const out = field(L.alb);
    return { alb: out.xyz, rough: L.rough, height: L.height ? L.height.add(out.w) : out.w };
  }
}

/** JS mirror of the woodland crowns drawn by the shader (for the 3D trees near the camera) */
export { pcg };
void fract; void max; void abs; void vec3; void clamp;
