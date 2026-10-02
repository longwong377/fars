// s15/load (D-386): the page memory each asset loader keeps (node; ArrayBuffers after a forced GC), one loader at a time:
//   NODE_OPTIONS=--expose-gc npx tsx tools/bake_world/loaders_mem.ts
import { installNodeEnv } from './node_env';
installNodeEnv(process.cwd());
const gc = (globalThis as any).gc; const ab = () => { gc(); gc(); return Math.round(process.memoryUsage().arrayBuffers / 1048576); };
const keep: any[] = [];
const step = async (name: string, f: () => Promise<any>) => { const a = ab(), t = performance.now(); try { keep.push(await f()); } catch (e) { console.log(name, 'ERR', String(e).slice(0, 100)); } console.log(`${name.padEnd(14)} +${ab() - a} MB  ${(performance.now() - t).toFixed(0)} ms`); };
await import('three/webgpu');
console.log('start', ab());
await step('terrain', async () => (await import('../../src/terrain/heightfield')).Terrain.load('/'));
await step('probes', async () => (await import('../../src/render/probes/runtime')).loadProbes('/'));
await step('sculpt', async () => (await import('../../src/arch/sculpt')).loadSculpt(async p => { const r = await fetch('/' + p); return r.arrayBuffer(); }));
await step('models', async () => (await import('../../src/render/models')).loadModels('/'));
await step('scanProps', async () => (await import('../../src/render/scanProps')).loadScanProps('/'));
await step('monuments', async () => (await import('../../src/render/monuments')).loadMonuments('/'));
await step('trees', async () => (await import('../../src/world/trees/assets')).loadTreeAssets('/'));
await step('life', async () => (await import('../../src/world/lifeModels')).loadLifeModels('/'));
await step('animals', async () => (await import('../../src/people/animalModels')).loadAnimalModels('/'));
await step('reliefAtlas', async () => (await import('../../src/render/reliefAtlas')).loadReliefAtlas('/'));
await step('decor', async () => (await import('../../src/render/decorAssets')).loadDecorAssets('/'));
await step('fireOcc', async () => (await import('../../src/world/fireOcc')).loadFireOcc('/'));
await step('rockKit', async () => (await import('../../src/world/hills/bedrock')).loadRockKit('/'));
await step('ledgeFace', async () => (await import('../../src/world/hills/ledges')).loadLedgeFace('/'));
await step('coverKit', async () => (await import('../../src/world/plain/groundCover')).loadCoverKit('/'));
await step('fordKit', async () => (await import('../../src/world/plain/fordDetail')).loadFordKit('/'));
await step('humans', async () => (await import('../../src/people/humans')).loadHumans({ velocity: true }));
console.log('end', ab()); process.exit(0);
