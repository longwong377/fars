// Volumetric clouds (brief §5.3; Phase 3). A dome drawn after the sky, stars and moon (so clouds hide them) raymarches a
// cloud slab between CLOUD_BASE and CLOUD_TOP above the observer: fractal noise shaped by a height profile (flat bases,
// rounded tops), thresholded by the weather's cloud cover and drifted by the wind. Density comes from precomputed tileable
// Perlin–Worley/Worley noise volumes (src/sky/cloudNoise.ts; session 3, D-047) rather than per-sample fractal noise. Lighting
// (session 4, D-156; cloudLight.ts): multiple-scattering octaves toward the sun (a light march with growing steps), a
// two-lobe Henyey–Greenstein phase per octave, calibrated to the albedo of thick cloud, and the sky's and the sunlit
// ground's radiance as ambient; distant cloud sinks into the terrain's own air (aerial.ts). Shapes and optics are C (no cloud climatology for Fars was sourced; spring cumulus bases ~1.5–3 km above ground are typical of
// semi-arid highlands — NOT SEEN, verify). Quality sets the step counts; `test` quality draws no clouds.
import * as THREE from 'three/webgpu';
import { Fn, uniform, positionWorld, cameraPosition, normalize, vec3, vec4, float, Loop, int, max, min, exp, mix, smoothstep, dot, pow, clamp, If, Break, texture, screenCoordinate, fract, floor, mod, sin, vec2, step } from 'three/tsl';
import { cloudNoiseVolume, cloudNoiseAtlas } from './cloudNoise';
import { CLOUD_MARCH, EMPTY_STRIDE, K_MS, K_D, G_DROPLET, OCTAVES, OCT_A, OCT_B, OCT_C, PHASE_BACK, PHASE_FWD, PHASE_MIX, lightSamples } from './cloudLight';
import type { Air } from './aerial';

/** tileable noise volume shared by all cloud layers, flattened into a 2-D atlas (built once, ~0.5 s; only at qualities
 *  that draw clouds) */
