// The smoke layer over the town's quarters and the villages of the plain (D-220; brief §1.1 "smoke rising from the town at
// dusk as lamps are lit", §5.4 "a haze over the town at dusk"). One instanced box per settlement (hearthSmoke.ts SmokeCell),
// oriented along the wind: the settlement's footprint and the tail its smoke drifts into. The fragment shader integrates
// the extinction along the view ray through the box — the layer's vertical profile e^(−h/H1) − e^(−h/H2) exactly over six
// segments, the footprint and tail profile and a slow noise at each segment's middle — and draws the smoke's single-scattered
// skylight and sun with opacity 1 − e^(−τ). The ray ends at the box or the ground plane fitted under it (the houses and
// trees inside the layer are not seen by it: small, C). Seen from outside, the box's front faces are drawn (the depth test
// keeps what stands in front); from inside a box (walking in a smoky quarter), its back faces with the ray starting at
// the eye. Two draw calls (the second only while the eye is inside a box). CPU mirror: hearthSmoke.ts cellTau.
import * as THREE from 'three/webgpu';
import { colourOnly } from '../render/fx';
import { attribute, vec3, float, cameraPosition, positionWorld, positionGeometry, normalize, dot, pow, cos, sin, min, max, abs, exp, step, mix, smoothstep, clamp, mx_noise_float, uniform } from 'three/tsl';
import { smokeSkyRadiance, FIRE_RGB, type SmokeSky } from './fire';
import type { SmokeCell } from './hearthSmoke';

