// Decoration layer: reliefs (reliefs.ts), crenellations, audience panels and carved inscriptions (real font outlines).
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import opentype from 'opentype.js';
import { v, present } from './spec';
import { Rng } from '../core/rng';
import { figurePieces, figureGeometry, planFacade, Facade, PIGMENT, StairGeom } from './reliefs';
import { toCuneiform } from '../lang/oldPersian';
import type { Manifest } from './parts';
import inscriptions from '../data/inscriptions.json';
import { surfaceMaterial } from '../render/materials';

const up = new THREE.Vector3(0, 1, 0);
const gw = (e: number, n: number) => new THREE.Vector3(e, 0, -n); // grid → world (direction or point at y=0)
function facadeMatrix(f: Facade, along: number, y: number, scale: number) {
  const X = gw(f.along[0], f.along[1]), Z = gw(f.normal[0], f.normal[1]);
  const o = gw(f.origin[0] + f.along[0] * along, f.origin[1] + f.along[1] * along); o.y = f.y0 + y;
  return new THREE.Matrix4().makeBasis(X.clone().multiplyScalar(scale), up.clone().multiplyScalar(scale), Z.clone().multiplyScalar(scale)).setPosition(o);
}

let reliefMat: THREE.MeshStandardNodeMaterial | null = null;
function paintMaterial() { if (!reliefMat) { reliefMat = surfaceMaterial('limestone', { vertexColors: true }); } return reliefMat; }

export function apadanaFacades(m: Manifest): Facade[] {
  const a = m.apadana as any; if (!a) return [];
  const [cx, cy] = a.hallCentre as number[], stW = a.stairWidth as number, L = a.stairLength as number, pod = a.podium as number;
  // viewer's left → right along each façade; spans are defined with a along +x (N) / +y (E): N façade reversed, so mirror via along vector
  return [
    { id: 'N', origin: [cx, a.nStairEdge + stW], along: [-1, 0], normal: [0, 1], length: L, y0: 0, height: pod },
    { id: 'E', origin: [a.eStairEdge + stW, cy], along: [0, 1], normal: [1, 0], length: L, y0: 0, height: pod },
  ];
}

