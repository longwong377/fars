// The Apadana's glazed brick (D-214; gap audit item 28): 'many glazed bricks' of the Apadana carried Xerxes' XPg (LIVIUS-AI,
// B), and glazed-brick fragments from Persepolis have yellow (lead antimonate), grey and green (copper) glazes with colour
// fields separated by lines (Stein et al. 2016 via RELIEF-R, B). Where the bricks were set is not read. Drawn after the Susa
// friezes (recollection, C): one band of rosettes between plain border courses round the outer faces of the four corner
// towers, high under their tops (apadana.r_glazed_frieze). No figured panels: none is reported from Persepolis. One mesh,
// vertex-coloured, on the glazed-brick surface; not an architecture part (the parts hash and the probes are unchanged).
import * as THREE from 'three/webgpu';
import { v, present } from './spec';
import type { Part, Box } from './parts';
import { surfaceMaterial } from '../render/materials';

export interface FriezeFace { tower: string; c: [number, number]; n: [number, number]; length: number; y0: number; y1: number }
/** the outer faces of the Apadana's corner towers that carry the frieze, and the band's heights */
export function friezeFaces(parts: Part[]): FriezeFace[] {
  if (!present('apadana')) return [];
  const F = v<any>('apadana', 'r_glazed_frieze'), out: FriezeFace[] = [];
  const towers = parts.filter(p => p.building === 'apadana' && p.kind === 'tower' && p.type === 'box' && !(p as Box).rot) as Box[];
  for (const t of towers) {
    const y1 = t.y1 - F.top_below, y0 = y1 - F.courses * F.course, tag = `${t.c[1] > 0 ? 'N' : 'S'}${t.c[0] > 0 ? 'E' : 'W'}`;
    for (const [nx, ny] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as [number, number][]) {
      const c: [number, number] = [t.c[0] + nx * t.size[0] / 2, t.c[1] + ny * t.size[1] / 2], length = nx ? t.size[1] : t.size[0];
      out.push({ tower: tag, c, n: [nx, ny], length, y0, y1 });
    }
  }
  return out;
}
/** linear-light RGB of an sRGB triple */
const linRGB = (s: number[]) => { const c = new THREE.Color().setRGB(s[0], s[1], s[2], THREE.SRGBColorSpace); return [c.r, c.g, c.b]; };

export function buildGlazedFrieze(parts: Part[]): THREE.Mesh | null {
  const faces = friezeFaces(parts); if (!faces.length) return null;
  const F = v<any>('apadana', 'r_glazed_frieze'), G = F.glaze, ground = linRGB(G.ground), figure = linRGB(G.figure), line = linRGB(G.line);
  const pos: number[] = [], nor: number[] = [], col: number[] = [];
  let rosettes = 0;
  for (const f of faces) {
    // the face frame (world): Z out of the face, X = Y × Z along it, origin at the face centre at the band's foot
    const Z = new THREE.Vector3(f.n[0], 0, -f.n[1]), Y = new THREE.Vector3(0, 1, 0), X = new THREE.Vector3().crossVectors(Y, Z), O = new THREE.Vector3(f.c[0], f.y0, -f.c[1]);
    const P = (x: number, y: number, z: number) => O.clone().addScaledVector(X, x).addScaledVector(Y, y).addScaledVector(Z, z);
    const tri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, rgb: number[], n: THREE.Vector3) => { for (const p of [a, b, c]) { pos.push(p.x, p.y, p.z); nor.push(n.x, n.y, n.z); col.push(rgb[0], rgb[1], rgb[2]); } };
    const quad = (x0: number, y0: number, x1: number, y1: number, z: number, rgb: number[]) => { tri(P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), rgb, Z); tri(P(x0, y0, z), P(x1, y1, z), P(x0, y1, z), rgb, Z); };
    // the band: its face `proud` in front of the wall, the border courses and the ground between them; its top, bottom and
    // ends as thin faces (run past the corners by `proud`, so the bands of two faces meet)
    const L = f.length / 2 + F.proud, H = F.courses * F.course, b = F.border_courses * F.course, z = F.proud;
    quad(-L, 0, L, b, z, figure); quad(-L, H - b, L, H, z, figure); quad(-L, b, L, H - b, z, ground);
    for (const yy of [b, H - b]) quad(-L, yy - 0.012, L, yy + 0.012, z + 0.002, line); // the dividing lines between the colour fields (raised 2 mm)
    tri(P(-L, H, 0), P(L, H, z), P(L, H, 0), figure, Y); tri(P(-L, H, 0), P(-L, H, z), P(L, H, z), figure, Y); // top
    tri(P(-L, 0, 0), P(L, 0, 0), P(L, 0, z), figure, Y.clone().negate()); tri(P(-L, 0, 0), P(L, 0, z), P(-L, 0, z), figure, Y.clone().negate()); // underside
    // the rosettes, centred in the ground at `pitch`: petals from a small ring out to the rim, raised `relief`; a grey centre
    const R = F.rosette_d / 2, k = Math.floor((f.length - F.rosette_d) / F.pitch) + 1, a0 = -((k - 1) * F.pitch) / 2, yc = H / 2, zr = z + F.relief, np = F.petals;
    for (let i = 0; i < k; i++) {
      const cx = a0 + i * F.pitch; rosettes++;
      const at = (r: number, th: number, zz: number) => P(cx + r * Math.cos(th), yc + r * Math.sin(th), zz);
      for (let j = 0; j < np; j++) {
        const th = (j / np) * 2 * Math.PI, d = Math.PI / np * 0.8;
        tri(at(R * 0.16, th, zr), at(R * 0.62, th - d, zr), at(R, th, zr), figure, Z); tri(at(R * 0.16, th, zr), at(R, th, zr), at(R * 0.62, th + d, zr), figure, Z);
      }
      for (let j = 0; j < np; j++) { const t0 = (j / np) * 2 * Math.PI, t1 = ((j + 1) / np) * 2 * Math.PI; tri(at(0, 0, zr + 0.001), at(R * 0.2, t0, zr + 0.001), at(R * 0.2, t1, zr + 0.001), line, Z); }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeBoundingBox(); g.computeBoundingSphere();
  const m = new THREE.Mesh(g, surfaceMaterial('glazed', { vertexColors: true })); m.name = 'apadana-glazed-frieze'; m.castShadow = false; m.receiveShadow = true;
  m.userData = { tier: 'C', src: 'RELIEF-R;STEIN2016;SUSA-GLAZE;LIVIUS-AI;RECON', placeholder: false, faces: faces.length, rosettes, tris: pos.length / 9,
    note: `glazed-brick frieze of the Apadana (D-214, apadana.r_glazed_frieze): ${rosettes} rosettes on ${faces.length} tower faces; glazed brick at the Apadana and its colours (green, yellow, grey) B (Stein et al. 2016; 'many glazed bricks' carried XPg); the frieze's place, its layout after the Susa friezes, rosette size and pitch C (Q-425); no figured panels (none reported from Persepolis)` };
  return m;
}
