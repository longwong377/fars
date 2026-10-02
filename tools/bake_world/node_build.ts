// s15/load (D-354): the world build in node, traced: buildWorld() with its ?trace stage marks, run without a browser or a
// GPU (fetch served from public/, no renderer). It ranks where the build's CPU time goes on this box (a node mirror of the
// page's build; the page adds its workers and the GPU uploads). Run through the CPU slot:
//   node tools/dev/cpu_slot.mjs load -- npx tsx tools/bake_world/node_build.ts [out.json]
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import './node_env';
import { useNodeCache } from './node_cache';
const out = process.argv[2] ?? 'bench-reports/node_build_trace.json';
// WORLDCACHE=read: the baked units read back (the cached build's node-side time); bake: computed and written; else live
if (process.env.WORLDCACHE === 'read' || process.env.WORLDCACHE === 'bake') useNodeCache(process.cwd(), process.env.WORLDCACHE);
const marks: { stage: string; ms: number; heapMB: number; abMB: number; rssMB: number }[] = [], logs: string[] = [];
const info = console.info.bind(console), warn = console.warn.bind(console);
console.info = (...a: any[]) => { const s = a.map(String).join(' '); const m = /^\[boot\] world:(.+?) (\d+) ms/.exec(s); if (m) { const u = process.memoryUsage(), mb = (x: number) => Math.round(x / 1048576); marks.push({ stage: m[1], ms: +m[2], heapMB: mb(u.heapUsed), abMB: mb(u.arrayBuffers), rssMB: mb(u.rss) }); } logs.push(s.slice(0, 300)); info(...a); };
console.warn = (...a: any[]) => { logs.push('warn ' + a.map(String).join(' ').slice(0, 300)); warn(...a); };
const T0 = performance.now(), step: Record<string, number> = {};
const lap = async <T>(k: string, f: () => Promise<T> | T) => { const t = performance.now(); const v = await f(); step[k] = Math.round(performance.now() - t); return v; };
const THREE = await import('three/webgpu');
// (no scans: loadScans is the page's; in node the materials are their CPU mirrors)
const { Terrain } = await import('../../src/terrain/heightfield');
const terrain = await lap('terrain', () => Terrain.load('/'));
const { Physics } = await import('../../src/player/physics');
const phys = await lap('physics', () => Physics.create());
const { WeatherSystem } = await import('../../src/weather/weatherState');
const weather = new WeatherSystem(+(process.env.SEED ?? (await import('../../src/core/rng')).WORLD_SEED_DEFAULT));
const { buildWorld } = await lap('import world', () => import('../../src/world/world'));
const scene = new THREE.Scene();
let err: string | null = null;
// the page's own settings and seed: the defaults (a first visit), the quality from the query; SEED=<n> another world
const { DEFAULT_SETTINGS } = await import('../../src/core/settings'), { WORLD_SEED_DEFAULT } = await import('../../src/core/rng');
const settings = { ...DEFAULT_SETTINGS, quality: (new URLSearchParams((globalThis as any).location.search).get('quality') ?? 'high') } as any, seed = +(process.env.SEED ?? WORLD_SEED_DEFAULT);
try { await lap('buildWorld', () => buildWorld(scene, phys, terrain, settings, weather, seed)); }
catch (e) { err = String((e as Error).stack ?? e).slice(0, 2000); }
// memory by owner: the bytes of every geometry attribute, index, instance buffer and data texture under each named group
// (three levels down), each buffer counted once (what the GPU will hold for them, before mip maps and render targets)
const seen = new Set<any>(), bytesOf = (a: any) => { const arr = a?.array ?? a?.image?.data; if (!arr?.byteLength || seen.has(arr)) return 0; seen.add(arr); return arr.byteLength; };
const own = (o: any) => { let b = 0; const g = o.geometry; if (g?.attributes) { for (const k in g.attributes) b += bytesOf(g.attributes[k]); b += bytesOf(g.index); for (const k in g.morphAttributes ?? {}) for (const a of g.morphAttributes[k]) b += bytesOf(a); }
  b += bytesOf(o.instanceMatrix) + bytesOf(o.instanceColor);
  for (const m of [o.material].flat()) if (m) for (const k in m) { const t = m[k]; if (t?.isTexture) b += bytesOf(t); } return b; };
const groups: Record<string, number> = {};
scene.traverse((o: any) => { const path: string[] = []; for (let p = o; p && p !== scene; p = p.parent) path.unshift(p.name || p.type); const key = path.slice(0, 3).join('/'); const b = own(o); if (b) groups[key] = (groups[key] ?? 0) + b; });
const memMB = Object.fromEntries(Object.entries(groups).sort((a, b) => b[1] - a[1]).slice(0, 60).map(([k, v]) => [k, +(v / 1048576).toFixed(1)]));
const u = process.memoryUsage(), totalMemMB = { heap: Math.round(u.heapUsed / 1048576), arrayBuffers: Math.round(u.arrayBuffers / 1048576), rss: Math.round(u.rss / 1048576), sceneBuffers: Math.round(Object.values(groups).reduce((a, b) => a + b, 0) / 1048576) };
const res = { totalMs: Math.round(performance.now() - T0), step, marks, totalMemMB, memMB, err, logs: logs.slice(0, 400) };
mkdirSync(dirname(out), { recursive: true }); writeFileSync(out, JSON.stringify(res, null, 1));
console.log(JSON.stringify({ totalMs: res.totalMs, step, totalMemMB, mem: Object.entries(memMB).slice(0, 20), top: [...marks].sort((a, b) => b.ms - a.ms).slice(0, 12), err: err?.slice(0, 600) }, null, 1));
process.exit(err && process.env.WORLDCACHE === "bake" ? 1 : 0); // (a failed bake fails: the site build then says so; the units written before the failure stay good)
