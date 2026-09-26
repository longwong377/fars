// The planets (session 9; both gap hunters: "no planets"): Mercury, Venus, Mars, Jupiter and Saturn where astronomy-engine puts
// them over Pārsa (apparent topocentric place with refraction, its ΔT: A), at the brightness its illumination model gives
// (visual magnitude: A), each appearing as the twilight darkens enough for its magnitude (C: a limit of the sky's brightness by
// the sun's depression, ~ −2° for Venus at −4 mag, −8° for a 1st-magnitude planet) and hidden by cloud as the stars are.
import * as THREE from 'three/webgpu';
import * as A from 'astronomy-engine';
import { vec4, attribute, float, uniform } from 'three/tsl';
import { bodyHorizon, azAltToWorld, timeFromJD } from './ephemeris';

export const PLANETS: { body: A.Body; name: string; rgb: [number, number, number] }[] = [
  { body: A.Body.Mercury, name: 'Mercury', rgb: [1.0, 0.95, 0.86] }, { body: A.Body.Venus, name: 'Venus', rgb: [1.0, 0.98, 0.92] },
  { body: A.Body.Mars, name: 'Mars', rgb: [1.0, 0.62, 0.42] }, { body: A.Body.Jupiter, name: 'Jupiter', rgb: [1.0, 0.95, 0.85] },
  { body: A.Body.Saturn, name: 'Saturn', rgb: [1.0, 0.9, 0.7] },
];
/** the sun's altitude (deg) below which a point of magnitude `mag` shows against the twilight sky (C) */
export const planetShowsBelow = (mag: number) => -2 - 1.2 * (mag + 4);
/** brightness on the stars' scale (skySystem: min(1.5, 10^(−0.4 (m − 1))) · 0.9 + 0.05); above the stars' cap it grows with the log
 *  of the flux, so Venus (−4) stays well above Jupiter (−2) without blinding (C) */
export const planetBright = (mag: number) => { const x = Math.pow(10, -0.4 * (mag - 1)); return (x <= 1.5 ? x : 1.5 + 1.5 * Math.log10(x / 1.5)) * 0.9 + 0.05; };
export function planetsAt(jdUT: number) {
  const t = timeFromJD(jdUT);
  return PLANETS.map(p => { const h = bodyHorizon(p.body, jdUT), mag = A.Illumination(p.body, t).mag; return { name: p.name, rgb: p.rgb, az: h.azimuth, alt: h.altitude, mag }; });
}
export class Planets {
  readonly points: THREE.Points;
  readonly clouds = uniform(1);
  private pos = new Float32Array(PLANETS.length * 3); private col = new Float32Array(PLANETS.length * 3); private size = new Float32Array(PLANETS.length);
  private lastJD = -1; state: ReturnType<typeof planetsAt> = [];
  constructor(private radius: number) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('pcol', new THREE.BufferAttribute(this.col, 3)); g.setAttribute('psize', new THREE.BufferAttribute(this.size, 1));
    const m = new THREE.PointsNodeMaterial({ transparent: false, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, fog: false, sizeAttenuation: false });
    m.colorNode = vec4(attribute('pcol', 'vec3').mul(this.clouds), float(1)); m.sizeNode = attribute('psize', 'float');
    this.points = new THREE.Points(g, m); this.points.frustumCulled = false; this.points.renderOrder = -8.8; this.points.name = 'planets';
    this.points.userData = { tier: 'A', src: 'ASTRONOMY-ENGINE', note: 'the planets: positions and magnitudes from astronomy-engine for 467 BCE (A); the twilight limit per magnitude C' };
  }
  /** jdUT; the camera (the dome's centre); the sun's altitude; the sky's cloud cover (0..1) */
  update(jdUT: number, camPos: THREE.Vector3, sunAlt: number, cloud: number) {
    this.points.position.copy(camPos); this.clouds.value = 1 - 0.9 * cloud;
    if (Math.abs(jdUT - this.lastJD) > 1 / 1440) { this.lastJD = jdUT; this.state = planetsAt(jdUT); } // (re-placed each world minute)
    this.state.forEach((p, i) => { const w = azAltToWorld(p.az, p.alt); this.pos.set([w[0] * this.radius, w[1] * this.radius, w[2] * this.radius], i * 3);
      const lim = planetShowsBelow(p.mag), vis = p.alt > -0.5 ? Math.min(1, Math.max(0, (lim - sunAlt) / 2)) : 0, b = planetBright(p.mag) * vis;
      this.col.set([p.rgb[0] * b, p.rgb[1] * b, p.rgb[2] * b], i * 3); this.size[i] = 1 + Math.min(2.5, planetBright(p.mag) * 0.4); });
    const g = this.points.geometry; (g.attributes.position as THREE.BufferAttribute).needsUpdate = true; (g.attributes.pcol as THREE.BufferAttribute).needsUpdate = true; (g.attributes.psize as THREE.BufferAttribute).needsUpdate = true;
  }
}
