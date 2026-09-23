// Out-of-world map layers (translation layer, brief §2: "the out-of-world map exists only in the translation layer"):
// what the world actually builds around the Terrace, in grid coordinates (e, n; grid north = 341° true), each item with
// its evidence tier. Sources: the settlement's town plan (plots as built, roads, water), the plain as built (carved river
// courses, canals, villages placed by rule), and every present-in-467 feature of settlement.json and plain.json with a
// point, line or area. Features absent in 467 (present_467 false) are left out, as in the world.
import settlementJson from '../data/settlement.json';
import plainJson from '../data/plain.json';

export type P2 = [number, number];
export type MapStyle = 'zone' | 'field' | 'plot' | 'garden' | 'road' | 'river' | 'canal' | 'village' | 'site' | 'mountain';
export interface MapItem { kind: 'area' | 'line' | 'point'; style: MapStyle; pts: P2[]; tier: string; label?: string; width?: number; id: string }

/** the shapes the builder reads from the built world (kept structural so the UI does not import the world modules) */
export interface BuiltTown { sites: { id: string; meta: { kind: string }; u0: number; v0: number; grid(u: number, v: number): P2; plots: { kind: string; rect: [number, number, number, number] }[] }[]; roads: { id: string; pts: P2[]; width: number }[]; water: { kind: string; pts: P2[]; width: number }[] }
export interface BuiltPlain { rivers: { id: string; x: ArrayLike<number>; y: ArrayLike<number> }[]; canals: { id: string; pts: P2[]; width: number }[]; villages: { id: string; name: string; x: number; y: number; r: number; tier: string }[] }

const parse = (v: unknown): any => (typeof v === 'string' ? JSON.parse(v) : v);
const STYLE_OF: Record<string, MapStyle> = {
  zone_town: 'zone', zone_palace_garden: 'garden', field_zone: 'field', road: 'road', canal: 'canal', river: 'river', village: 'village', mountain: 'mountain',
};
const PLOT_STYLE: Record<string, MapStyle> = { garden: 'garden', yard: 'garden', craft_area: 'plot' };

/** every present feature of the two data files that has a point, line or area */
export function dataItems(): MapItem[] {
  const out: MapItem[] = [];
  for (const f of [...(settlementJson as any).features, ...(plainJson as any).features]) {
    if (f.present_467 !== true) continue;
    const style = STYLE_OF[f.kind] ?? 'site', base = { tier: String(f.tier ?? 'C'), label: f.name ?? f.id, id: f.id };
    if (f.polygon) out.push({ ...base, kind: 'area', style, pts: parse(f.polygon) });
    if (f.polyline) out.push({ ...base, kind: 'line', style, pts: parse(f.polyline), width: f.width_m });
    if (f.polylines) for (const [k, pl] of (parse(f.polylines) as P2[][]).entries()) out.push({ ...base, id: `${f.id}#${k}`, kind: 'line', style, pts: pl });
    if (f.xy && !f.polygon && !f.polyline) out.push({ ...base, kind: 'point', style, pts: [parse(f.xy)] });
  }
  return out;
}

/** the map of the built world: town plots, roads and water as built, the plain's carved rivers, canals and villages, and
 *  the data features (data rivers and roads are replaced by the built ones where those exist) */
export function buildMapLayers(built: { town?: BuiltTown | null; plain?: BuiltPlain | null }): MapItem[] {
  const out: MapItem[] = [];
  const builtRivers = new Set(built.plain?.rivers.map(r => r.id) ?? []), builtRoads = new Set(built.town?.roads.map(r => r.id) ?? []);
  for (const it of dataItems()) {
    const fid = it.id.split('#')[0];
    if (it.style === 'river' && builtRivers.has(fid)) continue;
    if (it.style === 'road' && builtRoads.has(fid)) continue;
    if (it.style === 'village' && built.plain) continue; // the built villages carry the data villages (moved onto suitable ground)
    out.push(it);
  }
  if (built.town) {
    for (const s of built.town.sites) for (const p of s.plots) {
      const [i0, j0, i1, j1] = p.rect, g = (i: number, j: number) => s.grid(s.u0 + i, s.v0 + j);
      out.push({ kind: 'area', style: PLOT_STYLE[p.kind] ?? 'plot', pts: [g(i0, j0), g(i1, j0), g(i1, j1), g(i0, j1)], tier: 'C', id: `${s.id}:${p.kind}` });
    }
    for (const r of built.town.roads) out.push({ kind: 'line', style: 'road', pts: r.pts, width: r.width, tier: 'C', id: r.id });
    for (const w of built.town.water) if (w.pts.length > 1) out.push({ kind: 'line', style: 'canal', pts: w.pts, width: w.width, tier: 'C', id: `town-${w.kind}` });
  }
  if (built.plain) {
    for (const r of built.plain.rivers) { const pts: P2[] = []; for (let i = 0; i < r.x.length; i += 4) pts.push([r.x[i], r.y[i]]); out.push({ kind: 'line', style: 'river', pts, tier: 'C', id: r.id, label: undefined }); }
    for (const c of built.plain.canals) out.push({ kind: 'line', style: 'canal', pts: c.pts, width: c.width, tier: 'C', id: c.id });
    for (const v of built.plain.villages) out.push({ kind: 'point', style: 'village', pts: [[v.x, v.y]], tier: v.tier, label: v.name, id: v.id });
  }
  return out;
}

/** the plain build's data (PlainBuild.data: rivers is a RiversData object with a `rivers` list) → BuiltPlain */
export function builtPlainOf(d: { rivers: { rivers: BuiltPlain['rivers'] } | BuiltPlain['rivers']; canals: BuiltPlain['canals']; villages: BuiltPlain['villages'] } | null | undefined): BuiltPlain | null {
  if (!d) return null;
  return { rivers: Array.isArray(d.rivers) ? d.rivers : d.rivers.rivers, canals: d.canals, villages: d.villages };
}

/** map zoom levels: the Terrace (fixed frame), the town around the visitor, the plain around the visitor */
export const MAP_ZOOMS = [
  { name: 'Terrace', half: 0, bar: 50 },
  { name: 'town and gardens', half: 3500, bar: 1000 },
  { name: 'plain', half: 24000, bar: 5000 },
] as const;
