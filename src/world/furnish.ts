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

/** the scribes' room of the Treasury (D-067; treasury.scribes_room, r_scribes_room): filed tablets in two rows along the
 *  benches, a board of fresh tablets drying by the desk, a lump of clay under a damp cloth and reed baskets of tablets on
 *  the floor. Types from the archive practice (IR-TREAS: B); PT tablet form and size, number and arrangement C. */
export function buildScribesRoom(room: number[], shelves: number[][], seed = 1): THREE.Group {
  const group = new THREE.Group(); group.name = 'treasury_scribes_room';
  const R = v<any>('treasury', 'r_scribes_room'), SR = v<any>('treasury', 'scribes_room'), rng = new Rng(seed, 'scribes-room');
  const [tw, th, tt] = R.tablet as number[], fl = room[4];
  const mat = (rgb: [number, number, number], rough: number) => new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(...rgb, THREE.SRGBColorSpace), roughness: rough, metalness: 0 });
  // a PT letter: a rectangular tablet with rounded edges, lying on its face (x = width, z = height, y = thickness)
  const tabletGeo = new THREE.BoxGeometry(tw, tt, th, 2, 1, 2); { const p = tabletGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i); p.setY(i, y * (1 - 0.35 * ((x / (tw / 2)) ** 2 + (z / (th / 2)) ** 2) / 2)); } tabletGeo.computeVertexNormals(); }
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  const filed: THREE.Matrix4[] = [], fresh: THREE.Matrix4[] = [];
  // filed tablets: stood on edge in two rows along each bench, a few gaps (C); baked-dry clay
  for (const [cx, cy, sx, sy, top] of shelves) {
    const alongX = sx > sy, len = Math.max(sx, sy), dep = Math.min(sx, sy), n = Math.floor(len * R.tablets_per_m);
    for (const r of [-0.22, 0.22]) for (let i = 0; i < n; i++) {
      if (rng.chance(0.15)) continue;
      const a = -len / 2 + (i + 0.5) * (len / n), e = cx + (alongX ? a : r * dep), nn = cy + (alongX ? r * dep : a);
      q.setFromAxisAngle(up, (alongX ? 0 : Math.PI / 2) + rng.range(-0.08, 0.08)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2 + rng.range(-0.25, 0.25)));
      filed.push(m4.clone().compose(new THREE.Vector3(e, top + th / 2, -nn), q, one));
    }
  }
  // the drying board by the desk (0.6 × 0.35 m, on the floor to the scribe's right) with fresh tablets lying flat
  const [dx, dy] = SR.desk as number[], hd = (SR.desk_heading * Math.PI) / 180, fwd = [Math.sin(hd), Math.cos(hd)], right = [fwd[1], -fwd[0]];
  const [bw, bd] = R.drying_board as number[], bc = [dx + right[0] * 0.55 + fwd[0] * 0.15, dy + right[1] * 0.55 + fwd[1] * 0.15];
  const board = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.03, bd), mat([0.42, 0.33, 0.24], 0.85));
  board.position.set(bc[0], fl + 0.015, -bc[1]); board.rotation.y = hd; board.name = 'scribes:drying_board'; group.add(board);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { if (rng.chance(0.2)) continue;
    const u = (i - 1.5) * (bw / 4), w = (j - 1) * (bd / 3), e = bc[0] + right[0] * u + fwd[0] * w, nn = bc[1] + right[1] * u + fwd[1] * w;
    fresh.push(m4.clone().compose(new THREE.Vector3(e, fl + 0.03 + tt / 2, -nn), q.setFromAxisAngle(up, hd + rng.range(-0.1, 0.1)), one)); }
  const dry = new THREE.InstancedMesh(tabletGeo, mat([0.66, 0.55, 0.42], 0.9), filed.length); filed.forEach((mm, i) => dry.setMatrixAt(i, mm));
  const wet = new THREE.InstancedMesh(tabletGeo, mat([0.47, 0.38, 0.29], 0.55), fresh.length); fresh.forEach((mm, i) => wet.setMatrixAt(i, mm));
  for (const [im, name] of [[dry, 'scribes:tablets_filed'], [wet, 'scribes:tablets_fresh']] as const) { im.castShadow = true; im.receiveShadow = true; im.name = name; im.computeBoundingSphere(); group.add(im); }
  // the clay: a lump kept moist under a cloth, in front-left of the scribe
  const lc = [dx - right[0] * 0.45 + fwd[0] * 0.3, dy - right[1] * 0.45 + fwd[1] * 0.3];
  const lump = new THREE.Mesh(new THREE.SphereGeometry(R.clay_lump, 12, 8).scale(1.2, 0.6, 1), mat([0.45, 0.36, 0.27], 0.5));
  lump.position.set(lc[0], fl + R.clay_lump * 0.55, -lc[1]); lump.name = 'scribes:clay'; group.add(lump);
  const cloth = new THREE.Mesh(new THREE.SphereGeometry(R.clay_lump * 1.25, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.42).scale(1.2, 0.7, 1), mat([0.72, 0.68, 0.58], 0.95));
  cloth.position.set(lc[0], fl + R.clay_lump * 0.2, -lc[1]); cloth.rotation.y = 0.6; cloth.name = 'scribes:cloth'; group.add(cloth);
  // reed baskets of tablets along the S wall, W of the doorway (C)
  const bgeo = lathe([[0, 0], [0.16, 0], [0.2, 0.05], [0.21, 0.26], [0.2, 0.28], [0.19, 0.28], [0.19, 0.03], [0, 0.03]], 14);
  const baskets = new THREE.InstancedMesh(bgeo, mat([0.62, 0.52, 0.33], 0.9), R.baskets);
  for (let i = 0; i < R.baskets; i++) { const e = room[0] - room[2] / 2 + 1.4 + i * 0.55, nn = room[1] - room[3] / 2 + 0.3; baskets.setMatrixAt(i, m4.compose(new THREE.Vector3(e, fl, -nn), q.setFromAxisAngle(up, i), one)); }
  baskets.name = 'scribes:baskets'; baskets.castShadow = true; baskets.receiveShadow = true; baskets.computeBoundingSphere(); group.add(baskets);
  // every piece takes and casts sun shadows (the board, the clay and its cloth did not receive them: under the roof they
  // were lit by the full sun, and glowed white at the room's exposure; session 4)
  group.traverse(o => { if ((o as THREE.Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  group.traverse(o => { if ((o as THREE.Mesh).isMesh) o.userData = { tier: 'C', src: 'IR-TREAS;MATCULT-R', note: 'scribes\' room of the Treasury (PT find-spot "a northeastern room", B): tablets, drying board, clay, baskets (types B; forms, sizes, number and arrangement C)' }; });
  return group;
}
