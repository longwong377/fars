// Decoration layer: reliefs (reliefs.ts), crenellations, audience panels and carved inscriptions (real font outlines).
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import opentype from 'opentype.js';
import { v, present } from './spec';
import { Rng } from '../core/rng';
import { planFacade, planAudience, facadeItems, ReliefSet, ReliefItem, RosetteItem, Facade, StairGeom } from './reliefs';
import { toCuneiform } from '../lang/oldPersian';
import type { Manifest, Doorway, Part, Box } from './parts';
import { phase4Programmes, InscriptionPlacement } from './relief_programmes';
import inscriptions from '../data/inscriptions.json';
import { surfaceMaterial } from '../render/materials';

const up = new THREE.Vector3(0, 1, 0);
const gw = (e: number, n: number) => new THREE.Vector3(e, 0, -n); // grid → world (direction or point at y=0)
function facadeMatrix(f: Facade, along: number, y: number, scale: number) {
  const X = gw(f.along[0], f.along[1]), Z = gw(f.normal[0], f.normal[1]);
  const o = gw(f.origin[0] + f.along[0] * along, f.origin[1] + f.along[1] * along); o.y = f.y0 + y;
  return new THREE.Matrix4().makeBasis(X.clone().multiplyScalar(scale), up.clone().multiplyScalar(scale), Z.clone().multiplyScalar(scale)).setPosition(o);
}

export function apadanaFacades(m: Manifest): Facade[] {
  const a = m.apadana as any; if (!a) return [];
  const [cx, cy] = a.hallCentre as number[], stW = a.stairWidth as number, L = a.stairLength as number, pod = a.podium as number;
  // viewer's left → right along each façade; spans are defined with a along +x (N) / +y (E): N façade reversed, so mirror via along vector
  return [
    { id: 'N', origin: [cx, a.nStairEdge + stW], along: [-1, 0], normal: [0, 1], length: L, y0: 0, height: pod },
    { id: 'E', origin: [a.eStairEdge + stW, cy], along: [0, 1], normal: [1, 0], length: L, y0: 0, height: pod },
  ];
}

/** Apadana N and E stair reliefs: the façade programme (planFacade, planAudience) as carved low-relief figures with per-figure
 *  LOD (reliefs.ts, D-019), plus the four-stepped crenellations. */
export function buildReliefs(m: Manifest): THREE.Group {
  const g = new THREE.Group(); g.name = 'apadana-reliefs';
  const a = m.apadana as any;
  const sg: StairGeom = { spans: a.stairSpans, riser: a.stairRiser, tread: a.stairTread, parapet: a.parapet, podium: a.podium };
  const items: ReliefItem[] = [], rosettes: RosetteItem[] = [];
  for (const f of apadanaFacades(m)) for (const plan of [planFacade(f, sg), planAudience()]) { const r = facadeItems(f, plan); items.push(...r.items); rosettes.push(...r.rosettes); }
  const set = new ReliefSet(items, rosettes, 'relief:apadana'); g.add(set);
  g.userData = { ...set.userData };
  // four-stepped crenellations along the façade tops
  const C = v<any>('apadana', 'r_crenellation'); const cren = crenellationGeometry(C.width, C.height, C.steps, 0.45);
  const crenMats: THREE.Matrix4[] = [];
  const topAt = (aa: number) => { const s = sg.spans.find(x => aa >= x.a0 - 1e-6 && aa <= x.a1 + 1e-6); if (!s || s.type === 'landing') return sg.podium + sg.parapet; const d = s.rise > 0 ? aa - s.a0 : s.a1 - aa; return (Math.floor(d / sg.tread) + 1) * sg.riser + sg.parapet; };
  for (const f of apadanaFacades(m)) for (let aa = -f.length / 2 + C.width / 2; aa < f.length / 2; aa += C.width * 1.15) crenMats.push(facadeMatrix(f, aa, topAt(aa), 1).multiply(new THREE.Matrix4().makeTranslation(0, 0, -0.5)));
  const ci = new THREE.InstancedMesh(cren, surfaceMaterial('limestone'), crenMats.length); crenMats.forEach((mm, i) => ci.setMatrixAt(i, mm)); ci.castShadow = true; ci.receiveShadow = true;
  ci.userData = { tier: 'C', src: 'IR-PERS;RECON', note: 'four-stepped crenellations (motif B, size C)' }; ci.name = 'crenellations'; ci.computeBoundingSphere(); g.add(ci);
  return g;
}
/** Phase 4 reliefs (D-049): the Tachara, Hadish and Tripylon stair façades and the door jambs of the Tachara, Hadish,
 *  Tripylon, Hall of 100 Columns and Harem, one relief set per programme (each with its own far chunks, D-048). Returns the
 *  group and the inscription panels the central façades carry (placed by buildInscriptions). */
