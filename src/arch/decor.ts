// Decoration layer: reliefs (reliefs.ts), crenellations, audience panels and the carved inscriptions (incised: carving.ts).
import * as THREE from 'three/webgpu';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import opentype from 'opentype.js';
import { v, present } from './spec';
import { Rng } from '../core/rng';
import { planFacade, planAudience, facadeItems, ReliefSet, ReliefItem, RosetteItem, Facade, StairGeom } from './reliefs';
import { panelText, inscriptionIds, type PanelText, type Version } from './inscription_text';
import { buildAtlas, layoutText, carvedGeometry, layoutMaxDepth, type Atlas, type Layout } from './carving';
import type { Manifest, Doorway, Part, Box, Pt } from './parts';
import { phase4Programmes, InscriptionPlacement } from './relief_programmes';
import inscriptions from '../data/inscriptions.json';
import programme from '../data/royal_inscriptions.json';
import { surfaceMaterial, incisedMaterial } from '../render/materials';

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

// ---------- carved inscriptions: the published text (D-177), incised into the stone (D-177) ----------
const fonts: Record<string, opentype.Font> = {};
const atlases: Partial<Record<'op' | 'cun', Atlas>> = {};
export async function loadInscriptionFonts(fetcher: (path: string) => Promise<ArrayBuffer>) {
  for (const [k, f] of [['op', 'NotoSansOldPersian-Regular.ttf'], ['cun', 'NotoSansCuneiform-Regular.ttf']]) if (!fonts[k]) fonts[k] = opentype.parse(await fetcher(`fonts/${f}`));
}
export function inscriptionFont(font: 'op' | 'cun'): opentype.Font { const f = fonts[font]; if (!f) throw new Error('inscription fonts not loaded'); return f; }
/** the depth atlas of a script: every sign that any inscription carves in it (carving.ts), built once */
export function inscriptionAtlas(font: 'op' | 'cun'): Atlas {
  const hit = atlases[font]; if (hit) return hit;
  const chars = new Set<string>();
  for (const id of inscriptionIds()) for (const ver of ['op', 'el', 'bab'] as Version[]) { const t = panelText(id, ver); if (t && t.font === font) for (const l of t.lines) for (const ch of l) chars.add(ch); }
  return (atlases[font] = buildAtlas(inscriptionFont(font), chars, font === 'op' ? 96 : 64));
}
export interface Block { id: string; ver: Version; text: PanelText }
export interface Fitted { glyph: number; parts: { block: Block; layout: Layout; dx: number; dy: number }[]; width: number; height: number }
/** one glyph height for blocks side by side ('columns') or top to bottom ('stack') in a field width × height (m): the largest
 *  <= glyphMax at which every line of an inscription's own lineation fits its column and the whole fits the field
 *  (global.r_inscription_carving; never below glyph_min) */
export function fitBlocks(blocks: Block[], arrangement: 'columns' | 'stack', width: number, height: number, glyphMax: number): Fitted {
  const RC = v<any>('global', 'r_inscription_carving'), n = blocks.length, sep = RC.block_sep, colW = arrangement === 'columns' ? (width - (n - 1) * sep) / n : width;
  const lay = (g: number) => blocks.map(b => layoutText(inscriptionFont(b.text.font), b.text.lines, g, g * RC.gap_ratio, colW, b.text.lined));
  const fits = (g: number) => { const L = lay(g); const h = arrangement === 'columns' ? Math.max(...L.map(l => l.height)) : L.reduce((s, l) => s + l.height, 0) + (n - 1) * sep; return L.every(l => l.width <= colW + 1e-6) && h <= height + 1e-6; };
  let g = glyphMax;
  if (!fits(g)) { let lo = RC.glyph_min, hi = glyphMax; for (let k = 0; k < 22; k++) { const mid = (lo + hi) / 2; if (fits(mid)) lo = mid; else hi = mid; } g = lo; }
  const L = lay(g); let y = 0;
  const parts = L.map((layout, i) => { const p = arrangement === 'columns' ? { block: blocks[i], layout, dx: i * (colW + sep), dy: 0 } : { block: blocks[i], layout, dx: 0, dy: y }; y -= layout.height + sep; return p; });
  return { glyph: g, parts, width: arrangement === 'columns' ? width : Math.max(...L.map(l => l.width)), height: arrangement === 'columns' ? Math.max(...L.map(l => l.height)) : -y - sep };
}
/** the carved signs of one block as geometry in panel space (carving.ts), for callers that place it themselves (naqsh.ts) */
export function carvedBlockGeometry(block: Block, layout: Layout, dx = 0, dy = 0): THREE.BufferGeometry {
  return carvedGeometry(inscriptionAtlas(block.text.font), layout, dx, dy, v<any>('global', 'r_inscription_carving').lift);
}
/** the face of the architecture a panel is carved on: the box whose face, with outward normal `n` (grid, axis-aligned),
 *  lies nearest the point `o` (grid) at height y, within `reach` m along n; its signed offset from o and its material */
