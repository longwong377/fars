// s17 C7 (D-610): one furnishing system for every enterable room (the town's and the villages' houses through
// settlement/houses.ts; the Terrace's room ranges through furnish.ts). Pure data, no three.js: a room (a rectangle in its
// own site frame, its doorways and the wall away from the court) and the household that lives or works in it go in; the
// things in the room come out, each with its place, turn, size, height and a variant. What a room holds comes from who
// lives there (UD-08): the household's standing, its members (children, infants, women, the old), its trades and jobs, its
// animals and the season (a poor house is sparse, a rich one full; a weaver's house has a loom; a smith's room an anvil),
// never one kit copied everywhere. Every doorway keeps its leaf sweep and an approach strip clear, and a walking line
// joins the doorways; tall things stand along the walls, flat ones (mats, carpets, hides) may lie in the walking line.
// Evidence: no house of Achaemenid Fars has been excavated (research/SETTLEMENT.md §8). The objects are the period kit's
// (tools/blender/model_props.py, interior_props.py: reed mats, felt bedding, storage jars, querns, looms, saucer lamps,
// chests, stools): B by analogy (the Persepolis Treasury's finds, the Fortification texts' rations and crafts, Hasanlu,
// Baba Jan, Nush-i Jan); which house holds what, how many and where is the gap rule's most probable reconstruction (C, D-207).
import { hashString } from '../../core/rng';

/** the use of a room (C) */
export type Use = 'living' | 'sleeping' | 'store' | 'vestibule' | 'kitchen' | 'workroom';
/** a room side: 0 the −v wall, 1 the +v wall, 2 the −u wall, 3 the +u wall */
export type Side = 0 | 1 | 2 | 3;
/** a doorway in a room's wall: its side, its centre along that wall (u for sides 0/1, v for 2/3) and its width */
export interface Door { side: Side; at: number; w: number }
/** a room: its cell rectangle in its site's local frame (metres), the doorways, the wall away from the court */
export interface RoomIn { id: string; u0: number; u1: number; v0: number; v1: number; doors: Door[]; back: Side; use: Use;
  /** the inner face of the walls from the cell bounds (m; the walls stand on the raster edges) */ inset?: number;
  /** the ceiling above the floor (m) */ ceil?: number }
/** the household of a room (all C where the population is silent) */
export interface Profile {
  /** 0 the poorest .. 1 the richest (houseplan.ts standingOf) */ standing: number;
  members: number; children: number; infants: number; women: number; elders: number;
  /** the trades of the plot and the household's jobs (population.ts Job, sub) */ craft: string | null; jobs: string[];
  animal: string | null; persian: boolean;
  /** the season's band (houses.ts seasonOf): the near tiles are rebuilt when it turns */ season: 'harvest' | 'warm' | 'cold';
  /** where the profile came from: the population's household (B for the people, C for their things) or the plot alone */ from: 'population' | 'plot';
  /** a town house, a village house or a room of the Terrace's ranges */ place: 'town' | 'village' | 'terrace';
}
/** a thing in a room */
export type Kind =
  | 'mat' | 'carpet' | 'fleece' | 'hide' | 'grass_bed'
  | 'roll' | 'rugs' | 'bedding' | 'cushion' | 'chest' | 'stool' | 'low_table' | 'bench'
  | 'jar_store' | 'jar_neck' | 'jar_water' | 'sack' | 'sack_lying' | 'bin' | 'basket' | 'bale' | 'grain'
  | 'cookpot' | 'bowls' | 'jug' | 'basin' | 'kneading' | 'quern' | 'mortar' | 'bread' | 'milkpot'
  | 'loom_ground' | 'loom_upright' | 'spinning' | 'bolts' | 'wool'
  | 'tool_lean' | 'anvil' | 'bellows' | 'timber' | 'vat' | 'pots' | 'wheel' | 'pigments' | 'mould' | 'seal_bench' | 'weigh_table' | 'tablets'
  | 'cradle' | 'toys' | 'peg_cloth' | 'herbs' | 'onions' | 'broom' | 'lamp'
  | 'shield' | 'arrows' | 'vessels';
/** a placed thing: centre (u, v) in the site frame, turn (radians CCW from +u: the thing's x along it), footprint (w along
 *  its x, d across), height h, base y above the floor, a variant 0..1, the wall it stands against (−1: free) */
export interface Item { k: Kind; u: number; v: number; rot: number; w: number; d: number; h: number; y: number; vr: number; wall: number; note?: string; sub?: string; n?: number }
export interface Plan { items: Item[]; floor: number; covered: number; use: Use; clear: number[][] }

