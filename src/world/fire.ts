// Fire, light and smoke (brief §5.4). Every fire is a real object (torch, brazier, hearth, oven, lamp) with a flame
// billboard, a flickering light (nearest N fires get a real point light; colour ≈ 1800–2000 K) and optional smoke
// that drifts with the wind. Fires are lit at dusk and put out after the night (C schedule until NPCs light them, Phase 5).
import * as THREE from 'three/webgpu';
import { uniform, uv, vec3, vec4, float, mx_noise_float, time, attribute, smoothstep, mix, length, vec2, max, positionWorld, cameraPosition, normalize, dot, pow } from 'three/tsl';
import { Rng } from '../core/rng';

export type FireKind = 'torch' | 'brazier' | 'hearth' | 'oven' | 'lamp' | 'kiln';
/** when a fire burns (C schedules): 'night' dusk to after sunrise (default); 'home' a domestic hearth, lit as the light
 *  goes for the evening meal and banked a few hours after dark, relit before dawn; 'bake' a bread oven, before dawn into
 *  the morning; 'day' a workshop fire (kiln, forge) in working hours. Needs the local hour (update's last argument). */
export type FireSchedule = 'night' | 'home' | 'bake' | 'day';
export interface FireSource { id: string; kind: FireKind; pos: THREE.Vector3; lit: boolean; seed: number; tier: string; src: string; note: string; sched?: FireSchedule; group?: string }
const SPEC: Record<FireKind, { flameH: number; flameW: number; power: number; range: number; smoke: number }> = {
  torch: { flameH: 0.45, flameW: 0.22, power: 1.2, range: 14, smoke: 0.2 },
  brazier: { flameH: 0.7, flameW: 0.55, power: 2.4, range: 22, smoke: 0.5 },
  hearth: { flameH: 0.5, flameW: 0.6, power: 1.6, range: 14, smoke: 1.0 },
  oven: { flameH: 0.25, flameW: 0.4, power: 0.8, range: 8, smoke: 1.2 },
  lamp: { flameH: 0.06, flameW: 0.03, power: 0.08, range: 3.5, smoke: 0.0 },
  kiln: { flameH: 0.35, flameW: 0.5, power: 1.4, range: 10, smoke: 1.6 },
};
/** smoke puffs come only from fires within this distance of the camera (the pool is shared; far smoke is the town haze) */
export const SMOKE_RANGE = 300;
// ~1900 K blackbody (Planck, sRGB-normalised) — the colour temperature of wood/oil flames (C)
const FIRE_RGB = new THREE.Color().setRGB(1.0, 0.52, 0.18);

/** the sky and sun as the smoke sees them: SkySystem (horizon radiance, hemisphere light, sun) */
export interface SmokeSky { horizon: THREE.Color; hemi?: THREE.HemisphereLight; sun: THREE.DirectionalLight; state: { sunDir: THREE.Vector3 }; fireScale?: number }
/** ground albedo under the smoke for the light it reflects up into it (C) */
const SMOKE_GROUND_ALBEDO = 0.25;
/** radiance the skylight gives an optically thin smoke by single scattering, before the albedo (D-070): the isotropic
 *  part of the phase function sees the mean radiance over the sphere, the sky above (hemisphere irradiance E / pi, the
 *  radiance the calibrated dome averages to, D-060) and the ground below (albedo x E / pi), halved. It was the horizon
 *  radiance in the view direction, the colour of whatever lies behind the smoke at a distance, so town smoke and haze
 *  vanished into the distance they stood against (measured: terrace-w-dusk with and without the town differed in < 1,000 px) */
