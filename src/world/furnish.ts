// Furnishings (Phase 4): the stored goods on the benches of the Treasury's Hall of 99 Columns. The object types are
// those reported among the Treasury finds (treasury.stored_goods, ISAC-FINDS: B); their number, arrangement and exact
// forms are reconstruction (C). Instanced per type; render-only (the benches under them are the collidable parts).
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { uv, float, attribute } from 'three/tsl';
import { v } from '../arch/spec';
import { Rng } from '../core/rng';
import { INSCRIPTION_PICK_LAYER } from '../arch/decor';
import { ptTabletGeometry, bullaGeometry, clayMaterial, writtenMeta } from './writing';
import { propMaterial, propMaterialMulti } from '../render/materials';

// D-301 (every inch real: the interiors): the furnishings' silhouettes and grain. A storage jar is a smooth, slightly
// out-of-round hand-built body with a neck and a rolled rim (was a 12-sided lathe: faceted); a bale of cloth is a soft,
// cord-pinched bundle (was a box); a shield a convex dish with a rim and a boss (was a 16-sided disc); every piece is drawn
// in a material of what it is made of with a CC0 scan's grain over its written colour (materials.ts propMaterial). Forms C.
/** a hand-built storage jar of radius r and height h: a round-shouldered body, a short neck and a rolled rim, the wall a
 *  little out of round (a coil-built pot, not a thrown one: C) */
export function jarGeometry(r: number, h: number, seg = 40, seed = 1): THREE.BufferGeometry {
  const P: [number, number][] = [[0, 0], [r * 0.3, 0], [r * 0.55, h * 0.04], [r * 0.82, h * 0.16], [r * 0.97, h * 0.34], [r, h * 0.5], [r * 0.95, h * 0.64],
    [r * 0.8, h * 0.76], [r * 0.56, h * 0.85], [r * 0.42, h * 0.89], [r * 0.4, h * 0.93], [r * 0.45, h * 0.965], [r * 0.47, h * 0.985], [r * 0.43, h], [r * 0.36, h * 0.99], [0, h * 0.975]];
  const g = lathe(P, seg), pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i), y = pos.getY(i), a = Math.atan2(z, x);
    const k = 1 + 0.02 * Math.sin(2 * a + seed) + 0.012 * Math.sin(3 * a + 2 * seed + (y / h) * 3); pos.setXYZ(i, x * k, y, z * k); }
  return g;
}
/** a soft bundle w × h × d standing on y = 0: the faces bulge (bulge × the smaller size) and are pinched in by two cords
 *  across the length (C) */
export function baleGeometry(w: number, h: number, d: number, bulge = 0.12, cords = true): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d, 12, 6, 8), pos = g.getAttribute('position') as THREE.BufferAttribute, b = bulge * Math.min(w, h, d);
  for (let i = 0; i < pos.count; i++) { const u = pos.getX(i) / (w / 2), v = pos.getY(i) / (h / 2), t = pos.getZ(i) / (d / 2);
    const cord = cords ? 1 - 0.55 * Math.exp(-(((Math.abs(u) - 0.5) / 0.07) ** 2)) : 1; // two cords at a quarter of the length from each end
    const s = (1 - u * u) * (1 - v * v) * (1 - t * t), k = b * (0.4 + 0.6 * s) * cord;
    const n = Math.hypot(u, v, t) || 1; pos.setXYZ(i, pos.getX(i) + (u / n) * k * 0.6, pos.getY(i) + (v / n) * k, pos.getZ(i) + (t / n) * k); }
  g.translate(0, h / 2, 0); g.deleteAttribute('uv'); g.deleteAttribute('normal'); return mergeVerts(g);
}
/** a saddle quern's lower stone qw × h × qd on y = 0: a slab with rounded ends and a top worn hollow along its length (C) */
export function quernGeometry(qw: number, h: number, qd: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(qw, h, qd, 12, 3, 8), pos = g.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) { const u = pos.getX(i) / (qw / 2), v = pos.getY(i) / (h / 2), t = pos.getZ(i) / (qd / 2);
    const round = 1 - 0.18 * Math.max(0, Math.abs(u) ** 4) - 0.1 * Math.abs(t) ** 4, dish = v > 0.9 ? -0.35 * h * (1 - u * u) * (1 - t * t) : 0;
    pos.setXYZ(i, pos.getX(i) * (1 - 0.12 * Math.abs(t) ** 4), pos.getY(i) * (v > 0 ? round : 1) + dish, pos.getZ(i) * (1 - 0.15 * Math.abs(u) ** 4)); }
  g.translate(0, h / 2, 0); g.deleteAttribute('uv'); g.deleteAttribute('normal'); return mergeVerts(g);
}
/** smooth shading across a box's split edges */
const mergeVerts = (g: THREE.BufferGeometry) => { const n = BufferGeometryUtils.mergeVertices(g, 1e-5); n.computeVertexNormals(); return n; };

