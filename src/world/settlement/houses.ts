// The town's houses as built (D-234; replaces D-228's PLACEHOLDER box slabs). Each plot's walls, rooms, court and doors
// come from the plan (site.ts / quarter.ts) and each household's life and fixtures from houseplan.ts; this module turns
// them into geometry at two levels of detail:
//  - NEAR (tiles of TILE m whose centre is within NEAR_R of the eye; built on demand, dropped when far): walls with their
//    real thickness on a stone footing, hand-plastered faces with a gentle bulge, repair patches, bare brick where the
//    plaster has gone, soot above the hearths; flat roofs of poplar poles, brush and packed earth with a 2 % fall, the eave
//    oversailing the court on the pole ends with a mud lip and a spout; ceilings of poles and matting inside; timber
//    lintels, stone thresholds and pivot stones; small high windows; porticoes, ladders, benches and each household's
//    things (houseplan.ts).
//  - FAR (one mesh per cluster, always drawn): walls and roofs as plain boxes with the eave's shadow line; the tiles that
//    are drawn NEAR are collapsed in its vertex shader (a per-vertex tile id looked up in a state texture the CPU sets when
//    it swaps in the merged near meshes), so every house is drawn exactly once, near or far; its shadow pass is not
//    collapsed (castShadowPositionNode): the far level casts the near houses' shadows too.
// Street door leaves are the town door system (TownDoors, build.ts): instanced, turning on their pivot posts, shut at night.
// Every face carries an owner: (plot or fixture description index) × 32 + part, so F3 names the house, the part, its tier
// and its sources (HOUSE_PARTS). All tier C: no house of Achaemenid Fars is excavated; the analogues are named per part.
import { Batch, RGB, lin } from './geom';
import { Site, Plot, Wall, ROOF_T, DOOR_H, P2, ROOM, COURT, YARD } from './site';
import { hashString } from '../../core/rng';
import { fixturesOf, livesOf, HOUSE_KINDS, type Fixture, type HouseLife } from './houseplan';

/** tile size (m, site-local) and the near radius (m, from the eye to a tile's centre) */
export const TILE = 32, NEAR_R = 72;
/** the roof build-up (m): poplar poles, battens and brush, packed earth with a clay-and-straw coat (ROOF_T = 0.35, C) */
export const ROOF = { beam: 0.16, brush: 0.07, fall: 0.02, over: [0.24, 0.38] as [number, number], lip: 0.09, gap: [0.42, 0.58] as [number, number] };

export interface PartDef { tier: string; src: string; note: string }
/** what F3 says of each part (D-234; SETTLEMENT.md §8 has the table with its sources) */
export const HOUSE_PARTS: PartDef[] = [
  { tier: 'C', src: 'RECON', note: '' },
  { tier: 'C', src: 'IR-BRICK;STEIN2016;RECON', note: 'wall of sun-dried mud brick (Achaemenid bricks ~33 cm square: Iranica, search extract, B), two bricks and a render thick (0.7 m outer, 0.55 m to the court, 0.4 m between rooms; C), faced with straw-tempered mud plaster (earthen plaster at Pasargadae and Persepolis: Stein et al. 2016, B), a renewed skirting coat, damp and salt at the foot (D-218, C); the plaster hand-laid, not flat (±1-2 cm, C)' },
  { tier: 'C', src: 'HASANLU-SX;BABAJAN-SX;TALLTAKHT-SX;RECON', note: 'footing of rough fieldstones laid in mud under the brick (stone foundations under mud-brick walls at Hasanlu, Baba Jan and Tall-i Takht: search extracts, B analogues; its height above the lane, 0.2-0.6 m by the house, C)' },
  { tier: 'C', src: 'MESO-HOUSE-SX;HASANLU-SX;IR-VERNROOF-SX;RECON', note: 'flat roof: poplar poles spanning the room (the region\'s flat roof: poles of up to ~4 m, cross battens, brush or straw, mud laid to a fall: search extract, C analogy; reed impressions in roof collapse at Hasanlu, B analogue; Babylonian roofs "of mud over layers of matting laid on a framework of wooden rafters": search extract, B analogue), a clay-and-straw finish coat, a 2 % fall to the spout (C)' },
  { tier: 'C', src: 'IR-VERNROOF-SX;HASANLU-SX;RECON', note: 'the eave: the roof oversails the court wall by 0.24-0.38 m on the pole ends, brush and earth over them and a mud lip along the edge (C)' },
  { tier: 'C', src: 'MESO-HOUSE-SX;HASANLU-SX;RECON', note: 'ceiling: poplar poles every ~0.5 m with matting over them, seen from below (C)' },
  { tier: 'C', src: 'MESO-HOUSE-SX;HASANLU-SX;RECON', note: 'doorway: a timber lintel over a 1 m opening (wooden doorjambs and lintels at Hasanlu, B analogue), a stone threshold worn in the middle and the pivot stone of the door (Babylonian doors "swung on doorposts set in sockets of brick or stone": search extract, B analogue; C here)' },
  { tier: 'C', src: 'MESO-HOUSE-SX;RECON', note: 'a small high window or vent, unglazed (glazed panes are blocklisted), under a timber lintel; size and number C' },
  { tier: 'C', src: 'MESO-HOUSE-SX;RECON', note: 'a hollowed timber spout throwing the roof water clear of the wall (C; roof drainage by spouts is the region\'s vernacular, RECOLLECTION)' },
  { tier: 'C', src: 'HASANLU-SX;BABAJAN-SX;NUSHIJAN-SX;RECON', note: 'portico: timber posts on rough stone bases carrying a beam and a roof like the rooms\' (paired wooden portico columns at Hasanlu Burned Building II, wooden columns on uncarved stone slab bases: search extracts, B analogues; in a large town house C)' },
  { tier: 'C', src: 'MESO-HOUSE-SX;HASANLU-SX;RECON', note: 'a poplar ladder to the roof (C)' },
  { tier: 'C', src: 'TOLAJORI2017;HASANLU-SX;RECON', note: 'a mud-brick bench (C; low benches along walls at Tol-e Ajori and Hasanlu: B analogues)' },
  { tier: 'C', src: 'RECON', note: '' },
  { tier: 'C', src: 'RECON', note: 'repairs: a patch of fresh plaster, or bare brick where the plaster has fallen (C; the house\'s age and the household\'s care set how much)' },
  { tier: 'C', src: 'RECON', note: 'soot from the hearth or the oven on the wall above it (C)' },
  { tier: 'C', src: 'MESO-HOUSE-SX;RECON', note: 'street door: a leaf of poplar planks on battens, turning on a pivot post in a stone socket (B analogue: Babylonian doors on doorposts in sockets), shut and barred at night, open, ajar or shut by day by the household (C)' },
];
export const P = { whole: 0, wall: 1, socle: 2, roof: 3, eave: 4, ceiling: 5, door: 6, window: 7, spout: 8, portico: 9, ladder: 10, bench: 11, fixture: 12, repair: 13, soot: 14, leaf: 15 } as const;

