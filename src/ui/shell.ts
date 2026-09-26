// Out-of-world shell (English allowed here only — brief §10): title, loading, click-to-start (unlocks audio),
// pause menu, settings, controls help. No in-world HUD.
import { Settings, saveSettings, DEFAULT_KEYS } from '../core/settings';
import { YEAR_DAYS } from '../core/clock';

export interface ShellHooks {
  start(): void; resume(): void; save(): boolean; load(): boolean; applySettings(s: Settings): void;
  getTime(): { day: number; hour: number; label: string }; setTime(day: number, hour: number): void;
  getWeather(): string; setWeather(w: string): void;
  /** the world's seed, and beginning a new world with a fresh one (D-236) */
  seed(): number; newWorld(): void;
}

const root = () => document.getElementById('shell')!;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...kids: (Node | string)[]) {
  const e = document.createElement(tag); Object.assign(e, attrs); for (const k of kids) e.append(k); return e;
}

export class Shell {
  mode: 'loading' | 'title' | 'playing' | 'paused' = 'loading';
  constructor(private settings: Settings, private hooks: ShellHooks) {}
  loading(msg: string) {
    this.mode = 'loading';
    root().replaceChildren(el('div', { className: 'panel' }, el('div', { className: 'card title' }, el('h1', {}, 'PĀRSA'), el('div', { className: 'sub' }, msg))));
  }
  title() {
    this.mode = 'title';
    const start = el('button', { onclick: () => this.hooks.start() }, 'Enter');
    root().replaceChildren(el('div', { className: 'panel' }, el('div', { className: 'card title' },
      el('h1', {}, 'PĀRSA'),
      el('div', { className: 'sub' }, 'Persepolis, the nineteenth year of Xerxes — 467 BCE'),
      el('p', { className: 'small' }, 'Click to begin. Walk with W A S D, look with the mouse, hold Shift to walk faster. Esc opens the menu. Sound is part of this place: use headphones if you can.'),
      start,
      el('button', { onclick: () => { if (this.hooks.load()) this.hooks.start(); } }, 'Continue saved visit'),
      el('button', { onclick: () => this.settingsPanel(() => this.title()) }, 'Settings'),
    )));
    start.focus();
  }
  // the aiming dot is out-of-world UI: shown only with the translation layer on (whose inscription picks use it), never in
  // ?test captures (brief §1.1, §6: no in-world HUD; session 4)
  playing() { this.mode = 'playing'; const dot = this.settings.translation && !new URLSearchParams(location.search).has('test'); root().replaceChildren(...(dot ? [el('div', { className: 'crosshair' })] : [])); }
  /** the Now view's caption (out-of-world, English; D-201): what the view is and its tier, while it is on (not in ?test
   *  captures). Its own element, so the menus redrawing the shell leave it alone */
  nowCaption(text: string | null) {
    let e = document.getElementById('now-caption');
    const show = !!text && !new URLSearchParams(location.search).has('test');
    if (!show) { e?.remove(); return; }
    if (!e) { e = el('div', { id: 'now-caption', className: 'now-caption' }); document.body.append(e); }
    e.textContent = text;
  }
  pause() {
    this.mode = 'paused';
    const t = this.hooks.getTime();
    root().replaceChildren(el('div', { className: 'panel' }, el('div', { className: 'card' },
      el('h2', {}, 'Paused'),
      el('p', { className: 'small' }, t.label),
      el('button', { onclick: () => this.hooks.resume() }, 'Resume'),
      el('button', { onclick: () => this.settingsPanel(() => this.pause()) }, 'Settings'),
      el('button', { onclick: () => this.controls() }, 'Controls'),
      el('button', { onclick: (e: MouseEvent) => { (e.target as HTMLButtonElement).textContent = this.hooks.save() ? 'Saved' : 'Save failed (storage unavailable)'; } }, 'Save'),
      el('button', { onclick: () => { if (this.hooks.load()) this.hooks.resume(); } }, 'Load'),
    )));
  }
  controls() {
    const k = this.settings.keys;
    root().replaceChildren(el('div', { className: 'panel' }, el('div', { className: 'card' },
      el('h2', {}, 'Controls'),
      ...Object.entries(k).map(([a, code]) => el('div', { className: 'row' }, el('label', {}, a), el('span', {}, code))),
      el('p', { className: 'small' }, 'Mouse: look. There is no map or compass in the world; find your way by the mountain, the sun and sound. Change keys in Settings.'),
      el('button', { onclick: () => this.pause() }, 'Back'))));
  }
  settingsPanel(back: () => void) {
    const s = this.settings, apply = () => { saveSettings(s); this.hooks.applySettings(s); };
    const sel = (label: string, value: string, opts: [string, string][], on: (v: string) => void) => {
      const e = el('select', { onchange: () => { on(e.value); apply(); } }); for (const [v, t] of opts) e.append(el('option', { value: v, textContent: t, selected: v === value }));
      return el('div', { className: 'row' }, el('label', {}, label), e);
    };
    const range = (label: string, value: number, min: number, max: number, step: number, on: (v: number) => void, fmt?: (v: number) => string) => {
      const out = el('span', { className: 'small' }, fmt ? fmt(value) : String(value));
      const e = el('input', { type: 'range', min, max, step, value, oninput: () => { on(+e.value); out.textContent = fmt ? fmt(+e.value) : e.value; apply(); } });
      return el('div', { className: 'row' }, el('label', {}, label), el('div', {}, e, out));
    };
    const check = (label: string, value: boolean, on: (v: boolean) => void) => {
      const e = el('input', { type: 'checkbox', checked: value, onchange: () => { on(e.checked); apply(); } });
      return el('div', { className: 'row' }, el('label', {}, label), e);
    };
    const t = this.hooks.getTime();
    const keyRows = Object.keys(DEFAULT_KEYS).map(a => {
      const b = el('button', { textContent: s.keys[a] });
      b.onclick = () => { b.textContent = 'press a key…'; const h = (ev: KeyboardEvent) => { ev.preventDefault(); s.keys[a] = ev.code; b.textContent = ev.code; apply(); removeEventListener('keydown', h, true); }; addEventListener('keydown', h, true); };
      return el('div', { className: 'row' }, el('label', {}, a), b);
    });
    root().replaceChildren(el('div', { className: 'panel' }, el('div', { className: 'card' },
      el('h2', {}, 'World'),
      el('div', { className: 'row' }, el('label', {}, `World seed ${this.hooks.seed()} (every new world is drawn afresh; the seed reproduces it)`),
        el('button', { onclick: () => { if (confirm('Begin a new world? The saved game of this world is discarded.')) this.hooks.newWorld(); } }, 'New world')),
      range('Day of year (Xerxes yr 19)', t.day, 0, YEAR_DAYS - 1, 1, v => this.hooks.setTime(v, this.hooks.getTime().hour), v => `day ${v + 1}`),
      range('Hour (local mean time)', +t.hour.toFixed(2), 0, 23.99, 0.25, v => this.hooks.setTime(this.hooks.getTime().day, v), v => `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, '0')}`),
      sel('Time scale', String(s.timeScale), [['0', 'stopped'], ['1', 'real time'], ['10', '×10'], ['60', '×60'], ['600', '×600']], v => { s.timeScale = +v; }),
      sel('Weather', this.hooks.getWeather(), [['auto', 'from climate (seeded)'], ['clear', 'clear'], ['overcast', 'overcast'], ['rain', 'rain'], ['storm', 'thunderstorm'], ['snow', 'snow'], ['dust', 'dust storm'], ['mist', 'morning mist']], v => this.hooks.setWeather(v)),
      sel('Player mode', s.playerMode, [['observer', 'Observer'], ['visitor', 'Visitor (sealed travel authorisation)']], v => { s.playerMode = v as any; }),
      sel('Court calendar', s.courtCalendar, [['seasonal', 'The court comes and goes: in residence in spring (reconstructed, C; default)'], ['evidence', 'Evidence-strict: the king absent all year']], v => { s.courtCalendar = v as any; }),
      check('Translation layer (subtitles, inscriptions, map, chronicle)', s.translation, v => { s.translation = v; }),
      check('Now view: the ruin as it stands today (from memory of the site, tier C; key N)', s.nowView, v => { s.nowView = v; }),
      el('h2', {}, 'Display'),
      sel('Quality', s.quality, [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra (full target)']], v => { s.quality = v as any; }),
      check('Force WebGL2 (reload)', s.forceWebGL, v => { s.forceWebGL = v; }),
      range('Field of view', s.fov, 50, 100, 1, v => { s.fov = v; }, v => `${v}°`),
      check('Head bob', s.headBob, v => { s.headBob = v; }),
      range('Mouse sensitivity', s.mouseSensitivity, 0.2, 3, 0.05, v => { s.mouseSensitivity = v; }),
      check('Invert mouse Y', s.invertY, v => { s.invertY = v; }),
      check('Lightning-flash warning / reduce flashes', s.lightningWarning, v => { s.lightningWarning = v; }),
      check('Colour-blind-safe UI colours', s.colourBlindUI, v => { s.colourBlindUI = v; document.body.classList.toggle('cb', v); }),
      range('Subtitle size', s.subtitleSize, 0.75, 2, 0.05, v => { s.subtitleSize = v; }),
      el('h2', {}, 'Sound'),
      ...(['master', 'ambience', 'voices', 'music', 'effects'] as const).map(ch => range(`Volume: ${ch}`, s.volume[ch], 0, 1, 0.01, v => { s.volume[ch] = v; })),
      el('h2', {}, 'Keys'), ...keyRows,
      el('button', { onclick: back }, 'Back'))));
  }
}