export function hostFace(parts: Part[], o: Pt, y: number, n: Pt, reach = 0.6): { d: number; material: string; kind: string } | null {
  const ax = Math.abs(n[0]) > 0.5 ? 0 : 1, lat = 1 - ax, s = Math.sign(n[ax]);
  let best: { d: number; material: string; kind: string } | null = null;
  for (const p of parts) {
    if (p.type !== 'box' || (p as Box).rot) continue;
    const b = p as Box; if (y < b.y0 - 1e-6 || y > b.y1 + 1e-6 || Math.abs(o[lat] - b.c[lat]) > b.size[lat] / 2 + 1e-6) continue;
    const d = (b.c[ax] + (s * b.size[ax]) / 2 - o[ax]) * s;
    if (Math.abs(d) <= reach && (!best || Math.abs(d) < Math.abs(best.d))) best = { d, material: b.material, kind: b.kind };
  }
  return best;
}
/** a carved field: the texts (id × versions) in one arrangement on a face. `origin`: the field's centre on the face line
 *  (grid; `snap` moves it onto the nearest box face of the architecture and takes that box's stone), `yTop` its top, `width`
 *  × `height` its size; `surface`: the host's SURFACES key when the host is not a part (a slab, the Terrace wall) */
export interface CarvedField { texts: { id: string; ver: Version }[]; arrangement: 'columns' | 'stack'; origin: Pt; along: Pt; normal: Pt; yTop: number; width: number; height: number; glyphMax: number; where: string; tier: string; surface?: string; snap?: boolean }
const VER_NAME: Record<Version, string> = { op: 'Old Persian', el: 'Elamite', bab: 'Babylonian' };
/** what the Old Persian signs of a text rest on (D-177), for the dev-overlay notes (decor.ts, naqsh.ts) */
export function opSignsNote(id: string): string {
  const t = (inscriptions as any)[id], w = (t.op_words as any[]).filter(r => r.signs), n = (k: string) => w.filter(r => r.cmp === k).length;
  const fixed = w.filter(r => r.read).length, lost = String(t.op_signs.join(' ')).split(/[\s:-]+/).filter(s => s === 'x').length;
  return t.op_lined ? `signs: the published sign-by-sign transliteration (Kent's convention; data/corpus/op_translit.json, D-176) word for word, ${w.length} word groups (B)${fixed ? `, ${fixed} with a slip of the copy corrected (op_sign_decisions.json)` : ''}; Schmitt's reading differs in ${n('reading')}, by a written glide in ${n('glide')}, by a logogram in ${n('logogram')} (research/OP_SIGNS.md, Q-288)${lost ? `; ${lost} signs lost in the corpus left uncut [PLACEHOLDER]` : ''}; lines the corpus's (B)`
    : `signs: Kent's rules on ARIo's words (C: no corpus copy); lines C`;
}
/** copies and versions of an inscription standing in 467 that the build does not carve (src/data/royal_inscriptions.json) */
const missingOf = (id: string) => (programme.missing as any[]).filter(m => String(m.id).split(/,\s*/).includes(id));
/** the dev-overlay note of one carved version: what the text and the signs rest on (D-177), and the carving */
function versionNote(id: string, ver: Version, glyph: number, depth: number, where: string, surface: string): string {
  const t = (inscriptions as any)[id], signs = ver === 'op' ? opSignsNote(id) : `signs: ATF → OSL (B); lines C (flowed: no lineation read)`;
  const miss = missingOf(id).map(m => m.what);
  return `${id} ${VER_NAME[ver]} (text A: ARIo ${t.ario}, Schmitt 2009); ${signs}; incised in ${surface}, V-section at 45°, deepest ${(depth * 1000).toFixed(1)} mm, signs ${(glyph * 100).toFixed(1)} cm (C); ${where}${miss.length ? `; NOT carved (Q-290): ${miss.join('; ')}` : ''}`;
}
/** carve one field into group `g` (one mesh and one pick rectangle per version) */
function carveField(g: THREE.Group, parts: Part[], F: CarvedField, report: string[]) {
  const blocks: Block[] = F.texts.map(t => ({ id: t.id, ver: t.ver, text: panelText(t.id, t.ver)! })).filter(b => b.text);
  if (!blocks.length) return;
  const host = F.snap === false ? null : hostFace(parts, F.origin, F.yTop - F.height / 2, F.normal);
  const surface = F.surface ?? host?.material ?? 'limestone', off = host && !F.surface ? host.d : 0;
  const fit = fitBlocks(blocks, F.arrangement, F.width, F.height, F.glyphMax);
  const X = gw(F.along[0], F.along[1]), Z = gw(F.normal[0], F.normal[1]);
  const o = gw(F.origin[0], F.origin[1]).addScaledVector(Z, off).addScaledVector(X, -F.width / 2); o.y = F.yTop;
  for (const p of fit.parts) {
    const A = inscriptionAtlas(p.block.text.font), geo = carvedBlockGeometry(p.block, p.layout, p.dx, p.dy), depth = layoutMaxDepth(A, p.layout);
    const meta = { tier: p.block.ver === 'op' && (inscriptions as any)[p.block.id].op_lined ? 'B' : 'C', src: p.block.ver === 'op' ? 'ARIO;OP-TRANSLIT;NOTO;LANG-R' : 'ARIO;OSL;NOTO;LANG-R', inscription: p.block.id, version: p.block.ver, host: surface, glyph: fit.glyph, depth,
      note: versionNote(p.block.id, p.block.ver, fit.glyph, depth, `${F.where} (placement ${F.tier})`, surface) };
    const mesh = new THREE.Mesh(geo, incisedMaterial(surface, A)); mesh.matrixAutoUpdate = false; mesh.matrix.makeBasis(X, up, Z).setPosition(o);
    mesh.receiveShadow = true; mesh.castShadow = false; mesh.userData = { ...meta, carved: [{ id: p.block.id, ver: p.block.ver, signs: geo.userData.signs }] }; mesh.name = `inscription:${p.block.id}:${p.block.ver}`; g.add(mesh);
    // pick rectangle over the block (the carved mesh is only the signs, so a look between wedges would miss); on
    // INSCRIPTION_PICK_LAYER, which no camera renders; the translation layer raycasts that layer only
    const pad = 0.05, w = p.layout.width, h = p.layout.height;
    const quad = new THREE.PlaneGeometry(w + 2 * pad, h + 2 * pad).translate(p.dx + w / 2, p.dy - h / 2, 0.002);
    const pick = new THREE.Mesh(quad, pickMat); pick.matrixAutoUpdate = false; pick.matrix.copy(mesh.matrix); pick.layers.set(INSCRIPTION_PICK_LAYER);
    pick.name = `inscription:${p.block.id}:${p.block.ver}:pick`; pick.userData = meta; g.add(pick);
    report.push(`${p.block.id}:${p.block.ver} ${p.layout.signs.length} signs, ${p.layout.lines} lines, glyph ${(fit.glyph * 100).toFixed(1)} cm, deepest ${(depth * 1000).toFixed(1)} mm, on ${surface}${host ? ` (${host.kind}, face ${(host.d * 100).toFixed(1)} cm from the field line)` : ''}`);
  }
}
/** the carved inscriptions of the Terrace (D-177: what stands where, the texts and the carving; src/data/royal_inscriptions.json): XPa on the Gate, XPb on the Apadana
 *  stairs, the stair-facade and door-jamb texts of the Phase 4 programmes (XPc, XPd, XPe, DPa, DPb: relief_programmes.ts),
 *  DPc on the Tachara window cornices and DPd-DPg on the Terrace south wall. g.userData.report lists every carved version */
