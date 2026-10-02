// s15/ship (D-393): the loading screen's honest progress (out of world, English). Two measured quantities, never a timer:
// the bytes the page has received (Resource Timing: every finished fetch's body size, the service worker's cache hits
// included as "from this browser"), and the boot's steps (main.ts and world.ts name each step as it begins). The bar is the
// share of the steps done, weighted by each step's measured cost on a cold first visit (bench-reports/load_s15_ship.md).
// A step's key is the mark that ENDS it (world.ts's wmark names a stage when it is done); a mark not in the table is inside
// the current step. Nothing is estimated from the clock.
export interface BootStep { key: string; label: string; w: number }
/** the boot's steps in order, their weights from the cold-visit trace (seconds at 100 Mbit/s on the T4 box, D-393) */
export const STEPS: BootStep[] = [
  { key: 'renderer', label: 'Preparing the renderer', w: 2 },
  { key: 'ground', label: 'Fetching the plain, the mountain and the surfaces', w: 20 },
  { key: 'sky', label: 'Setting the sky', w: 2 },
  { key: 'world:{ parts, manifest, doorways }', label: 'Laying out the Terrace', w: 2 },
  { key: 'world:sculpt', label: 'Fetching the carved pieces', w: 3 },
  { key: 'world:assets awaited', label: "Fetching the Terrace's models", w: 10 },
  { key: 'world:arch', label: 'Raising the Terrace', w: 30 },
  { key: 'world:reliefs', label: 'Carving the reliefs', w: 4 },
  { key: 'world:palace', label: 'Furnishing the palaces', w: 4 },
  { key: 'world:late assets awaited', label: "Fetching the town's and the plain's models", w: 2 },
  { key: 'world:settlement', label: 'Building the town', w: 12 },
  { key: 'world:plain', label: 'Laying out the plain and its villages', w: 10 },
  { key: 'world:nav', label: 'Mapping the paths', w: 2 },
  { key: 'world:sim', label: 'Waking the people', w: 3 },
  { key: 'world:crowd', label: 'Dressing the people', w: 3 },
  { key: 'world:view', label: 'Placing the people', w: 16 },
  { key: 'world:fauna', label: 'Bringing in the animals', w: 3 },
  { key: 'world:crowd.imp', label: 'The far crowds', w: 2 },
  { key: 'world:occl', label: 'Final touches', w: 4 },
  { key: 'ready', label: 'Ready', w: 0 }, // (the last: shown once all are done)
];

export class BootProgress {
  private at = 0; private done = 0; private bytes = 0; private cached = 0; private t0 = performance.now(); private obs: PerformanceObserver | null = null;
  private el: { bar: HTMLElement; step: HTMLElement; net: HTMLElement } | null = null;
  private total = STEPS.reduce((a, s) => a + s.w, 0);
  constructor() {
    try { this.obs = new PerformanceObserver(l => { for (const e of l.getEntries() as PerformanceResourceTiming[]) { const b = e.encodedBodySize || e.transferSize || 0; this.bytes += b; if (!e.transferSize && e.encodedBodySize) this.cached += b; } this.paint(); });
      this.obs.observe({ type: 'resource', buffered: true }); } catch { /* no Resource Timing: the steps alone */ }
    (globalThis as any).__bootStage = (k: string) => this.step(k);
  }
  /** the boot finished step `key` (and every step before it) */
  step(key: string) {
    const i = STEPS.findIndex(s => s.key === key);
    if (i < 0) return; // (a mark that is not the end of a step: inside the current one)
    if (i >= this.at) { for (let j = this.at; j <= i; j++) this.done += STEPS[j].w; this.at = Math.min(i + 1, STEPS.length - 1); }
    this.paint();
  }
  /** the share done, 0..1 */
  get frac() { return Math.min(1, this.done / this.total); }
  get mb() { return this.bytes / 1048576; }
  /** mount the bar under the loading card's subtitle (the card is the shell's) */
  mount(card: HTMLElement) {
    const d = (c: string) => { const e = document.createElement('div'); e.className = c; return e; };
    const wrap = d('boot-progress'), track = d('boot-track'), bar = d('boot-bar'), step = d('boot-step'), net = d('boot-net');
    track.append(bar); wrap.append(track, step, net); card.append(wrap); this.el = { bar, step, net }; this.paint();
  }
  private paint() {
    if (!this.el) return; const s = STEPS[this.at], secs = (performance.now() - this.t0) / 1000;
    this.el.bar.style.width = `${(this.frac * 100).toFixed(1)}%`;
    this.el.step.textContent = this.at >= STEPS.length - 1 ? 'Ready' : `${s.label}… (step ${this.at + 1} of ${STEPS.length - 1})`;
    const fromNet = (this.bytes - this.cached) / 1048576, fromCache = this.cached / 1048576;
    this.el.net.textContent = `${fromNet.toFixed(0)} MB downloaded${fromCache >= 1 ? `, ${fromCache.toFixed(0)} MB from this browser` : ''} · ${secs.toFixed(0)} s`;
  }
  finish() { this.step('ready'); this.obs?.disconnect(); (globalThis as any).__bootStage = undefined; }
}
