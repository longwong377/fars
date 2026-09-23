// Volumetric clouds (brief §5.3; Phase 3). A dome drawn after the sky, stars and moon (so clouds hide them) raymarches a
// cloud slab between CLOUD_BASE and CLOUD_TOP above the observer: fractal noise shaped by a height profile (flat bases,
// rounded tops), thresholded by the weather's cloud cover and drifted by the wind. Density comes from precomputed tileable
// Perlin–Worley/Worley noise volumes (src/sky/cloudNoise.ts; session 3, D-047) rather than per-sample fractal noise. Lighting: Beer–Lambert transmittance
// toward the sun (a few light steps), a two-lobe Henyey–Greenstein phase (forward silver lining + back scatter), a
// powder term for dark edges, and skylight from above. Distant cloud fades into the horizon haze. All shape and optical
// values are C (no cloud climatology for Fars was sourced; spring cumulus bases ~1.5–3 km above ground are typical of
// semi-arid highlands — NOT SEEN, verify). Quality sets the step counts; `test` quality draws no clouds.
import * as THREE from 'three/webgpu';
import { Fn, uniform, positionWorld, cameraPosition, normalize, vec3, vec4, float, Loop, int, max, min, exp, mix, smoothstep, dot, pow, clamp, If, Break, texture, screenCoordinate, fract, floor, mod, sin, vec2 } from 'three/tsl';
import { cloudNoiseVolume, cloudNoiseAtlas } from './cloudNoise';

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
const STEPS: Record<string, [number, number]> = { test: [0, 0], low: [14, 2], medium: [22, 3], high: [32, 4], ultra: [48, 5] };

export class VolumetricClouds {
  readonly mesh: THREE.Mesh;
  readonly coverage = uniform(0.3);
  readonly sunDir = uniform(new THREE.Vector3(0, 1, 0));
  readonly sunColor = uniform(new THREE.Color(1, 1, 1));   // sun radiance scale (× light intensity)
  readonly ambient = uniform(new THREE.Color(0.5, 0.6, 0.8)); // skylight on the clouds
  readonly haze = uniform(new THREE.Color(0.7, 0.75, 0.8));   // horizon haze colour
  readonly time = uniform(0);
  readonly wind = uniform(new THREE.Vector2(3, 0));          // m/s, world x/z
  /** the approaching rain cell (world x, world z, radius m, strength 0..1; strength 0 = none): the cloud above it is
   *  thicker and taller, so the curtain hangs from a darker base (the light march does the darkening). C (session 3). */
  readonly cell = uniform(new THREE.Vector4(0, 0, 1, 0));
  constructor(radius: number, quality: string) {
    const [N, NL] = STEPS[quality] ?? STEPS.high;
    // drawn like the sky, stars and moon: in the opaque pass by render order (−7, after them), no depth test or write, so
    // every piece of geometry drawn later covers it. (As a transparent material with depthTest off it was drawn AFTER the
    // geometry and laid the cloud deck over walls and mountains above the horizon.) Custom blending keeps the alpha, which
    // a non-transparent NormalBlending material would force to 1.
    const m = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, transparent: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation, depthTest: false, depthWrite: false, fog: false });
    const cov = this.coverage, sd = this.sunDir, sc = this.sunColor, amb = this.ambient, hz = this.haze, tm = this.time, wd = this.wind, cell = this.cell;
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
    const hg = (c: any, g: number) => float(1 - g * g).div(pow(float(1 + g * g).sub(c.mul(2 * g)), 1.5)).mul(1 / (4 * Math.PI));
    m.colorNode = Fn(() => {
      const dir = normalize(positionWorld.sub(cameraPosition)).toVar();
      const out = vec4(0, 0, 0, 0).toVar();
      If(dir.y.greaterThan(0.015).and(float(N).greaterThan(0)), () => {
        const t0 = float(CLOUD_BASE).div(dir.y), t1 = min(float(CLOUD_TOP).div(dir.y), t0.add(22000));
        const dt = t1.sub(t0).div(N).toVar();
        // per-pixel start jitter (hash of the screen position): trades banding for noise that TRAA averages away
        const jit = fract(sin(dot(screenCoordinate.xy, vec2(12.9898, 78.233))).mul(43758.5453));
        const T = float(1).toVar(), col = vec3(0).toVar();
        const cosT = dot(dir, sd), phase = mix(hg(cosT, -0.25), hg(cosT, 0.65), 0.6);
        Loop({ start: int(0), end: int(N), type: 'int', condition: '<', name: 'ci' } as any, ({ ci }: any) => {
          const t = t0.add(dt.mul(float(ci).add(jit)));
          const p = dir.mul(t);
          const d = density(p);
          If(d.greaterThan(0.00001), () => {
            // light march toward the sun
            const od = float(0).toVar();
            Loop({ start: int(0), end: int(NL), type: 'int', condition: '<', name: 'lj' } as any, ({ lj }: any) => { od.addAssign(density(p.add(sd.mul(float(lj).add(0.5).mul(180))))); });
            const lightT = exp(od.mul(-180)), powder = float(1).sub(exp(d.mul(-2 * 180)));
            const hFrac = clamp(p.y.sub(CLOUD_BASE).div(CLOUD_TOP - CLOUD_BASE), 0, 1);
            const lum = sc.mul(lightT.mul(phase).mul(powder.mul(0.8).add(0.2)).mul(6)).add(amb.mul(hFrac.mul(0.6).add(0.4)).mul(0.9));
            const a = exp(d.mul(dt).negate());
            col.addAssign(T.mul(lum).mul(a.oneMinus()));
            T.mulAssign(a);
          });
          If(T.lessThan(0.02), () => { Break(); });
        });
        // aerial perspective: distant cloud fades into the horizon haze
        const fade = exp(t0.mul(-1 / 26000));
        out.assign(vec4(mix(hz, col.div(max(float(1).sub(T), 0.001)), fade), float(1).sub(T).mul(fade)));
      });
      return out;
    })();
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), m);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = -7; this.mesh.visible = N > 0;
    this.mesh.userData = { tier: 'C', src: 'RECON', note: 'volumetric cumulus layer (raymarched); shapes and optics C; cover from the weather generator (B climate normals)' };
  }
}
