// s15/load (D-354): the world build in node, traced: buildWorld() with its ?trace stage marks, run without a browser or a
// GPU (fetch served from public/, no renderer). It ranks where the build's CPU time goes on this box (a node mirror of the
// page's build; the page adds its workers and the GPU uploads). Run through the CPU slot:
//   node tools/dev/cpu_slot.mjs load -- npx tsx tools/bake_world/node_build.ts [out.json]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { installNodeEnv, nodeEnvStats } from './node_env';
const out = process.argv[2] ?? 'bench-reports/node_build_trace.json';
installNodeEnv(process.cwd());
// WORLDCACHE=1 (D-386): the build reads the baked world (public/world-cache/) as the page does; else every unit is built live
if (process.env.WORLDCACHE) { (globalThis as any).__worldCacheOn = true; const { sourceHashes } = await import('./srchash.mjs'), h = JSON.stringify(sourceHashes(process.cwd())), f0 = (globalThis as any).fetch;
  (globalThis as any).fetch = (u: any, i?: any) => (/world-cache\/src\.json/.test(String(u?.url ?? u)) ? Promise.resolve(new Response(h, { status: 200 })) : f0(u, i)); }
const images = nodeEnvStats.images;
// MEMSITES=1 (s15, D-386): every typed array of >= 256 kB made during the build, by the call site that made it, live bytes at the
// end (a FinalizationRegistry subtracts the collected): who holds the arrays the scene does not
const sites = new Map<string, { n: number; live: number }>();
if (process.env.MEMSITES) { const fr = new FinalizationRegistry<[string, number]>(([k, b]) => { const e = sites.get(k); if (e) { e.live -= b; e.n--; } });
  const site = () => (new Error().stack ?? '').split('\n').slice(3, 30).map(l => l.trim().replace(/^at /, '').replace(/\(?file:\/\/[^)]*\/(src|tools|node_modules)\//, '$1/').replace(/\)$/, '')).filter(l => !/node_modules\/three|node:internal|^new |^Function\.from|^\w+Array\./.test(l)).slice(0, 3).join(' < ');
  for (const name of ['Float32Array', 'Float64Array', 'Uint8Array', 'Uint8ClampedArray', 'Int8Array', 'Uint16Array', 'Int16Array', 'Uint32Array', 'Int32Array']) {
    const B = (globalThis as any)[name]; const C = class extends B { constructor(...a: any[]) { super(...a); if (this.byteLength >= 262144 && !(a[0] instanceof ArrayBuffer || (typeof SharedArrayBuffer !== 'undefined' && a[0] instanceof SharedArrayBuffer))) { const k = `${name} @ ${site()}`, e = sites.get(k) ?? { n: 0, live: 0 }; e.n++; e.live += this.byteLength; sites.set(k, e); fr.register(this, [k, this.byteLength]); } } };
    Object.defineProperty(C, 'name', { value: name }); (globalThis as any)[name] = C; } }
// (s15, D-386: every wasm memory made (the decoders' heaps) and every fetched body, by file: what the page holds besides the scene)
const wasmMems: { m: WeakRef<WebAssembly.Memory>; at: string; MB: number }[] = [], fetched: Record<string, number> = {};
{ const WA = WebAssembly as any, inst = WA.instantiate.bind(WA); WA.instantiate = async (...a: any[]) => { const r = await inst(...a); const i = r.instance ?? r; for (const v of Object.values(i.exports ?? {})) if (v instanceof WebAssembly.Memory) wasmMems.push({ m: new WeakRef(v), MB: 0, at: new Error().stack!.split('\n').slice(2, 5).join(' < ').slice(0, 200) }); return r; };
  const f = (globalThis as any).fetch; (globalThis as any).fetch = async (u: any, i?: any) => { const r: Response = await f(u, i); const k = String(u?.url ?? u).replace(/^https?:\/\/[^/]+/, ''), ab = r.arrayBuffer.bind(r); (r as any).arrayBuffer = async () => { const b = await ab(); fetched[k] = (fetched[k] ?? 0) + b.byteLength; return b; }; return r; }; }
const marks: { stage: string; ms: number; heapMB: number; abMB: number; rssMB: number }[] = [], logs: string[] = [];
const info = console.info.bind(console), warn = console.warn.bind(console);
console.info = (...a: any[]) => { const s = a.map(String).join(' '); const m = /^\[boot\] world:(.+?) (\d+) ms$/.exec(s); if (m) { (globalThis as any).gc?.(); const u = process.memoryUsage(), mb = (x: number) => Math.round(x / 1048576); marks.push({ stage: m[1], ms: +m[2], heapMB: mb(u.heapUsed), abMB: mb(u.arrayBuffers), rssMB: mb(u.rss) }); } logs.push(s.slice(0, 300)); info(...a); };
console.warn = (...a: any[]) => { logs.push('warn ' + a.map(String).join(' ').slice(0, 300)); warn(...a); };
const T0 = performance.now(), step: Record<string, number> = {};
const lap = async <T>(k: string, f: () => Promise<T> | T) => { const t = performance.now(); const v = await f(); step[k] = Math.round(performance.now() - t); return v; };
// HEAPSAMPLE=1 (s15, D-386): V8's sampling heap profiler over the build: the live JS objects at the end by the src/ function that
// allocated them (bottom-up)
let heapSession: any = null;
if (process.env.HEAPSAMPLE) { const { Session } = await import('node:inspector'); heapSession = new Session(); heapSession.connect();
  await new Promise<void>(r => heapSession.post('HeapProfiler.startSampling', { samplingInterval: 16384 }, () => r())); }
const THREE = await import('three/webgpu');
// (no scans: loadScans is the page's; in node the materials are their CPU mirrors)
const { Terrain } = await import('../../src/terrain/heightfield');
const terrain = await lap('terrain', () => Terrain.load('/'));
const { Physics } = await import('../../src/player/physics');
const phys = await lap('physics', () => Physics.create());
const { WeatherSystem } = await import('../../src/weather/weatherState');
const weather = new WeatherSystem(1);
const { buildWorld } = await lap('import world', () => import('../../src/world/world'));
const scene = new THREE.Scene();
let err: string | null = null;
try { await lap('buildWorld', () => buildWorld(scene, phys, terrain, { quality: 'high' } as any, weather, 1)); }
catch (e) { err = String((e as Error).stack ?? e).slice(0, 2000); }
// memory by owner: the bytes of every geometry attribute, index, instance buffer and data texture under each named group
// (three levels down), each buffer counted once (what the GPU will hold for them, before mip maps and render targets)
const seen = new Set<any>(), bytesOf = (a: any) => { const arr = a?.array ?? a?.image?.data; if (!arr?.byteLength || seen.has(arr)) return 0; seen.add(arr); return arr.byteLength; };
const own = (o: any) => { let b = 0; const g = o.geometry; if (g?.attributes) { for (const k in g.attributes) b += bytesOf(g.attributes[k]); b += bytesOf(g.index); for (const k in g.morphAttributes ?? {}) for (const a of g.morphAttributes[k]) b += bytesOf(a); }
  b += bytesOf(o.instanceMatrix) + bytesOf(o.instanceColor);
  for (const m of [o.material].flat()) if (m) for (const k in m) { const t = m[k]; if (t?.isTexture) b += bytesOf(t); } return b; };
const groups: Record<string, number> = {}, units: Record<string, number> = {}, kinds: Record<string, number> = {};
// (s15, D-386: by unit, the scene's top-level groups; and by kind of array: which attribute, index, instance data or texture)
const kind = (o: any) => { const g = o.geometry; if (g?.attributes) for (const k in g.attributes) { const a = g.attributes[k], arr = a?.array; if (arr?.byteLength && !kseen.has(arr)) { kseen.add(arr); const t = `${k} ${arr.constructor.name}x${a.itemSize}`; kinds[t] = (kinds[t] ?? 0) + arr.byteLength; } }
  if (g?.index?.array && !kseen.has(g.index.array)) { kseen.add(g.index.array); const t = `index ${g.index.array.constructor.name}`; kinds[t] = (kinds[t] ?? 0) + g.index.array.byteLength; }
  for (const a of [o.instanceMatrix, o.instanceColor]) if (a?.array && !kseen.has(a.array)) { kseen.add(a.array); kinds['instance data'] = (kinds['instance data'] ?? 0) + a.array.byteLength; } }, kseen = new Set<any>();
scene.traverse((o: any) => { const path: string[] = []; for (let p = o; p && p !== scene; p = p.parent) path.unshift(p.name || p.type); const key = path.slice(0, 3).join('/'); kind(o); const b = own(o); if (b) { groups[key] = (groups[key] ?? 0) + b; const u = path.slice(0, 2).join('/'); units[u] = (units[u] ?? 0) + b; } });
const unitMB = Object.fromEntries(Object.entries(units).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / 1048576).toFixed(1)]));
const kindMB = Object.fromEntries(Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, +(v / 1048576).toFixed(1)]));
const memMB = Object.fromEntries(Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 60).map(([k, v]) => [k, +(v / 1048576).toFixed(1)]));
(globalThis as any).gc?.(); const u = process.memoryUsage(), totalMemMB = { heap: Math.round(u.heapUsed / 1048576), arrayBuffers: Math.round(u.arrayBuffers / 1048576), rss: Math.round(u.rss / 1048576), sceneBuffers: Math.round(Object.values(groups).reduce((a, b) => a + b, 0) / 1048576), imagesDecodedMade: Math.round([...images.values()].reduce((a, b) => a + b, 0) / 1048576), canvases: Math.round(nodeEnvStats.canvasBytes / 1048576) };
const live = wasmMems.map(w => w.m.deref()).filter(Boolean) as WebAssembly.Memory[];
const wasmMB = { made: wasmMems.length, live: live.length, liveMB: Math.round(live.reduce((a, m) => a + m.buffer.byteLength, 0) / 1048576), sizesMB: live.map(m => Math.round(m.buffer.byteLength / 1048576)) }, fetchedMB = Object.fromEntries(Object.entries(fetched).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => [k, +(v / 1048576).toFixed(1)]));
const sitesMB = [...sites].filter(([, e]) => e.live > 0).sort((a, b) => b[1].live - a[1].live).slice(0, 60).map(([k, e]) => [+(e.live / 1048576).toFixed(1), e.n, k]);
// what the page drops once uploaded (world/cache/release.ts): compressed textures' mips and DataTextures marked release; and
// the decoded images by file (ImageBitmaps: kept by their textures unless closed)
const relSeen = new Set<any>(); let releasable = 0;
scene.traverse((o: any) => { for (const m of [o.material].flat()) if (m) for (const k in m) { const t = m[k]; if (!t?.isTexture || relSeen.has(t)) continue; relSeen.add(t);
  if (t.isCompressedTexture) for (const q of t.mipmaps ?? []) releasable += q?.data?.byteLength ?? 0;
  else if (t.userData?.release && !t.userData?.keepData) { releasable += t.image?.data?.byteLength ?? 0; for (const q of t.mipmaps ?? []) releasable += q?.data?.byteLength ?? 0; } } });
