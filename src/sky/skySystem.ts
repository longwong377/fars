// Sky, sun, moon and stars for the date and place (brief §5.3). Positions from astronomy-engine (ephemeris.ts);
// sky radiance: Preetham analytic model (three SkyMesh, tier B for daylight colour; twilight/night handled by our
// own darkening and star field, tier C). Stars: HYG v4.1 (CC BY-SA), proper motion applied to 467 BCE, precessed
// with the IAU model inside Rotation_EQJ_HOR.
import * as THREE from 'three/webgpu';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import { float, vec3, vec4, uniform, attribute, normalWorld, max, dot, mix, smoothstep, color, Fn, positionWorld, cameraPosition, normalize, atan, asin, abs, exp, clamp, sqrt, mx_fractal_noise_float, int } from 'three/tsl';
import { sunHorizon, moonHorizon, moonPhase, azAltToWorld, j2000ToHorizonMatrix, starAzAlt } from './ephemeris';
import { VolumetricClouds } from './clouds';

export interface SkyState { sunDir: THREE.Vector3; sunAlt: number; moonDir: THREE.Vector3; moonAlt: number; moonFraction: number; daylight: number; nightFactor: number }

const DOME = 60000;
export class SkySystem {
  readonly sky = new SkyMesh();
  readonly sun = new THREE.DirectionalLight(0xffffff, 3);
  readonly moonLight = new THREE.DirectionalLight(0x9fb4ff, 0);
  readonly hemi = new THREE.HemisphereLight(0xbfd6ff, 0x6b5a45, 0.6);
  readonly stars: THREE.Points;
  readonly moon: THREE.Mesh;
  private starData: Float32Array | null = null;
  private starCount = 0;
  private uNight = uniform(0);
  private uMoonSun = uniform(new THREE.Vector3(0, 1, 0));
  private lastStarJD = -1;
  twilight = 1;
  state: SkyState = { sunDir: new THREE.Vector3(0, 1, 0), sunAlt: 45, moonDir: new THREE.Vector3(0, -1, 0), moonAlt: -10, moonFraction: 0, daylight: 1, nightFactor: 0 };

