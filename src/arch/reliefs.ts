// Apadana stair reliefs (Phase 3): façade programme from SITE_SPEC apadana.relief_programme (B/C), procedural low-relief
// figures (PLACEHOLDER silhouettes pending licensed scans, NEEDS #10), painted per research/RELIEFS_AND_COLOUR.md:
// hair/beard dark blue (B); garments from the attested pigment palette (colour-per-figure C); background unpainted (no evidence).
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { v } from './spec';
import { Rng } from '../core/rng';

type C3 = [number, number, number];
// attested pigments (research §3a), as linear-ish display colours (C for exact tone)
export const PIGMENT: Record<string, C3> = {
  stone: [0.56, 0.55, 0.52], egyptianBlue: [0.13, 0.28, 0.62], darkBlue: [0.07, 0.1, 0.25], cinnabar: [0.72, 0.13, 0.08], redOchre: [0.55, 0.2, 0.12],
  malachite: [0.18, 0.5, 0.33], yellowOchre: [0.78, 0.6, 0.25], white: [0.9, 0.88, 0.83], black: [0.05, 0.05, 0.05], purple: [0.35, 0.12, 0.32], gold: [0.83, 0.66, 0.3],
};
const S = (pts: number[][]) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
const ellipse = (cx: number, cy: number, rx: number, ry: number, n = 16) => S(Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((i / n) * Math.PI * 2), cy + ry * Math.sin((i / n) * Math.PI * 2)]));
interface Piece { shape: THREE.Shape; colour: C3; depth: number; z?: number }

