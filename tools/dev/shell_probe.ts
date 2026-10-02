// s17 C5 (D-590): the out-of-world screens without the world, for headless screenshots (tools/dev/shell_probe.mjs).
// ?screen=loading&frac=0.4 | title | pause | settings&tab=N | controls | chronicle | subtitle | intro. A painted backdrop
// stands in for the live world behind the glass screens (the probe has no renderer).
import { Shell } from '../../src/ui/shell';
import { BootProgress, STEPS } from '../../src/shell/progress';
import { DEFAULT_SETTINGS } from '../../src/core/settings';

const P = new URLSearchParams(location.search), screen = P.get('screen') ?? 'loading';
const settings = structuredClone(DEFAULT_SETTINGS);
const hooks: any = { start() {}, resume() {}, save: () => true, load: () => true, applySettings() {}, hasSave: () => true, newVisit() {},
  getTime: () => ({ day: 2, hour: 6.4, label: '3 Nisannu (Adukanaiša), Xerxes yr 19 · 19 Apr 467 BCE (Julian) · 06:24 local mean time' }), setTime() {},
  getWeather: () => 'auto', setWeather() {}, seed: () => 515948316, newWorld() {} };
const shell = new Shell(settings, hooks);
// a stand-in for the live world behind the title and the menus: warm morning plain, a mountain, the Terrace's line
const c = document.getElementById('view') as HTMLCanvasElement; c.width = innerWidth; c.height = innerHeight; c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh';
const g = c.getContext('2d')!, W = c.width, H = c.height;
const sky = g.createLinearGradient(0, 0, 0, H * 0.62); sky.addColorStop(0, '#6f93b8'); sky.addColorStop(1, '#e9d2b0'); g.fillStyle = sky; g.fillRect(0, 0, W, H);
g.fillStyle = '#9a8a7a'; g.beginPath(); g.moveTo(0, H * 0.6); for (let x = 0; x <= W; x += 8) g.lineTo(x, H * 0.6 - Math.max(0, 140 * Math.sin((x / W) * Math.PI * 1.1 + 0.4)) * (0.6 + 0.4 * Math.sin(x / 37))); g.lineTo(W, H); g.lineTo(0, H); g.fill();
g.fillStyle = '#b79f78'; g.fillRect(W * 0.35, H * 0.55, W * 0.4, H * 0.06); g.fillStyle = '#8f7a5a'; for (let i = 0; i < 24; i++) g.fillRect(W * 0.4 + i * W * 0.012, H * 0.47, 4, H * 0.08);
const gr = g.createLinearGradient(0, H * 0.6, 0, H); gr.addColorStop(0, '#9d8b62'); gr.addColorStop(1, '#5a4c33'); g.fillStyle = gr; g.fillRect(0, H * 0.6, W, H * 0.4);

if (screen === 'loading') {
  shell.loading('Preparing the renderer…'); const prog = new BootProgress(); if (shell.loadingCard) prog.mount(shell.loadingCard);
  const frac = +(P.get('frac') ?? 0.35); let acc = 0; const tot = STEPS.reduce((a, s) => a + s.w, 0);
  for (const s of STEPS) { if ((acc + s.w) / tot > frac) break; acc += s.w; prog.step(s.key); }
} else if (screen === 'title') shell.title(P.has('continued'));
else if (screen === 'pause') shell.pause();
else if (screen === 'settings') { (shell as any).lastTab = +(P.get('tab') ?? 0); shell.settingsPanel(() => shell.pause()); }
else if (screen === 'controls') shell.controls();
else if (screen === 'chronicle' || screen === 'subtitle' || screen === 'insc' || screen === 'map') {
  settings.translation = true; shell.playing();
  const { TranslationLayer } = await import('../../src/ui/translation');
  const tl = new TranslationLayer(() => settings);
  if (screen === 'chronicle') tl.toggle('chronicle');
  if (screen === 'map') tl.toggle('map');
  if (screen === 'insc') (tl as any).picked = { id: P.get('id') ?? 'XPa', version: P.get('ver') ?? 'op' };
  const ev = (t: number, kind: string, text: string) => ({ t, kind, text, place: '', tier: 'C' });
  const events = [ev(30.2, 'birth', 'Irdabama, wife of the potter Ukpiš, bore a daughter in the lane of the potters.'), ev(31.5, 'trade', 'Barley rose to 1 shekel for 30 qa at the market by the N gate.'),
    ev(40.1, 'visitor', 'A caravan from Susa came in by the W road: 14 asses, cloth and dried fish.'), ev(52.9, 'work', 'The haulers of the Hall of a Hundred Columns raised a column drum on the ramp.'),
    ev(54.0, 'dispute', 'Two neighbours quarrelled over a water turn on the canal; the headman settled it.'), ev(55.3, 'rumour', 'Word went round the town that the court would arrive within the month.')];
  const hm = (t: number) => { const d = Math.floor(t / 24), h = t - d * 24; return `day ${d + 1}, ${Math.floor(h)}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`; };
  const cam: any = { position: { x: 0, y: 0, z: 0 } };
  const sub = screen === 'subtitle' ? { translit: 'dātam taya manā, avaθā dārayam', gloss: 'The law that is mine, so I hold it', lang: 'peo', tier: 'C', lineId: '' } : null;
  tl.update({ camera: cam, inscriptions: null, subtitle: sub as any, subtitleAt: performance.now() / 1000, now: performance.now() / 1000, player: { e: 0, n: 0, yawDeg: 0 }, events, timeLabel: hm, places: {} });
} else if (screen === 'intro') {
  shell.playing(); document.body.classList.add('intro');
  const bars = document.createElement('div'); bars.className = 'intro-bars on'; const hint = document.createElement('div'); hint.className = 'intro-skip on';
  hint.append('Any key skips', Object.assign(document.createElement('span'), { className: 'ring' })); document.body.append(bars, hint);
}
await document.fonts.ready; (window as any).__ready = true;