  readonly clouds: VolumetricClouds;
  /** Milky Way + airglow layer (night only; additive, between the sky and the stars) */
  readonly milkyWay: THREE.Mesh;
  private uGal = uniform(new THREE.Matrix3()); // world direction → galactic (l, b) unit vector, per epoch and sidereal time
  private uMW = uniform(0); // night × moon × cloud visibility of faint diffuse light
  constructor(readonly scene: THREE.Scene, shadowMapSize: number, quality = 'high') {
    // Milky Way (C structure, A position): galactic coordinates from the fixed J2000→galactic rotation (IAU 1958 / Hipparcos
    // matrix) after the epoch's precession and Earth rotation (the same astronomy-engine matrix as the stars). Brightness:
    // a disk thinning with galactic latitude and brightening toward the centre in Sagittarius, a central bulge, the Great
    // Rift (Cygnus → Sagittarius) and the Coalsack as absorbing lanes, and fixed-seed mottling. Airglow: a faint green-grey
    // emission layer ~90 km up, brighter toward the horizon (van Rhijn factor). Both are perceptual values (C), faded by
    // extinction near the horizon.
    const mwMat = new THREE.MeshBasicNodeMaterial({ side: THREE.BackSide, transparent: false, blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, fog: false });
    const G = this.uGal, V = this.uMW;
    mwMat.colorNode = Fn(() => {
      const d = normalize(positionWorld.sub(cameraPosition));
      const g = G.mul(d); const l = atan(g.y, g.x), b = asin(clamp(g.z, -1, 1)); // radians; l = 0 toward the galactic centre
      const ld = l.mul(180 / Math.PI), bd = b.mul(180 / Math.PI);
      const alongC = exp(ld.div(62).pow(2).negate()); // brighter toward the centre
      const width = float(7).add(alongC.mul(6)); // the band thickens toward Sagittarius (deg)
      const disk = exp(abs(bd.add(0.5)).div(width).negate()).mul(float(0.35).add(alongC.mul(0.65)));
      const bulge = exp(ld.div(14).pow(2).add(bd.add(3).div(10).pow(2)).negate()).mul(0.9);
      const rift = float(1).sub(exp(bd.sub(1.5).div(2.4).pow(2).negate()).mul(smoothstep(-20, -8, ld).mul(float(1).sub(smoothstep(55, 75, ld)))).mul(0.7)); // Great Rift
      const coal = float(1).sub(exp(ld.add(59).div(3).pow(2).add(bd.add(1).div(2.5).pow(2)).negate()).mul(0.8)); // Coalsack (l ≈ 301°)
      const mottle = mx_fractal_noise_float(g.mul(9), int(4), float(2.1), float(0.55)).mul(0.45).add(0.8);
      const mw = disk.add(bulge).mul(rift).mul(coal).mul(mottle).mul(0.032);
      const alt = max(d.y, 0.0);
      const ext = exp(float(0.25).negate().div(alt.add(0.035))); // extinction by air mass (C)
      const vanRhijn = float(1).div(sqrt(float(1).sub(float(0.972).mul(float(1).sub(alt.mul(alt)))))); // (R/(R+90 km))² = 0.972
      const airglow = vec3(0.0035, 0.0048, 0.0036).mul(vanRhijn).mul(smoothstep(-0.02, 0.03, d.y));
      const warm = mix(vec3(0.85, 0.88, 1.0), vec3(1.0, 0.93, 0.8), alongC);
      return vec4(warm.mul(mw).mul(ext).add(airglow).mul(V), 1);
    })();
    this.milkyWay = new THREE.Mesh(new THREE.SphereGeometry(DOME * 0.92, 64, 32), mwMat);
    this.milkyWay.frustumCulled = false; this.milkyWay.renderOrder = -9.5;
    this.milkyWay.userData = { tier: 'C', src: 'RECON', note: 'Milky Way position A (galactic frame, precessed); brightness structure and airglow C (procedural, perceptual)' };
    scene.add(this.milkyWay);
    this.sky.scale.setScalar(DOME * 0.95);
    this.sky.turbidity.value = 3; this.sky.rayleigh.value = 1.2; this.sky.mieCoefficient.value = 0.004; this.sky.mieDirectionalG.value = 0.8;
    this.sky.userData = { tier: 'B', src: 'RECON', note: 'Preetham analytic sky (three SkyMesh); cloud layer is SkyMesh procedural (C) until Phase 3 volumetrics' };
    this.sky.frustumCulled = false;
    // SkyMesh pins its depth to 1.0, which is the NEAR plane under reversed-Z (WebGPU path) — draw it first, untested
    const skyMat = this.sky.material as THREE.Material; skyMat.depthTest = false; skyMat.depthWrite = false; this.sky.renderOrder = -10;
    scene.add(this.sky);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
    const sc = this.sun.shadow.camera as THREE.OrthographicCamera;
    sc.left = -120; sc.right = 120; sc.top = 120; sc.bottom = -120; sc.near = 1; sc.far = 2000;
    this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.05;
    scene.add(this.sun, this.sun.target, this.moonLight, this.moonLight.target, this.hemi);
    // moon: disc of 0.52° apparent diameter, shaded by the true sun direction (phase)
    const moonR = Math.tan((0.26 * Math.PI) / 180) * DOME * 0.9;
    const mm = new THREE.MeshBasicNodeMaterial({ fog: false, depthWrite: false, depthTest: false });
    const lit = max(dot(normalWorld, this.uMoonSun), float(0));
    mm.colorNode = vec4(vec3(0.95, 0.93, 0.88).mul(lit.mul(1.2)).add(vec3(0.02, 0.025, 0.035)), 1);
    this.moon = new THREE.Mesh(new THREE.SphereGeometry(moonR, 32, 16), mm);
    this.moon.frustumCulled = false; this.moon.renderOrder = -8;
    scene.add(this.moon);
    // stars
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    const pm = new THREE.PointsNodeMaterial({ transparent: false, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, sizeAttenuation: false }); // opaque pass (drawn first by renderOrder, covered by architecture), additive so faint stars never darken the sky
    const bright = attribute('bright', 'float'), tint = attribute('tint', 'vec3');
    pm.colorNode = vec4(tint.mul(bright).mul(this.uNight), 1);
    pm.sizeNode = float(1.0).add(bright.mul(1.5));
    this.stars = new THREE.Points(geo, pm);
    this.stars.frustumCulled = false; this.stars.renderOrder = -9;
    this.stars.userData = { tier: 'A', src: 'HYG41', note: 'HYG v4.1 positions + proper motion to 467 BCE, precessed (astronomy-engine)' };
    scene.add(this.stars);
    this.clouds = new VolumetricClouds(DOME * 0.85, quality); scene.add(this.clouds.mesh);
  }

