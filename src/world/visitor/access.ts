// Visitor mode (brief §1: "the player is a traveller carrying a sealed travel authorisation. Access follows
// period-plausible rules, and guards stop you where they would have"): which access zone a point is in, and what its
// rule asks of the visitor now. Data: src/data/access.json (research/ACCESS.md; D-100 … D-104). No text describes anyone
// being stopped at Persepolis, so every Terrace rule is C; the only attested check is at the ration point (the halmi, B).
// Pure functions (node-testable); the town part reads the built town plan (plot rectangles and their town-element rows).
import accessJson from '../../data/access.json';
import settlementJson from '../../data/settlement.json';
import placesJson from '../../data/people_places.json';
import plainJson from '../../data/plain.json';
import { FOOTPRINTS, present, v } from '../../arch/spec';
import { pointInPolygon, distToPolyline } from '../plain/data';

export type Rule = 'open' | 'business' | 'escort' | 'closed' | 'none';
export interface AccessZone {
  id: string; kind: 'terrace' | 'terrace_approach' | 'town' | 'plain'; rule: Rule; night: Rule; court_resident: Rule; checked_at: string[];
  recognised_rule?: Rule; tier: string; src: string; note: string;
}
type P2 = [number, number];
const A: any = accessJson;
export const ZONES = new Map<string, AccessZone>((A.zones as AccessZone[]).map(z => [z.id, z]));
const place = (id: string): P2 => ((placesJson as any).places.find((p: any) => p.id === id)?.at ?? [NaN, NaN]) as P2;
const parse = (x: unknown): any => (typeof x === 'string' ? JSON.parse(x) : x);

/** town-element row (settlement.json town_elements, the built plan's Plot.row) → access zone, read from the zones' refs */
export const ROW_ZONE: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const z of A.zones as any[]) {
    if (z.kind !== 'town' && z.kind !== 'plain') continue;
    const m = /town_elements:\s*([^;]+)/.exec(z.ref ?? ''); if (!m) continue;
    for (const id of m[1].replace(/\([^)]*\)/g, '').split(',').map((s: string) => s.trim()).filter(Boolean)) out[id] = z.id;
  }
  return out;
})();

// ---------------------------------------------------------------------------------------------------------- the Terrace
/** Terrace buildings whose footprint is their zone (present in 467 only) */
const BUILDING_ZONES = ['grand_stair', 'gate_nations', 'apadana', 'tachara', 'hadish', 'harem', 'tripylon', 'hall100', 'treasury', 'garrison'];
/** the ~12 m street between the Hall of 100 Columns and the Treasury: from the Treasury's N wall (site_spec, B) to the
 *  hall's S wall, across the Treasury's width; the OSM Treasury footprint includes it, so it is tested first */
const TREASURY_STREET = (() => { const y0 = v<number>('treasury', 'r_north_wall_y'), b = FOOTPRINTS.treasury?.bounds; return b ? { x0: b[0], x1: b[2], y0, y1: y0 + 12 } : null; })();
const TREASURY_DESK = { at: place('treasury_desk'), r: 8 }; // the scribes' room (C: a radius around the place)
const PF_BASTION = ((A.zones as any[]).find(z => z.id === 'pf_archive_findspot')?.ref_vertices ?? []) as P2[];

export function terraceZoneAt(e: number, n: number): string | null {
  const T = FOOTPRINTS.terrace; const onTerrace = T && pointInPolygon(e, n, T.polygon);
  if (Math.hypot(e - TREASURY_DESK.at[0], n - TREASURY_DESK.at[1]) < TREASURY_DESK.r) return 'treasury_desk';
  if (TREASURY_STREET && e >= TREASURY_STREET.x0 && e <= TREASURY_STREET.x1 && n >= TREASURY_STREET.y0 && n <= TREASURY_STREET.y1) return 'treasury_street';
  // the Gate is a square hall: its zone is its bounding rectangle (the traced polygon is skewed by ~0.5 m, which left a
  // sliver of 'courts' between the landing and the W door)
  const GB = FOOTPRINTS.gate_nations?.bounds; if (GB && present('gate_nations') && e >= GB[0] && e <= GB[2] && n >= GB[1] && n <= GB[3]) return 'gate_nations';
  for (const b of BUILDING_ZONES) { const f = FOOTPRINTS[b]; if (f && present(b) && pointInPolygon(e, n, f.polygon)) return b; }
  if (PF_BASTION.length > 2 && pointInPolygon(e, n, PF_BASTION)) return 'pf_archive_findspot';
  // the landing at the stair heads, in front of the Gate's W door: part of the stair (the Gate is 'the only entrance to the
  // terrace', ISAC-PA, B), not the courts beyond it; the stair-head guards watch here (C: the Terrace W of the Gate, level with it)
  const G = FOOTPRINTS.gate_nations?.bounds; if (onTerrace && G && e < G[0] && n > G[1] - 15 && n < G[3] + 15) return 'grand_stair';
  return onTerrace ? 'terrace_courts' : null;
}

