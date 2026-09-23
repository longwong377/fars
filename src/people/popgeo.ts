// The population's places in the built world (D-143). A day plan (population.ts) names abstract places: a household's
// house (h:<id>), its quarter's lane, well, canal and open ground, a workshop, a field, a Terrace work place. This module
// resolves each one, for one person, to a spot in what Phases 2-7 built, and joins spots by walked routes:
//  - the Terrace and its approach: the walkable grid (navgrid.ts; routes between place anchors cached, D-024);
//  - the town: the site rasters of the built settlement, walls and doors as built (settlement/walk.ts), the lane graph
//    between sites over open ground;
//  - the plain: the built villages (plain/villages.ts), rasterised the same way (compounds, gates, rooms), fields and
//    village places around them; open ground in straight runs.
// Everything here is reconstruction (C): the plans say "at the well of q_s1"; which well and where round it is this
// module's choice, deterministic per (person, place), so a person comes back to the same spot. Rules that are judgements
// are named where they are made; the dev overlay prints `Spot.what`.
import type { Population } from './population';
import { TERRACE_ABSTRACT } from './population';
import { NAV, type NavGrid, type P2 } from './navgrid';
import { PLACES } from './sim';
import { sunTimes } from './calendar';
import { hall100Layout } from './construction';
import { footprint } from '../arch/spec';
import { h32, salt } from './hash';
import type { ActivityId } from './activities';
import type { TownPlan } from '../world/settlement/plan';
import { TownWalk, plotCells, openCode, walkableCell, siteLine } from '../world/settlement/walk';
import { Site, OUT, ROOM, YARD, toLocal, toGrid } from '../world/settlement/site';
import townJson from '../data/town.json';
import livesJson from '../data/lives.json';

/** a person's place, resolved */
export interface Spot {
  e: number; n: number;
  /** drawn: out of doors, or in an open court, yard or workshop; false: inside a roofed room (hidden) */
  out: boolean;
  /** facing, degrees clockwise from grid north */
  heading: number;
  /** the network that holds it: the Terrace grid, the town, a village, open ground */
  net: 'nav' | 'town' | 'village' | 'open';
  /** village index (net 'village') */
  v?: number;
  /** the Terrace place whose anchor it hangs from (routes between anchors are cached) */
  anchor?: string;
  /** what this spot is (dev overlay, tests) */
  what: string;
  /** false when the place has no counterpart in the built world (not drawn; counted in the stats) */
  ok: boolean;
}
export interface Route { pts: Float64Array; cum: Float64Array; len: number }
/** a built village as the plain builds it (plain/villages.ts Village and Compound, the fields used here) */
export interface VillageIn { id: string; x: number; y: number; r: number; pop: number }
export interface CompoundIn { x: number; y: number; w: number; d: number; angle: number; rooms: { u0: number; v0: number; u1: number; v1: number }[]; gate: number; seed: number }
export interface GeoOpts {
  pop: Population; nav: NavGrid; town: TownPlan | null;
  /** ground height (m) at grid (e, n): the terrain; the Terrace grid is used where it is walkable */
  ground?: (e: number, n: number) => number;
  villages?: VillageIn[]; compounds?: (vi: number) => CompoundIn[];
  /** plain canal courses (grid polylines), for canal:<village> */
  canals?: P2[][];
  seed?: number;
}

const T = townJson as any, L = livesJson as any;
const FAC: Record<string, P2> = Object.fromEntries((T.facilities as any[]).map(f => [f.id, f.at as P2]));
const S = { spot: salt('popgeo-spot'), ring: salt('popgeo-ring'), dir: salt('popgeo-dir'), vil: salt('popgeo-village'), pick: salt('popgeo-pick') };
const rad = (d: number) => (d * Math.PI) / 180;
/** heading (deg cw from grid north) of the direction (de, dn) */
export const headingOf = (de: number, dn: number) => (Math.atan2(de, dn) * 180) / Math.PI;
/** acts done indoors (a roofed room: not drawn) wherever the person is at home (C) */
const INDOOR = new Set<ActivityId>(['sleep', 'lie_ill', 'offmap']);
/** the Terrace's abstract work places (TERRACE_ABSTRACT): centre and half-extent (grid m) over which people spread, from
 *  the spec footprints and the hall's layout (C: who stands where inside them) */
function terraceAbstract(): Record<string, { c: P2; h: P2 }> {
  const H = hall100Layout(), f = footprint('hall100').bounds, tr = footprint('treasury').bounds;
  const box = (b: number[], k = 0.32) => ({ c: [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2] as P2, h: [(b[2] - b[0]) * k, (b[3] - b[1]) * k] as P2 });
  return {
    hall100_site: { c: H.centre, h: [(f[2] - f[0]) * 0.4, (f[3] - f[1]) * 0.4] },
    h100_wall_N: { c: [(f[0] + f[2]) / 2, f[3] - 2.5], h: [(f[2] - f[0]) * 0.42, 1.2] }, h100_wall_S: { c: [(f[0] + f[2]) / 2, f[1] + 2.5], h: [(f[2] - f[0]) * 0.42, 1.2] },
    h100_wall_W: { c: [f[0] + 2.5, (f[1] + f[3]) / 2], h: [1.2, (f[3] - f[1]) * 0.42] }, h100_wall_E: { c: [f[2] - 2.5, (f[1] + f[3]) / 2], h: [1.2, (f[3] - f[1]) * 0.42] },
    treasury_inside: { c: [(tr[0] + tr[2]) / 2, (tr[1] + tr[3]) / 2 - 8], h: [(tr[2] - tr[0]) * 0.3, (tr[3] - tr[1]) * 0.3] },
    camp_extra: { c: PLACES.querns.at, h: [9, 7] }, stair_extra: { c: PLACES.stair_foot.at, h: [7, 7] },
    'palaces:apadana': box(footprint('apadana').bounds), 'palaces:tachara': box(footprint('tachara').bounds), 'palaces:hadish': box(footprint('hadish').bounds),
    'palaces:harem': box(footprint('harem').bounds, 0.25), 'palaces:gate': box(footprint('gate_nations').bounds, 0.25),
  };
}

