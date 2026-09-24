// Translation layer (brief §9.4, §10; out-of-world, OFF by default; English allowed here only). When the setting is on:
//  - subtitles for speech: the line as it is heard (romanised: lexicon.ts spokenForm), the English gloss, the language,
//    the tier and the line's source;
//  - inscriptions: look at a carved text (≤ 15 m, centre of view) to see the transliteration OF THE VERSION LOOKED AT
//    (Old Persian, Elamite or Babylonian; ARIo, CC0) and an interlinear gloss for the words that version's lexicon
//    covers (each gloss sourced there). No published English translation is shown: the only one the project has read
//    (Livius.org) is "All rights reserved" on its own pages, which §12 does not allow (D-167, BLOCKERS B17, NEEDS #14);
//    nothing is paraphrased from memory;
//  - the map (key M) and the chronicle (key J): out-of-world panels; the world itself keeps no map, compass or waypoint.
import * as THREE from 'three/webgpu';
import type { Settings } from '../core/settings';
import inscriptions from '../data/inscriptions.json';
import opLexicon from '../../research/LEXICON/old_persian.json';
import elLexicon from '../../research/LEXICON/elamite.json';
import babLexicon from '../../research/LEXICON/babylonian.json';
import { FOOTPRINTS, present } from '../arch/spec';
import { INSCRIPTION_PICK_LAYER } from '../arch/decor';
import { LANG_NAMES, type LangId } from '../lang/lexicon';
import { LINE_BY_ID } from '../people/speech_lines';
import { WRITING } from '../world/writing';

export interface SubtitleLike { lang: string; translit: string; gloss: string; tier: string; speakerId?: number; lineId?: string }
export interface ChronicleEvent { t: number; kind: string; text: string; place: string; tier?: string }
export interface TranslationContext {
  camera: THREE.Camera; inscriptions: THREE.Object3D | (THREE.Object3D | null)[] | null; subtitle: SubtitleLike | null; subtitleAt: number; now: number;
  player: { e: number; n: number; yawDeg: number }; events: ChronicleEvent[]; timeLabel: (tHours: number) => string; places: Record<string, { at: [number, number] }>;
  /** the built world's map layers (settlement, plain), computed once by the world */
  mapLayers?: () => MapItem[];
}