/** triangles a thing costs at the near level (the models' lod2 and the kit's lathes, as drawn: draw.ts) */
export const TRIS: Record<Kind, number> = {
  mat: 105, carpet: 164, fleece: 302, hide: 172, grass_bed: 300, roll: 62, rugs: 24, bedding: 210, cushion: 100, chest: 446, stool: 288, low_table: 300, bench: 264,
  jar_store: 90, jar_neck: 80, jar_water: 88, sack: 114, sack_lying: 166, bin: 314, basket: 72, bale: 288, grain: 230,
  cookpot: 86, bowls: 60, jug: 266, basin: 276, kneading: 136, quern: 120, mortar: 278, bread: 72, milkpot: 100,
  loom_ground: 714, loom_upright: 145, spinning: 140, bolts: 212, wool: 302,
  tool_lean: 60, anvil: 294, bellows: 130, timber: 100, vat: 300, pots: 412, wheel: 230, pigments: 712, mould: 60, seal_bench: 158, weigh_table: 428, tablets: 96,
  cradle: 180, toys: 204, peg_cloth: 62, herbs: 114, onions: 178, broom: 63, lamp: 40,
  shield: 438, arrows: 300, vessels: 340,
};
/** things that lie flat on the floor: they may lie in a walking line (not in a door's leaf sweep) */
export const FLAT = new Set<Kind>(['mat', 'carpet', 'fleece', 'hide', 'grass_bed']);
/** things off the floor (hung from the ceiling poles or a wall peg): they take no floor */
export const HUNG = new Set<Kind>(['peg_cloth', 'herbs', 'onions', 'lamp']);

const h01 = (s: string) => hashString(s) / 4294967296;
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

/** the occupancy of a room's floor on a 0.1 m grid: 0 free, 1 a walking line (flat things only), 2 taken or a door's sweep */
export class Floor {
  readonly nx: number; readonly ny: number; readonly g: Uint8Array;
  constructor(readonly x0: number, readonly y0: number, readonly x1: number, readonly y1: number) { this.nx = Math.max(1, Math.round((x1 - x0) / 0.1)); this.ny = Math.max(1, Math.round((y1 - y0) / 0.1)); this.g = new Uint8Array(this.nx * this.ny); }
  private span(a0: number, a1: number, lo: number, n: number): [number, number] { return [clamp(Math.floor((a0 - lo) / 0.1 + 1e-6), 0, n), clamp(Math.ceil((a1 - lo) / 0.1 - 1e-6), 0, n)]; }
  mark(u0: number, v0: number, u1: number, v1: number, val: number) { const [i0, i1] = this.span(u0, u1, this.x0, this.nx), [j0, j1] = this.span(v0, v1, this.y0, this.ny);
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) { const k = j * this.nx + i; if (this.g[k] < val) this.g[k] = val; } }
  /** the flat things' own layer (a chest may stand on a mat's edge; two mats do not overlap) */
  private fl?: Uint8Array;
  markFlat(u0: number, v0: number, u1: number, v1: number) { const f = (this.fl ??= new Uint8Array(this.g.length)), [i0, i1] = this.span(u0, u1, this.x0, this.nx), [j0, j1] = this.span(v0, v1, this.y0, this.ny); for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) f[j * this.nx + i] = 1; }
  /** is the box free (for a flat thing: no 2s and no other flat thing; else no 1s or 2s)? */
  free(u0: number, v0: number, u1: number, v1: number, flat: boolean) { if (u0 < this.x0 - 1e-6 || v0 < this.y0 - 1e-6 || u1 > this.x1 + 1e-6 || v1 > this.y1 + 1e-6) return false;
    const [i0, i1] = this.span(u0, u1, this.x0, this.nx), [j0, j1] = this.span(v0, v1, this.y0, this.ny);
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) { const k = j * this.nx + i, x = this.g[k]; if (x >= 2 || (!flat && x >= 1) || (flat && this.fl?.[k])) return false; } return true; }
  share(min: number) { let n = 0; for (const x of this.g) if (x >= min) n++; return n / this.g.length; }
}

/** the room as the planner sees it: inner faces, the walls' runs, the clear zones */
export interface Ctx { r: RoomIn; p: Profile; f: Floor; items: Item[]; seed: string; x0: number; x1: number; y0: number; y1: number; budget: number; spent: number; taken: Set<string>; clear: number[][] }
const NORM: [number, number][] = [[0, 1], [0, -1], [1, 0], [-1, 0]]; // into the room from each side

/** the rectangle a thing of footprint (w along the wall, d out of it) takes against wall `side` at `a` along it */
export function wallBox(c: Ctx, side: Side, a: number, w: number, d: number, gap = 0.04): [number, number, number, number] {
  return side === 0 ? [a - w / 2, c.y0 + gap, a + w / 2, c.y0 + gap + d] : side === 1 ? [a - w / 2, c.y1 - gap - d, a + w / 2, c.y1 - gap]
    : side === 2 ? [c.x0 + gap, a - w / 2, c.x0 + gap + d, a + w / 2] : [c.x1 - gap - d, a - w / 2, c.x1 - gap, a + w / 2];
}
const wallRot = (side: Side) => (side < 2 ? 0 : Math.PI / 2) + (side === 1 || side === 2 ? Math.PI : 0); // x along the wall, the front (−z) into the room
/** the walls in the order a household fills them: the back wall first, then the side walls, the door wall last */
function wallOrder(c: Ctx): Side[] { const b = c.r.back, opp: Side = ([1, 0, 3, 2] as Side[])[b], sides: Side[] = b < 2 ? [2, 3] : [0, 1];
  if (h01(c.seed + ':sides') < 0.5) sides.reverse(); return [b, ...sides, opp]; }

