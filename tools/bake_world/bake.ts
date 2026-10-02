// s14/load (D-354), s15 (D-386): bake the world cache in node. The world is built in node exactly as the page builds it
// (node_env.ts: fetch from public/, the Draco and KTX2 decoders in-thread, canvases and images as stand-ins) with the
// cache's collector on (src/world/cache/worldCache.ts): every unit the build computes (the town plan, the mud-brick faces,
// the fill, the grime map, the fords, the hills' landform maps, the far people's atlas) is packed as it is made; then the
// units only reachable outside the build (units.ts: the fitted costumes, which the page fits in a worker) are computed; each
// is written to public/world-cache/ with its source hash (regenerable like `npm run terrain`, not in git; GitHub Actions
// runs this before `vite build`: .github/workflows/world-bake.yml).
//   npx tsx tools/bake_world/bake.ts [unit,...]      (NODE_OPTIONS=--max-old-space-size=8000 for the whole world)
import { installNodeEnv } from './node_env';
import { sourceHashes } from './srchash.mjs';
import { writeEntry } from './vite_plugin.mjs';
import { nodeUnits } from './units';
import { pack } from '../../src/world/cache/pack';
import { collectWorldCache } from '../../src/world/cache/worldCache';

const only: string[] | undefined = process.argv[2]?.split(','), root = process.cwd(), src = sourceHashes(root) as Record<string, string>;
installNodeEnv(root);
const T0 = performance.now(), got = new Map<string, Uint8Array>(), log: string[] = [];
const say = (s: string) => { log.push(s); console.log(s); };
// quiet the build's own chatter (the bake prints what it wrote)
const info = console.info, warn = console.warn; console.info = () => {}; console.warn = (...a: any[]) => { if (/world-cache/.test(String(a[0]))) warn(...a); };
collectWorldCache(got);
{ const THREE = await import('three/webgpu');
  const { Terrain } = await import('../../src/terrain/heightfield'), { Physics } = await import('../../src/player/physics'), { WeatherSystem } = await import('../../src/weather/weatherState');
  const { buildWorld } = await import('../../src/world/world');
  const terrain = await Terrain.load('/'), phys = await Physics.create(), t = performance.now();
  await buildWorld(new THREE.Scene(), phys, terrain, { quality: 'high' } as any, new WeatherSystem(1), 1);
  say(`world built in node: ${((performance.now() - t) / 1000).toFixed(1)} s, ${got.size} units collected`); }
collectWorldCache(null); console.info = info; console.warn = warn;
for (const u of nodeUnits(root)) { const k = `${u.unit}|${u.key}`; if (got.has(k) || (only && !only.includes(u.unit))) continue;
  const t = performance.now(); got.set(k, pack(await u.compute())); say(`${k}: built ${(performance.now() - t).toFixed(0)} ms`); }
let n = 0;
for (const [k, b] of got) { const [unit, ...rest] = k.split('|'), key = rest.join('|');
  if (only && !only.includes(unit)) continue;
  if (!src[unit]) { say(`${k}: not a unit in units.json (skipped)`); continue; }
  say(`${k}: ${(b.length / 1048576).toFixed(2)} MB -> ${writeEntry(root, unit, key, src[unit], b)}`); n++; }
say(`baked ${n} entries in ${((performance.now() - T0) / 1000).toFixed(1)} s`);
process.exit(0);
