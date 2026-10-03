// Out-of-world shell (English allowed here only — brief §10): the loading screen, the title, the pause menu, settings and
// controls. No in-world HUD. s17 C5 (D-590): one front end at a modern open-world game's standard: the loading screen is
// the real skyline of Kuh-e Rahmat (src/shell/skyline.json, cut from the terrain) whose dawn rises with the measured progress
// (D-393: the steps and the bytes, never a timer); the title and the pause menu are a column of glass over the live world;
// settings are a tabbed sheet. Nothing here names or hints at the place's fate (§1.1).
import { Settings, saveSettings, DEFAULT_KEYS } from '../core/settings';
import { YEAR_DAYS } from '../core/clock';
import skyline from '../shell/skyline.json';
import { introPreference, setIntroPreference, type IntroPreference } from '../shell/intro';
import { scorePreference, setScorePreference, scoreVolume, setScoreVolume, startScore, type ScorePreference } from '../audio/score';

export interface ShellHooks {
  start(): void; resume(): void; save(): boolean; load(): boolean; applySettings(s: Settings): void;
  /** a saved visit exists; forget it and begin afresh (the autosave keeps the visit otherwise: audit D M9) */
  hasSave(): boolean; newVisit(): void;
  getTime(): { day: number; hour: number; label: string }; setTime(day: number, hour: number): void;
  getWeather(): string; setWeather(w: string): void;
  /** the world's seed, and beginning a new world with a fresh one (D-236) */
  seed(): number; newWorld(): void;
  /** s17 C5 (D-590): the wordless opening (src/shell/intro.ts), played as a new visit begins; absent: none */
  intro?(): void;
  /** the title's drifting camera over the live world (D-590): on while the title shows; absent: the player's own view */
  backdrop?(on: boolean): void;
}

const root = () => document.getElementById('shell')!;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, any> = {}, ...kids: (Node | string)[]) {
  const e = document.createElement(tag); Object.assign(e, attrs); for (const k of kids) e.append(k); return e;
}
const TEST = () => new URLSearchParams(location.search).has('test');

/** the name of the place in its own script: Old Persian 𐎱𐎠𐎼𐎿 p-a-r-s (Pārsa; DB I 5 and passim, Kent 1953), the title's mark */
const OP_PARSA = '\u{103B1}\u{103A0}\u{103BC}\u{103BF}';
const DEDICATION = 'Persepolis, in the nineteenth year of Xerxes · 467 BCE';