const ALL3 = 'Old Persian, Elamite and Babylonian';
/** what each inscription is, where it stands and which versions are carved there (the placement tiers: SITE_SPEC rows) */
export const INSCRIPTION_INFO: Record<string, { title: string; where: string; carved: string }> = {
  XPa: { title: 'XPa — Xerxes, Gate of All Nations', where: 'carved above each doorway colossus of the Gate (one trilingual per colossus, B; the order of the columns C)', carved: `${ALL3} side by side` },
  XPb: { title: 'XPb — Xerxes, Apadana', where: 'beside the audience panels of the Apadana N and E stairs: the Old Persian on one panel, the Babylonian and Elamite on another (B; sides and size C)', carved: `${ALL3}, on two panels` },
  XPc: { title: 'XPc — Xerxes, Tachara', where: 'between the guards of the central façade of the Tachara S stair (B; the arrangement C)', carved: `${ALL3}, stacked` },
  DNa: { title: 'DNa — Darius I, his tomb at Naqsh-e Rustam', where: 'upper register, behind the king (panel position C)', carved: 'Old Persian version only (the Elamite and Babylonian versions are not carved in this build: research/OPEN_QUESTIONS.md Q-290)' },
  DNb: { title: 'DNb — Darius I, his tomb at Naqsh-e Rustam', where: 'façade, between the columns left of the door (panel position C; signs lost in the edition left uncut)', carved: 'Old Persian version only (the Elamite and Babylonian versions are not carved in this build: research/OPEN_QUESTIONS.md Q-290)' },
  XPd: { title: 'XPd — Xerxes, Hadish', where: 'between the guards of the central façade of the Hadish W stair (B; position and arrangement C)', carved: `${ALL3}, stacked` },
  DPh: { title: 'DPh — Darius I, the foundation plates of the Apadana', where: 'a gold and a silver plate in a stone box sealed under this corner of the hall since its foundation, unseen (corners: the NE and SE boxes, Q-016; box and depth C)', carved: `${ALL3} on each plate (data, not carved geometry)` },
  XPe: { title: 'XPe — Xerxes, Hadish', where: 'above the king and his attendants on the reveals of the Hadish E and W doorways (versions stacked; order and size C)', carved: `${ALL3}, stacked` },
  DPa: { title: 'DPa — Darius I, Tachara', where: 'above the king and his attendants on the reveals of the Tachara S doorway (B; which doorway and the stacking C)', carved: `${ALL3}, stacked` },
  DPb: { title: 'DPb — Darius I', where: 'above the king on the reveals of the Hadish NW doorway (the doorway and the stacking C)', carved: `${ALL3}, stacked` },
  DPc: { title: 'DPc — Darius I, Tachara window frames', where: 'on the cornice of a Tachara window frame, portico side (B; which windows and the stacking C)', carved: `${ALL3}, stacked` },
  DPd: { title: 'DPd — Darius I, Terrace south wall', where: 'the Terrace south wall (B; position along the wall C)', carved: 'Old Persian (a text of its own: DPd has no other version)' },
  DPe: { title: 'DPe — Darius I, Terrace south wall', where: 'the Terrace south wall (B; position along the wall C)', carved: 'Old Persian (a text of its own)' },
  DPf: { title: 'DPf — Darius I, Terrace south wall', where: 'the Terrace south wall (B; position along the wall C)', carved: 'Elamite (a text of its own)' },
  DPg: { title: 'DPg — Darius I, Terrace south wall', where: 'the Terrace south wall (B; position along the wall C)', carved: 'Babylonian (a text of its own)' },
};
const VERSION_NAME: Record<string, string> = { op: 'Old Persian', el: 'Elamite', bab: 'Babylonian' };
const LEX_FILE: Record<string, string> = { op: 'old_persian.json', el: 'elamite.json', bab: 'babylonian.json' };
/** why no translation is shown (D-167): the project's own finding, with where it is logged */
export const TRANSLATION_STATUS = 'No published English translation is shown. The one this project has read, Livius.org\'s (J. Lendering, after Kent and Lecoq; read through the Electronic-Old-Persian-Library scrape), carries "All content copyright © 1995–2024 Livius.org. All rights reserved." on its own pages; the scrape\'s CC-BY-NC cannot relicense it, and §12 allows only CC0, CC-BY or CC-BY-NC here. A public-domain or CC-BY(-NC) translation is needed (NEEDS_FROM_ME #14; BLOCKERS B17). Nothing is paraphrased from memory.';
import { MAP_ZOOMS, MapItem, MapStyle, P2 } from './mapLayers';