export function smokeSkyRadiance(sky: SmokeSky, out: THREE.Color): THREE.Color {
  if (!sky.hemi) return out.copy(sky.horizon);
  return out.copy(sky.hemi.color).multiplyScalar((sky.hemi.intensity * (1 + SMOKE_GROUND_ALBEDO)) / (2 * Math.PI));
}
export class FireSystem {
  readonly group = new THREE.Group();
  readonly fires: FireSource[] = [];
  private flames!: THREE.InstancedMesh;
  private lights: THREE.PointLight[] = [];
  private smoke!: THREE.InstancedMesh;
  private smokeP: { pos: THREE.Vector3; vel: THREE.Vector3; age: number; life: number; size: number; power?: number }[] = [];
  private smokeGlow!: THREE.InstancedBufferAttribute;
  // light on the smoke (session 3, D-060, D-070): the skylight scattered by the smoke (smokeSkyRadiance), the sun through a
  // forward-peaked phase function, and the fire below it; set each frame by setSkyLight (was a constant unlit grey,
  // which glowed on a moonless night)
  private uSky = uniform(new THREE.Color(0.3, 0.3, 0.3)); private uSun = uniform(new THREE.Color(0, 0, 0)); private uSunDir = uniform(new THREE.Vector3(0, 1, 0));
  setSkyLight(sky: SmokeSky | null | undefined) {
    if (!sky?.horizon || !sky.sun) return; smokeSkyRadiance(sky, this.uSky.value);
    this.lightScale = sky.fireScale ?? 1; // cast light pre-exposed for night: scaled with the sky's gain in twilight and day (D-117)
    this.uSun.value.copy(sky.sun.color).multiplyScalar(sky.sun.visible ? sky.sun.intensity : 0); this.uSunDir.value.copy(sky.state.sunDir);
  }
  private smokeAlpha!: THREE.InstancedBufferAttribute;
  private lightScale = 1;
  private rng = new Rng(1, 'fire');
  private uLit = uniform(1);
  constructor(maxLights: number) {
    this.group.name = 'fire';
    for (let i = 0; i < maxLights; i++) { const l = new THREE.PointLight(FIRE_RGB, 0, 20, 2); l.castShadow = false; this.lights.push(l); this.group.add(l); }
  }
  /** `base` = where the object stands (floor) or, for torches, the bracket point on the wall */
  /** `meta.body: false` = the caller draws the fire's body itself (the settlement merges its hearths and ovens) */
  add(kind: FireKind, base: THREE.Vector3, meta: { tier: string; src: string; note: string; sched?: FireSchedule; group?: string; body?: boolean }) {
    const lift = { torch: 0.35, brazier: 1.02, hearth: 0.15, oven: 0.25, lamp: 0.05, kiln: 0.6 }[kind];
    const { body, ...m } = meta;
    this.fires.push({ id: `${kind}-${this.fires.length}`, kind, pos: base.clone().add(new THREE.Vector3(0, lift, 0)), lit: false, seed: this.rng.next() * 100, ...m });
    if (body !== false) this.bodies.push({ kind, base: base.clone() });
  }
  private bodies: { kind: FireKind; base: THREE.Vector3 }[] = [];
  /** simple physical bodies (C forms): brazier = bronze bowl on a stand (after the incense stands on the reliefs), torch = wooden
   *  shaft in a bronze bracket, hearth = ring of stones, oven = clay dome */
  private buildBodies() {
    const mk = (g: THREE.BufferGeometry, color: number, rough: number, metal = 0) => ({ g, m: new THREE.MeshStandardNodeMaterial({ color: new THREE.Color(color), roughness: rough, metalness: metal }) });
    const brz = new THREE.LatheGeometry([[0.02, 0], [0.18, 0.02], [0.08, 0.1], [0.05, 0.8], [0.12, 0.84], [0.32, 0.9], [0.36, 1.02], [0.3, 1.0], [0.0, 0.92]].map(([x, y]) => new THREE.Vector2(x, y)), 16);
    const torch = new THREE.CylinderGeometry(0.03, 0.025, 0.6, 6).translate(0, 0.05, 0.1).rotateX(-0.25);
    const hearth = new THREE.TorusGeometry(0.45, 0.12, 5, 10).rotateX(Math.PI / 2).translate(0, 0.1, 0);
    const oven = new THREE.SphereGeometry(0.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    const kinds: Record<string, { g: THREE.BufferGeometry; m: THREE.Material }> = {
      brazier: mk(brz, 0x8a6a3a, 0.4, 1), torch: mk(torch, 0x5a4028, 0.8), hearth: mk(hearth, 0x7a7266, 0.9), oven: mk(oven, 0x9a7a58, 0.95),
    };
    for (const [k, v] of Object.entries(kinds)) {
      const list = this.bodies.filter(b => b.kind === k); if (!list.length) continue;
      const im = new THREE.InstancedMesh(v.g, v.m, list.length); const m4 = new THREE.Matrix4();
      list.forEach((b, i) => { m4.makeTranslation(b.base.x, b.base.y, b.base.z); im.setMatrixAt(i, m4); });
      im.castShadow = true; im.receiveShadow = true; im.name = `fire-body:${k}`; im.userData = { tier: 'C', src: 'RECON', note: `${k} (form C; brazier after the incense stands on the audience relief, B type)` };
      this.group.add(im);
    }
  }
  /** build GPU objects once all fires are registered */
  build() {
    this.buildBodies();
    const n = Math.max(1, this.fires.length);
    const plane = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const seedAttr = new THREE.InstancedBufferAttribute(new Float32Array(n), 1); this.fires.forEach((f, i) => (seedAttr.array[i] = f.seed));
    plane.setAttribute('aSeed', seedAttr);
    const m = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    const u = uv(), seed = attribute('aSeed', 'float');
    const n1 = mx_noise_float(vec3(u.x.mul(3), u.y.mul(2.5).sub(time.mul(2.2)), seed)).mul(0.5).add(0.5);
    const shape = smoothstep(0.0, 0.5, length(vec2(u.x.sub(0.5).mul(2.0), u.y.sub(0.35).mul(1.1)))).oneMinus().mul(smoothstep(0.5, 1.0, u.y).oneMinus());
    const a = max(float(0), shape.mul(n1.mul(1.6)).sub(0.25)).mul(this.uLit);
    const hot = mix(vec3(1.0, 0.35, 0.05), vec3(1.0, 0.85, 0.5), smoothstep(0.2, 0.9, a));
    m.colorNode = vec4(hot.mul(a.mul(3.0)), a); m.opacityNode = a;
    this.flames = new THREE.InstancedMesh(plane, m, n); this.flames.frustumCulled = false; this.flames.renderOrder = 5;
    this.flames.userData = { tier: 'C', src: 'RECON', note: 'flame billboards (procedural); fire placements C unless noted' };
    this.group.add(this.flames);
    // smoke puffs: soft quads, per-instance alpha
    const SMAX = 400; const sq = new THREE.PlaneGeometry(1, 1);
    this.smokeAlpha = new THREE.InstancedBufferAttribute(new Float32Array(SMAX), 1); sq.setAttribute('aAlpha', this.smokeAlpha);
    const sm = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const su = uv(); const r = length(su.sub(0.5)).mul(2);
    const puff = smoothstep(0.2, 1.0, r).oneMinus().mul(mx_noise_float(vec3(su.mul(3), time.mul(0.1))).mul(0.3).add(0.7));
    this.smokeGlow = new THREE.InstancedBufferAttribute(new Float32Array(SMAX), 1); sq.setAttribute('aGlow', this.smokeGlow);
    { const OMEGA = 0.9, G = 0.6; // single-scattering albedo and Henyey–Greenstein asymmetry of wood smoke (C)
      const cosT = dot(normalize(positionWorld.sub(cameraPosition)), this.uSunDir);
      const hg = float((1 - G * G) / (4 * Math.PI)).div(pow(float(1 + G * G).sub(cosT.mul(2 * G)), 1.5));
      sm.colorNode = (this.uSky as any).add((this.uSun as any).mul(hg)).mul(OMEGA).add(vec3(1.0, 0.55, 0.25).mul(attribute('aGlow', 'float'))); }
    sm.opacityNode = puff.mul(attribute('aAlpha', 'float'));
    this.smoke = new THREE.InstancedMesh(sq, sm, SMAX); this.smoke.frustumCulled = false; this.smoke.count = 0; this.smoke.renderOrder = 4;
    this.smoke.userData = { tier: 'C', src: 'RECON', note: 'smoke puffs (procedural), drift with the weather wind' };
    this.group.add(this.smoke);
  }
  /** lit state: fires burn from dusk (sun < 4° and falling or night) until after sunrise (C schedule) */
  update(dt: number, camera: THREE.Camera, sunAlt: number, windMs: number, windDirDeg: number, rain: number, t: number, hour?: number) {
    const lit = sunAlt < 4;
    for (const f of this.fires) f.lit = (hour === undefined || !f.sched || f.sched === 'night' ? lit : scheduleLit(f.sched, hour, sunAlt, f.seed)) && !(rain > 0.6 && (f.kind === 'brazier' || f.kind === 'hearth'));
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    // flames: cylindrical billboards (yaw only) facing the camera
    this.fires.forEach((f, i) => {
      const s = SPEC[f.kind]; const sc = f.lit ? 1 : 0;
      const flick = 0.85 + 0.15 * Math.sin(t * 13 + f.seed) * Math.sin(t * 7.3 + f.seed * 2);
      e.set(0, Math.atan2(camera.position.x - f.pos.x, camera.position.z - f.pos.z), 0); q.setFromEuler(e);
      m4.compose(f.pos, q, new THREE.Vector3(s.flameW * sc, s.flameH * sc * flick, 1)); this.flames.setMatrixAt(i, m4);
    });
    this.flames.instanceMatrix.needsUpdate = true;
    // lights to the nearest lit fires
    const lit_ = this.fires.filter(f => f.lit).map(f => ({ f, d: f.pos.distanceTo(camera.position) })).sort((a, b) => a.d - b.d);
    this.lights.forEach((l, i) => {
      const x = lit_[i]; if (!x || x.d > 90) { l.intensity = 0; l.visible = false; return; }
      const s = SPEC[x.f.kind]; l.visible = true;
      l.position.copy(x.f.pos).y += s.flameH * 0.5;
      const flick = 0.8 + 0.2 * (Math.sin(t * 11 + x.f.seed) * 0.5 + Math.sin(t * 17.3 + x.f.seed * 3) * 0.5);
      l.intensity = s.power * 40 * flick * this.lightScale; l.distance = s.range * 2.2;
    });
    // smoke
    const wr = ((windDirDeg + 180 - 341) * Math.PI) / 180; // wind blows FROM windDir; grid frame
    const wind = new THREE.Vector3(Math.sin(wr) * windMs, 0, -Math.cos(wr) * windMs);
    const cp = camera.position;
    for (const f of this.fires) {
      const s = SPEC[f.kind]; if (!f.lit || s.smoke <= 0) continue;
      if (f.pos.distanceToSquared(cp) > SMOKE_RANGE * SMOKE_RANGE) continue;
      if (this.rng.next() < s.smoke * dt * 3 && this.smokeP.length < 400)
        this.smokeP.push({ power: s.power, pos: f.pos.clone().add(new THREE.Vector3(0, s.flameH, 0)), vel: new THREE.Vector3((this.rng.next() - 0.5) * 0.2, 0.5 + this.rng.next() * 0.4, (this.rng.next() - 0.5) * 0.2), age: 0, life: 6 + this.rng.next() * 6, size: 0.4 });
    }
    let k = 0; const camQ = camera.quaternion;
    this.smokeP = this.smokeP.filter(p => (p.age += dt) < p.life);
    for (const p of this.smokeP) {
      p.vel.lerp(new THREE.Vector3(wind.x * 0.6, 0.35, wind.z * 0.6), Math.min(1, dt * 0.5)); p.pos.addScaledVector(p.vel, dt); p.size += dt * 0.35;
      m4.compose(p.pos, camQ, new THREE.Vector3(p.size, p.size, p.size)); this.smoke.setMatrixAt(k, m4);
      this.smokeAlpha.array[k] = 0.35 * Math.min(1, p.age * 2) * (1 - p.age / p.life);
      this.smokeGlow.array[k] = (p.power ?? 1) * 0.6 * Math.exp(-p.age * 1.5); k++; // lit by its fire as it leaves the flame (C)
    }
    this.smoke.count = k; this.smoke.instanceMatrix.needsUpdate = true; this.smokeAlpha.needsUpdate = true; this.smokeGlow.needsUpdate = true;
  }
  /** illuminance-like contribution of lit fires near a point (for eye adaptation) */
  localIlluminance(p: THREE.Vector3) { let e = 0; for (const f of this.fires) { if (!f.lit) continue; const d2 = f.pos.distanceToSquared(p) + 1; e += SPEC[f.kind].power * 4 / d2; } return e * this.lightScale; }
  stats() { return { fires: this.fires.length, lit: this.fires.filter(f => f.lit).length, smoke: this.smokeP.length }; }
}

/** lit state of a scheduled fire (C). `seed` (0..100) staggers the fires so a town lights up over an hour, not at once. */
export function scheduleLit(sched: FireSchedule, hour: number, sunAlt: number, seed: number): boolean {
  const j = (seed % 1 + (seed * 0.137) % 1) % 1; // 0..1
  const pm = hour >= 12;
  switch (sched) {
    case 'home': return pm ? sunAlt < 6 - 10 * j && sunAlt > -(16 + 20 * j) : sunAlt > -(8 + 8 * j) && sunAlt < 6 + 10 * j;
    case 'bake': return !pm ? sunAlt > -(12 + 6 * j) && sunAlt < 10 + 18 * j : j < 0.25 && sunAlt < 3 && sunAlt > -10;
    case 'day': return hour > 6.5 + j && hour < 16 + 1.5 * j && sunAlt > -2;
    default: return sunAlt < 4;
  }
}