export class PopGeo {
  readonly pop: Population; readonly nav: NavGrid; readonly town: TownWalk | null; readonly plan: TownPlan | null;
  readonly seed: number;
  private ground: (e: number, n: number) => number;
  private abs = terraceAbstract();
  /** the plan's plot id → (site index, plot index) */
  private plotIx = new Map<string, [number, number]>();
  /** wells (grid) of the town: public and yard wells */
  private wells: P2[] = []; private water: P2[] = [];
  private gardens: { si: number; pi: number; c: P2 }[] = []; private workshops: { si: number; pi: number; c: P2; craft: string }[] = [];
  private siteIx = new Map<string, number>();
  /** population village id → built village index; household → compound index */
  private vmap = new Map<string, number>(); private hhCompound = new Map<number, number>();
  private vsites = new Map<number, { walk: TownWalk; site: Site; comps: CompoundIn[]; gates: number[] }>();
  readonly stair: P2;
  /** Terrace routes between place anchors (A* is costly: 20-200 ms on the 0.5 m grid) and the step's search budget */
  private navCore = new Map<string, P2[] | null>(); navBudget = Infinity;
  private cache = new Map<string, Route | null>();
  readonly stats = { spots: 0, unresolved: 0, routes: 0, routeFails: 0, cacheHits: 0, navSearches: 0, routeMs: 0 };
  readonly unresolved = new Map<string, number>();
  constructor(o: GeoOpts) {
    this.pop = o.pop; this.nav = o.nav; this.plan = o.town; this.seed = o.seed ?? 1;
    this.ground = o.ground ?? ((e, n) => { const h = this.nav.heightAt(e, n); return Number.isFinite(h) ? h : 0; });
    this.stair = this.nav.snap(PLACES.stair_foot.at[0], PLACES.stair_foot.at[1], 4) ?? PLACES.stair_foot.at;
    if (o.town) {
      o.town.sites.forEach((s, si) => { this.siteIx.set(s.id, si); s.plots.forEach((p, pi) => { this.plotIx.set(p.id, [si, pi]);
        const [i0, j0, i1, j1] = p.rect, c = s.grid((s.cu(i0) + s.cu(i1 - 1)) / 2, (s.cv(j0) + s.cv(j1 - 1)) / 2);
        if (p.kind === 'garden') this.gardens.push({ si, pi, c }); if (p.kind === 'workshop' || p.kind === 'craft_area') this.workshops.push({ si, pi, c, craft: p.craft ?? '' }); });
        for (const f of s.fittings) if (f.kind === 'well') this.wells.push(s.grid(f.u, f.v)); });
      for (const w of o.town.water) if (w.kind === 'canal' || w.kind === 'ditch' || w.kind === 'channel' || w.kind === 'pool') for (let i = 1; i < w.pts.length; i++) { const [a, b] = [w.pts[i - 1], w.pts[i]], L = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(1, Math.ceil(L / 25)); for (let k = 0; k <= m; k++) this.water.push([a[0] + (b[0] - a[0]) * k / m, a[1] + (b[1] - a[1]) * k / m]); }
      const extra: P2[] = [this.stair, [...PLACES.town.at] as P2, ...['mill', 'stockyard', 'brickyard', 'offering_place', 'crown_fields', 'clay_pit', 'river', 'mountain', 'outside'].map(k => FAC[k])];
      this.town = TownWalk.fromPlan(o.town, extra);
    } else this.town = null;
    this.villages = o.villages ?? []; this.compoundsOf = o.compounds ?? null; this.canals = o.canals ?? [];
    if (this.villages.length) this.mapVillages();
  }
  private villages: VillageIn[]; private compoundsOf: ((vi: number) => CompoundIn[]) | null; private canals: P2[][];
  private hash(pid: number, place: string, k = 0) { return h32(this.seed, S.spot, pid, salt(place), k) / 4294967296; }

