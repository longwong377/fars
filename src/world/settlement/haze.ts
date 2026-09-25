// The town's rising smoke (brief §1.1 "smoke rising from the town at dusk as lamps are lit", §5.4). The fire system draws
// puffs only near the camera (fire.ts SMOKE_RANGE); every smoking fire of the town also has a plume ribbon here, its
// opacity from the fire's emission now (D-220: the household day's phase, hearthSmoke.ts). The haze over the town is no
// longer drawn here: the soft sheets per quarter were replaced by the smoke layer (landSmoke.ts), whose density follows
// what the quarter's households burn. Deterministic in time, so frozen test renders show it. Heights and widths C.
import * as THREE from 'three/webgpu';
import { colourOnly } from '../../render/fx';
import { uniform, uv, vec3, vec2, length, smoothstep, mx_noise_float, attribute, time, float, positionWorld, positionGeometry, cameraPosition, normalize, dot, pow } from 'three/tsl';
import type { TownPlan } from './plan';
import type { FireSystem, FireKind } from '../fire';
import { smokeSkyRadiance } from '../fire';
import { SOURCE, sourceTau } from '../hearthSmoke';

/** debug (?smokedbg): the plumes drawn solid red, to see where they are (the smoke layer: landSmoke.ts, solid blue) */
const SMOKE_DBG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('smokedbg');
/** Optical depth across a smoke plume where it leaves its fire, at its kind's default emission (session 7, D-195: the dawn
 *  "comb" — every hearth's ribbon was drawn at opacity ~0.38, so from the Terrace hundreds of thin pale columns stood in a
 *  row over the town). τ = k · Q / (u · w) (hearthSmoke.ts sourceTau; since D-220 the emission Q follows each fire's phase:
 *  a hearth lit from embers smokes ~3× its cooking fire, its embers ~2/3). Hearth cooking ≈ 0.03 (a faint wisp; the town's
 *  haze is the smoke layer, landSmoke.ts), a bread oven firing and a kiln ≈ 0.14, a charcoal brazier ≈ 0.002. All C
 *  (recollection of the biomass-burning literature, e.g. Reid et al. 2005; household-stove emission factors; NOT SEEN). */
