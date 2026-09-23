// Tree species of the plain and the town gardens (src/data/trees.json): presence tier and source per species, form
// values (height, crown width and base, trunk, stems, crown shape, branching habit, leaf) all C (BOTANY-GEN, recalled).
// The generator (model.ts) builds every tree from these numbers; tests/trees.test.ts measures the built trees against them.
import treesJson from '../../data/trees.json';
import { TREE_GROUPS, type TreeGroup } from '../plain/seasonal';

export type Envelope = { shape: 'dome' | 'rounded' | 'ovoid' | 'column' | 'cone' | 'vase'; widest: number; top: number; bottom: number };
export interface Species {
  id: string; name: string; group: TreeGroup; tier: string; src: string; note: string;
  presence: { tier: string; src: string; note: string };
  height_m: [number, number]; crown_width_ratio: [number, number]; crown_base_ratio: [number, number]; dbh_ratio: number; stems: [number, number];
  habit: 'excurrent' | 'decurrent'; envelope: Envelope; limbs: [number, number]; limb_angle_deg: number; droop: number;
  leaf: { tile: string; size_cm: number; layers: number }; twig_tile: string; blossom_tile: string | null; bark: [number, number, number];
  /** share of the cards that show a bare-twig spray when they carry no leaf or blossom (C) */ twig_cards: number;
  /** leaf-cluster card shape (C): height/width at the same area, turn of its axis to the vertical, clump shading weight */ card: { aspect: number; up: number; clump: number };
}
export const TREES: { _meta: any; species: Species[] } = treesJson as any;
export const SPECIES: Species[] = TREES.species;
export const SPECIES_IDS = SPECIES.map(s => s.id);
export type SpeciesId = string;
export const speciesIndex = (id: string) => { const i = SPECIES_IDS.indexOf(id); if (i < 0) throw new Error(`trees.json: no species ${id}`); return i; };
export const species = (id: string) => SPECIES[speciesIndex(id)];
export const groupIndex = (g: TreeGroup) => TREE_GROUPS.indexOf(g);
/** reference size of a species model: the middle of its height range and crown width / base ratios */
export function refForm(s: Species) {
  const H = (s.height_m[0] + s.height_m[1]) / 2, wr = (s.crown_width_ratio[0] + s.crown_width_ratio[1]) / 2, cb = (s.crown_base_ratio[0] + s.crown_base_ratio[1]) / 2;
  return { H, W: H * wr, CB: H * cb, wr, cb };
}
/** dev-overlay record of a species (F3): the lowest of presence and form tiers, both sources */
export function speciesTag(s: Species, where: string) {
  const tiers = [s.presence.tier, s.tier].sort(); const tier = tiers[tiers.length - 1]; // 'C' > 'B' > 'A': the weakest link
  return { tier, src: `${s.presence.src};${s.src}`, note: `${s.name} (${where}): presence ${s.presence.tier} (${s.presence.note}); form C: ${s.note}; height ${s.height_m[0]}-${s.height_m[1]} m, crown ${s.crown_width_ratio[0]}-${s.crown_width_ratio[1]} x height` };
}