/** debug (?smokedbg): the layer drawn solid blue wherever its optical depth exceeds 0.01 */
const SMOKE_DBG = typeof location !== 'undefined' && new URLSearchParams(location.search).has('smokedbg');
/** the smoke's single-scattering albedo and Henyey–Greenstein asymmetry (C: biomass smoke, forward-scattering), as fire.ts */
const OMEGA = 0.9, G = 0.6;
export const LAND_SMOKE_MAX = 96;
/** is world point p inside a cell's box? (the eye decides which mesh draws the cell) */
export function insideCell(c: SmokeCell, p: { x: number; y: number; z: number }): boolean {
  const ca = Math.cos(c.angle), sa = Math.sin(c.angle), dx = p.x - c.cx, dz = p.z - c.cz, x = dx * ca + dz * sa, z = -dx * sa + dz * ca, E = Math.min(60, c.Rw * 0.5);
  return x > -c.R - E && x < c.R + c.tail && Math.abs(z) < c.Rw + E && p.y > c.y0 && p.y < c.y1;
}
export class LandSmoke {
  readonly group = new THREE.Group();
  private geo: THREE.InstancedBufferGeometry; private a: THREE.InstancedBufferAttribute[]; private inA: THREE.InstancedBufferAttribute;
  private front: THREE.Mesh; private back: THREE.Mesh;
  private uSky = uniform(new THREE.Color(0.3, 0.3, 0.3)); private uSun = uniform(new THREE.Color(0, 0, 0)); private uSunDir = uniform(new THREE.Vector3(0, 1, 0));
  /** D-227: the fires' colour (~1900 K, fire.ts) × the sky's fire scale (their light is pre-exposed for night, D-117) */
  private uFire = uniform(new THREE.Color(0, 0, 0)); private fireA: THREE.InstancedBufferAttribute;
  /** cells drawn in the last update, and how many of them hold the eye */
  count = 0; inside = 0;
  constructor() {
    this.group.name = 'landsmoke';
    const box = new THREE.BoxGeometry(1, 1, 1), g = new THREE.InstancedBufferGeometry();
    g.index = box.index; g.setAttribute('position', box.getAttribute('position'));
    this.a = [0, 1, 2, 3].map(k => { const at = new THREE.InstancedBufferAttribute(new Float32Array(LAND_SMOKE_MAX * 4), 4); at.setUsage(THREE.DynamicDrawUsage); g.setAttribute(`s${k}`, at); return at; });
    this.inA = new THREE.InstancedBufferAttribute(new Float32Array(LAND_SMOKE_MAX), 1); g.setAttribute('sIn', this.inA);
    this.fireA = new THREE.InstancedBufferAttribute(new Float32Array(LAND_SMOKE_MAX), 1); this.fireA.setUsage(THREE.DynamicDrawUsage); g.setAttribute('sFire', this.fireA);
    g.instanceCount = 0; this.geo = g;
    const s0 = attribute('s0', 'vec4'), s1 = attribute('s1', 'vec4'), s2 = attribute('s2', 'vec4'), s3 = attribute('s3', 'vec4');
    // s0 = (cx, cz, angle, gy0), s1 = (gx, gz, R, Rw), s2 = (tail, Ld, H1, H2), s3 = (sigma, y0, y1, seed)
    const R = s1.z, Rw = s1.w, E = min(float(60), Rw.mul(0.5)), ca = cos(s0.z), sa = sin(s0.z);
    const pg = positionGeometry;
    const lx = mix(R.add(E).negate(), R.add(s2.x), pg.x.add(0.5)), ly = mix(s3.y, s3.z, pg.y.add(0.5)), lz = pg.z.mul(2).mul(Rw.add(E));
    const world = vec3(s0.x.add(lx.mul(ca)).sub(lz.mul(sa)), ly, s0.y.add(lx.mul(sa)).add(lz.mul(ca)));
    // the ray in the cell's frame (x along the wind, z across, y up)
    const rd = normalize(positionWorld.sub(cameraPosition));
    const dx0 = cameraPosition.x.sub(s0.x), dz0 = cameraPosition.z.sub(s0.y);
    const ox = dx0.mul(ca).add(dz0.mul(sa)), oz = dz0.mul(ca).sub(dx0.mul(sa)), oy = cameraPosition.y;
    const dx = rd.x.mul(ca).add(rd.z.mul(sa)), dz = rd.z.mul(ca).sub(rd.x.mul(sa)), dy = rd.y;
    const nz = (v: any) => mix(v, float(1e-6), step(abs(v), 1e-6)); // never divide by zero
    const slab = (o: any, d: any, lo: any, hi: any) => { const i = float(1).div(nz(d)), a = lo.sub(o).mul(i), b = hi.sub(o).mul(i); return [min(a, b), max(a, b)]; };
    const [xa, xb] = slab(ox, dx, R.add(E).negate(), R.add(s2.x)), [ya, yb] = slab(oy, dy, s3.y, s3.z), [za, zb] = slab(oz, dz, Rw.add(E).negate(), Rw.add(E));
    const tn = max(max(xa, ya), za), tf = min(min(xb, yb), zb);
    const h0 = oy.sub(s0.w.add(s1.x.mul(ox)).add(s1.y.mul(oz))), hd = dy.sub(s1.x.mul(dx).add(s1.y.mul(dz)));
    const tg = h0.negate().div(min(hd, float(-1e-6))); // where the ray meets the ground plane (when it descends)
    const t0 = max(tn, float(0)), t1 = mix(tf, min(tf, tg), step(hd, float(0))), L = max(t1.sub(t0), float(0));
    const H1 = s2.z, H2 = s2.w, Ld = s2.y, hdS = nz(hd);
    const I = (ha: any, hb: any, dt: any, H: any) => {
      const ex = exp(ha.negate().div(H)).sub(exp(hb.negate().div(H))).mul(H).div(hdS), mid = exp(ha.add(hb).mul(-0.5).div(H)).mul(dt);
      return mix(mid, ex, step(float(1e-3).mul(H), abs(hd.mul(dt))));
    };
    let sum: any = float(0); const N = 6, dt = L.div(N);
    for (let k = 0; k < N; k++) {
      const ta = t0.add(dt.mul(k)), tb = ta.add(dt), tm = ta.add(dt.mul(0.5));
      const ha = max(h0.add(ta.mul(hd)), float(0)), hb = max(h0.add(tb.mul(hd)), float(0));
      const xm = ox.add(tm.mul(dx)), zm = oz.add(tm.mul(dz));
      const across = float(1).sub(smoothstep(Rw.sub(E), Rw.add(E), abs(zm))), up = smoothstep(R.add(E).negate(), E.sub(R), xm);
      const ramp = clamp(xm.add(R).div(R.mul(2)), 0, 1).mul(0.65).add(0.35), tail = exp(max(xm.sub(R), float(0)).negate().div(Ld));
      const noise = mx_noise_float(vec3(xm.div(140), zm.div(140), s3.w)).mul(0.4).add(1); // patchy (C)
      sum = sum.add(I(ha, hb, dt, H1).sub(I(ha, hb, dt, H2)).mul(across).mul(up).mul(ramp).mul(tail).mul(noise));
    }
    const tau = s3.x.mul(max(sum, float(0)));
    const cosT = dot(rd, this.uSunDir), hg = float((1 - G * G) / (4 * Math.PI)).div(pow(float(1 + G * G).sub(cosT.mul(2 * G)), 1.5));
    // D-227: the town's fire light from below (sFire: renderer irradiance at fire scale 1, the lit fires' light escaping their
    // courts upward over the footprint; hearthSmoke.ts cellFireE), scattered toward the eye: light travelling up, seen along rd
    const cosF = rd.y.negate(), hgF = float((1 - G * G) / (4 * Math.PI)).div(pow(float(1 + G * G).sub(cosF.mul(2 * G)), 1.5));
    const fireIn = (this.uFire as any).mul(attribute('sFire', 'float')).mul(hgF);
    const colour = (this.uSky as any).add((this.uSun as any).mul(hg)).add(fireIn).mul(OMEGA), alpha = float(1).sub(exp(tau.negate()));
    const mk = (side: THREE.Side, pos: any, name: string) => {
      const m = colourOnly(new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false, side }));
      m.positionNode = pos; m.colorNode = SMOKE_DBG ? vec3(0, 0, 1) : colour; m.opacityNode = SMOKE_DBG ? step(0.01, tau).mul(0.8) : alpha;
      const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.name = name; mesh.visible = false;
      mesh.userData = { tier: 'C', src: 'RECON;PEOPLE-SIM', note: 'smoke layer over the town\'s quarters and the villages (D-220): the smoke of what their households burn now — the people sim\'s household day (the evening meal before sunset, the fire lit 0.35 h before it, breakfast, baking days: C hours, Q-064), dung cake and brushwood fuel (C), emission factors and smoke optics (C, recollection, NOT SEEN) — gathered under the dusk and dawn inversion (layer peak ~14 m, C), ventilated by the wind and diluted in ~40 min (C), drifting downwind' };
      this.group.add(mesh); return mesh;
    };
    this.front = mk(THREE.FrontSide, world, 'landsmoke:outside'); this.back = mk(THREE.BackSide, world.mul(attribute('sIn', 'float')), 'landsmoke:inside');
  }
  setSkyLight(sky: SmokeSky | null | undefined) {
    if (!sky?.horizon || !sky.sun) return; smokeSkyRadiance(sky, this.uSky.value);
    this.uSun.value.copy(sky.sun.color).multiplyScalar(sky.sun.visible ? sky.sun.intensity : 0); this.uSunDir.value.copy(sky.state.sunDir);
    this.uFire.value.copy(FIRE_RGB).multiplyScalar(sky.fireScale ?? 1);
  }
  /** draw these cells for an eye at `eye` (world) */
  update(cells: SmokeCell[], eye: { x: number; y: number; z: number }) {
    const n = Math.min(LAND_SMOKE_MAX, cells.length); let inside = 0;
    for (let i = 0; i < n; i++) { const c = cells[i];
      this.a[0].setXYZW(i, c.cx, c.cz, c.angle, c.gy0); this.a[1].setXYZW(i, c.gx, c.gz, c.R, c.Rw);
      this.a[2].setXYZW(i, c.tail, c.Ld, c.H1, c.H2); this.a[3].setXYZW(i, c.sigma, c.y0, c.y1, c.seed); this.fireA.setX(i, c.fireE ?? 0);
      const inn = insideCell(c, eye) ? 1 : 0; this.inA.setX(i, inn); inside += inn; }
    for (const at of this.a) at.needsUpdate = true; this.inA.needsUpdate = true; this.fireA.needsUpdate = true;
    this.geo.instanceCount = n; this.count = n; this.inside = inside;
    this.front.visible = n > 0; this.back.visible = inside > 0;
  }
}