/** English names for the map and the chronicle (out-of-world; the conventional modern names, not period ones) */
const FOOTPRINT_LABEL: Record<string, string> = {
  hall100: 'Hall of a Hundred Columns', gate_nations: 'Gate of All Nations', apadana: 'Apadana', tachara: 'Tachara (Palace of Darius)',
  hadish: 'Hadish (Palace of Xerxes)', treasury: 'Treasury', harem: '"Harem" of Xerxes', tripylon: 'Tripylon', garrison: 'Garrison quarter',
  grand_stair: 'Grand Stair', palace_h: 'Palace H', palace_a3: 'Palace A3', unfinished_gate: 'Unfinished Gate', tomb_a2: 'Rock tomb',
};
/** a readable name for a simulation place id (post_treas_1 → Treasury post 1) */
export function placeLabel(id: string): string {
  const P: [RegExp, (m: RegExpMatchArray) => string][] = [
    [/^post_stair_([ns])$/, m => `${m[1] === 'n' ? 'north' : 'south'} stair post`], [/^post_gate_([ws])(\d)$/, m => `Gate post ${m[1].toUpperCase()}${m[2]}`],
    [/^post_treas_(\d)$/, m => `Treasury post ${m[1]}`], [/^post_([a-z]+)_(\d)$/, m => `${m[1]} post ${m[2]}`], [/^post_apa_([we])$/, m => `Apadana post ${m[1].toUpperCase()}`],
    [/^stair_foot$/, () => 'the depot at the stair foot'], [/^h:/, () => 'a house in the town'],
  ];
  for (const [re, f] of P) { const m = id.match(re); if (m) return f(m); }
  return id.replace(/_/g, ' ');
}
type GlossRow = { gloss: string; tier: string; src: string[]; form: string };
/** Old Persian word keys: ARIo writes A.uramazdā and marks glides (nai̯); the lexicon writes Auramazdā, naiba- */
const opKey = (w: string) => w.normalize('NFC').replace(/[.̯]/g, '').toLowerCase();
/** cuneiform (ATF) word keys: as written, and without determinatives */
const atfKeys = (w: string) => { const a = w.normalize('NFC').trim(); return [...new Set([a, a.replace(/\{[^}]*\}/g, '')])].filter(Boolean); };
function glossIndex(lang: 'op' | 'el' | 'bab'): { exact: Map<string, GlossRow>; stems: [string, GlossRow][] } {
  const rows = (lang === 'op' ? opLexicon : lang === 'el' ? elLexicon : babLexicon) as any[];
  const exact = new Map<string, GlossRow>(), stems: [string, GlossRow][] = [];
  for (const e of rows) {
    if (String(e.form).startsWith('(')) continue; // absence entries
    const g: GlossRow = { gloss: e.gloss, tier: String(e.tier), src: e.src ?? [], form: e.form };
    if (lang === 'op') {
      const f = String(e.form);
      if (f.endsWith('-')) stems.push([opKey(f.slice(0, -1)), g]); else exact.set(opKey(f), g);
      if (e.spoken) exact.set(opKey(e.spoken), g);
    } else for (const alt of String(e.transliteration ?? '').split(/\s*\/\s*/)) for (const k of atfKeys(alt)) if (!exact.has(k)) exact.set(k, g);
  }
  stems.sort((a, b) => b[0].length - a[0].length);
  return { exact, stems };
}
const GLOSS = { op: glossIndex('op'), el: glossIndex('el'), bab: glossIndex('bab') };
/** Old Persian endings a stem may carry in the texts (letters only; a search aid, not a grammar: a stem match is shown
 *  as such, with the stem's own gloss) */
const OP_ENDING = /^[āaiīuūmšyhvnt]{0,5}$/;

export interface InscriptionWord { w: string; gloss: string | null; how: 'form' | 'stem' | null; tier?: string; src?: string[] }
export interface InscriptionReading {
  id: string; version: 'op' | 'el' | 'bab'; title: string; where: string; carved: string; versionName: string;
  translitSource: string; words: InscriptionWord[]; covered: number; sources: string[]; translation: string; notes: string[];
}
/** What the layer shows for a panel: the transliteration of the version looked at, and the glosses its lexicon has. */
export function inscriptionReading(id: string, version = 'op'): InscriptionReading | null {
  const t = (inscriptions as any)[id]; if (!t) return null;
  const info = INSCRIPTION_INFO[id] ?? { title: id, where: '', carved: '' };
  const v = (['op', 'el', 'bab'].includes(version) ? version : 'op') as 'op' | 'el' | 'bab';
  const text = String(v === 'op' ? t.op_translit : v === 'el' ? t.el_atf : t.bab_atf).trim();
  if (!text) return { id, version: v, title: info.title, where: info.where, carved: info.carved, versionName: VERSION_NAME[v], translitSource: '', words: [], covered: 0, sources: [], translation: TRANSLATION_STATUS,
    notes: [`The ${VERSION_NAME[v]} version of ${id} is not in the corpus mirror read (ARIo via SLAB-NLP/Akk): unavailable.`] };
  const G = GLOSS[v], words: InscriptionWord[] = [], notes: string[] = [];
  for (const w of text.split(/\s+/)) {
    let g: GlossRow | undefined, how: InscriptionWord['how'] = null;
    if (v === 'op') {
      const k = opKey(w); g = G.exact.get(k); if (g) how = 'form';
      else {
        const st = G.stems.find(([s]) => s.length >= 3 && k !== s && (k.startsWith(s) ? OP_ENDING.test(k.slice(s.length)) : /[aiu]$/.test(s) && k.startsWith(s.slice(0, -1)) && OP_ENDING.test(k.slice(s.length - 1))));
        if (st) { g = st[1]; how = 'stem'; }
      }
    } else for (const k of atfKeys(w)) { g = G.exact.get(k); if (g) { how = 'form'; break; } }
    words.push({ w, gloss: g?.gloss ?? null, how, tier: g?.tier, src: g?.src });
  }
  if (v !== 'op') notes.push(`Version split of the ARIo running text: ${t.tier?.version_split ?? 'C'}.`);
  else if (t.op_lined) { // what is carved is the edition's sign line (D-184); say what the stone has that the words above do not show
    const rows = ((t.op_words as any[]) ?? []).filter(r => r.signs), sum = (k: string) => rows.reduce((q, r) => q + (Array.isArray(r[k]) ? r[k].length : typeof r[k] === 'number' ? r[k] : 0), 0);
    const omittedWords = ((t.op_words as any[]) ?? []).filter(r => r.cmp === 'ario-only').length;
    notes.push(`The stone's signs as carved: the same edition's sign-by-sign line (ARIo in CATF, CC0; D-184), as the stone stood in 467: ${sum('excess')} extra signs the engraver cut are carved, ${sum('omitted')} signs he omitted (supplied above by the editor) are not${omittedWords ? ` (${omittedWords} whole words among them)` : ''}, ${sum('restored')} signs restored after later damage are carved (C) (research/OP_SIGNS.md, Q-288).`);
  }
  const sources = [...new Set(words.flatMap(w => w.src ?? []))].sort();
  return { id, version: v, title: info.title, where: info.where, carved: info.carved, versionName: VERSION_NAME[v],
    translitSource: `Transliteration of the ${VERSION_NAME[v]} version${v === 'op' ? ' (normalised)' : ' (ATF)'}: ARIo, Schmitt 2009, in ORACC (MOCCI; CC0), text ${t.ario}.`,
    words, covered: words.filter(w => w.gloss).length, sources, translation: TRANSLATION_STATUS, notes };
}

