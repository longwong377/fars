// s18 C14 (D-790): reins and lead ropes: a thin leather strip from a rider's, driver's or leader's hand to each animal's bit
// (animals.bitAt), sagging a little at the middle (two segments), all of them one instanced draw. C: rawhide or leather reins,
// a rope halter for the pack strings.
import * as THREE from 'three/webgpu';
export const REIN = { width: 0.012, thick: 0.006, sag: 0.07, colour: [0.22, 0.15, 0.1] as [number, number, number], cap: 512 };
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _m = new THREE.Vector3(), _d = new THREE.Vector3(), _q = new THREE.Quaternion(), _z = new THREE.Vector3(0, 0, 1), _M = new THREE.Matrix4(), _s = new THREE.Vector3();
export class Reins {
  readonly mesh: THREE.InstancedMesh; private n = 0; dropped = 0;
  constructor(cap = REIN.cap) {
    const g = new THREE.BoxGeometry(REIN.width, REIN.thick, 1).translate(0, 0, 0.5);
    const mat = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(...REIN.colour), roughness: 0.8 });
    this.mesh = new THREE.InstancedMesh(g, mat, cap); this.mesh.count = 0; this.mesh.visible = false; this.mesh.castShadow = false; this.mesh.receiveShadow = true;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.mesh.frustumCulled = false; this.mesh.name = 'people:reins';
    this.mesh.userData = { tier: 'C', src: 'RECON', note: 'reins and lead ropes from the hand to the bit (s18 C14, D-790)' }; this.mesh.raycast = () => {};
  }
  begin() { this.n = 0; this.dropped = 0; }
  /** a rein from the hand `h` to the bit `b` (world), sagging between */
  push(h: ArrayLike<number>, b: ArrayLike<number>) {
    if (this.n + 2 > this.mesh.instanceMatrix.count) { this.dropped++; return; }
    _a.set(h[0], h[1], h[2]); _b.set(b[0], b[1], b[2]); const L = _a.distanceTo(_b); if (L < 0.05 || L > 8) return;
    _m.addVectors(_a, _b).multiplyScalar(0.5); _m.y -= REIN.sag * Math.min(1, L / 1.5);
    for (const [p, q] of [[_a, _m], [_m, _b]] as const) { _d.subVectors(q, p); const l = _d.length(); _q.setFromUnitVectors(_z, _d.divideScalar(l)); this.mesh.setMatrixAt(this.n++, _M.compose(p, _q, _s.set(1, 1, l))); }
  }
  end() { this.mesh.count = this.n; this.mesh.visible = this.n > 0; if (this.n) { this.mesh.instanceMatrix.needsUpdate = true; this.mesh.instanceMatrix.clearUpdateRanges(); this.mesh.instanceMatrix.addUpdateRange(0, this.n * 16); } }
}
