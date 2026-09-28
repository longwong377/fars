// The eye's upward rays against the architecture (main.ts skyVisibility, eye adaptation; D-337, B125). three's Raycaster
// tests every triangle of every merged mesh whose bounding sphere the (unbounded) ray meets: 11-61 ms for the 9 rays in
// the court and the Apadana hall (tools/dev/eyeray_cost.ts), every 0.25 s in play and every frame in a test render. Here
// the same question — does a ray of length `far` hit any mesh of the group? — is answered with a bounding-volume
// hierarchy per geometry (three-mesh-bvh, MIT; built on first use, rebuilt when the positions change), the ray clipped to
// its length before any mesh is visited, and the first hit ending the search. Same geometry, same sides, same answer
// (tests/eye_rays.test.ts compares it with three's Raycaster).
import * as THREE from 'three/webgpu';
import { MeshBVH } from 'three-mesh-bvh';

const bvhs = new WeakMap<THREE.BufferGeometry, { bvh: MeshBVH; ver: number }>();
function bvhOf(g: THREE.BufferGeometry): MeshBVH {
  const pa: any = g.attributes.position, ver = (pa.version ?? pa.data?.version ?? 0) + (g.index ? g.index.version * 1e6 : 0);
  let e = bvhs.get(g);
  if (!e || e.ver !== ver) { e = { bvh: new MeshBVH(g as any, { maxLeafSize: 12, indirect: true } as any), ver }; bvhs.set(g, e); }
  return e.bvh;
}
const _inv = new THREE.Matrix4(), _m = new THREE.Matrix4(), _ray = new THREE.Ray(), _sph = new THREE.Sphere(), _box = new THREE.Box3(), _p = new THREE.Vector3(), _end = new THREE.Vector3();
const _world = new THREE.Ray(), _hitW = new THREE.Vector3();
const _rc = new THREE.Raycaster(), _hits: THREE.Intersection[] = [];

/** the segment origin → origin + dir·far meets the sphere */
function segHitsSphere(o: THREE.Vector3, d: THREE.Vector3, far: number, s: THREE.Sphere) {
  _p.subVectors(s.center, o); const t = Math.min(far, Math.max(0, _p.dot(d)));
  return _end.copy(d).multiplyScalar(t).add(o).distanceToSquared(s.center) <= s.radius * s.radius;
}
/** a hit of the local-space ray within world distance far (a mesh with matrix m) */
function meshHit(g: THREE.BufferGeometry, mat: any, m: THREE.Matrix4, far: number): boolean {
  if (!g.boundingSphere) g.computeBoundingSphere();
  _sph.copy(g.boundingSphere!).applyMatrix4(m); if (!segHitsSphere(_world.origin, _world.direction, far, _sph)) return false;
  _inv.copy(m).invert(); _ray.copy(_world).applyMatrix4(_inv);
  if (!g.boundingBox) g.computeBoundingBox();
  if (!_ray.intersectsBox(g.boundingBox!)) return false;
  const h = bvhOf(g).raycastFirst(_ray as any, mat as any);
  if (!h) return false;
  _hitW.copy(h.point as any).applyMatrix4(m);
  return _hitW.distanceTo(_world.origin) <= far;
}
/** does the ray (origin, unit dir) hit any mesh under `root` within `far`? (visibility ignored, as three's Raycaster) */
export function rayHitsAny(root: THREE.Object3D, origin: THREE.Vector3, dir: THREE.Vector3, far: number): boolean {
  _world.origin.copy(origin); _world.direction.copy(dir);
  let hit = false;
  const visit = (o: any): void => {
    if (hit) return;
    if ((o.layers.mask & 1) === 0) { /* three's Raycaster skips an object off layer 0 (its children are still visited) */ }
    else if (o.isInstancedMesh && o.geometry?.attributes?.position && !o.morphTargetInfluences) {
      const g = o.geometry; if (!g.boundingSphere) g.computeBoundingSphere();
      if (o.boundingSphere === null) o.computeBoundingSphere();
      _sph.copy(o.boundingSphere).applyMatrix4(o.matrixWorld);
      if (segHitsSphere(_world.origin, _world.direction, far, _sph)) for (let i = 0; i < o.count && !hit; i++) { o.getMatrixAt(i, _m); _m.premultiply(o.matrixWorld); if (meshHit(g, o.material, _m, far)) hit = true; }
    } else if (o.isMesh && !o.isInstancedMesh && !o.isBatchedMesh && !o.isSkinnedMesh && !o.morphTargetInfluences && o.geometry?.attributes?.position) {
      if (o.geometry.drawRange.count === Infinity || o.geometry.drawRange.count >= (o.geometry.index?.count ?? o.geometry.attributes.position.count)) { if (meshHit(o.geometry, o.material, o.matrixWorld, far)) hit = true; }
      else hit = fallback(o, far);
    } else if (o.raycast && (o.isMesh || o.isLine || o.isPoints || o.isSprite)) hit = fallback(o, far);
    if (!hit) for (const c of o.children) visit(c);
  };
  visit(root);
  return hit;
}
function fallback(o: THREE.Object3D, far: number) {
  _rc.set(_world.origin, _world.direction); _rc.far = far; _hits.length = 0; o.raycast(_rc, _hits); return _hits.some(h => h.distance <= far);
}
void _box;