export function buildPhase4Reliefs(doorways: Doorway[]): { group: THREE.Group; inscriptions: InscriptionPlacement[] } {
  const g = new THREE.Group(); g.name = 'phase4-reliefs'; const ins: InscriptionPlacement[] = [];
  for (const p of phase4Programmes(doorways)) { if (p.items.length) g.add(new ReliefSet(p.items, [], p.name)); ins.push(...p.inscriptions); }
  g.userData = { tier: 'C', src: 'RELIEF-R;SI-ARCH;ISAC-PA;IR-PERS', placeholder: true, note: 'Phase 4 relief programmes (D-049): motifs B/C per SITE_SPEC; carving procedural (NEEDS #10)' };
  return { group: g, inscriptions: ins };
}
/** one merlon of a stair parapet: centre (grid), base height, the run's axis (0 = grid east, 1 = grid north), depth */
export interface Merlon { c: [number, number]; y: number; axis: 0 | 1; depth: number; building: string }
/** four-stepped merlons along the stair parapets (global.r_stair_crenellation, D-065): the parapet blocks of each listed
 *  building are chained into runs (same line, same thickness, touching end to end), and merlons are spaced along each run
 *  at the pitch, centred, each standing on the lowest block under it */
export function stairCrenellationPlan(parts: Part[]): Merlon[] {
  const CR = v<any>('global', 'r_stair_crenellation'), out: Merlon[] = [];
  const boxes = parts.filter((p): p is Box => p.type === 'box' && p.kind === 'parapet' && !p.rot && CR.buildings.includes(p.building));
  const used = new Set<Box>(), r2 = (x: number) => Math.round(x * 50), runs: { ch: Box[]; axis: 0 | 1 }[] = [];
  // chains of touching blocks along either axis first; a block in no chain then runs alone along its longer side
  for (const pass of ['chain', 'lone'] as const) for (const axis of [0, 1] as const) {
    const lat = 1 - axis, lines = new Map<string, Box[]>();
    for (const b of boxes) { if (used.has(b)) continue; const k = `${b.building}|${r2(b.c[lat])}|${r2(b.size[lat])}`; (lines.get(k) ?? lines.set(k, []).get(k)!).push(b); }
    for (const line of lines.values()) {
      line.sort((a, b) => a.c[axis] - b.c[axis]);
      const chains: Box[][] = [];
      for (const b of line) { const ch = chains[chains.length - 1], last = ch?.[ch.length - 1]; if (last && Math.abs(last.c[axis] + last.size[axis] / 2 - (b.c[axis] - b.size[axis] / 2)) < 0.02) ch.push(b); else chains.push([b]); }
      for (const ch of chains) {
        if (pass === 'chain' ? ch.length < 2 : ch[0].size[axis] < ch[0].size[lat]) continue;
        ch.forEach(b => used.add(b)); runs.push({ ch, axis });
      }
    }
  }
  for (const { ch, axis } of runs) {
    const lat = 1 - axis;
    const s0 = ch[0].c[axis] - ch[0].size[axis] / 2, s1 = ch[ch.length - 1].c[axis] + ch[ch.length - 1].size[axis] / 2, len = s1 - s0;
    if (len < CR.width) continue;
    const n = Math.floor((len - CR.width) / CR.pitch) + 1, a0 = s0 + (len - (n - 1) * CR.pitch) / 2;
    for (let i = 0; i < n; i++) {
      const a = a0 + i * CR.pitch, lo = a - CR.width / 2, hi = a + CR.width / 2;
      const y = Math.min(...ch.filter(b => b.c[axis] + b.size[axis] / 2 > lo + 1e-3 && b.c[axis] - b.size[axis] / 2 < hi - 1e-3).map(b => b.y1));
      const c: [number, number] = axis === 0 ? [a, ch[0].c[1]] : [ch[0].c[0], a];
      out.push({ c, y, axis, depth: Math.min(ch[0].size[lat], CR.max_depth), building: ch[0].building });
    }
  }
  return out;
}
/** the stair-parapet merlons as one instanced mesh (limestone, as the parapets) */
export function buildStairCrenellations(parts: Part[]): THREE.InstancedMesh | null {
  const CR = v<any>('global', 'r_stair_crenellation'), plan = stairCrenellationPlan(parts); if (!plan.length) return null;
  const geo = crenellationGeometry(CR.width, CR.height, CR.steps, 1);
  const mesh = new THREE.InstancedMesh(geo, surfaceMaterial('limestone'), plan.length), m = new THREE.Matrix4(), t = new THREE.Matrix4();
  plan.forEach((q, i) => {
    // X along the run, Y up, Z = X × Y across the parapet (right-handed, so the extrusion keeps its winding); the unit-deep
    // extrusion is scaled to the merlon depth and centred on the parapet's mid-line
    const X = q.axis === 0 ? gw(1, 0) : gw(0, 1), Z = new THREE.Vector3().crossVectors(X, up);
    m.makeTranslation(q.c[0], q.y, -q.c[1]).multiply(t.makeBasis(X, up, Z)).multiply(t.makeScale(1, 1, q.depth)).multiply(t.makeTranslation(0, 0, -0.5));
    mesh.setMatrixAt(i, m);
  });
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'stair-crenellations'; mesh.computeBoundingSphere();
  mesh.userData = { tier: 'C', src: 'IR-PERS;SI-ARCH;RECON', note: `four-stepped merlons on the stair parapets of ${CR.buildings.join(', ')} (motif B on the Apadana stairs; here by the Persepolis stair convention, size C; D-065)` };
  return mesh;
}
function crenellationGeometry(w: number, h: number, steps: number, depth: number) {
  const pts: number[][] = []; const sw = w / 2 / steps, sh = h / steps;
  pts.push([-w / 2, 0]); for (let i = 0; i < steps; i++) { pts.push([-w / 2 + i * sw, (i + 1) * sh]); pts.push([-w / 2 + (i + 1) * sw, (i + 1) * sh]); }
  for (let i = steps - 1; i >= 0; i--) { pts.push([w / 2 - (i + 1) * sw, (i + 1) * sh]); pts.push([w / 2 - i * sw, (i + 1) * sh]); } pts.push([w / 2, 0]);
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))), { depth, bevelEnabled: false }); g.deleteAttribute('uv'); return g;
}