  async loadStars(base = '') {
    const meta = await (await fetch(`${base}generated/stars.json`)).json();
    this.starData = new Float32Array(await (await fetch(`${base}generated/stars_hyg41_m65.f32`)).arrayBuffer());
    this.starCount = meta.count;
    const g = this.stars.geometry;
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.starCount * 3), 3));
    const bright = new Float32Array(this.starCount), tint = new Float32Array(this.starCount * 3);
    for (let i = 0; i < this.starCount; i++) {
      const mag = this.starData[i * 6 + 4], bv = this.starData[i * 6 + 5];
      bright[i] = Math.min(1.5, Math.pow(10, -0.4 * (mag - 1.0)) ) * 0.9 + 0.05;
      // B−V → approximate RGB (Ballesteros temperature → blackbody tint)
      const T = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
      const c = kelvinToRGB(T); tint.set(c, i * 3);
    }
    g.setAttribute('bright', new THREE.BufferAttribute(bright, 1));
    g.setAttribute('tint', new THREE.BufferAttribute(tint, 3));
    this.lastStarJD = -1;
  }

  /** world direction → galactic unit vector: galactic = M_gal · H(jd)ᵀ · Gᵀ · world, where H takes J2000 to the horizon
   *  frame (x north, y west, z zenith; precession, nutation, Earth rotation) and G the horizon frame to world axes */
  private updateGalactic(jdUT: number) { this.uGal.value.copy(worldToGalactic(jdUT)); }
  /** Recompute star directions for this epoch and sidereal time (cheap enough every ~10 s of game time). */
  private updateStars(jdUT: number) {
    if (!this.starData) return;
    const m = j2000ToHorizonMatrix(jdUT); // astronomy-engine HOR: x=north, y=west, z=zenith
    const pos = this.stars.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = pos.array as Float32Array, R = DOME * 0.9;
    for (let i = 0; i < this.starCount; i++) {
      const d = this.starData, o = i * 6;
      const h = starAzAlt(d[o], d[o + 1], d[o + 2], d[o + 3], jdUT, m);
      const w = azAltToWorld(h.azimuth, h.altitude);
      arr[i * 3] = w[0] * R; arr[i * 3 + 1] = w[1] * R; arr[i * 3 + 2] = w[2] * R;
    }
    pos.needsUpdate = true;
  }

  update(jdUT: number, camPos: THREE.Vector3, cloudCover: number, haze: number, wind?: { ms: number; fromDeg: number; tSeconds: number }) {
    const s = sunHorizon(jdUT), mo = moonHorizon(jdUT), ph = moonPhase(jdUT);
    const sd = azAltToWorld(s.azimuth, s.altitude), md = azAltToWorld(mo.azimuth, mo.altitude);
    this.state.sunDir.set(sd[0], sd[1], sd[2]); this.state.sunAlt = s.altitude;
    this.state.moonDir.set(md[0], md[1], md[2]); this.state.moonAlt = mo.altitude; this.state.moonFraction = ph.fraction;
    const day = smoothstepJS(-6, 6, s.altitude); // civil twilight to full day
    const night = 1 - smoothstepJS(-18, -4, s.altitude); // astronomical darkness → 1
    this.state.daylight = day; this.state.nightFactor = night;
    this.sky.sunPosition.value.copy(this.state.sunDir).multiplyScalar(DOME);
    this.sky.turbidity.value = 2.2 + 6 * haze; this.sky.mieCoefficient.value = 0.003 + 0.02 * haze;
    // the 2D cloud layer of SkyMesh stands in only where the volumetric layer is off (test quality)
    (this.sky as any).cloudCoverage && ((this.sky as any).cloudCoverage.value = this.clouds.mesh.visible ? 0 : Math.max(0.05, cloudCover));
    this.sky.position.copy(camPos); this.stars.position.copy(camPos); this.moon.position.copy(camPos).addScaledVector(this.state.moonDir, DOME * 0.9);
    this.uMoonSun.value.copy(this.state.sunDir);
    this.uNight.value = night * (1 - 0.85 * cloudCover);
    // faint diffuse light (Milky Way, airglow): only in full darkness, washed out by moonlight, hidden by cloud (C)
    const moonUp = smoothstepJS(-2, 8, mo.altitude);
    this.uMW.value = night * Math.pow(1 - cloudCover, 1.5) * (1 - 0.92 * moonUp * Math.min(1, ph.fraction * 1.6));
    this.milkyWay.position.copy(camPos); this.milkyWay.visible = this.uMW.value > 0.002;
    // sun light: intensity scaled for atmosphere path length (air mass) and cloud; warm near the horizon
    const alt = Math.max(0, s.altitude);
    const airmass = 1 / (Math.sin((alt * Math.PI) / 180) + 0.50572 * Math.pow(alt + 6.07995, -1.6364));
    const trans = Math.exp(-0.18 * (1 + haze) * airmass);
    this.sun.intensity = 3.2 * trans * (1 - 0.75 * cloudCover) * smoothstepJS(-1, 3, s.altitude);
    this.sun.color.setRGB(1, 0.62 + 0.38 * trans, 0.38 + 0.62 * Math.pow(trans, 1.4));
    this.sun.position.copy(camPos).addScaledVector(this.state.sunDir, 800);
    this.sun.target.position.copy(camPos);
    this.sun.visible = s.altitude > -2;
    // moonlight ~ 1/400000 of sun in reality; exposure adaptation lifts it — here a perceptual value (C)
    this.moonLight.intensity = 0.12 * ph.fraction * smoothstepJS(-2, 10, mo.altitude) * night * (1 - 0.8 * cloudCover);
    this.moonLight.position.copy(camPos).addScaledVector(this.state.moonDir, 800); this.moonLight.target.position.copy(camPos);
    const twilight = smoothstepJS(-14, 4, s.altitude); this.twilight = twilight; // skylight is substantial through civil twilight
    this.hemi.intensity = 0.03 + 0.95 * twilight * (1 - 0.3 * cloudCover) + 0.04 * ph.fraction * night;
    this.hemi.color.setRGB(0.55 + 0.2 * day, 0.62 + 0.18 * day, 0.8 + 0.1 * day);
    // volumetric clouds: cover, light, wind drift (the wind blows FROM windDir: clouds move the opposite way)
    const C = this.clouds; C.mesh.position.copy(camPos); C.coverage.value = cloudCover; C.sunDir.value.copy(this.state.sunDir);
    C.sunColor.value.copy(this.sun.color).multiplyScalar(this.sun.visible ? this.sun.intensity / 3.2 : 0).add(new THREE.Color(0.55, 0.6, 0.75).multiplyScalar(this.moonLight.intensity * 0.5));
    C.ambient.value.copy(this.hemi.color).multiplyScalar(this.hemi.intensity * 0.55);
    C.haze.value.setRGB(0.62 + 0.1 * (1 - day), 0.66, 0.74 - 0.08 * (1 - day)).multiplyScalar(0.05 + 0.95 * twilight);
    if (wind) { const a = ((wind.fromDeg + 180) * Math.PI) / 180; C.wind.value.set(Math.sin(a) * wind.ms * 2.5, -Math.cos(a) * wind.ms * 2.5); C.time.value = wind.tSeconds; } // winds aloft ~2.5 × surface (C)
    if (Math.abs(jdUT - this.lastStarJD) > 10 / 86400) { this.updateStars(jdUT); this.updateGalactic(jdUT); this.lastStarJD = jdUT; }
  }
}

