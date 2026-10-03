// s18 (the empty-frames hunt + the head's batched look): on the BUILT site, one live page (the sim runs; not ?test) at the
// player's lens (1920x1080, the player's field of view), a list of views each set with setTime/setWeather + view, a wait, then
// the frame with the F3 overlay on, and what the people stages report: the overlay's population line, every humans:* / people:*
// object's visible flag (and its parents'), instance count and draw range, and the console errors.
//   node tools/dev/gpu_slot.mjs look -- node tools/dev/empty_frames.mjs <dist> <outDir> <set.json | cov-252,cov-037> [--wait 60] [--q high] [--seed 1]
// set.json: [{ id, e, n, eye, az, pitch, day, hour, w, cast?, wait?, face? }] or coverage point ids ("cov-252"); face: true puts
// the camera 0.5 m from the nearest drawn person's head, from four sides.
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const dist = resolve(a[0]), out = resolve(a[1]), spec = a[2] && !a[2].startsWith('--') ? a[2] : 'cov-252,cov-037';
const waitS = +opt('--wait', 60), q = opt('--q', 'high'), port = +opt('--port', 4181);
mkdirSync(out, { recursive: true });
const PTS = JSON.parse(readFileSync(join(dist, '..', 'tests/data/coverage_points.json'), 'utf8'));
const list = existsSync(spec) ? JSON.parse(readFileSync(spec, 'utf8')) : spec.split(',');
const views = list.map(v => typeof v === 'string' ? { ...PTS.points.find(p => p.id === v), wait: waitS } : v);
const here = new URL('.', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const srv = spawn(process.execPath, [join(here, '../deploy/serve.mjs'), dist, String(port), '/fars/'], { stdio: ['ignore', 'inherit', 'inherit'] });
process.on('exit', () => { try { srv.kill(); } catch {} });
const host = `http://127.0.0.2:${port}`;
for (let i = 0; i < 50; i++) { try { if ((await fetch(`${host}/fars/`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
const log = (...x) => console.log(new Date().toISOString().slice(11, 19), ...x);
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'parsa-look-')), { channel: process.env.PW_CHANNEL ?? 'chrome', headless: !process.env.HEADED,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'], viewport: { width: 1920, height: 1080 } });
const page = ctx.pages()[0] ?? await ctx.newPage();
const errs = [], warns = [];
page.on('pageerror', e => errs.push(String(e).slice(0, 400)));
page.on('console', m => { const t = m.text(); if (m.type() === 'error') errs.push(t.slice(0, 400)); else if (m.type() === 'warning' && /people|human|impostor|crowd|skinn|validation|lowfirst/i.test(t)) warns.push(t.slice(0, 300)); });
const v0 = views[0], t0 = Date.now();
await page.goto(`${host}/fars/?quality=${q}&day=${v0.day}&hour=${v0.hour}&weather=${v0.w}&court=seasonal&seed=${opt('--seed', 1)}`); // final2 ran ?test: world seed 1 (WORLD_SEED_DEFAULT); 515948316 is the points' sample seed
await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 3_600_000, polling: 500 });
log(`ready in ${((Date.now() - t0) / 1000).toFixed(0)} s; error ${await page.evaluate(() => window.__parsa.error ?? null)}`);
await page.getByRole('button', { name: /^(Enter|Continue the visit)$/ }).first().click({ timeout: 30_000 }).catch(e => log('no Enter button: ' + e.message.slice(0, 120)));
for (let i = 0; i < 3; i++) { await page.waitForTimeout(2000); await page.keyboard.press('Space').catch(() => {}); } // skip the wordless opening
writeFileSync(join(out, 'after-enter.png'), await page.screenshot());
const report = { dist, seed: +opt('--seed', 1), pointsSeed: PTS.meta.seed, q, viewport: '1920x1080', views: [] };
const save = () => writeFileSync(join(out, 'report.json'), JSON.stringify({ ...report, errs, warns }, null, 1));
const census = () => page.evaluate(() => {
  const p = window.__parsa, txt = document.body.innerText;
  const pop = (txt.match(/population [^\n]*?drawn [^\n]*?impostors/) ?? [null])[0];
  const summary = (() => { try { return p.world?.summary?.() ?? null; } catch (e) { return 'summary threw ' + e; } })();
  const popLine = summary ? (summary.match(/population \d+ simulated.*?impostors \[D-143\]/) ?? [null])[0] : null;
  const terraceLine = summary ? (summary.match(/people \d+\/\d+ on the Terrace \(drawn [^)]*\)/) ?? [null])[0] : null;
  const meshes = [], chain = o => { for (let x = o; x; x = x.parent) if (!x.visible) return `hidden at ${x.name || x.type}`; return 'visible'; };
  p.scene.traverse(o => { const n = o.name ?? ''; if (!/^(humans|people)[:.]/i.test(n) && !/human|people|impostor|crowd|body|bodies/i.test(n)) return;
    meshes.push({ name: n, type: o.type, visible: o.visible, chain: chain(o), count: o.count ?? null, instMax: o.instanceMatrix?.count ?? null,
      drawRange: o.geometry ? [o.geometry.drawRange.start, o.geometry.drawRange.count] : null, frustumCulled: o.frustumCulled, layers: o.layers?.mask, children: o.children?.length ?? 0 }); });
  let humans = null; try { humans = p.humans(); } catch (e) { humans = 'threw ' + e; }
  let sample = null; try { sample = p.popSample(400); } catch (e) { sample = 'threw ' + e; }
  const s = p.stats();
  return { pop, popLine, terraceLine, summary: summary?.slice(0, 6000) ?? null, meshes, humans, sample, drawCalls: s.drawCalls, triangles: s.triangles, clock: p.clockLabel(), pageErrors: p.errors?.slice(-20) };
});
for (const v of views) {
  const t1 = Date.now();
  try {
    await page.evaluate(([d, h, w]) => { const p = window.__parsa; p.setTime(d, h); p.setWeather(w); }, [v.day, v.hour, v.w]);
    const cam = [v.e, v.n, v.eye, v.az, v.pitch, undefined, { cast: v.cast ?? null, rigClear: 0 }];
    await page.evaluate(c => window.__parsa.view(...c), cam);
    const w = v.wait ?? 20; log(`${v.id}: d${v.day} ${v.hour} h ${v.w}, waiting ${w} s`);
    for (const until = Date.now() + w * 1000; Date.now() < until;) { await page.evaluate(c => window.__parsa.view(...c), cam); await page.waitForTimeout(Math.min(5000, Math.max(100, until - Date.now()))); }
    await page.evaluate(c => window.__parsa.view(...c), cam); await page.waitForTimeout(1500);
    writeFileSync(join(out, `${v.id}.png`), await page.screenshot()); // the frame as the player sees it
    await page.keyboard.press('F3'); await page.waitForTimeout(2500);
    writeFileSync(join(out, `${v.id}-f3.png`), await page.screenshot());
    const r = await census(); await page.keyboard.press('F3');
    const rec = { id: v.id, why: v.why, cam: [v.e, v.n, v.eye, v.az, v.pitch], day: v.day, hour: v.hour, w: v.w, ...r };
    if (Array.isArray(r.sample)) { const d = x => Math.hypot(x.e - v.e, x.n - v.n); rec.within60 = r.sample.filter(x => d(x) < 60).length; rec.sampleN = r.sample.length; delete rec.sample; }
    if (v.face) { // 0.5 m from the nearest drawn person's head, four sides
      const near = Array.isArray(r.sample) ? r.sample.map(x => ({ ...x, d: Math.hypot(x.e - v.e, x.n - v.n) })).filter(x => x.d > 1).sort((x, y) => x.d - y.d)[0] : null;
      rec.facePerson = near ?? null;
      if (near) for (const side of [0, 90, 180, 270]) {
        const az = (side + 0) % 360, rad = az * Math.PI / 180; // the camera stands 0.5 m from the person, looking along az at them
        const ce = near.e - Math.sin(rad) * 0.5, cn = near.n - Math.cos(rad) * 0.5;
        await page.evaluate(([e, n, a]) => window.__parsa.view(e, n, 1.55, a, -3, undefined, { cast: null, rigClear: 0 }), [ce, cn, az]);
        await page.waitForTimeout(1500); writeFileSync(join(out, `${v.id}-az${az}.png`), await page.screenshot());
      }
    }
    log(`${v.id}: "${r.pop ?? r.popLine ?? '-'}" | within 60 m ${rec.within60} | ${r.meshes.length} people objects | draws ${r.drawCalls} (${((Date.now() - t1) / 1000).toFixed(0)} s)`);
    report.views.push(rec);
  } catch (e) { log(`${v.id} FAILED: ${String(e).slice(0, 300)}`); report.views.push({ id: v.id, error: String(e).slice(0, 400) }); if (/closed|crash|destroyed/i.test(String(e))) break; }
  save();
}
save(); log(`done in ${((Date.now() - t0) / 60000).toFixed(1)} min; errors ${errs.length}: ${errs.slice(0, 8).join('\n')}`);
await ctx.close(); process.exit(0);
