// Sky, sun, moon and stars for the date and place (brief §5.3). Positions from astronomy-engine (ephemeris.ts).
// Sky radiance: the Preetham analytic model by day (three SkyMesh, B), and below ~+10° a physically based spherical
// atmosphere (atmosphere.ts: Earth's shadow, Belt of Venus, twilight glow; D-116), both calibrated against the skylight
// (D-060). Light levels: USNO Circular 171 illuminance ratios for the sun, the sky and the moon (illuminance.ts, D-115),
// with the eye's adaptation beyond the camera's range applied as a sky gain (exposure.ts, D-117). Night sky, airglow
// and Milky Way: perceptual values (C, D-047). Stars: HYG v4.1 (CC BY-SA), proper motion applied to 467 BCE, precessed
// with the IAU model inside Rotation_EQJ_HOR.
import * as THREE from 'three/webgpu';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import { float, vec2, vec3, vec4, uniform, attribute, normalWorld, max, dot, mix, smoothstep, color, Fn, positionWorld, cameraPosition, normalize, atan, asin, acos, abs, exp, clamp, sqrt, length, texture, mx_fractal_noise_float, int } from 'three/tsl';
import { sunHorizon, moonHorizon, moonPhase, azAltToWorld, j2000ToHorizonMatrix, starAzAlt } from './ephemeris';
import { VolumetricClouds } from './clouds';
import { skyCalibration, twilightWeight, TW_HI } from './horizon';
import { Atmosphere, aerosolTauFor, OBSERVER_ALT, SUN_ANGULAR_RADIUS, type SkyView, type SkyViewJob } from './atmosphere';
import { sunNormalLux, skyLux, moonLux, elongationFromFraction, extinctionK, NIGHT_LUX, REN_PER_LUX_SUN, REN_PER_LUX_SKY } from './illuminance';
import { skyGain } from './exposure';
import { CLOUD_BASE, CLOUD_TOP } from './clouds';
import { localCoverageUniform, localWeatherFactor } from './cloudCover';
import coverTable from '../data/cloud_cover_table.json';

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
  /** radiance of the sky just above the horizon across the view, after calibration: the fog colour (D-060) */
  readonly horizon = new THREE.Color(0.6, 0.63, 0.68);
  // dome (D-060, D-116): kP · Preetham + kT · twilight table + disc weight · physical sun disc
  private uKP = uniform(1); private uKT = uniform(0); private uDW = uniform(0);
  private uDisc = uniform(new THREE.Color(0, 0, 0)); private uSunH = uniform(new THREE.Vector2(1, 0)); private uSunDir3 = uniform(new THREE.Vector3(0, 1, 0));
  /** the twilight sky-view table as a texture (RGBA half float, radiance / its irradiance luminance) */
  private lutTex: THREE.DataTexture;
  private atmos = new Map<number, Atmosphere>(); private atmo: Atmosphere | null = null;
  private view: SkyView | null = null; private viewAlt = NaN; private viewTau = NaN;
  private viewJob: { job: SkyViewJob; tau: number } | null = null;
  /** install a finished sky-view table: keep it for the CPU mirror, upload it normalised by its irradiance (half float) */
  private setView(v: SkyView, tau: number) {
    this.view = v; this.viewAlt = v.sunAltDeg; this.viewTau = tau;
    const src = v.data, dst = this.lutTex.image.data as Uint16Array, inv = 1 / Math.max(v.irradianceY, 1e-30);
    for (let i = 0; i < src.length; i++) dst[i] = THREE.DataUtils.toHalfFloat((i & 3) === 3 ? 1 : Math.min(60000, src[i] * inv));
    this.lutTex.needsUpdate = true;
  }
  /** the eye's adaptation beyond the camera's range, applied to the sky's lights (D-117) */
  gain = 1;
  /** illuminance on the ground in lux (sun + sky + moon + night sky), clear-sky model with the cloud factors (D-115) */
  lux = 0;
  private coverAt: [number, number] | null = null; private coverFactor = 1;
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
      // squares as x·x: pow() of a negative base is undefined on the GPU (NaN), and TRAA spread those NaNs over the frame
      const sq = (x: any) => x.mul(x);
      const alongC = exp(sq(ld.div(62)).negate()); // brighter toward the centre
      const width = float(7).add(alongC.mul(6)); // the band thickens toward Sagittarius (deg)
      const disk = exp(abs(bd.add(0.5)).div(width).negate()).mul(float(0.35).add(alongC.mul(0.65)));
      const bulge = exp(sq(ld.div(14)).add(sq(bd.add(3).div(10))).negate()).mul(0.9);
      const rift = float(1).sub(exp(sq(bd.sub(1.5).div(2.4)).negate()).mul(smoothstep(-20, -8, ld).mul(float(1).sub(smoothstep(55, 75, ld)))).mul(0.7)); // Great Rift
      const coal = float(1).sub(exp(sq(ld.add(59).div(3)).add(sq(bd.add(1).div(2.5))).negate()).mul(0.8)); // Coalsack (l ≈ 301°)
      const mottle = mx_fractal_noise_float(g.mul(9), int(4), float(2.1), float(0.55)).mul(0.45).add(0.8);
      // perceptual scale (C), set so that at the fully dark-adapted exposure (≈5.7) the zenith sky reads ≈ sRGB 12, the
      // horizon airglow ≈ 35 and the Milky Way core ≈ 60
      const mw = disk.add(bulge).mul(rift).mul(coal).mul(mottle).mul(0.005);
      const alt = max(d.y, 0.0);
      const ext = exp(float(0.25).negate().div(alt.add(0.035))); // extinction by air mass (C)
      const vanRhijn = float(1).div(sqrt(float(1).sub(float(0.972).mul(float(1).sub(alt.mul(alt)))))); // (R/(R+90 km))² = 0.972
      const airglow = vec3(0.0005, 0.00068, 0.00051).mul(vanRhijn).mul(smoothstep(-0.02, 0.03, d.y));
      const warm = mix(vec3(0.85, 0.88, 1.0), vec3(1.0, 0.93, 0.8), alongC);
      return vec4(warm.mul(mw).mul(ext).add(airglow).mul(V), 1);
    })();
    this.milkyWay = new THREE.Mesh(new THREE.SphereGeometry(DOME * 0.92, 64, 32), mwMat);
    this.milkyWay.frustumCulled = false; this.milkyWay.renderOrder = -9.5;
    this.milkyWay.userData = { tier: 'C', src: 'RECON', note: 'Milky Way position A (galactic frame, precessed); brightness structure and airglow C (procedural, perceptual)' };
    scene.add(this.milkyWay);
    this.sky.scale.setScalar(DOME * 0.95);
    this.sky.turbidity.value = 3; this.sky.rayleigh.value = 1.2; this.sky.mieCoefficient.value = 0.004; this.sky.mieDirectionalG.value = 0.8;
    this.sky.userData = { tier: 'B', src: 'RECON', note: 'Preetham analytic sky by day (three SkyMesh); below +10° a spectral spherical-atmosphere model (Bruneton 2017 constants, Hillaire 2020 multiple scattering: Earth\'s shadow, antitwilight arch, glow; aerosol amount C); both calibrated to the USNO-C171 skylight (D-060, D-115, D-116)' };
    this.sky.frustumCulled = false;
    // SkyMesh pins its depth to 1.0, which is the NEAR plane under reversed-Z (WebGPU path) — draw it first, untested
    const skyMat = this.sky.material as THREE.Material; skyMat.depthTest = false; skyMat.depthWrite = false; this.sky.renderOrder = -10;
    // dome calibrated against the skylight (D-060): kP · Preetham (with its sun disc) + kT · the physical twilight table
    // (D-116; looked up by elevation, √(e / 90°), and azimuth from the sun) + the physical sun disc at low sun
    this.lutTex = new THREE.DataTexture(new Uint16Array(32 * 32 * 4), 32, 32, THREE.RGBAFormat, THREE.HalfFloatType);
    this.lutTex.minFilter = this.lutTex.magFilter = THREE.LinearFilter; this.lutTex.wrapS = this.lutTex.wrapT = THREE.ClampToEdgeWrapping;
    this.lutTex.generateMipmaps = false; this.lutTex.flipY = false; this.lutTex.needsUpdate = true;
    { const cn = (skyMat as any).colorNode;
      const d = normalize(positionWorld.sub(cameraPosition));
      const e = asin(clamp(d.y, 0, 1)), v = sqrt(e.div(Math.PI / 2));
      const hl = vec2(d.x, d.z), hn = hl.div(max(length(hl), 1e-5));
      const u = acos(clamp(dot(hn, this.uSunH), -1, 1)).div(Math.PI);
      const T = texture(this.lutTex, vec2(u, v)).rgb;
      const ca = Math.cos(SUN_ANGULAR_RADIUS), cb = Math.cos(SUN_ANGULAR_RADIUS * 1.3);
      const disc = smoothstep(cb, ca, dot(d, this.uSunDir3));
      (skyMat as any).colorNode = vec4(cn.xyz.mul(this.uKP).add(T.mul(this.uKT)).add((this.uDisc as any).mul(disc.mul(this.uDW))), 1); }
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

  update(jdUT: number, camPos: THREE.Vector3, cloudCover: number, haze: number, wind?: { ms: number; fromDeg: number; tSeconds: number }, view?: THREE.Vector3) {
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
    // ---- light levels (D-115, D-117) -----------------------------------------------------------------------------------
    // USNO Circular 171 clear-sky illuminance for the sun (direct beam), the sky and the moon, with the session-3 cloud
    // factors (C) and a night-sky floor (starlight and airglow, 0.0005 lx). Renderer units keep the session-3 values for
    // the zenith sun (sun 3.2 · exp(−k), skylight 0.98) and the USNO ratios to them everywhere else; the eye's adaptation
    // beyond the camera's range multiplies all of them (the sky gain, exposure.ts).
    const k = extinctionK(haze), alt = s.altitude, sinA = Math.max(0, Math.sin((alt * Math.PI) / 180)), sinM = Math.max(0, Math.sin((mo.altitude * Math.PI) / 180));
    const sunN = sunNormalLux(alt, k) * smoothstepJS(-0.5, 0.5, alt) * (1 - 0.75 * cloudCover); // the disc crosses the horizon over ~0.5° (C)
    const ml = moonLux(elongationFromFraction(ph.fraction), mo.altitude);
    const moonN = ml.normal * (1 - 0.8 * cloudCover);
    const skyL = (skyLux(alt) + ml.sky + NIGHT_LUX) * (1 - 0.3 * cloudCover);
    this.lux = sunN * sinA + skyL + moonN * sinM;
    const sunI = sunN * REN_PER_LUX_SUN, hemiI = skyL * REN_PER_LUX_SKY, moonI = moonN * REN_PER_LUX_SUN;
    this.gain = skyGain(sunI * sinA + hemiI * 0.8 + moonI * 0.3, this.lux); // the exposure estimate's weights (main.ts)
    const G = this.gain;
    // ---- the physical atmosphere (D-116): sun colour, cloud light at the cloud's height, twilight dome ----------------------
    // aerosol depth in steps of 0.01, each model built once (~0.3 s) and kept; with the sun above 15° only the sun's colour
    // uses it, so a haze change waits until the sun is low (no rebuild hitches through a dusty day)
    const tau = Math.round(aerosolTauFor(k) / 0.01) * 0.01;
    if (!this.atmo || (Math.abs(this.atmo.aerosolTau - tau) > 1e-6 && (alt < 15 || this.atmos.has(tau)))) {
      let a = this.atmos.get(tau); if (!a) { a = new Atmosphere(tau); this.atmos.set(tau, a); if (this.atmos.size > 12) this.atmos.delete(this.atmos.keys().next().value!); }
      this.atmo = a;
    }
    const A = this.atmo, sc = A.sunColorAt(OBSERVER_ALT, alt), scM = Math.max(sc[0], sc[1], sc[2]);
    if (scM > 1e-6) this.sun.color.setRGB(Math.max(0, sc[0]) / scM, Math.max(0, sc[1]) / scM, Math.max(0, sc[2]) / scM); // reddened by the air mass (spectral transmittance)
    this.sun.intensity = G * sunI;
    this.sun.position.copy(camPos).addScaledVector(this.state.sunDir, 800);
    this.sun.target.position.copy(camPos);
    this.sun.visible = alt > -1;
    this.moonLight.intensity = G * moonI; // colour: a perceptual blue (Purkinje shift, C)
    this.moonLight.position.copy(camPos).addScaledVector(this.state.moonDir, 800); this.moonLight.target.position.copy(camPos);
    this.twilight = smoothstepJS(-14, 4, alt);
    this.hemi.intensity = G * hemiI;
    // twilight dome table: recomputed when the sun has moved 0.05° (12–25 ms), clamped to −12° (below, the single-
    // scattering sky has no structure left and the night dome takes over)
    // (12–25 ms for the whole table: after a jump in time, or on the first frame, it is built at once; while the sun moves
    // it is rebuilt 4 rows per frame (~2–3 ms) in a back buffer and swapped when complete)
    const w = twilightWeight(alt), vAlt = Math.max(-12, Math.min(TW_HI, alt));
    if (w > 0) {
      const stale = !this.view || this.viewTau !== tau || Math.abs(vAlt - this.viewAlt) > 1;
      if (stale) { this.viewJob = null; this.setView(A.skyView(vAlt), tau); }
      else if (this.viewJob) { if (A.stepSkyView(this.viewJob.job, 4)) { this.setView(this.viewJob.job.view, this.viewJob.tau); this.viewJob = null; } }
      else if (Math.abs(vAlt - this.viewAlt) > 0.05) this.viewJob = { job: A.beginSkyView(vAlt), tau };
    }
    // skylight colour: the session-3 day colour by day, the physical sky's irradiance colour in twilight, the session-3
    // night blue at night; its luminance is kept at the day colour's 0.796 so hemi.intensity · 0.8 stays the illuminance
    { const dayC = [0.75, 0.8, 0.9], nightC = [0.55, 0.62, 0.8], twC = this.view && w > 0 ? this.view.irradiance.map(x => x / Math.max(this.view!.irradianceY, 1e-30)) : dayC;
      const Yc = (c: number[]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
      const nd = dayC.map(x => x / Yc(dayC)), nn = nightC.map(x => x / Yc(nightC)), nt = twC.map(x => x / Yc(twC));
      const c = [0, 1, 2].map(i => ((1 - w) * nd[i] + w * nt[i]) * (1 - night) + nn[i] * night);
      const y = Yc(c); this.hemi.color.setRGB((0.796 * c[0]) / y, (0.796 * c[1]) / y, (0.796 * c[2]) / y); }
    // volumetric clouds: cover, light, wind drift (the wind blows FROM windDir: clouds move the opposite way). Sunlight at
    // the cloud base and top: the spherical atmosphere's transmittance from those heights, so low sun lights the deck from
    // below, reddened, until the sun sets for the cloud (~1.3–2° below the ground's horizon at 1.5–3.6 km).
    const C = this.clouds; C.mesh.position.copy(camPos); C.sunDir.value.copy(this.state.sunDir);
    const moonC = new THREE.Color(0.55, 0.6, 0.75).multiplyScalar(this.moonLight.intensity * 0.5), cf = G * (1 - 0.75 * cloudCover);
    { const b = A.sunColorAt(OBSERVER_ALT + CLOUD_BASE, alt), t = A.sunColorAt(OBSERVER_ALT + CLOUD_TOP, alt);
      const p0 = (x: number) => Math.max(0, x) * cf;
      C.sunColor.value.setRGB(p0(b[0]), p0(b[1]), p0(b[2])).add(moonC); C.sunColorTop.value.setRGB(p0(t[0]), p0(t[1]), p0(t[2])).add(moonC); }
    C.ambient.value.copy(this.hemi.color).multiplyScalar(this.hemi.intensity * 0.55);
    // dome calibration and the horizon radiance (D-060, D-116): fog, far cloud haze and rain shafts converge to it
    { const sk = this.sky, P = { turbidity: sk.turbidity.value as number, rayleigh: sk.rayleigh.value as number, mieCoefficient: sk.mieCoefficient.value as number, mieDirectionalG: sk.mieDirectionalG.value as number };
      const hc = this.hemi.color, hemiE = this.hemi.intensity * (0.2126 * hc.r + 0.7152 * hc.g + 0.0722 * hc.b);
      const tw = this.view && w > 0 ? { view: this.view, w } : null;
      const cal = skyCalibration([this.state.sunDir.x, this.state.sunDir.y, this.state.sunDir.z], P, hemiE, night, view?.x ?? 1, view?.z ?? 0, tw);
      this.uKP.value = cal.kP; this.uKT.value = tw ? cal.kT * this.view!.irradianceY : 0;
      this.horizon.setRGB(cal.horizon[0], cal.horizon[1], cal.horizon[2]);
      // the physical sun disc (with the table): the sun's radiance, E / Ω, capped below the half-float range
      const disc = Math.min(30000, this.sun.visible ? this.sun.intensity / (Math.PI * SUN_ANGULAR_RADIUS * SUN_ANGULAR_RADIUS) : 0);
      this.uDisc.value.copy(this.sun.color).multiplyScalar(disc); this.uDW.value = tw ? w * (1 - night) : 0;
      const hs = Math.hypot(this.state.sunDir.x, this.state.sunDir.z) || 1; this.uSunH.value.set(this.state.sunDir.x / hs, this.state.sunDir.z / hs);
      this.uSunDir3.value.copy(this.state.sunDir); }
    C.haze.value.copy(this.horizon);
    if (wind) { const a = ((wind.fromDeg + 180) * Math.PI) / 180; C.wind.value.set(Math.sin(a) * wind.ms * 2.5, -Math.cos(a) * wind.ms * 2.5); C.time.value = wind.tSeconds; } // winds aloft ~2.5 × surface (C)
    // cover over THIS observer (D-064): the weather field scales the cover by 0.6–1.4 across its tile, so the uniform is
    // solved for the drifted field around the camera (recomputed when the observer or the field has moved > 500 m)
    { const cx = camPos.x + C.wind.value.x * C.time.value, cz = camPos.z + C.wind.value.y * C.time.value;
      if (!this.coverAt || Math.hypot(cx - this.coverAt[0], cz - this.coverAt[1]) > 500) { this.coverAt = [cx, cz]; this.coverFactor = C.mesh.visible ? localWeatherFactor(cx, cz) : 1; }
      C.coverage.value = localCoverageUniform(cloudCover, (coverTable as any).local, this.coverFactor); }
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
