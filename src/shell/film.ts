// The title film (D-761; UD-38, UD-39): the opening's pre-rendered title sequence with the main theme (tools/film, the
// score's tools/score), shown as the page opens and while the world loads underneath it: it covers the load and never delays
// it (the world builds behind it; when the film ends or is skipped, whatever the loading screen or the title shows is there).
// Out of world: letterboxed on black, one English line ("Any key to begin" / "Any key skips"), skippable at any moment.
// The browser lets sound start only after a gesture: the film waits on its first frame for one (a key, a click, a touch),
// then plays with its score. Files: public/film/parsa_title.webm (AV1 + Opus), .mp4 (H.264 + AAC), the poster .jpg;
// streamed (preload metadata until the gesture), nothing else of the score loads before the walk.

import { scoreLevel } from '../audio/score';

const BASE = `${(import.meta as any).env?.BASE_URL ?? '/'}film/`;
export interface FilmOptions { onEnd?: () => void; /** start without waiting for a gesture (muted autoplay is refused by many browsers with sound) */ eager?: boolean }

export class TitleFilm {
  readonly el: HTMLDivElement; private video: HTMLVideoElement; private hint: HTMLDivElement; private done = false; private started = false; private began = 0;
  constructor(private o: FilmOptions = {}) {
    const el = document.createElement('div'); el.className = 'film'; this.el = el;
    const v = document.createElement('video'); v.className = 'film-video'; v.playsInline = true; v.preload = 'metadata'; v.poster = `${BASE}parsa_title.jpg`;
    v.setAttribute('playsinline', ''); v.disablePictureInPicture = true; v.controls = false;
    for (const [src, type] of [[`${BASE}parsa_title.webm`, 'video/webm; codecs="av01.0.05M.08, opus"'], [`${BASE}parsa_title.mp4`, 'video/mp4; codecs="avc1.640028, mp4a.40.2"']]) {
      if (v.canPlayType(type) === '') continue; const s = document.createElement('source'); s.src = src; s.type = type.split(';')[0]; v.append(s); }
    this.video = v;
    const hint = document.createElement('div'); hint.className = 'film-hint'; hint.textContent = 'Any key to begin · Esc to skip'; this.hint = hint;
    el.append(v, hint); document.body.append(el);
    requestAnimationFrame(() => el.classList.add('on'));
    v.addEventListener('ended', () => this.end());
    v.addEventListener('error', () => this.end(), true);
    addEventListener('keydown', this.onKey, true); addEventListener('pointerdown', this.onKey, true); addEventListener('touchstart', this.onKey, true);
    if (o.eager) void this.start();
    (globalThis as any).__film = this;
  }
  private onKey = (e: Event) => {
    if (this.done) return;
    e.stopPropagation(); if (e.type === 'keydown') e.preventDefault();
    if ((e as KeyboardEvent).key === 'Escape') { this.end(); return; } // Esc: no film
    if (!this.started) { void this.start(); return; }
    if (performance.now() - this.began > 1200) this.end(); // a second key skips (the first second ignored: the key that began it)
  };
  async start() {
    if (this.started || this.done) return; this.started = true; this.began = performance.now();
    this.video.preload = 'auto'; this.hint.textContent = 'Any key skips'; this.hint.classList.add('fade');
    this.video.volume = scoreLevel(); this.video.muted = scoreLevel() === 0;
    try { await this.video.play(); } catch { this.end(); }
  }
  /** fade the sound and the picture out, then hand back to whatever is under the film */
  end() {
    if (this.done) return; this.done = true;
    removeEventListener('keydown', this.onKey, true); removeEventListener('pointerdown', this.onKey, true); removeEventListener('touchstart', this.onKey, true);
    const v = this.video, v0 = v.volume, t0 = performance.now();
    const fade = () => { const u = Math.min(1, (performance.now() - t0) / 900); v.volume = v0 * (1 - u); if (u < 1) requestAnimationFrame(fade); else { v.pause(); } };
    fade(); this.el.classList.remove('on'); this.el.classList.add('out');
    setTimeout(() => { this.el.remove(); v.removeAttribute('src'); for (const s of [...v.querySelectorAll('source')]) s.remove(); try { v.load(); } catch { /* */ } }, 1300);
    this.o.onEnd?.();
  }
  get playing() { return this.started && !this.done; }
}

let film: TitleFilm | null = null;
/** show the title film over the loading screen (once a page; never when the player chose no opening, nor on a save-data
 *  connection). Call as the page opens. */
export function mountTitleFilm(o: FilmOptions = {}): TitleFilm | null {
  let never = false; try { never = localStorage.getItem('parsa.intro.v1') === 'never'; } catch { /* storage unavailable */ }
  if (film || never) return null;
  if ((navigator as any).connection?.saveData) return null;
  film = new TitleFilm(o); return film;
}
export const titleFilm = () => film;

/** the film's look (injected once; the shell's sheet owns the rest of the out-of-world styles) */
const css = `.film{position:fixed;inset:0;z-index:9000;background:#000;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .8s ease}
.film.on{opacity:1}.film.out{opacity:0;transition:opacity 1.2s ease;pointer-events:none}
.film-video{width:100%;max-height:100%;aspect-ratio:2.39/1;object-fit:contain;background:#000}
.film-hint{position:absolute;bottom:5.5vh;left:0;right:0;text-align:center;font:400 13px/1 'Alegreya Sans',system-ui,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:rgba(232,220,196,.72);transition:opacity 2s ease 3s}
.film-hint.fade{opacity:0}`;
if (typeof document !== 'undefined' && !document.getElementById('film-css')) { const s = document.createElement('style'); s.id = 'film-css'; s.textContent = css; document.head.append(s); }

// the film mounts itself as the page opens (this module is loaded with the opening, src/shell/intro.ts); test worlds, ?nointro
// and ?nofilm go without it
if (typeof location !== 'undefined' && typeof document !== 'undefined') {
  const q = new URLSearchParams(location.search);
  if (!q.has('test') && !q.has('nointro') && !q.has('nofilm')) { if (document.body) mountTitleFilm(); else addEventListener('DOMContentLoaded', () => mountTitleFilm(), { once: true }); }
}
