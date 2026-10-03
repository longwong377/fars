// D-803 batch 5: the building sites of 467 (the Hall of 100 Columns and the Tripylon, their walls standing at a third and a half
// of their height: terrace.ts) dressed as work in progress from tools/blender/terracekit.py's site pieces (src/arch/terracekit.json;
// modelled and AO-baked in Blender). The review's "flat beige slab of wall, capitals floating on sticks behind it" (s18 cov-252):
//  - the wall heads: the brick gangs' courses racked up in stretches over the flat top (each stretch 2-8 courses of ~33 cm mud
//    brick on its mud bed, stepped back a brick a course at its ends, as an unfinished brick wall is left), the bricks modelled;
//  - stacks of brick on the wall tops waiting to be laid; putlog scaffolds of poles and boards against the faces where a gang
//    works; pole ladders leaning on the walls;
//  - the first cedar main beams laid in the saddles of the raised capitals (between two raised neighbours along a column row,
//    ceilings.ts's beam: along grid y, 0.55 D wide, 0.75 D deep).
// Every form and placement C (no evidence of the method: D-022). Render only: no colliders (the player walks through a scaffold's
// poles: noted), not parts (the parts hash, nav and probes unchanged). Deterministic (seeded per wall).
import * as THREE from 'three/webgpu';
import type { Part, Box, Column } from './parts';
import { kitGeometry, TERRACE_KIT, NEAR_CAP } from './terracekit';
import { PieceLOD } from './palacekit';
import { propMaterial } from '../render/materials';
import { CEILING } from './ceilings';
import { Rng } from '../core/rng';

const BRICK = 0.333, COURSE = 0.12, DECK = 5.53; // (terracekit.py: the brick, the course, the scaffold's deck height)
const UC = /under construction/;
export interface SitePlan { pieces: Map<string, THREE.Matrix4[]>; courses: number; beams: number }

const Y = new THREE.Vector3(0, 1, 0);
/** the plan of every under-construction wall's site pieces and the beams on the raised capitals */
export function sitePlan(parts: Part[]): SitePlan {
  const pieces = new Map<string, THREE.Matrix4[]>(), put = (k: string, m: THREE.Matrix4) => (pieces.get(k) ?? pieces.set(k, []).get(k)!).push(m);
  let courses = 0;
  const walls = parts.filter(p => p.type === 'box' && p.kind === 'wall' && p.material.startsWith('mudbrick') && UC.test(p.note ?? '')) as Box[];
  walls.forEach((w, wi) => {
    const rng = new Rng(803 + wi, 'site'), r = () => rng.next(), rot = w.rot ?? 0;
    const alongE = w.size[0] >= w.size[1], L = alongE ? w.size[0] : w.size[1], T = alongE ? w.size[1] : w.size[0];
    // world (three) frame: X̂ along the wall, Ẑ = X̂ × Y across it
    const ang = alongE ? rot : rot + Math.PI / 2, Xh = new THREE.Vector3(Math.cos(ang), 0, -Math.sin(ang)), Zh = new THREE.Vector3().crossVectors(Xh, Y).normalize();
    const C = new THREE.Vector3(w.c[0], w.y1, -w.c[1]), corner = C.clone().addScaledVector(Xh, -L / 2).addScaledVector(Zh, -T / 2);
    // the gangs' stretches: one per ~7 m, 2-8 courses up, racked back a brick per course beyond their ends
    const k = Math.max(1, Math.round(L / 7)), sec = Array.from({ length: k }, (_, i) => ({ c: (i + 0.5) * L / k + (r() - 0.5) * 1.5, h: 1.0 + 1.8 * r(), lv: 2 + Math.floor(7 * r()) }));
    const H = (s: number) => Math.max(0, ...sec.map(q => q.lv - Math.ceil(Math.max(0, Math.abs(s - q.c) - q.h) / BRICK)));
    const nC = Math.max(1, Math.round(L / BRICK)), cell = L / nC, nA = Math.max(1, Math.round(T)), sz = T / nA, sx = cell / BRICK;
    const hs = Array.from({ length: nC }, (_, i) => H((i + 0.5) * cell)), top = Math.max(...hs);
    const course = (name: string, i0: number, kk: number) => { for (let j = 0; j < nA; j++) {
      const o = corner.clone().addScaledVector(Xh, i0 * cell).addScaledVector(Zh, j * sz).setY(w.y1 + (kk - 1) * COURSE);
      put(name, new THREE.Matrix4().makeBasis(Xh.clone().multiplyScalar(sx), Y, Zh.clone().multiplyScalar(sz)).setPosition(o)); } };
    for (let kk = 1; kk <= top; kk++) for (let i = 0; i < nC;) {
      if (hs[i] < kk) { i++; continue; } let j = i; while (j < nC && hs[j] >= kk) j++;
      let q = i; for (; q + 3 <= j; q += 3) { course(['course0', 'course1'][(q + kk) % 2], q, kk); courses++; } for (; q < j; q++) course('courseE0', q, kk);
      i = j;
    }
    // per stretch: a stack of brick on the low top beside it, a scaffold on one face, a ladder at its end
    sec.forEach((q, si) => {
      const sS = Math.min(L - 1.6, q.c + q.h + 1.3 + 0.4 * r());
      if (sS > 0.2 && T > 1.6) { const at = corner.clone().addScaledVector(Xh, sS).addScaledVector(Zh, (T - 1.05) / 2).setY(w.y1 + H(sS + 0.7) * COURSE);
        put('stack0', new THREE.Matrix4().makeBasis(Xh, Y, Zh).setPosition(at)); }
      const side = (wi + si) % 2 ? 1 : -1, Zf = Zh.clone().multiplyScalar(side), Xf = new THREE.Vector3().crossVectors(Y, Zf).normalize();
      const face = C.clone().addScaledVector(Zh, side * T / 2); // (the face's mid-point at the wall top)
      if (r() < 0.75) { // the scaffold: bays of 2.4 m at 2.7 m, the poles from 3 m under the wall's foot (sunk out of sight where the ground is higher), the deck under the top
        const nb = Math.max(1, Math.round((2 * q.h) / 2.7)), y0 = w.y0 - 3, ys = (w.y1 - 0.15 - y0) / DECK;
        for (let b = 0; b < nb; b++) { const s = q.c + (b - (nb - 1) / 2) * 2.7 - 1.2; if (s < 0.3 || s > L - 2.7) continue;
          const at = face.clone().addScaledVector(Xh, s - L / 2).setY(y0), ox = Xf.dot(Xh) > 0 ? 0 : 2.4; at.addScaledVector(Xh, ox);
          put('scaffold0', new THREE.Matrix4().makeBasis(Xf, new THREE.Vector3(0, ys, 0), Zf).setPosition(at)); }
      }
      const sL = q.c - q.h - 1.2; if (sL > 0.5 && sL < L - 0.5) { // the ladder: its foot 1.6 m out at the wall's foot, its top 0.8 m over the wall top
        const foot = face.clone().addScaledVector(Xh, sL - L / 2).addScaledVector(Zf, 1.6).setY(w.y0 - 0.5), tip = face.clone().addScaledVector(Xh, sL - L / 2).setY(w.y1 + 0.8);
        const D = tip.clone().sub(foot), len = D.length(), Xl = Xh.clone(), Yl = D.multiplyScalar(1 / 6), Zl = new THREE.Vector3().crossVectors(Xl, Yl).normalize();
        put('ladder0', new THREE.Matrix4().makeBasis(Xl, Yl, Zl).setPosition(foot)); void len; }
    });
  });
  // the main beams on the raised capitals: two raised neighbours along a column row (grid y), the beam over both, 0.5 m beyond
  let beams = 0;
  const cols = parts.filter(p => p.type === 'column' && p.built >= 1 && (p.building === 'hall100' || p.building === 'tripylon')) as Column[];
  const key = (e: number, n: number) => `${e.toFixed(1)}|${n.toFixed(1)}`, at = new Map(cols.map(c => [key(c.c[0], c.c[1]), c]));
  for (const c of cols) {
    const ia = 6.23, d = cols.find(q => q !== c && Math.abs(q.c[0] - c.c[0]) < 0.05 && q.c[1] > c.c[1] && q.c[1] - c.c[1] < ia + 0.3 && q.c[1] - c.c[1] > 3);
    if (!d || !at.has(key(c.c[0], c.c[1]))) continue;
    const D = c.order.shaftD, bw = CEILING.beamW * D, bd = CEILING.beamD * D, top = c.y0 + c.order.height, n0 = c.c[1] - 0.5, len = d.c[1] + 0.5 - n0;
    const X = new THREE.Vector3(0, 0, -len), Yb = new THREE.Vector3(0, bd, 0), Z = new THREE.Vector3(bw, 0, 0);
    put('beam0', new THREE.Matrix4().makeBasis(X, Yb, Z).setPosition(c.c[0], top - bd, -n0)); beams++;
  }
  return { pieces, courses, beams };
}

