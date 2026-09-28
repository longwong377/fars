import { test } from '@playwright/test';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
// D-337 (B125): the frame profiled in the heaviest views, in one page load at the player's lens and quality (Q=high,
// 1920x1080 unless W/H). Per view: the player's loop (__parsa.profile: dt 1/60, the frozen test world's per-frame extras
// off) — CPU per section, GPU per pass (timestamp queries, ?prof), the serialised and the pipelined frame — then, with
// ABL=1 in the first view (or ABL=<view>), the frame with each top-level object group hidden in turn (its cost).
// DBG=1 PW_CHANNEL=chrome npx playwright test tests/e2e/dbg_perf.spec.ts --project=gpu   (ONLY=a,b; TAG=label; N=frames)
const az = (gridDeg: number) => gridDeg - 19;
const VIEWS: { n: string; day: number; hour: number; w: string; v: [number, number, number, number, number] }[] = [
  { n: 'town-lane', day: 25, hour: 12.2, w: 'clear', v: [-422, -941, 1.6, az(28), 0] },
  { n: 'town-smoke-dusk', day: 14, hour: 18.8, w: 'clear', v: [-50.5, -120, 1.6, 205, -1.5] },
  { n: 'court-crowd', day: 20, hour: 10, w: 'clear', v: [-35, 85, 1.6, az(90), -2] },
  { n: 'plain-dusk', day: 14, hour: 19, w: 'clear', v: [-400, 122, 1.6, 71, 2] },
  { n: 'apadana-hall', day: 25, hour: 11, w: 'clear', v: [1.9, 12, 1.6, 161, 6] },
  { n: 'gate-dusk', day: 0, hour: 19.25, w: 'clear', v: [-40, 124.6, 1.6, 90, 15] },
  { n: 'night-moon-fire', day: 11, hour: 2.75, w: 'clear', v: [-23.4, 122.5, 1.6, 253.5, 6] },
];
test('perf: the frame by section, pass and object class', async ({ page }) => {
  test.setTimeout(+(process.env.TIMEOUT ?? 3600) * 1000);
  const W = +(process.env.W ?? 1920), H = +(process.env.H ?? 1080), N = +(process.env.N ?? 30), q = process.env.Q ?? 'high';
  await page.setViewportSize({ width: W, height: H });
  page.on('console', m => { const t = m.text(); if (m.type() === 'error' || t.startsWith('[prof]')) console.log(t.slice(0, 400)); });
  const only = process.env.ONLY?.split(','), views = VIEWS.filter(v => !only || only.includes(v.n)), first = views[0];
  const t0 = Date.now();
  await page.goto(`/?test&prof&quality=${q}&day=${first.day}&hour=${first.hour}&weather=${first.w}&court=seasonal${process.env.URLX ?? ''}`);
  await page.waitForFunction(() => (window as any).__parsa?.ready === true, null, { timeout: 3_000_000, polling: 2000 });
  await page.evaluate(() => (window as any).__parsa.renderer.setAnimationLoop(null));
  console.log('ready', ((Date.now() - t0) / 1000).toFixed(0), 's', await page.evaluate(() => { const b = (window as any).__parsa.renderer.backend; return { ts: !!b.trackTimestamp, adapter: b.adapter?.info?.description ?? b.device?.adapterInfo?.description ?? '' }; }));
  const out: Record<string, any> = { when: new Date().toISOString(), W, H, q, tag: process.env.TAG ?? '', views: {} };
  const f = 'shots/perf-profile.json'; mkdirSync('shots', { recursive: true });
  for (const s of views) {
    await page.evaluate(([d, h, w, v]) => { const p = (window as any).__parsa; p.setWeather(w); p.setTime(d, h); p.view(...(v as any)); }, [s.day, s.hour, s.w, s.v] as const);
    const tw = Date.now(); for (let i = 0; i < 4; i++) await page.evaluate(() => (window as any).__parsa.renderOnce());
    const r = await page.evaluate((n) => (window as any).__parsa.profile(n), N);
    r.warmS = (Date.now() - tw) / 1000;
    { const r0 = await page.evaluate(async (n) => { const C = (globalThis as any).__parsaCascades; const was = C.on; C.on = false; try { return await (window as any).__parsa.profile(n); } finally { C.on = was; } }, 12);
      r.allCascades = { cpu: r0.cpuMs, gpu: r0.gpuMs, serial: r0.serialMs, pipelined: r0.pipelinedMs }; console.log(`[perf] ${s.n} every cascade every frame: ${JSON.stringify(r.allCascades)}`); }
    out.views[s.n] = r;
    console.log(`[perf] ${s.n} cpu ${r.cpuMs} serial ${r.serialMs} gpu ${r.gpuMs} pipelined ${r.pipelinedMs} draws ${r.draws} tris ${(r.tris / 1e6).toFixed(2)}M`);
    console.log(`[perf] ${s.n} sections ${JSON.stringify(Object.fromEntries(Object.entries(r.sections).sort((a: any, b: any) => b[1] - a[1]).slice(0, 18)))}`);
    console.log(`[perf] ${s.n} max ${r.cpuMaxMs} sections max ${JSON.stringify(Object.fromEntries(Object.entries(r.secMax).sort((a: any, b: any) => b[1] - a[1]).slice(0, 10)))}`);
    for (const p of r.passes.slice(0, 16)) console.log(`[perf]   ${String(p.gpu).padStart(7)} ms gpu ${String(p.cpu).padStart(6)} cpu ×${p.n} ${p.draws} draws ${(p.tris / 1e3).toFixed(0)}k  ${p.label}  ${JSON.stringify(p.cls).slice(0, 300)}`);
    await page.screenshot({ path: `shots/perf-${s.n}${process.env.TAG ? '-' + process.env.TAG : ''}.png` });
    const abl = process.env.ABL === '1' ? s === first : process.env.ABL?.split(',').includes(s.n);
    if (abl) {
      const groups: string[] = await page.evaluate(() => { const P = (window as any).__parsa, sc = P.world.root.parent; const names: string[] = [];
        for (const o of [...P.world.root.children, ...sc.children]) if (o !== P.world.root && o.visible && o.name) names.push(o.name); return [...new Set(names)]; });
      const rows: any[] = [];
      for (const g of groups) {
        const r2 = await page.evaluate(async ([g, n]) => { const P = (window as any).__parsa, sc = P.world.root.parent; const objs = [...P.world.root.children, ...sc.children].filter((o: any) => o.name === g);
          objs.forEach((o: any) => { o.visible = false; }); try { return await P.profile(n); } finally { objs.forEach((o: any) => { o.visible = true; }); } }, [g, 10] as const);
        rows.push({ group: g, cpu: r2.cpuMs, gpu: r2.gpuMs, serial: r2.serialMs, draws: r2.draws, tris: r2.tris });
      }
      const base = await page.evaluate((n) => (window as any).__parsa.profile(n), 10);
      for (const x of rows) { x.dGpu = +(base.gpuMs - x.gpu).toFixed(2); x.dCpu = +(base.cpuMs - x.cpu).toFixed(2); }
      rows.sort((a, b) => b.dGpu - a.dGpu);
      out.views[s.n].ablation = { base: { cpu: base.cpuMs, gpu: base.gpuMs, serial: base.serialMs }, rows };
      for (const x of rows) console.log(`[abl] ${s.n} hide ${x.group}: gpu -${x.dGpu} cpu -${x.dCpu} (draws ${x.draws})`);
    }
    const all = existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {}; all[`${out.tag || 'run'}|${W}x${H}|${q}`] = out; writeFileSync(f, JSON.stringify(all, null, 1));
  }
});