const lathe = (pts: [number, number][], seg = 16) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const strip = (g: THREE.BufferGeometry) => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; };
/** simple period forms (C): profiles as radius/height pairs in metres */
const FORMS: Record<string, () => THREE.BufferGeometry> = {
  alabaster_vessel: () => lathe([[0, 0], [0.05, 0], [0.066, 0.02], [0.074, 0.08], [0.075, 0.14], [0.062, 0.185], [0.04, 0.215], [0.025, 0.24], [0.03, 0.25], [0.036, 0.26], [0.02, 0.262], [0, 0.255]], 32), // alabastron-like bottle
  blue_vessel: () => lathe([[0, 0], [0.04, 0], [0.075, 0.015], [0.095, 0.045], [0.1, 0.075], [0.104, 0.09], [0.096, 0.091], [0.088, 0.075], [0, 0.012]], 32), // bowl
  chert_set: () => mergeGeometries([strip(lathe([[0, 0], [0.09, 0], [0.1, 0.06], [0.07, 0.07], [0, 0.07]])), strip(new THREE.CylinderGeometry(0.018, 0.022, 0.16, 8).rotateZ(1.2).translate(0.02, 0.1, 0))])!, // mortar + pestle
  arrow_bundle: () => new THREE.CylinderGeometry(0.05, 0.05, 0.75, 10).rotateZ(Math.PI / 2).translate(0, 0.05, 0), // bundle lying on the bench
  sealed_jar: () => jarGeometry(0.13, 0.4, 32, 2),
  // D-276 (the lead's gap hunt s10 C: the stock the benches lacked). Forms C; the types' tiers in treasury.stored_goods
  silver_phiale: () => lathe([[0, 0.012], [0.03, 0.004], [0.1, 0.012], [0.125, 0.04], [0.118, 0.042], [0.095, 0.016], [0.03, 0.01], [0, 0.02]], 40), // shallow bowl with a raised omphalos, stacked flat
  gold_rhyton: () => lathe([[0, 0], [0.012, 0], [0.03, 0.08], [0.05, 0.2], [0.058, 0.24], [0.05, 0.24], [0, 0.23]], 28).rotateZ(1.3).translate(0.1, 0.035, 0), // a horn-shaped drinking vessel lying on its side
  textile_bale: () => baleGeometry(0.42, 0.16, 0.3), // folded cloth tied in a bale
  scale_armour: () => baleGeometry(0.5, 0.07, 0.36, 0.05), // a scale corslet folded flat
  shield: () => mergeGeometries([strip(lathe([[0, 0.06], [0.05, 0.058], [0.2, 0.042], [0.31, 0.018], [0.34, 0.004], [0.345, -0.006], [0.33, -0.01], [0.2, 0.02], [0, 0.036]], 48)),
    strip(lathe([[0, 0.085], [0.03, 0.082], [0.055, 0.062], [0.06, 0.055], [0, 0.055]], 24))])!.rotateX(1.35).translate(0, 0.33, 0.1), // a round shield, convex with a rim and a boss, leaning on the wall
  bead_bowl: () => mergeGeometries([strip(lathe([[0, 0], [0.05, 0], [0.08, 0.04], [0.085, 0.05], [0.075, 0.05], [0, 0.012]], 12)), strip(new THREE.SphereGeometry(0.07, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.35, 1).translate(0, 0.03, 0))])!, // a bowl heaped with beads
  ivory_tusk: () => new THREE.TorusGeometry(0.45, 0.045, 6, 12, 1.1).rotateX(Math.PI / 2).translate(-0.3, 0.045, -0.15), // an elephant tusk lying on the bench
  glass_bowl: () => lathe([[0, 0], [0.04, 0], [0.085, 0.03], [0.095, 0.065], [0.09, 0.066], [0.078, 0.034], [0, 0.006]], 32), // a cut-glass bowl
  bitumen_jar: () => jarGeometry(0.13, 0.41, 32, 5),
};
const COLOURS: Record<string, [number, number, number, number]> = { // sRGB albedo, roughness
  alabaster_vessel: [0.86, 0.82, 0.72, 0.3], blue_vessel: [0.13, 0.28, 0.62, 0.35], chert_set: [0.3, 0.38, 0.31, 0.45], arrow_bundle: [0.62, 0.55, 0.38, 0.8], sealed_jar: [0.6, 0.42, 0.3, 0.85],
  // D-276: metals drawn partly metallic (no environment reflection: the bronze_metalness precedent, D-030); the rest as found
  silver_phiale: [0.78, 0.78, 0.76, 0.3], gold_rhyton: [0.86, 0.66, 0.3, 0.28], textile_bale: [0.55, 0.3, 0.22, 0.95], scale_armour: [0.5, 0.4, 0.26, 0.55], shield: [0.52, 0.4, 0.26, 0.85],
  bead_bowl: [0.2, 0.26, 0.58, 0.4], ivory_tusk: [0.88, 0.83, 0.7, 0.4], glass_bowl: [0.7, 0.78, 0.72, 0.12], bitumen_jar: [0.16, 0.13, 0.11, 0.35],
};
const METALNESS: Record<string, number> = { silver_phiale: 0.35, gold_rhyton: 0.35, scale_armour: 0.2 };
/** what each good is made of (propMaterial's scan; D-301). The glass bowl keeps a plain transparent material (no scan of glass) */
const KIND: Record<string, string> = { alabaster_vessel: 'stone', blue_vessel: 'clay', chert_set: 'stone', arrow_bundle: 'wood', sealed_jar: 'clay', silver_phiale: 'metal', gold_rhyton: 'metal',
  textile_bale: 'textile', scale_armour: 'metal', shield: 'leather', bead_bowl: 'clay', ivory_tusk: 'stone', bitumen_jar: 'clay' };

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
    const mat = KIND[g.item] ? propMaterial(KIND[g.item], { color: [r, gg, b], rough, metal: METALNESS[g.item] ?? 0 })
      : new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(r, gg, b, THREE.SRGBColorSpace), roughness: rough, metalness: METALNESS[g.item] ?? 0 });
    if (g.item === 'glass_bowl') { mat.transparent = true; mat.opacity = 0.55; }
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
  // a PT letter: a rectangular tablet with pillowed faces, lying on its face (x = width, z = height, y = thickness); the
  // writing and the seal roll are impressed relief from the writing atlas (writing.ts, D-179): the filed tablets and the
  // fresh ones each carry a memorandum on the obverse, one is being written; the Elamite texts are RECONSTRUCTED by the
  // project on the Treasury tablets' published formulary, not surviving texts (C; writing.json recon_texts, D-198, B18)
  const tabletGeo = ptTabletGeometry('full', 1), freshGeo = ptTabletGeometry('fresh', 0), partGeo = ptTabletGeometry('part', 0);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  const filed: THREE.Matrix4[] = [], fresh: THREE.Matrix4[] = [];
  // D-221: the bench's E end holds two baskets of tablets and the lamp: no filed row there
  const busy = (e: number, nn: number) => Math.hypot(e - R.lamp.at[0], nn - R.lamp.at[1]) < 0.3 || (R.bench_baskets as number[]).some(x => Math.abs(e - x) < 0.32 && nn > room[1] + room[3] / 2 - 1.0);
  // filed tablets: stood on edge in two rows along each bench, a few gaps (C); baked-dry clay
  for (const [cx, cy, sx, sy, top] of shelves) {
    const alongX = sx > sy, len = Math.max(sx, sy), dep = Math.min(sx, sy), n = Math.floor(len * R.tablets_per_m);
    for (const r of [-0.22, 0.22]) for (let i = 0; i < n; i++) {
      if (rng.chance(0.15)) continue;
      const a = -len / 2 + (i + 0.5) * (len / n), e = cx + (alongX ? a : r * dep), nn = cy + (alongX ? r * dep : a);
      if (busy(e, nn)) continue;
      q.setFromAxisAngle(up, (alongX ? 0 : Math.PI / 2) + rng.range(-0.08, 0.08)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2 + rng.range(-0.25, 0.25)));
      filed.push(m4.clone().compose(new THREE.Vector3(e, top + th / 2, -nn), q, one));
    }
  }
  // D-221: two reed baskets of tablets on the N bench's E end, the tablets on edge in them, their tops showing (C)
  const nb = shelves.find(([, , sx, sy]) => sx > sy), bTop = nb ? nb[4] : fl + R.bench.height, bN = nb ? nb[1] : room[1] + room[3] / 2 - R.bench.depth / 2;
  for (const x of R.bench_baskets as number[]) for (let k = 0; k < 7; k++) {
    q.setFromAxisAngle(up, rng.range(-0.15, 0.15)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2 + rng.range(-0.3, 0.3)));
    filed.push(m4.clone().compose(new THREE.Vector3(x + (k - 3) * 0.035, bTop + 0.25 + th / 2, -(bN + rng.range(-0.06, 0.06))), q, one)); }
  // the drying board by the desk (0.6 × 0.35 m, on the floor to the scribe's right) with fresh tablets lying flat
  const [dx, dy] = SR.desk as number[], hd = (SR.desk_heading * Math.PI) / 180, fwd = [Math.sin(hd), Math.cos(hd)], right = [fwd[1], -fwd[0]];
  const [bw, bd] = R.drying_board as number[], bc = [dx + right[0] * 0.55 + fwd[0] * 0.15, dy + right[1] * 0.55 + fwd[1] * 0.15];
  const board = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.03, bd), mat([0.42, 0.33, 0.24], 0.85));
  board.position.set(bc[0], fl + 0.015, -bc[1]); board.rotation.y = hd; board.name = 'scribes:drying_board'; group.add(board);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { if (rng.chance(0.2)) continue;
    const u = (i - 1.5) * (bw / 4), w = (j - 1) * (bd / 3), e = bc[0] + right[0] * u + fwd[0] * w, nn = bc[1] + right[1] * u + fwd[1] * w;
    fresh.push(m4.clone().compose(new THREE.Vector3(e, fl + 0.03 + tt / 2, -nn), q.setFromAxisAngle(up, hd + rng.range(-0.1, 0.1)), one)); }
  const dry = new THREE.InstancedMesh(tabletGeo, clayMaterial([0.66, 0.55, 0.42], 0.9), filed.length); filed.forEach((mm, i) => dry.setMatrixAt(i, mm));
  const wet = new THREE.InstancedMesh(freshGeo, clayMaterial([0.47, 0.38, 0.29], 0.55), fresh.length); fresh.forEach((mm, i) => wet.setMatrixAt(i, mm));
  for (const [im, name] of [[dry, 'scribes:tablets_filed'], [wet, 'scribes:tablets_fresh']] as const) { im.castShadow = true; im.receiveShadow = true; im.name = name; im.computeBoundingSphere(); im.userData = name === 'scribes:tablets_fresh' ? writtenMeta('pt_letter_fresh', 'fresh tablets drying, written and sealed on the left edge') : writtenMeta('pt_letter', 'filed tablets, written and sealed'); group.add(im); }
  // the tablet being written: four lines on the obverse, the last one short where the scribe stopped; on the floor in
  // front of the desk, to the scribe's right (C)
  const part = new THREE.Mesh(partGeo, wet.material as THREE.Material), pc = [dx + right[0] * 0.25 + fwd[0] * 0.32, dy + right[1] * 0.25 + fwd[1] * 0.32];
  part.position.set(pc[0], fl + tt / 2, -pc[1]); part.rotation.y = hd + 0.3; part.name = 'scribes:tablet_unfinished'; part.userData = writtenMeta('pt_letter_unfinished', 'a tablet being written: four lines so far, not yet sealed', { unsealed: true }); group.add(part);
  // Aramaic documents on leather, rolled, tied and sealed with a clay bulla, lying by the drying board (B: Treasury tablets
  // were tied to leather scrolls with an Aramaic duplicate, Cameron's inference; number and place C). Their text is inside.
  const S = 3, scrollAt: THREE.Matrix4[] = [];
  for (let i = 0; i < S; i++) { const u = -0.1 + i * 0.09, w = bd / 2 + 0.12 + rng.range(0, 0.04), e = bc[0] + right[0] * u + fwd[0] * w, nn = bc[1] + right[1] * u + fwd[1] * w;
    scrollAt.push(m4.clone().compose(new THREE.Vector3(e, fl, -nn), q.setFromAxisAngle(up, hd + rng.range(-0.25, 0.25)), one)); }
  const leather = new THREE.InstancedMesh(scrollGeometry(), propMaterial('leather', { vertexColors: true, rough: 0.75 }), S);
  const bullae = new THREE.InstancedMesh(bullaGeometry(0.011).translate(0, 2 * SCROLL_R, 0), clayMaterial([0.52, 0.41, 0.31], 0.85), S);
  scrollAt.forEach((mm, i) => { leather.setMatrixAt(i, mm); bullae.setMatrixAt(i, mm); });
  for (const [im, name] of [[leather, 'scribes:leather_scrolls'], [bullae, 'scribes:bullae']] as const) { im.castShadow = true; im.receiveShadow = true; im.name = name; im.computeBoundingSphere(); im.userData = writtenMeta('leather_scroll', name === 'scribes:bullae' ? 'clay bulla on the tie of a leather scroll, rolled with the treasurer\'s seal' : 'rolled leather document, tied'); group.add(im); }
  // pick boxes for the translation layer (INSCRIPTION_PICK_LAYER, never rendered): the drying board, the benches, the scrolls
  const pick = (w: number, h: number, d: number, at: THREE.Vector3, rotY: number, id: string) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), PICK_MAT); b.position.copy(at); b.rotation.y = rotY; b.layers.set(INSCRIPTION_PICK_LAYER); b.name = `writing:${id}:pick`; b.userData = { ...writtenMeta(id, ''), inscription: `writing:${id}`, version: 'writing', pickFar: 4 }; group.add(b); };
  pick(bw, 0.08, bd, new THREE.Vector3(bc[0], fl + 0.04, -bc[1]), hd, 'pt_letter_fresh');
  { const e = pc[0], nn = pc[1]; pick(tw + 0.03, 0.06, th + 0.03, new THREE.Vector3(e, fl + 0.03, -nn), hd + 0.3, 'pt_letter_unfinished'); }
  for (const [cx, cy, sx, sy, top] of shelves) pick(sx, th + 0.04, sy, new THREE.Vector3(cx, top + th / 2, -cy), 0, 'pt_letter');
  { const e = bc[0] + fwd[0] * (bd / 2 + 0.14), nn = bc[1] + fwd[1] * (bd / 2 + 0.14); pick(0.36, 0.08, 0.2, new THREE.Vector3(e, fl + 0.04, -nn), hd, 'leather_scroll'); }
  // the clay: a lump kept moist under a cloth, in front-left of the scribe
  const lc = [dx - right[0] * 0.45 + fwd[0] * 0.3, dy - right[1] * 0.45 + fwd[1] * 0.3];
  const lump = new THREE.Mesh(new THREE.SphereGeometry(R.clay_lump, 12, 8).scale(1.2, 0.6, 1), mat([0.45, 0.36, 0.27], 0.5));
  lump.position.set(lc[0], fl + R.clay_lump * 0.55, -lc[1]); lump.name = 'scribes:clay'; group.add(lump);
  const cloth = new THREE.Mesh(new THREE.SphereGeometry(R.clay_lump * 1.25, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.42).scale(1.2, 0.7, 1), mat([0.72, 0.68, 0.58], 0.95));
  cloth.position.set(lc[0], fl + R.clay_lump * 0.2, -lc[1]); cloth.rotation.y = 0.6; cloth.name = 'scribes:cloth'; group.add(cloth);
  // reed baskets of tablets along the S wall, W of the doorway (C)
  const bgeo = lathe([[0, 0], [0.16, 0], [0.19, 0.02], [0.2, 0.05], [0.212, 0.2], [0.214, 0.26], [0.222, 0.27], [0.218, 0.285], [0.2, 0.285], [0.19, 0.27], [0.19, 0.03], [0, 0.03]], 36);
  const baskets = new THREE.InstancedMesh(bgeo, mat([0.62, 0.52, 0.33], 0.9), R.baskets);
  for (let i = 0; i < R.baskets; i++) { const e = room[0] - room[2] / 2 + 1.4 + i * 0.55, nn = room[1] - room[3] / 2 + 0.3; baskets.setMatrixAt(i, m4.compose(new THREE.Vector3(e, fl, -nn), q.setFromAxisAngle(up, i), one)); }
  baskets.name = 'scribes:baskets'; baskets.castShadow = true; baskets.receiveShadow = true; baskets.computeBoundingSphere(); group.add(baskets);
  // ---- D-221 (rubric s7 pass 2 item 11): the room at work. Every piece C; the notes say what stands behind each
  const tag = (o: THREE.Object3D, note: string, src = 'IR-TREAS;MATCULT-R;RECON') => { o.userData = { tier: 'C', src, note: `${note} (D-221)` }; return o; };
  // the reed mats the three sit on, at their places round the desk's things (site_spec scribes_room.seats)
  const [mw, md] = R.mat as number[], seats = Object.values(SR.seats as Record<string, [number, number, number]>);
  const mats = new THREE.InstancedMesh(new THREE.PlaneGeometry(mw, md).rotateX(-Math.PI / 2), propMaterial('reed', { color: [0.6, 0.52, 0.34], rough: 0.95 }), seats.length);
  seats.forEach(([e, nn, h], i) => mats.setMatrixAt(i, m4.compose(new THREE.Vector3(e, fl + 0.006, -nn), q.setFromAxisAngle(up, -(h * Math.PI) / 180), one)));
  mats.name = 'scribes:mats'; group.add(tag(mats, 'reed mats to sit on at the desk (reed matting is the common floor covering of the region: B by analogy; one to each place C)'));
  // the lamp: a clay saucer lamp with a pinched nozzle on the bench (its flame and light: firePlaces.ts); the wall above it sooted
  const L = R.lamp, lampG = mergeGeometries([strip(lathe([[0, 0], [L.r * 0.7, 0], [L.r, 0.016], [L.r * 1.02, 0.03], [L.r * 0.9, 0.03], [L.r * 0.82, 0.016], [0, 0.012]], 14)), strip(new THREE.BoxGeometry(0.03, 0.012, 0.026).translate(L.r + 0.01, 0.024, 0))])!;
  const lamp = new THREE.Mesh(lampG, mat([0.6, 0.45, 0.32], 0.8)); lamp.position.set(L.at[0], bTop, -L.at[1]); lamp.rotation.y = -Math.PI / 2; lamp.name = 'scribes:lamp';
  group.add(tag(lamp, 'a clay saucer lamp with a pinched nozzle (the lamp type of the Iron Age Near East: B by analogy); lit through the working day as a fire of kind lamp (world firePlaces.ts, session 8; C)'));
  const sootMat = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(0.05, 0.045, 0.04, THREE.SRGBColorSpace), roughness: 0.95, metalness: 0 });
  sootMat.alphaHash = true; { const u = uv(), w = float(0.16).add(u.y.mul(0.34)), dx = u.x.sub(0.5).abs().div(w); sootMat.opacityNode = float(1).sub(dx.mul(2)).clamp(0, 1).mul(float(1).sub(u.y).clamp(0, 1)).mul(u.y.mul(8).clamp(0, 1)).mul(0.8); }
  const [sw, sh] = L.soot as number[], soot = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), sootMat);
  soot.position.set(L.at[0], bTop + 0.04 + sh / 2, -(room[1] + room[3] / 2) + 0.004); soot.name = 'scribes:soot'; soot.castShadow = false;
  group.add(tag(soot, 'lamp soot on the wall plaster above the lamp\'s place (the evenings\' work: C)'));
  // the ink by the Aramaic secretary: a small pot of carbon ink (Aramaic ink epigraphs: B)
  const I = R.ink_pot, ink = new THREE.Mesh(mergeGeometries([strip(lathe([[0, 0], [I.r * 0.8, 0], [I.r, I.h * 0.5], [I.r * 0.75, I.h], [I.r * 0.8, I.h * 1.05], [0, I.h * 1.05]], 12))])!, mat([0.26, 0.21, 0.17], 0.7));
  ink.position.set(I.at[0], fl, -I.at[1]); ink.name = 'scribes:ink'; group.add(tag(ink, 'a small pot of ink for the Aramaic secretary\'s pen (Aramaic written in carbon ink on the PF tablets\' epigraphs: B; the pot C)'));
  // a bowl of water by the clay, to wet it and the fingers (C)
  const Wb = R.water_bowl, bowl = new THREE.Mesh(strip(lathe([[0, 0], [Wb.r * 0.6, 0], [Wb.r, 0.05], [Wb.r * 0.95, 0.055], [Wb.r * 0.9, 0.035], [0, 0.035]], 16)), mat([0.62, 0.47, 0.33], 0.8));
  bowl.position.set(Wb.at[0], fl, -Wb.at[1]); bowl.name = 'scribes:water_bowl'; group.add(tag(bowl, 'a bowl of water by the clay, to keep it and the hands wet (C)'));
  // two jars for tablets in the SE corner (tablets kept in jars and baskets: Mesopotamian archive practice, B by analogy)
  const jarG = strip(jarGeometry(0.17, 0.55, 36, 3));
  const jars = new THREE.InstancedMesh(jarG, mat([0.66, 0.5, 0.36], 0.85), (R.jars as number[][]).length);
  (R.jars as number[][]).forEach(([e, nn], i) => jars.setMatrixAt(i, m4.compose(new THREE.Vector3(e, fl, -nn), q.setFromAxisAngle(up, i * 1.3), one)));
  jars.name = 'scribes:jars'; group.add(tag(jars, 'storage jars for tablets (tablets kept in jars: Mesopotamian archive practice, B by analogy; here C)'));
  // the tablets' seals: two stone cylinder seals on their cords by the drying board (the tablets are sealed on the left edge,
  // D-179; the carved seal faces are not drawn at this size)
  const Sg = R.seals, sealG = mergeGeometries([strip(new THREE.CylinderGeometry(Sg.d / 2, Sg.d / 2, Sg.len, 10).rotateZ(Math.PI / 2).translate(0, Sg.d / 2, 0)), strip(new THREE.TorusGeometry(0.03, 0.0012, 3, 16).rotateX(Math.PI / 2).translate(Sg.len / 2 + 0.025, 0.002, 0))])!;
  const seals = new THREE.InstancedMesh(sealG, mat([0.55, 0.5, 0.47], 0.4), Sg.n);
  for (let i = 0; i < Sg.n; i++) seals.setMatrixAt(i, m4.compose(new THREE.Vector3(Sg.at[0] + i * 0.06, fl, -(Sg.at[1] + i * 0.03)), q.setFromAxisAngle(up, 0.4 + i * 1.1), one));
  seals.name = 'scribes:seals'; group.add(tag(seals, 'stone cylinder seals on their cords, rolled on the tablets\' left edge (seal impressions on the PT tablets: A; which seals C)'));
  // the floor about the places: darker, trodden and clay-stained (C)
  const F = R.floor_stain, stainMat = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(0.38, 0.28, 0.21, THREE.SRGBColorSpace), roughness: 0.9, metalness: 0 });
  stainMat.alphaHash = true; { const u = uv(), d = u.sub(0.5).mul(2).length(); stainMat.opacityNode = float(1).sub(d).clamp(0, 1).mul(0.55); }
  const stain = new THREE.Mesh(new THREE.PlaneGeometry(2 * F.r[0], 2 * F.r[1]).rotateX(-Math.PI / 2), stainMat); stain.position.set(F.c[0], fl + 0.003, -F.c[1]); stain.name = 'scribes:floor_stain'; stain.castShadow = false;
  group.add(tag(stain, 'the floor plaster about the places darkened by feet and stained with clay (C)'));
  // every piece takes and casts sun shadows (the board, the clay and its cloth did not receive them: under the roof they
  // were lit by the full sun, and glowed white at the room's exposure; session 4)
  group.traverse(o => { if ((o as THREE.Mesh).isMesh && !o.layers.isEnabled(INSCRIPTION_PICK_LAYER)) { o.castShadow = !o.name.match(/soot|floor_stain|mats/); o.receiveShadow = true; } }); // (D-221: the decals and the mats cast none)
  group.traverse(o => { if ((o as THREE.Mesh).isMesh && !o.userData.tier) o.userData = { tier: 'C', src: 'IR-TREAS;MATCULT-R', note: 'scribes\' room of the Treasury (PT find-spot "a northeastern room", B): drying board, clay, baskets (types B; forms, sizes, number and arrangement C)' }; });
  const SK: Record<string, string> = { 'scribes:drying_board': 'wood', 'scribes:cloth': 'textile', 'scribes:baskets': 'wicker', 'scribes:seals': 'stone' };
  mergeStatic(group, ['scribes:drying_board', 'scribes:clay', 'scribes:cloth', 'scribes:baskets', 'scribes:lamp', 'scribes:ink', 'scribes:water_bowl', 'scribes:jars', 'scribes:seals'], 'scribes:furnishings', n => SK[n] ?? 'clay');
  return group;
}