// ------------------------------------------------------------------------------------------------ the town and the plain
/** the built town, as far as the zones need it (Settlement.plan satisfies it) */
export interface TownLike { sites: { id: string; meta: { kind: string }; W: number; H: number; u0: number; v0: number; grid(u: number, v: number): P2; plots: { kind: string; row: string; rect: [number, number, number, number] }[] }[] }
export interface TownIndex { plots: { poly: P2[]; zone: string; bb: [number, number, number, number] }[]; quarters: { poly: P2[]; bb: [number, number, number, number] }[] }
const bbox = (poly: P2[]): [number, number, number, number] => [Math.min(...poly.map(p => p[0])), Math.min(...poly.map(p => p[1])), Math.max(...poly.map(p => p[0])), Math.max(...poly.map(p => p[1]))];
export function indexTown(town: TownLike): TownIndex {
  const plots: TownIndex['plots'] = [], quarters: TownIndex['quarters'] = [];
  for (const s of town.sites) {
    const rect = (i0: number, j0: number, i1: number, j1: number): P2[] => [s.grid(s.u0 + i0, s.v0 + j0), s.grid(s.u0 + i1, s.v0 + j0), s.grid(s.u0 + i1, s.v0 + j1), s.grid(s.u0 + i0, s.v0 + j1)];
    if (s.meta.kind === 'quarter') { const q = rect(0, 0, s.W, s.H); quarters.push({ poly: q, bb: bbox(q) }); }
    for (const p of s.plots) { const zone = ROW_ZONE[p.row]; if (!zone) continue; const poly = rect(...p.rect); plots.push({ poly, zone, bb: bbox(poly) }); }
  }
  return { plots, quarters };
}
const SETTLE = (settlementJson as any).features as any[], PLAIN = (plainJson as any).features as any[];
const feat = (id: string) => SETTLE.find(f => f.id === id) ?? PLAIN.find(f => f.id === id);
const ROADS = SETTLE.filter(f => f.kind === 'road' && f.present_467 && f.polyline).map(f => ({ pts: parse(f.polyline) as P2[], w: (f.width_m ?? 6) as number }));
const CANAL = SETTLE.filter(f => f.kind === 'canal' && f.present_467 && f.polyline).map(f => parse(f.polyline) as P2[]);
const OPEN_ZONES = SETTLE.filter(f => f.present_467 && f.polygon && /^zone_town/.test(f.kind)).map(f => parse(f.polygon) as P2[]);
const GARDEN_ZONES = SETTLE.filter(f => f.present_467 && f.polygon && f.kind === 'zone_palace_garden').map(f => parse(f.polygon) as P2[]);
const at = (id: string): P2 => parse(feat(id)?.xy) ?? [NaN, NaN];
const inBB = (bb: [number, number, number, number], e: number, n: number) => e >= bb[0] && e <= bb[2] && n >= bb[1] && n <= bb[3];

