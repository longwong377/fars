// s17/load (D-580): what holds a cold load's page memory at ready. The JS heap of the page's main thread was 3.3 GB at ready
// (5.6 GB in all), mostly typed arrays (the sampling heap profiler, which does not see their bytes, found 0.5 GB). This
// instruments the main thread before the page runs: every ArrayBuffer of >= --min KB made by a typed-array or ArrayBuffer
// constructor, a slice, a Response/Blob's arrayBuffer() or a worker's message is recorded with its allocation site (a weak
// reference), and at ready, after a full GC, the live ones are summed by site. Build the dist with NOMINIFY=1 for names.
//   node tools/deploy/boot_mem.mjs [dist] [--params norender&seed=1] [--mbps 100] [--min 256] [--top 40] [--depth 4]
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const a = process.argv.slice(2), opt = (k, d) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : d; };
const dist = resolve(a[0] && !a[0].startsWith('--') ? a[0] : 'dist'), mbps = opt('--mbps', '100'), port = +opt('--port', 4182);
const extra = opt('--params', 'norender&seed=1'), min = +opt('--min', 256) * 1024, top = +opt('--top', 40), depth = +opt('--depth', 4);
const here = new URL('.', import.meta.url).pathname;
const srv = spawn(process.execPath, [join(here, 'serve.mjs'), dist, String(port), '/fars/'], { env: { ...process.env, MBPS: mbps }, stdio: ['ignore', 'ignore', 'inherit'] });
process.on('exit', () => { try { srv.kill(); } catch {} });
const host = `http://127.0.0.2:${port}`;
for (let i = 0; i < 50; i++) { try { if ((await fetch(`${host}/fars/`)).ok) break; } catch {} await new Promise(r => setTimeout(r, 200)); }
const prof = mkdtempSync(join(tmpdir(), 'parsa-mem-'));
const ctx = await chromium.launchPersistentContext(prof, { channel: process.env.PW_CHANNEL ?? 'chromium', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--js-flags=--expose-gc'], viewport: { width: 1280, height: 720 } });
await ctx.addInitScript(({ min, depth }) => {
  if (self !== self.top && typeof window !== 'undefined') return; // (the page's main thread only)
  const recs = []; self.__abRecs = recs;
  const site = () => { const s = (new Error().stack ?? '').split('\n').slice(3).filter(l => !/__abWrap|addInitScript/.test(l)).slice(0, depth)
    .map(l => l.trim().replace(/^at /, '').replace(/\(?https?:\/\/[^/]+\/fars\/assets\//, '').replace(/\)$/, '').replace(/:\d+$/, '')); return s.join(' < '); };
  const rec = (buf, how) => { if (buf && buf.byteLength >= min && !buf.__rec) { try { Object.defineProperty(buf, '__rec', { value: 1 }); } catch {} recs.push({ ref: new WeakRef(buf), n: buf.byteLength, site: how + ' ' + site() }); } return buf; };
  const TA = [Float32Array, Float64Array, Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array, Int8Array, Int16Array, Int32Array];
  for (const C of TA) { const P = new Proxy(C, { construct(t, args, nt) { const o = Reflect.construct(t, args, nt); if (!(args[0] instanceof ArrayBuffer)) rec(o.buffer, C.name); return o; } });
    try { self[C.name] = P; } catch {} }
  const TAP = Object.getPrototypeOf(Float32Array.prototype), TAC = Object.getPrototypeOf(Float32Array);
  for (const k of ['slice', 'map', 'filter']) { const f = TAP[k]; TAP[k] = function (...x) { const o = f.apply(this, x); rec(o.buffer, 'TA.' + k); return o; }; }
  for (const k of ['from', 'of']) { const f = TAC[k]; TAC[k] = function (...x) { const o = f.apply(this, x); rec(o?.buffer, 'TA.' + k); return o; }; }
  const sc = self.structuredClone; self.structuredClone = function (v, o) { const r = sc(v, o); try { if (r instanceof ArrayBuffer) rec(r, 'clone'); else if (ArrayBuffer.isView(r)) rec(r.buffer, 'clone'); } catch {} return r; };
  const AB = ArrayBuffer; self.ArrayBuffer = new Proxy(AB, { construct(t, args, nt) { return rec(Reflect.construct(t, args, nt), 'ArrayBuffer'); } });
  const sl = AB.prototype.slice; AB.prototype.slice = function (...x) { return rec(sl.apply(this, x), 'slice'); };
  for (const K of [Response, Blob]) { const f = K.prototype.arrayBuffer; K.prototype.arrayBuffer = function () { return f.call(this).then(b => rec(b, K.name + '.arrayBuffer')); }; }
  // the wasm modules' memories (the physics engine, decoders run on this thread): their size at ready
  const mems = []; self.__wasmMems = mems; const keep = (r, how) => { try { const i = r.instance ?? r; for (const v of Object.values(i.exports ?? {})) if (v instanceof WebAssembly.Memory) mems.push({ m: v, site: how + ' ' + site() }); } catch {} return r; };
  for (const k of ['instantiate', 'instantiateStreaming']) { const f = WebAssembly[k]; WebAssembly[k] = function (...x) { return f.apply(this, x).then(r => keep(r, k)); }; }
  const WI = WebAssembly.Instance; WebAssembly.Instance = new Proxy(WI, { construct(t, args, nt) { return keep(Reflect.construct(t, args, nt), 'Instance'); } });
  const d = Object.getOwnPropertyDescriptor(MessageEvent.prototype, 'data');
  Object.defineProperty(MessageEvent.prototype, 'data', { get() { const v = d.get.call(this); if (this.__seen) return v; this.__seen = 1; const scan = (x, k) => { if (!x || k > 2) return; if (x instanceof AB) rec(x, 'message'); else if (ArrayBuffer.isView(x)) rec(x.buffer, 'message'); else if (Array.isArray(x)) x.forEach(y => scan(y, k + 1)); else if (typeof x === 'object') for (const y of Object.values(x)) scan(y, k + 1); }; try { scan(v, 0); } catch {} return v; } });
}, { min, depth });
const page = ctx.pages()[0] ?? await ctx.newPage(), t0 = Date.now();
await page.goto(`${host}/fars/?quality=high&trace&${extra}`);
await page.waitForFunction(() => window.__parsa?.ready === true || window.__parsa?.error, null, { timeout: 1_800_000, polling: 1000 });
console.log(`ready ${((Date.now() - t0) / 1000).toFixed(1)} s`);
const cdp = await ctx.newCDPSession(page); await cdp.send('HeapProfiler.collectGarbage'); await page.waitForTimeout(2000); await cdp.send('HeapProfiler.collectGarbage');
const out = await page.evaluate(() => { const by = new Map(); let live = 0, all = 0;
  for (const r of self.__abRecs) { all += r.n; if (!r.ref.deref()) continue; live += r.n; const x = by.get(r.site) ?? { n: 0, b: 0 }; x.n++; x.b += r.n; by.set(r.site, x); }
  return { heap: performance.memory?.usedJSHeapSize ?? 0, live, all, sites: [...by].sort((p, q) => q[1].b - p[1].b), wasm: self.__wasmMems.map(x => [x.m.buffer.byteLength, x.site]) }; });
const MB = b => (b / 1048576).toFixed(0).padStart(6);
console.log(`main-thread heap ${MB(out.heap)} MB; recorded buffers live ${MB(out.live)} MB of ${MB(out.all)} MB made`);
for (const [b, s] of out.wasm) console.log(`${MB(b)} MB   wasm memory  ${s.slice(0, 200)}`);
for (const [s, x] of out.sites.slice(0, top)) console.log(`${MB(x.b)} MB ${String(x.n).padStart(5)}x  ${s.slice(0, 230)}`);
await ctx.close(); try { rmSync(prof, { recursive: true, force: true }); } catch {}
process.exit(0);
