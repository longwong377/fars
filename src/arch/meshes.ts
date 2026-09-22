// Parts → Three.js meshes (merged per building+material; columns instanced per order) and Rapier colliders.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Part, Prism, Box, Column, ColumnOrder, Material } from './parts';
import type { Physics } from '../player/physics';

/** Greybox materials (Phase 2): flat albedos from pigment/stone references are Phase 3; these are neutral and tagged C. */
const ALBEDO: Record<Material, [number, number, number]> = {
  limestone: [0.62, 0.6, 0.56], limestone_dark: [0.2, 0.2, 0.21], mudbrick: [0.66, 0.56, 0.44], plaster: [0.8, 0.76, 0.68],
  timber: [0.36, 0.27, 0.19], glazed: [0.2, 0.4, 0.55], earth: [0.5, 0.42, 0.32], scaffold: [0.45, 0.35, 0.24], rubble: [0.55, 0.52, 0.48],
};
const matCache = new Map<string, THREE.MeshStandardNodeMaterial>();
export function material(m: Material) {
  let x = matCache.get(m);
  if (!x) { const [r, g, b] = ALBEDO[m]; x = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace), roughness: m === 'glazed' ? 0.35 : 0.9, metalness: 0 }); matCache.set(m, x); }
  return x;
}

export function prismGeometry(p: Prism): THREE.BufferGeometry {
  const shape = new THREE.Shape(p.polygon.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: p.y1 - p.y0, bevelEnabled: false });
  g.rotateX(-Math.PI / 2); // (e, n, h) → (e, h, −n)
  g.translate(0, p.y0, 0);
  return g.toNonIndexed();
}
export function boxGeometry(b: Box): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(b.size[0], b.y1 - b.y0, b.size[1]);
  g.rotateY(b.rot ?? 0); // grid CCW rotation = world rotation about +Y (x east, z = −north)
  g.translate(b.c[0], (b.y0 + b.y1) / 2, -b.c[1]);
  return g.toNonIndexed();
}

/** Column geometry in local space (base at y=0), greybox profile: base, torus, shaft (flute count as facets), capital blocks. */
export function columnGeometry(o: ColumnOrder, built = 1): THREE.BufferGeometry {
  const gs: THREE.BufferGeometry[] = [];
  const r = o.shaftD / 2, shaftH = o.height - o.baseH - o.capitalH;
  if (o.base === 'square2') { gs.push(new THREE.BoxGeometry(o.baseW * 1.25, o.baseH * 0.5, o.baseW * 1.25).translate(0, o.baseH * 0.25, 0), new THREE.BoxGeometry(o.baseW, o.baseH * 0.5, o.baseW).translate(0, o.baseH * 0.75, 0)); }
  else if (o.base === 'bell') { const pts = [0, 0.15, 0.35, 0.6, 0.8, 1].map((t, i) => new THREE.Vector2(o.baseW / 2 * (1 - 0.45 * t * t) + (i === 0 ? 0 : 0), t * o.baseH)); pts.unshift(new THREE.Vector2(0, 0)); pts.push(new THREE.Vector2(0, o.baseH)); gs.push(new THREE.LatheGeometry(pts, 24)); }
  else gs.push(new THREE.CylinderGeometry(r * 1.2, r * 1.3, o.baseH, 20).translate(0, o.baseH / 2, 0));
  gs.push(new THREE.TorusGeometry(r * 1.02, r * 0.14, 8, 24).rotateX(Math.PI / 2).translate(0, o.baseH + r * 0.1, 0));
  const sh = shaftH * built;
  if (sh > 0.01) gs.push(new THREE.CylinderGeometry(r * 0.93, r, sh, Math.max(12, o.flutes), 1).translate(0, o.baseH + sh / 2, 0));
  if (built >= 1 && o.capital !== 'none') {
    const y = o.baseH + shaftH;
    if (o.capital === 'plain') gs.push(new THREE.BoxGeometry(o.shaftD * 1.4, o.capitalH, o.shaftD * 1.4).translate(0, y + o.capitalH / 2, 0));
    else {
      const c1 = o.capitalH * 0.23, c2 = o.capitalH * 0.33, c3 = o.capitalH * 0.44;
      gs.push(new THREE.CylinderGeometry(r * 1.5, r * 0.95, c1, 20).translate(0, y + c1 / 2, 0)); // bell/palm
      gs.push(new THREE.BoxGeometry(o.shaftD * 1.25, c2, o.shaftD * 0.9).translate(0, y + c1 + c2 / 2, 0)); // volute block
      gs.push(new THREE.BoxGeometry(o.shaftD * 3.4, c3, o.shaftD * 1.1).translate(0, y + c1 + c2 + c3 / 2, 0)); // double protome (greybox)
    }
  }
  const nonIdx = gs.map(g => g.index ? g.toNonIndexed() : g);
  for (const g of nonIdx) { for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k); }
  return mergeGeometries(nonIdx)!;
}

