// s18 C2 (lead 3's reset, finish line C): the cloud eyes' "open-to-sky" share of a town view, in node. The same measure as
// renders/_tools/render.mjs (s18-renders-cloud 31f0e69f): a 24 x 14 grid of rays from the view's camera; of the upward faces
// (normal y > 0.7) of the town's meshes they hit, the share lying more than 1.5 m below the highest such hit within 15 m.
// Here the town is the far level everywhere (no near tiles: their ring stands within 72 m of the eye) and nothing else of the
// world stands in front. Usage: npx tsx tools/dev/open_sky_census.ts [view ...]
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { Ring, Terrain, TerrainMeta } from '../../src/terrain/heightfield';
import { Physics } from '../../src/player/physics';
import { FireSystem } from '../../src/world/fire';
import { Settlement } from '../../src/world/settlement/build';
import { loadMonumentsNode } from '../../tests/lib/monuments_node';

export const VIEWS: Record<string, [number, number, number, number, number]> = { // e, n, eye above ground, az true, pitch (renders/_sets/round.json)
  'town-20m': [-320, 862, 20, 135, -11], 'town-200m-noon': [-550, 700, 200, 180, -35], 'intro-town': [-478, -870, 20, 189, -28],
};
export async function openSky(names: string[]) {
  loadMonumentsNode();
  const meta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
  const ring = (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0)), meta.court_asl);
  const T = new Terrain(meta, ring('near'), ring('mid'), ring('far'));
  const P = await Physics.create(); P.updateTerrain(T, { x: 0, y: 0, z: 0 }); const town = new Settlement(P, T, new FireSystem(4), 'high');
  town.group.updateMatrixWorld(true);
  const out: Record<string, any> = {};
  for (const id of names) { const [e, n, eye, az, pitch] = VIEWS[id];
    const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.05, 20000); cam.position.set(e, T.heightAt(e, -n) + eye, -n);
    const a = az * Math.PI / 180, p = pitch * Math.PI / 180; cam.lookAt(e + Math.sin(a) * Math.cos(p) * 100, cam.position.y + Math.sin(p) * 100, -n - Math.cos(a) * Math.cos(p) * 100); cam.updateMatrixWorld(true);
    // the near tiles round the eye (the page's ring: the far level collapses under them in its shader; here a near hit
    // within NEAR_R wins over the far one)
    (town as any).nearUpdate(cam.position.x, cam.position.z, 0, true); town.group.updateMatrixWorld(true);
    const near: THREE.Object3D[] = [], rest: THREE.Object3D[] = []; town.group.traverse(o => { if ((o as THREE.Mesh).isMesh) (/^settlement:near:/.test(o.name) ? near : rest).push(o); });
    const ok = (x: THREE.Intersection) => (x.object as THREE.Mesh).visible && !((x.object as any).material?.transparent);
    const rc = new THREE.Raycaster(), hits: number[][] = [], what: Record<string, number> = {}, N = [24, 14];
    for (let j = 0; j < N[1]; j++) for (let i = 0; i < N[0]; i++) { rc.setFromCamera(new THREE.Vector2(-1 + (2 * i + 1) / N[0], -1 + (2 * j + 1) / N[1]), cam);
      const hn = rc.intersectObjects(near, false).find(ok), hf = rc.intersectObjects(rest, false).find(ok), nearR = (q: THREE.Vector3) => Math.hypot(q.x - cam.position.x, q.z - cam.position.z) < 72;
      const h = hn && (!hf || hn.distance <= hf.distance + 0.5 || nearR(hf.point)) ? hn : hf && nearR(hf.point) && /:far$/.test(hf.object.name) ? undefined : hf;
      if (!h || !h.face) continue; const nm = h.object.name || h.object.parent?.name || ''; const ny = h.face.normal.clone().transformDirection(h.object.matrixWorld).y;
      if (ny > 0.7 && !/ground|road|water|refuse|tree|haze|smoke|canal|channel|bank/i.test(nm)) { hits.push(h.point.toArray()); what[nm] = (what[nm] ?? 0) + 1; } }
    let open = 0; const lows: number[] = []; for (const q of hits) { const top = Math.max(...hits.filter(r => Math.hypot(r[0] - q[0], r[2] - q[2]) < 15).map(r => r[1])); if (top - q[1] > 1.5) { open++; lows.push(+(top - q[1]).toFixed(1)); } }
    out[id] = { openToSky: hits.length ? +(open / hits.length).toFixed(3) : null, samples: hits.length, drops: lows.sort((x, y) => x - y).filter((_, k) => k % Math.max(1, Math.floor(lows.length / 12)) === 0), what };
  }
  return out;
}
if (process.argv[1]?.endsWith('open_sky_census.ts')) openSky(process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(VIEWS)).then(r => console.log(JSON.stringify(r, null, 1)));