const PICK_MAT = new THREE.MeshBasicNodeMaterial({ visible: false });
const SCROLL_R = 0.013;
/** a rolled leather document 0.12 m long lying along x, tied near both ends with a cord; the bulla sits on the middle tie
 *  (bullaGeometry, placed on top). Vertex colours: leather and cord (C) */
function scrollGeometry(): THREE.BufferGeometry {
  const col = (g: THREE.BufferGeometry, rgb: [number, number, number]) => { const n = g.index ? g.toNonIndexed() : g; n.deleteAttribute('uv'); const c = new THREE.Color().setRGB(...rgb, THREE.SRGBColorSpace), a = new Float32Array(n.getAttribute('position').count * 3); for (let i = 0; i < a.length; i += 3) a.set([c.r, c.g, c.b], i); n.setAttribute('color', new THREE.BufferAttribute(a, 3)); return n; };
  const roll = new THREE.CylinderGeometry(SCROLL_R, SCROLL_R, 0.12, 14, 1).rotateZ(Math.PI / 2).translate(0, SCROLL_R, 0);
  const lip = new THREE.CylinderGeometry(SCROLL_R * 1.06, SCROLL_R * 1.06, 0.004, 14, 1, true).rotateZ(Math.PI / 2).translate(0.052, SCROLL_R, 0); // the outer edge of the rolled sheet
  const ties = [-0.035, 0, 0.035].map(x => new THREE.TorusGeometry(SCROLL_R * 1.04, 0.0016, 4, 14).rotateY(Math.PI / 2).translate(x, SCROLL_R, 0));
  return mergeGeometries([col(roll, [0.62, 0.5, 0.36]), col(lip, [0.58, 0.46, 0.33]), ...ties.map(t => col(t, [0.55, 0.48, 0.36]))])!;
}

