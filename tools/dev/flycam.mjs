// s18 Vagon hour: the fly-camera render. ONE page load, then every viewpoint of a part of the map in turn, each captured as a
// JPEG (canvas.toBlob) with its numbers in a CSV row. Walk paths are stepped at walking pace with a still every 2 game-seconds.
// Run (through the GPU slot; the server is the tree's vite dev server, started here unless --port is already up):
//   node tools/dev/gpu_slot.mjs flycamA -- node tools/dev/flycam.mjs --part A --out T:/fly/A [--minutes 40] [--port 5190]
// Parts: A = terrace + approach + rahmat + review views + walks; B = town + plain + far. Order inside a part: review views,
// walks, then points by area and a nearest-neighbour sweep (little new streaming per step). PW_CHANNEL=chrome drives Chrome.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync, mkdirSync, appendFileSync, existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const PART = arg('part', 'A'), OUT = arg('out', `T:/fly/${PART}`), PORT = +arg('port', 5190), MIN = +arg('minutes', 40), Q = arg('q', 'high');
const W = +arg('w', 1280), H = +arg('h', 720), REVIEW = arg('review', 'renders/_sets/review.json');
mkdirSync(`${OUT}/frames`, { recursive: true });
const PTS = JSON.parse(readFileSync('tests/data/coverage_points.json', 'utf8')).points;
const AREAS = PART === 'A' ? ['terrace', 'approach', 'rahmat'] : ['town', 'plain', 'far'];
// nearest-neighbour sweep inside an area
function sweep(list) { const left = [...list], out = []; let cur = left.sort((a, b) => a.e - b.e)[0]; left.splice(left.indexOf(cur), 1); out.push(cur);
  while (left.length) { let bi = 0, bd = 1e30; for (let i = 0; i < left.length; i++) { const d = (left[i].e - cur.e) ** 2 + (left[i].n - cur.n) ** 2; if (d < bd) { bd = d; bi = i; } } cur = left.splice(bi, 1)[0]; out.push(cur); } return out; }
const review = existsSync(REVIEW) ? JSON.parse(readFileSync(REVIEW, 'utf8')).extra : [];
const WALKS = PART === 'A' ? [
  { id: 'walk-gate-apadana', day: 25, hour: 10, w: 'clear', pts: [[0, 92], [0, 60], [1.9, 30], [1.9, 12]], eye: 1.6, az: 180 },
  { id: 'walk-banquet', day: 25, hour: 19, w: 'clear', pts: [[1.9, 12], [-20, 0], [-35, 85]], eye: 1.6, az: 270 },
] : [
  { id: 'walk-lane-market', day: 25, hour: 10, w: 'clear', pts: [[-478, -881], [-460, -930], [-444.3, -990.7]], eye: 1.6, az: 189 },
  { id: 'walk-river', day: 25, hour: 10, w: 'clear', pts: [[859, 3775], [880, 3800], [905, 3830]], eye: 1.6, az: 45 },
];
const queue = [
  ...review.filter((v, i) => PART === 'A' ? i < 7 : i >= 7).map(v => ({ ...v, area: 'review', w: v.w ?? 'clear' })),
  ...AREAS.flatMap(a => sweep(PTS.filter(p => p.area === a)).map(p => ({ ...p, area: p.area }))),
];

// the server
const up = async () => { try { return (await fetch(`http://localhost:${PORT}/`)).ok; } catch { return false; } };
if (!(await up())) { spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { shell: true, stdio: 'ignore', detached: true }).unref();
  for (let i = 0; i < 120 && !(await up()); i++) await new Promise(r => setTimeout(r, 1000)); }
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL ?? 'chrome', headless: true,
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const t0 = Date.now(), T = () => ((Date.now() - t0) / 1000).toFixed(0) + 's', errs = new Map();
page.on('console', m => { if (m.type() === 'error') { const k = m.text().slice(0, 140); errs.set(k, (errs.get(k) ?? 0) + 1); } });
page.on('pageerror', e => console.log(T(), 'PAGEERROR', String(e).slice(0, 200)));
page.on('crash', () => { console.log(T(), 'PAGE CRASHED'); process.exit(2); });
browser.on('disconnected', () => { console.log(T(), 'BROWSER GONE'); process.exit(2); });
const f0 = queue[0];
await page.goto(`http://localhost:${PORT}/?test&quality=${Q}&day=${f0.day}&hour=${f0.hour}&weather=${f0.w}&court=seasonal`, { timeout: 900000, waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 2400000, polling: 3000 });
const err = await page.evaluate(() => window.__parsa.error); if (err) throw new Error(err);
await page.evaluate(() => window.__parsa.renderer?.setAnimationLoop(null));
console.log(T(), 'ready; backend', await page.evaluate(() => window.__parsa.stats().backend));
const deadline = t0 + MIN * 60000;