  // -------------------------------------------------------------------------------------------------- villages
  /** population villages → built villages (C, D-143): the four Barrington villages by name; the unlocated ones by size
   *  rank (the population's rank-size village totals against the built villages' populations, largest to largest); the
   *  population has two more unlocated villages than the plain built, and they go to the two smallest (shared) */
  private mapVillages() {
    const P = this.pop, byName: Record<string, string> = { v_masumabad: 'village_masumabad_west', v_saidun: 'village_saidun', v_tukrash: 'village_tukrash', v_rakkan: 'village_rakkan' };
    const people = new Map<string, number>(); const hhs = new Map<string, number[]>();
    for (const H of P.households) if (H.zone === 'plain') { people.set(H.q, (people.get(H.q) ?? 0) + H.members.length); (hhs.get(H.q) ?? hhs.set(H.q, []).get(H.q)!).push(H.id); }
    const V = this.villages, idx = new Map(V.map((v, i) => [v.id, i]));
    for (const [q, name] of Object.entries(byName)) if (idx.has(name)) this.vmap.set(q, idx.get(name)!);
    const popU = [...people.keys()].filter(q => !byName[q]).sort((a, b) => people.get(b)! - people.get(a)! || (a < b ? -1 : 1));
    const builtU = V.map((v, i) => ({ v, i })).filter(x => !Object.values(byName).includes(x.v.id)).sort((a, b) => b.v.pop - a.v.pop || (a.v.id < b.v.id ? -1 : 1));
    popU.forEach((q, k) => { if (builtU.length) this.vmap.set(q, builtU[k < builtU.length ? k : builtU.length - 1 - ((k - builtU.length) % builtU.length)].i); });
    this.vhh = hhs;
  }
  private vhh = new Map<string, number[]>();
  /** the built village a plain household lives in, and its compound (households share compounds where the village is
   *  larger in the population than as built: counted in `villageLoad`) */
  villageOf(hh: number): { vi: number; ci: number } | null {
    const H = this.pop.households[hh]; if (H.zone !== 'plain') return null; const vi = this.vmap.get(H.q); if (vi === undefined || !this.compoundsOf) return null;
    let ci = this.hhCompound.get(hh);
    if (ci === undefined) { const list = this.vhh.get(H.q) ?? [hh], n = this.vsite(vi).comps.length; ci = n ? list.indexOf(hh) % n : -1; this.hhCompound.set(hh, ci); }
    return ci >= 0 ? { vi, ci } : null;
  }
  /** households per compound of each built village (the population's village sizes against the built compounds) */
  villageLoad(): { id: string; households: number; compounds: number; perCompound: number }[] {
    const out: { id: string; households: number; compounds: number; perCompound: number }[] = [];
    for (const [q, vi] of this.vmap) { const n = this.compoundsOf ? this.compoundsOf(vi).length : 0, h = this.vhh.get(q)?.length ?? 0; out.push({ id: `${q}→${this.villages[vi].id}`, households: h, compounds: n, perCompound: n ? h / n : 0 }); }
    return out;
  }
  /** a built village as a walkable raster (1 m): compounds are plots, their yard walls stand on the plot edges, the gate
   *  in the S wall and each room's door onto the yard are doors (compoundBoxes' geometry: plain/villages.ts) */
  private vsite(vi: number) {
    let x = this.vsites.get(vi); if (x) return x;
    const v = this.villages[vi], comps = this.compoundsOf ? this.compoundsOf(vi) : [];
    const theta = comps.length ? comps[0].angle : 0, W = 2 * Math.ceil(v.r * 1.3) + 40;
    const s = new Site({ id: v.id, feature: v.id, zone: 'plain', popZone: 'plain', kind: 'compound', tier: 'C', src: 'RECON', note: 'village (plain/villages.ts)' }, { c: [v.x, v.y], theta }, W, W);
    s.cell.fill(OUT); const gates: number[] = [];
    comps.forEach((c, ci) => {
      const p = s.addPlot({ id: `${v.id}-c${ci}`, kind: 'house', rect: [0, 0, 0, 0], o: [0, 0], t: [1, 0], n: [0, 1], w: c.w, d: c.d, door: null, court: true, height: 2.6, parapet: 0, yardWall: 2, outerT: 0.5, row: 'village_houses', feature: v.id, note: '' });
      const ca = Math.cos(c.angle), sa = Math.sin(c.angle), R = Math.hypot(c.w, c.d) / 2 + 1, [lu, lv] = toLocal(s.frame, c.x, c.y);
      const loc = (u: number, w: number): P2 => { const e = c.x + u * ca - w * sa, n = c.y + u * sa + w * ca; return toLocal(s.frame, e, n); };
      const toC = (i: number, j: number): P2 => { const [e, n] = s.grid(s.cu(i), s.cv(j)), de = e - c.x, dn = n - c.y; return [de * ca + dn * sa, -de * sa + dn * ca]; };
      const rid = c.rooms.map(() => s.newRoom());
      for (let j = s.cj(lv - R); j <= s.cj(lv + R); j++) for (let i = s.ci(lu - R); i <= s.ci(lu + R); i++) { if (!s.inb(i, j)) continue; const [u, w] = toC(i, j); if (Math.abs(u) > c.w / 2 || Math.abs(w) > c.d / 2) continue;
        const k = s.k(i, j); s.cell[k] = p.idx; s.sub[k] = YARD; c.rooms.forEach((r, ri) => { if (u >= r.u0 && u <= r.u1 && w >= r.v0 && w <= r.v1) { s.sub[k] = ROOM; s.room[k] = rid[ri]; } }); }
      // a door between the plot cell nearest the given compound-local point and its open (or yard) 4-neighbour
      const door = (u: number, w: number, outCode: (k: number) => boolean, street: boolean) => {
        const [pu, pv] = loc(u, w); let best: [number, number] | null = null, bd = 9;
        for (let j = s.cj(pv) - 2; j <= s.cj(pv) + 2; j++) for (let i = s.ci(pu) - 2; i <= s.ci(pu) + 2; i++) { if (!s.inb(i, j)) continue; const k = s.k(i, j); if (s.cell[k] !== p.idx) continue;
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { if (!s.inb(i + di, j + dj)) continue; const ko = s.k(i + di, j + dj); if (!outCode(ko)) continue;
            const d = Math.hypot(s.cu(i) + di * 0.5 - pu, s.cv(j) + dj * 0.5 - pv); if (d < bd) { bd = d; best = [k, ko]; } } }
        if (!best) return; s.doors.add(s.edgeBetween(best[0], best[1])); if (street && !p.door) p.door = { cell: best[0], out: best[1] };
      };
      door(c.gate * (c.w - 3), -c.d / 2, k => s.cell[k] === OUT, true); if (p.door) gates.push(ci); else gates.push(-1);
      const du = (c.seed % 7) / 7 - 0.5; c.rooms.forEach((r, ri) => { const yard = (k: number) => s.cell[k] === p.idx && s.sub[k] === YARD;
        if (ri === 0) door((r.u0 + r.u1) / 2 + du * (r.u1 - r.u0) * 0.6, r.v0, yard, false); else door(r.u0 < 0 ? r.u1 : r.u0, (r.v0 + r.v1) / 2, yard, false); });
    });
    x = { walk: new TownWalk([s]), site: s, comps, gates }; this.vsites.set(vi, x); return x;
  }
  /** the village whose raster contains (e, n), or -1 */
  private villageAt(e: number, n: number): number {
    for (let i = 0; i < this.villages.length; i++) { const v = this.villages[i]; if (Math.abs(e - v.x) < v.r * 1.3 + 20 && Math.abs(n - v.y) < v.r * 1.3 + 20) { const s = this.vsite(i).site, [u, w] = toLocal(s.frame, e, n); if (s.inb(s.ci(u), s.cj(w))) return i; } }
    return -1;
  }

