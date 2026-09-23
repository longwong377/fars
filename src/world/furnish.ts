// Furnishings (Phase 4): the stored goods on the benches of the Treasury's Hall of 99 Columns. The object types are
// those reported among the Treasury finds (treasury.stored_goods, ISAC-FINDS: B); their number, arrangement and exact
// forms are reconstruction (C). Instanced per type; render-only (the benches under them are the collidable parts).
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { v } from '../arch/spec';
import { Rng } from '../core/rng';

const lathe = (pts: [number, number][], seg = 16) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const strip = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; };
/** simple period forms (C): profiles as radius/height pairs in metres */
const FORMS: Record<string, () => THREE.BufferGeometry> = {
  alabaster_vessel: () => lathe([[0, 0], [0.05, 0], [0.07, 0.04], [0.075, 0.14], [0.05, 0.2], [0.025, 0.24], [0.035, 0.26], [0, 0.26]]), // alabastron-like bottle
  blue_vessel: () => lathe([[0, 0], [0.04, 0], [0.09, 0.03], [0.1, 0.07], [0.085, 0.09], [0, 0.09]]), // bowl
  chert_set: () => mergeGeometries([strip(lathe([[0, 0], [0.09, 0], [0.1, 0.06], [0.07, 0.07], [0, 0.07]])), strip(new THREE.CylinderGeometry(0.018, 0.022, 0.16, 8).rotateZ(1.2).translate(0.02, 0.1, 0))])!, // mortar + pestle
  arrow_bundle: () => new THREE.CylinderGeometry(0.05, 0.05, 0.75, 10).rotateZ(Math.PI / 2).translate(0, 0.05, 0), // bundle lying on the bench
  sealed_jar: () => lathe([[0, 0], [0.07, 0], [0.13, 0.12], [0.12, 0.3], [0.06, 0.36], [0.065, 0.4], [0, 0.4]]),
};
const COLOURS: Record<string, [number, number, number, number]> = { // sRGB albedo, roughness
  alabaster_vessel: [0.86, 0.82, 0.72, 0.3], blue_vessel: [0.13, 0.28, 0.62, 0.35], chert_set: [0.3, 0.38, 0.31, 0.45], arrow_bundle: [0.62, 0.55, 0.38, 0.8], sealed_jar: [0.6, 0.42, 0.3, 0.85],
};

export function buildTreasuryGoods(benches: number[][], seed = 1): THREE.Group {
  const group = new THREE.Group(); group.name = 'treasury_goods';
  const goods = v<{ item: string; share: number; note: string }[]>('treasury', 'stored_goods');
  const rng = new Rng(seed, 'treasury-goods');
  const slots: { x: number; z: number; y: number; along: number; rot: number }[] = [];
  for (const [cx, cy, sx, sy, top] of benches) { // two rows along each bench, ~0.35 m apart
    const alongX = sx > sy, len = Math.max(sx, sy), depth = Math.min(sx, sy);
    for (let a = -len / 2 + 0.2; a < len / 2 - 0.2; a += 0.35) for (const r of [-0.25, 0.25]) {
      if (rng.chance(0.12)) continue; // gaps where something has been taken out
      const e = cx + (alongX ? a : r * depth / 0.8), n = cy + (alongX ? r * depth / 0.8 : a);
      slots.push({ x: e, z: -n, y: top, along: alongX ? 0 : Math.PI / 2, rot: rng.range(-0.3, 0.3) });
    }
  }
  // assign item types by share, deterministically
  const counts = goods.map(g => Math.round(g.share * slots.length));
  const order: string[] = goods.flatMap((g, i) => Array(counts[i]).fill(g.item));
  for (let i = order.length - 1; i > 0; i--) { const j = rng.int(0, i); [order[i], order[j]] = [order[j], order[i]]; }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
  for (const g of goods) {
    const idx = order.map((it, i) => (it === g.item ? i : -1)).filter(i => i >= 0 && i < slots.length);
    if (!idx.length || !FORMS[g.item]) continue;
    const [r, gg, b, rough] = COLOURS[g.item];
    const mat = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(r, gg, b, THREE.SRGBColorSpace), roughness: rough, metalness: 0 });
    const im = new THREE.InstancedMesh(FORMS[g.item](), mat, idx.length);
    idx.forEach((k, i) => { const sl = slots[k]; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), sl.along + sl.rot); m4.compose(new THREE.Vector3(sl.x, sl.y, sl.z), q, s); im.setMatrixAt(i, m4); });
    im.castShadow = true; im.receiveShadow = true; im.name = `treasury:${g.item}`;
    im.userData = { tier: 'B', src: 'ISAC-FINDS', note: `${g.note}; number, form and placement C` };
    im.computeBoundingSphere(); group.add(im);
  }
  return group;
}
