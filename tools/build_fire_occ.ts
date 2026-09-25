// Bake the fire-light occlusion atlas (D-222, B24): every fixed fire of the Terrace (world.ts placeFires via firePlaces.ts)
// gets an octahedral depth tile traced against the architecture's parts (the light probes' ray tracer).
// Output: public/generated/fire_occ.f16 (half floats, OCC_COLS tiles per row) + fire_occ.json (fires, parts hash).
// Rerun after any architecture change or a change to the fires' places: `npx tsx tools/build_fire_occ.ts`
// (tests/fire_occ.test.ts checks the parts hash and the fire list).
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../src/arch/terrace';
import { memberMaterials } from '../src/arch/sculpt';
import { SPEC } from '../src/arch/spec';
import { SURFACES } from '../src/render/materials';
import { traceScene, surfaceTable } from '../src/render/probes/bake';
import { terraceFireLights } from '../src/world/firePlaces';
import { bakeTile, OCC_TILE, OCC_COLS, OCC_FAR } from '../src/world/fireOcc';

const T0 = Date.now();
const { parts, manifest, doorways } = buildTerrace();
const scene = traceScene(parts, surfaceTable(SURFACES as any), (SPEC as any).global.r_column_proportions.v.capital_boxes, p => memberMaterials(p.order));
const fires = terraceFireLights(manifest, parts, doorways);
const rows = Math.ceil(fires.length / OCC_COLS), W = OCC_COLS * OCC_TILE, H = rows * OCC_TILE;
const atlas = new Float32Array(W * H).fill(OCC_FAR);
let inside = 0;
fires.forEach((f, k) => {
  const t = bakeTile(scene, f.pos[0], f.pos[1], f.pos[2]);
  if (!t) { inside++; console.warn(`fire ${k} (${f.kind}) at ${f.pos.join(', ')}: the light is inside a solid; left unoccluded`); return; }
  const ox = (k % OCC_COLS) * OCC_TILE, oy = Math.floor(k / OCC_COLS) * OCC_TILE;
  for (let j = 0; j < OCC_TILE; j++) atlas.set(t.subarray(j * OCC_TILE, (j + 1) * OCC_TILE), (oy + j) * W + ox);
  if (k % 8 === 7) console.log(`${k + 1} / ${fires.length} fires (${((Date.now() - T0) / 1000).toFixed(0)} s)`);
});
const half = new Uint16Array(atlas.length); for (let i = 0; i < atlas.length; i++) half[i] = THREE.DataUtils.toHalfFloat(atlas[i]);
writeFileSync('public/generated/fire_occ.f16', Buffer.from(half.buffer));
const partsHash = createHash('sha1').update(JSON.stringify(parts)).digest('hex').slice(0, 16);
writeFileSync('public/generated/fire_occ.json', JSON.stringify({ tier: 'C', note: 'fire-light occlusion of the Terrace fires (D-222); positions C like the fires', tile: OCC_TILE, cols: OCC_COLS, rows, far: OCC_FAR, partsHash, fires, built: new Date().toISOString().slice(0, 10) }) + '\n');
console.log(`fire occlusion: ${fires.length} fires (${inside} inside a solid), atlas ${W}×${H}, ${((Date.now() - T0) / 1000).toFixed(0)} s`);