/** Build one figure type; local frame: x = walking direction, y = up, z = out of the wall. Height ~0.78 m. */
export function figurePieces(kind: string, rng: Rng): Piece[] {
  const d = v('apadana', 'r_relief_depth');
  const garments = [PIGMENT.cinnabar, PIGMENT.egyptianBlue, PIGMENT.malachite, PIGMENT.yellowOchre, PIGMENT.purple, PIGMENT.redOchre];
  const g1 = rng.pick(garments), g2 = rng.pick(garments);
  const P: Piece[] = [];
  const head = (hy: number, hat: 'fluted' | 'cap' | 'band' | 'pointed' | 'none') => {
    P.push({ shape: ellipse(0.02, hy, 0.055, 0.065), colour: PIGMENT.stone, depth: d });
    P.push({ shape: S([[-0.06, hy + 0.01], [0.0, hy + 0.035], [0.0, hy - 0.02], [-0.03, hy - 0.11], [-0.05, hy - 0.1]]), colour: PIGMENT.darkBlue, depth: d * 1.05, z: 0.001 }); // hair at nape
    P.push({ shape: S([[0.0, hy - 0.03], [0.07, hy - 0.035], [0.05, hy - 0.13], [-0.01, hy - 0.12]]), colour: PIGMENT.darkBlue, depth: d * 1.05, z: 0.001 }); // beard
    if (hat === 'fluted') P.push({ shape: S([[-0.055, hy + 0.04], [0.065, hy + 0.04], [0.075, hy + 0.13], [-0.065, hy + 0.13]]), colour: g2, depth: d });
    if (hat === 'cap') P.push({ shape: S([[-0.07, hy + 0.02], [0.07, hy + 0.02], [0.05, hy + 0.1], [-0.02, hy + 0.12], [-0.08, hy + 0.05]]), colour: g2, depth: d });
    if (hat === 'pointed') P.push({ shape: S([[-0.06, hy + 0.03], [0.06, hy + 0.03], [-0.03, hy + 0.2]]), colour: g2, depth: d });
    if (hat === 'band') P.push({ shape: S([[-0.057, hy + 0.02], [0.06, hy + 0.02], [0.06, hy + 0.045], [-0.057, hy + 0.045]]), colour: g2, depth: d * 1.08, z: 0.001 });
  };
  const robe = (colour: C3, long: boolean) => {
    const hem = long ? 0.04 : 0.3;
    P.push({ shape: S([[-0.08, 0.6], [0.09, 0.6], [0.13, hem], [-0.15, hem]]), colour, depth: d });
    P.push({ shape: S([[-0.075, 0.58], [0.085, 0.58], [0.1, 0.42], [-0.08, 0.42]]), colour, depth: d * 1.1, z: 0.001 }); // chest / sleeves
    if (long) for (let i = 0; i < 5; i++) { const x = -0.12 + i * 0.05; P.push({ shape: S([[x, 0.05], [x + 0.012, 0.05], [x + 0.02, 0.35], [x + 0.008, 0.35]]), colour: [colour[0] * 0.8, colour[1] * 0.8, colour[2] * 0.8], depth: d * 1.12, z: 0.002 }); } // pleats
    if (!long) { P.push({ shape: S([[-0.09, 0.3], [-0.04, 0.3], [-0.05, 0.03], [-0.085, 0.03]]), colour: g2, depth: d }); P.push({ shape: S([[0.02, 0.3], [0.08, 0.3], [0.07, 0.03], [0.035, 0.03]]), colour: g2, depth: d }); } // trousers
    P.push({ shape: S([[-0.15, 0.0], [0.02, 0.0], [0.02, 0.04], [-0.14, 0.04]]), colour: PIGMENT.stone, depth: d }); // feet
    P.push({ shape: S([[0.0, 0.0], [0.16, 0.0], [0.15, 0.04], [0.02, 0.04]]), colour: PIGMENT.stone, depth: d });
  };
  const arm = (fwd: number) => P.push({ shape: S([[0.04, 0.57], [0.08, 0.56], [0.08 + fwd, 0.42], [0.05 + fwd, 0.4]]), colour: g1, depth: d * 1.15, z: 0.003 });
  switch (kind) {
    case 'persian': robe(g1, true); head(0.69, 'fluted'); arm(0.06); break;
    case 'mede': robe(g1, false); head(0.69, 'cap'); arm(0.06); P.push({ shape: S([[-0.14, 0.52], [-0.1, 0.52], [-0.12, 0.25], [-0.16, 0.26]]), colour: PIGMENT.yellowOchre, depth: d * 1.1, z: 0.003 }); break; // gorytos
    case 'guard': robe(g1, true); head(0.69, 'fluted'); P.push({ shape: S([[0.12, 0.0], [0.135, 0.0], [0.135, 1.02], [0.12, 1.02]]), colour: PIGMENT.stone, depth: d * 1.2, z: 0.004 }); // spear
      P.push({ shape: ellipse(0.1275, 0.02, 0.03, 0.03, 10), colour: PIGMENT.gold, depth: d * 1.25, z: 0.004 }); // pomegranate butt (B)
      arm(0.05); break;
    case 'usher': robe(g1, rng.chance(0.5)); head(0.69, rng.chance(0.5) ? 'fluted' : 'cap'); P.push({ shape: S([[0.08, 0.56], [0.2, 0.47], [0.21, 0.44], [0.08, 0.5]]), colour: g1, depth: d * 1.15, z: 0.003 }); break;
    case 'delegate': { const long = rng.chance(0.5); robe(g1, long); head(0.69, rng.pick(['band', 'pointed', 'cap', 'none'] as const)); arm(0.12);
      P.push(rng.chance(0.5) ? { shape: ellipse(0.2, 0.47, 0.06, 0.05, 12), colour: PIGMENT.gold, depth: d * 1.3, z: 0.004 } : { shape: S([[0.14, 0.52], [0.26, 0.52], [0.25, 0.4], [0.15, 0.4]]), colour: g2, depth: d * 1.25, z: 0.004 }); break; }
    case 'horse': P.push({ shape: S([[-0.35, 0.28], [0.2, 0.3], [0.33, 0.48], [0.4, 0.46], [0.3, 0.3], [0.28, 0.02], [0.23, 0.02], [0.18, 0.2], [-0.2, 0.2], [-0.25, 0.02], [-0.3, 0.02], [-0.33, 0.2], [-0.4, 0.3]]), colour: PIGMENT.yellowOchre, depth: d }); break;
    case 'bull': P.push({ shape: S([[-0.35, 0.22], [0.18, 0.3], [0.32, 0.36], [0.38, 0.3], [0.28, 0.2], [0.26, 0.02], [0.2, 0.02], [0.16, 0.14], [-0.2, 0.14], [-0.25, 0.02], [-0.3, 0.02], [-0.33, 0.14]]), colour: PIGMENT.yellowOchre, depth: d }); P.push({ shape: ellipse(0.02, 0.34, 0.08, 0.06, 10), colour: PIGMENT.yellowOchre, depth: d }); break; // humped
    case 'camel': P.push({ shape: S([[-0.35, 0.35], [-0.2, 0.5], [-0.05, 0.42], [0.08, 0.5], [0.2, 0.36], [0.3, 0.55], [0.37, 0.55], [0.3, 0.3], [0.25, 0.02], [0.2, 0.02], [0.17, 0.25], [-0.22, 0.25], [-0.26, 0.02], [-0.31, 0.02], [-0.33, 0.25]]), colour: PIGMENT.yellowOchre, depth: d }); break;
    case 'ram': P.push({ shape: S([[-0.2, 0.12], [0.1, 0.18], [0.2, 0.28], [0.26, 0.22], [0.18, 0.12], [0.16, 0.01], [0.12, 0.01], [0.1, 0.08], [-0.12, 0.08], [-0.15, 0.01], [-0.19, 0.01], [-0.22, 0.1]]), colour: PIGMENT.yellowOchre, depth: d }); break;
    case 'lion': P.push({ shape: S([[-0.4, 0.3], [0.1, 0.34], [0.22, 0.46], [0.36, 0.44], [0.4, 0.34], [0.3, 0.28], [0.28, 0.02], [0.22, 0.02], [0.18, 0.18], [-0.22, 0.18], [-0.28, 0.02], [-0.34, 0.02], [-0.36, 0.2], [-0.5, 0.36], [-0.46, 0.3]]), colour: PIGMENT.yellowOchre, depth: d }); P.push({ shape: ellipse(0.24, 0.4, 0.12, 0.1, 12), colour: PIGMENT.yellowOchre, depth: d * 1.2, z: 0.002 }); break; // mane
    case 'king': // seated king on throne with footstool (audience scene): scale is applied by the placement
      P.push({ shape: S([[-0.2, 0.0], [0.14, 0.0], [0.14, 0.34], [0.1, 0.36], [-0.16, 0.36], [-0.2, 0.34]]), colour: PIGMENT.stone, depth: d * 0.8 }); // throne
      P.push({ shape: S([[-0.18, 0.36], [-0.16, 0.8], [-0.2, 0.8], [-0.22, 0.36]]), colour: PIGMENT.stone, depth: d * 0.8 }); // backrest
      P.push({ shape: S([[0.15, 0.0], [0.32, 0.0], [0.32, 0.08], [0.15, 0.08]]), colour: PIGMENT.stone, depth: d * 0.8 }); // footstool
      P.push({ shape: S([[-0.12, 0.34], [0.08, 0.36], [0.26, 0.34], [0.28, 0.1], [0.2, 0.08], [0.16, 0.28], [-0.1, 0.3]]), colour: PIGMENT.purple, depth: d }); // lap & legs in robe
      P.push({ shape: S([[-0.12, 0.34], [0.06, 0.34], [0.07, 0.68], [-0.1, 0.68]]), colour: PIGMENT.purple, depth: d }); // torso (royal robe red/purple, B)
      P.push({ shape: S([[-0.13, 0.33], [0.08, 0.33], [0.08, 0.36], [-0.13, 0.36]]), colour: PIGMENT.egyptianBlue, depth: d * 1.1, z: 0.001 }); // blue hem band (B)
      P.push({ shape: S([[0.04, 0.62], [0.24, 0.5], [0.25, 0.47], [0.05, 0.56]]), colour: PIGMENT.purple, depth: d * 1.15, z: 0.003 }); // arm with sceptre
      P.push({ shape: S([[0.23, 0.2], [0.245, 0.2], [0.26, 0.72], [0.245, 0.72]]), colour: PIGMENT.gold, depth: d * 1.2, z: 0.004 }); // sceptre
      break;
    case 'cypress': P.push({ shape: S([[-0.06, 0.0], [0.06, 0.0], [0.07, 0.25], [0.05, 0.55], [0.0, 0.8], [-0.05, 0.55], [-0.07, 0.25]]), colour: PIGMENT.malachite, depth: d * 0.9 }); break;
  }
  return P;
}

