// Translation layer (brief §9.4, §10; out-of-world, OFF by default; English allowed here only). When the setting is on:
//  - subtitles for speech: the line in its own language (romanised as in the lexicon), the English gloss, language, tier;
//  - inscriptions: look at a carved text (≤ 15 m, centre of view) to see its transliteration (ARIo, CC0) and an
//    interlinear gloss for the words the project lexicon covers (each gloss sourced there). No published translation is
//    reachable from this sandbox, so none is shown (NEEDS_FROM_ME #14) — nothing is paraphrased from memory;
//  - the map (key M) and the chronicle (key J): out-of-world panels; the world itself keeps no map, compass or waypoint.
import * as THREE from 'three/webgpu';
import type { Settings } from '../core/settings';
import inscriptions from '../data/inscriptions.json';
import opLexicon from '../../research/LEXICON/old_persian.json';
import { FOOTPRINTS, present } from '../arch/spec';
import { INSCRIPTION_PICK_LAYER } from '../arch/decor';

export interface SubtitleLike { lang: string; translit: string; gloss: string; tier: string; speakerId?: number }
export interface ChronicleEvent { t: number; kind: string; text: string; place: string }
export interface TranslationContext {
  camera: THREE.Camera; inscriptions: THREE.Object3D | (THREE.Object3D | null)[] | null; subtitle: SubtitleLike | null; subtitleAt: number; now: number;
  player: { e: number; n: number; yawDeg: number }; events: ChronicleEvent[]; timeLabel: (tHours: number) => string; places: Record<string, { at: [number, number] }>;
  /** the built world's map layers (settlement, plain), computed once by the world */
  mapLayers?: () => MapItem[];
}

export const INSCRIPTION_INFO: Record<string, { title: string; where: string }> = {
  XPa: { title: 'XPa — Xerxes, Gate of All Nations', where: 'carved above each doorway colossus of the Gate, the Old Persian, Elamite and Babylonian side by side (order C)' },
  XPb: { title: 'XPb — Xerxes, Apadana', where: 'beside the audience panels of the Apadana stairs: the Old Persian on one panel, the Babylonian and Elamite on another (sides C)' },
  XPc: { title: 'XPc — Xerxes, Tachara', where: 'between the guards of the central façade of the Tachara S stair, three versions side by side (arrangement C)' },
  DNa: { title: 'DNa — Darius I, his tomb at Naqsh-e Rustam', where: 'upper register, behind the king (panel position C; Old Persian version only)' },
  DNb: { title: 'DNb — Darius I, his tomb at Naqsh-e Rustam', where: 'façade, between the columns left of the door (panel position C; Old Persian version only; modern lacunae shown as x)' },
  XPd: { title: 'XPd — Xerxes, Hadish', where: 'between the guards of the central façade of the Hadish W stair, three versions side by side (placement C)' },
  DPh: { title: 'DPh — Darius I, the foundation plates of the Apadana', where: 'a gold and a silver plate in a stone box sealed under this corner of the hall since its foundation, unseen (corners: the NE and SE boxes, Q-016; box and depth C)' },
  XPe: { title: 'XPe — Xerxes, Hadish', where: 'above the king and his attendants on the reveals of the Hadish E and W doorways (versions stacked; order and size C)' },
  DPa: { title: 'DPa — Darius I, Tachara', where: 'above the king and his attendants on the reveals of the Tachara S doorway (which doorway and the stacking C)' },
  DPb: { title: 'DPb — Darius I', where: 'above the king on the reveals of the Hadish NW doorway (the doorway and the stacking C)' },
  DPc: { title: 'DPc — Darius I, Tachara window frames', where: 'on the cornice of a Tachara window frame, portico side (which windows and the stacking C)' },
  DPd: { title: 'DPd — Darius I, Terrace south wall', where: 'the Terrace south wall, Old Persian (position along the wall C)' },
  DPe: { title: 'DPe — Darius I, Terrace south wall', where: 'the Terrace south wall, Old Persian (position along the wall C)' },
  DPf: { title: 'DPf — Darius I, Terrace south wall', where: 'the Terrace south wall, Elamite (position along the wall C)' },
  DPg: { title: 'DPg — Darius I, Terrace south wall', where: 'the Terrace south wall, Babylonian (position along the wall C)' },
};
const LANG_NAME: Record<string, string> = { op: 'Old Persian', el: 'Elamite', arc: 'Aramaic', bab: 'Babylonian', grc: 'Greek' };
import { MAP_ZOOMS, MapItem, MapStyle, P2 } from './mapLayers';
const GLOSS = new Map<string, { gloss: string; tier: string }>((opLexicon as any[]).map(e => [e.form, { gloss: e.gloss, tier: e.tier }]));

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

