// s15/load (D-354): where a full-world page's memory goes. One page load on the real GPU (a fresh profile), with the WebGPU
// device's texture and buffer creations recorded with the call site that made it (live bytes: a destroyed one
// is subtracted), and the CPU-side arrays the scene holds (geometry attributes, instance buffers, data textures) by group. The Chrome processes' memory (working set and
// private bytes, by process type) is sampled at ready, after the first frames, and after a forced GC.
//   NOHMR=1 npx vite --port <p> --strictPort   (in this tree), then
//   node tools/dev/gpu_slot.mjs load -- node tools/bake_world/mem_probe.mjs <port> [out.json]
//   URLX=&norender (no pixels: the page's own memory only), NOFRAME=1 (stop at ready), Q=high
import { chromium } from '@playwright/test';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execSync } from 'node:child_process';
const [port = '5182', out = '../load-out/mem_probe.json'] = process.argv.slice(2), extra = process.env.URLX ?? '';
const prof = mkdtempSync(join(tmpdir(), 'parsa-mem-'));
const args = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--js-flags=--expose-gc'];
const ctx = await chromium.launchPersistentContext(prof, { channel: process.env.PW_CHANNEL ?? 'chrome', headless: !process.env.HEADED, args, viewport: { width: 1920, height: 1080 } });
await ctx.addInitScript(() => {
  const M = (window).__mem = { gpu: new Map(), arr: new Map(), gpuLive: 0, arrLive: 0 };
  Error.stackTraceLimit = 40; const site = () => { const s = (new Error().stack ?? '').split('\n').slice(3, 40).map(l => l.trim().replace(/^at /, '').replace(/https?:\/\/[^/]+\//, '').replace(/\?[^:)]*/, '')); return s.filter(l => !/three\.|three_|deps\/|node_modules|chunk-/.test(l)).slice(0, 3).join(' < ') || s.slice(0, 2).join(' < '); };
  const add = (map, k, b) => { const e = map.get(k) ?? { n: 0, bytes: 0, live: 0, liveN: 0 }; e.n++; e.bytes += b; e.live += b; e.liveN++; map.set(k, e); };
  const sub = (map, k, b) => { const e = map.get(k); if (e) { e.live -= b; e.liveN--; } };
  const BPP = f => /^(rgba32|rg32float|rgba32)/.test(f) ? 16 : /rgba16|rg32/.test(f) ? 8 : /^(rgba8|bgra8|rg16|r32|depth32|depth24|rgb10|rg11b10|rgb9e5)/.test(f) ? 4 : /^(rg8|r16|depth16)/.test(f) ? 2 : /^r8/.test(f) ? 1 : /bc1|bc4|etc2-rgb8|eac-r11/.test(f) ? 0.5 : /bc|astc|etc|eac/.test(f) ? 1 : 4;
  const seenBuf = new WeakSet(), fr = new FinalizationRegistry(([k, b]) => { sub(M.arr, k, b); M.arrLive -= b; });
  const track = (k, buf) => { add(M.arr, k, buf.byteLength); M.arrLive += buf.byteLength; fr.register(buf, [k, buf.byteLength]); };
  if (typeof GPUDevice !== 'undefined') {
    const D = GPUDevice.prototype, ct = D.createTexture, cb = D.createBuffer;
    const T = GPUTexture.prototype, td = T.destroy, B = GPUBuffer.prototype, bd = B.destroy, own = new WeakMap();
    D.createTexture = function (d) { const r = ct.call(this, d); const s = d.size, w = s.width ?? s[0], h = s.height ?? s[1] ?? 1, z = s.depthOrArrayLayers ?? s[2] ?? 1, mips = d.mipLevelCount ?? 1, smp = d.sampleCount ?? 1;
      let b = 0; for (let m = 0; m < mips; m++) b += Math.max(1, w >> m) * Math.max(1, h >> m) * (d.dimension === '3d' ? Math.max(1, z >> m) : z); b = b * BPP(d.format) * smp;
      const k = `tex ${d.format} ${w}x${h}x${z}${mips > 1 ? ' mip' : ''} @ ${site()}`; own.set(r, [k, b]); add(M.gpu, k, b); M.gpuLive += b; return r; };
    T.destroy = function () { const o = own.get(this); if (o) { sub(M.gpu, o[0], o[1]); M.gpuLive -= o[1]; own.delete(this); } return td.call(this); };
    D.createBuffer = function (d) { const r = cb.call(this, d); const b = d.size; if (b >= 65536) { const k = `buf ${d.usage} @ ${site()}`; own.set(r, [k, b]); add(M.gpu, k, b); } else { const k = 'buf <64K'; own.set(r, [k, b]); add(M.gpu, k, b); } M.gpuLive += b; return r; };
    B.destroy = function () { const o = own.get(this); if (o) { sub(M.gpu, o[0], o[1]); M.gpuLive -= o[1]; own.delete(this); } return bd.call(this); };
    // the page's own copies: an array buffer handed to the GPU and still alive later is held twice (page and GPU)
    const Q = GPUQueue.prototype, wt = Q.writeTexture, wb = Q.writeBuffer;
    Q.writeTexture = function (dst, data, layout, size) { const b = data?.buffer ?? data; if (b?.byteLength >= 1 << 20 && !seenBuf.has(b)) { seenBuf.add(b); const k = `upload tex ${dst.texture?.format} ${b.byteLength >> 20} MB`; track(k, b); } return wt.call(this, dst, data, layout, size); };
    Q.writeBuffer = function (buf, off, data, ...rest) { const b = data?.buffer ?? data; if (b?.byteLength >= 1 << 16 && !seenBuf.has(b)) { seenBuf.add(b); const o = own.get(buf); track(`upload buf ${o ? o[0].split(' @')[0] : '?'}`, b); } return wb.call(this, buf, off, data, ...rest); };
  }
  // the downloads kept: every fetched body read as an ArrayBuffer (>= 256 kB), by file
  const R = Response.prototype, rab = R.arrayBuffer;
  R.arrayBuffer = function () { const u = String(this.url).replace(/^https?:\/\/[^/]+\//, '').replace(/\?.*/, ''); return rab.call(this).then(b => { if (b.byteLength >= 1 << 18) { seenBuf.add(b); track(`fetch ${u}`, b); } return b; }); };
  const cib = window.createImageBitmap; window.createImageBitmap = function (...a) { return cib.apply(this, a).then(bm => { const b = bm.width * bm.height * 4; if (b >= 1 << 20) { const k = `bitmap ${bm.width}x${bm.height} @ ${site()}`; add(M.arr, k, b); M.arrLive += b; fr.register(bm, [k, b]); const c = bm.close; bm.close = function () { if (!this.__closed) { this.__closed = 1; sub(M.arr, k, b); M.arrLive -= b; } return c.call(this); }; } return bm; }); };
});
const page = ctx.pages()[0] ?? await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
const t0 = Date.now(), el = () => +((Date.now() - t0) / 1000).toFixed(1), lines = [];
page.on('console', m => { const t = m.text(); if (/^\[boot\]|error/i.test(t) && lines.length < 2000) lines.push(`${el()} ${t.slice(0, 240)}`); });
page.on('pageerror', e => lines.push(`${el()} pageerror ${String(e).slice(0, 300)}`));
const tag = prof.split(/[\\/]/).pop(); // the profile's unique directory name, in every one of its processes' command lines
const procs = () => { try {
  const ps = `$all = Get-CimInstance Win32_Process -Filter "Name='chrome.exe'"; $b = @($all | Where-Object { $_.CommandLine -like '*${tag}*' -and $_.CommandLine -notmatch '--type=' } | ForEach-Object { $_.ProcessId }); $p = $all | Where-Object { $b -contains $_.ProcessId -or $b -contains $_.ParentProcessId };foreach ($x in $p) { $g = Get-Process -Id $x.ProcessId -ErrorAction SilentlyContinue; if ($g) { $t = if ($x.CommandLine -match '--type=([a-z-]+)') { $Matches[1] } else { 'browser' }; '{0} {1} {2} {3}' -f $x.ProcessId, $t, [int]($g.WorkingSet64/1MB), [int]($g.PrivateMemorySize64/1MB) } }`;
  const o = execSync(`powershell -NoProfile -Command -`, { input: ps, encoding: 'utf8' });
  const rows = o.trim().split(/\r?\n/).filter(Boolean).map(l => { const [pid, type, ws, priv] = l.trim().split(/\s+/); return { pid: +pid, type, ws: +ws, priv: +priv }; });
  const by = {}; for (const r of rows) { const b = by[r.type] ?? { n: 0, ws: 0, priv: 0 }; b.n++; b.ws += r.ws; b.priv += r.priv; by[r.type] = b; }
  return { wsMB: rows.reduce((a, r) => a + r.ws, 0), privMB: rows.reduce((a, r) => a + r.priv, 0), by };
} catch (e) { return { err: String(e).slice(0, 200) }; } };
// the page's memory by context (the window, each worker by its script; JS heaps, array buffers and wasm memories): the
// cross-origin-isolated page's own measurement (it may take a GC cycle, up to ~20 s)
const uasm = () => page.evaluate(async () => { if (!performance.measureUserAgentSpecificMemory) return null;
  try { const r = await Promise.race([performance.measureUserAgentSpecificMemory(), new Promise(res => setTimeout(() => res(null), 60000))]); if (!r) return 'timeout';
    const by = {}; for (const b of r.breakdown) { if (!b.bytes) continue; const k = (b.types.join('+') || 'shared') + ' ' + (b.attribution.map(a => (a.scope ?? '') + ':' + String(a.url ?? '').replace(/^https?:\/\/[^/]+\//, '').replace(/\?.*/, '')).join(',') || ''); by[k] = (by[k] ?? 0) + b.bytes; }
    return { totalMB: Math.round(r.bytes / 1048576), by: Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => [k, Math.round(v / 1048576)]) }; } catch (e) { return String(e); } });
const pageMem = async () => { const h = await cdp.send('Runtime.getHeapUsage').catch(() => null), ua = await uasm();
  const m = await page.evaluate(() => { const M = window.__mem, top = (map, n) => [...map].filter(([, e]) => e.live > 0).sort((a, b) => b[1].live - a[1].live).slice(0, n).map(([k, e]) => [k, +(e.live / 1048576).toFixed(1), e.liveN]);
    // the scene's CPU-side arrays by group (three levels of names), each buffer once; images by size
    const seen = new Set(), G = {}, bytesOf = a => { const arr = a?.array ?? a?.image?.data; if (!arr?.byteLength || seen.has(arr.buffer ?? arr)) return 0; seen.add(arr.buffer ?? arr); return arr.buffer?.byteLength ?? arr.byteLength; };
    let img = 0; const imgs = new Set();
    const own = o => { let b = 0; const g = o.geometry; if (g?.attributes) { for (const k in g.attributes) b += bytesOf(g.attributes[k].data ?? g.attributes[k]); b += bytesOf(g.index); }
      b += bytesOf(o.instanceMatrix) + bytesOf(o.instanceColor);
      for (const m of [o.material].flat()) if (m) for (const k in m) { const t = m[k]; if (t?.isTexture) { b += bytesOf(t); const im = t.image; if (im && !im.data && !imgs.has(im)) { imgs.add(im); img += (im.width ?? 0) * (im.height ?? 0) * 4; } } } return b; };
    window.__parsa.scene?.traverse(o => { const p = []; for (let q = o; q && q.parent; q = q.parent) p.unshift(q.name || q.type); const k = p.slice(0, 3).join('/'); const b = own(o); if (b) G[k] = (G[k] ?? 0) + b; });
    const sceneTop = Object.entries(G).sort((a, b) => b[1] - a[1]).slice(0, 50).map(([k, v]) => [k, +(v / 1048576).toFixed(1)]);
    const sceneMB = Math.round(Object.values(G).reduce((a, b) => a + b, 0) / 1048576);
    return { released: window.__parsa.releaseStats ? { n: window.__parsa.releaseStats.textures, MB: Math.round(window.__parsa.releaseStats.bytes / 1048576) } : null, gpuLiveMB: +(M.gpuLive / 1048576).toFixed(0), sceneArraysMB: sceneMB, materialImagesMB: Math.round(img / 1048576), arrLiveMB: Math.round(M.arrLive / 1048576), gpuTop: top(M.gpu, 50), arrTop: top(M.arr, 60), sceneTop }; });
  return { jsHeapMB: h ? Math.round(h.usedSize / 1048576) : null, uasm: ua, ...m }; };
const url = `http://localhost:${port}/?test&trace&quality=${process.env.Q ?? 'high'}&day=0&hour=5.4&weather=clear${extra}`;
const res = { url, samples: {} }, save = () => { mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(res, null, 1)); };
await page.goto(url);
await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 3_600_000, polling: 1000 });
res.readyS = el(); res.err = await page.evaluate(() => window.__parsa.error ?? null);
res.samples.ready = { at: el(), procs: procs(), page: await pageMem() }; save();
if (!res.err && !process.env.NOFRAME && !/norender/.test(extra)) {
  await page.evaluate(() => { window.__parsa.renderer.setAnimationLoop(null); window.__parsa.view(-36.4, 140.5, 1.6, 196, -8); });
  try { res.warmUp = await page.evaluate(() => window.__parsa.warmUp());
  for (let i = 0; i < 2; i++) await page.evaluate(() => window.__parsa.renderOnce()); } catch (e) { res.frameErr = String(e).slice(0, 600); }
  res.firstFrameS = el();
  res.samples.frames = { at: el(), procs: procs(), page: await pageMem() }; save();
}
await cdp.send('HeapProfiler.collectGarbage').catch(() => {}); await page.waitForTimeout(3000);
res.samples.gc = { at: el(), procs: procs(), page: await pageMem() }; save();
res.lines = lines;
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(res, null, 1));
const s = res.samples.gc;
console.log(JSON.stringify({ readyS: res.readyS, firstFrameS: res.firstFrameS, err: res.err, ready: res.samples.ready.procs, frames: res.samples.frames?.procs, gc: s.procs, jsHeapMB: s.page.jsHeapMB, gpuLiveMB: s.page.gpuLiveMB, sceneArraysMB: s.page.sceneArraysMB, arrLiveMB: s.page.arrLiveMB, uasm: s.page.uasm?.totalMB }, null, 1));
await ctx.close();