/** merge a room's small static opaque pieces (each a plain coloured MeshStandardNodeMaterial, Mesh or InstancedMesh) into
 *  one vertex-coloured mesh (per-vertex roughness), so the room costs one draw for them (session 8: D-221's furnishings
 *  took the scribes' room from 9 to 17 draws). Each piece's name, place and F3 record stay on an empty anchor, and the merged
 *  mesh's note lists them */
function mergeStatic(group: THREE.Group, names: string[], name: string, kindOf: (piece: string) => string = () => 'clay') {
  // D-301: each piece keeps its material's kind (aKind: its scan, materials.ts propMaterialMulti), still one draw
  const geos: THREE.BufferGeometry[] = [], kinds: string[] = [], notes: string[] = [], m4 = new THREE.Matrix4(), mi = new THREE.Matrix4();
  for (const n of names) {
    const o = group.getObjectByName(n) as THREE.Mesh | undefined; if (!o || !o.isMesh) continue;
    const mat = o.material as THREE.MeshStandardMaterial, col = mat.color ?? new THREE.Color(1, 1, 1), rough = mat.roughness ?? 0.8;
    o.updateMatrix(); const base = strip(o.geometry.clone()); if (!base.getAttribute('normal')) base.computeVertexNormals();
    const inst = (o as any).isInstancedMesh ? (o as unknown as THREE.InstancedMesh) : null, k = inst ? inst.count : 1, kind = kindOf(n);
    if (!kinds.includes(kind)) kinds.push(kind); const ki = kinds.indexOf(kind);
    for (let i = 0; i < k; i++) {
      const g = base.clone(); if (inst) { inst.getMatrixAt(i, mi); m4.multiplyMatrices(o.matrix, mi); } else m4.copy(o.matrix);
      g.applyMatrix4(m4); const nv = g.getAttribute('position').count, c = new Float32Array(nv * 3), r = new Float32Array(nv).fill(rough), kk = new Float32Array(nv).fill(ki);
      for (let v = 0; v < nv; v++) { c[v * 3] = col.r; c[v * 3 + 1] = col.g; c[v * 3 + 2] = col.b; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aRough', new THREE.BufferAttribute(r, 1)); g.setAttribute('aKind', new THREE.BufferAttribute(kk, 1)); geos.push(g);
    }
    const anchor = new THREE.Object3D(); anchor.name = o.name; anchor.position.copy(o.position); anchor.rotation.copy(o.rotation); anchor.userData = o.userData;
    notes.push(`${n.replace(/^scribes:/, '')}: ${o.userData?.note ?? ''}`); group.remove(o); group.add(anchor);
  }
  if (!geos.length) return;
  const mesh = new THREE.Mesh(mergeGeometries(geos)!, propMaterialMulti(kinds)); mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.userData = { tier: 'C', src: 'IR-TREAS;MATCULT-R;RECON', note: `the room's small furnishings, merged into one draw (each piece's record is on its named anchor; each keeps its material's scan, D-301): ${notes.join(' | ')}` };
  group.add(mesh);
}

/** D-276: the fittings of a building's room ranges (terrace.ts buildRanges → manifest[b].ranges): reed sleeping mats with a
 *  bedroll at the head, storage jars, querns and the saucer lamps on their ledges, merged into one vertex-coloured mesh per
 *  building (one draw). The hearths are the fire system's bodies (firePlaces.ts); the jars' and querns' colliders are
 *  terrace.ts parts. Types from the town's houses and MATERIAL_CULTURE (reed mats, bedding, jars, querns, saucer lamps: B by
 *  analogy); number and place by rule (C) */
export function buildRoomFittings(b: string, R: { mats: number[][]; jars: number[][]; querns: number[][]; lamps: number[][] }): THREE.Group {
  const group = new THREE.Group(); group.name = `${b}:rooms`;
  const F = v<any>('global', 'r_room_fittings');
  const mat = (rgb: [number, number, number], rough: number) => new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(...rgb, THREE.SRGBColorSpace), roughness: rough, metalness: 0 });
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), names: string[] = [];
  const inst = (geo: THREE.BufferGeometry, m: THREE.Material, list: THREE.Matrix4[], name: string) => {
    if (!list.length) return; const im = new THREE.InstancedMesh(geo, m, list.length); list.forEach((x, i) => im.setMatrixAt(i, x)); im.name = name;
    im.userData = { tier: 'C', src: 'MATCULT-R;RECON', note: `${name.split(':')[1]} (types B by analogy with the town's houses; number and place C, D-276)` }; group.add(im); names.push(name); };
  // mats: a thin slab of reed matting (two tones by turn), the bedding rolled at the head end
  const matsA: THREE.Matrix4[] = [], matsB: THREE.Matrix4[] = [], rolls: THREE.Matrix4[] = [];
  const [mw, ml] = F.mat as [number, number];
  R.mats.forEach(([e, n, sx, sy, fl, h], i) => {
    (i % 3 ? matsA : matsB).push(m4.clone().compose(new THREE.Vector3(e, fl + F.mat_t / 2, -n), q.identity(), new THREE.Vector3(sx, F.mat_t, sy)));
    const hx = Math.sin(h), hy = Math.cos(h), c = [e + hx * (ml / 2 - 0.16), n + hy * (ml / 2 - 0.16)];
    rolls.push(m4.clone().compose(new THREE.Vector3(c[0], fl + F.mat_t + 0.08, -c[1]), q.setFromAxisAngle(up, -h), one));
  });
  // (D-301: the mats' edges bound and a little raised, the bedding a roll of felt, flattened by its weight, not an 8-sided cylinder)
  inst(baleGeometry(1, 1, 1, 0.02, false).translate(0, -0.5, 0), mat([0.62, 0.53, 0.35], 0.95), matsA, `${b}:mats`); inst(baleGeometry(1, 1, 1, 0.02, false).translate(0, -0.5, 0), mat([0.55, 0.47, 0.3], 0.95), matsB, `${b}:mats_b`);
  inst(new THREE.CylinderGeometry(0.085, 0.085, mw * 0.85, 24, 1).rotateZ(Math.PI / 2).scale(1, 0.8, 1), mat([0.5, 0.36, 0.24], 0.9), rolls, `${b}:bedrolls`);
  // storage jars: a round-bottomed jar set in the floor, its mouth closed with a clay stopper (C)
  const r = F.jar_r, jh = F.jar_h;
  inst(jarGeometry(r, jh, 40, 7), mat([0.62, 0.44, 0.31], 0.85),
    R.jars.map(([e, n, fl], i) => m4.clone().compose(new THREE.Vector3(e, fl - 0.02, -n), q.setFromAxisAngle(up, i * 1.7), one)), `${b}:jars`);
  // querns: a saddle quern (a stone slab) with its rubbing stone on it
  const [qw, qd] = F.quern as [number, number];
  inst(mergeGeometries([strip(quernGeometry(qw, 0.12, qd)), strip(new THREE.SphereGeometry(0.5, 16, 8).scale(qw * 0.36, 0.075, qd * 0.62).translate(qw * 0.05, 0.1, 0))])!, mat([0.52, 0.5, 0.46], 0.8),
    R.querns.map(([e, n, fl]) => m4.clone().compose(new THREE.Vector3(e, fl, -n), q.identity(), one)), `${b}:querns`);
  // saucer lamps on the ledges (their flames: firePlaces.ts)
  inst(lathe([[0, 0], [0.04, 0], [0.055, 0.016], [0.057, 0.03], [0.05, 0.03], [0.045, 0.016], [0, 0.012]], 24), mat([0.6, 0.45, 0.32], 0.8),
    R.lamps.map(([e, n, y]) => m4.clone().compose(new THREE.Vector3(e, y, -n), q.identity(), one)), `${b}:lamps`);
  const RK: Record<string, string> = { mats: 'reed', mats_b: 'reed', bedrolls: 'felt', jars: 'clay', querns: 'stone', lamps: 'clay' };
  mergeStatic(group, names, `${b}:room_fittings`, n => RK[n.split(':')[1]] ?? 'clay');
  const merged = group.getObjectByName(`${b}:room_fittings`); if (merged) merged.userData = { ...merged.userData, src: 'MATCULT-R;RECON' };
  return group;
}
