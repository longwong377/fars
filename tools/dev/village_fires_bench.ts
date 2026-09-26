// D-254: what the villages' hearths, ovens and lamps cost the fire system's frame (node, CPU only): FireSystem.update with the
// town's fires alone and with the villages' added.   npx tsx tools/dev/village_fires_bench.ts
import * as THREE from 'three/webgpu';
import { FireSystem } from '../../src/world/fire';
import { Settlement } from '../../src/world/settlement/build';
import { loadTerrain, loadRiversFile } from '../../tests/plainLib';
import { buildCanals } from '../../src/world/plain/canals';
import { placeVillages, villageCompounds } from '../../src/world/plain/villages';
import { VillageHouses } from '../../src/world/plain/villagehouses';
const T = loadTerrain();
const run = (withVillages: boolean) => {
  const fire = new FireSystem(12); new Settlement(null, T, fire, 'test'); const town = fire.fires.length;
  if (withVillages) { const R = loadRiversFile(), C = buildCanals(T, R.rivers, 1), V = placeVillages(T, R.rivers, C, 1); new VillageHouses(V, V.map(v => villageCompounds(v, T, 1)), T, null, fire, 1); }
  fire.build();
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.1, 1e5); cam.position.set(-973, T.heightAt(-973, -3287) + 1.6, -3287); cam.updateMatrixWorld();
  for (const [hour, alt] of [[12, 60], [20, -6], [23, -30]]) {
    const ms: number[] = []; for (let i = 0; i < 60; i++) { const t0 = performance.now(); fire.update(1 / 60, cam, alt, 1, 0, 0, i / 60, hour); ms.push(performance.now() - t0); }
    ms.sort((a, b) => a - b); console.log(`${withVillages ? 'town + villages' : 'town only'} at ${hour} h: ${fire.fires.length} fires (town ${town}), lit ${fire.stats().lit}; update median ${ms[30].toFixed(2)} ms, p90 ${ms[54].toFixed(2)} ms`); }
};
run(false); run(true);
