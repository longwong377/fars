// s18 C14 (D-790): faces up close in humanlab under the cloud's software renderer (crude: placement, shape and motion, not
// the T4's look). Three faces at 0.5 m, a talking face over a few moments of speech, a listener. Serve the tree
// (NOHMR=1 npx vite --port $PORT), then: node tools/dev/face_probe.mjs <outdir> [shot,...]
// Env: PORT (5191), Q (medium), W, H (1280, 720), WEBGL (1: WebGL2, the cloud), EXEC (a chromium binary; the cloud's default).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
const OUT = process.argv[2] ?? 'shots/c14'; mkdirSync(OUT, { recursive: true });
const ONLY = process.argv[3]?.split(',') ?? null;
const port = process.env.PORT ?? '5191', Q = process.env.Q ?? 'medium', W = +(process.env.W ?? 1280), H = +(process.env.H ?? 720);
const exec = process.env.EXEC ?? (process.platform === 'linux' ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
const b = await chromium.launch({ executablePath: exec, headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: W, height: H } }); const logs = [];
p.on('console', m => { if (m.type() === 'error') logs.push(m.text().slice(0, 300)); }); p.on('pageerror', e => logs.push('pageerror ' + e));
const t0 = Date.now();
await p.goto(`http://localhost:${port}/humanlab.html?test&quality=${Q}&hour=10&day=110&fov=60${process.env.WEBGL === '0' ? '' : '&webgl=1'}`);
await p.waitForFunction(() => window.__lab?.ready === true || window.__lab?.error, null, { timeout: 1800000, polling: 2000 });
const err = await p.evaluate(() => window.__lab.error); if (err) { console.log('ERR', err); process.exit(1); }
console.log('ready', (Date.now() - t0) / 1000, 's');
const shot = async (name, fn, arg, frames = 6) => { if (ONLY && !ONLY.includes(name)) return; await p.evaluate(fn, arg);
  await p.evaluate(n => window.__lab.render(n), frames); await p.screenshot({ path: `${OUT}/${name}.png`, timeout: 900000 }); console.log(name, (Date.now() - t0) / 1000); };
const MIX = [{ dress: 'worker', sex: 'm', role: 'porter', seed: 24, origin: 'Persian' }, { dress: 'woman', sex: 'f', role: 'grinder', seed: 21, origin: 'Persian' },
  { dress: 'persian', sex: 'm', role: 'official', seed: 36, origin: 'Persian', age: 'elder' }];
for (const [i, side] of [[0, 0.1], [1, -0.08], [2, 0.06]]) await shot(`face05-${i}`, ([m, i, side]) => { const L = window.__lab; L.lineup(m, 0.9, true); L.at(4); L.frameFace(i, 0.5, side); }, [MIX, i, side]);
// talking: the middle person speaks (the crowd's talk cycle drives the jaw; the face speaks over it), six moments, each after
// 0.4 s of frames (the head's following of the eyes and the mouth's coarticulation run on the clock)
for (const [k, tt] of [0, 0.11, 0.23, 0.37, 0.52, 0.71].entries()) await shot(`talk-${k}`, ([m, tt]) => { const L = window.__lab; L.lineup(m.map((s, j) => (j === 1 ? { ...s, anim: 'talk' } : s)), 0.9, true); L.at(4 + tt - 0.4); L.frameFace(1, 0.55, 0.05); }, [MIX, tt], 12);
await shot('talk-man', ([m]) => { const L = window.__lab; L.lineup(m.map((s, j) => (j === 0 ? { ...s, anim: 'talk' } : s)), 0.9, true); L.at(6.9); L.frameFace(0, 0.55, 0.05); }, [MIX], 12);
writeFileSync(`${OUT}/log.json`, JSON.stringify({ logs: logs.slice(0, 40), seconds: (Date.now() - t0) / 1000 }, null, 1));
await b.close();
