// Precipitation and lightning (brief §5.3): rain streaks / snowflakes in a volume around the camera, advected by the
// weather wind; lightning = sky flash + brief directional light, rate from the climate's thunder statistics; the
// out-of-world "lightning-flash warning" setting caps the flash brightness.
//
// D-219 (rubric pass 2: no streaks, sparse flakes, "two lens-sized diamond sprites"):
//  • light: streaks and flakes are lit by the sky, not drawn in a fixed colour: a streak (a falling drop smeared over the
//    exposure) shows the mean radiance round it × 0.8 (C: water refracts the surroundings, a little light is lost); a flake
//    is a white scatterer, ρ 0.85 (C), under the skylight (sky and ground halves) plus a quarter of the sun (a sphere's mean
//    cosine). The radiances come from the SkySystem's hemisphere light, the convention the clouds use (irradiance / π).
//  • size on screen: a streak 12 mm wide or a flake 12 mm across is under a pixel beyond ~6 m at 540 lines; each is widened
//    to at least one pixel with its opacity scaled down by the same factor (the light it adds is conserved; the far flames'
//    rule, D-216). Nothing is drawn within 0.5 m of the lens (a flake there covered a tenth of the frame), faded in by 1.5 m.
//  • density: the volume shrinks to where streaks and flakes resolve (rain 10 m round the eye, 10 m high; snow 9 m, 8 m high),
//    and snow draws twice the rain's count: 4.5× and ~14× the old number per cubic metre. Flakes are round (a soft disc),
//    not diamonds (|x|+|y| falloff).
// Counts, sizes and ρ are C.
import * as THREE from 'three/webgpu';
import { colourOnly } from '../render/fx';
import { roofedNode } from '../render/probes/roofs';
import { attribute, vec4, float, uv, smoothstep, uniform, length, vec2, clamp } from 'three/tsl';
import { Rng } from '../core/rng';

/** streak / flake geometry (m) and the volumes round the eye (C) */
export const RAIN_W = 0.012, RAIN_L = 0.55, FLAKE = 0.012;
export const RAIN_VOL = { R: 10, H: 10 }, SNOW_VOL = { R: 9, H: 8 };
/** a particle's on-screen size never falls under one pixel: the widening factor and the opacity that conserves its light */
export function minPixel(sizeM: number, distM: number, pxAngle: number): { scale: number; fade: number } {
  const px = Math.max(1e-6, distM * pxAngle), scale = Math.max(1, px / sizeM);
  return { scale, fade: 1 / scale };
}
/** the near fade: nothing within 0.5 m of the lens, full from 1.5 m */
export const nearFade = (d: number) => { const t = Math.min(1, Math.max(0, (d - 0.5) / 1.0)); return t * t * (3 - 2 * t); };
/** particles per cubic metre drawn at full intensity (for tests) */
export const densityPerM3 = (count: number, vol: { R: number; H: number }) => count / ((2 * vol.R) ** 2 * vol.H);

