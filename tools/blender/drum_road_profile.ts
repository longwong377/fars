// D-754: the terrain under the drum road (src/arch/drum_road.ts), sampled once from the game's heightfield so the road's
// geometry is built without the terrain at run time: every 2 m along the road's centre line and 3.5 m either side of it.
//   npx tsx tools/blender/drum_road_profile.ts   -> src/arch/drum_road_profile.json
import { readFileSync, writeFileSync } from 'node:fs';
import { Ring, Terrain, TerrainMeta } from '../../src/terrain/heightfield';
import { DRUM_ROAD } from '../../src/arch/drum_road_path';

const meta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
const ring = (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0)), meta.court_asl);
const T = new Terrain(meta, ring('near'), ring('mid'), ring('far'));
const P = DRUM_ROAD.path, out: { s: number; e: number; n: number; h: [number, number, number] }[] = [];
let s0 = 0;
for (let k = 0; k + 1 < P.length; k++) {
  const [a, b] = [P[k], P[k + 1]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], nrm = [-u[1], u[0]];
  for (let s = 0; s < L - 1e-6 || (k === P.length - 2 && s <= L + 1e-6); s += DRUM_ROAD.step) {
    const e = a[0] + u[0] * s, n = a[1] + u[1] * s, H = (o: number) => +T.heightAt(e + nrm[0] * o, -(n + nrm[1] * o)).toFixed(3);
    out.push({ s: +(s0 + s).toFixed(2), e: +e.toFixed(2), n: +n.toFixed(2), h: [H(-DRUM_ROAD.half), H(0), H(DRUM_ROAD.half)] });
  }
  s0 += L;
}
writeFileSync('src/arch/drum_road_profile.json', JSON.stringify({ about: 'D-754: the terrain under the drum road (tools/blender/drum_road_profile.ts): per sample its distance along the road, grid position and the ground at its left edge, centre and right edge (m over the court datum)', terrainHash: (meta as any).hash ?? null, samples: out }) + '\n');
console.log(`[drum_road] ${out.length} samples over ${s0.toFixed(0)} m`);