/** put a thing against a wall: the first free place along the walls in order (or `pref` along each: 0 a corner, 0.5 the
 *  middle, 1 the other corner), trying a few spots; false when no wall has room */
export function onWall(c: Ctx, k: Kind, w: number, d: number, h: number, pref: number, extra: Partial<Item> = {}, walls = wallOrder(c)): boolean {
  if (c.spent + TRIS[k] > c.budget) return false;
  for (const side of walls) {
    const lo = side < 2 ? c.x0 : c.y0, hi = side < 2 ? c.x1 : c.y1, L = hi - lo; if (L < w + 0.1) continue;
    const tries = [pref, (pref + 0.33) % 1, (pref + 0.66) % 1, 1 - pref, (pref + 0.15) % 1, (pref + 0.5) % 1, (pref + 0.85) % 1];
    for (const t of tries) { const a = lo + w / 2 + 0.05 + (L - w - 0.1) * t, [a0, b0, a1, b1] = wallBox(c, side, a, w, d);
      if (!c.f.free(a0, b0, a1, b1, false)) continue;
      c.f.mark(a0, b0, a1, b1, 2); const [nu, nv] = NORM[side];
      c.items.push({ k, u: (a0 + a1) / 2, v: (b0 + b1) / 2, rot: wallRot(side), w, d, h, y: 0, vr: h01(`${c.seed}:${k}:${c.items.length}`), wall: side, ...extra });
      c.spent += TRIS[k]; void nu; void nv; return true; }
  }
  return false;
}
/** put a thing in a corner (tall things leaning: tools, a broom, a rolled loom) */
export function inCorner(c: Ctx, k: Kind, w: number, d: number, h: number, extra: Partial<Item> = {}): boolean {
  if (c.spent + TRIS[k] > c.budget) return false;
  const cs: [Side, number][] = [[c.r.back, 0], [c.r.back, 1], ...wallOrder(c).slice(1).flatMap(s => [[s, 0], [s, 1]] as [Side, number][])];
  const o = Math.floor(h01(c.seed + ':corner:' + c.items.length) * cs.length);
  for (let q = 0; q < cs.length; q++) { const [side, t] = cs[(q + o) % cs.length], lo = side < 2 ? c.x0 : c.y0, hi = side < 2 ? c.x1 : c.y1, a = t ? hi - w / 2 - 0.04 : lo + w / 2 + 0.04;
    const [a0, b0, a1, b1] = wallBox(c, side, a, w, d); if (!c.f.free(a0, b0, a1, b1, false)) continue;
    c.f.mark(a0, b0, a1, b1, 2); c.items.push({ k, u: (a0 + a1) / 2, v: (b0 + b1) / 2, rot: wallRot(side), w, d, h, y: 0, vr: h01(`${c.seed}:${k}:${c.items.length}`), wall: side, ...extra }); c.spent += TRIS[k]; return true; }
  return false;
}
/** lay a flat thing on the floor, centred as near the room's middle (or its back half) as the doorways' sweeps allow */
export function onFloor(c: Ctx, k: Kind, w: number, d: number, back = 0.5, extra: Partial<Item> = {}): boolean {
  if (c.spent + TRIS[k] > c.budget) return false;
  const along = c.r.back < 2; // the thing's length along the back wall
  const W = along ? w : d, D = along ? d : w, cu = (c.x0 + c.x1) / 2, cv = (c.y0 + c.y1) / 2, [bu, bv] = NORM[c.r.back];
  const depth = along ? c.y1 - c.y0 : c.x1 - c.x0;
  for (const off of [0, 0.15, -0.15, 0.3, -0.3, 0.45]) { const s = (back - 0.5) * (depth - (along ? D : W)) + off; // from the middle toward the back wall
    const u = cu - bu * s, v = cv - bv * s, u0 = u - W / 2, u1 = u + W / 2, v0 = v - D / 2, v1 = v + D / 2;
    if (!c.f.free(u0, v0, u1, v1, true)) continue;
    if (FLAT.has(k)) c.f.markFlat(u0, v0, u1, v1); else c.f.mark(u0, v0, u1, v1, 2); c.items.push({ k, u, v, rot: along ? 0 : Math.PI / 2, w, d, h: 0.02, y: 0, vr: h01(`${c.seed}:${k}:${c.items.length}`), wall: -1, ...extra }); c.spent += TRIS[k]; return true; }
  return false;
}
/** a thing hung off the floor: from the ceiling poles near a wall, or on a peg (no floor taken) */
export function hang(c: Ctx, k: Kind, y: number, w: number, h: number, extra: Partial<Item> = {}): boolean {
  if (c.spent + TRIS[k] > c.budget) return false;
  const walls = wallOrder(c), side = walls[Math.floor(h01(`${c.seed}:hang:${c.items.length}`) * 3)], lo = side < 2 ? c.x0 : c.y0, hi = side < 2 ? c.x1 : c.y1;
  // clear of the doorways in that wall and of the other hung things
  for (let q = 0; q < 6; q++) { const a = lo + 0.3 + (hi - lo - 0.6) * h01(`${c.seed}:hang:${c.items.length}:${q}`);
    if (c.r.doors.some(dd => dd.side === side && Math.abs(dd.at - a) < dd.w / 2 + 0.35)) continue;
    if (c.items.some(it => HUNG.has(it.k) && it.wall === side && Math.abs((side < 2 ? it.u : it.v) - a) < 0.45)) continue;
    const [a0, b0, a1, b1] = wallBox(c, side, a, w, 0.12, 0.02);
    c.items.push({ k, u: (a0 + a1) / 2, v: (b0 + b1) / 2, rot: wallRot(side), w, d: 0.12, h, y, vr: h01(`${c.seed}:${k}:${c.items.length}`), wall: side, ...extra }); c.spent += TRIS[k]; return true; }
  return false;
}