// ---------- carved inscriptions from glyph outlines ----------
const fonts: Record<string, opentype.Font> = {};
export async function loadInscriptionFonts(fetcher: (path: string) => Promise<ArrayBuffer>) {
  for (const [k, f] of [['op', 'NotoSansOldPersian-Regular.ttf'], ['cun', 'NotoSansCuneiform-Regular.ttf']]) fonts[k] = opentype.parse(await fetcher(`fonts/${f}`));
}
/** Build carved-text geometry: glyphs as shallow bevelled extrusions (incised look), laid out in lines filling a panel. */
/** `flat`: the sign faces only (no extrusion or bevel, curves at 1 segment): ~1/10 of the triangles, for text seen from
 *  metres away (the Naqsh-e Rustam panels, 15–25 m up), where an incision reads as a dark stroke */
export function textPanelGeometry(fontKey: 'op' | 'cun', text: string, width: number, glyphH: number, lineGap: number, flat = false): { geo: THREE.BufferGeometry; lines: number; height: number } {
  const font = fonts[fontKey]; if (!font) throw new Error('inscription fonts not loaded');
  const unitsPerEm = font.unitsPerEm, scale = glyphH / unitsPerEm * 1.25;
  const shapes: THREE.Shape[] = []; let x = 0, y = 0, lines = 1;
  for (const ch of [...text]) {
    const glyph = font.charToGlyph(ch); const adv = (glyph.advanceWidth ?? unitsPerEm) * scale;
    if (ch === ' ' || x + adv > width) { if (ch !== ' ' || x + adv > width) { x = 0; y -= glyphH + lineGap; lines++; } if (ch === ' ') continue; }
    const path = glyph.getPath(x / scale, 0, unitsPerEm);
    // convert opentype path commands (y down) to THREE shapes (y up)
    let cur: THREE.Shape | null = null;
    for (const c of path.commands as any[]) {
      if (c.type === 'M') { cur = new THREE.Shape(); cur.moveTo(c.x * scale, -c.y * scale + y); shapes.push(cur); }
      else if (c.type === 'L') cur!.lineTo(c.x * scale, -c.y * scale + y);
      else if (c.type === 'Q') cur!.quadraticCurveTo(c.x1 * scale, -c.y1 * scale + y, c.x * scale, -c.y * scale + y);
      else if (c.type === 'C') cur!.bezierCurveTo(c.x1 * scale, -c.y1 * scale + y, c.x2 * scale, -c.y2 * scale + y, c.x * scale, -c.y * scale + y);
    }
    x += adv;
  }
  const geo = flat ? new THREE.ShapeGeometry(shapes, 1).translate(0, 0, 0.003) : new THREE.ExtrudeGeometry(shapes, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.0025, bevelSegments: 1, curveSegments: 3 });
  geo.deleteAttribute('uv');
  return { geo, lines, height: lines * (glyphH + lineGap) };
}