const imagesTop = [...images].sort((a, b) => b[1] - a[1]).slice(0, 30).map(([k, v]) => [k.replace(/^https?:\/\/[^/]+/, ''), +(v / 1048576).toFixed(1)]);
let heapTop: [number, string][] = [];
if (heapSession) { (globalThis as any).gc?.(); const prof: any = await new Promise(r => heapSession.post('HeapProfiler.stopSampling', (_e: any, p: any) => r(p.profile)));
  const by = new Map<string, number>(); const walk = (n: any, path: string[]) => { const f = n.callFrame, here = /\/src\//.test(f.url) ? `${f.functionName || '(anon)'} ${f.url.replace(/^.*\/src\//, 'src/')}:${f.lineNumber + 1}` : null;
    const p2 = here ? [...path, here] : path; if (n.selfSize && p2.length) { const k = p2.slice(-2).join(' < '); by.set(k, (by.get(k) ?? 0) + n.selfSize); } for (const c of n.children ?? []) walk(c, p2); };
  walk(prof.head, []); heapTop = [...by].sort((a, b) => b[1] - a[1]).slice(0, 50).map(([k, v]) => [+(v / 1048576).toFixed(1), k]); }
// the scene's content hash (every mesh's geometry arrays, instance data and transform, by path): a live build and a build from
// the baked world must agree (D-386)
const { hashBytes } = await import('../../src/world/cache/pack');
const sceneParts: string[] = []; { const v = (a: any) => (a?.byteLength ? hashBytes(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)) : '-');
  scene.traverse((o: any) => { const path: string[] = []; for (let p = o; p && p !== scene; p = p.parent) path.unshift(p.name || p.type); const g = o.geometry; if (!g?.attributes) return;
    sceneParts.push(path.join('/') + ':' + Object.keys(g.attributes).sort().map(k => k + '=' + v(g.attributes[k].array)).join(',') + ':i=' + v(g.index?.array) + ':m=' + v(o.instanceMatrix?.array) + ':' + o.matrixWorld.elements.map((x: number) => x.toFixed(4)).join(',')); }); }
sceneParts.sort(); const sceneHash = hashBytes(new TextEncoder().encode(sceneParts.join('\n')));
const { cacheStats } = await import('../../src/world/cache/worldCache');
const res = { sceneHash, meshes: sceneParts.length, cacheStats, heapTop, releasableMB: Math.round(releasable / 1048576), imagesTop, sitesMB, wasmMB, fetchedTotalMB: Math.round(Object.values(fetched).reduce((a, b) => a + b, 0) / 1048576), fetchedMB, totalMs: Math.round(performance.now() - T0), step, marks, totalMemMB, unitMB, kindMB, memMB, err, logs: logs.slice(0, 400) };
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(res, null, 1));
console.log(JSON.stringify({ sceneHash, meshes: sceneParts.length, cacheStats, releasableMB: res.releasableMB, wasmMB, fetchedTotalMB: res.fetchedTotalMB, totalMs: res.totalMs, step, totalMemMB, units: unitMB, kinds: kindMB, mem: Object.entries(memMB).slice(0, 20), top: [...marks].sort((a, b) => b.ms - a.ms).slice(0, 12), err: err?.slice(0, 600) }, null, 1));
process.exit(0);