const MUD: RGB = [0.56, 0.47, 0.36], POLE: RGB = [0.5, 0.43, 0.34], BRUSH: RGB = [0.52, 0.45, 0.31], MAT: RGB = [0.5, 0.43, 0.3], STONE: RGB = [0.53, 0.51, 0.47];
const sh = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
const mixc = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smooth = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
/** hash of integers to [0, 1) */
const hi = (...a: number[]) => { let h = 2166136261 >>> 0; for (const x of a) { h ^= Math.floor(x) | 0; h = Math.imul(h, 16777619) >>> 0; h ^= h >>> 13; } return (h >>> 0) / 4294967296; };
/** smooth value noise in 2D (0..1) */
function vn(x: number, y: number, seed = 0) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hi(ix, iy, seed), b = hi(ix + 1, iy, seed), c = hi(ix, iy + 1, seed), d = hi(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** the season a day of the world's year shows on the houses (day 0 ≈ the start of Nisannu, late March; C): the harvest
 *  (grain drying on the roofs, nights on the roof) from mid-May to early July, the warm months (nights on the roof) to
 *  mid-September, else the cold */
export function seasonOf(day: number): 'harvest' | 'warm' | 'cold' { const d = ((day % 360) + 360) % 360; return d >= 45 && d < 100 ? 'harvest' : d >= 100 && d < 170 ? 'warm' : 'cold'; }
/** a street doorway's own measures (hash of the plot id; C): the lintel up to 15 cm under the plan's 2 m head (the leaf is
 *  cut to fit), its depth and bearing, a doorstep outside (40 %), a lamp niche beside it (75 %) */
export function doorVar(id: string) { const h = (k: number) => hashString(`${id}:door:${k}`) / 4294967296;
  return { drop: 0.15 * h(1), lh: 0.1 + 0.07 * h(2), bear: 0.15 + 0.17 * h(3), step: h(4) < 0.4 ? 1 : 0, niche: h(5) < 0.75 ? 1 : 0 }; }
/** the batches a build writes into */
export interface HB { plaster: Batch; stone: Batch; timber: Batch; brick: Batch; items: Batch; props: Batch }
export const plasterBatch = (far = false) => { const b = new Batch().addAttr('y0', 1, [-1000]).addAttr('ytop', 1, [1e4]).addAttr('ao', 1, [1]); if (far) b.addAttr('tileId', 1, [0]); return b; };
export const plainBatch = () => new Batch().addAttr('ao', 1, [1]);
export const newHB = (): HB => ({ plaster: plasterBatch(), stone: plainBatch(), timber: plainBatch(), brick: plainBatch(), items: plasterBatch(), props: plainBatch() });

interface Side { cls: 'room' | 'court' | 'open'; plot: number; roof: number }
interface RoomEl { plot: number; room: number; i0: number; j0: number; i1: number; j1: number; full: boolean; drain: number; eave: number; tile: number; R: number; fall: number }
interface WallEl { w: Wall; tile: number; plot: number; room: number; street: boolean }
interface Hole { s0: number; s1: number; y0: number; y1: number; through: boolean; depth: number; col?: RGB }
interface Dec { s0: number; s1: number; y0: number; y1: number; kind: 'patch' | 'bare' | 'soot' | 'streak' | 'dung' | 'stain'; seed: number; k?: number }
/** a street door as the door system needs it (grid e, n; world y) */
export interface StreetDoor { id: string; plot: number; tile: number; hinge: P2; theta: number; closedYaw: number; openYaw: number; y: number; h: number; wood: number; kind: string; site: string }

export class SiteHouses {
  readonly walls: WallEl[] = []; readonly rooms: RoomEl[] = [];
  readonly roomOf = new Map<number, number>();
  readonly tiles = new Map<number, { c: P2; x: number; z: number }>();
  readonly plotTile: Int32Array; readonly big: Uint8Array;
  readonly lives: HouseLife[]; readonly fixtures: Fixture[]; readonly fixDesc: number[] = [];
  readonly doors: StreetDoor[] = [];
  private fixByPlot = new Map<number, Fixture[]>(); private fitByPlot = new Map<number, Site['fittings']>(); private wallsByTile = new Map<number, WallEl[]>(); private roomsByTile = new Map<number, RoomEl[]>();
  private cs: number; private sn: number;
  constructor(readonly s: Site, readonly si: number, readonly H: (e: number, n: number) => number, readonly base: Float32Array, readonly local: Uint8Array, readonly pcol: RGB[], readonly pdesc: Int32Array, desc: { tier: string; src: string; note: string }[]) {
    this.cs = Math.cos(s.frame.theta); this.sn = Math.sin(s.frame.theta);
    this.lives = livesOf(s); this.fixtures = fixturesOf(s);
    this.plotTile = new Int32Array(s.plots.length); this.big = new Uint8Array(s.plots.length);
    for (const p of s.plots) { const [i0, j0, i1, j1] = p.rect; this.big[p.idx] = p.area > 1500 || !HOUSE_KINDS.has(p.kind) && p.area > 600 ? 1 : 0; this.plotTile[p.idx] = this.tileAt(s.u0 + (i0 + i1) / 2, s.v0 + (j0 + j1) / 2); }
    for (const f of this.fixtures) { this.fixDesc.push(desc.length); desc.push({ tier: 'C', src: 'RECON', note: `${s.plots[f.plot].id}: ${f.note}` }); }
    // rooms: one element per room id (its cells' box; `full` when the room fills it)
    const rc = new Map<number, number[]>();
    for (let k = 0; k < s.cell.length; k++) if (s.cell[k] >= 0 && s.sub[k] === ROOM) { const r = s.room[k]; (rc.get(r) ?? rc.set(r, []).get(r)!).push(k); }
    for (const [room, ks] of rc) { let i0 = 1e9, j0 = 1e9, i1 = -1, j1 = -1; for (const k of ks) { const i = k % s.W, j = (k / s.W) | 0; i0 = Math.min(i0, i); j0 = Math.min(j0, j); i1 = Math.max(i1, i + 1); j1 = Math.max(j1, j + 1); }
      const plot = s.cell[ks[0]], full = ks.length === (i1 - i0) * (j1 - j0);
      // the drain side: the side whose outside cells are most of them this plot's court (else open ground)
      const sideCells = (sd: number) => { const out: number[] = []; if (sd < 2) { const j = sd === 0 ? j0 - 1 : j1; for (let i = i0; i < i1; i++) out.push(s.inb(i, j) ? s.k(i, j) : -1); } else { const i = sd === 2 ? i0 - 1 : i1; for (let j = j0; j < j1; j++) out.push(s.inb(i, j) ? s.k(i, j) : -1); } return out; };
      let drain = -1, bestC = 0, eave = 0;
      for (let sd = 0; sd < 4; sd++) { const cells = sideCells(sd); const court = cells.filter(k => k >= 0 && s.cell[k] === plot && (s.sub[k] === COURT || s.sub[k] === YARD)).length;
        if (full && court === cells.length) eave |= 1 << sd; if (court > bestC) { bestC = court; drain = sd; } }
      if (drain < 0) for (let sd = 0; sd < 4; sd++) { const cells = sideCells(sd); const open = cells.filter(k => k < 0 || s.cell[k] < 0).length; if (open > bestC) { bestC = open; drain = 4 + sd; } }
      const u = s.u0 + (i0 + i1) / 2, v = s.v0 + (j0 + j1) / 2;
      this.roomOf.set(room, this.rooms.length);
      const dr = drain % 4, fall = drain >= 0 && full ? Math.min(0.08, ROOF.fall * (dr < 2 ? j1 - j0 : i1 - i0)) : 0;
      this.rooms.push({ plot, room, i0, j0, i1, j1, full, drain, eave, tile: this.big[plot] ? this.tileAt(u, v) : this.plotTile[plot], R: base[plot] + s.plots[plot].height, fall });
    }
    // walls (facade runs split per room, so each piece knows whether its room oversails it)
    const streetEdges = new Set<number>(); for (const p of s.plots) if (p.door) streetEdges.add(s.edgeBetween(p.door.cell, p.door.out));
    for (const w of s.walls()) {
      const pieces: Wall[] = [];
      if (w.kind === 'facade' && !w.door) { const ax = w.v0 === w.v1 ? 0 : 1, a = ax ? w.v0 : w.u0, b = ax ? w.v1 : w.u1; let cur = a, room = -2;
        for (let x = Math.floor(a - (ax ? s.v0 : s.u0) + 1e-6); x < Math.ceil(b - (ax ? s.v0 : s.u0) - 1e-6); x++) { const r = this.roomAcross(w, x); const sx = Math.max(a, (ax ? s.v0 : s.u0) + x);
          if (room !== -2 && r !== room) { pieces.push({ ...w, ...(ax ? { v0: cur, v1: sx } : { u0: cur, u1: sx }) }); cur = sx; } room = r; }
        pieces.push({ ...w, ...(ax ? { v0: cur, v1: b } : { u0: cur, u1: b }) });
      } else pieces.push(w);
      for (const pw of pieces) { if (Math.hypot(pw.u1 - pw.u0, pw.v1 - pw.v0) < 0.01) continue; const plot = pw.sides[0].plot, mu = (pw.u0 + pw.u1) / 2, mv = (pw.v0 + pw.v1) / 2;
        const ax = pw.v0 === pw.v1 ? 0 : 1, x = Math.floor((ax ? mv - s.v0 : mu - s.u0)); const room = pw.kind === 'facade' ? this.roomAcross(pw, x) : -1;
        let street = false; if (pw.door) { const e = this.edgeOf(pw); street = e >= 0 && streetEdges.has(e); }
        this.walls.push({ w: pw, tile: this.big[plot] ? this.tileAt(mu, mv) : this.plotTile[plot], plot, room, street }); }
    }
    // street doors (the door system): hinge on the inner face at the jamb the life names, leaf across the opening
    for (const p of s.plots) { if (!p.door || p.kind === 'garden') continue; const d = s.doorPoints(p)!; const nu = d.inside[0] - d.out[0], nv = d.inside[1] - d.out[1]; // inward (unit, axis)
      const t = p.outerT / 2 + 0.04, hs = this.lives[p.idx]?.hinge ?? 1; const tu = -nv * hs, tv = nu * hs; // along the wall toward the hinge jamb
      const hu = d.mid[0] + nu * t + tu * 0.5, hv = d.mid[1] + nv * t + tv * 0.5, g = s.grid(hu, hv);
      const yawIn = Math.atan2(nv, nu), yawAlong = Math.atan2(-tv, -tu); // closed: the leaf runs from the hinge back across the opening
      const worldYaw = (lu: number, lv: number) => { const [a, b] = this.dirW(lu, lv); return Math.atan2(-b, a); };
      this.doors.push({ id: `${s.id}:${p.id}`, plot: p.idx, tile: this.plotTile[p.idx], hinge: g, theta: s.frame.theta, closedYaw: worldYaw(Math.cos(yawAlong), Math.sin(yawAlong)), openYaw: worldYaw(Math.cos(yawIn), Math.sin(yawIn)), y: this.gl(d.mid[0], d.mid[1]) + 0.035, h: Math.max(1.6, base[p.idx] + DOOR_H - doorVar(p.id).drop - this.gl(d.mid[0], d.mid[1]) - 0.06), wood: this.lives[p.idx]?.doorWood ?? 0.5, kind: p.kind, site: s.id }); }
    for (const t of new Set([...this.walls.map(w => w.tile), ...this.rooms.map(r => r.tile)])) this.tileInfo(t);
    for (const f of this.fixtures) (this.fixByPlot.get(f.plot) ?? this.fixByPlot.set(f.plot, []).get(f.plot)!).push(f);
    for (const f of s.fittings) if (f.plot >= 0) (this.fitByPlot.get(f.plot) ?? this.fitByPlot.set(f.plot, []).get(f.plot)!).push(f);
    for (const w of this.walls) (this.wallsByTile.get(w.tile) ?? this.wallsByTile.set(w.tile, []).get(w.tile)!).push(w);
    for (const r of this.rooms) (this.roomsByTile.get(r.tile) ?? this.roomsByTile.set(r.tile, []).get(r.tile)!).push(r);
  }
  // ---- frames -------------------------------------------------------------------------------------------------------
  tileAt(u: number, v: number) { const ti = Math.floor((u - this.s.u0) / TILE), tj = Math.floor((v - this.s.v0) / TILE); return this.si * 4096 + ti * 64 + tj; }
  tileInfo(t: number) { let x = this.tiles.get(t); if (!x) { const ti = ((t % 4096) / 64) | 0, tj = t % 64; const c = this.s.grid(this.s.u0 + (ti + 0.5) * TILE, this.s.v0 + (tj + 0.5) * TILE); x = { c, x: c[0], z: -c[1] }; this.tiles.set(t, x); } return x; }
  /** local (u, v, y) → world [x, y, z] */
  wp(u: number, v: number, y: number): number[] { const f = this.s.frame.c; return [f[0] + u * this.cs - v * this.sn, y, -(f[1] + u * this.sn + v * this.cs)]; }
  /** local direction → world [x, z] */
  dirW(du: number, dv: number): [number, number] { return [du * this.cs - dv * this.sn, -(du * this.sn + dv * this.cs)]; }
  gl(u: number, v: number) { const g = this.s.grid(u, v); return this.H(g[0], g[1]); }
  private cellAt(u: number, v: number) { const i = Math.floor(u - this.s.u0), j = Math.floor(v - this.s.v0); return this.s.inb(i, j) ? this.s.k(i, j) : -1; }
  private edgeOf(w: Wall) { const s = this.s, ax = w.v0 === w.v1 ? 0 : 1; if (ax === 0) { const i = Math.floor((w.u0 + w.u1) / 2 - s.u0), j = Math.round(w.v0 - s.v0); return j > 0 && s.inb(i, j) ? s.eh(i, j - 1) : -1; } const i = Math.round(w.u0 - s.u0), j = Math.floor((w.v0 + w.v1) / 2 - s.v0); return i > 0 && s.inb(i, j) ? s.ev(i - 1, j) : -1; }
  /** the room on the ROOM side of a facade wall at cell x along it */
  private roomAcross(w: Wall, x: number) { const s = this.s, ax = w.v0 === w.v1 ? 0 : 1; for (const sg of [-0.5, 0.5]) { const k = ax === 0 ? this.cellAt(s.u0 + x + 0.5, w.v0 + sg) : this.cellAt(w.u0 + sg, s.v0 + x + 0.5); if (k >= 0 && s.cell[k] >= 0 && s.sub[k] === ROOM) return s.room[k]; } return -1; }
  private side(w: Wall, sg: number): Side {
    const s = this.s, ax = w.v0 === w.v1 ? 0 : 1, mu = (w.u0 + w.u1) / 2, mv = (w.v0 + w.v1) / 2, k = ax === 0 ? this.cellAt(mu, mv + sg * 0.5) : this.cellAt(mu + sg * 0.5, mv);
    if (k < 0 || s.cell[k] < 0) return { cls: 'open', plot: -1, roof: -1e9 };
    const pl = s.cell[k]; return s.sub[k] === ROOM ? { cls: 'room', plot: pl, roof: this.base[pl] + s.plots[pl].height } : { cls: 'court', plot: pl, roof: -1e9 };
  }
  /** a wall's foot and top as the plan builds it (the far level; build.ts before D-234) */
  wallSpan(w: Wall) {
    const s = this.s, g0 = s.grid(w.u0, w.v0), g1 = s.grid(w.u1, w.v1), gm = s.grid((w.u0 + w.u1) / 2, (w.v0 + w.v1) / 2);
    const hA = this.H(g0[0], g0[1]), hB = this.H(g1[0], g1[1]), hM = this.H(gm[0], gm[1]), gmin = Math.min(hA, hB, hM), gmax = Math.max(hA, hB, hM);
    let top = -Infinity, doorBase = Infinity; for (const sd of w.sides) { const b = this.local[sd.plot] ? gmin : this.base[sd.plot]; top = Math.max(top, b + sd.top); doorBase = Math.min(doorBase, b); }
    return { gmin, gmax, top: Math.max(top, gmax + 0.9), y0: gmin - 0.4, doorBase, gm };
  }
  private owner(plot: number, part: number) { return (plot >= 0 ? this.pdesc[plot] : 0) * 32 + part; }
  private life(plot: number): HouseLife { return this.lives[plot] ?? { standing: 0.4, age: 20, sincePlaster: 6, socle: 0.3, animal: null, addition: -1, patches: 0.5, bare: 0, doorWood: 0.5, hinge: 1 }; }
  /** the plaster tone of a plot's wall at height y above its ground, facing a court (c = 1) or the lane (c = 0) */
  private tone(plot: number, court: number, add: boolean): RGB {
    const L = this.life(plot), c = plot >= 0 ? this.pcol[plot] : lin(MUD);
    const fresh = Math.max(0, 1 - L.sincePlaster / 18); // damp-dark and warmer when fresh, paler and greyer as it weathers
    let k = (0.96 + 0.05 * (1 - fresh)) * (court ? 1.02 : 0.99); if (add) k *= 1.05;
    return [c[0] * k * (1 + 0.02 * fresh), c[1] * k, c[2] * k * (1 - 0.03 * fresh) * (add ? 0.96 : 1)];
  }

  // ---- the far level ---------------------------------------------------------------------------------------------------
  /** every wall (partitions under the roofs left out), roof and large fitting of the site as plain boxes, each vertex tagged
   *  with its tile's centre (collapsed while the tile is drawn near) */
  buildFar(b: Batch) {
    const s = this.s, th = s.frame.theta;
    for (const we of this.walls) { const w = we.w; if (w.kind === 'partition') continue;
      b.set('tileId', we.tile + 1); // (texel 0 is never near: see build.ts NEAR_STATE)
      const sp = this.wallSpan(w), along = w.v0 === w.v1, len = along ? w.u1 - w.u0 : w.v1 - w.v0, hu = along ? len / 2 : w.thick / 2, hv = along ? w.thick / 2 : len / 2;
      const c = this.tone(we.plot, 0, false); b.set('y0', sp.gmin).set('ytop', sp.top).set('ao', 1);
      if (w.door) { const yl = Math.max(sp.doorBase, sp.gmax) + DOOR_H; if (sp.top - yl > 0.05) b.box(sp.gm[0], sp.gm[1], th, hu, hv, yl, sp.top, sh(c, 0.9), c, this.owner(we.plot, P.door)); continue; }
      b.box(sp.gm[0], sp.gm[1], th, hu, hv, sp.y0, sp.top, sh(c, 0.8), c, this.owner(we.plot, P.wall));
      // the eave's shadow line over a court facade (the roof oversailing the wall)
      if (w.kind === 'facade' && we.room >= 0) { const r = this.rooms[this.roomOf.get(we.room)!]; const sgn = this.courtSign(w); if (r && sgn) { const R = r.R, o = ROOF.over[0] + 0.05;
        const off = w.thick / 2 + o / 2, cu = (w.u0 + w.u1) / 2 + (along ? 0 : sgn * off), cv = (w.v0 + w.v1) / 2 + (along ? sgn * off : 0), g = s.grid(cu, cv);
        b.box(g[0], g[1], th, along ? len / 2 : o / 2, along ? o / 2 : len / 2, R - ROOF_T + ROOF.beam, R - r.fall - 0.012, sh(c, 0.7), c, this.owner(we.plot, P.eave)); } }
    }
    for (const r of this.rooms) { b.set('tileId', r.tile + 1).set('y0', -1000).set('ytop', 1e4).set('ao', 1);
      const c = this.pcol[r.plot], g = s.grid(s.u0 + (r.i0 + r.i1) / 2, s.v0 + (r.j0 + r.j1) / 2);
      b.box(g[0], g[1], th, (r.i1 - r.i0) / 2, (r.j1 - r.j0) / 2, r.R - ROOF_T, r.R - r.fall - 0.012, sh(c, 0.8), c, this.owner(r.plot, P.roof)); }
  }
  /** +1 / −1: the side of a facade wall its court lies on (across the wall), 0 if none */
  private courtSign(w: Wall) { for (const sg of [1, -1]) { const sd = this.side(w, sg); if (sd.cls === 'court') return sg; } return 0; }
  /** the tile of a site fitting or fixture */
  tileOfPlotEl(plot: number, u: number, v: number) { return plot < 0 || this.big[plot] ? this.tileAt(u, v) : this.plotTile[plot]; }

  // ---- the near level --------------------------------------------------------------------------------------------------
  /** everything of one tile at full detail */
  buildTile(tile: number, B: HB, day = 0) { const g = this.tileSteps(tile, B, day); while (!g.next().done) { /* all at once */ } }
  /** the same, a wall, a room or the fixtures at a time (the prefetch ring is built across frames, B59) */
  *tileSteps(tile: number, B: HB, day = 0): Generator<void, void, void> {
    for (const we of this.wallsByTile.get(tile) ?? []) { this.day = day; this.wallNear(we, B); yield; }
    for (const r of this.roomsByTile.get(tile) ?? []) { this.day = day; this.roomNear(r, B); yield; }
    this.day = day; this.fixturesNear(tile, B);
  }
  /** the day of the year the near tiles show (seasonal things on the roofs) */
  private day = 0;
  /** face plane geometry of a wall: axis 0 = along u, 1 = along v; `cc` = the wall's centre line across; the face at
   *  cc + sg · (t / 2 + d) */
  private face(b: Batch, o: { ax: number; sA: number; sB: number; cc: number; t: number; sg: number; yb: (s: number) => number; yt: (s: number) => number; holes: Hole[]; bulge: number; seed: number;
    col: (s: number, y: number) => RGB; owner: number; ao: (y: number) => number; y0: (s: number) => number; ytop: number; off?: number; st2?: number[] }) {
    const { ax, sA, sB, cc, t, sg } = o, off = o.off ?? 0;
    if (sB - sA < 0.01) return;
    const st = [sA, sB]; for (const h of o.holes) st.push(Math.max(sA, Math.min(sB, h.s0)), Math.max(sA, Math.min(sB, h.s1)));
    const step = o.bulge ? 1.3 : 3.0, n = Math.ceil((sB - sA) / step); for (let i = 1; i < n; i++) st.push(sA + ((sB - sA) * i) / n);
    for (const x of o.st2 ?? []) if (x > sA && x < sB) st.push(x);
    const S = [...new Set(st.map(x => +x.toFixed(4)))].sort((a, b2) => a - b2);
    const yLo = Math.min(o.yb(sA), o.yb(sB)), yHi = Math.max(o.yt(sA), o.yt(sB));
    const brk: number[] = []; for (const h of o.holes) brk.push(h.y0, h.y1); if (o.bulge) for (let y = Math.ceil(yLo) + 0.2; y < yHi; y += 1.2) brk.push(y);
    const BR = [...new Set(brk.map(x => +x.toFixed(4)))].sort((a, b2) => a - b2);
    const inHole = (sm: number, ym: number) => o.holes.some(h => sm > h.s0 && sm < h.s1 && ym > h.y0 && ym < h.y1);
    const T3 = ax === 0 ? this.dirW(1, 0) : this.dirW(0, 1), N3 = ax === 0 ? this.dirW(0, sg) : this.dirW(sg, 0);
    const disp = (x: number, y: number) => { if (!o.bulge) return 0; let tp = Math.min(smooth((x - sA) / 0.3), smooth((sB - x) / 0.3), smooth((o.yt(x) - y) / 0.25), smooth((y - o.yb(x) - 0.05) / 0.3));
      for (const h of o.holes) { const dx = Math.max(h.s0 - x, 0, x - h.s1), dy = Math.max(h.y0 - y, 0, y - h.y1); tp = Math.min(tp, smooth(Math.hypot(dx, dy) / 0.25)); }
      return o.bulge * tp * ((vn(x * 0.9 + o.seed, y * 0.9) * 0.7 + vn(x * 2.3 + o.seed * 1.7, y * 2.3 + 5) * 0.3) * 2 - 1); };
    // each vertex once (shared by up to four quads): position and normal (forward differences of the bulge)
    const cache = new Map<number, [number[], number[]]>(), N0 = [N3[0], 0, N3[1]];
    const vert = (x: number, y: number) => { const key = Math.round(x * 1000) * 1e7 + Math.round(y * 1000); let c = cache.get(key); if (c) return c;
      const d0 = disp(x, y), a = t / 2 + d0 + off; const [u, v] = ax === 0 ? [x, cc + sg * a] : [cc + sg * a, x]; let nrm = N0;
      if (o.bulge) { const e = 0.08, ds = (disp(x + e, y) - d0) / e, dy = (disp(x, y + e) - d0) / e; const nx = N3[0] - T3[0] * ds, nz = N3[1] - T3[1] * ds, ny = -dy, L = Math.hypot(nx, ny, nz); nrm = [nx / L, ny / L, nz / L]; }
      c = [this.wp(u, v, y), nrm]; cache.set(key, c); return c; };
    b.hook('ao', (_x, y) => o.ao(y)); b.set('ytop', o.ytop);
    for (let c = 0; c + 1 < S.length; c++) { const a = S[c], z = S[c + 1], sm = (a + z) / 2; if (z - a < 0.005) continue;
      b.set('y0', o.y0(sm));
      const ybA = o.yb(a), ybZ = o.yb(z), ytA = o.yt(a), ytZ = o.yt(z); if (ytA - ybA < 0.005 && ytZ - ybZ < 0.005) continue;
      const rows = BR.filter(y => y > Math.max(ybA, ybZ) + 0.01 && y < Math.min(ytA, ytZ) - 0.01);
      const lev: [number, number][] = [[ybA, ybZ], ...rows.map(y => [y, y] as [number, number]), [ytA, ytZ]];
      for (let r = 0; r + 1 < lev.length; r++) { const [y0a, y0z] = lev[r], [y1a, y1z] = lev[r + 1]; if (inHole(sm, (y0a + y1a) / 2)) continue;
        const A = vert(a, y0a), Bv = vert(z, y0z), C = vert(z, y1z), D = vert(a, y1a);
        b.quadN(A[0], Bv[0], C[0], D[0], A[1], Bv[1], C[1], D[1], o.col(a, y0a), o.col(z, y0z), o.col(z, y1z), o.col(a, y1a), o.owner); } }
    b.hook('ao', undefined); b.set('ao', 1);
  }
  /** a box in site-local axes (u, v) with its own y range: centre (u, v), half sizes; faces ±u, ±v, top (and bottom) */
  private lbox(b: Batch, u: number, v: number, hu: number, hv: number, y0: number, y1: number, cb: RGB, ct: RGB, owner: number, bottom = false, rot = 0) {
    const g = this.s.grid(u, v); b.box(g[0], g[1], this.s.frame.theta + rot, hu, hv, y0, y1, cb, ct, owner, bottom);
  }
  /** a round pole (prism) between two world points */
  pole(b: Batch, A: number[], Bp: number[], r: number, sides: number, c: RGB, owner: number, caps: boolean | 'end' = true) {
    const d = [Bp[0] - A[0], Bp[1] - A[1], Bp[2] - A[2]], L = Math.hypot(d[0], d[1], d[2]); if (L < 1e-4) return; const w = d.map(x => x / L);
    const up = Math.abs(w[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0]; let e1 = [w[1] * up[2] - w[2] * up[1], w[2] * up[0] - w[0] * up[2], w[0] * up[1] - w[1] * up[0]]; const l1 = Math.hypot(e1[0], e1[1], e1[2]); e1 = e1.map(x => x / l1);
    const e2 = [w[1] * e1[2] - w[2] * e1[1], w[2] * e1[0] - w[0] * e1[2], w[0] * e1[1] - w[1] * e1[0]];
    const ring = (P: number[], k: number) => { const a = (k / sides) * Math.PI * 2; const cx = Math.cos(a), sx = Math.sin(a); return [P[0] + (e1[0] * cx + e2[0] * sx) * r, P[1] + (e1[1] * cx + e2[1] * sx) * r, P[2] + (e1[2] * cx + e2[2] * sx) * r]; };
    const nrm = (k: number) => { const a = (k / sides) * Math.PI * 2; return [e1[0] * Math.cos(a) + e2[0] * Math.sin(a), e1[1] * Math.cos(a) + e2[1] * Math.sin(a), e1[2] * Math.cos(a) + e2[2] * Math.sin(a)]; };
    const cd = sh(c, 0.92);
    for (let k = 0; k < sides; k++) b.quadN(ring(A, k), ring(A, k + 1), ring(Bp, k + 1), ring(Bp, k), nrm(k), nrm(k + 1), nrm(k + 1), nrm(k), c, c, cd, cd, owner);
    if (caps) { b.poly(Array.from({ length: sides }, (_, k) => ring(Bp, k)), w, sh(c, 1.08), owner); if (caps !== 'end') b.poly(Array.from({ length: sides }, (_, k) => ring(A, k)), w.map(x => -x), sh(c, 1.08), owner); }
  }

  /** a wall at full detail: footing, plastered faces (bulge, holes, patches), a worn cap on exposed tops, lintels and
   *  thresholds at doors */
  private wallNear(we: WallEl, B: HB) {
    const s = this.s, w = we.w, ax = w.v0 === w.v1 ? 0 : 1, sA = ax === 0 ? w.u0 : w.v0, sB = ax === 0 ? w.u1 : w.v1, cc = ax === 0 ? w.v0 : w.u0, t = w.thick, len = sB - sA;
    const sp = this.wallSpan(w), L = this.life(we.plot), seed = hi(Math.round(sA * 10), Math.round(cc * 10), this.si) * 100;
    const P2l = (sx: number, off: number): [number, number] => (ax === 0 ? [sx, cc + off] : [cc + off, sx]);
    const house = we.plot >= 0 && HOUSE_KINDS.has(s.plots[we.plot].kind);
    // the top: the plan's, lowered under the roof where the room's eave oversails a court facade
    let top = sp.top, eaveCourt = 0;
    if (w.kind === 'facade' && we.room >= 0) { const r = this.rooms[this.roomOf.get(we.room)!]; const sg = this.courtSign(w); if (r && sg && this.eaveOn(r, w, sg)) { top = r.R - ROOF_T; eaveCourt = sg; } }
    const sides = [this.side(w, -1), this.side(w, 1)];
    const exposedTop = sides.every(sd => sd.cls !== 'room' || top > sd.roof + 0.05) && !eaveCourt && w.kind !== 'partition';
    // an exposed top wears unevenly: a fine and a broad undulation, and the odd notch the rain has cut (C; by the age of the
    // wall and whether anyone keeps it: yard and garden walls more than a house's parapet)
    const keep = house ? 1 : 1.8, jit = exposedTop ? (0.015 + 0.035 * (L.age / 50)) * keep : 0, broad = exposedTop ? (0.02 + 0.05 * (L.age / 50)) * keep : 0;
    const notches: [number, number, number][] = []; if (exposedTop && len > 3) { const nn = Math.floor(len / 6 * keep + hi(seed, 81)); for (let q = 0; q < nn; q++) notches.push([sA + 0.6 + (len - 1.2) * hi(seed, q, 82), 0.25 + 0.35 * hi(seed, q, 83), (0.06 + 0.16 * hi(seed, q, 84)) * keep]); }
    const topSt: number[] = []; for (const [c, w] of notches) for (const f of [-1, -0.5, -0.2, 0, 0.2, 0.5, 1]) topSt.push(c + f * w);
    const ytopF = (x: number) => { if (!exposedTop) return top; const end = Math.min(smooth((x - sA) / 0.4), smooth((sB - x) / 0.4));
      let y = jit * (vn(x * 0.7 + seed, 3.1) * 2 - 1) + broad * (vn(x * 0.22 + seed * 0.37, 7.3) * 2 - 1); for (const [c, w, dpt] of notches) y -= dpt * (1 - smooth(Math.abs(x - c) / w)); return top + y * end; };
    const bev = exposedTop ? Math.min(0.06, t * 0.12) : 0;
    const add = L.addition >= 0 && we.room >= 0 && this.roomSide(this.rooms[this.roomOf.get(we.room)!]) === L.addition;
    // doors: the lintel and the wall over it; a threshold stone (street doors) or a rolled mat (rooms)
    if (w.door) {
      // each doorway its own: the lintel's height (up to 15 cm under the plan's 2 m head), depth and bearing
      const dv = we.street ? doorVar(s.plots[we.plot].id) : { drop: 0.1 * hi(seed, 51), lh: 0.09 + 0.06 * hi(seed, 52), bear: 0.12 + 0.16 * hi(seed, 53), step: 0, niche: 0 };
      const yl = Math.max(sp.doorBase, sp.gmax) + DOOR_H - dv.drop, g0 = this.gl(...P2l((sA + sB) / 2, 0)), mu = ax === 0 ? (sA + sB) / 2 : cc, mv = ax === 0 ? cc : (sA + sB) / 2, tb = lin(POLE);
      const aged = sh(tb, 0.85 + 0.25 * L.doorWood);
      this.lbox(B.timber, mu, mv, ax === 0 ? len / 2 + dv.bear : t / 2 + 0.012, ax === 0 ? t / 2 + 0.012 : len / 2 + dv.bear, yl, yl + dv.lh, sh(aged, 0.9), aged, this.owner(we.plot, P.door));
      if (top - (yl + dv.lh) > 0.03) { const c = this.tone(we.plot, 0, add); B.plaster.set('y0', -1000).set('ytop', top).set('ao', 0.8);
        this.lbox(B.plaster, mu, mv, ax === 0 ? len / 2 : t / 2, ax === 0 ? t / 2 : len / 2, yl + dv.lh, top, sh(c, 0.95), c, this.owner(we.plot, P.wall)); B.plaster.set('ao', 1); }
      // the doorway's face on the lane: timber jamb boards for the better-off (35 %), a raised plaster surround (30 %), or none
      if (we.street) { const hv = hashString(s.plots[we.plot].id + ':frame') / 4294967296, p = s.plots[we.plot], d = s.doorPoints(p)!; const og = Math.sign(ax === 0 ? d.out[1] - d.inside[1] : d.out[0] - d.inside[0]);
        const fo = og * (t / 2 + 0.018), yb2 = g0 - 0.02;
        if (hv < 0.35 * (0.5 + L.standing)) { B.timber.set('ao', 0.85); for (const e of [sA - 0.06, sB + 0.06]) { const [u, v] = P2l(e, fo); this.lbox(B.timber, u, v, ax === 0 ? 0.06 : 0.025, ax === 0 ? 0.025 : 0.06, yb2, yl, sh(aged, 0.85), aged, this.owner(we.plot, P.door)); } B.timber.set('ao', 1); }
        else if (hv > 0.7) { const c = sh(this.tone(we.plot, 0, add), 1.06 + 0.04 * hi(seed, 71)); B.plaster.set('y0', -1000).set('ytop', 1e4).set('ao', 0.9); const w2 = 0.09 + 0.05 * hi(seed, 72);
          for (const e of [sA - w2, sB + w2]) { const [u, v] = P2l(e, fo); this.lbox(B.plaster, u, v, ax === 0 ? w2 : 0.02, ax === 0 ? 0.02 : w2, yb2 + 0.15, yl + dv.lh + w2, sh(c, 0.97), c, this.owner(we.plot, P.door)); }
          const [u, v] = P2l((sA + sB) / 2, fo); this.lbox(B.plaster, u, v, ax === 0 ? len / 2 + 2 * w2 : 0.02, ax === 0 ? 0.02 : len / 2 + 2 * w2, yl + dv.lh, yl + dv.lh + w2, c, c, this.owner(we.plot, P.door)); B.plaster.set('ao', 1); } }
      // a doorstep of two flat stones outside some street doors (the lane side)
      if (we.street && dv.step) { const p = s.plots[we.plot], d = s.doorPoints(p)!; const ou = Math.sign(d.out[0] - d.inside[0]), ov = Math.sign(d.out[1] - d.inside[1]); const st = lin(STONE);
        for (const e of [-0.24, 0.24]) { const su = d.mid[0] + ou * (t / 2 + 0.22) + (ax === 0 ? e : 0), sv = d.mid[1] + ov * (t / 2 + 0.22) + (ax === 0 ? 0 : e), gy = this.gl(su, sv);
          B.stone.set('ao', 0.9); this.lbox(B.stone, su, sv, ax === 0 ? 0.23 : 0.2, ax === 0 ? 0.2 : 0.23, gy - 0.06, gy + 0.08 + 0.03 * hi(seed, e > 0 ? 55 : 56), sh(st, 0.85), sh(st, 1.08), this.owner(we.plot, P.door), false, (hi(seed, e > 0 ? 57 : 58) - 0.5) * 0.25); B.stone.set('ao', 1); } }
      if (we.street) { const st = lin(STONE); B.stone.set('ao', 0.9);
        // a threshold slab, worn hollow in the middle by feet (two lower strips at the edges: its middle stands 1 cm lower)
        this.lbox(B.stone, mu, mv, ax === 0 ? len / 2 : t / 2 + 0.05, ax === 0 ? t / 2 + 0.05 : len / 2, g0 - 0.1, g0 + 0.035, sh(st, 0.85), sh(st, 1.12), this.owner(we.plot, P.door));
        for (const e of [-1, 1]) this.lbox(B.stone, mu + (ax === 0 ? e * (len / 2 - 0.1) : 0), mv + (ax === 0 ? 0 : e * (len / 2 - 0.1)), ax === 0 ? 0.1 : t / 2 + 0.05, ax === 0 ? t / 2 + 0.05 : 0.1, g0, g0 + 0.05, st, sh(st, 0.95), this.owner(we.plot, P.door));
        // the pivot stone inside the hinge jamb (its socket takes the door's post)
        const p = s.plots[we.plot], d = p?.door ? s.doorPoints(p) : null; if (d) { const nu = Math.sign(d.inside[0] - d.out[0]), nv = Math.sign(d.inside[1] - d.out[1]), hs = L.hinge;
          const pu = d.mid[0] + nu * (t / 2 + 0.16) + (-nv * hs) * 0.42, pv = d.mid[1] + nv * (t / 2 + 0.16) + (nu * hs) * 0.42; this.lbox(B.stone, pu, pv, 0.16, 0.15, g0 - 0.05, g0 + 0.07, sh(st, 0.8), sh(st, 1.05), this.owner(we.plot, P.door), false, 0.3); }
        B.stone.set('ao', 1);
      } else if (hi(seed, 7) < 0.45) { const room = sides.find(sd => sd.cls === 'room'); if (room) { const sg = sides[0] === room ? -1 : 1; const off = sg * (t / 2 + 0.08);
        const A = this.wp(...P2l(sA + 0.04, off), yl - 0.09), Bq = this.wp(...P2l(sB - 0.04, off), yl - 0.09); B.timber.set('ao', 0.5); this.pole(B.timber, A, Bq, 0.075, 6, lin([0.55, 0.47, 0.33]), this.owner(we.plot, P.door)); B.timber.set('ao', 1); } }
      return;
    }
    // windows and vents through the wall; the niche by the street door; decals (patches, bare brick, soot, streaks)
    const holes: Hole[] = [], decs: [number, Dec][] = [];
    const floorOf = (sd: Side) => sd.plot >= 0 ? this.base[sd.plot] : sp.gmin;
    const roomSd = sides.findIndex(sd => sd.cls === 'room'), room = roomSd >= 0 ? sides[roomSd] : null;
    if (room && house) { const other = sides[1 - roomSd]; const ceil = room.roof - ROOF_T;
      if (w.kind === 'facade' && other.cls === 'court' && len >= 2.4) { const nW = Math.floor(len / 3.2 * (0.35 + 0.65 * L.standing) + hi(seed, 11));
        for (let k = 0; k < nW; k++) { const ww = 0.42 + 0.18 * hi(seed, k, 1), wh = 0.4 + 0.2 * hi(seed, k, 2), sc = sA + (len * (k + 1)) / (nW + 1) + (hi(seed, k, 3) - 0.5) * 0.4; const sill = floorOf(room) + 1.35 + 0.35 * hi(seed, k, 4);
          if (sill + wh + 0.2 < ceil && sc - ww / 2 > sA + 0.5 && sc + ww / 2 < sB - 0.5) holes.push({ s0: sc - ww / 2, s1: sc + ww / 2, y0: sill, y1: sill + wh, through: true, depth: t }); } }
      if (w.kind === 'outer' && other.cls === 'open' && len >= 3 && hi(seed, 12) < 0.3 + 0.3 * L.standing) { const sc = sA + len * (0.3 + 0.4 * hi(seed, 13)), y = floorOf(room) + 2.15;
        if (y + 0.4 < ceil) holes.push({ s0: sc - 0.1, s1: sc + 0.1, y0: y, y1: y + 0.34, through: true, depth: t }); } }
    // the lamp niche by the street door (on the lane face, the side away from the hinge)
    const pfix = this.fixByPlot.get(we.plot) ?? [];
    const nicheHere = house && w.kind === 'outer' ? pfix.find(f => { if (f.kind !== 'niche' || f.plot !== we.plot || Math.abs((ax === 0 ? f.v : f.u) - cc) > 0.6) return false; const al = ax === 0 ? f.u : f.v;
      return f.len > 0 ? Math.abs(sB - (al - 0.5)) < 0.05 : Math.abs(sA - (al + 0.5)) < 0.05; }) : undefined;
    // exterior faces: footing, bulge, decals; interior faces: plain, darker (smoke), low ambient
    const courtFix = pfix;
    for (const [si, sg] of [[0, -1], [1, 1]] as const) {
      const sd = sides[si]; if (w.kind === 'partition' && sd.cls !== 'room') continue;
      const faceHoles = holes.slice();
      const off = sg * (t / 2); const along0 = sA, along1 = sB;
      const gAt = (x: number) => this.gl(...P2l(x, off));
      const floor = sd.plot >= 0 ? this.base[sd.plot] : sp.gmin;
      const col0 = this.tone(we.plot, sd.cls === 'court' ? 1 : 0, add);
      if (sd.cls === 'room') {
        // the room's inside up to the ceiling; above the roof the parapet's inner face (exterior)
        const yc = sd.roof - ROOF_T + ROOF.beam, inner = sh(col0, 0.82);
        this.face(B.plaster, { ax, sA: along0, sB: along1, cc, t, sg, yb: () => sp.y0 + 0.3, yt: () => Math.min(top, yc), holes: faceHoles, bulge: 0, seed, col: () => inner, owner: this.owner(we.plot, P.wall), ao: () => 0.16, y0: () => -1000, ytop: 1e4 });
        for (const h of faceHoles) if (h.through) this.reveal(B, ax, cc, t, sg, h, inner, we.plot); // the window's inner half
        if (top > sd.roof + 0.02) this.face(B.plaster, { ax, sA: along0, sB: along1, cc, t, sg, yb: () => sd.roof - 0.13, yt: x => ytopF(x) - bev, holes: [], bulge: 0.006, seed: seed + 3, st2: topSt, col: (_x, y) => sh(col0, 1.0 + 0.03 * smooth((y - sd.roof) / 0.5)), owner: this.owner(we.plot, P.wall), ao: () => 0.85, y0: () => sd.roof, ytop: top });
      } else {
        // exterior: the stone footing, then the plaster
        const soc = house || (we.plot >= 0 && s.plots[we.plot].kind !== 'garden') ? L.socle : 0.3;
        const ysoc = (x: number) => gAt(x) + soc;
        const dist = this.openDist(w, sg), aoF = (y: number) => { const yr = y - floor; if (!dist) return 1; const [D, Ho] = dist; const dh = Ho - yr; const v = dh > 0 ? 1 - dh / Math.hypot(dh, D) : 1; return Math.max(0.3, Math.min(1, v * (sd.cls === 'court' ? 0.88 : 0.95) * (0.82 + 0.18 * smooth(yr / 1.2)))); };
        const stc = lin(STONE), stcol = sh(stc, 0.9 + 0.2 * hi(we.plot, 5));
        this.face(B.stone, { ax, sA: along0, sB: along1, cc, t, sg, yb: () => sp.y0 + 0.2, yt: ysoc, holes: [], bulge: 0, seed, col: (_x, y) => sh(stcol, 0.86 + 0.14 * smooth((y - floor) / 0.4)), owner: this.owner(we.plot, P.socle), ao: aoF, y0: () => -1000, ytop: 1e4, off: 0.035 });
        // the footing's top ledge
        B.stone.set('ao', 0.9); { const n = Math.max(1, Math.ceil(len / 1.5)); for (let k = 0; k < n; k++) { const a = along0 + (len * k) / n, z = along0 + (len * (k + 1)) / n, ya = ysoc(a), yz = ysoc(z);
          const p = (x: number, o2: number, y: number) => this.wp(...P2l(x, sg * (t / 2 + o2)), y); B.stone.quad(p(a, 0, ya), p(z, 0, yz), p(z, 0.035, yz), p(a, 0.035, ya), [0, 1, 0], stcol, stcol, stcol, stcol, this.owner(we.plot, P.socle)); } } B.stone.set('ao', 1);
        const nv = doorVar(s.plots[we.plot].id);
        if (nicheHere && sd.cls === 'open' && nv.niche) { const nw = 0.1 + 0.06 * hi(seed, 61), nh = 0.13 + 0.07 * hi(seed, 62), ny = floor + 1.1 + 0.35 * hi(seed, 63), sc = nicheHere.len > 0 ? sB - 0.35 - 0.25 * hi(seed, 64) : sA + 0.35 + 0.25 * hi(seed, 64);
          if (sc - nw - 0.01 > sA + 0.1 && sc + nw + 0.01 < sB - 0.1) { faceHoles.push({ s0: sc - nw, s1: sc + nw, y0: ny, y1: ny + 2 * nh, through: false, depth: 0.12 + 0.08 * hi(seed, 65) });
            // the lamp's soot over the niche; a timber peg or two driven into the wall by the door (a halter, a basket, a lamp hook)
            decs.push([sg, { s0: sc - nw - 0.03, s1: sc + nw + 0.03, y0: ny + 2 * nh, y1: ny + 2 * nh + 0.3 + 0.3 * hi(seed, 66), kind: 'soot', seed, k: 0.75 + 0.15 * hi(seed, 67) }]);
            const np = Math.floor(hi(seed, 41) * 3); for (let q = 0; q < np; q++) { const ps = nicheHere.len > 0 ? sB - 0.9 - 0.5 * q - 0.3 * hi(seed, q, 42) : sA + 0.9 + 0.5 * q + 0.3 * hi(seed, q, 42), py = floor + 1.35 + 0.35 * hi(seed, q, 43);
              if (ps < sA + 0.2 || ps > sB - 0.2) continue; B.timber.set('ao', 0.9); this.pole(B.timber, this.wp(...P2l(ps, sg * (t / 2 - 0.05)), py), this.wp(...P2l(ps, sg * (t / 2 + 0.17)), py + 0.03), 0.025, 5, sh(lin(POLE), 0.75 + 0.3 * hi(seed, q, 44)), this.owner(we.plot, P.fixture), 'end'); B.timber.set('ao', 1); } } }
        const bulge = (0.007 + 0.012 * (1 - L.standing) + 0.006 * (L.age / 50)) * (house ? 1 : 0.7);
        this.face(B.plaster, { ax, sA: along0, sB: along1, cc, t, sg, yb: ysoc, yt: x => ytopF(x) - bev, holes: faceHoles, bulge, seed: seed + si * 13, st2: topSt,
          col: (_x, y) => { const yr = y - floor; return sh(col0, (0.955 + 0.06 * smooth(yr / 2.6)) * (sd.cls === 'open' ? 1 - 0.035 * (1 - smooth(yr / 0.8)) : 1)); },
          owner: this.owner(we.plot, P.wall), ao: aoF, y0: ysoc, ytop: top });
        // decals on this face: repairs, bare brick, soot, the household's dung cakes, the drain's stain
        if (we.plot >= 0) this.faceDecals(we, sd, sg, floor, top, faceHoles, courtFix, decs, seed + si); // (yard and garden walls weather too)
        for (const [sgd, d] of decs) if (sgd === sg) this.decal(B, ax, cc, t, sg, d, col0, floor, we.plot);
        decs.length = 0;
        // hole reveals and backs
        for (const h of faceHoles) this.reveal(B, ax, cc, t, sg, h, col0, we.plot);
      }
    }
    // the cap of an exposed top: worn round, uneven along the wall
    if (exposedTop) { const c = this.tone(we.plot, 0, add), n = Math.max(1, Math.ceil(len / (notches.length ? 0.35 : 0.8))); B.plaster.set('y0', -1000).set('ytop', top).set('ao', 1);
      const nf = Math.ceil(len / 1.3); // the faces' own stations (face(): 1.3 m) and the notches': the cap and the faces meet edge to edge
      const CS = [...new Set([...Array.from({ length: nf + 1 }, (_, k) => sA + (len * k) / nf), ...topSt.filter(x => x > sA && x < sB)].map(x => +x.toFixed(4)))].sort((p, q) => p - q); void n;
      for (let k = 0; k + 1 < CS.length; k++) { const a = CS[k], z = CS[k + 1], ya = ytopF(a), yz = ytopF(z);
        const p = (x: number, o2: number, y: number) => this.wp(...P2l(x, o2), y), hw = t / 2, e = bev;
        const up = [0, 1, 0]; const [nx, nz] = ax === 0 ? this.dirW(0, 1) : this.dirW(1, 0); const n1 = [nx * 0.7, 0.7, nz * 0.7], n0 = [-nx * 0.7, 0.7, -nz * 0.7];
        B.plaster.quad(p(a, -hw + e, ya), p(z, -hw + e, yz), p(z, hw - e, yz), p(a, hw - e, ya), up, sh(c, 1.04), sh(c, 1.04), sh(c, 1.04), sh(c, 1.04), this.owner(we.plot, P.wall));
        B.plaster.quad(p(a, hw - e, ya), p(z, hw - e, yz), p(z, hw, yz - e), p(a, hw, ya - e), n1, c, c, c, c, this.owner(we.plot, P.wall));
        B.plaster.quad(p(a, -hw, ya - e), p(z, -hw, yz - e), p(z, -hw + e, yz), p(a, -hw + e, ya), n0, c, c, c, c, this.owner(we.plot, P.wall)); } }
    else if (eaveCourt || w.kind === 'partition' || w.kind === 'facade') { // the flat top under the roof (seen between the pole ends)
      const c = sh(this.tone(we.plot, 1, add), 0.9); B.plaster.set('y0', -1000).set('ytop', 1e4).set('ao', 0.6); const p = (x: number, o2: number) => this.wp(...P2l(x, o2), top);
      B.plaster.quad(p(sA, -t / 2), p(sB, -t / 2), p(sB, t / 2), p(sA, t / 2), [0, 1, 0], c, c, c, c, this.owner(we.plot, P.wall)); B.plaster.set('ao', 1); }
    // the wall's ends (jambs and free ends)
    { const c = sh(this.tone(we.plot, 0, add), 0.97); B.plaster.set('y0', sp.gmin).set('ytop', top).set('ao', 0.85);
      for (const [x, dir] of [[sA, -1], [sB, 1]] as const) { const n = ax === 0 ? this.dirW(dir, 0) : this.dirW(0, dir), yt2 = ytopF(x) - (exposedTop ? 0 : 0);
        const p = (o2: number, y: number) => this.wp(...P2l(x, o2), y); B.plaster.quad(p(-t / 2, sp.y0 + 0.3), p(t / 2, sp.y0 + 0.3), p(t / 2, yt2), p(-t / 2, yt2), [n[0], 0, n[1]], sh(c, 0.9), sh(c, 0.9), c, c, this.owner(we.plot, P.wall)); }
      B.plaster.set('ao', 1); }
  }
  /** does room r's eave oversail wall w (a court facade on side sg of the wall)? */
  private eaveOn(r: RoomEl, w: Wall, sg: number) {
    const s = this.s, ax = w.v0 === w.v1 ? 0 : 1; // the side of the room the wall is on
    if (ax === 0) { const vline = w.v0 - s.v0; const sd = Math.abs(vline - r.j0) < 0.01 ? 0 : Math.abs(vline - r.j1) < 0.01 ? 1 : -1; return sd >= 0 && (r.eave & (1 << sd)) !== 0 && (sd === 0 ? sg < 0 : sg > 0); }
    const uline = w.u0 - s.u0; const sd = Math.abs(uline - r.i0) < 0.01 ? 2 : Math.abs(uline - r.i1) < 0.01 ? 3 : -1; return sd >= 0 && (r.eave & (1 << sd)) !== 0 && (sd === 2 ? sg < 0 : sg > 0);
  }
  /** which side of its court a room lies on (0 −v, 1 +v, 2 −u, 3 +u): the side opposite its drain */
  private roomSide(r: RoomEl | undefined) { if (!r || r.drain < 0 || r.drain > 3) return -1; return [1, 0, 3, 2][r.drain]; }
  /** from a wall face into the open: the distance to the next wall across (m) and its height above this floor (m), for the
   *  sky the face sees; null = open over 12 m */
  private openDist(w: Wall, sg: number): [number, number] | null {
    const s = this.s, ax = w.v0 === w.v1 ? 0 : 1, mu = (w.u0 + w.u1) / 2, mv = (w.v0 + w.v1) / 2;
    const k0 = ax === 0 ? this.cellAt(mu, mv + sg * 0.5) : this.cellAt(mu + sg * 0.5, mv); if (k0 < 0) return null; const c0 = s.cell[k0];
    const floor = c0 >= 0 ? this.base[c0] : this.gl(mu, mv);
    for (let d = 1; d < 12; d++) { const k = ax === 0 ? this.cellAt(mu, mv + sg * (d + 0.5)) : this.cellAt(mu + sg * (d + 0.5), mv); if (k < 0) return null; const c = s.cell[k];
      if (c === c0 && (c < 0 || s.sub[k] === s.sub[k0])) continue;
      if (c < 0) { if (c0 < 0) continue; return null; }
      const p = s.plots[c], top = s.sub[k] === ROOM ? p.height + p.parapet : s.sub[k] === COURT ? p.height : p.yardWall; return [d, this.base[c] + top - floor]; }
    return null;
  }
  /** a hole's reveals (and, for a niche, its back); a window's back opens into the dark room */
  private reveal(B: HB, ax: number, cc: number, t: number, sg: number, h: Hole, col: RGB, plot: number) {
    const b = B.plaster, P2l = (x: number, off: number): [number, number] => (ax === 0 ? [x, cc + off] : [cc + off, x]);
    const f0 = sg * (t / 2), f1 = sg * (t / 2 - (h.through ? t / 2 : h.depth)); // the reveals run to the wall's middle (the other face draws its half)
    const p = (x: number, o2: number, y: number) => this.wp(...P2l(x, o2), y), c = sh(col, 0.9), own = this.owner(plot, P.window);
    const nS = ax === 0 ? this.dirW(1, 0) : this.dirW(0, 1), nA = ax === 0 ? this.dirW(0, sg) : this.dirW(sg, 0);
    b.set('y0', -1000).set('ytop', 1e4).set('ao', 0.45);
    b.quad(p(h.s0, f0, h.y0), p(h.s0, f1, h.y0), p(h.s0, f1, h.y1), p(h.s0, f0, h.y1), [nS[0], 0, nS[1]], c, c, c, c, own);
    b.quad(p(h.s1, f0, h.y0), p(h.s1, f1, h.y0), p(h.s1, f1, h.y1), p(h.s1, f0, h.y1), [-nS[0], 0, -nS[1]], c, c, c, c, own);
    b.quad(p(h.s0, f0, h.y0), p(h.s1, f0, h.y0), p(h.s1, f1, h.y0), p(h.s0, f1, h.y0), [0, 1, 0], sh(c, 1.05), sh(c, 1.05), sh(c, 1.05), sh(c, 1.05), own);
    b.quad(p(h.s0, f0, h.y1), p(h.s1, f0, h.y1), p(h.s1, f1, h.y1), p(h.s0, f1, h.y1), [0, -1, 0], sh(c, 0.7), sh(c, 0.7), sh(c, 0.7), sh(c, 0.7), own);
    if (!h.through) { const soot = sh(c, 0.35); b.set('ao', 0.3); b.quad(p(h.s0, f1, h.y0), p(h.s1, f1, h.y0), p(h.s1, f1, h.y1), p(h.s0, f1, h.y1), [nA[0], 0, nA[1]], c, c, soot, soot, own); }
    b.set('ao', 1);
    // a timber lintel over a window (the court face)
    if (h.through && h.s1 - h.s0 > 0.3) { const tb = lin(POLE), mid = (h.s0 + h.s1) / 2, [u, v] = P2l(mid, sg * (t / 2 - 0.06)); B.timber.set('ao', 0.9);
      this.lbox(B.timber, u, v, ax === 0 ? (h.s1 - h.s0) / 2 + 0.14 : 0.075, ax === 0 ? 0.075 : (h.s1 - h.s0) / 2 + 0.14, h.y1, h.y1 + 0.09, sh(tb, 0.85), tb, this.owner(plot, P.window)); B.timber.set('ao', 1); }
  }
  /** repairs, bare brick, soot above a hearth or an oven, dung cakes, a drain's stain: where they go on one face */
  private faceDecals(we: WallEl, sd: Side, sg: number, floor: number, top: number, holes: Hole[], fx: Fixture[], out: [number, Dec][], seed: number) {
    const w = we.w, ax = w.v0 === w.v1 ? 0 : 1, sA = ax === 0 ? w.u0 : w.v0, sB = ax === 0 ? w.u1 : w.v1, cc = ax === 0 ? w.v0 : w.u0, len = sB - sA, L = this.life(we.plot);
    const clear = (a: number, b: number, y0: number, y1: number) => a > sA + 0.15 && b < sB - 0.15 && y0 > floor + 0.05 && y1 < top - 0.12 && !holes.some(h => a < h.s1 + 0.1 && b > h.s0 - 0.1 && y0 < h.y1 + 0.1 && y1 > h.y0 - 0.1);
    const nP = Math.floor((len * L.patches) / 10 + hi(seed, 21)), nB = Math.floor((len * L.bare) / 10 + hi(seed, 22) * (sd.cls === 'open' ? 1 : 0.5));
    for (let k = 0; k < nP + nB; k++) { const bare = k >= nP; const wd = 0.3 + 0.9 * hi(seed, k, 31), ht = 0.25 + 0.6 * hi(seed, k, 32); const a = sA + (len - wd) * hi(seed, k, 33);
      const y0 = floor + (bare ? 0.35 + 1.4 * hi(seed, k, 34) ** 1.5 : 0.4 + (top - floor - 1) * hi(seed, k, 34)); if (clear(a, a + wd, y0, y0 + ht)) out.push([sg, { s0: a, s1: a + wd, y0, y1: y0 + ht, kind: bare ? 'bare' : 'patch', seed: seed * 7 + k }]); }
    // soot above the court's hearths, ovens and forges within 1.2 m of this face
    for (const f of this.fitByPlot.get(we.plot) ?? []) { if ((f.kind !== 'hearth' && f.kind !== 'oven' && f.kind !== 'forge')) continue;
      const al = ax === 0 ? f.u : f.v, ac = ax === 0 ? f.v : f.u, d = (ac - cc) * sg; if (d < 0 || d > 1.3 || al < sA || al > sB) continue;
      const wdt = f.kind === 'oven' ? 0.9 : f.kind === 'forge' ? 1.6 : 1.2, h = f.kind === 'forge' ? 2.4 : 1.8; const a = Math.max(sA + 0.05, al - wdt / 2), b = Math.min(sB - 0.05, al + wdt / 2);
      out.push([sg, { s0: a, s1: b, y0: floor + (f.kind === 'oven' ? 0.6 : 0.15), y1: Math.min(top - 0.05, floor + h), kind: 'soot', seed, k: f.kind === 'forge' ? 0.45 : 0.62 }]); }
    // dung cakes slapped on a sunny wall to dry; the drain's outfall stain on the lane face
    for (const f of fx) { const al = ax === 0 ? f.u : f.v, ac = ax === 0 ? f.v : f.u;
      if (f.kind === 'dungcakes' && Math.abs(ac - cc) < 0.01 && al > sA && al < sB && sd.cls === 'court') { const a = Math.max(sA + 0.2, al - f.len / 2), b = Math.min(sB - 0.2, al + f.len / 2); if (b - a > 0.5) out.push([sg, { s0: a, s1: b, y0: floor + 0.8, y1: floor + (f.h ?? 1.3) + 0.4, kind: 'dung', seed: seed + (f.alt ?? 10) }]); }
      if (f.kind === 'drain' && Math.abs(ac - cc) < 0.01 && al > sA && al < sB && sd.cls === 'open') out.push([sg, { s0: al - 0.09, s1: al + 0.09, y0: floor + 0.04, y1: floor + 0.16, kind: 'stain', seed }]); }
  }
  /** one decal on a wall face, a few millimetres proud: a repair patch (fresh plaster, irregular edge), bare brick (the
   *  brick material), soot (darkening toward the heat), dung cakes (discs), a drain hole */
  private decal(B: HB, ax: number, cc: number, t: number, sg: number, d: Dec, col: RGB, floor: number, plot: number) {
    const P2l = (x: number, off: number): [number, number] => (ax === 0 ? [x, cc + off] : [cc + off, x]);
    const nA = ax === 0 ? this.dirW(0, sg) : this.dirW(sg, 0), N = [nA[0], 0, nA[1]];
    const p = (x: number, y: number, o2 = 0.006) => this.wp(...P2l(x, sg * (t / 2 + 0.024 + o2)), y); // clears the bulge (≤ 2.4 cm)
    const mx = (d.s0 + d.s1) / 2, my = (d.y0 + d.y1) / 2, rx = (d.s1 - d.s0) / 2, ry = (d.y1 - d.y0) / 2;
    if (d.kind === 'patch' || d.kind === 'bare') { const n = 11, pts: number[][] = [], cols: RGB[] = [];
      for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, r = 0.72 + 0.28 * hi(d.seed, k); pts.push(p(mx + Math.cos(a) * rx * r, my + Math.sin(a) * ry * r, d.kind === 'patch' ? 0.004 : 0)); cols.push(d.kind === 'patch' ? sh(mixc(col, [col[0] * 1.08, col[1] * 1.06, col[2] * 0.98], 1), 1.03 + 0.03 * hi(d.seed, k, 1)) : sh(lin([0.62, 0.53, 0.41]), 0.9 + 0.15 * hi(d.seed, k, 2))); }
      const b = d.kind === 'patch' ? B.plaster : B.brick; if (d.kind === 'patch') b.set('y0', -1000).set('ytop', 1e4); b.set('ao', 0.95); b.poly(pts, N, cols, this.owner(plot, P.repair)); b.set('ao', 1); return; }
    if (d.kind === 'soot') { const b = B.plaster; b.set('y0', -1000).set('ytop', 1e4).set('ao', 1); const k = d.k ?? 0.6; const nx = 4, ny = 4;
      const cAt = (i: number, j: number): RGB => { const fx = Math.abs(i / nx - 0.5) * 2, fy = j / ny; const dark = (1 - fx * fx) * (fy < 0.25 ? 0.6 + fy * 1.6 : 1 - (fy - 0.25) / 0.75) * (1 - k); return sh(col, 1 - Math.max(0, dark) * 1.0); };
      for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) { const x0 = d.s0 + ((d.s1 - d.s0) * i) / nx, x1 = d.s0 + ((d.s1 - d.s0) * (i + 1)) / nx, y0 = d.y0 + ((d.y1 - d.y0) * j) / ny, y1 = d.y0 + ((d.y1 - d.y0) * (j + 1)) / ny;
        b.quad(p(x0, y0, 0.002), p(x1, y0, 0.002), p(x1, y1, 0.002), p(x0, y1, 0.002), N, cAt(i, j), cAt(i + 1, j), cAt(i + 1, j + 1), cAt(i, j + 1), this.owner(plot, P.soot)); } return; }
    if (d.kind === 'dung') { const b = B.plaster; b.set('y0', -1000).set('ytop', 1e4).set('ao', 1); const dc = lin([0.33, 0.27, 0.19]); let k = 0;
      for (let y = d.y0; y < d.y1 - 0.2; y += 0.27) for (let x = d.s0 + 0.12 + (k % 2) * 0.1; x < d.s1 - 0.12; x += 0.26) { k++; if (hi(d.seed, k) < 0.18) continue; const r = 0.09 + 0.02 * hi(d.seed, k, 1), c2 = sh(dc, 0.85 + 0.3 * hi(d.seed, k, 2));
        const pts: number[][] = []; for (let q = 0; q < 7; q++) { const a = (q / 7) * Math.PI * 2; pts.push(p(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.9, 0.018)); } b.poly(pts, N, c2, this.owner(plot, P.fixture)); } return; }
    if (d.kind === 'stain') { const b = B.plaster; b.set('y0', -1000).set('ytop', 1e4).set('ao', 0.3); const k = sh(col, 0.2);
      b.quad(p(d.s0, d.y0, 0.004), p(d.s1, d.y0, 0.004), p(d.s1, d.y1, 0.004), p(d.s0, d.y1, 0.004), N, k, k, k, k, this.owner(plot, P.wall)); b.set('ao', 1);
      const w2 = sh(col, 0.72); b.quad(p(d.s0 - 0.08, d.y0 - 0.03, 0.003), p(d.s1 + 0.08, d.y0 - 0.03, 0.003), p(d.s1 + 0.02, d.y1 + 0.35, 0.003), p(d.s0 - 0.02, d.y1 + 0.35, 0.003), N, w2, w2, col, col, this.owner(plot, P.wall)); }
  }

  /** a room's roof at full detail: its earth top laid to a fall, the ceiling and poles inside, and where it oversails the
   *  court the eave (pole ends, brush, earth, mud lip) with its spout; a spout through the parapet where it drains to the lane */
  private roomNear(r: RoomEl, B: HB) {
    const s = this.s, pl = s.plots[r.plot], L = this.life(r.plot), R = r.R, seed = hi(r.room, this.si, 77) * 100;
    const u0 = s.u0 + r.i0, u1 = s.u0 + r.i1, v0 = s.v0 + r.j0, v1 = s.v0 + r.j1;
    const over = ROOF.over[0] + (ROOF.over[1] - ROOF.over[0]) * hi(seed, 1), tf = 0.55;
    const ext = [0, 1, 2, 3].map(sd => (r.eave & (1 << sd) ? tf / 2 + over : 0)); // −v, +v, −u, +u
    const E0u = u0 - ext[2], E1u = u1 + ext[3], E0v = v0 - ext[0], E1v = v1 + ext[1];
    // the fall: down toward the drain side (2 % of the span, C), the earth at least 4 cm over the brush
    const dr = r.drain % 4, falls = r.drain >= 0;
    const span = dr < 2 ? v1 - v0 : u1 - u0, fallTot = r.fall;
    const yRoof = (u: number, v: number) => { if (!falls) return R + (vn(u * 1.3 + seed, v * 1.3) - 0.5) * 0.02;
      const f = dr === 0 ? (v - v0) / span : dr === 1 ? (v1 - v) / span : dr === 2 ? (u - u0) / span : (u1 - u) / span; return R - fallTot * (1 - Math.min(1, Math.max(0, f))) + (vn(u * 1.3 + seed, v * 1.3) - 0.5) * 0.02; };
    const own = this.owner(r.plot, P.roof), rc = sh(this.pcol[r.plot], 1.02);
    if (!r.full) { // an irregular room (absorbed cells): per-cell roof squares, no eave
      B.plaster.set('y0', -1000).set('ytop', 1e4).set('ao', 1);
      for (let j = r.j0; j < r.j1; j++) for (let i = r.i0; i < r.i1; i++) { const k = s.k(i, j); if (s.cell[k] !== r.plot || s.room[k] !== r.room) continue;
        const a = s.u0 + i, b = s.v0 + j; B.plaster.quad(this.wp(a, b, R), this.wp(a + 1, b, R), this.wp(a + 1, b + 1, R), this.wp(a, b + 1, R), [0, 1, 0], rc, rc, rc, rc, own);
        B.timber.set('ao', 0.15); B.timber.quad(this.wp(a, b, R - ROOF_T + ROOF.beam), this.wp(a + 1, b, R - ROOF_T + ROOF.beam), this.wp(a + 1, b + 1, R - ROOF_T + ROOF.beam), this.wp(a, b + 1, R - ROOF_T + ROOF.beam), [0, -1, 0], lin(MAT), lin(MAT), lin(MAT), lin(MAT), this.owner(r.plot, P.ceiling)); B.timber.set('ao', 1); }
      return; }
    // the roof top: a 1 m grid over the room and its eaves
    B.plaster.set('y0', -1000).set('ytop', 1e4).set('ao', 1);
    const nu = Math.max(1, Math.round(E1u - E0u)), nv = Math.max(1, Math.round(E1v - E0v));
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) { const a0 = E0u + ((E1u - E0u) * i) / nu, a1 = E0u + ((E1u - E0u) * (i + 1)) / nu, b0 = E0v + ((E1v - E0v) * j) / nv, b1 = E0v + ((E1v - E0v) * (j + 1)) / nv;
      const cA = sh(rc, 0.97 + 0.06 * vn(a0 * 0.5 + seed, b0 * 0.5)), cB = sh(rc, 0.97 + 0.06 * vn(a1 * 0.5 + seed, b0 * 0.5)), cC = sh(rc, 0.97 + 0.06 * vn(a1 * 0.5 + seed, b1 * 0.5)), cD = sh(rc, 0.97 + 0.06 * vn(a0 * 0.5 + seed, b1 * 0.5));
      B.plaster.quad(this.wp(a0, b0, yRoof(a0, b0)), this.wp(a1, b0, yRoof(a1, b0)), this.wp(a1, b1, yRoof(a1, b1)), this.wp(a0, b1, yRoof(a0, b1)), [0, 1, 0], cA, cB, cC, cD, own); }
    // the ceiling (matting over the poles) and the poles, spanning from the drain side to the back
    const yb = R - ROOF_T, yc = yb + ROOF.beam, mat = lin(MAT), pole = lin(POLE);
    B.timber.set('ao', 0.14);
    B.timber.quad(this.wp(u0, v0, yc), this.wp(u1, v0, yc), this.wp(u1, v1, yc), this.wp(u0, v1, yc), [0, -1, 0], sh(mat, 0.9), mat, sh(mat, 0.9), mat, this.owner(r.plot, P.ceiling));
    const acrossU = falls ? dr >= 2 : (u1 - u0) <= (v1 - v0); // poles run along u (spanning u) when the drain is ±u, else along v
    const gap = ROOF.gap[0] + (ROOF.gap[1] - ROOF.gap[0]) * hi(seed, 2), aLo = acrossU ? v0 : u0, aHi = acrossU ? v1 : u1, nP = Math.max(2, Math.floor((aHi - aLo - 0.2) / gap));
    for (let k = 0; k <= nP; k++) { const a = aLo + 0.12 + ((aHi - aLo - 0.24) * k) / nP, rr = 0.065 + 0.03 * hi(seed, k, 3), y = yb + rr + (hi(seed, k, 4) - 0.5) * 0.015;
      const lo = acrossU ? E0u - 0 : E0v, hi2 = acrossU ? E1u : E1v; // ends into the walls or out over the eaves
      const e0 = (acrossU ? (ext[2] ? E0u + 0.03 : u0 - 0.2) : (ext[0] ? E0v + 0.03 : v0 - 0.2)), e1 = (acrossU ? (ext[3] ? E1u - 0.03 : u1 + 0.2) : (ext[1] ? E1v - 0.03 : v1 + 0.2)); void lo; void hi2;
      const out0 = acrossU ? ext[2] > 0 : ext[0] > 0, out1 = acrossU ? ext[3] > 0 : ext[1] > 0;
      const A0 = acrossU ? this.wp(e0, a, y) : this.wp(a, e0, y), B0 = acrossU ? this.wp(e1, a, y) : this.wp(a, e1, y);
      // the pole's end that oversails the court is capped (seen); the one buried in the wall is not
      const [A, Bq] = out0 && !out1 ? [B0, A0] : [A0, B0];
      B.timber.set("ao", 0.2); const pc = sh(pole, 0.88 + 0.22 * hi(seed, k, 5)); this.pole(B.timber, A, Bq, rr, out0 || out1 ? 6 : 4, pc, this.owner(r.plot, P.eave), out0 || out1 ? 'end' : false); }
    B.timber.set('ao', 1);
    this.furnish(r, B);
    // eaves: the brush layer's underside and front, the earth front, the lip (broken at the spout), the spout
    for (let sd = 0; sd < 4; sd++) { if (!ext[sd]) continue;
      const isU = sd >= 2, edge = sd === 0 ? v0 : sd === 1 ? v1 : sd === 2 ? u0 : u1, dir = sd % 2 === 0 ? -1 : 1, outE = edge + dir * ext[sd], faceE = edge + dir * tf / 2;
      const aLo2 = isU ? E0v : E0u, aHi2 = isU ? E1v : E1u; // along the eave
      const P3 = (al: number, ac: number, y: number) => (isU ? this.wp(ac, al, y) : this.wp(al, ac, y));
      const [nx, nz] = isU ? this.dirW(dir, 0) : this.dirW(0, dir), Nout = [nx, 0, nz];
      const br = sh(lin(BRUSH), 0.92 + 0.12 * hi(seed, sd, 9)), yB0 = yc, yB1 = yc + ROOF.brush;
      B.timber.set('ao', 0.55); B.timber.quad(P3(aLo2, faceE, yB0), P3(aHi2, faceE, yB0), P3(aHi2, outE, yB0), P3(aLo2, outE, yB0), [0, -1, 0], sh(br, 0.8), sh(br, 0.8), br, br, this.owner(r.plot, P.eave));
      B.timber.set('ao', 0.9); B.timber.quad(P3(aLo2, outE, yB0), P3(aHi2, outE, yB0), P3(aHi2, outE, yB1), P3(aLo2, outE, yB1), Nout, sh(br, 0.85), sh(br, 0.85), br, br, this.owner(r.plot, P.eave));
      // the earth's front, following the roof's fall
      B.plaster.set('y0', -1000).set('ytop', 1e4).set('ao', 0.95); const n = Math.max(1, Math.round(aHi2 - aLo2));
      for (let k = 0; k < n; k++) { const a = aLo2 + ((aHi2 - aLo2) * k) / n, z = aLo2 + ((aHi2 - aLo2) * (k + 1)) / n; const ya = isU ? yRoof(outE, a) : yRoof(a, outE), yz = isU ? yRoof(outE, z) : yRoof(z, outE);
        B.plaster.quad(P3(a, outE, yB1), P3(z, outE, yB1), P3(z, outE, yz), P3(a, outE, ya), Nout, sh(rc, 0.88), sh(rc, 0.88), rc, rc, this.owner(r.plot, P.eave)); }
      // the spout: on the drain side, at a place along the eave
      const drainHere = falls && r.drain === sd, sp = aLo2 + 0.6 + (aHi2 - aLo2 - 1.2) * hi(seed, 6);
      // the lip: a rounded mud kerb along the edge, 9 cm, broken 0.25 m at the spout
      const segs: [number, number][] = drainHere ? [[aLo2 + 0.02, sp - 0.13], [sp + 0.13, aHi2 - 0.02]] : [[aLo2 + 0.02, aHi2 - 0.02]];
      for (const [a, z] of segs) { if (z - a < 0.05) continue; const m = Math.max(1, Math.round((z - a) / 0.8)); for (let q = 0; q < m; q++) { const qa = a + ((z - a) * q) / m, qz = a + ((z - a) * (q + 1)) / m;
        const ya = (isU ? yRoof(outE, qa) : yRoof(qa, outE)), yz = (isU ? yRoof(outE, qz) : yRoof(qz, outE)), lh = ROOF.lip * (0.8 + 0.4 * vn(qa + seed, 1)), lz = ROOF.lip * (0.8 + 0.4 * vn(qz + seed, 1));
        const inE = outE - dir * 0.11, midE = outE - dir * 0.055;
        B.plaster.quad(P3(qa, outE, ya), P3(qz, outE, yz), P3(qz, midE, yz + lz), P3(qa, midE, ya + lh), [Nout[0] * 0.7, 0.7, Nout[2] * 0.7], rc, rc, sh(rc, 1.04), sh(rc, 1.04), this.owner(r.plot, P.eave));
        B.plaster.quad(P3(qa, midE, ya + lh), P3(qz, midE, yz + lz), P3(qz, inE, yz), P3(qa, inE, ya), [-Nout[0] * 0.7, 0.7, -Nout[2] * 0.7], sh(rc, 1.04), sh(rc, 1.04), rc, rc, this.owner(r.plot, P.eave)); } }
      if (drainHere) { const y0s = (isU ? yRoof(outE, sp) : yRoof(sp, outE)) - 0.02, L2 = 0.5; const A = P3(sp, faceE, y0s + 0.02), Bq = P3(sp, outE + dir * L2, y0s - 0.07);
        B.timber.set('ao', 0.9); this.pole(B.timber, A, Bq, 0.06, 5, sh(lin(POLE), 0.8), this.owner(r.plot, P.spout)); B.timber.set('ao', 1);
        // a flat stone where the water falls
        const g2 = isU ? [outE + dir * (L2 + 0.25), sp] : [sp, outE + dir * (L2 + 0.25)]; const gy = this.gl(g2[0], g2[1]); B.stone.set('ao', 0.9); this.lbox(B.stone, g2[0], g2[1], 0.2, 0.16, gy - 0.05, gy + 0.03, lin(STONE), sh(lin(STONE), 1.05), this.owner(r.plot, P.spout), false, hi(seed, 8)); B.stone.set('ao', 1); }
    }
    B.plaster.set('ao', 1); B.timber.set('ao', 1);
    // a room draining to the lane: a spout through the outer parapet and the streak it leaves down the wall
    if (r.drain >= 4) { const sd = r.drain - 4, isU = sd >= 2, edge = sd === 0 ? v0 : sd === 1 ? v1 : sd === 2 ? u0 : u1, dir = sd % 2 === 0 ? -1 : 1, t = pl.outerT;
      const aLo2 = isU ? v0 : u0, aHi2 = isU ? v1 : u1, sp = aLo2 + 0.5 + (aHi2 - aLo2 - 1) * hi(seed, 6); const P3 = (al: number, ac: number, y: number) => (isU ? this.wp(ac, al, y) : this.wp(al, ac, y));
      const yS = R - fallTot + 0.01, A = P3(sp, edge - dir * t / 2, yS + 0.03), Bq = P3(sp, edge + dir * (t / 2 + 0.45), yS - 0.05);
      B.timber.set('ao', 0.9); this.pole(B.timber, A, Bq, 0.055, 5, sh(lin(POLE), 0.78), this.owner(r.plot, P.spout)); B.timber.set('ao', 1);
      const [nx, nz] = isU ? this.dirW(dir, 0) : this.dirW(0, dir), N = [nx, 0, nz], g = isU ? this.gl(edge, sp) : this.gl(sp, edge), c = this.tone(r.plot, 0, false), f = edge + dir * (t / 2 + 0.026);
      B.plaster.set('y0', -1000).set('ytop', 1e4).set('ao', 1); const y1 = yS - 0.08, y0 = g + 0.9 + 0.5 * hi(seed, 10), wS = 0.16 + 0.1 * hi(seed, 11), dk = sh(c, 0.62);
      B.plaster.quad(P3(sp - wS, f, y1 - 0.02), P3(sp, f, y1), P3(sp, f, (y0 + y1) / 2), P3(sp - wS * 0.8, f, (y0 + y1) / 2), N, c, dk, sh(c, 0.75), c, this.owner(r.plot, P.spout));
      B.plaster.quad(P3(sp, f, y1), P3(sp + wS, f, y1 - 0.02), P3(sp + wS * 0.8, f, (y0 + y1) / 2), P3(sp, f, (y0 + y1) / 2), N, dk, c, c, sh(c, 0.75), this.owner(r.plot, P.spout));
      B.plaster.quad(P3(sp - wS * 0.8, f, (y0 + y1) / 2), P3(sp, f, (y0 + y1) / 2), P3(sp, f, y0), P3(sp - wS * 0.4, f, y0), N, c, sh(c, 0.75), c, c, this.owner(r.plot, P.spout));
      B.plaster.quad(P3(sp, f, (y0 + y1) / 2), P3(sp + wS * 0.8, f, (y0 + y1) / 2), P3(sp + wS * 0.4, f, y0), P3(sp, f, y0), N, sh(c, 0.75), c, c, c, this.owner(r.plot, P.spout)); }
  }

  /** the house's lamp (D-234, Q-560): a clay saucer lamp on a ledge on the back wall of its first living room, 1.1 m up
   *  (grid e, n; world y), or null. Saucer lamps are B by analogy (Q-516); that every house burned one in the evening is C */
  lampSpot(plot: number): [number, number, number] | null {
    const p = this.s.plots[plot]; if (!HOUSE_KINDS.has(p.kind) || p.kind === 'workshop') return null;
    for (const r of this.rooms) { if (r.plot !== plot || !r.full) continue; const k = this.roomUse(r); if (k !== 'living') continue;
      const [u, v] = this.backPoint(r, 0.5, 0.2); const g = this.s.grid(u, v); return [g[0], g[1], this.gl(u, v) + 1.12]; }
    return null;
  }
  /** a room's use: the vestibule, a store, a living room (C) */
  roomUse(r: RoomEl): 'vestibule' | 'store' | 'living' | 'none' {
    const s = this.s, p = s.plots[r.plot]; if (!HOUSE_KINDS.has(p.kind) || r.i1 - r.i0 < 2 || r.j1 - r.j0 < 2) return 'none';
    if (p.door && s.room[p.door.cell] === r.room) return 'vestibule';
    return hi(r.room, this.si, 5) < 0.35 || p.kind === 'workshop' ? 'store' : 'living';
  }
  /** a point on a room's back wall (away from its court): `f` along the wall (0..1), `d` m out from the wall face */
  private backPoint(r: RoomEl, f: number, d: number): [number, number] {
    const s = this.s, u0 = s.u0 + r.i0, u1 = s.u0 + r.i1, v0 = s.v0 + r.j0, v1 = s.v0 + r.j1, back = r.drain >= 0 && r.drain < 4 ? [1, 0, 3, 2][r.drain] : 1;
    const a = back < 2 ? u0 + 0.45 + (u1 - u0 - 0.9) * f : v0 + 0.45 + (v1 - v0 - 0.9) * f;
    return back === 0 ? [a, v0 + 0.28 + d] : back === 1 ? [a, v1 - 0.28 - d] : back === 2 ? [u0 + 0.28 + d, a] : [u1 - 0.28 - d, a];
  }
  /** what a room holds (C, the probable household by analogy; D-234): a store room its jars and sacks, a living room its
   *  reed mat, bedding rolled against the wall, a low mud platform and a stack of folded rugs; the vestibule a bench; rooms
   *  of workshops their stock. Dark volumes otherwise: the visitor walking in would find them empty */
  private furnish(r: RoomEl, B: HB) {
    const s = this.s, p = s.plots[r.plot]; if (!HOUSE_KINDS.has(p.kind)) return;
    const u0 = s.u0 + r.i0, u1 = s.u0 + r.i1, v0 = s.v0 + r.j0, v1 = s.v0 + r.j1, W2 = u1 - u0, D2 = v1 - v0; if (W2 < 2 || D2 < 2) return;
    const use = this.roomUse(r), vest = use === 'vestibule', h = hi(r.room, this.si, 5), own = this.owner(r.plot, P.fixture);
    const gy = (u: number, v: number) => this.gl(u, v);
    // the wall away from the court (the room's back): opposite its drain side
    const back = r.drain >= 0 && r.drain < 4 ? [1, 0, 3, 2][r.drain] : 1; // 0 −v, 1 +v, 2 −u, 3 +u
    const along = back < 2 ? [u0 + 0.45, u1 - 0.45] : [v0 + 0.45, v1 - 0.45];
    const atBack = (a: number, d: number): [number, number] => back === 0 ? [a, v0 + 0.28 + d] : back === 1 ? [a, v1 - 0.28 - d] : back === 2 ? [u0 + 0.28 + d, a] : [u1 - 0.28 - d, a];
    B.plaster.set('y0', -1000).set('ytop', 1e4).set('ao', 0.2); B.timber.set('ao', 0.2);
    if (vest) { // the water jar on its stand by the street door, a cup on its lid (C); a bench in some
      { const [u, v] = atBack(along[0] + 0.15, 0.12), y = gy(u, v), g = s.grid(u, v); this.lbox(B.plaster, u, v, 0.2, 0.2, y - 0.05, y + 0.28, sh(this.tone(r.plot, 1, false), 0.8), this.tone(r.plot, 1, false), own);
        B.plaster.lathe(g[0], g[1], y + 0.28, [[0.1, 0], [0.22, 0.2], [0.21, 0.42], [0.1, 0.58], [0.12, 0.62]], 9, lin([0.66, 0.5, 0.37]), own);
        B.plaster.lathe(g[0] + 0.03, g[1], y + 0.9, [[0.03, 0], [0.045, 0.05], [0.05, 0.08]], 6, lin([0.6, 0.42, 0.3]), own); }
      if (h < 0.6) { const [u, v] = atBack((along[0] + along[1]) / 2, 0.2), y = gy(u, v); this.lbox(B.plaster, u, v, back < 2 ? Math.min(0.9, (along[1] - along[0]) / 2) : 0.22, back < 2 ? 0.22 : Math.min(0.9, (along[1] - along[0]) / 2), y - 0.05, y + 0.4, sh(this.tone(r.plot, 1, false), 0.8), this.tone(r.plot, 1, false), own); } }
    else if (use === 'store') { // a store: jars and sacks along the back wall
      const pot = lin([0.63, 0.43, 0.3]), sack = lin([0.62, 0.55, 0.42]); const n = Math.max(2, Math.floor((along[1] - along[0]) / 0.62));
      for (let k = 0; k < n; k++) { const a = along[0] + 0.2 + ((along[1] - along[0] - 0.4) * k) / Math.max(1, n - 1), [u, v] = atBack(a, 0.12), y = gy(u, v), g = s.grid(u, v), kk = 0.9 + 0.5 * hi(r.room, k, 1);
        if (hi(r.room, k, 2) < 0.65) B.plaster.lathe(g[0], g[1], y - 0.05, [[0.12 * kk, 0], [0.26 * kk, 0.25 * kk], [0.25 * kk, 0.55 * kk], [0.12 * kk, 0.78 * kk], [0.1 * kk, 0.82 * kk]], 8, sh(pot, 0.85 + 0.25 * hi(r.room, k, 3)), own);
        else B.plaster.lathe(g[0], g[1], y - 0.02, [[0.16, 0], [0.22, 0.15], [0.2, 0.42], [0.1, 0.55], [0.03, 0.58]], 6, sh(sack, 0.85 + 0.25 * hi(r.room, k, 4)), own); } }
    else { // a living room: the reed mat, bedding rolled against the back wall, folded rugs, a low platform in larger rooms
      const inset = 0.45, mu0 = u0 + inset, mu1 = u1 - inset, mv0 = v0 + inset, mv1 = v1 - inset, mat = sh(lin(MAT), 0.95 + 0.1 * h);
      B.timber.poly([this.wp(mu0, mv0, gy(mu0, mv0) + 0.13), this.wp(mu1, mv0, gy(mu1, mv0) + 0.13), this.wp(mu1, mv1, gy(mu1, mv1) + 0.13), this.wp(mu0, mv1, gy(mu0, mv1) + 0.13)], [0, 1, 0], mat, own);
      const bed: RGB[] = [[0.7, 0.64, 0.52], [0.52, 0.28, 0.2], [0.42, 0.36, 0.3], [0.66, 0.5, 0.3]]; const nb = 1 + Math.floor(hi(r.room, 7) * 3);
      for (let k = 0; k < nb; k++) { const a = along[0] + 0.3 + k * 0.75; if (a + 0.6 > along[1]) break; const [ua, va] = atBack(a, 0.16), [ub, vb] = atBack(a + 0.6, 0.16), y = gy(ua, va) + 0.13 + 0.14;
        this.pole(B.timber, this.wp(ua, va, y), this.wp(ub, vb, y), 0.14, 7, lin(bed[Math.floor(hi(r.room, k, 8) * bed.length)]), own); }
      const L = this.lampSpot(r.plot); if (L) { const [lu, lv] = this.backPoint(r, 0.5, 0.2); const lg = s.grid(lu, lv); if (Math.hypot(lg[0] - L[0], lg[1] - L[1]) < 0.01) { const [bu, bv] = this.backPoint(r, 0.5, 0.08);
        this.lbox(B.plaster, bu, bv, 0.18, 0.18, L[2] - 0.1, L[2] - 0.02, sh(this.tone(r.plot, 1, false), 0.7), sh(this.tone(r.plot, 1, false), 0.8), own); // a ledge of mud
        B.plaster.lathe(lg[0], lg[1], L[2] - 0.02, [[0.03, 0], [0.07, 0.02], [0.075, 0.035], [0.06, 0.035]], 7, lin([0.6, 0.42, 0.3]), own);
        } }
      const [fu, fv] = atBack(along[1] - 0.35, 0.2), fy = gy(fu, fv) + 0.13; for (let k = 0; k < 3 + Math.floor(h * 4); k++) { const c = lin(bed[(k + Math.floor(h * 4)) % bed.length]); this.lbox(B.timber, fu, fv, 0.28 - 0.01 * k, 0.22, fy + k * 0.05, fy + k * 0.05 + 0.045, sh(c, 0.85), c, own, false, 0.05 * k); } }
    B.plaster.set('ao', 1); B.timber.set('ao', 1);
  }
  /** a house's court and roof fixtures in one tile (houseplan.ts), and the site's fittings (hearths, ovens, jars ...) */
  private fixturesNear(tile: number, B: HB) {
    const s = this.s;
    for (let fi = 0; fi < this.fixtures.length; fi++) { const f = this.fixtures[fi]; if (this.plotTile[f.plot] !== tile && !(this.big[f.plot] && this.tileAt(f.u, f.v) === tile)) continue; this.fixture(f, this.fixDesc[fi] * 32 + P.fixture, B); }
  }
  /** a room of this plot to put a roof fixture on, and a point on it (local) */
  private roofSpot(f: Fixture): { u: number; v: number; y: number } | null {
    const rs = this.rooms.filter(r => r.plot === f.plot && r.full && (r.i1 - r.i0) >= 2 && (r.j1 - r.j0) >= 2); if (!rs.length) return null;
    const r = rs[Math.floor(hi(f.alt ?? 0, f.kind.length) * rs.length)]; const u = this.s.u0 + r.i0 + 0.7 + (r.i1 - r.i0 - 1.4) * hi(f.alt ?? 0, 1), v = this.s.v0 + r.j0 + 0.7 + (r.j1 - r.j0 - 1.4) * hi(f.alt ?? 0, 2);
    return { u, v, y: r.R - 0.04 };
  }
  private fixture(f: Fixture, own: number, B: HB) {
    const s = this.s, tb = lin(POLE), st = lin(STONE), L = this.life(f.plot), R = this.base[f.plot] + s.plots[f.plot].height;
    const nu = Math.cos(f.rot), nv = Math.sin(f.rot), tu = -nv, tv = nu; // into the court; along the wall
    const at = (a: number, d: number): [number, number] => [f.u + tu * a + nu * d, f.v + tv * a + nv * d];
    const g = (a: number, d: number) => { const [u, v] = at(a, d); return this.gl(u, v); };
    const W3 = (a: number, d: number, y: number) => { const [u, v] = at(a, d); return this.wp(u, v, y); };
    const yaw = f.rot; // local rotation for lbox (relative to the site frame)
    switch (f.kind) {
      case 'ladder': { const faceD = 0.275, top = R + 0.45, eaveD = faceD + 0.3, gy = g(0, 1.1), foot = eaveD + (top - gy) * 0.2, c = sh(tb, 0.9 + 0.2 * hi(f.plot, 1));
        B.props.set('ao', 0.9);
        for (const e of [-0.22, 0.22]) this.pole(B.props, W3(e, foot, gy - 0.05), W3(e * 0.95, eaveD - 0.04, top), 0.035, 5, c, own);
        for (let y = gy + 0.3; y < top - 0.1; y += 0.31) { const k = (y - gy) / (top - gy), d = foot + (eaveD - 0.04 - foot) * k; this.pole(B.props, W3(-0.22, d, y), W3(0.22, d, y), 0.02, 4, sh(c, 0.95), own, false); }
        B.props.set('ao', 1); break; }
      case 'bench': { const d0 = 0.27, dep = 0.45, h = f.h ?? 0.42, [u, v] = at(0, d0 + dep / 2), gy = g(0, d0 + dep / 2), c = this.tone(f.plot, 1, false);
        B.items.set('y0', gy).set('ytop', gy + h).set('ao', 0.8); this.lbox(B.items, u, v, dep / 2, f.len / 2, gy - 0.1, gy + h, sh(c, 0.9), sh(c, 1.03), own, false, yaw); B.items.set('ao', 1); break; }
      case 'portico': { const [p1, p2] = f.posts!, ph = R - 0.42; const c = sh(tb, 0.95);
        for (const [u, v] of [p1, p2]) { const gy = this.gl(u, v); B.stone.set('ao', 0.9); this.lbox(B.stone, u, v, 0.24, 0.24, gy - 0.1, gy + 0.14, sh(st, 0.85), st, this.owner(f.plot, P.portico), false, 0.2 + hi(u, v));
          B.props.set('ao', 0.9); this.pole(B.props, this.wp(u, v, gy + 0.14), this.wp(u, v, ph - 0.2), 0.1, 8, c, this.owner(f.plot, P.portico)); }
        // the beam on the posts, the poles from the facade to it, matting and earth over them
        const [a0, b0] = [p1[0] - (p2[0] - p1[0]) * 0.35, p1[1] - (p2[1] - p1[1]) * 0.35], [a1, b1] = [p2[0] + (p2[0] - p1[0]) * 0.35, p2[1] + (p2[1] - p1[1]) * 0.35];
        this.pole(B.props, this.wp(a0, b0, ph - 0.11), this.wp(a1, b1, ph - 0.11), 0.1, 6, sh(c, 0.9), this.owner(f.plot, P.portico));
        const [x0, y0, x1, y1] = f.rect!; const ax = Math.abs(nu) > 0.5 ? 1 : 0; // poles span from the facade (across nu)
        for (let k = 0; k <= 10; k++) { const t = k / 10; const al = ax ? y0 + (y1 - y0) * t : x0 + (x1 - x0) * t; const A = ax ? this.wp(x0, al, ph + 0.02) : this.wp(al, y0, ph + 0.02), Bq = ax ? this.wp(x1, al, ph + 0.02) : this.wp(al, y1, ph + 0.02);
          this.pole(B.props, A, Bq, 0.06, 5, sh(lin(POLE), 0.9 + 0.2 * hi(k, f.plot)), this.owner(f.plot, P.portico)); }
        B.props.set('ao', 0.4); const mat = lin(MAT); B.props.quad(this.wp(x0, y0, ph + 0.08), this.wp(x1, y0, ph + 0.08), this.wp(x1, y1, ph + 0.08), this.wp(x0, y1, ph + 0.08), [0, -1, 0], mat, mat, mat, mat, this.owner(f.plot, P.portico)); B.props.set('ao', 1);
        const rc = sh(this.pcol[f.plot], 1.02); B.plaster.set('y0', -1000).set('ytop', 1e4).set('ao', 1); this.lbox(B.plaster, (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2, (y1 - y0) / 2, ph + 0.08, ph + 0.26, sh(rc, 0.88), rc, this.owner(f.plot, P.portico)); break; }
      case 'tether': { const c = this.tone(f.plot, 1, false), [u, v] = at(0, 0.27 + 0.25), gy = g(0, 0.5); B.items.set('y0', gy).set('ytop', gy + 0.62).set('ao', 0.8);
        this.lbox(B.items, u, v, 0.25, 0.55, gy - 0.1, gy + 0.62, sh(c, 0.85), c, own, false, yaw); B.items.set('ao', 0.35); const [u2, v2] = at(0, 0.52); this.lbox(B.items, u2, v2, 0.14, 0.45, gy + 0.3, gy + 0.625, sh(lin([0.4, 0.34, 0.24]), 0.8), lin([0.42, 0.36, 0.24]), own, false, yaw);
        B.items.set('ao', 1); B.items.set('y0', -1000); B.plaster.set('y0', -1000); const dung = lin([0.31, 0.26, 0.19]); const [u3, v3] = at(0.2, 1.1); B.plaster.mound(...s.grid(u3, v3), 0.75, 0.025, dung, (e, n) => this.H(e, n), own, 2, 9);
        const [u4, v4] = at(-0.45, 1.25); const py = this.gl(u4, v4); B.props.set('ao', 0.9); this.pole(B.props, this.wp(u4, v4, py - 0.1), this.wp(u4, v4, py + 0.35), 0.03, 5, sh(tb, 0.7), own); B.props.set('ao', 1); break; }
      case 'fodder': { const straw = lin([0.66, 0.58, 0.39]); const [u, v] = at(0, 0.27 + (f.len) / 2 * 0.7); B.props.set('ao', 0.85); B.props.mound(...s.grid(u, v), f.len / 2 + 0.1, f.h ?? 0.8, straw, (e, n) => this.H(e, n), own, 4, 12); B.props.set('ao', 1); break; }
      case 'firewood': { B.props.set('ao', 0.8); const n = 14 + Math.floor(hi(f.plot, 3) * 10);
        for (let k = 0; k < n; k++) { const a = (hi(f.plot, k, 1) - 0.5) * f.len, h = (f.h ?? 0.8) * (0.7 + 0.5 * hi(f.plot, k, 2)), lean = 0.18 + 0.2 * hi(f.plot, k, 3), gy = g(a, 0.3 + lean);
          const c = f.alt === 2 ? sh(lin([0.42, 0.37, 0.3]), 0.8 + 0.3 * hi(k, 7)) : sh(lin([0.5, 0.43, 0.33]), 0.75 + 0.35 * hi(k, 7));
          this.pole(B.props, W3(a, 0.3 + lean, gy - 0.02), W3(a + (hi(f.plot, k, 4) - 0.5) * 0.3, 0.3, gy + h), 0.012 + 0.018 * hi(f.plot, k, 5), 4, c, own, false); }
        B.props.set('ao', 1); break; }
      case 'line': { const h = f.h ?? 1.9, d = 0.6; const gy = g(0, d); const A = W3(-f.len / 2, 0.3, gy + h), Bq = W3(f.len / 2, 0.3, gy + h); B.props.set('ao', 1);
        this.pole(B.props, A, Bq, 0.006, 3, lin([0.6, 0.55, 0.45]), own, false);
        const cloths: RGB[] = [[0.78, 0.74, 0.64], [0.72, 0.68, 0.58], [0.55, 0.28, 0.2], [0.62, 0.55, 0.42], [0.35, 0.3, 0.26], [0.8, 0.77, 0.7], [0.48, 0.42, 0.33], [0.66, 0.44, 0.24]];
        const n = 2 + Math.floor(hi(f.alt ?? 0, 5) * 3); for (let k = 0; k < n; k++) { const a = -f.len / 2 + 0.3 + (f.len - 0.6) * (k + 0.5) / n, w2 = 0.35 + 0.3 * hi(f.alt ?? 0, k, 1), dh = 0.5 + 0.5 * hi(f.alt ?? 0, k, 2); const c = lin(cloths[Math.floor(hi(f.alt ?? 0, k, 3) * cloths.length)]);
          const q = [W3(a - w2 / 2, 0.3, gy + h), W3(a + w2 / 2, 0.3, gy + h), W3(a + w2 / 2, 0.3 + 0.03, gy + h - dh), W3(a - w2 / 2, 0.3 + 0.03, gy + h - dh)]; const [nx, nz] = this.dirW(nu, nv);
          B.props.quad(q[0], q[1], q[2], q[3], [nx, 0, nz], c, c, sh(c, 0.95), sh(c, 0.95), own); B.props.quad(q[1], q[0], q[3], q[2], [-nx, 0, -nz], sh(c, 0.9), sh(c, 0.9), sh(c, 0.85), sh(c, 0.85), own); } break; }
      case 'baskets': { B.props.set('ao', 0.85); const bc = lin([0.62, 0.52, 0.34]); const n = 1 + (f.alt ?? 0) % 3;
        for (let k = 0; k < n; k++) { const a = (k - (n - 1) / 2) * 0.45, gy = g(a, 0), k2 = 0.8 + 0.5 * hi(f.alt ?? 0, k), [u, v] = at(a, 0); const [e, nn] = s.grid(u, v);
          B.props.lathe(e, nn, gy - 0.01, [[0.13 * k2, 0], [0.19 * k2, 0.08 * k2], [0.21 * k2, 0.24 * k2], [0.2 * k2, 0.3 * k2]], 7, sh(bc, 0.85 + 0.25 * hi(k, 9)), own); }
        // a broom of twigs against the wall-side of the baskets
        const gy = g(0.6, 0.1); this.pole(B.props, W3(0.55, 0.35, gy + 0.02), W3(0.62, 0.05, gy + 1.1), 0.016, 4, sh(tb, 0.9), own); B.props.set('ao', 1); break; }
      case 'mortar': { const gy = g(0, 0), [u, v] = at(0, 0), [e, nn] = s.grid(u, v); B.stone.set('ao', 0.85); B.stone.lathe(e, nn, gy - 0.05, [[0.22, 0], [0.24, 0.2], [0.2, 0.38], [0.13, 0.38]], 9, sh(st, 0.95), own); B.stone.set('ao', 1);
        B.props.set('ao', 0.9); this.pole(B.props, W3(0.05, 0, gy + 0.3), W3(0.25, 0.3, gy + 1.1), 0.035, 5, sh(tb, 0.95), own); B.props.set('ao', 1); break; }
      case 'cradle': { const gy = g(0, 0), [u, v] = at(0, 0), c = sh(tb, 1.05); B.props.set('ao', 0.85); this.lbox(B.props, u, v, 0.28, 0.45, gy + 0.08, gy + 0.36, sh(c, 0.8), c, own, false, yaw);
        for (const e of [-0.38, 0.38]) { const [u2, v2] = at(e, 0); this.lbox(B.props, u2, v2, 0.3, 0.03, gy, gy + 0.1, c, c, own, false, yaw + Math.PI / 2); } const cl = lin([0.75, 0.7, 0.6]); this.lbox(B.props, u, v, 0.25, 0.4, gy + 0.36, gy + 0.4, cl, cl, own, false, yaw); B.props.set('ao', 1); break; }
      case 'roller': { const sp = this.roofSpot(f); if (!sp) break; const a = f.rot, A = this.wp(sp.u - Math.cos(a) * 0.3, sp.v - Math.sin(a) * 0.3, sp.y + 0.14), Bq = this.wp(sp.u + Math.cos(a) * 0.3, sp.v + Math.sin(a) * 0.3, sp.y + 0.14);
        B.stone.set('ao', 1); this.pole(B.stone, A, Bq, 0.14, 9, sh(st, 1.0), own); break; }
      case 'roof_fuel': { const sp = this.roofSpot(f); if (!sp) break;
        // after the harvest: the household's grain share spread on a mat on the roof to dry (C)
        if (seasonOf(this.day) === 'harvest' && hi(f.plot, 91) < 0.5) { const g = lin([0.74, 0.64, 0.42]), a = f.rot + 1.2; B.props.set('ao', 1);
          const c0 = [sp.u - Math.cos(a) * 1.0 - 0.9, sp.v - Math.sin(a) * 1.0], pts = [[-0.8, -0.6], [0.8, -0.6], [0.8, 0.6], [-0.8, 0.6]].map(([x, z]) => this.wp(c0[0] + x * Math.cos(a) - z * Math.sin(a), c0[1] + x * Math.sin(a) + z * Math.cos(a), sp.y + 0.05));
          B.props.poly(pts, [0, 1, 0], [g, sh(g, 0.95), g, sh(g, 1.04)], own); } B.props.set('ao', 0.95); const n = 18;
        for (let k = 0; k < n; k++) { const a = f.rot + (hi(f.alt ?? 0, k) - 0.5) * 0.6, x = (hi(f.alt ?? 0, k, 1) - 0.5) * 0.9, z = (hi(f.alt ?? 0, k, 2) - 0.5) * 0.8, y = sp.y + 0.05 + 0.08 * Math.floor(k / 6);
          const c = sh(lin([0.47, 0.41, 0.31]), 0.75 + 0.4 * hi(f.alt ?? 0, k, 3)); const L2 = f.len * (0.7 + 0.3 * hi(k, 1)); this.pole(B.props, this.wp(sp.u + x - Math.cos(a) * L2 / 2, sp.v + z - Math.sin(a) * L2 / 2, y), this.wp(sp.u + x + Math.cos(a) * L2 / 2, sp.v + z + Math.sin(a) * L2 / 2, y + 0.03), 0.018, 4, c, own, false); }
        // a stack of dried dung cakes beside it
        const dc = lin([0.36, 0.3, 0.22]); for (let k = 0; k < 8; k++) { const [u, v] = [sp.u + 0.7 + (k % 2) * 0.05, sp.v + 0.3]; this.lbox(B.props, u, v, 0.1, 0.1, sp.y + k * 0.035, sp.y + k * 0.035 + 0.03, sh(dc, 0.85 + 0.2 * hi(k, 2)), dc, own, false, k * 0.7); }
        B.props.set('ao', 1); break; }
      case 'roof_mats': { const sp = this.roofSpot(f); if (!sp || seasonOf(this.day) !== 'warm' && seasonOf(this.day) !== 'harvest') break; const n = 1 + (f.alt ?? 0) % 3; B.props.set('ao', 0.95); // rolled on the roof only while the nights are slept there
        for (let k = 0; k < n; k++) { const a = f.rot, o = (k - (n - 1) / 2) * 0.3, cu = sp.u - Math.sin(a) * o, cv = sp.v + Math.cos(a) * o; const c = k === 1 ? lin([0.55, 0.3, 0.22]) : sh(lin([0.63, 0.56, 0.4]), 0.9 + 0.15 * hi(k, f.plot));
          this.pole(B.props, this.wp(cu - Math.cos(a) * 0.9, cv - Math.sin(a) * 0.9, sp.y + 0.12), this.wp(cu + Math.cos(a) * 0.9, cv + Math.sin(a) * 0.9, sp.y + 0.12), 0.12, 8, c, own); }
        B.props.set('ao', 1); break; }
      case 'fleece': { // over a lane-facing parapet of the house
        const cand = this.walls.filter(w => w.plot === f.plot && w.w.kind === 'outer' && !w.w.door && Math.hypot(w.w.u1 - w.w.u0, w.w.v1 - w.w.v0) > 1.5); if (!cand.length) break;
        const we = cand[Math.floor(hi(f.alt ?? 0, 3) * cand.length)], w = we.w, ax = w.v0 === w.v1 ? 0 : 1, sp = this.wallSpan(w), top = sp.top + 0.01, t = w.thick;
        const cols: RGB[] = [[0.82, 0.78, 0.68], [0.3, 0.26, 0.22], [0.55, 0.45, 0.33], [0.6, 0.3, 0.22]]; const c = lin(cols[(f.alt ?? 0) % cols.length]);
        const mid = ax === 0 ? (w.u0 + w.u1) / 2 : (w.v0 + w.v1) / 2, cc = ax === 0 ? w.v0 : w.u0, hw = 0.4, drop = 0.55;
        const p = (al: number, ac: number, y: number) => (ax === 0 ? this.wp(al, ac, y) : this.wp(ac, al, y)); const [nx, nz] = ax === 0 ? this.dirW(0, 1) : this.dirW(1, 0);
        B.props.set('ao', 1); B.props.quad(p(mid - hw, cc - t / 2 - 0.02, top + 0.02), p(mid + hw, cc - t / 2 - 0.02, top + 0.02), p(mid + hw, cc + t / 2 + 0.02, top + 0.02), p(mid - hw, cc + t / 2 + 0.02, top + 0.02), [0, 1, 0], c, c, c, c, own);
        for (const e of [-1, 1]) B.props.quad(p(mid - hw, cc + e * (t / 2 + 0.02), top + 0.02), p(mid + hw, cc + e * (t / 2 + 0.02), top + 0.02), p(mid + hw * 0.9, cc + e * (t / 2 + 0.03), top - drop), p(mid - hw * 1.05, cc + e * (t / 2 + 0.03), top - drop * 0.9), [nx * e, 0, nz * e], c, c, sh(c, 0.9), sh(c, 0.9), own);
        break; }
      default: break; // niche, drain, dungcakes: drawn on the walls (faceDecals); waterjar: the plan's jars
    }
    void L;
  }
}