export function figureGeometry(pieces: Piece[], mirror: boolean): THREE.BufferGeometry {
  const gs = pieces.map(p => {
    const g = new THREE.ExtrudeGeometry(p.shape, { depth: p.depth, bevelEnabled: true, bevelThickness: p.depth * 0.35, bevelSize: 0.006, bevelSegments: 2, curveSegments: 6 });
    g.translate(0, 0, p.z ?? 0);
    if (mirror) g.scale(-1, 1, 1);
    const n = g.getAttribute('position').count; const col = new Float32Array(n * 3);
    const c = new THREE.Color().setRGB(p.colour[0], p.colour[1], p.colour[2], THREE.SRGBColorSpace);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.deleteAttribute('uv');
    return g.index ? g.toNonIndexed() : g;
  });
  const g = mergeGeometries(gs)!;
  if (mirror) { // restore winding after the mirror
    const pos = g.getAttribute('position'), nor = g.getAttribute('normal'), col = g.getAttribute('color');
    for (let i = 0; i < pos.count; i += 3) for (const a of [pos, nor, col]) { for (let k = 0; k < a.itemSize; k++) { const t = a.array[(i + 1) * a.itemSize + k]; (a.array as any)[(i + 1) * a.itemSize + k] = a.array[(i + 2) * a.itemSize + k]; (a.array as any)[(i + 2) * a.itemSize + k] = t; } }
  }
  return g;
}