export function plumeTau(kind: string): number { return sourceTau(kind, SOURCE[kind]?.gh ?? SOURCE.hearth.gh); }
export class TownHaze {
  readonly group = new THREE.Group();
  // light on the smoke (session 3, D-060, D-070): single scattering of the skylight (the mean radiance over the sphere,
  // fire.ts smokeSkyRadiance) and of the sun through a forward-peaked phase function; albedo ω (C). Before: a hand-set
  // grey, then the horizon radiance across the view, which matched the distance behind the smoke and hid it.
  private uSky = uniform(new THREE.Color(0.3, 0.3, 0.3)); private uSun = uniform(new THREE.Color(0, 0, 0)); private uSunDir = uniform(new THREE.Vector3(0, 1, 0));
  private siteFires = new Map<string, number[]>(); private lastFrac = new Map<string, number>();
  // rising plumes (session 3): one camera-facing ribbon per smoky town fire, one draw call. A hearth's smoke leaves the roof
  // hole about 0.6 m wide, widens to ~7 m as it climbs, bends downwind and spreads under the evening inversion (heights,
  // widths and opacity C; the brief's moment "smoke rising from the town at dusk as lamps are lit")
  private plumes: THREE.Mesh | null = null; private plumeFires: number[] = []; private plumeA: THREE.InstancedBufferAttribute | null = null;
  private uWind = uniform(new THREE.Vector2(0, 0)); private uTop = uniform(22);
  constructor(_plan: TownPlan, _H: (e: number, n: number) => number, private fire: FireSystem, _idx: { site: string; kind: FireKind }[]) {
    this.group.name = 'settlement:haze';
    this.buildPlumes();
  }
  private buildPlumes() {
    const smoky = new Set(['hearth', 'oven', 'kiln', 'brazier']);
    this.fire.fires.forEach((f, i) => { if (f.group && smoky.has(f.kind)) this.plumeFires.push(i); });
    const n = this.plumeFires.length; if (!n) return;
    const base = new THREE.PlaneGeometry(1, 1, 1, 8).translate(0, 0.5, 0); // x −0.5…0.5, y 0…1
    const g = new THREE.InstancedBufferGeometry(); g.index = base.index; for (const k of ['position', 'uv'] as const) g.setAttribute(k, base.getAttribute(k));
    const at = new Float32Array(n * 4); // base x, y, z, seed
    this.plumeFires.forEach((fi, k) => { const f = this.fire.fires[fi]; at.set([f.pos.x, f.pos.y + 2.5, f.pos.z, f.seed], k * 4); }); // leaves the roof / court ~2.5 m up
    g.setAttribute('pbase', new THREE.InstancedBufferAttribute(at, 4)); this.plumeA = new THREE.InstancedBufferAttribute(new Float32Array(n), 1); g.setAttribute('palpha', this.plumeA);
    g.instanceCount = n;
    const pb = attribute('pbase', 'vec4'), pa = attribute('palpha', 'float'), pg = positionGeometry, y = pg.y; // 0…1 up the plume
    const H = this.uTop.mul(float(0.75).add(pb.w.mul(0.013).fract().mul(0.5)));
    const w = float(0.6).add(y.mul(y).mul(6.5)); // widening
    const toCam = vec2(cameraPosition.x.sub(pb.x), cameraPosition.z.sub(pb.z)), d = toCam.div(length(toCam).max(0.01));
    const right = vec3(d.y, 0, d.x.negate());
    const bend = vec3(this.uWind.x, 0, this.uWind.y).mul(y.mul(y).mul(H).mul(0.35)); // bent over downwind
    const m = colourOnly(new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }));
    m.positionNode = vec3(pb.x, pb.y, pb.z).add(right.mul(pg.x.mul(w))).add(vec3(0, y.mul(H), 0)).add(bend);
    const u2 = uv(); const across = float(1).sub(smoothstep(0.2, 0.5, u2.x.sub(0.5).abs()));
    const turb = mx_noise_float(vec3(u2.x.mul(2.0), y.mul(3.0).sub(time.mul(0.25)), pb.w.mul(0.01))).mul(0.35).add(0.75);
    const along = smoothstep(0.0, 0.08, y).mul(float(1).sub(smoothstep(0.55, 1.0, y)));
    const OMEGA = 0.9, G = 0.6;
    const cosT = dot(normalize(positionWorld.sub(cameraPosition)), this.uSunDir), hg = float((1 - G * G) / (4 * Math.PI)).div(pow(float(1 + G * G).sub(cosT.mul(2 * G)), 1.5));
    m.colorNode = (this.uSky as any).add((this.uSun as any).mul(hg)).mul(OMEGA);
    // the smoke dilutes as it spreads: the optical depth across the plume falls as the base width over the width here (mass
    // conservation, C); with a constant opacity the widening plumes read as a fence of bright lines from the Terrace (D-070)
    const dilute = float(0.6).div(w);
    m.opacityNode = across.mul(along).mul(turb).mul(pa).mul(dilute);
    if (SMOKE_DBG) { m.colorNode = vec3(1, 0, 0); m.opacityNode = across.mul(along); } // debug: plumes solid red
    m.forceSinglePass = true; // camera-facing ribbons: one pass (D-220)
    const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 3; mesh.name = 'settlement:smoke-plumes';
    mesh.userData = { tier: 'C', src: 'RECON', note: `rising smoke of the town's hearths, ovens and kilns (${n} sources): opacity from each fire's emission now (D-220: the household day's phase from the people sim for the houses' hearths and ovens, the C schedules for the rest; fuel and emission factors C, NOT SEEN); plume height and width C` };
    this.plumes = mesh; this.group.add(mesh);
  }
  update(dt: number, camera: THREE.Camera, sunAlt: number, windMs: number, windDirDeg: number, hour: number, sky: any) {
    void dt; void camera;
    if (!this.siteFires.size) { this.fire.fires.forEach((f, i) => { if (!f.group) return; if (!this.siteFires.has(f.group)) this.siteFires.set(f.group, []); this.siteFires.get(f.group)!.push(i); }); }
    for (const [site, list] of this.siteFires) { let lit = 0; for (const i of list) if (this.fire.emission(i) > 0) lit++; this.lastFrac.set(site, list.length ? lit / list.length : 0); }
    // light on the smoke: the skylight the smoke scatters (D-070) and the direct sun (its irradiance and colour)
    if (sky?.horizon && sky.sun) smokeSkyRadiance(sky, this.uSky.value);
    if (sky?.sun && sky.state) { this.uSun.value.copy(sky.sun.color).multiplyScalar(sky.sun.visible ? sky.sun.intensity : 0); this.uSunDir.value.copy(sky.state.sunDir); }
    // still evening air lets a plume rise higher before it spreads (C)
    const evening = hour >= 12 && sunAlt < 5 ? 1.4 : 1.0, windK = 1 / (1 + windMs * 0.25);
    const wr = ((windDirDeg + 180 - 341) * Math.PI) / 180, wx = Math.sin(wr), wz = -Math.cos(wr);
    if (this.plumes && this.plumeA) { // each plume follows its fire
      this.uWind.value.set(wx * Math.min(1, windMs / 5), wz * Math.min(1, windMs / 5)); this.uTop.value = 12 + 16 * windK * (evening > 1 ? 1 : 0.7);
      // the plume's opacity at the roof hole from its smoke's optical depth now (sourceTau of the fire's emission), diluted
      // by the wind that carries it off (the column's mass per metre falls as 1 / the speed; a buoyant rise of ~1 m/s)
      const u = Math.max(1, windMs);
      let any = false; this.plumeFires.forEach((fi, k) => { const g = this.fire.emission(fi), a = g > 0 ? 1 - Math.exp(-sourceTau(this.fire.fires[fi].kind, g) / u) : 0; this.plumeA!.array[k] = a; if (a > 0) any = true; });
      this.plumeA.needsUpdate = true; this.plumes.visible = any;
    }
  }
  stats() { return { plumes: this.plumeFires.length, smoking: Object.fromEntries([...this.lastFrac].map(([k, v]) => [k, +v.toFixed(2)])) }; }
}
