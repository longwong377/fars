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

export interface SubtitleLike { lang: string; translit: string; gloss: string; tier: string; speakerId?: number }
export interface ChronicleEvent { t: number; kind: string; text: string; place: string }
export interface TranslationContext {
  camera: THREE.Camera; inscriptions: THREE.Object3D | null; subtitle: SubtitleLike | null; subtitleAt: number; now: number;
  player: { e: number; n: number; yawDeg: number }; events: ChronicleEvent[]; timeLabel: (tHours: number) => string; places: Record<string, { at: [number, number] }>;
}

const INSCRIPTION_INFO: Record<string, { title: string; where: string }> = {
  XPa: { title: 'XPa — Xerxes, Gate of All Nations', where: 'carved above the doorway colossi of the Gate (version per colossus: C)' },
  XPb: { title: 'XPb — Xerxes, Apadana', where: 'beside the audience panels of the Apadana stairs (placement C)' },
  XPc: { title: 'XPc — Xerxes, Tachara', where: 'Tachara (S stair façade)' },
  XPd: { title: 'XPd — Xerxes, Hadish', where: 'Hadish (W stair façade)' },
};
const LANG_NAME: Record<string, string> = { op: 'Old Persian', el: 'Elamite', arc: 'Aramaic', bab: 'Babylonian' };
const GLOSS = new Map<string, { gloss: string; tier: string }>((opLexicon as any[]).map(e => [e.form, { gloss: e.gloss, tier: e.tier }]));

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; }

export class TranslationLayer {
  private root = el('div', 'tl');
  private sub = el('div', 'tl-sub');
  private insc = el('div', 'tl-insc');
  private panel = el('div', 'tl-panel');
  private mapCanvas = document.createElement('canvas');
  private mode: 'none' | 'map' | 'chronicle' = 'none';
  private ray = new THREE.Raycaster(); private lastPick = 0; private picked: string | null = null;
  constructor(private settings: () => Settings) {
    this.root.append(this.sub, this.insc, this.panel); document.body.append(this.root);
    this.mapCanvas.width = 900; this.mapCanvas.height = 900; this.mapCanvas.className = 'tl-map';
  }
  toggle(which: 'map' | 'chronicle') { if (!this.settings().translation) return; this.mode = this.mode === which ? 'none' : which; }
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
      this.lastPick = ctx.now; this.ray.setFromCamera(new THREE.Vector2(0, 0), ctx.camera); this.ray.far = 15;
      const hit = this.ray.intersectObject(ctx.inscriptions, true)[0];
      this.picked = hit ? (hit.object.name.split(':')[1] ?? null) : null;
    }
    this.insc.hidden = !this.picked;
    if (this.picked) this.insc.replaceChildren(...this.inscriptionView(this.picked));
    // panels
    this.panel.hidden = this.mode === 'none';
    if (this.mode === 'map') { this.drawMap(ctx); this.panel.replaceChildren(el('h2', '', 'Map (translation layer)'), this.mapCanvas, el('div', 'small', 'Grid north up (341° true). Footprints: OpenStreetMap ruin traces and the Phase 4 corrections. M closes.')); }
    if (this.mode === 'chronicle') {
      const list = el('div', 'tl-chron');
      for (const ev of ctx.events.slice(-40).reverse()) { const p = ctx.places[ev.place]; list.append(el('div', 'row', `${ctx.timeLabel(ev.t)} — ${ev.text}${p ? ` (${ev.place.replace(/_/g, ' ')})` : ''}`)); }
      this.panel.replaceChildren(el('h2', '', 'Chronicle (translation layer)'), list.childElementCount ? list : el('p', 'small', 'Nothing noted yet.'), el('div', 'small', 'Events the simulation records. J closes.'));
    }
  }

  private inscriptionView(id: string): HTMLElement[] {
    const t = (inscriptions as any)[id]; const info = INSCRIPTION_INFO[id] ?? { title: id, where: '' };
    if (!t) return [el('div', '', id)];
    const words = String(t.op_translit).split(/\s+/);
    const inter = el('div', 'tl-inter');
    let covered = 0;
    for (const w of words) { const g = GLOSS.get(w); if (g) covered++; const cell = el('span', 'tl-w'); cell.append(el('span', 'tl-wo', w), el('span', 'tl-wg', g ? g.gloss : '·')); inter.append(cell); }
    return [el('div', 'tl-title', info.title), el('div', 'small', `${info.where}. Transliteration: ARIo (Schmitt 2009; CC0).`), inter,
      el('div', 'small', `Word glosses from the project lexicon for ${covered} of ${words.length} words (each sourced in research/LEXICON/old_persian.json); “·” = not in the lexicon. A published English translation is not available in this build (NEEDS_FROM_ME #14).`)];
  }

  private drawMap(ctx: TranslationContext) {
    const c = this.mapCanvas.getContext('2d'); if (!c) return;
    const W = this.mapCanvas.width, H = this.mapCanvas.height, x0 = -80, x1 = 280, y0 = -260, y1 = 250;
    const sc = Math.min(W / (x1 - x0), H / (y1 - y0)), px = (e: number) => (e - x0) * sc + (W - (x1 - x0) * sc) / 2, py = (n: number) => H - ((n - y0) * sc + (H - (y1 - y0) * sc) / 2);
    c.fillStyle = '#1b1712'; c.fillRect(0, 0, W, H);
    const PRESENT_KEY: Record<string, string> = { museum_modern: '', modern_roof_a1bf0b: '', palace_h: 'palace_h', palace_a3_osm: 'palace_a3', unfinished_gate: 'unfinished_gate', tomb_a2: 'tombs_rahmat' };
    for (const [k, f] of Object.entries(FOOTPRINTS)) {
      if (k.startsWith('_') || !(f as any).polygon) continue;
      const pk = PRESENT_KEY[k] ?? k; if (pk === '' || (k !== 'terrace' && !present(pk))) continue;
      c.beginPath(); (f as any).polygon.forEach(([e, n]: [number, number], i: number) => (i ? c.lineTo(px(e), py(n)) : c.moveTo(px(e), py(n)))); c.closePath();
      c.fillStyle = k === 'terrace' ? '#3a332a' : '#6b5e4a'; c.strokeStyle = '#c9a25e'; c.lineWidth = k === 'terrace' ? 2 : 1; c.fill(); c.stroke();
      if (k !== 'terrace') { const [ce, cn] = (f as any).centroid; c.fillStyle = '#eee3cf'; c.font = '13px Georgia'; c.textAlign = 'center'; c.fillText(k.replace(/_/g, ' '), px(ce), py(cn)); }
    }
    // the visitor: position and facing
    const { e, n, yawDeg } = ctx.player, a = (yawDeg * Math.PI) / 180;
    c.save(); c.translate(px(e), py(n)); c.rotate(a); c.fillStyle = '#ffd27a'; c.beginPath(); c.moveTo(0, -12); c.lineTo(7, 8); c.lineTo(-7, 8); c.closePath(); c.fill(); c.restore();
    // scale bar 50 m
    c.strokeStyle = '#eee3cf'; c.lineWidth = 2; c.beginPath(); c.moveTo(30, H - 30); c.lineTo(30 + 50 * sc, H - 30); c.stroke(); c.fillStyle = '#eee3cf'; c.textAlign = 'left'; c.fillText('50 m', 30, H - 38);
  }
}