  // -------------------------------------------------------------------------------------------------- spots
  private sp(e: number, n: number, out: boolean, heading: number, net: Spot['net'], what: string, extra: Partial<Spot> = {}): Spot { this.stats.spots++; return { e, n, out, heading, net, what, ok: true, ...extra }; }
  private none(place: string, why: string): Spot { this.stats.unresolved++; this.unresolved.set(place.split(':')[0], (this.unresolved.get(place.split(':')[0]) ?? 0) + 1); return { e: 0, n: 0, out: false, heading: 0, net: 'open', what: `${place}: ${why}`, ok: false }; }
  /** a cell of a site plot: an open (court/yard) cell for work, a room for indoor acts; deterministic per person */
  private inPlot(s: Site, pi: number, pid: number, key: string, indoor: boolean, net: 'town' | 'village', v?: number, what = ''): Spot | null {
    const cells = plotCells(s, pi), list = indoor ? (cells.rooms.length ? cells.rooms : cells.open) : (cells.open.length ? cells.open : cells.rooms); if (!list.length) return null;
    const u = this.hash(pid, key, 1), k = list[Math.floor(u * list.length)], out = !indoor && cells.open.length > 0;
    const j = this.hash(pid, key, 2) * 0.5 - 0.25, jj = this.hash(pid, key, 3) * 0.5 - 0.25;
    const [e, n] = s.grid(s.cu(k % s.W) + j, s.cv((k / s.W) | 0) + jj);
    const [i0, j0, i1, j1] = s.plots[pi].rect, c = s.grid((s.cu(i0) + s.cu(i1 - 1)) / 2, (s.cv(j0) + s.cv(j1 - 1)) / 2);
    return this.sp(e, n, out, headingOf(c[0] - e, c[1] - n) + (this.hash(pid, key, 4) - 0.5) * 120, net, `${what}${out ? 'court' : 'room'} of ${s.plots[pi].id}`, v !== undefined ? { v } : {});
  }
  /** an open cell near a site point (a small BFS over open cells), chosen per person */
  private nearOpen(s: Site, k0: number, pid: number, key: string, r: number, prefer?: (k: number) => boolean): number {
    const seen = new Set<number>([k0]), q = [k0], out: number[] = []; const i0 = k0 % s.W, j0 = (k0 / s.W) | 0;
    for (let h = 0; h < q.length && q.length < 4000; h++) { const k = q[h]; if (openCode(s.cell[k]) && (!prefer || prefer(k))) out.push(k);
      const i = k % s.W, j = (k / s.W) | 0; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + di, jj = j + dj; if (!s.inb(ii, jj) || Math.hypot(ii - i0, jj - j0) > r) continue; const kk = s.k(ii, jj); if (seen.has(kk) || !openCode(s.cell[kk])) continue; seen.add(kk); q.push(kk); } }
    if (!out.length) return k0; return out[Math.floor(this.hash(pid, key, 5) * out.length)];
  }
  private cellSpot(s: Site, k: number, pid: number, key: string, net: 'town' | 'village', what: string, face?: P2, v?: number): Spot {
    const [e, n] = s.grid(s.cu(k % s.W) + this.hash(pid, key, 6) * 0.6 - 0.3, s.cv((k / s.W) | 0) + this.hash(pid, key, 7) * 0.6 - 0.3);
    return this.sp(e, n, true, face ? headingOf(face[0] - e, face[1] - n) : this.hash(pid, key, 8) * 360, net, what, v !== undefined ? { v } : {});
  }
  /** open ground near a grid point: a disc of radius r, clear of every town plot (or, with `yards`, in an open-air court
   *  or yard of one: a garden's ditch) and on walkable ground; not resolved when 16 draws find nothing */
  private openNear(c: P2, r: number, pid: number, key: string, what: string, face?: P2, yards = false): Spot {
    for (let t = 0; t < 16; t++) { const a = this.hash(pid, key, 20 + t) * Math.PI * 2, d = r * Math.sqrt(this.hash(pid, key, 40 + t)) * (1 + t / 8), e = c[0] + Math.cos(a) * d, n = c[1] + Math.sin(a) * d;
      let net: Spot['net'] = 'open';
      if (this.town) { const l = this.town.locate(e, n); if (l) { const s = this.town.boxes[l.si].s, cc = s.cell[l.k]; if (!openCode(cc) && !(yards && cc >= 0 && s.sub[l.k] !== ROOM)) continue; net = 'town'; } }
      if (this.inNav(e, n) && !this.nav.walkable(e, n)) continue;
      const vi = this.villages.length ? this.villageAt(e, n) : -1;
      if (vi >= 0) { const s = this.vsite(vi).site, [u, w] = toLocal(s.frame, e, n); if (!openCode(s.cell[s.k(s.ci(u), s.cj(w))])) continue; net = 'village'; }
      return this.sp(e, n, true, face ? headingOf(face[0] - e, face[1] - n) : this.hash(pid, key, 9) * 360, net, what, vi >= 0 ? { v: vi } : {}); }
    return this.none(key, `${what}: no clear ground found`);
  }
  private inNav(e: number, n: number) { return e > NAV.e0 && e < NAV.e0 + NAV.w * NAV.cell && n > NAV.n0 && n < NAV.n0 + NAV.h * NAV.cell; }
  /** a spot at a grid point (a detailed agent's leg end: the town edge, a lane mouth, a street door) */
  spotAtPoint(p: P2): Spot { const l = this.town?.locate(p[0], p[1]); return this.sp(p[0], p[1], true, 0, l ? 'town' : 'open', 'a point of the way'); }
  /** the town plot of a household (estates: one of their plots, per person) */
  private housePlot(hh: number, pid: number): [number, number] | null {
    const H = this.pop.households[hh]; if (!H) return null; const id = H.plots?.length ? H.plots[Math.floor(this.hash(pid, `hh${hh}`, 11) * H.plots.length)] : H.plot; return id ? this.plotIx.get(id) ?? null : null;
  }
  private homeDoor(pid: number, day: number): { s: Site; si: number; pi: number } | null {
    const hh = this.pop.home(pid, day), x = this.housePlot(hh, pid); if (!x || !this.plan) return null; return { s: this.plan.sites[x[0]], si: x[0], pi: x[1] };
  }

  /** where a person is at a (non-road) place of their plan, doing `act`, at `hour` of `day` */
  spot(pid: number, place: string, act: ActivityId, day: number, hour: number): Spot {
    if (place === '-' || place.startsWith('road:')) return this.none(place, 'not a place');
    if (place in PLACES || place in this.abs || place === 'palaces') return this.terrace(pid, place);
    const k = place.indexOf(':'), head = k > 0 ? place.slice(0, k) : place, tail = k > 0 ? place.slice(k + 1) : '', q = tail.split(':')[0];
    const sun = sunTimes(day), dark = hour < sun.rise - 0.25 || hour > sun.set + 0.6;
    const indoor = INDOOR.has(act) || (dark && act === 'rest');
    switch (head) {
      case 'h': return this.home(pid, +tail, act, indoor, day);
      case 'lane': return this.lane(pid, q, day);
      case 'well': return this.well(pid, q, day);
      case 'canal': return this.canal(pid, q, day);
      case 'outside': return tail ? this.outside(pid, q, day, 90, 220, 'gathering ground outside') : this.openNear(FAC.outside, 40, pid, place, 'open ground where the dead are carried out (town.json outside, C)');
      case 'garden': return this.garden(pid, q, day);
      case 'estate': { const x = this.housePlot(parseInt(q, 10), pid); if (!x || !this.plan) return this.none(place, 'estate plot not built'); return this.inPlot(this.plan.sites[x[0]], x[1], pid, place, indoor, 'town', undefined, 'estate: ') ?? this.none(place, 'estate plot empty'); }
      case 'ws': { const a = T.treasury_workshops.around, c: P2 = [a[0] + (+tail - 1.5) * 150, a[1]]; return this.workshop(pid, place, c, ['metal', 'wood', 'textile', 'pottery'], 12, indoor, 'treasury workshop: '); }
      case 'ws_textile': return this.workshop(pid, place, [-700, -1000], ['textile'], 10, indoor, 'textile workshop: ');
      case 'brewery': return this.workshop(pid, place, FAC.brewery, ['brewery'], 3, indoor, 'brewery: ');
      case 'craft_zone': { const x = this.plotIx.get('pw_area_b-yard'); if (!x || !this.plan) return this.none(place, 'Area B not built'); return this.inPlot(this.plan.sites[x[0]], x[1], pid, 'craft_zone', indoor, 'town', undefined, 'Area B craft yard: ') ?? this.none(place, 'empty'); }
      case 'store_town': case 'royal_store': return this.compound(pid, 'stores', place, indoor, 'the storehouse (D-043): ');
      case 'official_bldg': return this.compound(pid, 'official', place, indoor, 'the official building: ');
      case 'station': return this.compound(pid, 'stables', place, indoor, 'the state stable by the royal road W (D-043), standing in for the road station (C): ');
      case 'garden_pw': return this.compound(pid, 'area_c_garden', place, indoor, 'Persepolis West Area C garden: ');
      case 'mill': return this.openNear(FAC.mill, 14, pid, place, 'the mill: NOT BUILT, grinding in the open at its town.json place (C)', FAC.mill);
      case 'stockyard': return this.openNear(FAC.stockyard, 18, pid, place, 'the stockyard: NOT BUILT, open ground at its town.json place (C)', FAC.stockyard);
      case 'brickyard': return this.openNear(FAC.brickyard, 20, pid, place, 'the brickyard by the canal: NOT BUILT, open ground (C)');
      case 'offering_place': case 'mountain': case 'river': case 'crown_fields': case 'clay_pit': return this.openNear(FAC[head], head === 'crown_fields' ? 120 : 20, pid, place, `${head} (town.json, open ground, C)`, FAC[head]);
      case 'terrace_edge': return this.openNear(PLACES.town.at, 6, pid, place, 'the Terrace approach, W');
      case 'pasture': return this.pasture(pid, tail, day);
      case 'training': return this.outside(pid, q, day, 120, 200, 'practice ground outside the quarter (C)');
      case 'field': case 'threshing': case 'vineyard': case 'orchard': return this.plainPlace(pid, head, tail, day);
      case 'camp': case 'route': return this.band(pid, head, tail);
      default: return this.none(place, 'no rule');
    }
  }
  /** a Terrace spot: spread over the place (its span, a ring round a hearth, the abstract places' areas) on walkable cells
   *  that see the place's anchor in a straight line (so the way to it needs no search; up to 8 draws, else the anchor) */
  private terrace(pid: number, place: string): Spot {
    const anchor = place === 'palaces' ? `palaces:${['apadana', 'tachara', 'hadish'][Math.floor(this.hash(pid, 'palaces', 12) * 3)]}` : place;
    const P = PLACES[place], A = this.abs[anchor], ap = this.anchorPt(anchor); if (!ap) return this.none(place, 'no walkable anchor');
    let s: P2 | null = null, face: P2 | null = null;
    for (let t = 0; t < 8 && !s; t++) { let e: number, n: number;
      if (A) { e = A.c[0] + (this.hash(pid, place, 13 + 50 * t) * 2 - 1) * A.h[0]; n = A.c[1] + (this.hash(pid, place, 14 + 50 * t) * 2 - 1) * A.h[1]; }
      else if (P.kind === 'post') { e = P.at[0]; n = P.at[1]; }
      else if (P.span) { const [[x0, y0], [x1, y1]] = P.span; e = x0 + (x1 - x0) * this.hash(pid, place, 13 + 50 * t); n = y0 + (y1 - y0) * this.hash(pid, place, 14 + 50 * t); }
      // round a hearth, where a whole work gang or watch eats, up to 8 m out (evenly by area; C); an oven's bakers and
      // other places within 2.6 m
      else { const a = this.hash(pid, place, 13 + 50 * t) * Math.PI * 2, u = this.hash(pid, place, 14 + 50 * t), r = P.kind === 'hearth' ? Math.sqrt(1.6 * 1.6 + u * (8 * 8 - 1.6 * 1.6)) : P.kind === 'oven' ? 1.6 + u : 0.8 + 1.8 * u; e = P.at[0] + Math.cos(a) * r; n = P.at[1] + Math.sin(a) * r; if (P.kind === 'hearth' || P.kind === 'oven') face = P.at; }
      // the point itself where it is walkable (snapping to cell centres stacked people on one point), else the nearest cell
      const q: P2 | null = this.nav.walkable(e, n) ? [e, n] : this.nav.snap(e, n, 4); if (q && (Math.hypot(q[0] - ap[0], q[1] - ap[1]) < 0.3 || this.nav.lineClear(q, ap))) s = q; }
    s ??= ap;
    const hd = face ? headingOf(face[0] - s[0], face[1] - s[1]) : P?.heading ?? this.hash(pid, place, 15) * 360;
    return this.sp(s[0], s[1], true, hd, 'nav', `Terrace: ${place}`, { anchor });
  }
  private home(pid: number, hh: number, act: ActivityId, indoor: boolean, day: number): Spot {
    const H = this.pop.households[hh]; if (!H) return this.none('h', 'no household');
    if (H.zone === 'town') { const x = this.housePlot(hh, pid); if (!x || !this.plan) return this.none('h', 'no house plot');
      return this.inPlot(this.plan.sites[x[0]], x[1], pid, `h:${hh}`, indoor, 'town', undefined, hh === this.pop.home(pid, day) ? 'home: ' : 'visit: ') ?? this.none('h', 'plot has no cells'); }
    if (H.zone === 'plain') { const m = this.villageOf(hh); if (!m) return this.none('h', 'village not built'); const V = this.vsite(m.vi), p = V.site.plots[m.ci];
      return this.inPlot(V.site, p.idx, pid, `h:${hh}`, indoor, 'village', m.vi, `village ${this.villages[m.vi].id}: `) ?? this.none('h', 'compound empty'); }
    void act; return this.none('h', `household zone ${H.zone}`);
  }
  /** the lane outside the household's street door (women "outside the door", children with the neighbours' children) */
  private lane(pid: number, q: string, day: number): Spot {
    const H = this.pop.households[this.pop.home(pid, day)], child = this.pop.ageOn(pid, day) < 12;
    if (H.zone === 'plain') { const m = this.villageOf(H.id); if (!m) return this.none('lane', 'village not built'); const V = this.vsite(m.vi), p = V.site.plots[m.ci]; if (!p.door) return this.none('lane', 'no gate');
      const k = this.nearOpen(V.site, p.door.out, pid, `lane:${q}`, child ? 16 : 5); return this.cellSpot(V.site, k, pid, `lane:${q}`, 'village', 'the lane outside the gate', undefined, m.vi); }
    const hd = this.homeDoor(pid, day); if (!hd) return this.quarterPoint(pid, q, 'lane');
    const p = hd.s.plots[hd.pi]; if (!p.door) return this.quarterPoint(pid, q, 'lane');
    const k = this.nearOpen(hd.s, p.door.out, pid, `lane:${q}`, child ? 16 : 5, c => hd.s.cell[c] !== OUT || child);
    const dp = hd.s.doorPoints(p)!; const door = hd.s.grid(dp.mid[0], dp.mid[1]);
    return this.cellSpot(hd.s, k, pid, `lane:${q}`, 'town', `the lane outside the door of ${p.id}`, child ? undefined : door);
  }
  private quarterPoint(pid: number, q: string, what: string): Spot {
    const Q = this.pop.quarters[q]; if (!Q || !this.town) return this.none(what, 'quarter not built');
    const l = this.town.locate(Q.xy[0], Q.xy[1]); if (!l) return this.openNear(Q.xy, 20, pid, `${what}:${q}`, `${what} of ${q} (open ground)`);
    const s = this.town.boxes[l.si].s; return this.cellSpot(s, this.nearOpen(s, l.k, pid, `${what}:${q}`, 30), pid, `${what}:${q}`, 'town', `${what} of ${q}`);
  }
  /** the well nearest the house (a public well of the quarter; C which one) */
  private well(pid: number, q: string, day: number): Spot {
    const H = this.pop.households[this.pop.home(pid, day)];
    if (H.zone === 'plain') { const m = this.villageOf(H.id); if (!m) return this.none('well', 'village not built'); const v = this.villages[m.vi], s = this.vsite(m.vi).site, [u, w] = toLocal(s.frame, v.x, v.y);
      const k = this.nearOpen(s, s.k(s.ci(u), s.cj(w)), pid, `well:${q}`, 40); return this.cellSpot(s, k, pid, `well:${q}`, 'village', `the village well of ${v.id} (C: at the village centre)`, [v.x, v.y], m.vi); }
    const hd = this.homeDoor(pid, day); const from = hd && hd.s.plots[hd.pi].door ? hd.s.cellGrid(hd.s.plots[hd.pi].door!.out) : this.pop.quarters[q]?.xy;
    if (!from || !this.wells.length || !this.town) return this.none('well', 'no well built');
    const w = this.wells.reduce((b, x) => Math.hypot(x[0] - from[0], x[1] - from[1]) < Math.hypot(b[0] - from[0], b[1] - from[1]) ? x : b);
    const a = this.hash(pid, `well:${q}`, 16) * Math.PI * 2, r = 1.3 + this.hash(pid, `well:${q}`, 17) * 1.4, e = w[0] + Math.cos(a) * r, n = w[1] + Math.sin(a) * r;
    const l = this.town.locate(e, n); if (!l) return this.sp(e, n, true, headingOf(w[0] - e, w[1] - n), 'open', 'at a well');
    const s = this.town.boxes[l.si].s, k = walkableCell(s, l.k) && openCode(s.cell[l.k]) ? l.k : this.nearOpen(s, l.k, pid, `well:${q}`, 4);
    return this.cellSpot(s, k, pid, `well:${q}`, 'town', 'at the well', w);
  }
  /** "at the water": the nearest canal, ditch or pool within 600 m of the house, else the nearest well (C) */
  private canal(pid: number, q: string, day: number): Spot {
    const H = this.pop.households[this.pop.home(pid, day)];
    if (H.zone === 'plain') { const m = this.villageOf(H.id); if (!m) return this.none('canal', 'village not built'); const v = this.villages[m.vi]; let best: P2 | null = null, bd = 2500;
      for (const c of this.canals) for (const p of c) { const d = Math.hypot(p[0] - v.x, p[1] - v.y); if (d < bd) { bd = d; best = p; } }
      if (!best) return this.outside(pid, q, day, v.r + 60, v.r + 160, 'the water by the village (no canal within 2.5 km: the village edge, C)');
      return this.openNear(best, 4, pid, `canal:${q}`, 'at the canal', best); }
    const hd = this.homeDoor(pid, day); const from = hd && hd.s.plots[hd.pi].door ? hd.s.cellGrid(hd.s.plots[hd.pi].door!.out) : this.pop.quarters[q]?.xy; if (!from) return this.none('canal', 'no house');
    let best: P2 | null = null, bd = 600; for (const p of this.water) { const d = Math.hypot(p[0] - from[0], p[1] - from[1]); if (d < bd) { bd = d; best = p; } }
    if (!best) return this.well(pid, q, day);
    return this.openNear(best, 3, pid, `canal:${q}`, 'at the water', best, true);
  }
  /** open ground outside the house's site, in a direction of the person's own (C: where dung and brushwood are gathered, the
   *  practice ground, the water's edge of a village) */
  private outside(pid: number, q: string, day: number, r0: number, r1: number, what: string): Spot {
    const H = this.pop.households[this.pop.home(pid, day)]; let c: P2 | null = null, rr = 0;
    if (H.zone === 'plain') { const m = this.villageOf(H.id); if (m) { const v = this.villages[m.vi]; c = [v.x, v.y]; rr = v.r; } }
    else { const hd = this.homeDoor(pid, day); if (hd) { c = hd.s.frame.c; rr = Math.hypot(hd.s.W, hd.s.H) / 2; } else c = this.pop.quarters[q]?.xy ?? null; }
    if (!c) return this.none('outside', 'no home');
    const a = (h32(this.seed, S.dir, pid, salt(q)) / 4294967296) * Math.PI * 2, d = rr + r0 + (r1 - r0) * this.hash(pid, `out:${q}`, 18);
    return this.openNear([c[0] + Math.cos(a) * d, c[1] + Math.sin(a) * d], 25, pid, `outside:${q}`, what);
  }
  /** the gardens: the nearest walled garden or orchard within 450 m of the house, else the open ground at the quarter's
   *  edge (the kitchen gardens are not built: C) */
  private garden(pid: number, q: string, day: number): Spot {
    const hd = this.homeDoor(pid, day); const from = hd?.s.frame.c ?? this.pop.quarters[q]?.xy; if (!from || !this.plan) return this.none('garden', 'no house');
    let best: { si: number; pi: number; c: P2 } | null = null, bd = 450; for (const g of this.gardens) { const d = Math.hypot(g.c[0] - from[0], g.c[1] - from[1]); if (d < bd) { bd = d; best = g; } }
    if (best) return this.inPlot(this.plan.sites[best.si], best.pi, pid, `garden:${q}`, false, 'town', undefined, 'garden: ') ?? this.none('garden', 'empty garden');
    return this.outside(pid, q, day, 15, 60, 'garden ground at the edge of the quarter (not built: C)');
  }
  /** workers of a workshop group spread over the `n` workshop plots of its crafts nearest its place (C) */
  private workshop(pid: number, place: string, c: P2, crafts: string[], n: number, indoor: boolean, what: string): Spot {
    if (!this.plan) return this.none(place, 'no town');
    const cand = this.workshops.filter(w => crafts.includes(w.craft)).map(w => ({ w, d: Math.hypot(w.c[0] - c[0], w.c[1] - c[1]) })).sort((a, b) => a.d - b.d).slice(0, n);
    if (!cand.length) return this.none(place, 'no workshop of that craft');
    const w = cand[Math.floor(this.hash(pid, place, 19) * cand.length)].w;
    return this.inPlot(this.plan.sites[w.si], w.pi, pid, place, indoor, 'town', undefined, what) ?? this.none(place, 'empty workshop');
  }
  private compound(pid: number, site: string, place: string, indoor: boolean, what: string): Spot {
    if (!this.plan) return this.none(place, 'no town'); const si = this.siteIx.get(site); if (si === undefined) return this.none(place, `${site} not built`);
    const s = this.plan.sites[si]; const pi = s.plots.findIndex(p => p.kind !== 'yard' && p.kind !== 'pen'); if (pi < 0) return this.none(place, 'no plot');
    return this.inPlot(s, pi, pid, place, indoor, 'town', undefined, what) ?? this.none(place, 'empty');
  }
  /** pastures: the state herdsmen's grazing grounds round the stockyard (lives.json shepherd pastures; places C), a
   *  village's grazing beyond its fields */
  private pasture(pid: number, tail: string, day: number): Spot {
    if (tail.startsWith('stockyard')) { const k = +(tail.split(':')[1] ?? 0), m = L.job_tasks.shepherd.v.pastures ?? 4, a = (k / m) * Math.PI * 2 + 0.4;
      return this.openNear([FAC.stockyard[0] + Math.cos(a) * 900, FAC.stockyard[1] + Math.sin(a) * 900], 90, pid, `pasture:${tail}`, `pasture ${k} of the state herds (C)`); }
    return this.outside(pid, tail, day, 350, 700, 'grazing beyond the fields (C)');
  }
  /** a plain household's field, the village threshing floor, vineyard and orchard: at the population's own offsets from
   *  the (mapped) house, so the walk out is as long as the plan's (C: which plot of the built fields) */
  private plainPlace(pid: number, head: string, tail: string, day: number): Spot {
    const parts = tail.split(':');
    if (head === 'field') { const hh = +parts[0], k = +(parts[1] ?? 0), m = this.villageOf(hh); if (!m) return this.none('field', 'village not built');
      const c = this.vsite(m.vi).comps[m.ci], o: P2 = [300 - k * 150, 200 + k * 120];
      return this.openNear([c.x + o[0], c.y + o[1]], 30, pid, `field:${tail}`, `field ${k} of household ${hh}`); }
    const H = this.pop.households[this.pop.home(pid, day)]; const vi = this.vmap.get(parts[0]) ?? (H.zone === 'plain' ? this.villageOf(H.id)?.vi : undefined); if (vi === undefined) return this.none(head, 'village not built');
    const v = this.villages[vi], base = (h32(this.seed, S.vil, salt(v.id)) / 4294967296) * Math.PI * 2, a = base + (head === 'threshing' ? 0 : head === 'vineyard' ? 2.1 : 4.2), d = v.r + (head === 'threshing' ? 45 : 260);
    return this.openNear([v.x + Math.cos(a) * d, v.y + Math.sin(a) * d], head === 'threshing' ? 14 : 45, pid, `${head}:${tail}`, `${head} of ${v.id} (C)`);
  }
  /** transhumant bands (E-49): camps and the day's stretch of road W of the town (C) */
  private band(pid: number, head: string, tail: string): Spot {
    const [b, k] = tail.split(':'), i = +(b?.replace('band', '') ?? 0), kk = +(k ?? 0);
    const c: P2 = head === 'camp' ? [-3000 - 250 * i, -300 + 180 * (i % 3) + 60 * kk] : [-3200 - 400 * kk, 300 + 150 * (i % 3)];
    return this.openNear(c, 60, pid, `${head}:${tail}`, `${head === 'camp' ? 'camp' : 'on the move'} of a transhumant band (C)`);
  }

  // -------------------------------------------------------------------------------------------------- for sightlines
  /** ground height at grid (e, n) (the terrain) */
  groundAt(e: number, n: number) { return this.ground(e, n); }
  /** every built village as a site raster (sightline.ts) */
  villageSites(): Site[] { return this.villages.map((_, vi) => this.vsite(vi).site); }

  // -------------------------------------------------------------------------------------------------- short steps
  /** a short straight step from a spot to a point stays walkable, crosses no wall and stays in the same kind of place: the
   *  same court or yard, open ground to open ground, the Terrace grid in line (popview.ts spreads people who would stand
   *  on one another) */
  stepClear(a: Spot, b: P2): boolean {
    if (a.net === 'nav') return this.nav.walkable(b[0], b[1]) && this.nav.lineClear([a.e, a.n], b);
    const within = (s: Site, la: P2, lb: P2) => { const ia = s.ci(la[0]), ja = s.cj(la[1]), ib = s.ci(lb[0]), jb = s.cj(lb[1]); if (!s.inb(ia, ja) || !s.inb(ib, jb)) return false;
      const ca = s.cell[s.k(ia, ja)], cb = s.cell[s.k(ib, jb)];
      if (openCode(ca) ? !openCode(cb) : cb !== ca || s.sub[s.k(ib, jb)] === ROOM) return false;
      return siteLine(s, la, lb, 0.25); };
    if (a.net === 'town' && this.town) { const la = this.town.locate(a.e, a.n), lb = this.town.locate(b[0], b[1]); if (!la || !lb || la.si !== lb.si) return false;
      return within(this.town.boxes[la.si].s, [la.u, la.v], [lb.u, lb.v]); }
    if (a.net === 'village' && a.v !== undefined) { const S = this.vsite(a.v).site; return within(S, toLocal(S.frame, a.e, a.n), toLocal(S.frame, b[0], b[1])); }
    // open ground: no plot of the town or a village entered, the Terrace's walls not climbed
    if (this.town) { const l = this.town.locate(b[0], b[1]); if (l && !openCode(this.town.boxes[l.si].s.cell[l.k])) return false; if (!this.town.clear([a.e, a.n], b)) return false; }
    const vi = this.villages.length ? this.villageAt(b[0], b[1]) : -1; if (vi >= 0) { const S = this.vsite(vi).site, [u, w] = toLocal(S.frame, b[0], b[1]); if (!openCode(S.cell[S.k(S.ci(u), S.cj(w))])) return false; }
    return this.navClear([a.e, a.n], b);
  }

  // -------------------------------------------------------------------------------------------------- routes
  /** ground height at a spot or route point */
  y(e: number, n: number, net?: Spot['net']): number { if (net === 'nav' || (net === undefined && this.inNav(e, n))) { const h = this.nav.heightAt(e, n); if (Number.isFinite(h)) return h; } return this.ground(e, n); }
  /** open ground inside the walkable grid's extent is crossed only at one level (no climbing the Terrace walls) */
  readonly navClear = (a: P2, b: P2): boolean => {
    const x0 = NAV.e0 + 1, x1 = NAV.e0 + NAV.w * NAV.cell - 1, y0 = NAV.n0 + 1, y1 = NAV.n0 + NAV.h * NAV.cell - 1;
    // clip the run to the grid's extent (Liang-Barsky), then march only the part inside
    const dx = b[0] - a[0], dy = b[1] - a[1]; let u0 = 0, u1 = 1;
    for (const [p, q] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dy, a[1] - y0], [dy, y1 - a[1]]] as const) {
      if (p === 0) { if (q < 0) return true; continue; } const r = q / p; if (p < 0) { if (r > u1) return true; if (r > u0) u0 = r; } else { if (r < u0) return true; if (r < u1) u1 = r; } }
    const L = Math.hypot(dx, dy) * (u1 - u0), steps = Math.max(1, Math.ceil(L / 0.25)); let pi = -1, pj = -1;
    for (let t = 0; t <= steps; t++) { const f = u0 + (u1 - u0) * t / steps, [i, j] = this.nav.ij(a[0] + dx * f, a[1] + dy * f); if (i === pi && j === pj) continue;
      if (!this.nav.okIJ(i, j)) return false; if (pi >= 0 && (Math.abs(i - pi) > 1 || Math.abs(j - pj) > 1 || !this.nav.move8(pi, pj, i, j))) return false; pi = i; pj = j; }
    return true;
  };
  /** spot to its anchor: straight by construction (terrace()); a bounded search otherwise (a point of the way) */
  private navLeg(a: P2, b: P2, max = 20_000): P2[] | null { if (this.nav.lineClear(a, b)) return [a, b]; return this.nav.findPath(a, b, max); }
  /** a Terrace route between two place anchors (cached; A* only within the step's budget) */
  private core(A: string, B: string): P2[] | null | undefined {
    const key = A < B ? `${A}>${B}` : `${B}>${A}`; let p = this.navCore.get(key);
    if (p === undefined) { if (this.navBudget <= 0) return undefined; this.navBudget--; this.stats.navSearches++;
      const pa = this.anchorPt(A), pb = this.anchorPt(B); p = pa && pb ? this.nav.findPath(pa, pb) : null; this.navCore.set(key, p); }
    return p && (A < B ? p : p.slice().reverse());
  }
  private anchorPt(a: string): P2 | null { if (a === '@stair') return this.stair; const A = this.abs[a], P = PLACES[a]; const c = A ? A.c : P?.at; return c ? this.nav.snap(c[0], c[1], 8) : null; }
  /** the walked route between two spots (grid polyline with cumulative lengths); null when there is none, undefined when
   *  the Terrace search budget of this step is spent (ask again) */
  route(a: Spot, b: Spot): Route | null | undefined {
    const key = `${a.e.toFixed(1)},${a.n.toFixed(1)}>${b.e.toFixed(1)},${b.n.toFixed(1)}`, hit = this.cache.get(key);
    if (hit !== undefined) { this.stats.cacheHits++; return hit; }
    const t0 = performance.now(); let pts: P2[] | null | undefined;
    const A: P2 = [a.e, a.n], B: P2 = [b.e, b.n];
    if (a.net === 'nav' && b.net === 'nav') pts = this.terraceRoute(A, a.anchor!, B, b.anchor!);
    else if (a.net === 'nav') { const t = this.terraceRoute(A, a.anchor!, this.stair, '@stair'); if (t === undefined) return undefined; const g = t && this.groundRoute(this.stair, B); pts = t && g ? [...t, ...g.slice(1)] : null; }
    else if (b.net === 'nav') { const t = this.terraceRoute(this.stair, '@stair', B, b.anchor!); if (t === undefined) return undefined; const g = t && this.groundRoute(A, this.stair); pts = t && g ? [...g, ...t.slice(1)] : null; }
    else pts = this.groundRoute(A, B);
    if (pts === undefined) return undefined;
    this.stats.routes++; this.stats.routeMs += performance.now() - t0; if (!pts) this.stats.routeFails++;
    const r = pts ? toRoute(pts) : null; if (this.cache.size > 40_000) this.cache.clear(); this.cache.set(key, r); return r;
  }
  private terraceRoute(A: P2, aa: string, B: P2, ba: string): P2[] | null | undefined {
    const pa = this.anchorPt(aa), pb = this.anchorPt(ba); if (!pa || !pb) return null;
    if (this.nav.lineClear(A, B)) return [A, B];
    const core = aa === ba ? [pa] : this.core(aa, ba); if (core === undefined) return undefined; if (!core) return null;
    const h = this.navLeg(A, core[0]), t = this.navLeg(core[core.length - 1], B); if (!h || !t) return null;
    return dedupe([...h, ...core.slice(1, -1), ...t]);
  }
  /** a route on the ground below the Terrace: in and out of villages, through the town's lanes, over open ground */
  private groundRoute(A: P2, B: P2): P2[] | null {
    const va = this.villages.length ? this.villageAt(A[0], A[1]) : -1, vb = this.villages.length ? this.villageAt(B[0], B[1]) : -1;
    if (va >= 0 && va === vb) return this.vsite(va).walk.route(A, B);
    let head: P2[] | null = [A], tail: P2[] | null = [B];
    if (va >= 0) head = this.vsite(va).walk.leave(A, B); if (!head) return null;
    const pa = head[head.length - 1];
    if (vb >= 0) { const t = this.vsite(vb).walk.leave(B, pa); tail = t && t.slice().reverse(); } if (!tail) return null;
    const pb = tail[0];
    const mid = this.town ? this.town.route(pa, pb, this.navClear) : [pa, pb]; if (!mid) return null;
    return dedupe([...head, ...mid.slice(1, -1), ...tail]);
  }
}
const dedupe = (pts: P2[]) => pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-3);
export function toRoute(pts: P2[]): Route {
  const n = pts.length, P = new Float64Array(n * 2), C = new Float64Array(n); let L = 0;
  for (let i = 0; i < n; i++) { P[i * 2] = pts[i][0]; P[i * 2 + 1] = pts[i][1]; if (i) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); C[i] = L; }
  return { pts: P, cum: C, len: L };
}
/** the point at distance d along a route, and the heading of its leg (deg cw from grid north) */
export function routeAt(r: Route, d: number, out: { e: number; n: number; heading: number }) {
  const n = r.cum.length; if (n === 1 || d <= 0) { out.e = r.pts[0]; out.n = r.pts[1]; if (n > 1) out.heading = headingOf(r.pts[2] - r.pts[0], r.pts[3] - r.pts[1]); return out; }
  if (d >= r.len) { out.e = r.pts[(n - 1) * 2]; out.n = r.pts[(n - 1) * 2 + 1]; out.heading = headingOf(r.pts[(n - 1) * 2] - r.pts[(n - 2) * 2], r.pts[(n - 1) * 2 + 1] - r.pts[(n - 2) * 2 + 1]); return out; }
  let lo = 0, hi = n - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (r.cum[m] <= d) lo = m; else hi = m; }
  const seg = r.cum[hi] - r.cum[lo], f = seg > 0 ? (d - r.cum[lo]) / seg : 0, ax = r.pts[lo * 2], ay = r.pts[lo * 2 + 1], bx = r.pts[hi * 2], by = r.pts[hi * 2 + 1];
  out.e = ax + (bx - ax) * f; out.n = ay + (by - ay) * f; out.heading = headingOf(bx - ax, by - ay); return out;
}
export { toGrid, rad };