/** a key code as a person reads it */
export function keyName(code: string): string {
  if (!code) return '—';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  const named: Record<string, string> = { ShiftLeft: 'Left Shift', ShiftRight: 'Right Shift', ControlLeft: 'Left Ctrl', ControlRight: 'Right Ctrl', AltLeft: 'Left Alt', AltRight: 'Right Alt',
    Escape: 'Esc', Space: 'Space', Enter: 'Enter', Tab: 'Tab', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Backquote: '`', Minus: '-', Equal: '=', Slash: '/', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', BracketLeft: '[', BracketRight: ']', CapsLock: 'Caps Lock' };
  return named[code] ?? code.replace(/^Numpad/, 'Num ');
}
/** what each action is, for the controls and the keys tab */
const ACTION_NAMES: Record<string, string> = {
  forward: 'Walk forward', back: 'Walk back', left: 'Step left', right: 'Step right', run: 'Walk faster (hold)', slow: 'Walk carefully (hold)', crouch: 'Crouch (toggle)', interact: 'Open a door · speak to someone',
  pause: 'Menu', overlay: 'Notes on the reconstruction', map: 'Map', mapZoom: 'Map scale',
  chronicle: 'Chronicle', nowView: 'The ruins today',
};

/** the loading screen's backdrop: the dawn over the real skyline (layers far to near), as SVG markup */
function skylineSvg(): string {
  const W = 1600, H = 900, H0 = 640, S = 2.0 * (W / skyline.view.hfov); // px per degree, the relief doubled (an artistic liberty: the backdrop is a picture, not a measurement)
  const cols = skyline.layers[0].length;
  const path = (l: number[]) => `M0,${H} ` + l.map((a, i) => `L${((i + 0.5) * W / cols).toFixed(1)},${(H0 - Math.max(-0.5, a) * S).toFixed(1)}`).join(' ') + ` L${W},${H} Z`;
  // the sun rises behind Rahmat at about grid 94 deg on 17 April: its glow sits there across the view
  const sunX = ((94 - (skyline.view.az - skyline.view.hfov / 2)) / skyline.view.hfov) * W;
  // a far-to-near ramp: the farthest ridge palest (the air between), the nearest darkest; the dawn warms them as it rises
  const fills = ['#8e88a6', '#5d5872', '#332d3f', '#16121a'], warm = ['#c99a86', '#8a6668', '#4a3640', '#1d151a'];
  let rnd = 7; const r = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  const stars = Array.from({ length: 140 }, () => `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * H0 * 0.8).toFixed(0)}" r="${(0.4 + r() * 1.1).toFixed(2)}" opacity="${(0.25 + r() * 0.7).toFixed(2)}"/>`).join('');
  // the Terrace and its roofed halls as one dark mass at Rahmat's foot, the parapet's edge catching the first light as the dawn comes
  const terraceSvg = () => { const t = (skyline as any).terrace as number[] | undefined; if (!t) return '';
    const pts = t.map((a, i) => [((i + 0.5) * W) / cols, a > -1 ? H0 - a * S : H0 + 2] as const);
    const d = `M0,${H0 + 2} ` + pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(' ') + ` L${W},${H0 + 2} Z`;
    const edge = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    return `<path d="${d}" fill="#221c26"/><path d="${d}" fill="#3a2a2c" style="opacity: calc(var(--dawn, 0) * .6)"/><path d="${edge}" fill="none" stroke="#f2c793" stroke-width="1" style="opacity: calc(var(--dawn, 0) * .5)"/>`; };
  const layers = [...skyline.layers].reverse(); // far first
  // each ridge fades into the haze lying at its foot (aerial perspective: the valley air between the ridges), more for the far ones
  const hazeIds = layers.map((_, k) => `hz${k}`);
  const hazeDefs = layers.map((_, k) => { const i = layers.length - 1 - k; return `<linearGradient id="${hazeIds[k]}" gradientUnits="userSpaceOnUse" x1="0" y1="${H0 - 230}" x2="0" y2="${H0 + 4}"><stop offset="0" stop-color="#7d7394" stop-opacity="0"/><stop offset="1" stop-color="#7d7394" stop-opacity="${(0.12 + 0.16 * i).toFixed(2)}"/></linearGradient><linearGradient id="${hazeIds[k]}w" gradientUnits="userSpaceOnUse" x1="0" y1="${H0 - 230}" x2="0" y2="${H0 + 4}"><stop offset="0" stop-color="#f0b98c" stop-opacity="0"/><stop offset="1" stop-color="#f0b98c" stop-opacity="${(0.1 + 0.18 * i).toFixed(2)}"/></linearGradient>`; }).join('');
  return `<svg class="sky" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
  <defs>
    <linearGradient id="night" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05060d"/><stop offset=".55" stop-color="#121426"/><stop offset=".72" stop-color="#2a2238"/><stop offset="1" stop-color="#3b2a33"/></linearGradient>
    <linearGradient id="dawn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1b2240"/><stop offset=".45" stop-color="#4a4a72"/><stop offset=".64" stop-color="#b98a8a"/><stop offset=".72" stop-color="#eab486"/><stop offset="1" stop-color="#f6d6a4"/></linearGradient>
    <radialGradient id="glow" cx="${(sunX / W).toFixed(3)}" cy="${(H0 / H).toFixed(3)}" r=".55" fx="${(sunX / W).toFixed(3)}" fy="${(H0 / H).toFixed(3)}"><stop offset="0" stop-color="#ffe1a8" stop-opacity=".95"/><stop offset=".18" stop-color="#f3b073" stop-opacity=".55"/><stop offset=".55" stop-color="#b8707a" stop-opacity=".12"/><stop offset="1" stop-color="#b8707a" stop-opacity="0"/></radialGradient>
    <linearGradient id="ground" gradientUnits="userSpaceOnUse" x1="0" y1="${H0}" x2="0" y2="${H}"><stop offset="0" stop-color="#2b2433"/><stop offset=".25" stop-color="#17131b"/><stop offset="1" stop-color="#0a0809"/></linearGradient>
    <linearGradient id="groundw" gradientUnits="userSpaceOnUse" x1="0" y1="${H0}" x2="0" y2="${H}"><stop offset="0" stop-color="#8a5f55"/><stop offset=".3" stop-color="#2a1d1d" stop-opacity=".6"/><stop offset="1" stop-color="#0a0809" stop-opacity="0"/></linearGradient>
    ${hazeDefs}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#night)"/>
  <rect width="${W}" height="${H}" fill="url(#dawn)" style="opacity: calc(var(--dawn, 0) * .92)"/>
  <g fill="#fff" style="opacity: calc(1 - var(--dawn, 0) * 1.3)">${stars}</g>
  <rect width="${W}" height="${H}" fill="url(#glow)" style="opacity: calc(.15 + var(--dawn, 0) * .85)"/>
  ${layers.map((l, k) => { const i = layers.length - 1 - k, d = path(l); // band index, 0 nearest
    const terr = i === 1 ? terraceSvg() : ''; // the Terrace stands at the foot of Rahmat, in front of band 1
    return `<path d="${d}" fill="${fills[3 - i]}"/><path d="${d}" fill="${warm[3 - i]}" style="opacity: calc(var(--dawn, 0) * ${(0.55 - i * 0.12).toFixed(2)})"/><path d="${d}" fill="url(#${hazeIds[k]})"/><path d="${d}" fill="url(#${hazeIds[k]}w)" style="opacity: var(--dawn, 0)"/>${terr}`; }).join('\n  ')}
  <rect y="${H0}" width="${W}" height="${H - H0}" fill="url(#ground)"/>
  <rect y="${H0}" width="${W}" height="${H - H0}" fill="url(#groundw)" style="opacity: calc(var(--dawn, 0) * .7)"/>
</svg>`;
}

/** the clock's label (clock.ts) as two lines: the Babylonian day and the regnal year; the Julian date and the hour */
export function whenLines(label: string): string[] {
  const [bab, jul, time] = label.split(' · ');
  if (!jul || !time) return [label];
  return [bab.replace('Xerxes yr', 'Xerxes, year'), `${jul.replace(' (Julian)', '')} · ${time.replace(' local mean time', '')}`];
}

export class Shell {
  mode: 'loading' | 'title' | 'playing' | 'paused' = 'loading';
  constructor(private settings: Settings, private hooks: ShellHooks) {
    (globalThis as any).__shell = this; // (the first-minutes driver, tools/dev/first_minutes.mjs: the pause a headless page cannot reach by Esc)
    // Esc in a sub-screen (settings, controls) goes back a step; the pointer lock's own Esc still pauses the walk
    addEventListener('keydown', e => { if (e.key === 'Escape' && this.back && (this.mode === 'paused' || this.mode === 'title')) { const b = this.back; this.back = null; b(); e.preventDefault(); } });
  }
  private back: (() => void) | null = null;
  /** the loading card (s15/ship D-393: kept across the boot's messages, so the progress bar mounted in it stays) */
  loadingCard: HTMLElement | null = null; private loadingMsg: HTMLElement | null = null;
  loading(msg: string) {
    if (this.mode === 'loading' && this.loadingCard?.isConnected && this.loadingMsg) { this.loadingMsg.textContent = msg; return; }
    this.mode = 'loading';
    const screen = el('div', { className: 'load' });
    screen.innerHTML = skylineSvg();
    this.loadingMsg = el('div', { className: 'sub' }, msg);
    this.loadingCard = el('div', { className: 'foot' }, this.loadingMsg);
    screen.append(el('div', { className: 'vignette' }), el('div', { className: 'grain' }),
      el('div', { className: 'brand' }, el('div', { className: 'op-mark' }, OP_PARSA), el('h1', { className: 'wordmark' }, 'PĀRSA'), el('div', { className: 'dedic' }, DEDICATION)),
      el('div', { className: 'advice' }, el('b', {}, 'Before you enter'), 'Sound is half of this place: headphones, if you have them. Nothing in the world will point the way. Walk, listen, and ask the people.'),
      this.loadingCard);
    root().replaceChildren(screen);
  }
  /** `continued`: the saved visit was loaded at start (the world stands as it was left) */
  title(continued = false) {
    this.mode = 'title'; this.back = null;
    this.hooks.backdrop?.(true);
    const begin = () => { this.hooks.backdrop?.(false); this.hooks.start(); const opening = !continued && introPreference() !== 'never';
      if (opening) this.hooks.intro?.(); // (the opening starts the score in the world when it ends: src/shell/intro.ts)
      else if (!TEST()) startScore({ getTime: () => this.hooks.getTime(), active: () => this.mode === 'playing' }); };
    const start = el('button', { className: 'primary', onclick: begin }, continued ? 'Continue the visit' : 'Enter');
    const items: HTMLElement[] = [start,
      ...(continued ? [el('button', { onclick: () => this.hooks.newVisit() }, 'Begin a new visit')]
        : this.hooks.hasSave() ? [el('button', { onclick: () => { if (this.hooks.load()) { this.hooks.backdrop?.(false); this.hooks.start(); if (!TEST()) startScore({ getTime: () => this.hooks.getTime(), active: () => this.mode === 'playing' }); } } }, 'Continue the saved visit')] : []),
      el('button', { onclick: () => this.settingsPanel(() => this.title(continued)) }, 'Settings'),
      el('button', { onclick: () => this.controls(() => this.title(continued)) }, 'Controls')];
    // the loading screen, if it is up, fades out over the title rather than vanishing (the world's first frames come in under it)
    const leaving = root().querySelector('.load') as HTMLElement | null; leaving?.classList.add('leaving'); if (leaving) setTimeout(() => leaving.remove(), 2000);
    root().replaceChildren(el('div', { className: 'front' }, el('div', { className: 'scrim' }),
      el('div', { className: 'col' },
        el('div', { className: 'op-mark' }, OP_PARSA),
        el('h1', { className: 'wordmark' }, 'PĀRSA'),
        el('div', { className: 'dedic' }, DEDICATION),
        el('div', { className: 'menu' }, ...items)),
      el('div', { className: 'foot' }, ...this.hintSpans())), ...(leaving ? [leaving] : []));
    start.focus();
  }
  private hintSpans() {
    const k = this.settings.keys, cap = (c: string) => el('span', { className: 'keycap' }, keyName(c));
    return [
      el('span', {}, cap(k.forward), cap(k.left), cap(k.back), cap(k.right), ' walk'),
      el('span', {}, 'Mouse  look'),
      el('span', {}, cap(k.run), ' walk faster'),
      el('span', {}, cap(k.interact), ' a door, a person'),
      el('span', {}, cap('Escape'), ' menu'),
      el('span', {}, 'Headphones recommended'),
    ];
  }
  // the aiming dot is out-of-world UI: shown only with the translation layer on (whose inscription picks use it), never in
  // ?test captures (brief §1.1, §6: no in-world HUD; session 4)
  playing() { this.mode = 'playing'; this.back = null; const dot = this.settings.translation && !TEST(); root().replaceChildren(...(dot ? [el('div', { className: 'crosshair' })] : [])); }
  /** an out-of-world notice about saving or loading (English; T-H3s, T-H3v: a failed save or an unreadable save is never
   *  silent), shown for 12 s at the foot of the screen; not in ?test captures (the test reads __parsa.notices) */
  notice(text: string) {
    if (TEST()) return;
    const e = el('div', { className: 'save-notice' }, text); document.body.append(e); setTimeout(() => e.remove(), 12_000);
  }
  /** the Now view's caption (out-of-world, English; D-201): what the view is and its tier, while it is on (not in ?test
   *  captures). Its own element, so the menus redrawing the shell leave it alone */
  nowCaption(text: string | null) {
    let e = document.getElementById('now-caption');
    const show = !!text && !TEST();
    if (!show) { e?.remove(); return; }
    if (!e) { e = el('div', { id: 'now-caption', className: 'now-caption' }); document.body.append(e); }
    e.textContent = text;
  }
  pause() {
    this.mode = 'paused'; this.back = null;
    const t = this.hooks.getTime();
    const resume = el('button', { className: 'primary', onclick: () => this.hooks.resume() }, 'Resume');
    root().replaceChildren(el('div', { className: 'front paused' }, el('div', { className: 'scrim' }),
      el('div', { className: 'col' },
        el('div', { className: 'kicker' }, 'Paused'),
        el('h1', { className: 'screen' }, 'PĀRSA'),
        ...whenLines(t.label).map(l => el('div', { className: 'when' }, l)),
        el('div', { className: 'menu' }, resume,
          el('button', { onclick: () => this.settingsPanel(() => this.pause()) }, 'Settings'),
          el('button', { onclick: () => this.controls(() => this.pause()) }, 'Controls'),
          el('button', { onclick: (e: MouseEvent) => { const b = e.currentTarget as HTMLButtonElement; b.textContent = this.hooks.save() ? 'Saved' : 'Save failed (storage unavailable)'; } }, 'Save the visit'),
          el('button', { onclick: () => { if (this.hooks.load()) this.hooks.resume(); } }, 'Load the saved visit'))),
      el('div', { className: 'foot' }, ...this.hintSpans())));
    resume.focus();
  }
  controls(back: () => void = () => this.pause()) {
    const k = this.settings.keys;
    const rows = Object.keys(DEFAULT_KEYS).map(a => el('div', { className: 'row' }, el('label', {}, ACTION_NAMES[a] ?? a), el('div', { className: 'ctl' }, el('span', { className: 'keycap' }, keyName(k[a] ?? DEFAULT_KEYS[a])))));
    rows.splice(4, 0, el('div', { className: 'row' }, el('label', {}, 'Look'), el('div', { className: 'ctl' }, el('span', { className: 'keycap' }, 'Mouse'))));
    this.sheet('Controls', null, el('div', { className: 'grid' }, ...rows,
      el('p', { className: 'small' }, 'Nothing in the world points the way: find it by the mountain, the sun and the sound of the town. If you want them, a map and a chronicle come with the translation layer (Settings › Language). Any key can be changed in Settings › Keys.')), back);
  }
  /** a full sheet: header (title, tabs), body, footer (back) */
  private sheet(title: string, tabs: { name: string; body: () => HTMLElement }[] | null, body: HTMLElement | null, back: () => void, tab = 0) {
    this.back = back;
    const host = el('div', { className: 'body' });
    const head = el('header', {}, el('h1', {}, title));
    if (tabs) {
      const bar = el('div', { className: 'tabs', role: 'tablist' });
      const show = (i: number) => { [...bar.children].forEach((b, j) => b.setAttribute('aria-selected', String(i === j))); host.replaceChildren(tabs[i].body()); host.scrollTop = 0; this.lastTab = i; };
      tabs.forEach((t, i) => bar.append(el('button', { role: 'tab', onclick: () => show(i) }, t.name)));
      head.append(bar); show(Math.min(tab, tabs.length - 1));
    } else if (body) host.append(body);
    const backBtn = el('button', { onclick: () => { this.back = null; back(); } }, 'Back');
    root().replaceChildren(el('div', { className: 'sheet' }, head, host, el('footer', {}, backBtn, el('span', {}, el('span', { className: 'keycap' }, 'Esc'), ' back'))));
    backBtn.focus({ preventScroll: true } as any);
  }
  private lastTab = 0;
  settingsPanel(back: () => void) {
    const s = this.settings, apply = () => { saveSettings(s); this.hooks.applySettings(s); };
    const label = (text: string, why?: string) => el('label', {}, text, ...(why ? [el('span', { className: 'why' }, why)] : []));
    const sel = (text: string, value: string, opts: [string, string][], on: (v: string) => void, why?: string) => {
      const e = el('select', { onchange: () => { on(e.value); apply(); } }); for (const [v, t] of opts) e.append(el('option', { value: v, textContent: t, selected: v === value }));
      return el('div', { className: 'row' }, label(text, why), el('div', { className: 'ctl' }, e));
    };
    const range = (text: string, value: number, min: number, max: number, step: number, on: (v: number) => void, fmt?: (v: number) => string, why?: string) => {
      const out = el('span', { className: 'val' }, fmt ? fmt(value) : String(value));
      const fill = (e: HTMLInputElement) => e.style.setProperty('--p', `${((+e.value - min) / (max - min)) * 100}%`);
      const e = el('input', { type: 'range', min, max, step, value, oninput: () => { on(+e.value); out.textContent = fmt ? fmt(+e.value) : e.value; fill(e); apply(); } }); fill(e);
      return el('div', { className: 'row' }, label(text, why), el('div', { className: 'ctl' }, e, out));
    };
    const check = (text: string, value: boolean, on: (v: boolean) => void, why?: string) => {
      const e = el('input', { type: 'checkbox', checked: value, onchange: () => { on(e.checked); apply(); } });
      return el('div', { className: 'row' }, label(text, why), el('div', { className: 'ctl' }, e));
    };
    const grid = (...kids: HTMLElement[]) => el('div', { className: 'grid' }, ...kids);
    const pct = (v: number) => `${Math.round(v * 100)}`;
    const world = () => { const t = this.hooks.getTime(); return grid(
      el('div', { className: 'row' }, label(`World seed ${this.hooks.seed()}`, 'Every new world is drawn afresh: its people, their lives and its weather. The seed reproduces it.'),
        el('div', { className: 'ctl' }, el('button', { onclick: () => { if (confirm('Begin a new world? The saved visit of this world is discarded.')) this.hooks.newWorld(); } }, 'New world'))),
      range('Day of the year', t.day, 0, YEAR_DAYS - 1, 1, v => this.hooks.setTime(v, this.hooks.getTime().hour), v => `day ${v + 1}`, 'The nineteenth regnal year of Xerxes, from 17 April 467 BCE.'),
      range('Hour', +t.hour.toFixed(2), 0, 23.99, 0.25, v => this.hooks.setTime(this.hooks.getTime().day, v), v => `${Math.floor(v)}:${String(Math.round((v % 1) * 60)).padStart(2, '0')}`, 'Local mean time.'),
      sel('Time scale', String(s.timeScale), [['0', 'Stopped'], ['1', 'Real time'], ['10', '× 10'], ['60', '× 60'], ['600', '× 600']], v => { s.timeScale = +v; }),
      sel('Weather', this.hooks.getWeather(), [['auto', 'From the climate (seeded)'], ['clear', 'Clear'], ['overcast', 'Overcast'], ['rain', 'Rain'], ['storm', 'Thunderstorm'], ['snow', 'Snow'], ['dust', 'Dust storm'], ['mist', 'Morning mist']], v => this.hooks.setWeather(v)),
      sel('Who you are', s.playerMode, [['observer', 'An observer'], ['visitor', 'A visitor with a sealed travel authorisation']], v => { s.playerMode = v as any; }),
      sel('The court', s.courtCalendar, [['seasonal', 'Comes and goes: in residence in spring (reconstructed)'], ['evidence', 'Evidence only: the king absent all year']], v => { s.courtCalendar = v as any; }),
      sel('The opening', introPreference(), [['new', 'Play it when a new visit begins'], ['never', 'Never play it']], v => setIntroPreference(v as IntroPreference), 'The title film and the opening that lead you to the foot of the Terrace. Any key skips them.'),
      check('Now view', s.nowView, v => { s.nowView = v; }, 'The ruin as it stands today, from memory of the site (tier C). Key N.'),
    ); };
    const display = () => grid(
      sel('Quality', s.quality, [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra']], v => { s.quality = v as any; }),
      check('Force WebGL2', s.forceWebGL, v => { s.forceWebGL = v; }, 'For browsers where WebGPU fails. Takes effect when the page reloads.'),
      range('Field of view', s.fov, 50, 100, 1, v => { s.fov = v; }, v => `${v}°`),
      check('Head bob', s.headBob, v => { s.headBob = v; }),
      range('Mouse sensitivity', s.mouseSensitivity, 0.2, 3, 0.05, v => { s.mouseSensitivity = v; }, v => v.toFixed(2)),
      check('Invert mouse Y', s.invertY, v => { s.invertY = v; }),
      check('Reduce lightning flashes', s.lightningWarning, v => { s.lightningWarning = v; }),
      check('Colour-blind-safe interface colours', s.colourBlindUI, v => { s.colourBlindUI = v; document.body.classList.toggle('cb', v); }),
    );
    const sound = () => grid(
      ...(['master', 'ambience', 'voices', 'music', 'effects'] as const).map(ch => range(({ master: 'Master', ambience: 'Ambience', voices: 'Voices', music: 'Music in the world', effects: 'Effects' })[ch], s.volume[ch], 0, 1, 0.01, v => { s.volume[ch] = v; }, pct,
        ch === 'music' ? 'What the people of the town and the court play and sing.' : undefined)),
      sel('Score', scorePreference(), [['on', 'On'], ['off', 'Off']], v => setScorePreference(v as ScorePreference), 'The original score: the title theme, and now and then a piece for the hour and the place, with long silences between.'),
      range('Score volume', scoreVolume(), 0, 1, 0.01, v => setScoreVolume(v), pct),
    );
    const language = () => grid(
      check('Translation layer', s.translation, v => { s.translation = v; }, 'Subtitles, the readings of inscriptions, the map (M) and the chronicle (J). Outside the world; off by default.'),
      range('Subtitle size', s.subtitleSize, 0.75, 2, 0.05, v => { s.subtitleSize = v; }, v => `${Math.round(v * 100)} %`),
      check('Talk with the people', s.talk, v => { s.talk = v; }, 'T to type, hold V to speak. Downloads about 1 GB once, after the world appears. Takes effect when the page reloads.'),
      // D-336 (UD-22): out of world; off by default (the heard world stays period)
      sel('Hear the people you speak with in', s.hearIn, [['own', 'Their own language (default)'], ['fa', 'Farsi, in character, in their own voice'], ['en', 'English, in character, in their own voice']], v => { s.hearIn = v as any; }),
    );
    const keys = () => grid(...Object.keys(DEFAULT_KEYS).map(a => {
      const b = el('button', { className: 'key', textContent: keyName(s.keys[a]) });
      b.onclick = () => { b.textContent = 'Press a key…'; b.classList.add('wait');
        const h = (ev: KeyboardEvent) => { ev.preventDefault(); ev.stopImmediatePropagation(); s.keys[a] = ev.code; b.textContent = keyName(ev.code); b.classList.remove('wait'); apply(); removeEventListener('keydown', h, true); };
        addEventListener('keydown', h, true); };
      return el('div', { className: 'row' }, label(ACTION_NAMES[a] ?? a), el('div', { className: 'ctl' }, b));
    }));
    this.sheet('Settings', [{ name: 'World', body: world }, { name: 'Display', body: display }, { name: 'Sound', body: sound }, { name: 'Language', body: language }, { name: 'Keys', body: keys }], null, back, this.lastTab);
  }
}
