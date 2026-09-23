// Shared loader for the plain tests: the generated terrain rings and river profiles, read from public/generated.
import { readFileSync } from 'node:fs';
import { Ring, Terrain, TerrainMeta } from '../src/terrain/heightfield';
import { parseRivers } from '../src/world/plain/data';

export function loadTerrain(): Terrain {
  const meta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
  const ring = (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0) as ArrayBuffer), meta.court_asl);
  return new Terrain(meta, ring('near'), ring('mid'), ring('far'));
}
export const loadRiversFile = () => parseRivers(JSON.parse(readFileSync('public/generated/rivers.json', 'utf8')));