export class WeatherVfx {
  readonly group = new THREE.Group();
  private rain: THREE.InstancedMesh; private snow: THREE.InstancedMesh;
  private drops: Float32Array; private flakes: Float32Array;
  private rainFade: THREE.InstancedBufferAttribute; private snowFade: THREE.InstancedBufferAttribute;
  private rng = new Rng(1, 'weather-vfx');
  readonly flash = new THREE.DirectionalLight(0xdfe6ff, 0);
  /** the radiance a streak and a flake show (renderer units; set each frame from the sky: setLight) */
  private uRain = uniform(new THREE.Color(0.5, 0.52, 0.56)); private uFlake = uniform(new THREE.Color(0.8, 0.8, 0.84));
  private flashT = -1; private nextStrike = 5;
  readonly maxFlakes: number;
  onThunder: (delay: number, strength: number) => void = () => {};
  constructor(private maxDrops: number) {
    this.group.name = 'weather-vfx';
    this.maxFlakes = maxDrops * 2;
    this.drops = new Float32Array(maxDrops * 3); this.flakes = new Float32Array(this.maxFlakes * 3);
    for (let i = 0; i < maxDrops; i++) { const a = this.drops; a[i * 3] = (this.rng.next() - 0.5) * 2 * RAIN_VOL.R; a[i * 3 + 1] = this.rng.next() * RAIN_VOL.H; a[i * 3 + 2] = (this.rng.next() - 0.5) * 2 * RAIN_VOL.R; }
    for (let i = 0; i < this.maxFlakes; i++) { const a = this.flakes; a[i * 3] = (this.rng.next() - 0.5) * 2 * SNOW_VOL.R; a[i * 3 + 1] = this.rng.next() * SNOW_VOL.H; a[i * 3 + 2] = (this.rng.next() - 0.5) * 2 * SNOW_VOL.R; }
    const streak = new THREE.PlaneGeometry(RAIN_W, RAIN_L);
    this.rainFade = new THREE.InstancedBufferAttribute(new Float32Array(maxDrops).fill(1), 1); this.rainFade.setUsage(THREE.DynamicDrawUsage); streak.setAttribute('aFade', this.rainFade);
    const rm = colourOnly(new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true }));
    const u = uv(), fr = attribute('aFade', 'float');
    rm.colorNode = vec4(this.uRain, 1);
    rm.opacityNode = smoothstep(0.0, 0.4, u.y).mul(smoothstep(0.6, 1.0, u.y).oneMinus()).mul(0.5).mul(fr).mul(float(1).sub(roofedNode())); // no rain under the halls' roofs (session 5)
    this.rain = new THREE.InstancedMesh(streak, rm, maxDrops); this.rain.frustumCulled = false; this.rain.count = 0;
    const flake = new THREE.PlaneGeometry(FLAKE, FLAKE);
    this.snowFade = new THREE.InstancedBufferAttribute(new Float32Array(this.maxFlakes).fill(1), 1); this.snowFade.setUsage(THREE.DynamicDrawUsage); flake.setAttribute('aFade', this.snowFade);
    const sm = colourOnly(new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true }));
    sm.colorNode = vec4(this.uFlake, 1);
    const r = length(vec2(u.x.sub(0.5), u.y.sub(0.5))).mul(2); // round, soft-edged
    sm.opacityNode = clamp(float(1).sub(smoothstep(0.55, 1.0, r)), 0, 1).mul(0.95).mul(fr).mul(float(1).sub(roofedNode()));
    this.snow = new THREE.InstancedMesh(flake, sm, this.maxFlakes); this.snow.frustumCulled = false; this.snow.count = 0;
    this.rain.userData = { tier: 'C', note: 'rain streaks round the eye: lit by the skylight, ≥ 1 px wide with their light conserved (D-219)' };
    this.snow.userData = { tier: 'C', note: 'snowflakes round the eye: white scatterers under the skylight and a quarter of the sun, ≥ 1 px (D-219)' };
    this.group.add(this.rain, this.snow, this.flash, this.flash.target);
  }
  /** the light the streaks and flakes show: the hemisphere light (sky colour, ground colour, intensity: irradiance) and the
   *  sun's irradiance at normal incidence (colour × intensity, 0 when hidden) */
  setLight(hemi: THREE.HemisphereLight, sun: THREE.DirectionalLight | null) {
    const I = hemi.intensity / Math.PI, sk = hemi.color, gr = hemi.groundColor, sI = sun && sun.visible ? sun.intensity / Math.PI : 0, sc = sun?.color;
    const amb = [0.5 * (sk.r + gr.r) * I, 0.5 * (sk.g + gr.g) * I, 0.5 * (sk.b + gr.b) * I];
    this.uRain.value.setRGB(0.8 * amb[0], 0.8 * amb[1], 0.8 * amb[2]);
    this.uFlake.value.setRGB(0.85 * (amb[0] + 0.25 * sI * (sc?.r ?? 0)), 0.85 * (amb[1] + 0.25 * sI * (sc?.g ?? 0)), 0.85 * (amb[2] + 0.25 * sI * (sc?.b ?? 0)));
  }
  update(dt: number, camera: THREE.Camera, cond: { rain: number; snowFall: number; windMs: number; windDirDeg: number; lightning: boolean }, flashCap: number): number {
    const cp = camera.position, m4 = new THREE.Matrix4(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
    const pxAngle = (camera as THREE.PerspectiveCamera).isPerspectiveCamera ? (2 * Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov) / 2)) / 540 : 0.0015; // (a 540-line frame: the test captures)
    const wr = ((cond.windDirDeg + 180 - 341) * Math.PI) / 180, wx = Math.sin(wr) * cond.windMs, wz = -Math.cos(wr) * cond.windMs;
    const nr = Math.floor(this.maxDrops * Math.min(1, cond.rain)), ns = Math.floor(this.maxFlakes * Math.min(1, cond.snowFall));
    const wrap = (v: number, c: number, r: number) => { const d = v - c; return c + (((d + r) % (2 * r)) + 2 * r) % (2 * r) - r; };
    // rain: 6.5 m/s fall (C, typical drop terminal velocity), tilted by wind
    const axis = new THREE.Vector3(-wx, 6.5, -wz).normalize(), ax = new THREE.Vector3(), rt = new THREE.Vector3(), fw = new THREE.Vector3(); // (up along the streak)
    { const { R, H } = RAIN_VOL;
      for (let i = 0; i < nr; i++) {
        const a = this.drops; a[i * 3] += wx * dt; a[i * 3 + 1] -= 6.5 * dt; a[i * 3 + 2] += wz * dt;
        if (a[i * 3 + 1] < cp.y - 2) a[i * 3 + 1] += H;
        const x = wrap(a[i * 3], cp.x, R), z = wrap(a[i * 3 + 2], cp.z, R), y = cp.y - 2 + (((a[i * 3 + 1] - cp.y + 2) % H) + H) % H;
        const d = Math.hypot(x - cp.x, y - cp.y, z - cp.z), mp = minPixel(RAIN_W, d, pxAngle);
        // the streak along the drop's velocity (fall + wind), turned about that axis to face the eye (session 7 turned each
        // streak by the same signed angle in its own facing frame: streaks leant both ways across the frame)
        ax.copy(axis); rt.set(cp.x - x, cp.y - y, cp.z - z).cross(ax); if (rt.lengthSq() < 1e-8) rt.set(1, 0, 0); rt.normalize(); fw.crossVectors(rt, ax);
        m4.makeBasis(rt.multiplyScalar(mp.scale), ax, fw).setPosition(x, y, z); this.rain.setMatrixAt(i, m4); this.rainFade.setX(i, mp.fade * nearFade(d));
      } }
    this.rain.count = nr; this.rain.instanceMatrix.needsUpdate = nr > 0; this.rainFade.needsUpdate = nr > 0;
    { const { R, H } = SNOW_VOL;
      for (let i = 0; i < ns; i++) {
        const a = this.flakes; a[i * 3] += (wx * 0.8 + Math.sin(i + a[i * 3 + 1]) * 0.3) * dt; a[i * 3 + 1] -= 1.0 * dt; a[i * 3 + 2] += (wz * 0.8 + Math.cos(i * 1.3 + a[i * 3 + 1]) * 0.3) * dt;
        const x = wrap(a[i * 3], cp.x, R), z = wrap(a[i * 3 + 2], cp.z, R), y = cp.y - 2 + (((a[i * 3 + 1] - cp.y + 2) % H) + H) % H;
        const d = Math.hypot(x - cp.x, y - cp.y, z - cp.z), mp = minPixel(FLAKE, d, pxAngle);
        m4.compose(pos.set(x, y, z), camera.quaternion, scl.set(mp.scale, mp.scale, 1)); this.snow.setMatrixAt(i, m4); this.snowFade.setX(i, mp.fade * mp.fade * nearFade(d));
      } }
    this.snow.count = ns; this.snow.instanceMatrix.needsUpdate = ns > 0; this.snowFade.needsUpdate = ns > 0;
    // lightning: Poisson strikes while `lightning` (≈ one per 25 s at the storm's height, C)
    let flashOut = 0;
    if (cond.lightning) { this.nextStrike -= dt; if (this.nextStrike <= 0) { this.flashT = 0; this.nextStrike = 8 + this.rng.next() * 35; const dist = 1 + this.rng.next() * 9; this.onThunder(dist / 0.343, 1 / dist); } }
    if (this.flashT >= 0) {
      this.flashT += dt; const t = this.flashT;
      const f = t < 0.08 ? 1 : t < 0.18 ? 0.2 : t < 0.26 ? 0.8 : Math.max(0, 1 - (t - 0.26) * 4);
      flashOut = f * flashCap; if (t > 0.6) this.flashT = -1;
      this.flash.position.copy(cp).add(new THREE.Vector3(200, 600, -300)); this.flash.target.position.copy(cp);
    }
    this.flash.intensity = flashOut * 6;
    return flashOut;
  }
}
