// s14/load (D-354): the baked world's units computed in node, exactly as the page computes them (the same functions and
// inputs; the page's worker posts { NV, pieceBase, source, costumes, ms } of the outfits). Used by bake.ts and the test.
import { existsSync } from 'node:fs';
import { installFileFetch } from './node_fetch';
import { Terrain } from '../../src/terrain/heightfield';
import { bakeTerrainDetail } from '../../src/terrain/terrainDetail';
import { decodeHumanAssets, meshoptSimplify, HUMANS_DIR } from '../../src/people/humanAssets';
import { buildOutfits } from '../../src/people/outfits';
import { loadPeopleModels } from '../../src/people/peopleModels';

export type NodeUnit = { unit: string; key: string; compute: () => Promise<unknown> };
export function nodeUnits(root = process.cwd()): NodeUnit[] {
  installFileFetch(root);
  return [
    { unit: 'detail', key: 'rings', compute: async () => bakeTerrainDetail(await Terrain.load('/')) },
    { unit: 'outfits', key: 'all', compute: async () => {
      const meta = await (await fetch(`/${HUMANS_DIR}/humans.json`)).json(), bin = await (await fetch(`/${HUMANS_DIR}/humans.bin`)).arrayBuffer();
      const pm = await loadPeopleModels('/');
      // the page passes the hair cards only when their atlas loads (a texture: in node, when its file is there)
      const models = { cards: pm.atlasUrl && existsSync(`${root}/public${pm.atlasUrl}`) ? pm.cards : null, drape: pm.drape };
      const { MeshoptSimplifier } = await import('three/addons/libs/meshopt_simplifier.module.js'); await MeshoptSimplifier.ready;
      const O = buildOutfits(decodeHumanAssets(meta, bin), { simplify: meshoptSimplify(MeshoptSimplifier), models });
      return { NV: O.NV, pieceBase: O.pieceBase, source: O.source, costumes: O.costumes, ms: O.ms }; } },
  ];
}