/** What the layer shows for a written object (writing.json, D-179): what it is, the text's id and source and its
 *  transliteration, the seal and how much of it is attested; NO translation (B17a), and a placeholder said as such. */
export function writingReading(objectId: string): { title: string; lines: string[] } | null {
  const O = WRITING.objects[objectId]; if (!O) return null;
  const lines: string[] = [];
  const textLines = (tid: string) => { const T = WRITING.texts[tid];
    lines.push(`Text ${tid}: ARIo ${T.ario} (Schmitt 2009, in ORACC; CC0). ${T.ident}.`);
    lines.push(`Old Persian (normalised transliteration): ${T.op_translit}`);
    if (T.el_atf) lines.push(`Elamite (ATF): ${T.el_atf}`);
    if (T.bab_atf) lines.push(`Babylonian (ATF): ${T.bab_atf}`); };
  if (O.placeholder) lines.push(`No text shown: placeholder. ${O.placeholder_why ?? ''}`);
  else if (O.text) textLines(O.text);
  else if (O.why_no_text) lines.push(`No text visible: ${String(O.why_no_text)}.`);
  if (O.seal) { const S = WRITING.seals[O.seal]; lines.push(`Sealed with ${O.seal} (tier ${S.tier}). ${S.attested}. Wording: ${S.wording}. Design: ${S.design}.`); if (S.text !== O.text) textLines(S.text); }
  lines.push(`Tier ${O.tier}; sources ${O.src.join(', ')}.`);
  lines.push(TRANSLATION_STATUS);
  return { title: `${O.what} (translation layer)`, lines };
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

export class TranslationLayer {
  private root = el('div', 'tl');
  private sub = el('div', 'tl-sub');
  private insc = el('div', 'tl-insc');
  private panel = el('div', 'tl-panel');
  private mapCanvas = document.createElement('canvas');
  private mode: 'none' | 'map' | 'chronicle' = 'none';
  private zoom = 0; private drawn = { zoom: -1, e: 0, n: 0, yaw: 0, t: 0 };
  private ray = new THREE.Raycaster(); private lastPick = 0; private picked: { id: string; version: string } | null = null;
  constructor(private settings: () => Settings) {
    this.ray.layers.set(INSCRIPTION_PICK_LAYER); // the panels' pick rectangles, not the carved signs
    this.root.append(this.sub, this.insc, this.panel); document.body.append(this.root);
    this.mapCanvas.width = 900; this.mapCanvas.height = 900; this.mapCanvas.className = 'tl-map';
  }
  toggle(which: 'map' | 'mapZoom' | 'chronicle') {
    if (!this.settings().translation) return;
    if (which === 'mapZoom') { if (this.mode === 'map') this.zoom = (this.zoom + 1) % MAP_ZOOMS.length; return; }
    this.mode = this.mode === which ? 'none' : which;
  }
  get panelOpen() { return this.mode !== 'none'; }

  update(ctx: TranslationContext) {
    const s = this.settings(); this.root.hidden = !s.translation; if (!s.translation) { this.mode = 'none'; return; }
    this.root.style.setProperty('--tl-scale', String(s.subtitleSize));
    // subtitles: shown for 3 s + reading time
    const sb = ctx.subtitle, show = sb && ctx.now - ctx.subtitleAt < 3 + (sb.gloss.length + sb.translit.length) / 18;
    this.sub.hidden = !show;
    if (show && sb) { const src = sb.lineId ? LINE_BY_ID.get(sb.lineId)?.def.src : undefined;
      this.sub.replaceChildren(el('div', 'tl-orig', sb.translit), el('div', 'tl-gloss', `“${sb.gloss}”`), el('div', 'tl-meta', `${LANG_NAMES[sb.lang as LangId] ?? sb.lang} · tier ${sb.tier}${src ? ` · ${src}` : ''}`)); }
    // inscriptions under the crosshair
    if (ctx.now - this.lastPick > 0.25 && ctx.inscriptions) {
      this.lastPick = ctx.now; this.ray.setFromCamera(new THREE.Vector2(0, 0), ctx.camera); this.ray.far = 80;
      const groups = (Array.isArray(ctx.inscriptions) ? ctx.inscriptions : [ctx.inscriptions]).filter((g): g is THREE.Object3D => !!g);
      // within reading distance: 15 m on the Terrace; panels that stand high on a cliff (Naqsh-e Rustam) set their own
      const hit = this.ray.intersectObjects(groups, true).find(h => h.distance <= (h.object.userData.pickFar ?? 15) && h.object.visible);
      // the pick carries the panel's inscription and version (decor.ts, naqsh.ts: userData, and the name inscription:<id>:<ver>)
      this.picked = hit ? { id: String(hit.object.userData.inscription ?? hit.object.name.split(':')[1]), version: String(hit.object.userData.version ?? hit.object.name.split(':')[2] ?? 'op') } : null;
    }
    this.insc.hidden = !this.picked;
    if (this.picked) this.insc.replaceChildren(...this.inscriptionView(this.picked.id, this.picked.version));
    // panels
    this.panel.hidden = this.mode === 'none';
    if (this.mode === 'map') {
      const d = this.drawn, p = ctx.player; // redraw on zoom, a move of 2 px or a turn, at most every 0.2 s
      if (d.zoom !== this.zoom || (ctx.now - d.t > 0.2 && (Math.hypot(p.e - d.e, p.n - d.n) > 2 * this.metresPerPx() || Math.abs(p.yawDeg - d.yaw) > 2))) {
        this.drawMap(ctx); Object.assign(d, { zoom: this.zoom, e: p.e, n: p.n, yaw: p.yawDeg, t: ctx.now });
        const Z = MAP_ZOOMS[this.zoom];
        this.panel.replaceChildren(el('h2', '', `Map (translation layer): ${Z.name}`), this.mapCanvas, el('div', 'small', this.zoom === 0
          ? 'Grid north up (341° true). Footprints: OpenStreetMap ruin traces and the Phase 4 corrections. Z: wider view. M closes.'
          : 'Grid north up (341° true), centred on you. What the world builds: town plots, roads, water, rivers, canals, villages and sites, as reconstructed. Solid outline: tier A/B; dashed: tier C (reconstructed). Z: next scale. M closes.'));
      }
    } else this.drawn.zoom = -1;
    if (this.mode === 'chronicle') {
      const list = el('div', 'tl-chron');
      for (const ev of ctx.events.slice(-40).reverse()) { const p = ctx.places[ev.place]; list.append(el('div', 'row', `${ctx.timeLabel(ev.t)} — ${ev.text}${p ? ` (${placeLabel(ev.place)})` : ''}${ev.tier ? ` · tier ${ev.tier}` : ''}`)); }
      this.panel.replaceChildren(el('h2', '', 'Chronicle (translation layer)'), list.childElementCount ? list : el('p', 'small', 'Nothing noted yet.'), el('div', 'small', 'Events the simulation records. J closes.'));
    }
  }

  private inscriptionView(id: string, version: string): HTMLElement[] {
    if (id.startsWith('writing:')) { const w = writingReading(id.slice(8)); return w ? [el('div', 'tl-title', w.title), ...w.lines.map(l => el('div', 'small', l))] : [el('div', '', id)]; }
    const r = inscriptionReading(id, version); if (!r) return [el('div', '', id)];
    const inter = el('div', 'tl-inter');
    for (const w of r.words) { const cell = el('span', 'tl-w'); cell.append(el('span', 'tl-wo', w.w), el('span', 'tl-wg', w.gloss ? (w.how === 'stem' ? `${w.gloss} (stem)` : w.gloss) : '·')); inter.append(cell); }
    return [el('div', 'tl-title', `${r.title} · ${r.versionName} version`), el('div', 'small', `${r.where}. Carved: ${r.carved}.`), el('div', 'small', r.translitSource), inter,
      el('div', 'small', r.words.length ? `Word glosses from the project lexicon (research/LEXICON/${LEX_FILE[r.version]}) for ${r.covered} of ${r.words.length} words; “·” = not in the lexicon; “(stem)” = the stem's gloss for an inflected form. Sources of these glosses: ${r.sources.join(', ') || 'none'} (src/data/sources.json).` : ''),
      ...r.notes.map(n => el('div', 'small', n)), el('div', 'small', r.translation)];
  }

  private metresPerPx() { const Z = MAP_ZOOMS[this.zoom]; return Z.half ? (2 * Z.half) / this.mapCanvas.width : 510 / this.mapCanvas.width; }

  private drawMap(ctx: TranslationContext) {
    const c = this.mapCanvas.getContext('2d'); if (!c) return;
    const Z = MAP_ZOOMS[this.zoom], W = this.mapCanvas.width, H = this.mapCanvas.height;
    const [x0, x1, y0, y1] = Z.half ? [ctx.player.e - Z.half, ctx.player.e + Z.half, ctx.player.n - Z.half, ctx.player.n + Z.half] : [-80, 280, -260, 250];
    const sc = Math.min(W / (x1 - x0), H / (y1 - y0)), px = (e: number) => (e - x0) * sc + (W - (x1 - x0) * sc) / 2, py = (n: number) => H - ((n - y0) * sc + (H - (y1 - y0) * sc) / 2);
    c.fillStyle = '#1b1712'; c.fillRect(0, 0, W, H);
    if (Z.half && ctx.mapLayers) this.drawLayers(c, ctx.mapLayers(), px, py, sc, [x0, x1, y0, y1]);
    const PRESENT_KEY: Record<string, string> = { museum_modern: '', modern_roof_a1bf0b: '', palace_h: 'palace_h', palace_a3_osm: 'palace_a3', unfinished_gate: 'unfinished_gate', tomb_a2: 'tombs_rahmat' };
    for (const [k, f] of Object.entries(FOOTPRINTS)) {
      if (k.startsWith('_') || !(f as any).polygon) continue;
      const pk = PRESENT_KEY[k] ?? k; if (pk === '' || (k !== 'terrace' && !present(pk))) continue;
      c.beginPath(); (f as any).polygon.forEach(([e, n]: [number, number], i: number) => (i ? c.lineTo(px(e), py(n)) : c.moveTo(px(e), py(n)))); c.closePath();
      c.fillStyle = k === 'terrace' ? '#3a332a' : '#6b5e4a'; c.strokeStyle = '#c9a25e'; c.lineWidth = k === 'terrace' ? 2 : 1; c.fill(); c.stroke();
      if (k !== 'terrace' && !Z.half) { const [ce, cn] = (f as any).centroid; c.fillStyle = '#eee3cf'; c.font = '13px Georgia'; c.textAlign = 'center'; c.fillText(FOOTPRINT_LABEL[k] ?? k.replace(/_/g, ' '), px(ce), py(cn)); }
    }
    if (Z.half) { c.fillStyle = '#eee3cf'; c.font = '13px Georgia'; c.textAlign = 'center'; c.fillText('Terrace', px(100), py(-10) - (Z.half > 5000 ? 8 : 0)); }
    // the visitor: position and facing
    const { e, n, yawDeg } = ctx.player, a = (yawDeg * Math.PI) / 180;
    c.save(); c.translate(px(e), py(n)); c.rotate(a); c.fillStyle = '#ffd27a'; c.beginPath(); c.moveTo(0, -12); c.lineTo(7, 8); c.lineTo(-7, 8); c.closePath(); c.fill(); c.restore();
    // scale bar
    const bar = Z.bar, label = bar >= 1000 ? `${bar / 1000} km` : `${bar} m`;
    c.strokeStyle = '#eee3cf'; c.lineWidth = 2; c.beginPath(); c.moveTo(30, H - 30); c.lineTo(30 + bar * sc, H - 30); c.stroke(); c.fillStyle = '#eee3cf'; c.textAlign = 'left'; c.font = '13px Georgia'; c.fillText(label, 30, H - 38);
  }

  private drawLayers(c: CanvasRenderingContext2D, items: MapItem[], px: (e: number) => number, py: (n: number) => number, sc: number, box: [number, number, number, number]) {
    const [x0, x1, y0, y1] = box, pad = (x1 - x0) * 0.05;
    const inView = (pts: P2[]) => pts.some(([e, n]) => e > x0 - pad && e < x1 + pad && n > y0 - pad && n < y1 + pad) || (pts.length > 1 && pts.some(([e], i) => i > 0 && (pts[i - 1][0] - x0) * (e - x0) < 0));
    const FILL: Partial<Record<MapStyle, string>> = { zone: 'rgba(160,130,90,0.16)', garden: 'rgba(90,120,60,0.30)', field: 'rgba(120,130,60,0.14)', plot: '#8a7556' };
    const LINE: Partial<Record<MapStyle, [string, number]>> = { road: ['#b89a6a', 1.5], river: ['#6fa3c8', 2.5], canal: ['#5e8fb0', 1], zone: ['#a0825a', 1], garden: ['#7d9a55', 1], field: ['#8d9450', 1] };
    const order: MapStyle[] = ['field', 'zone', 'garden', 'plot', 'canal', 'river', 'road', 'mountain', 'site', 'village'];
    const labels: [string, number, number][] = [];
    for (const st of order) for (const it of items) {
      if (it.style !== st || !inView(it.pts)) continue;
      c.setLineDash(it.tier === 'C' && it.style !== 'plot' ? [5, 4] : []);
      if (it.kind === 'area') {
        c.beginPath(); it.pts.forEach(([e, n], i) => (i ? c.lineTo(px(e), py(n)) : c.moveTo(px(e), py(n)))); c.closePath();
        c.fillStyle = FILL[st] ?? 'rgba(200,180,140,0.2)'; c.fill();
        if (st !== 'plot') { const [col, w] = LINE[st] ?? ['#c9a25e', 1]; c.strokeStyle = col; c.lineWidth = w; c.stroke(); }
      } else if (it.kind === 'line') {
        const [col, w] = LINE[st] ?? ['#c9a25e', 1]; c.strokeStyle = col; c.lineWidth = Math.max(w, (it.width ?? 0) * sc);
        c.beginPath(); it.pts.forEach(([e, n], i) => (i ? c.lineTo(px(e), py(n)) : c.moveTo(px(e), py(n)))); c.stroke();
      } else {
        const [e, n] = it.pts[0]; c.setLineDash([]);
        c.fillStyle = st === 'village' ? '#d9b777' : st === 'mountain' ? '#9a8f80' : '#eee3cf';
        c.beginPath(); c.arc(px(e), py(n), st === 'village' ? 3.5 : 3, 0, Math.PI * 2); c.fill();
        // labels: the name alone (the tier shows as the dashed outline and the trailing C); villages placed by rule with no
        // ancient name stay dots, or their long descriptions overprint the plain
        const name = (it.label ?? '').replace(/\s*\([^)]*\)/g, '').trim();
        if (name && !/^unlocated/i.test(name)) labels.push([name + (it.tier === 'C' ? ' (C)' : ''), px(e), py(n)]);
      }
    }
    c.setLineDash([]); c.fillStyle = '#eee3cf'; c.font = '12px Georgia'; c.textAlign = 'left';
    const used: [number, number][] = []; // skip labels that would overprint an earlier one
    for (const [t, x, y] of labels) { if (used.some(([ux, uy]) => Math.abs(ux - x) < 90 && Math.abs(uy - y) < 14)) continue; used.push([x, y]); c.fillText(t, x + 6, y + 4); }
  }
}