export interface BuiltArch { group: THREE.Group; triangles: number; colliders: number }
export function buildMeshes(parts: Part[], phys?: Physics): BuiltArch {
  const group = new THREE.Group(); group.name = 'architecture';
  const byKey = new Map<string, { geos: THREE.BufferGeometry[]; parts: Part[] }>();
  const cols = new Map<string, { order: ColumnOrder; built: number; parts: Column[] }>();
  let colliders = 0;
  for (const p of parts) {
    if (p.type === 'column') {
      const k = `${p.building}|${p.order.id}|${p.order.base}|${p.order.capital}|${p.order.shaftD}|${p.built.toFixed(2)}`;
      if (!cols.has(k)) cols.set(k, { order: p.order, built: p.built, parts: [] }); cols.get(k)!.parts.push(p);
      if (phys) { phys.addBox({ x: p.c[0], y: p.y0 + (p.order.baseH + (p.order.height - p.order.baseH) * p.built) / 2, z: -p.c[1] }, { x: p.order.baseW / 2, y: (p.order.baseH + (p.order.height - p.order.baseH) * p.built) / 2, z: p.order.baseW / 2 }); colliders++; }
      continue;
    }
    const g = p.type === 'prism' ? prismGeometry(p) : boxGeometry(p);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    const key = `${p.building}|${p.material}|${p.tier}|${p.placeholder ? 1 : 0}`;
    if (!byKey.has(key)) byKey.set(key, { geos: [], parts: [] }); byKey.get(key)!.geos.push(g); byKey.get(key)!.parts.push(p);
    if (phys && p.solid !== false && p.kind !== 'roof') {
      const pos = g.getAttribute('position').array as Float32Array; const idx = new Uint32Array(pos.length / 3); for (let i = 0; i < idx.length; i++) idx[i] = i;
      phys.addTrimesh(new Float32Array(pos), idx, { building: p.building, kind: p.kind }); colliders++;
    }
  }
  let tris = 0;
  for (const [key, { geos, parts: ps }] of byKey) {
    const [building, mat, tier, ph] = key.split('|');
    const g = mergeGeometries(geos)!; tris += g.getAttribute('position').count / 3;
    const m = new THREE.Mesh(g, material(mat as Material)); m.castShadow = m.receiveShadow = true; m.name = `${building}:${mat}`;
    m.userData = { tier, src: [...new Set(ps.map(p => p.src))].join(';'), placeholder: ph === '1', note: `greybox (Phase 2): ${[...new Set(ps.map(p => p.kind))].join(', ')}`, building };
    group.add(m);
  }
  for (const [, c] of cols) {
    const g = columnGeometry(c.order, c.built); const im = new THREE.InstancedMesh(g, material(c.order.material), c.parts.length);
    const m4 = new THREE.Matrix4(); c.parts.forEach((p, i) => { m4.makeTranslation(p.c[0], p.y0, -p.c[1]); im.setMatrixAt(i, m4); });
    im.castShadow = im.receiveShadow = true; im.name = `${c.parts[0].building}:columns`;
    im.userData = { tier: c.parts[0].tier, src: c.parts[0].src, note: `column order ${c.order.id} (${c.order.base} base, ${c.order.capital} capital) — greybox profile, carving Phase 3${c.built < 1 ? '; under construction' : ''}`, building: c.parts[0].building };
    im.computeBoundingSphere(); tris += (g.getAttribute('position').count / 3) * c.parts.length;
    group.add(im);
  }
  return { group, triangles: tris, colliders };
}