/** the zones of a room kept clear: each doorway's leaf sweep (2) and its approach strip into the room (1); a walking
 *  line (1) from each doorway to the room's middle */
export function clearZones(c: Ctx) {
  const { r, f } = c, cu = (c.x0 + c.x1) / 2, cv = (c.y0 + c.y1) / 2;
  for (const d of r.doors) { const [nu, nv] = NORM[d.side], sweep = d.w + 0.2, appr = Math.min(1.5, ((d.side < 2 ? c.y1 - c.y0 : c.x1 - c.x0)) * 0.6);
    const fu = d.side === 2 ? c.x0 : d.side === 3 ? c.x1 : d.at, fv = d.side === 0 ? c.y0 : d.side === 1 ? c.y1 : d.at;
    const box = (along: number, deep: number): [number, number, number, number] => d.side < 2 ? [fu - along / 2, Math.min(fv, fv + nv * deep), fu + along / 2, Math.max(fv, fv + nv * deep)] : [Math.min(fu, fu + nu * deep), fv - along / 2, Math.max(fu, fu + nu * deep), fv + along / 2];
    const s = box(sweep, d.w / 2 + 0.25), a = box(d.w + 0.35, appr); f.mark(...s, 2); f.mark(...a, 1); c.clear.push([...s, 2], [...a, 1]);
    // the line from the approach's end to the middle of the room (0.8 m wide)
    const eu = fu + nu * appr, ev = fv + nv * appr; const lu0 = Math.min(eu, cu) - 0.4, lu1 = Math.max(eu, cu) + 0.4, lv0 = Math.min(ev, cv) - 0.4, lv1 = Math.max(ev, cv) + 0.4;
    if (Math.abs(eu - cu) > Math.abs(ev - cv)) { f.mark(lu0, ev - 0.4, lu1, ev + 0.4, 1); c.clear.push([lu0, ev - 0.4, lu1, ev + 0.4, 1]); } else { f.mark(eu - 0.4, lv0, eu + 0.4, lv1, 1); c.clear.push([eu - 0.4, lv0, eu + 0.4, lv1, 1]); }
  }
}

/** the textile colours of a household (undyed wool and linen; madder red, indigo and saffron accents by standing): an index
 *  into draw.ts TEXTILE, chosen per thing */
export const textileOf = (p: Profile, vr: number) => { const dyed = vr < 0.15 + 0.55 * p.standing; return dyed ? 4 + Math.floor((vr * 7.31 % 1) * 5) : Math.floor((vr * 3.7 % 1) * 4); };

