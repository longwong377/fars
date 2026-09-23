// Volumetric clouds (brief §5.3; Phase 3). A dome drawn after the sky, stars and moon (so clouds hide them) raymarches a
// cloud slab between CLOUD_BASE and CLOUD_TOP above the observer: fractal noise shaped by a height profile (flat bases,
// rounded tops), thresholded by the weather's cloud cover and drifted by the wind. Lighting: Beer–Lambert transmittance
// toward the sun (a few light steps), a two-lobe Henyey–Greenstein phase (forward silver lining + back scatter), a
// powder term for dark edges, and skylight from above. Distant cloud fades into the horizon haze. All shape and optical
// values are C (no cloud climatology for Fars was sourced; spring cumulus bases ~1.5–3 km above ground are typical of
// semi-arid highlands — NOT SEEN, verify). Quality sets the step counts; `test` quality draws no clouds.
import * as THREE from 'three/webgpu';
import { Fn, uniform, positionWorld, cameraPosition, normalize, vec3, vec4, float, Loop, int, max, min, exp, mix, smoothstep, mx_fractal_noise_float, dot, pow, clamp, If, Break } from 'three/tsl';

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
  constructor(radius: number, quality: string) {
    const [N, NL] = STEPS[quality] ?? STEPS.high;
    // drawn like the sky, stars and moon: in the opaque pass by render order (−7, after them), no depth test or write, so
    // every piece of geometry drawn later covers it. (As a transparent material with depthTest off it was drawn AFTER the
    // geometry and laid the cloud deck over walls and mountains above the horizon.) Custom blending keeps the alpha, which
    // a non-transparent NormalBlending material would force to 1.
    const m = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, transparent: false, blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, blendEquation: THREE.AddEquation, depthTest: false, depthWrite: false, fog: false });
    const cov = this.coverage, sd = this.sunDir, sc = this.sunColor, amb = this.ambient, hz = this.haze, tm = this.time, wd = this.wind;
    /** density at a point (metres, observer-relative, y up) */
    const density = Fn(([p]: [any]) => {
      const h = clamp(p.y.sub(CLOUD_BASE).div(CLOUD_TOP - CLOUD_BASE), 0, 1);
      const shape = smoothstep(0.0, 0.12, h).mul(float(1).sub(smoothstep(0.45, 1.0, h))); // flat base, rounded top
      const q = vec3(p.x.add(wd.x.mul(tm)), p.y, p.z.add(wd.y.mul(tm))).mul(1 / 2600);
      const n = mx_fractal_noise_float(q, int(4), float(2.0), float(0.5)).mul(0.5).add(0.5);
      const detail = mx_fractal_noise_float(q.mul(6.5), int(2), float(2.0), float(0.5)).mul(0.5).add(0.5);
      const thr = float(1).sub(cov.mul(0.72)).sub(0.08); // more cover → lower threshold
      return max(n.mul(shape).sub(thr.mul(shape.oneMinus().mul(0.4).add(0.6))).sub(detail.mul(0.08)), 0).mul(0.012);
    });
    const hg = (c: any, g: number) => float(1 - g * g).div(pow(float(1 + g * g).sub(c.mul(2 * g)), 1.5)).mul(1 / (4 * Math.PI));
    m.colorNode = Fn(() => {
      const dir = normalize(positionWorld.sub(cameraPosition)).toVar();
      const out = vec4(0, 0, 0, 0).toVar();
      If(dir.y.greaterThan(0.015).and(float(N).greaterThan(0)), () => {
        const t0 = float(CLOUD_BASE).div(dir.y), t1 = min(float(CLOUD_TOP).div(dir.y), t0.add(22000));
        const dt = t1.sub(t0).div(N).toVar();
        const T = float(1).toVar(), col = vec3(0).toVar();
        const cosT = dot(dir, sd), phase = mix(hg(cosT, -0.25), hg(cosT, 0.65), 0.6);
        Loop({ start: int(0), end: int(N), type: 'int', condition: '<', name: 'ci' } as any, ({ ci }: any) => {
          const t = t0.add(dt.mul(float(ci).add(0.5)));
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