const FAR: Record<string, string> = { course0: 'courseL', course1: 'courseL', courseE0: 'courseEL', stack0: 'stackL', scaffold0: 'scaffoldL', ladder0: 'ladderL', beam0: 'beamL' };
const NOTE: Record<string, string> = {
  course: 'mud-brick courses racked up over the unfinished wall top (~33 cm bricks on mud beds, the joints recessed), the brick gangs\' work in progress',
  stack: 'mud bricks stacked on the wall top, waiting to be laid', scaffold: 'putlog scaffold of poles, ledgers and boards against the wall',
  ladder: 'pole ladder leaning on the wall', beam: 'cedar main beam laid in the saddles of two raised capitals (ceilings.ts sizes)',
};
/** the site pieces as near/far instanced levels (the bricks on the mud material the kit compiles; the timber on wood) */
export function buildSiteKit(parts: Part[]): { group: THREE.Group; triangles: number; plan: SitePlan } {
  const plan = sitePlan(parts), group = new THREE.Group(); group.name = 'sitekit'; let triangles = 0;
  const mud = propMaterial('mud', { vertexColors: true }), wood = propMaterial('wood', { vertexColors: true });
  for (const [name, mats] of plan.pieces) {
    const far = FAR[name], kind = name.replace(/E?\d+$/, '');
    const lod = new PieceLOD([kitGeometry(name), kitGeometry(far)], kind === 'course' || kind === 'stack' ? mud : wood, mats); lod.name = `sitekit:${name}`;
    lod.userData = { tier: 'C', src: 'RECON;D-022', placeholder: false, model: 'terracekit', note: `${NOTE[kind]} (form and placement C, D-022: no evidence of the method; modelled and AO-baked in Blender, tools/blender/terracekit.py; D-803)` };
    lod.levels.forEach((im, k) => { im.name = `${lod.name}:lod${k}`; im.userData = lod.userData; });
    triangles += TERRACE_KIT[far].tris * mats.length + (TERRACE_KIT[name].tris - TERRACE_KIT[far].tris) * Math.min(mats.length, NEAR_CAP);
    group.add(lod);
  }
  return { group, triangles, plan };
}