/** the access zone at grid point (e, n); `town` from indexTown(settlement.plan) (without it the town reads as open ground) */
export function accessZoneAt(e: number, n: number, town?: TownIndex | null): string {
  const t = terraceZoneAt(e, n); if (t) return t;
  const sf = place('stair_foot'); if (Math.hypot(e - sf[0], n - sf[1]) < 20) return 'stair_foot';
  if (town) {
    for (const p of town.plots) if (inBB(p.bb, e, n) && pointInPolygon(e, n, p.poly)) return p.zone;
    for (const q of town.quarters) if (inBB(q.bb, e, n) && pointInPolygon(e, n, q.poly)) return 'town_lanes';
  }
  for (const r of ROADS) if (distToPolyline(e, n, r.pts) < r.w / 2 + 2) return 'roads';
  for (const c of CANAL) if (distToPolyline(e, n, c) < 6) return 'canal';
  const tr = at('takht_e_rustam'); if (Math.hypot(e - tr[0], n - tr[1]) < 60) return 'takht_e_rustam';
  const nr = at('nr_darius_tomb'); if (Math.hypot(e - nr[0], n - nr[1]) < 1500) return 'naqsh_e_rustam';
  // the approach from the town's Terrace edge to the stair foot (research zone) before the settlement's wider town zone
  const town0 = place('town'); if (e > town0[0] && e < sf[0] && Math.abs(n - sf[1]) < 150) return 'plain_approach';
  if (OPEN_ZONES.some(z => pointInPolygon(e, n, z))) return 'town_open_ground';
  if (GARDEN_ZONES.some(z => pointInPolygon(e, n, z))) return 'garden_zones_outside';
  return 'plain_open';
}

// ------------------------------------------------------------------------------------------------------------ the rules
export interface VisitorCtx {
  /** outside the Terrace's hours (sunrise + 0.5 h … sunset − 0.5 h), or night in town */ night: boolean;
  /** the court is resident (seasonal setting, D-003) */ court: boolean;
  /** zones whose check post admitted the visitor on the current errand step (halmi shown, business stated) */ admitted: ReadonlySet<string>;
  /** zones the current errand step names as its place of business */ business: ReadonlySet<string>;
  /** a guard or official walks beside the visitor */ escorted: boolean;
  /** the guards at this zone's post recognise the visitor with the same errand open (recognition rules) */ recognised: boolean;
}
export interface Decision { zone: string; rule: Rule; allowed: boolean; /** what the guard asks for, or why never */ needs: 'nothing' | 'halmi' | 'escort' | 'never'; tier: string }
/** the zone's rule for this moment: night, the court's presence, recognition */
export function ruleOf(z: AccessZone, ctx: Pick<VisitorCtx, 'night' | 'court' | 'recognised'>): Rule {
  const r = ctx.night ? z.night : ctx.court ? z.court_resident : z.rule;
  return !ctx.night && ctx.recognised && z.recognised_rule ? z.recognised_rule : r;
}
export function decide(zoneId: string, ctx: VisitorCtx): Decision {
  const z = ZONES.get(zoneId); if (!z) return { zone: zoneId, rule: 'open', allowed: true, needs: 'nothing', tier: 'C' };
  const rule = ruleOf(z, ctx);
  switch (rule) {
    case 'open': case 'none': return { zone: zoneId, rule, allowed: true, needs: 'nothing', tier: z.tier };
    case 'business': { const ok = ctx.business.has(zoneId) && (ctx.admitted.has(zoneId) || z.checked_at.length === 0 || ctx.recognised); return { zone: zoneId, rule, allowed: ok, needs: ok ? 'nothing' : ctx.business.has(zoneId) ? 'halmi' : 'never', tier: z.tier }; }
    case 'escort': return { zone: zoneId, rule, allowed: ctx.escorted, needs: ctx.escorted ? 'nothing' : 'escort', tier: z.tier };
    default: return { zone: zoneId, rule, allowed: false, needs: 'never', tier: z.tier };
  }
}
/** the errand's steps (access.json errand.steps) and the zones each names as its business: the step's zone, its
 *  inside zone and the zones on its route */
export const ERRAND = A.errand as { id: string; title: string; steps: { n: number; zone: string; inside?: string; route?: string[]; place: string; at: P2; action: string; tier: string }[] };
export function businessZones(step: number): Set<string> {
  const s = ERRAND.steps.find(q => q.n === step); if (!s) return new Set();
  const out = new Set<string>([s.zone]); if (s.inside) out.add(s.inside);
  for (const r of s.route ?? []) if (ZONES.has(r)) out.add(r);
  return out;
}
/** the Terrace's hours for the visitor (C): sunrise + 0.5 h to sunset − 0.5 h */
export const terraceOpen = (hour: number, sunrise: number, sunset: number) => hour >= sunrise + 0.5 && hour <= sunset - 0.5;