/** layer of the inscriptions' invisible pick rectangles (no camera renders it) */
export const INSCRIPTION_PICK_LAYER = 5;
const pickMat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, visible: false });
export function buildInscriptions(m: Manifest, parts: any[], extra: InscriptionPlacement[] = []): THREE.Group {
  const g = new THREE.Group(); g.name = 'inscriptions';
  const inscMat = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(0.22, 0.21, 0.2, THREE.SRGBColorSpace), roughness: 0.95 });
  const panelMeta = (id: string, ver: string) => ({ tier: ver === 'op' ? 'C' : 'B', src: 'ARIO;OSL;NOTO;LANG-R', note: `${id} (${ver === 'op' ? 'Old Persian, signs by Kent rules — C' : ver === 'el' ? 'Elamite, ATF→OSL signs' : 'Babylonian, ATF→OSL signs'}); text: ARIo (Schmitt 2009); placement C`, inscription: id, version: ver });
  const place = (geo: THREE.BufferGeometry, meta: any, originGrid: [number, number], alongGrid: [number, number], normalGrid: [number, number], yTop: number, width: number) => {
    const X = gw(alongGrid[0], alongGrid[1]), Z = gw(normalGrid[0], normalGrid[1]);
    const o = gw(originGrid[0], originGrid[1]).addScaledVector(X, -width / 2); o.y = yTop;
    const mesh = new THREE.Mesh(geo, inscMat); mesh.matrixAutoUpdate = false; mesh.matrix.makeBasis(X, up, Z).setPosition(o.addScaledVector(Z, 0.002)); mesh.userData = meta; mesh.name = `inscription:${meta.inscription}:${meta.version}`; g.add(mesh);
    // pick rectangle over the whole panel (the carved mesh is only the signs, so a look between wedges would miss); on
    // INSCRIPTION_PICK_LAYER, which no camera renders; the translation layer raycasts that layer only
    geo.computeBoundingBox(); const bb = geo.boundingBox!, pad = 0.05;
    const quad = new THREE.PlaneGeometry(bb.max.x - bb.min.x + 2 * pad, bb.max.y - bb.min.y + 2 * pad).translate((bb.min.x + bb.max.x) / 2, (bb.min.y + bb.max.y) / 2, bb.max.z + 0.001);
    const pick = new THREE.Mesh(quad, pickMat); pick.matrixAutoUpdate = false; pick.matrix.copy(mesh.matrix); pick.layers.set(INSCRIPTION_PICK_LAYER);
    pick.name = `inscription:${meta.inscription}:${meta.version}:pick`; pick.userData = meta; g.add(pick);
  };
  // XPa above each colossus of the Gate of All Nations, on the door reveals (versions OP / El / Bab / OP — assignment C)
  if (present('gate_nations') && m.gate_nations) {
    const P = v<any>('gate_nations', 'r_inscription_panel'), K = v<any>('gate_nations', 'r_colossus');
    const cols = parts.filter(p => p.building === 'gate_nations' && p.kind === 'colossus');
    const texts: Record<string, string> = { op: toCuneiform((inscriptions as any).XPa.op_translit), el: (inscriptions as any).XPa.el_cuneiform, bab: (inscriptions as any).XPa.bab_cuneiform };
    const vers = ['op', 'el', 'bab', 'op'];
    cols.forEach((c: any, i: number) => {
      const ver = vers[i % 4]; const { geo } = textPanelGeometry(ver === 'op' ? 'op' : 'cun', texts[ver], P.width, P.glyph_height, P.line_gap);
      // reveal face: the colossus stands against the reveal; the panel faces into the doorway (toward the door axis)
      const doorAxisN = (m.gate_nations as any) && (parts.find((p: any) => p.building === 'gate_nations' && p.kind === 'floor') as any).c[1];
      const facingN = c.c[1] > doorAxisN ? -1 : 1; // panel on the reveal, normal pointing to the door axis
      const revealN = c.c[1] + facingN * (c.size[1] / 2); // the colossus' inner face = the doorway reveal
      // reading direction (viewer's left → right) for a panel whose normal is ±grid-north
      place(geo, panelMeta('XPa', ver), [c.c[0], revealN + facingN * 0.01], [facingN > 0 ? -1 : 1, 0], [0, facingN], v('gate_nations', 'r_colossus_plinth') + K.height + P.above_colossus + P.height, P.width);
    });
  }
  // XPb beside the audience panels on the Apadana N and E stair façades (placement C: 'flanks the reliefs')
  if (present('apadana') && m.apadana) {
    const AP = v<any>('apadana', 'r_audience_panel'), R = v<any>('apadana', 'r_registers');
    const text = toCuneiform((inscriptions as any).XPb.op_translit);
    for (const f of apadanaFacades(m)) {
      const { geo } = textPanelGeometry('op', text, 2.2, 0.06, 0.03);
      for (const s of [1]) {
        const a = s * (AP.width / 2 + 2.6), o: [number, number] = [f.origin[0] + f.along[0] * a + f.normal[0] * 0.01, f.origin[1] + f.along[1] * a + f.normal[1] * 0.01];
        place(geo, panelMeta('XPb', 'op'), o, f.along as any, f.normal as any, R.bottom + 2.45, 2.2);
      }
    }
  }
  // Phase 4 central façades (D-049): XPc on the Tachara S stair, XPd on the Hadish W stair (Old Persian; placement C),
  const SR = v<any>('global', 'r_stair_relief');
  // and the door-jamb inscriptions (D-066: XPe on the Hadish E and W doorways, the three versions stacked)
  for (const p of extra) {
    const t = (inscriptions as any)[p.id]; if (!t) continue;
    let y = p.yTop;
    for (const ver of p.versions ?? [p.version]) {
      const text = ver === 'op' ? toCuneiform(t.op_translit) : ver === 'el' ? t.el_cuneiform : t.bab_cuneiform; if (!text) continue;
      const glyph = p.glyph ?? SR.glyph, { geo, height } = textPanelGeometry(ver === 'op' ? 'op' : 'cun', text, p.width, glyph, p.lineGap ?? SR.line_gap, !!p.flat);
      place(geo, panelMeta(p.id, ver), [p.origin[0] + p.normal[0] * 0.01, p.origin[1] + p.normal[1] * 0.01], p.along, p.normal, y, p.width);
      y -= height + (p.gap ?? 0);
    }
  }
  return g;
}
void mergeGeometries;