/** world direction → galactic unit vector at an epoch: M_gal · H(jd)ᵀ · Gᵀ, where H takes J2000 to the horizon frame
 *  (x north, y west, z zenith; precession, nutation, Earth rotation) and G the horizon frame to world axes (azAltToWorld) */
export function worldToGalactic(jdUT: number): THREE.Matrix3 {
  const m = j2000ToHorizonMatrix(jdUT); // hor = R·j with R[i][j] = m[j*3+i]
  const R = new THREE.Matrix3().set(m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]);
  const th = (341 * Math.PI) / 180, st = Math.sin(th), ct = Math.cos(th);
  const G = new THREE.Matrix3().set(-st, -ct, 0, 0, 0, 1, -ct, st, 0);
  // J2000 equatorial → galactic (Hipparcos / IAU rotation matrix)
  const Mgal = new THREE.Matrix3().set(-0.0548755604, -0.8734370902, -0.4838350155, 0.4941094279, -0.44482963, 0.7469822445, -0.867666149, -0.1980763734, 0.4559837762);
  return Mgal.multiply(R.transpose()).multiply(G.transpose());
}
function smoothstepJS(a: number, b: number, x: number) { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function kelvinToRGB(T: number): [number, number, number] {
  const t = T / 100; let r: number, g: number, b: number;
  if (t <= 66) { r = 255; g = 99.47 * Math.log(t) - 161.12; b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04; }
  else { r = 329.7 * Math.pow(t - 60, -0.1332); g = 288.12 * Math.pow(t - 60, -0.0755); b = 255; }
  const c = (v: number) => Math.min(1, Math.max(0, v / 255));
  return [c(r), c(g), c(b)];
}
void mix; void smoothstep; void color;
