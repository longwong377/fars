// D-336 (B191): the world's frame time with the neural voices on and off, at a place with talkers. One world load per mode.
//   node tools/dev/gpu_slot.mjs voices-frame -- node tools/dev/voices_frame.mjs  (E2E_PORT: a served tree)
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const PORT = process.env.E2E_PORT ?? '5348', OUT = process.argv[2] ?? 'T:/fars-assets-s12/voices/frame.json';
const SPOTS = [{ n: 'stair-foot', e: -60, n2: 112, az: 250 }, { n: 'town', e: -700, n2: 150, az: 200 }];
const res = [];
for (const mode of (process.env.MODES ?? 'on,off').split(',')) {
  const b = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } }); const logs = []; p.on('pageerror', e => logs.push(String(e).slice(0, 200)));
  const t0 = Date.now(); await p.goto(`http://localhost:${PORT}/?seed=1${mode === 'off' ? '&neural=0' : ''}`);
  await p.waitForFunction(() => window.__parsa?.ready, null, { timeout: 3600000, polling: 5000 });
  const loadS = (Date.now() - t0) / 1000; console.log(mode, 'ready', loadS, 's');
  await p.evaluate(() => { window.__parsa.audioUnlock?.(); window.__parsa.setTime(150, 10); });
  const r = { mode, loadS, spots: [] };
  for (const s of SPOTS) {
    await p.evaluate(s => window.__parsa.view(s.e, s.n2, 1.6, s.az, -3), s);
    await p.evaluate(() => window.__parsa.step(90)); // warm: shaders, the voices' first renders
    const m = await p.evaluate(async () => { const a = await window.__parsa.step(300); return { msPerFrame: a.ms / 300, voices: window.__parsa.voiceStats() }; });
    r.spots.push({ spot: s.n, ...m }); console.log(mode, s.n, m.msPerFrame.toFixed(1), 'ms/frame', JSON.stringify(m.voices?.pop?.lines ?? '').slice(0, 300), JSON.stringify(m.voices?.neural ?? {}).slice(0, 300));
  }
  r.logs = logs.slice(-10); res.push(r); await b.close();
}
writeFileSync(OUT, JSON.stringify(res, null, 1));