export function buildInscriptions(m: Manifest, parts: Part[], extra: InscriptionPlacement[] = []): THREE.Group {
  const g = new THREE.Group(); g.name = 'inscriptions'; const report: string[] = [];
  const all = (id: string, vers: Version[] = ['op', 'el', 'bab']) => vers.map(ver => ({ id, ver }));
  // XPa above each colossus of the Gate of All Nations, on the doorway reveal: all three versions side by side on a stone
  // face in front of the wall above the colossus (gate_nations.r_inscription_panel, inscription_placement; D-177)
  if (present('gate_nations') && m.gate_nations) {
    const P = v<any>('gate_nations', 'r_inscription_panel'), K = v<any>('gate_nations', 'r_colossus');
    const cols = parts.filter(p => p.building === 'gate_nations' && p.kind === 'colossus') as Box[];
    const doorAxisN = (parts.find(p => p.building === 'gate_nations' && p.kind === 'floor') as Box).c[1];
    const slabMat = surfaceMaterial(P.slab_surface);
    cols.forEach(c => {
      const facingN = c.c[1] > doorAxisN ? -1 : 1, revealN = c.c[1] + facingN * (c.size[1] / 2); // the colossus' inner face = the doorway reveal
      const yTop = v<number>('gate_nations', 'r_colossus_plinth') + K.height + P.above_colossus + P.height, n: Pt = [0, facingN];
      const wall = hostFace(parts, [c.c[0], revealN], yTop - P.height / 2, n) ?? { d: 0 };
      const faceN = revealN + facingN * (wall.d + P.slab_proud); // the slab's face
      const slab = new THREE.Mesh(new THREE.BoxGeometry(P.width, P.height, P.slab_depth), slabMat);
      slab.position.set(c.c[0], yTop - P.height / 2, -(faceN - facingN * P.slab_depth / 2)); slab.castShadow = slab.receiveShadow = true;
      slab.name = 'inscription-slab:XPa'; slab.userData = { tier: 'C', src: 'ISAC-PA;LANG-R;RECON', note: `stone face above the colossus carrying XPa (${P.width} × ${P.height} m, ${P.slab_proud * 100} cm in front of the wall; the stone jamb's extent C)` };
      g.add(slab);
      carveField(g, parts, { texts: [...all('XPa')], arrangement: P.arrangement, origin: [c.c[0], faceN], along: [facingN > 0 ? -1 : 1, 0], normal: n, yTop: yTop - P.margin,
        width: P.width - 2 * P.margin, height: P.height - 2 * P.margin, glyphMax: P.glyph_height, where: 'above a doorway colossus of the Gate of All Nations, the three versions side by side', tier: 'B (above each colossus) / C (the columns)', surface: P.slab_surface, snap: false }, report);
    });
  }
  // XPb beside the audience panels on the Apadana N and E stair facades: OP on one panel, Babylonian and Elamite on another
  if (present('apadana') && m.apadana) {
    const AP = v<any>('apadana', 'r_audience_panel'), R = v<any>('apadana', 'r_registers'), X = v<any>('apadana', 'r_xpb_panels');
    for (const f of apadanaFacades(m)) for (const [side, texts] of [[X.op_side, all('XPb', ['op'])], [X.elbab_side, all('XPb', X.elbab_order)]] as const) {
      const a = side * (AP.width / 2 + X.offset), o: Pt = [f.origin[0] + f.along[0] * a, f.origin[1] + f.along[1] * a];
      carveField(g, parts, { texts: [...texts], arrangement: 'stack', origin: o, along: f.along as Pt, normal: f.normal as Pt, yTop: R.bottom + X.top, width: X.width, height: X.top,
        glyphMax: X.glyph_max, where: `Apadana ${f.id} stair facade, ${texts.length > 1 ? 'the Babylonian above the Elamite' : 'the Old Persian'} beside the audience panel`, tier: 'B (the panels) / C (sides, size)' }, report);
    }
  }
  // the Phase 4 central facades and door jambs (relief_programmes.ts): XPc (Tachara S stair), XPd (Hadish W stair), XPe
  // (Hadish E, W doorways), DPa (Tachara S doorway), DPb (Hadish NW doorway)
  for (const p of extra) {
    if (!(inscriptions as any)[p.id]) continue;
    carveField(g, parts, { texts: (p.versions ?? [p.version]).map(ver => ({ id: p.id, ver })), arrangement: p.arrangement ?? 'stack', origin: p.origin, along: p.along, normal: p.normal, yTop: p.yTop,
      width: p.width, height: p.height ?? 3, glyphMax: p.glyph ?? v<any>('global', 'r_stair_relief').glyph, where: p.where ?? p.id, tier: p.tier ?? 'C' }, report);
  }
  // DPc on the cornices of the Tachara windows (tachara.r_window_inscription): the front face of each frame's cornice (the top
  // block of the sill-lintel-cornice stack that shares the window's centre) on the side the row names
  if (present('tachara')) {
    const WI = v<any>('tachara', 'r_window_inscription'), n = WI.normal as Pt, ax = Math.abs(n[0]) > 0.5 ? 0 : 1;
    const frames = parts.filter(p => p.building === 'tachara' && p.kind === 'window_frame' && p.type === 'box') as Box[], stacks = new Map<string, Box[]>();
    for (const b of frames) { const k = `${b.c[0].toFixed(2)},${b.c[1].toFixed(2)}`; (stacks.get(k) ?? stacks.set(k, []).get(k)!).push(b); }
    for (const st of stacks.values()) {
      if (st.length < 3) continue; // a jamb
      const b = st.reduce((q, x) => (x.y1 > q.y1 ? x : q));
      if (b.size[ax] > b.size[1 - ax]) continue; // the frame does not stand in a wall across n
      const o: Pt = ax === 1 ? [b.c[0], b.c[1] + (n[1] * b.size[1]) / 2] : [b.c[0] + (n[0] * b.size[0]) / 2, b.c[1]];
      carveField(g, parts, { texts: WI.versions.map((ver: Version) => ({ id: WI.inscription, ver })), arrangement: WI.arrangement, origin: o, along: [-n[1], n[0]], normal: n, yTop: b.y1 - WI.margin,
        width: b.size[1 - ax] - 2 * WI.margin, height: b.y1 - b.y0 - 2 * WI.margin, glyphMax: WI.glyph_max, where: 'the cornice of a Tachara window frame, portico side, the three versions stacked',
        tier: 'B (window cornices) / C (which windows, face, stacking)', surface: b.material, snap: false }, report);
    }
  }
  // DPd-DPg on the Terrace south wall (terrace.r_south_wall_inscriptions)
  {
    const S = v<any>('terrace', 'r_south_wall_inscriptions'), plat = parts.find(p => p.building === 'terrace' && p.type === 'prism') as any;
    if (plat?.polygon) {
      const poly = plat.polygon as Pt[], cx = poly.reduce((q, p) => q + p[0], 0) / poly.length, cy = poly.reduce((q, p) => q + p[1], 0) / poly.length;
      let best: { a: Pt; b: Pt; n: Pt; y: number } | null = null;
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i], b = poly[(i + 1) % poly.length], L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < S.texts.length * (S.panel_width + S.gap)) continue;
        let n: Pt = [(b[1] - a[1]) / L, -(b[0] - a[0]) / L]; const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; if ((mid[0] - cx) * n[0] + (mid[1] - cy) * n[1] < 0) n = [-n[0], -n[1]];
        if (n[1] < -0.95 && (!best || mid[1] < best.y)) best = { a, b, n, y: mid[1] };
      }
      if (best) {
        const { a, b, n } = best, L = Math.hypot(b[0] - a[0], b[1] - a[1]), along: Pt = [-n[1], n[0]], mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        const total = S.texts.length * S.panel_width + (S.texts.length - 1) * S.gap; void L;
        const blockOf = (id: string): Block => { const t = (inscriptions as any)[id], ver: Version = t.op_translit ? 'op' : t.el_atf ? 'el' : 'bab'; return { id, ver, text: panelText(id, ver)! }; };
        const glyph = Math.min(...S.texts.map((id: string) => fitBlocks([blockOf(id)], 'stack', S.panel_width, S.height, S.glyph_max).glyph)); // one sign size for the four
        S.texts.forEach((id: string, i: number) => {
          const ver = blockOf(id).ver, off = -total / 2 + S.panel_width / 2 + i * (S.panel_width + S.gap), o: Pt = [mid[0] + along[0] * off, mid[1] + along[1] * off];
          carveField(g, parts, { texts: [{ id, ver }], arrangement: 'stack', origin: o, along, normal: n, yTop: -S.top_below_court, width: S.panel_width, height: S.height, glyphMax: glyph,
            where: 'the Terrace south wall', tier: 'B (the south wall) / C (position, size, order)', surface: 'terrace', snap: false }, report);
        });
      }
    }
  }
  // the programme's gaps (Phase 8 review A-M5): every copy standing in 467 that is not carved, flagged
  const missing = (programme.missing as any[]).map(m => `${m.id}: ${m.what} (${m.why})`);
  const summary = `royal inscriptions: ${report.length} versions carved; ${missing.length} copies or versions standing in 467 NOT carved [PLACEHOLDER: Q-290, src/data/royal_inscriptions.json]`;
  g.userData = { tier: 'B/C', placeholder: missing.length > 0, summary, missing, note: `carved inscriptions (D-177: text and signs, carving and placement):\n${report.join('\n')}\nNOT carved (Q-290):\n${missing.join('\n')}`, report };
  return g;
}
/** layer of the inscriptions' invisible pick rectangles (no camera renders it) */
export const INSCRIPTION_PICK_LAYER = 5;
const pickMat = new THREE.MeshBasicNodeMaterial({ side: THREE.DoubleSide, visible: false });
/** the Apadana foundation deposits (D-068, apadana.r_foundation_deposits): a limestone box with a lid under the outer corner
 *  of the hall wall at each listed corner, holding a gold and a silver plate inscribed with DPh. Sealed since the foundation:
 *  no camera can see them from the walkable world; the plates carry the text as data (the translation layer shows it), not
 *  as carved glyphs, and a pick rectangle over the corner's footing lets the translation layer name them */
