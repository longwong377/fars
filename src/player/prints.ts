// s18 C5 (D-695; C12's hole 4-11): the visitor's footprints. Where the stranger walks on earth (the lanes, the plain, the
// courts of the town; not the Terrace's paving), a print is pressed at each step, left and right of the line walked, and
// fades over PRINT_S seconds; deeper and darker when the ground is wet (mud), faint in dry dust. One instanced draw of
// flat decals (a sole's oval, 0.26 × 0.1 m) laid on the ground the feet stand on, a pool of PRINT_N reused oldest first.
// Not done (C): the crowd's own prints (their dust is drawn: dust.ts); prints on snow.
import * as THREE from 'three/webgpu';
import { attribute, float, vec3 } from 'three/tsl';

/** prints kept (the oldest is reused), their life (s) and the stride between prints (m) */
export const PRINT_N = 160, PRINT_S = 240, PRINT_STRIDE = 0.68;
/** the Terrace's paved courts (grid e, n box; above the court datum less 1.5 m): no prints there */
const TERRACE = { e0: -60, e1: 260, n0: -230, n1: 170, yMin: -1.5 };

export class Prints {
  readonly mesh: THREE.InstancedMesh;
  private age: THREE.InstancedBufferAttribute;
  private next = 0; private last: THREE.Vector3 | null = null; private side = 0; private born = new Float32Array(PRINT_N).fill(-1e9);
  private m = new THREE.Matrix4(); private q = new THREE.Quaternion(); private s = new THREE.Vector3(1, 1, 1); private up = new THREE.Vector3(0, 1, 0);
  /** counted: prints pressed */
  pressed = 0;
  constructor() {
    const g = new THREE.CircleGeometry(0.5, 10).rotateX(-Math.PI / 2).scale(0.1, 1, 0.26);
    this.age = new THREE.InstancedBufferAttribute(new Float32Array(PRINT_N * 2), 2); g.setAttribute('pa', this.age); // (strength 0..1, wet 0..1)
    const mat = new THREE.MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
    const pa = attribute('pa', 'vec2');
    // a darkened, slightly cool mark: dry dust lifts a little, mud darkens more
    mat.colorNode = vec3(0.16, 0.13, 0.1).mul(float(1).sub(pa.y.mul(0.4)));
    mat.opacityNode = pa.x.mul(float(0.22).add(pa.y.mul(0.3)));
    mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2;
    this.mesh = new THREE.InstancedMesh(g, mat, PRINT_N); this.mesh.name = 'player:prints'; this.mesh.frustumCulled = false; this.mesh.count = PRINT_N;
    this.m.makeScale(0, 0, 0); for (let i = 0; i < PRINT_N; i++) this.mesh.setMatrixAt(i, this.m);
    this.mesh.userData = { tier: 'C', note: 'the visitor’s footprints in dust and mud (D-695, C)' };
  }
  /** the stranger's body position (world; feet 0.85 m below), the clock (s) and the ground's wetness (0 dry .. 1 mud) */
  step(body: { x: number; y: number; z: number }, time: number, wet = 0) {
    const fx = body.x, fy = body.y - 0.85, fz = body.z, e = fx, n = -fz;
    const paved = e > TERRACE.e0 && e < TERRACE.e1 && n > TERRACE.n0 && n < TERRACE.n1 && fy > TERRACE.yMin;
    if (!this.last) { this.last = new THREE.Vector3(fx, fy, fz); }
    const dx = fx - this.last.x, dz = fz - this.last.z, d = Math.hypot(dx, dz);
    if (d > 6) this.last.set(fx, fy, fz); // (a teleport: no trail)
    else if (d >= PRINT_STRIDE && !paved && Math.abs(fy - this.last.y) < 0.4) {
      const yaw = Math.atan2(dx, dz), sx = Math.cos(yaw), sz = -Math.sin(yaw), o = (this.side ^= 1) ? 0.09 : -0.09, i = this.next;
      this.q.setFromAxisAngle(this.up, yaw); this.m.compose(new THREE.Vector3(fx + sx * o, fy + 0.012, fz + sz * o), this.q, this.s); this.mesh.setMatrixAt(i, this.m);
      this.born[i] = time; this.age.setXY(i, 1, Math.max(0, Math.min(1, wet))); this.next = (i + 1) % PRINT_N; this.pressed++;
      this.mesh.instanceMatrix.needsUpdate = true; this.last.set(fx, fy, fz);
    }
    // fading: the strength falls over PRINT_S (updated a print at a time each frame, all within a few seconds)
    for (let k = 0; k < 8; k++) { const j = (this.next + k * 20 + (this.pressed % 20)) % PRINT_N, b = this.born[j]; if (b < -1e8) continue;
      const f = Math.max(0, 1 - (time - b) / PRINT_S); this.age.setX(j, f); if (f <= 0) { this.born[j] = -1e9; this.m.makeScale(0, 0, 0); this.mesh.setMatrixAt(j, this.m); this.mesh.instanceMatrix.needsUpdate = true; } }
    this.age.needsUpdate = true;
  }
}