const NOISE_N = 64, ATLAS_ROW = 8;
let NOISE: { tex: THREE.DataTexture; tile: number; width: number } | null = null;
function noiseAtlas() {
  if (NOISE) return NOISE;
  const a = cloudNoiseAtlas(cloudNoiseVolume(NOISE_N), NOISE_N, ATLAS_ROW);
  const t = new THREE.DataTexture(a.data, a.width, a.width, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.minFilter = t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; t.flipY = false; t.needsUpdate = true;
  return (NOISE = { tex: t, tile: a.tile, width: a.width });
}
/** horizontal scales (m per texture tile, C): base shapes, the large-scale weather field, erosion detail */
const BASE_TILE = 7000, WEATHER_TILE = 46000, DETAIL_TILE = 1400;

export const CLOUD_BASE = 1500, CLOUD_TOP = 3600; // m above the observer (C)
/** the approaching rain cell (world x, world z, radius m, strength 0..1; 0 = none), one uniform shared by the cloud layer
 *  (thicker cloud above it), the sun (the cell's cloud shades it: cellShadowNode) and the surface materials (the ground
 *  under it is wet: materials.ts). Set each frame from RainShafts.cellWorld (world.ts). D-219 */
export const RAIN_CELL = uniform(new THREE.Vector4(0, 0, 1, 0));
/** TSL: the direct sun's transmittance past the rain cell's deep cloud at world point `p` (C, D-219): the sun ray from p
 *  meets the cloud base (CLOUD_BASE above the court) at q; within ~R of the cell's centre the cloud (τ ≫ 10) blocks the beam,
 *  softly over its ragged edge. So the plain under and downsun of the cell lies in its shadow: the darkening front */
/** CPU mirror of cellShadowNode (tests): p = world [x, y, z], sun = unit vector toward the sun, cell = [x, z, R, strength] */
export function cellShadowAt(p: [number, number, number], sun: [number, number, number], cell: [number, number, number, number]): number {
  const s = Math.max(CLOUD_BASE - p[1], 0) / Math.max(sun[1], 0.05), qx = p[0] + sun[0] * s, qz = p[2] + sun[2] * s, d = Math.hypot(qx - cell[0], qz - cell[1]);
  const t = Math.min(1, Math.max(0, (d - 0.55 * cell[2]) / (0.7 * cell[2]))), sm = t * t * (3 - 2 * t);
  return 1 - (1 - sm) * cell[3] * 0.9;
}
export function cellShadowNode(p: any, sunDir: any): any {
  const s = max(float(CLOUD_BASE).sub(p.y), 0).div(max(sunDir.y, 0.05));
  const q = vec2(p.x.add(sunDir.x.mul(s)), p.z.add(sunDir.z.mul(s)));
  const d = q.sub(vec2(RAIN_CELL.x, RAIN_CELL.y)).length();
  return float(1).sub(float(1).sub(smoothstep(RAIN_CELL.z.mul(0.55), RAIN_CELL.z.mul(1.25), d)).mul(RAIN_CELL.w).mul(0.9));
}

export class VolumetricClouds {
  readonly mesh: THREE.Mesh;
  readonly coverage = uniform(0.3);
  readonly sunDir = uniform(new THREE.Vector3(0, 1, 0));
  /** sunlight at the cloud base and at the top (× light intensity): at low sun they differ, since the sun sets later
   *  for the higher cloud and its light is reddened by a different path (D-116) */
  readonly sunColor = uniform(new THREE.Color(1, 1, 1));
  readonly sunColorTop = uniform(new THREE.Color(1, 1, 1));
  /** the mean radiance of the sky above and of the sunlit ground below (the hemisphere light's colours × intensity / π;
   *  D-153): the clouds' ambient in-scatter (cloudLight.ts) */
  readonly ambient = uniform(new THREE.Color(0.5, 0.6, 0.8)); readonly ambientGround = uniform(new THREE.Color(0.3, 0.25, 0.2));
  readonly time = uniform(0);
  readonly wind = uniform(new THREE.Vector2(3, 0));          // m/s, world x/z
  /** the approaching rain cell (world x, world z, radius m, strength 0..1; strength 0 = none): the cloud above it is
   *  thicker and taller, so the curtain hangs from a darker base (the light march does the darkening). C (session 3). */
  readonly cell = RAIN_CELL;
  /** `air`: the medium between the eye and the cloud (aerial.ts, D-156): the terrain's aerial perspective, so distant cloud
   *  sinks into the same haze as the ranges below it (D-064: one air) */
  constructor(radius: number, quality: string, readonly air: Air) {
    const [N, DT, NL] = CLOUD_MARCH[quality] ?? CLOUD_MARCH.high, LS = lightSamples(NL);
    // drawn like the sky, stars and moon: in the opaque pass by render order (−7, after them), no depth test or write, so
    // every piece of geometry drawn later covers it. (As a transparent material with depthTest off it was drawn AFTER the
    // geometry and laid the cloud deck over walls and mountains above the horizon.) Custom blending keeps the alpha, which
    // a non-transparent NormalBlending material would force to 1.
    const m = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, transparent: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation, depthTest: false, depthWrite: false, fog: false });
    const cov = this.coverage, sd = this.sunDir, sc = this.sunColor, scTop = this.sunColorTop, amb = this.ambient as any, ambG = this.ambientGround as any, tm = this.time, wd = this.wind, cell = this.cell;
    const atlas = N > 0 ? noiseAtlas() : null;
    /** trilinear sample of the tileable volume at uvw (any real numbers; period 1): bilinear inside two adjacent slice
     *  tiles of the atlas, then a linear blend between them */
    const sample3 = (uvw: any) => {
      const n = NOISE_N, T = atlas!.tile, W = atlas!.width;
      const z = fract(uvw.z).mul(n).sub(0.5), z0 = mod(floor(z).add(n), n), z1 = mod(z0.add(1), n), fz = z.sub(floor(z));
      const inTile = vec2(fract(uvw.x), fract(uvw.y)).mul(n).add(1); // texel coordinates inside a tile (after the 1-texel border)
      const at = (zz: any) => { const tx = mod(zz, ATLAS_ROW), ty = floor(zz.div(ATLAS_ROW)); return texture(atlas!.tex, vec2(tx.mul(T), ty.mul(T)).add(inTile).div(W)); };
      return mix(at(z0), at(z1), fz);
    };
    const remap = (v: any, a: any, b: any, c: any, d: any) => v.sub(a).div(max(b.sub(a), 1e-4)).mul(d.sub(c)).add(c);
    /** density (per metre) at an observer-relative point p (metres, y up): Perlin–Worley base shapes from a 3-D noise
     *  volume in WORLD coordinates (so the clouds stay put while the player walks), a large-scale weather field that
     *  varies the cover, a height profile (flat base, rounded tops that rise with the cell), coverage remap, and Worley
     *  erosion that is wispy low and billowy high (Schneider 2015) */
    const density = Fn(([p]: [any]) => {
      const h = clamp(p.y.sub(CLOUD_BASE).div(CLOUD_TOP - CLOUD_BASE), 0, 1);
      const pw = vec3(p.x.add(cameraPosition.x).add(wd.x.mul(tm)), p.y, p.z.add(cameraPosition.z).add(wd.y.mul(tm)));
      const lo = sample3(pw.mul(1 / BASE_TILE)).r;
      const weather = sample3(vec3(pw.x.mul(1 / WEATHER_TILE), 0.37, pw.z.mul(1 / WEATHER_TILE))).r;
      // over the rain cell (world position, not the wind-drifted noise frame): more cover and taller towers
      const dcell = vec2(p.x.add(cameraPosition.x).sub(cell.x), p.z.add(cameraPosition.z).sub(cell.y)).length();
      const boost = float(1).sub(smoothstep(cell.z.mul(0.5), cell.z.mul(1.6), dcell)).mul(cell.w); // edges ascending: a reversed smoothstep is undefined in GLSL/SPIR-V (NaN on SwiftShader)
      const top = float(0.35).add(lo.mul(0.6)).add(boost.mul(0.35)); // taller towers where the base field is strong
      const shape = smoothstep(0.0, 0.06, h).mul(float(1).sub(smoothstep(top.mul(0.7), top, h)));
      const c = clamp(cov.mul(weather.mul(0.8).add(0.6)).add(boost.mul(0.6)), 0, 1);
      const base = clamp(remap(lo.mul(shape), float(1).sub(c), float(1), float(0), float(1)), 0, 1).mul(c);
      const hi = sample3(pw.mul(1 / DETAIL_TILE)); const hf = hi.g.mul(0.625).add(hi.b.mul(0.25)).add(hi.a.mul(0.125));
      const erode = mix(hf, float(1).sub(hf), clamp(h.mul(4), 0, 1)).mul(0.35);
      return clamp(remap(base, erode, float(1), float(0), float(1)), 0, 1).mul(0.02);
    });
    const hg = (c: any, g: number) => float(1 - g * g).div(pow(float(1 + g * g).sub(c.mul(2 * g)), 1.5)).mul(1 / (4 * Math.PI)); // base > 0 for |g| < 1
    m.colorNode = Fn(() => {
      const dir = normalize(positionWorld.sub(cameraPosition)).toVar();
      const out = vec4(0, 0, 0, 0).toVar();
      If(dir.y.greaterThan(0.015).and(float(N).greaterThan(0)), () => {
        const t0 = float(CLOUD_BASE).div(dir.y), t1 = min(float(CLOUD_TOP).div(dir.y), t0.add(22000));
        // steps of DT from the cloud base (EMPTY_STRIDE × DT through empty air), at most N (D-156; was N steps over the
        // whole span: up to 690 m near the horizon); a per-pixel start jitter (hash of the screen position) trades
        // banding for noise that TRAA averages away
        const jit = fract(sin(dot(screenCoordinate.xy, vec2(12.9898, 78.233))).mul(43758.5453));
        const t = t0.add(jit.mul(DT)).toVar(), empty = float(0).toVar();
        const T = float(1).toVar(), col = vec3(0).toVar();
        // multiple-scattering octaves (Wrenninge et al. 2013; cloudLight.ts): phase asymmetry × c^i per octave
        const cosT = dot(dir, sd), ph = Array.from({ length: OCTAVES }, (_, i) => { const k = Math.pow(OCT_C, i); return mix(hg(cosT, PHASE_BACK * k), hg(cosT, PHASE_FWD * k), PHASE_MIX); });
        Loop({ start: int(0), end: int(N), type: 'int', condition: '<', name: 'ci' } as any, () => {
          If(t.greaterThan(t1), () => { Break(); });
          const p = dir.mul(t);
          const d = density(p);
          If(d.greaterThan(0.00001), () => {
            // optical depth toward the sun: steps growing × 2.5 out to 800 m (cloudLight.ts lightSamples)
            let tau: any = float(0);
            for (let j = 0; j < NL; j++) tau = tau.add(density(p.add(sd.mul(LS.at[j]))).mul(LS.w[j]));
            let ms: any = float(0);
            for (let i = 0; i < OCTAVES; i++) ms = ms.add(ph[i].mul(Math.pow(OCT_B, i)).mul(exp(tau.mul(-Math.pow(OCT_A, i)))));
            const hFrac = clamp(p.y.sub(CLOUD_BASE).div(CLOUD_TOP - CLOUD_BASE), 0, 1);
            const sunH = mix(sc, scTop as any, hFrac);
            // ambient: half the sky's mean radiance at the top of the slab, half the sunlit ground's at its base
            // + the diffusion term: conservative two-stream transmittance to this depth (Bohren 1987), isotropic
            const diff = float(2).div(tau.mul(1 - G_DROPLET).add(2)).mul(1 / (4 * Math.PI));
            const lum = sunH.mul(ms.mul(K_MS).add(diff.mul(K_D))).add(mix(ambG, amb, hFrac).mul(0.5));
            const a = exp(d.mul(DT).negate());
            col.addAssign(T.mul(lum).mul(a.oneMinus()));
            T.mulAssign(a); empty.assign(0);
          }).Else(() => { empty.addAssign(1); });
          If(T.lessThan(0.02), () => { Break(); });
          t.addAssign(mix(float(DT), float(DT * EMPTY_STRIDE), step(1.5, empty)));
        });
        // aerial perspective (D-156; D-064: one air): the air between the eye and the cloud base attenuates the cloud's light
        // (T_air per channel) and adds its own in-scatter in front of it (J (1 − T_air), J in the ray's direction from the
        // sun); the dome behind already carries the in-scatter of the whole ray, so with alpha = the cloud's opacity α:
        //   out = α (J (1 − T_air) + T_air · L_cloud / α) + (1 − α) · dome
        const tAir = exp(air.opticalDepthNode(cameraPosition, cameraPosition.add(dir.mul(t0))).negate());
        const alpha = float(1).sub(T);
        out.assign(vec4(air.jNode(dir).mul(vec3(1).sub(tAir)).add(tAir.mul(col.div(max(alpha, 0.001)))), alpha));
      });
      return out;
    })();
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), m);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -7; this.mesh.visible = N > 0;
    this.mesh.userData = { tier: 'C', src: 'RECON', note: 'volumetric cumulus layer (raymarched); shapes and optics C; cover from the weather generator (B climate normals)' };
  }
}
