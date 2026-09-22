// Typed access to SITE_SPEC (src/data/site_spec.json) and OSM footprints. Generators may use ONLY numbers from here
// (brief §7 "no magic numbers"); every part they emit carries the tier/src of the rows it came from.
import specJson from '../data/site_spec.json';
import fpJson from '../data/geo/footprints.json';
import chronoJson from '../data/chronology.json';

export type Tier = 'A' | 'B' | 'C';
export interface Row<T = any> { v: T; u: string; src: string; tier: string; note: string }
export const SPEC = specJson as any;
export const FOOTPRINTS = fpJson as any as Record<string, { polygon: [number, number][]; bounds: [number, number, number, number]; centroid: [number, number]; area: number }>;
export const CHRONO = chronoJson as any;

export function row<T = number>(building: string, key: string): Row<T> {
  const r = SPEC[building]?.[key];
  if (!r || r.v === undefined) throw new Error(`SITE_SPEC missing ${building}.${key}`);
  return r as Row<T>;
}
export const v = <T = number>(b: string, k: string): T => row<T>(b, k).v;
/** weakest tier among rows (A < B < C) */
export function tierOf(...rows: Row[]): Tier {
  const order = { A: 0, B: 1, C: 2 } as Record<string, number>;
  let worst = 0; for (const r of rows) worst = Math.max(worst, order[r.tier[r.tier.length - 1]] ?? 2);
  return (['A', 'B', 'C'] as Tier[])[worst];
}
export const srcOf = (...rows: Row[]) => [...new Set(rows.flatMap(r => r.src.split(';')))].join(';');
export function present(structureId: string): boolean {
  const s = CHRONO.structures.find((x: any) => x.id === structureId);
  return !!s?.present; // fail-closed
}
export function footprint(key: string) { const f = FOOTPRINTS[key]; if (!f) throw new Error(`no footprint ${key}`); return f; }