export class TranslationLayer {
  private root = el('div', 'tl');
  private sub = el('div', 'tl-sub');
  private insc = el('div', 'tl-insc');
  private panel = el('div', 'tl-panel');
  private mapCanvas = document.createElement('canvas');
  private mode: 'none' | 'map' | 'chronicle' = 'none';
  private zoom = 0; private drawn = { zoom: -1, e: 0, n: 0, yaw: 0, t: 0 };
  private ray = new THREE.Raycaster(); private lastPick = 0; private picked: string | null = null;
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
    if (show && sb) this.sub.replaceChildren(el('div', 'tl-orig', sb.translit), el('div', 'tl-gloss', `“${sb.gloss}”`), el('div', 'tl-meta', `${LANG_NAME[sb.lang] ?? sb.lang} · tier ${sb.tier}`));
    // inscriptions under the crosshair
    if (ctx.now - this.lastPick > 0.25 && ctx.inscriptions) {
      this.lastPick = ctx.now; this.ray.setFromCamera(new THREE.Vector2(0, 0), ctx.camera); this.ray.far = 80;
      const groups = (Array.isArray(ctx.inscriptions) ? ctx.inscriptions : [ctx.inscriptions]).filter((g): g is THREE.Object3D => !!g);
      // within reading distance: 15 m on the Terrace; panels that stand high on a cliff (Naqsh-e Rustam) set their own
      const hit = this.ray.intersectObjects(groups, true).find(h => h.distance <= (h.object.userData.pickFar ?? 15));
      this.picked = hit ? hit.object.name.split(':').slice(1, 3).join(':') || null : null; // id:version (a panel carries one version)
    }
    this.insc.hidden = !this.picked;
    if (this.picked) { const [id, ver] = this.picked.split(':'); this.insc.replaceChildren(...this.inscriptionView(id, ver)); }
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
      for (const ev of ctx.events.slice(-40).reverse()) { const p = ctx.places[ev.place]; list.append(el('div', 'row', `${ctx.timeLabel(ev.t)} — ${ev.text}${p ? ` (${ev.place.replace(/_/g, ' ')})` : ''}`)); }
      this.panel.replaceChildren(el('h2', '', 'Chronicle (translation layer)'), list.childElementCount ? list : el('p', 'small', 'Nothing noted yet.'), el('div', 'small', 'Events the simulation records. J closes.'));
    }
  }

  private inscriptionView(id: string, ver = 'op'): HTMLElement[] {
    const t = (inscriptions as any)[id]; const info = INSCRIPTION_INFO[id] ?? { title: id, where: '' };
    if (!t) return [el('div', '', id)];
    // an Elamite or Babylonian panel shows its own version: the edition's ATF transliteration (no word glosses: the lexicon
    // glosses here are Old Persian)
    if ((ver === 'el' || ver === 'bab') && t[`${ver}_atf`]) return [el('div', 'tl-title', `${info.title} (${LANG_NAME[ver]})`), el('div', 'small', `${info.where}. Transliteration of the ${LANG_NAME[ver]} version: ARIo (Schmitt 2009; CC0).`),
      el('div', 'tl-inter', t[`${ver}_atf`]), el('div', 'small', `No word glosses for the ${LANG_NAME[ver]} version in this build. A published English translation is not available in this build (NEEDS_FROM_ME #14).`)];
    const words = String(t.op_translit).split(/\s+/);
    const inter = el('div', 'tl-inter');
    let covered = 0;
    for (const w of words) { const g = GLOSS.get(w); if (g) covered++; const cell = el('span', 'tl-w'); cell.append(el('span', 'tl-wo', w), el('span', 'tl-wg', g ? g.gloss : '·')); inter.append(cell); }
    return [el('div', 'tl-title', info.title), el('div', 'small', `${info.where}. Transliteration: ARIo (Schmitt 2009; CC0).`), inter,
      el('div', 'small', `Word glosses from the project lexicon for ${covered} of ${words.length} words (each sourced in research/LEXICON/old_persian.json); “·” = not in the lexicon. A published English translation is not available in this build (NEEDS_FROM_ME #14).`)];
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
      if (k !== 'terrace' && !Z.half) { const [ce, cn] = (f as any).centroid; c.fillStyle = '#eee3cf'; c.font = '13px Georgia'; c.textAlign = 'center'; c.fillText(k.replace(/_/g, ' '), px(ce), py(cn)); }
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