/** what a room holds (the recipes; all C) */
function recipe(c: Ctx) {
  const { r, p } = c, st = p.standing, h = (k: string) => h01(`${c.seed}:${k}`), rich = st > 0.7, poor = st < 0.3;
  const W = c.x1 - c.x0, D = c.y1 - c.y0, area = W * D, cold = p.season === 'cold', jobs = new Set(p.jobs);
  const farmer = jobs.has('farmer') || jobs.has('gardener'), herder = jobs.has('herder') || jobs.has('shepherd') || p.animal === 'sheep' || p.animal === 'goats';
  const tools = () => { // what leans in a corner: the household's work (C: the tools of the PF rations' trades and the field calendar)
    const t: string[] = [];
    if (farmer) t.push('hoe', 'sickle', 'fork'); if (herder) t.push('staff', 'goad'); if (jobs.has('builder')) t.push('adze', 'mallet', 'trowel');
    if (jobs.has('guard')) t.push('spear', 'bow'); if (jobs.has('craftsman')) t.push('mallet', 'adze'); if (jobs.has('porter')) t.push('staff'); if (!t.length) t.push('staff', 'hoe');
    return t; };
  const lean = (n: number) => { const t = tools(); for (let i = 0; i < n; i++) { const sub = t[Math.floor(h('tool' + i) * t.length)]; const len = sub === 'fork' || sub === 'spear' ? 1.9 : sub === 'staff' || sub === 'goad' ? 1.5 : sub === 'hoe' ? 1.25 : 0.5;
    inCorner(c, 'tool_lean', 0.22, 0.2, len, { sub }); } };
  const wantLoom = jobs.has('weaver') || p.craft === 'textile' || (p.women > 0 && h('loom') < 0.18 + 0.2 * (1 - st));
  switch (r.use) {
    case 'vestibule': {
      onWall(c, 'jar_water', 0.46, 0.46, 0.92, 0.05, { note: 'the water jar on its stand by the door, a cup on its mouth (C)' }, [r.back, ...wallOrder(c).slice(1)]);
      if (h('bench') < 0.25 + 0.5 * st) onWall(c, 'bench', clamp(W * 0.5, 0.9, 1.8), 0.44, 0.45, 0.5, { note: 'a mud-brick bench along the wall, plastered with it (C)' });
      hang(c, 'peg_cloth', 1.45, 0.5, 0.9, { note: 'a cloak hung on a wooden peg by the door (C)' });
      if (h('broom') < 0.6) inCorner(c, 'broom', 0.2, 0.18, 0.66, { note: 'a broom of twigs (C)' });
      lean(1 + (h('lean') < 0.5 ? 1 : 0));
      if (h('sack') < 0.4 + 0.3 * st) onWall(c, h('sl') < 0.5 ? 'sack_lying' : 'sack', 0.45, 0.42, 0.6, 0.8);
      if (p.children && h('toys') < 0.3) onWall(c, 'toys', 0.5, 0.4, 0.15, 0.7, { note: 'a child\'s things left by the door (C)' });
      break; }
    case 'store': {
      const n = Math.round(2 + 8 * st + 3 * h('n') + (p.season === 'harvest' ? 2 : 0) - (p.season === 'warm' ? 1 : 0));
      const village = p.place === 'village';
      if (village && W >= 1.4 && h('bin') < 0.75) onWall(c, 'bin', 0.9, 0.85, 1.0, 0.1, { note: 'a mud storage bin for the grain, its mouth sealed with clay (C; the village bins: D-254)' });
      let miss = 0; for (let i = 0; i < n; i++) { const x = h('s' + i), big = x < 0.45;
        const k: Kind = big ? 'jar_store' : x < 0.6 ? 'jar_neck' : x < 0.82 ? 'sack' : x < 0.92 ? 'sack_lying' : 'basket';
        const s = 0.85 + 0.3 * h('sz' + i), w = k === 'jar_store' ? 0.56 * s : k === 'jar_neck' ? 0.32 * s : k === 'sack_lying' ? 0.62 : 0.44 * s;
        if (onWall(c, k, w, k === 'sack_lying' ? 0.44 : w, k === 'jar_store' ? 0.9 * s : k === 'jar_neck' ? 0.45 * s : 0.58, (i / Math.max(1, n)) % 1)) { miss = 0; continue; }
        // no room for it: a smaller thing in its place (a necked jar, a basket), until three in a row will not go
        if (onWall(c, h('sm' + i) < 0.5 ? 'jar_neck' : 'basket', 0.32, 0.32, h('sm' + i) < 0.5 ? 0.44 : 0.16, h('sp' + i))) { miss = 0; continue; } if (++miss >= 3) break; }
      if (h('hang') < 0.7) hang(c, h('ho') < 0.5 ? 'onions' : 'herbs', (r.ceil ?? 2.3) - 0.75, 0.4, 0.6, { note: 'onions and garlic plaited and hung from the poles to keep (C)' });
      if (st > 0.5 && h('chest') < 0.4) onWall(c, 'chest', 0.95, 0.55, 0.55, 0.5);
      if (p.craft === 'pottery' || h('pots') < 0.25) onWall(c, 'pots', 0.95, 0.66, 0.3, 0.3, { note: 'spare pots stacked mouth down (C)' });
      if (p.season === 'harvest' && h('grain') < 0.5) onWall(c, 'grain', 0.5, 0.5, 0.65, 0.6, { note: 'the new grain in a sack, still open (C)' });
      break; }
    case 'kitchen': {
      onWall(c, 'quern', 0.6, 0.42, 0.27, 0.3, { note: 'a saddle quern and its rubbing stone: the day\'s flour (PF flour rations, B; C)' });
      onWall(c, 'kneading', 0.9, 0.48, 0.2, 0.7, { note: 'a wooden kneading trough (C)' });
      onWall(c, 'cookpot', 0.36, 0.34, 0.25, 0.9); onWall(c, 'bowls', 0.3, 0.3, 0.12, 0.85); onWall(c, 'jar_neck', 0.32, 0.32, 0.45, 0.2);
      if (h('jug') < 0.6) onWall(c, 'jug', 0.18, 0.16, 0.18, 0.15); if (h('basin') < 0.5) onWall(c, 'basin', 0.47, 0.47, 0.11, 0.6);
      if (h('mortar') < 0.5) onWall(c, 'mortar', 0.24, 0.22, 0.12, 0.5); onWall(c, 'basket', 0.4, 0.34, 0.14, 0.4, { note: 'a basket of bread under a cloth (C)' });
      if (herder || p.animal === 'goats' || p.animal === 'sheep') onWall(c, 'milkpot', 0.28, 0.28, 0.29, 0.75, { note: 'a churn pot for the milk (C)' });
      hang(c, 'onions', (r.ceil ?? 2.3) - 0.75, 0.4, 0.6); if (h('herbs') < 0.7) hang(c, 'herbs', (r.ceil ?? 2.3) - 0.6, 0.3, 0.45, { note: 'a bunch of herbs drying from the poles (C)' });
      if (h('sk') < 0.6) onWall(c, 'sack', 0.42, 0.42, 0.6, 0.1, { note: 'a sack of flour (C)' });
      break; }
    case 'workroom': {
      switch (p.craft) {
        case 'metal': onWall(c, 'anvil', 0.55, 0.6, 0.7, 0.35, { note: 'an anvil on its block (C)' }); onWall(c, 'bellows', 0.5, 0.7, 0.14, 0.6, { note: 'a pair of skin bellows, off the forge (C)' }); onWall(c, 'sack', 0.42, 0.42, 0.6, 0.85, { note: 'charcoal in a sack (C)' }); lean(2); break;
        case 'wood': onWall(c, 'timber', clamp(W * 0.7, 1, 2.6), 0.8, 0.5, 0.5, { note: 'seasoning timber stacked on spacers (C)' }); onWall(c, 'bench', 1.4, 0.5, 0.5, 0.2); lean(2); break;
        case 'textile': onWall(c, 'loom_ground', 2.6, 1.2, 0.28, 0.5, { note: 'a ground loom pegged out along the wall, a cloth half woven (C)' }) || onWall(c, 'loom_upright', 1.5, 0.3, 1.8, 0.5, { note: 'an upright loom against the wall, a cloth on it (C)' }); onWall(c, 'wool', 0.62, 0.54, 0.14, 0.85, { note: 'fleeces and a heap of washed wool (C)' }); onWall(c, 'bolts', 1.0, 0.6, 0.3, 0.15, { note: 'finished cloth folded in bolts (C)' }); onWall(c, 'spinning', 0.4, 0.36, 0.3, 0.6); break;
        case 'bakery': for (let i = 0; i < 2; i++) onWall(c, 'kneading', 0.95, 0.5, 0.21, 0.2 + 0.5 * i); for (let i = 0; i < 3; i++) onWall(c, 'sack', 0.44, 0.42, 0.6, 0.7 + 0.1 * i, { note: 'flour in sacks (C)' }); onWall(c, 'basket', 0.45, 0.4, 0.15, 0.5, { note: 'flat loaves in a basket (C)' }); break;
        case 'brewery': for (let i = 0; i < 3; i++) onWall(c, 'vat', 0.72, 0.72, 0.74, 0.15 + 0.35 * i); for (let i = 0; i < 3; i++) onWall(c, 'jar_neck', 0.34, 0.34, 0.46, 0.8); break;
        case 'pottery': onWall(c, 'wheel', 0.62, 0.62, 0.42, 0.35, { note: 'a potter\'s turntable: a heavy wheel on a pivot stone (C; the tournette, B by analogy)' }); onWall(c, 'pots', 1.0, 0.7, 0.31, 0.7, { note: 'pots drying before the firing (C)' }); onWall(c, 'jar_store', 0.5, 0.5, 0.82, 0.1); onWall(c, 'basin', 0.47, 0.47, 0.11, 0.9, { note: 'a basin of slip (C)' }); break;
        case 'pigment': onWall(c, 'pigments', 0.5, 0.36, 0.14, 0.4); for (let i = 0; i < 2; i++) onWall(c, 'bowls', 0.3, 0.3, 0.12, 0.7 + 0.1 * i); onWall(c, 'jar_neck', 0.32, 0.32, 0.45, 0.1); break;
        case 'brick': onWall(c, 'mould', 0.52, 0.38, 0.11, 0.5); lean(2); break;
        default: lean(2); onWall(c, 'bench', 1.4, 0.5, 0.5, 0.4); onWall(c, 'basket', 0.4, 0.34, 0.14, 0.8);
      }
      onWall(c, 'jar_water', 0.4, 0.4, 0.5, 0.95); if (h('peg') < 0.6) hang(c, 'peg_cloth', 1.45, 0.5, 0.9);
      onFloor(c, 'mat', clamp(W * 0.5, 0.9, 1.6), clamp(D * 0.4, 0.8, 1.2), 0.85, { note: 'a mat where the master sits at the work (C)' });
      break; }
    case 'living': case 'sleeping': {
      const living = r.use === 'living';
      // 1. the floor: a reed mat over the beaten earth (in nearly every house), a pile carpet in the richer ones, a fleece or
      //    a hide where the household keeps sheep or goats and in the cold months
      const mw = clamp(W - 1.5, 0.9, 2.6), md = clamp(D - 1.5, 0.8, 2.0);
      if (rich && h('carpet') < 0.75) onFloor(c, 'carpet', clamp(mw * 0.8, 1.0, 2.2), clamp(md * 0.8, 0.9, 1.6), 0.55, { note: 'a knotted pile carpet (the Pazyryk carpet, a near-contemporary knotted pile, B by analogy; in a rich town house C)' });
      else if (!poor || h('mat') < 0.75) onFloor(c, 'mat', mw, md, 0.5, { note: 'a reed mat over the beaten-earth floor (C)' });
      if ((herder || cold) && h('fleece') < (cold ? 0.8 : 0.5)) onFloor(c, h('fh') < 0.6 ? 'fleece' : 'hide', 0.62, 0.54, 0.8, { note: cold ? 'a fleece laid on the floor against the cold (C)' : 'a fleece from the household\'s flock (C)' });
      // 2. the bedding: rolled against the back wall by day, one roll for every two or three of the household; the poor
      //    sleep on fleeces and grass
      const rolls = clamp(Math.ceil(p.members / (living ? 3 : 2)), 1, living ? 3 : 5);
      for (let i = 0; i < rolls; i++) onWall(c, 'roll', 0.62 + 0.1 * h('rw' + i), 0.3, 0.26, 0.1 + 0.2 * i, { note: 'the bedding rolled against the wall by day: a felt and a quilt tied with a cord (C)' }, [r.back, ...wallOrder(c).slice(1, 3)]);
      if (!living && poor && h('gb') < 0.6 && p.season !== 'cold') onFloor(c, 'grass_bed', 0.95, 0.62, 0.85, { note: 'a bed of dry grass with a blanket over it (C)' });
      // 3. what marks this household: the infant's cradle, the weaver's loom, the scribe's tablets, the women's spinning,
      //    the children's toys, the tools of the men's work
      if (p.infants > 0) onWall(c, 'cradle', 0.9, 0.62, 0.32, 0.6, { sub: st > 0.5 ? 'wood' : 'basket', note: st > 0.5 ? 'a wooden cradle with its swaddling cloth (C)' : 'a basket cradle (C)' });
      if (wantLoom && living) { if (!(W >= 2.4 && D >= 2.4 && onWall(c, 'loom_upright', 1.5, 0.3, 1.8, 0.5, { note: 'an upright loom against the wall, a cloth on it (C)' }))) onWall(c, 'wool', 0.62, 0.54, 0.14, 0.7, { note: 'fleeces and washed wool for the loom (C)' }); }
      // 4. what the household's standing buys: quilts piled, a ledge of bedding, chests, cushions, a tray-table, stools
      const piles = Math.round(1 + 2 * st + (cold ? 1 : 0) + h('pile'));
      if (!poor || h('rugs') < 0.6) onWall(c, 'rugs', 0.56, 0.44, 0.05 * (2 + piles * 1.5), 0.9, { n: 2 + Math.round(piles * 1.5), note: 'quilts and rugs folded in a pile (C)' });
      if (st > 0.35 && h('bed') < 0.4 + st) onWall(c, 'bedding', 0.75, 0.5, 0.35 + 0.15 * st, 0.75, { note: 'the household\'s quilts and cushions stacked on a low mud ledge (C)' });
      if (st > 0.55 && h('chest') < 0.8) onWall(c, 'chest', 0.9 + 0.2 * st, 0.52, 0.55, 0.55, { note: 'a wooden chest for the clothes and the household\'s valuables (C)' });
      if (rich && h('chest2') < 0.5) onWall(c, 'chest', 0.8, 0.5, 0.5, 0.2, { note: 'a second chest (C)' });
      if (jobs.has('scribe') || jobs.has('official') || jobs.has('steward')) onWall(c, 'tablets', 0.42, 0.3, 0.12, 0.25, { note: 'a basket of clay tablets and the scribe\'s stylus (the Fortification archive, A for the tablets; at home C)' });
      if (p.women > 0 && h('spin') < 0.75) onWall(c, 'spinning', 0.4, 0.36, 0.32, 0.4, { note: 'a basket of combed wool with the spindle and the distaff stuck in it (spinning: women\'s work in the PF textile texts, B; C)' });
      if (p.children > 0 && h('toys') < 0.7) onWall(c, 'toys', 0.5, 0.4, 0.15, 0.85, { sub: ['wheeled', 'bones', 'bow'][Math.floor(h('tk') * 3)], note: 'a child\'s toys: a clay animal on wheels, knucklebones, a toy bow (wheeled clay animals and astragali known in the region and period: RECOLLECTION, NOT SEEN; C)' });
      if (living) lean(farmer || herder ? 1 + (h('l2') < 0.5 ? 1 : 0) : (h('l1') < 0.4 ? 1 : 0));
      const cush = poor ? 0 : Math.round((living ? 1 : 0) + 3 * st * (0.6 + 0.4 * h('cu'))); for (let i = 0; i < cush; i++) onWall(c, 'cushion', 0.5, 0.42, 0.14, 0.35 + 0.15 * i, { note: 'a cushion of wool stuffed in a woven cover (C)' });
      if (living) {
        if (st > 0.4 || h('lt') < 0.2) onWall(c, 'low_table', 0.72, 0.5, 0.28, 0.5, { note: 'a low wooden tray-table for the meal, the bowls on it (C)' });
        else onWall(c, 'bowls', 0.3, 0.3, 0.12, 0.6, { note: 'the household\'s bowls stacked (C)' });
        if (st > 0.6) for (let i = 0; i < 1 + Math.round(st * 2 * h('stools')); i++) onWall(c, 'stool', 0.42, 0.42, 0.42, 0.3 + 0.3 * i, { note: 'a low wooden stool (C)' });
        if (h('bread') < 0.5) onWall(c, 'basket', 0.4, 0.34, 0.14, 0.65, { note: 'a basket of flat bread under a cloth (C)' });
        if (h('wj') < 0.55) onWall(c, 'jar_water', 0.36, 0.36, 0.46, 0.05, { note: 'a water jar (C)' });
        if (!poor || h('herbs') < 0.3) hang(c, h('ho') < 0.5 ? 'herbs' : 'onions', (r.ceil ?? 2.3) - 0.65, 0.35, 0.5, { note: h('ho') < 0.5 ? 'a bunch of herbs drying from the poles (C)' : 'onions plaited on a cord, hung from the poles (C)' });
      }
      const pegs = poor ? 1 : clamp(Math.round(1 + st * 2 + p.members / 6 + h('pg') - 0.5), 1, 4); for (let i = 0; i < pegs; i++) hang(c, 'peg_cloth', 1.4 + 0.15 * h('py' + i), 0.5, 0.9, { note: 'clothes and a bag hung on wooden pegs in the wall (C)' });
      if (rich && h('jars') < 0.6) for (let i = 0; i < 2; i++) onWall(c, 'jar_neck', 0.3, 0.3, 0.44, 0.95 - 0.1 * i, { note: 'jars of oil and wine (C)' });
      if (!rich && h('sacks') < 0.3) onWall(c, 'sack', 0.42, 0.42, 0.6, 0.95, { note: 'a sack of barley (C)' });
      break; }
  }
}