export function buildFoundationDeposits(m: Manifest): THREE.Group {
  const g = new THREE.Group(); g.name = 'apadana-foundation-deposits';
  const a = m.apadana as any; if (!a) return g;
  const F = v<any>('apadana', 'r_foundation_deposits'), [cx, cy, hs] = a.room as number[], wt = a.wallThickness as number, floor = a.podium as number;
  const [bx, bz, bh] = F.box_outer as number[], t = F.box_wall as number, top = floor - F.top_below_floor, y0 = top - bh;
  const meta = { tier: 'C', src: 'ISAC-PA;LIVIUS-AI;ARIO', note: 'Apadana foundation deposit: stone box with a gold and a silver plate inscribed DPh (existence and contents B; corners Q-016; sizes and depth C)' };
  const stone = surfaceMaterial('limestone');
  const metal = (rgb: [number, number, number], metalness: number) => new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(...rgb, THREE.SRGBColorSpace), roughness: 0.35, metalness });
  const mats: Record<string, THREE.Material> = { gold: metal([0.83, 0.66, 0.26], 0.6), silver: metal([0.78, 0.78, 0.76], 0.6) };
  const slab = (w: number, h: number, d: number, x: number, y: number, z: number) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
  const boxGeo = mergeGeometries([slab(bx, t, bz, 0, t / 2, 0), slab(t, bh - F.lid - t, bz, -(bx - t) / 2, t + (bh - F.lid - t) / 2, 0), slab(t, bh - F.lid - t, bz, (bx - t) / 2, t + (bh - F.lid - t) / 2, 0),
    slab(bx - 2 * t, bh - F.lid - t, t, 0, t + (bh - F.lid - t) / 2, -(bz - t) / 2), slab(bx - 2 * t, bh - F.lid - t, t, 0, t + (bh - F.lid - t) / 2, (bz - t) / 2), slab(bx, F.lid, bz, 0, bh - F.lid / 2, 0)].map(q => { q.deleteAttribute('uv'); return q; }))!;
  for (const corner of F.corners as string[]) {
    const sx = corner.includes('E') ? 1 : -1, sy = corner.includes('N') ? 1 : -1, off = hs / 2 + wt / 2;
    const e = cx + sx * off, n = cy + sy * off;
    const box = new THREE.Mesh(boxGeo, stone); box.position.set(e, y0, -n); box.name = `foundation-box:${corner}`; box.userData = meta; g.add(box);
    let y = y0 + t; // plates lie flat on the floor of the box, silver under gold (order C)
    for (const P of [...(F.plates as any[])].reverse()) {
      const [pw, pd, pt] = P.size as number[]; const plate = new THREE.Mesh(new THREE.BoxGeometry(pw, pt, pd), mats[P.metal]);
      plate.position.set(e, y + pt / 2, -n); y += pt; plate.name = `foundation-plate:${corner}:${P.metal}`;
      plate.userData = { ...meta, inscription: F.inscription, note: `${P.metal} plate inscribed with DPh in Old Persian, Elamite and Babylonian (text: ARIo Q007164, A; the signs are data, not carved geometry: sealed out of sight)` };
      g.add(plate);
    }
    // the pick rectangle: horizontal at floor level over the corner's footing, reaching 1 m beyond the wall's outer faces
    const size = wt + 2, quad = new THREE.Mesh(new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2), pickMat);
    quad.position.set(e + sx * 1, floor + 0.02, -(n + sy * 1)); quad.layers.set(INSCRIPTION_PICK_LAYER); quad.name = `inscription:${F.inscription}:deposit:${corner}:pick`;
    quad.userData = { ...meta, inscription: F.inscription, version: 'op', pickFar: 8 }; g.add(quad);
  }
  return g;
}
void mergeGeometries;