export function buildReliefs(m: Manifest): THREE.Group {
  const g = new THREE.Group(); g.name = 'apadana-reliefs';
  const meta = { tier: 'C', src: 'RELIEF-R;IR-APAD', placeholder: true, note: 'procedural relief silhouettes (PLACEHOLDER pending licensed scans, NEEDS #10); layout B/C; hair/beard dark blue B; other colours C' };
  g.userData = meta;
  const geoCache = new Map<string, THREE.BufferGeometry>();
  const geo = (kind: string, variant: number, mirror: boolean) => {
    const k = `${kind}|${variant}|${mirror}`; let x = geoCache.get(k);
    if (!x) { x = figureGeometry(figurePieces(kind, new Rng(variant + 1, 'fig-' + kind)), mirror); geoCache.set(k, x); } return x;
  };
  const inst = new Map<string, THREE.Matrix4[]>();
  const push = (key: string, mtx: THREE.Matrix4) => { if (!inst.has(key)) inst.set(key, []); inst.get(key)!.push(mtx); };
  const a = m.apadana as any;
  const sg: StairGeom = { spans: a.stairSpans, riser: a.stairRiser, tread: a.stairTread, parapet: a.parapet, podium: a.podium };
  const rosMats: THREE.Matrix4[] = [];
  for (const f of apadanaFacades(m)) {
    const plan = planFacade(f, sg);
    for (const p of plan.figures) push(`${p.kind}|${p.variant}|${p.facing < 0}`, facadeMatrix(f, p.along, p.y, p.scale));
    for (const r of plan.rosettes) rosMats.push(facadeMatrix(f, r.a, r.y, 1));
    // audience panel at the centre (Tilia 1972 via Iranica: still in place in 467): king enthroned, crown prince behind, official before
    const AP = v<any>('apadana', 'r_audience_panel'); const R = v<any>('apadana', 'r_registers');
    const k = AP.height / 0.8 * 0.95;
    push(`king|0|false`, facadeMatrix(f, -0.6, R.bottom, k));
    push(`persian|1|false`, facadeMatrix(f, -1.9, R.bottom, k * 0.95)); // crown prince behind the throne
    push(`usher|2|true`, facadeMatrix(f, 1.35, R.bottom, k * 0.9)); // official before the king
    for (const s of [-1, 1]) for (let i = 0; i < 2; i++) push(`guard|${i}|${s > 0}`, facadeMatrix(f, s * (AP.width / 2 + 0.5 + i * 0.7), R.bottom, 1.35));
    // rosette frame around the audience panel
    for (let x = -AP.width / 2; x <= AP.width / 2; x += v<any>('apadana', 'r_rosette').pitch) { rosMats.push(facadeMatrix(f, x, R.bottom - 0.08, 1), facadeMatrix(f, x, R.bottom + AP.height, 1)); }
  }
  { // rosette bands: small painted discs in relief
    const RS = v<any>('apadana', 'r_rosette'); const rg = new THREE.CylinderGeometry(RS.diameter / 2, RS.diameter / 2, 0.02, 10).rotateX(Math.PI / 2).translate(0, 0, 0.01); rg.deleteAttribute('uv');
    const n = rg.getAttribute('position').count; const col = new Float32Array(n * 3); const c = new THREE.Color().setRGB(PIGMENT.egyptianBlue[0], PIGMENT.egyptianBlue[1], PIGMENT.egyptianBlue[2], THREE.SRGBColorSpace);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3); rg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const ri = new THREE.InstancedMesh(rg, paintMaterial(), rosMats.length); rosMats.forEach((mm, i) => ri.setMatrixAt(i, mm)); ri.userData = meta; ri.name = 'relief:rosettes'; ri.computeBoundingSphere(); g.add(ri);
  }
  for (const [key, mats] of inst) {
    const [kind, variant, mirror] = key.split('|');
    const im = new THREE.InstancedMesh(geo(kind, +variant, mirror === 'true'), paintMaterial(), mats.length);
    mats.forEach((mm, i) => im.setMatrixAt(i, mm)); im.castShadow = true; im.receiveShadow = true; im.userData = meta; im.name = `relief:${kind}`;
    im.computeBoundingSphere(); g.add(im);
  }
  // four-stepped crenellations along the façade tops
  const C = v<any>('apadana', 'r_crenellation'); const cren = crenellationGeometry(C.width, C.height, C.steps, 0.45);
  const crenMats: THREE.Matrix4[] = [];
  const topAt = (aa: number) => { const s = sg.spans.find(x => aa >= x.a0 - 1e-6 && aa <= x.a1 + 1e-6); if (!s || s.type === 'landing') return sg.podium + sg.parapet; const d = s.rise > 0 ? aa - s.a0 : s.a1 - aa; return (Math.floor(d / sg.tread) + 1) * sg.riser + sg.parapet; };
  for (const f of apadanaFacades(m)) for (let aa = -f.length / 2 + C.width / 2; aa < f.length / 2; aa += C.width * 1.15) crenMats.push(facadeMatrix(f, aa, topAt(aa), 1).multiply(new THREE.Matrix4().makeTranslation(0, 0, -0.5)));
  const ci = new THREE.InstancedMesh(cren, surfaceMaterial('limestone'), crenMats.length); crenMats.forEach((mm, i) => ci.setMatrixAt(i, mm)); ci.castShadow = true; ci.receiveShadow = true;
  ci.userData = { tier: 'C', src: 'IR-PERS;RECON', note: 'four-stepped crenellations (motif B, size C)' }; ci.name = 'crenellations'; ci.computeBoundingSphere(); g.add(ci);
  return g;
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
export function textPanelGeometry(fontKey: 'op' | 'cun', text: string, width: number, glyphH: number, lineGap: number): { geo: THREE.BufferGeometry; lines: number; height: number } {
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
  const geo = new THREE.ExtrudeGeometry(shapes, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.0025, bevelSegments: 1, curveSegments: 3 });
  geo.deleteAttribute('uv');
  return { geo, lines, height: lines * (glyphH + lineGap) };
}

export function buildInscriptions(m: Manifest, parts: any[]): THREE.Group {
  const g = new THREE.Group(); g.name = 'inscriptions';
  const inscMat = new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(0.22, 0.21, 0.2, THREE.SRGBColorSpace), roughness: 0.95 });
  const panelMeta = (id: string, ver: string) => ({ tier: ver === 'op' ? 'C' : 'B', src: 'ARIO;OSL;NOTO;LANG-R', note: `${id} (${ver === 'op' ? 'Old Persian, signs by Kent rules — C' : ver === 'el' ? 'Elamite, ATF→OSL signs' : 'Babylonian, ATF→OSL signs'}); text: ARIo (Schmitt 2009); placement C`, inscription: id, version: ver });
  const place = (geo: THREE.BufferGeometry, meta: any, originGrid: [number, number], alongGrid: [number, number], normalGrid: [number, number], yTop: number, width: number) => {
    const X = gw(alongGrid[0], alongGrid[1]), Z = gw(normalGrid[0], normalGrid[1]);
    const o = gw(originGrid[0], originGrid[1]).addScaledVector(X, -width / 2); o.y = yTop;
    const mesh = new THREE.Mesh(geo, inscMat); mesh.matrixAutoUpdate = false; mesh.matrix.makeBasis(X, up, Z).setPosition(o.addScaledVector(Z, 0.002)); mesh.userData = meta; mesh.name = `inscription:${meta.inscription}:${meta.version}`; g.add(mesh);
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
  return g;
}
void mergeGeometries; void PIGMENT;