/** the budget of triangles of a room (the near tiles' budget, tests/houses.test.ts: the worst tile under 60 k) */
export const ROOM_BUDGET: Record<Use, number> = { living: 2200, sleeping: 1600, store: 1400, vestibule: 700, kitchen: 1500, workroom: 2000 };

/** plan a room's things (deterministic per room id and household) */
export function planRoom(r: RoomIn, p: Profile, budgetScale = 1): Plan {
  const c = newCtx(r, p, ROOM_BUDGET[r.use] * budgetScale); if (!c) return emptyPlan(r);
  clearZones(c); recipe(c); return planOf(c);
}
/** a room's planning state (null: too small to furnish); `pre` boxes already taken (fittings another builder draws:
 *  u0, v0, u1, v1, and 1 for a flat one) */
export function newCtx(r: RoomIn, p: Profile, budget: number, pre: number[][] = []): Ctx | null {
  const ins = r.inset ?? 0.3, x0 = r.u0 + ins, x1 = r.u1 - ins, y0 = r.v0 + ins, y1 = r.v1 - ins;
  if (x1 - x0 < 0.8 || y1 - y0 < 0.8) return null;
  const c: Ctx = { r, p, f: new Floor(x0, y0, x1, y1), items: [], seed: `${r.id}`, x0, x1, y0, y1, budget, spent: 0, taken: new Set(), clear: [] };
  for (const b of pre) if (b[4]) c.f.markFlat(b[0], b[1], b[2], b[3]); else c.f.mark(b[0], b[1], b[2], b[3], 2);
  return c;
}
export const emptyPlan = (r: RoomIn): Plan => ({ items: [], floor: Math.max(0, (r.u1 - r.u0 - 0.6) * (r.v1 - r.v0 - 0.6)), covered: 0, use: r.use, clear: [] });
/** the recipe of a room's use on a planning state (the Terrace's rooms call it after their own things) */
export const runRecipe = (c: Ctx) => recipe(c);
export function planOf(c: Ctx): Plan {
  const { x0, x1, y0, y1 } = c; let cov = 0; for (const it of c.items) if (!HUNG.has(it.k)) cov += it.w * it.d;
  return { items: c.items, floor: (x1 - x0) * (y1 - y0), covered: Math.min(1, cov / ((x1 - x0) * (y1 - y0))), use: c.r.use, clear: c.clear };
}
/** put a thing at a given place (the Terrace's kit at the head of each mat, the goods on a bench); false when it is taken */
export function putAt(c: Ctx, k: Kind, u: number, v: number, rot: number, w: number, d: number, h: number, y = 0, extra: Partial<Item> = {}, check = true): boolean {
  if (c.spent + TRIS[k] > c.budget) return false; const ca = Math.abs(Math.cos(rot)) > 0.5, hw = (ca ? w : d) / 2, hd = (ca ? d : w) / 2;
  if (check && !c.f.free(u - hw, v - hd, u + hw, v + hd, FLAT.has(k))) return false;
  if (check && !HUNG.has(k) && y < 0.05) { if (FLAT.has(k)) c.f.markFlat(u - hw, v - hd, u + hw, v + hd); else c.f.mark(u - hw, v - hd, u + hw, v + hd, 2); }
  c.items.push({ k, u, v, rot, w, d, h, y, vr: h01(`${c.seed}:${k}:${c.items.length}`), wall: -1, ...extra }); c.spent += TRIS[k]; return true;
}

/** a room's set of things and their layout, for the census of identical rooms: the kinds counted, and the places to 0.25 m
 *  from the room's corner */
export function roomSignature(r: RoomIn, plan: Plan): { set: string; layout: string } {
  const ks = new Map<string, number>(); for (const it of plan.items) { const k = it.sub ? `${it.k}/${it.sub}` : it.k; ks.set(k, (ks.get(k) ?? 0) + 1); }
  const set = [...ks].sort().map(([k, n]) => `${k}${n}`).join(',');
  const layout = plan.items.map(it => `${it.k}@${Math.round((it.u - r.u0) * 4)},${Math.round((it.v - r.v0) * 4)}`).sort().join(';');
  return { set, layout };
}