const CSV = `${OUT}/metrics.csv`;
writeFileSync(CSV, 'id,part,area,sub,day,hour,w,e,n,eye,az,pitch,ms,jpgKB,luma,dark,bright,drawCalls,tris,peopleVisible,walking,crowdPeople,crowdImp,sunAlt\n');
const capture = async () => page.evaluate(async () => {
  const p = window.__parsa; await p.renderOnce();
  const c = document.querySelector('canvas'); const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.8));
  const bm = await createImageBitmap(blob), g = new OffscreenCanvas(64, 36).getContext('2d'); g.drawImage(bm, 0, 0, 64, 36); const d = g.getImageData(0, 0, 64, 36).data;
  let s = 0, dk = 0, br = 0; for (let i = 0; i < d.length; i += 4) { const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]; s += y; if (y < 25) dk++; if (y > 235) br++; }
  const u8 = new Uint8Array(await blob.arrayBuffer()); let b64 = ''; for (let i = 0; i < u8.length; i += 0x8000) b64 += String.fromCharCode(...u8.subarray(i, i + 0x8000));
  const st = p.stats(); let pv = null, hu = null; try { pv = p.world.people?.view?.stats ?? null; } catch {} try { hu = p.humans(); } catch {}
  return { b64: btoa(b64), kb: u8.length / 1024, luma: s / 2304, dark: dk / 2304, bright: br / 2304, dc: st.drawCalls, tris: st.triangles, pv: pv && { vis: pv.visible, walk: pv.walking }, hu: hu && { p: hu.people, i: hu.impostors }, sun: p.sky?.().sunAlt };
});
let key = `${f0.day}|${f0.hour}|${f0.w}`, n = 0, fails = 0;
async function shoot(id, v, settleN) {
  const t1 = Date.now(), k = `${v.day}|${v.hour}|${v.w}`;
  if (k !== key) { await page.evaluate(([d, h, w]) => { const a = window.__parsa; a.setTime(d, h); a.setWeather(w); }, [v.day, v.hour, v.w]); key = k; }
  const a = [v.e, v.n, v.eye, v.az, v.pitch, undefined, { cast: v.cast ?? null, rigClear: 0 }];
  await page.evaluate(a => window.__parsa.view(...a), a); await page.evaluate(() => window.__parsa.tick());
  await page.evaluate(a => window.__parsa.view(...a), a);
  await page.evaluate(n => window.__parsa.step(n, 1 / 30, 0), settleN); // tiles + people settle at a frozen clock
  const r = await capture(); writeFileSync(`${OUT}/frames/${id}.jpg`, Buffer.from(r.b64, 'base64'));
  appendFileSync(CSV, [id, PART, v.area ?? '', v.sub ?? '', v.day, v.hour, v.w, v.e, v.n, v.eye, v.az, v.pitch, Date.now() - t1, r.kb.toFixed(0), r.luma.toFixed(1), r.dark.toFixed(2), r.bright.toFixed(2), r.dc, r.tris, r.pv?.vis ?? '', r.pv?.walk ?? '', r.hu?.p ?? '', r.hu?.i ?? '', r.sun?.toFixed?.(1) ?? ''].join(',') + '\n');
  n++; if (n <= 20 || n % 25 === 0) console.log(T(), `#${n} ${id} ${Date.now() - t1} ms luma ${r.luma.toFixed(0)} ${r.kb.toFixed(0)} KB people ${r.pv?.vis ?? '-'}/${r.pv?.walk ?? '-'}`);
}
// 1. review views (settle longer), 2. walks, 3. the sweep
for (const v of queue.filter(q => q.area === 'review')) { try { await shoot(`review-${v.id}`, v, 30); } catch (e) { console.log(T(), v.id, 'FAILED', String(e).slice(0, 200)); } }
for (const wk of WALKS) {
  if (Date.now() > deadline) break;
  const legs = []; for (let i = 0; i + 1 < wk.pts.length; i++) { const [a, b] = [wk.pts[i], wk.pts[i + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), k = Math.max(1, Math.round(L / 2.8)); for (let j = 0; j < k; j++) legs.push([a[0] + (b[0] - a[0]) * j / k, a[1] + (b[1] - a[1]) * j / k, (Math.atan2(b[0] - a[0], b[1] - a[1]) * 180 / Math.PI + 360) % 360]); }
  await page.evaluate(([d, h, w]) => { const a = window.__parsa; a.setTime(d, h); a.setWeather(w); }, [wk.day, wk.hour, wk.w]); key = `${wk.day}|${wk.hour}|${wk.w}`;
  for (let i = 0; i < legs.length; i++) {
    try { const [e, nn, az] = legs[i]; const a = [e, nn, wk.eye, az, 0, undefined, { cast: null, rigClear: 0 }];
      await page.evaluate(a => window.__parsa.view(...a), a); await page.evaluate(() => window.__parsa.step(60, 1 / 30, 1)); // 2 s of world clock at walking pace
      await shoot(`${wk.id}-${String(i).padStart(3, '0')}`, { ...wk, e, n: nn, az, pitch: 0, area: 'walk' }, 1); } catch (e) { console.log(T(), wk.id, 'FAILED', String(e).slice(0, 200)); if (/closed|crash/i.test(String(e))) process.exit(2); }
  }
}
for (const v of queue.filter(q => q.area !== 'review')) {
  if (Date.now() > deadline) { console.log(T(), 'time up; stopping'); break; }
  try { await shoot(v.id, v, 10); } catch (e) { fails++; console.log(T(), v.id, 'FAILED', String(e).slice(0, 200)); if (/closed|crash|destroyed/i.test(String(e)) || fails > 20) break; }
}
console.log(T(), `done: ${n} frames, ${fails} fails; page errors ${errs.size}`); for (const [k, c] of [...errs].slice(0, 10)) console.log(' ', c + 'x', k);
await browser.close(); process.exit(0);