export interface Facade { id: 'N' | 'E'; origin: [number, number]; along: [number, number]; normal: [number, number]; length: number; y0: number; height: number }
export interface Span { a0: number; a1: number; type: 'flight' | 'landing'; rise: 1 | -1 }
export interface Placement { kind: string; variant: number; along: number; y: number; facing: 1 | -1; scale: number; tilt?: number }
export interface StairGeom { spans: Span[]; riser: number; tread: number; parapet: number; podium: number }

/** Plan the reliefs on one façade from the stair spans (all dimensions from SITE_SPEC via the terrace manifest).
 *  Viewer's left → right = −L/2 → +L/2. Outer landings carry the registers (delegations on one wing, nobles/guards on the
 *  other, per apadana.relief_programme). Flights carry a lion-and-bull combat in the triangle under the slope and a
 *  cypress row along the parapet. The central landing carries the audience panel (placed by decor.ts). */
export function planFacade(f: Facade, g: StairGeom): { figures: Placement[]; rosettes: { a: number; y: number }[] } {
  const prog = v<any>('apadana', 'relief_programme')[f.id], R = v<any>('apadana', 'r_registers'), sp = v('apadana', 'r_figure_spacing');
  const RS = v<any>('apadana', 'r_rosette'), CY = v<any>('apadana', 'r_cypress_band');
  const out: Placement[] = [], ros: { a: number; y: number }[] = [], rng = new Rng(1, 'relief-' + f.id), nDel = v('apadana', 'r_delegation_members');
  const DELEG = ['mede', 'bull', 'horse', 'delegate', 'bull', 'delegate', 'camel', 'ram', 'delegate', 'delegate', 'horse', 'delegate', 'camel', 'bull', 'camel', 'horse', 'delegate', 'delegate', 'horse', 'camel', 'bull', 'delegate', 'delegate'];
  const wings = g.spans.filter(s => s.type === 'landing' && Math.abs((s.a0 + s.a1) / 2) > 1);
  let delegIdx = 0;
  for (const w of wings) {
    const wing = (w.a0 + w.a1) / 2 < 0 ? 'left' : 'right'; const content = prog[wing + '_wing'];
    const facing: 1 | -1 = wing === 'left' ? 1 : -1; // processions walk toward the centre
    const nReg = R.count;
    for (let r = 0; r < nReg; r++) {
      const y = R.bottom + r * (R.height + R.gap);
      for (let a = w.a0 + RS.pitch / 2; a < w.a1; a += RS.pitch) ros.push({ a, y: y - R.gap / 2 }); // band under each register
      if (content === 'nobles') {
        let k = 0; for (let a = w.a0 + sp / 2; a < w.a1 - sp / 2; a += sp, k++) out.push({ kind: r === 0 ? 'guard' : (k % 2 ? 'mede' : 'persian'), variant: rng.int(0, 5), along: a, y, facing, scale: 1 });
      } else {
        const perReg = Math.ceil(DELEG.length / (nReg * wings.filter(x => prog[((x.a0 + x.a1) / 2 < 0 ? 'left' : 'right') + '_wing'] !== 'nobles').length));
        let a = facing > 0 ? w.a1 - sp / 2 : w.a0 + sp / 2; const stepA = -facing * sp;
        for (let n = 0; n < perReg && delegIdx < DELEG.length; n++, delegIdx++) {
          const di = delegIdx;
          out.push({ kind: 'cypress', variant: 0, along: a, y, facing, scale: 1 }); a += stepA * 0.8;
          out.push({ kind: 'usher', variant: di % 6, along: a, y, facing, scale: 1 }); a += stepA;
          for (let m = 0; m < nDel - 1; m++) { const animal = m === 1 && DELEG[di] !== 'delegate' && DELEG[di] !== 'mede' ? DELEG[di] : 'delegate'; out.push({ kind: animal, variant: di % 6, along: a + (animal !== 'delegate' ? stepA * 0.3 : 0), y, facing, scale: 1 }); a += stepA * (animal !== 'delegate' ? 1.4 : 1); }
          if ((facing > 0 && a < w.a0 + sp) || (facing < 0 && a > w.a1 - sp)) { delegIdx++; break; }
        }
      }
    }
    for (let a = w.a0 + RS.pitch / 2; a < w.a1; a += RS.pitch) ros.push({ a, y: R.bottom + nReg * (R.height + R.gap) - R.gap / 2 });
  }
  for (const s of g.spans.filter(x => x.type === 'flight')) {
    const len = s.a1 - s.a0, slope = g.riser / g.tread, rise = len * slope;
    const low = s.rise > 0 ? s.a0 : s.a1; const dir = s.rise; // +1: rising toward +a
    // lion attacking bull fills the triangle under the slope, facing up-slope (C composition, B motif)
    const k = Math.min(rise * 0.75 / 0.5, len * 0.28 / 0.9);
    out.push({ kind: 'bull', variant: 0, along: low + dir * len * 0.62, y: R.bottom, facing: (-dir) as 1 | -1, scale: k });
    out.push({ kind: 'lion', variant: 0, along: low + dir * len * 0.4, y: R.bottom + 0.25 * k, facing: dir as 1 | -1, scale: k * 0.9 });
    // cypress row along the parapet band, parallel to the slope
    for (let d = CY.pitch; d < len - CY.pitch / 2; d += CY.pitch) {
      const top = d * slope + g.parapet; out.push({ kind: 'cypress', variant: 1, along: low + dir * d, y: Math.max(0.05, top - CY.height - 0.15), facing: 1, scale: CY.height / 0.8 });
      ros.push({ a: low + dir * d, y: top - 0.1 });
    }
  }
  return { figures: out, rosettes: ros };
}
