// Objects people hold while they work (activities.ts `prop`): spear, sack, jar, tablet, mallet, basket. Geometry per
// kind with vertex colours (tier notes in PROP_NOTES). All kinds are one instanced mesh (propUnionGeometry: each
// instance shows its own kind, the others collapse), placed from the hand bones each frame: one draw for every prop.
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
function paint(g: THREE.BufferGeometry, rgb: [number, number, number], metal = 0, rough = 0.8): THREE.BufferGeometry {
  const gg = g.index ? g.toNonIndexed() : g; if (gg.getAttribute('uv')) gg.deleteAttribute('uv');
  const n = gg.getAttribute('position').count, c = new Float32Array(n * 3), m = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { c.set(rgb.map(lin), i * 3); m.set([metal, rough], i * 2); }
  gg.setAttribute('color', new THREE.BufferAttribute(c, 3)); gg.setAttribute('mr', new THREE.BufferAttribute(m, 2)); return gg;
}
export const PROP_NOTES: Record<string, { tier: 'A' | 'B' | 'C'; note: string }> = {
  spear: { tier: 'B', note: 'long spear with a pomegranate-shaped butt counterweight, silver for the ordinary guards (Herodotus via IR-IMM; SUSA-ARCH); shaft length and blade C' },
  sack: { tier: 'B', note: 'sack on the shoulder (porters on the tribute reliefs carry skins and bags)' },
  jar: { tier: 'C', note: 'storage/water jar, plain buff ware (C)' },
  tablet: { tier: 'B', note: 'clay tablet (PF/PT tablets: A; size C)' },
  mallet: { tier: 'C', note: 'wooden mallet (NOT SEEN, C)' },
  basket: { tier: 'C', note: 'basket (C)' },
};
/** prop geometry, origin at the grip (spear: at the butt, which rests on the ground) */
export function propGeometry(kind: string): THREE.BufferGeometry | null {
  switch (kind) {
    case 'spear': { // shaft 2.1 m, bronze blade, silver pomegranate butt (sphere with a small crown), C proportions
      const shaft = paint(new THREE.CylinderGeometry(0.014, 0.016, 2.1, 6).translate(0, 1.13, 0), [0.45, 0.33, 0.21], 0, 0.7);
      const socket = paint(new THREE.CylinderGeometry(0.017, 0.014, 0.08, 6).translate(0, 2.21, 0), [0.62, 0.45, 0.26], 1, 0.4);
      const blade = paint(new THREE.ConeGeometry(0.028, 0.26, 4).scale(1, 1, 0.35).translate(0, 2.38, 0), [0.62, 0.45, 0.26], 1, 0.35);
      const butt = paint(new THREE.SphereGeometry(0.045, 10, 8).translate(0, 0.05, 0), [0.8, 0.8, 0.78], 1, 0.3);
      const crown = paint(new THREE.CylinderGeometry(0.012, 0.022, 0.03, 6).translate(0, 0.1, 0), [0.8, 0.8, 0.78], 1, 0.3);
      return mergeGeometries([shaft, socket, blade, butt, crown])!;
    }
    case 'sack': return paint(new THREE.SphereGeometry(0.22, 10, 7).scale(1, 0.75, 0.7), [0.62, 0.55, 0.42], 0, 0.95);
    case 'jar': return paint(new THREE.LatheGeometry([[0, 0], [0.1, 0.02], [0.16, 0.18], [0.12, 0.36], [0.06, 0.42], [0.07, 0.46]].map(([x, y]) => new THREE.Vector2(x, y)), 14), [0.66, 0.46, 0.3], 0, 0.85);
    case 'tablet': return paint(new THREE.BoxGeometry(0.06, 0.02, 0.05), [0.56, 0.48, 0.37], 0, 0.9);
    case 'mallet': return mergeGeometries([paint(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6).translate(0, -0.15, 0), [0.42, 0.31, 0.2], 0, 0.7), paint(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8).rotateZ(Math.PI / 2).translate(0, -0.3, 0), [0.4, 0.29, 0.18], 0, 0.7)])!;
    case 'basket': return paint(new THREE.CylinderGeometry(0.18, 0.13, 0.18, 12, 1, true), [0.6, 0.52, 0.32], 0, 0.9);
    default: return null;
  }
}
export const PROP_KINDS = ['spear', 'sack', 'jar', 'tablet', 'mallet', 'basket'] as const;
/** every prop kind in one geometry, with the kind's index per vertex ('pk'); an instance shows the kind whose index it
 *  carries ('ik') and the other kinds' vertices collapse to a point (572 triangles per instance, most of them empty) */
export function propUnionGeometry(): THREE.BufferGeometry {
  return mergeGeometries(PROP_KINDS.map((k, i) => { const g = propGeometry(k)!.clone(); const n = g.getAttribute('position').count;
    g.setAttribute('pk', new THREE.BufferAttribute(new Float32Array(n).fill(i), 1)); return g; }))!;
}
/** a box painted for the prop material (work objects) */
export function paintedBox(w: number, h: number, d: number, rgb: [number, number, number], rough: number) { return paint(new THREE.BoxGeometry(w, h, d).translate(0, h / 2, 0), rgb, 0, rough); }
