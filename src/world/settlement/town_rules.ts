// Numbers behind the reconstructed town (Phase 6). No house has been excavated at Persepolis (research/SETTLEMENT.md),
// so every value here is tier C. The house TYPE follows the first-millennium Babylonian courtyard house (BAKER2014, with
// Reuther 1926 on the Merkes quarter of Babylon, via search extracts: B for the analogue, C for its use here): a central
// court with suites of rooms on all four sides "although occasionally rooms on only three, or even two sides", a single
// entrance from the street opening onto a vestibule "configured to prevent direct visual access", streets wide and
// narrow with blind alleys giving access to houses. Babylon lay inside the empire and its quarters were lived in
// through the Achaemenid period. Sizes are judgement (C) and flagged as such in the dev overlay and town_plots.json.
import type { Plot } from './site';

export const HOUSE = {
  /** plot frontage and depth (m) for ordinary houses (C) */
  plotW: [8, 16] as [number, number], plotD: [10, 20] as [number, number],
  minSide: 5, minArea: 40, largeArea: 240,
  /** room depth (m): the span of poplar roof poles (C) */
  roomDepth: [3, 4] as [number, number], roomLen: [3, 5] as [number, number],
  /** roof top above the plot's ground (m): ceiling 2.7-3.2 + roof slab (C) */
  roofTop: [3.1, 3.6] as [number, number], parapet: 0.45, yardWall: 2.2, penWall: 1.4, outerT: 0.7,
  /** share of houses with a hearth / a bread oven / a tree in the court (C) */
  hearthShare: 0.65, ovenShare: 0.22, courtTreeShare: 0.12,
  /** roofed floor area per resident (m²), C: sets capacities (a household of 4-7 in 60-100 m² of rooms) */
  m2PerPerson: 13,
};
export const HOUSE_BASIS = 'Babylonian courtyard-house type (BAKER2014 with Reuther 1926, search extracts: court with rooms on 2-4 sides, one street door into a bent-axis vestibule, blind alleys): B analogue, C here; sizes, heights, room depths and capacities are judgement (C); no house excavated at Persepolis (SETTLEMENT.md)';

/** people a plot can house (C). Workshops keep a family in part of the rooms; yards and pens house nobody. */
export function capacityFor(p: Plot): number {
  switch (p.kind) {
    case 'house': return Math.max(3, Math.min(10, Math.round(p.roofed / HOUSE.m2PerPerson)));
    case 'house_large': return Math.max(6, Math.min(16, Math.round(p.roofed / HOUSE.m2PerPerson)));
    case 'workshop': return Math.max(2, Math.min(6, Math.round(p.roofed / (HOUSE.m2PerPerson * 2))));
    case 'elite': return p.capacity || 25;
    case 'official': case 'store': case 'stable': case 'station': case 'craft_area': return p.capacity;
    default: return 0;
  }
}

/** Seasonal leaf state of deciduous garden trees (C): leaf-out in April, full May-October, fall in November (Fars:
 *  winter frost, 44 frost days a year, plain.json). Keyed by Gregorian day of year like season.ts. */
export const LEAF_TABLE: { doy: number; leaf: number }[] = [
  { doy: 0, leaf: 0 }, { doy: 80, leaf: 0.05 }, { doy: 105, leaf: 0.6 }, { doy: 125, leaf: 1 }, { doy: 290, leaf: 1 }, { doy: 320, leaf: 0.4 }, { doy: 340, leaf: 0 }, { doy: 366, leaf: 0 },
];
export function leafAt(doy: number) {
  const d = ((doy % 365) + 365) % 365;
  for (let i = 1; i < LEAF_TABLE.length; i++) { const a = LEAF_TABLE[i - 1], b = LEAF_TABLE[i]; if (d <= b.doy) return a.leaf + (b.leaf - a.leaf) * (d - a.doy) / (b.doy - a.doy); }
  return 0;
}
