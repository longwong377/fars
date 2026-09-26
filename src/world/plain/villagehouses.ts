// The villages of the plain as built (D-254; replaces the PLACEHOLDER merged boxes of audit B M6 / B64). Each village is one
// site raster (villagesite.ts: the plan the people live in) and its houses are built by the town's house generator
// (settlement/houses.ts SiteHouses, D-234) at two levels of detail, as the town's are:
//  - NEAR (32 m tiles within NEAR_R of the eye, built a step at a time, merged into two meshes): walls with their thickness on
//    a stone footing, hand-plastered faces, doorways with lintels and thresholds, flat roofs of poles, brush and earth with
//    their eaves and spouts, ceilings, the rooms' things (mats, bedding, jars: houses.ts furnish), the court fixtures
//    (houseplan.ts: the ladder, a bench, fuel, fodder, baskets, the roof's things) and the fittings (the tannur, the hearth,
//    bins and jars, the pen's manger, the well: settlement/build.ts fittingGeom);
//  - FAR (one mesh per 10 km cell, always drawn): each compound's mass: its yard walls (split at the gate, lower along the
//    pen), the pen's walls and its room ranges to the parapet, as plastered boxes; collapsed in the vertex stage where its
//    tile is drawn near (a state texture, as the town's far level), casting the shadows of near and far alike.
// The far level, the gates' leaves (the town's door system: shut from dusk to dawn, open or ajar by day), the threshing
// floors and the fires (each compound's hearth, its oven and the evening lamp in a living room: night light from doorways
// and yards) come from the compounds' plans at load (villages.ts), cheaply; a village's raster and houses (villagesite.ts,
// SiteHouses) are built when the eye or the player comes within reach of it, a step a frame, and give the near level and
// the colliders (the plan's walls, fixtures and fittings: the town's footprints.ts). Where both exist they are checked to
// agree (tests/villages.test.ts: tiles, gates, lamps). Everything is tier C.
import * as THREE from 'three/webgpu';
import { attribute, positionLocal, textureLoad, ivec2, int, float, step } from 'three/tsl';
import type { Terrain } from '../../terrain/heightfield';
import type { Physics } from '../../player/physics';
import type { FireSystem } from '../fire';
import { surfaceMaterial } from '../../render/materials';
import { registerSettlementSurfaces } from '../settlement/surfaces';
import { SiteHouses, plasterBatch, newHB, NEAR_R, TILE, seasonOf, doorVar, hi, type HB, type StreetDoor } from '../settlement/houses';
import { TownDoors } from '../settlement/towndoors';
import { fittingGeom, partDesc, type Desc } from '../settlement/build';
import { siteFootprints } from '../settlement/footprints';
import { Batch, lin, type RGB } from '../settlement/geom';
import { lifeOf, parapetOf } from '../settlement/houseplan';
import { hashString, Rng } from '../../core/rng';
import { DOOR_H, toGrid, type P2, type Site, type Frame, type Plot } from '../settlement/site';
import { villageSite, villageFrame, compoundCorner, PEN_WALL, PEN_T, type VillageSite } from './villagesite';
import { threshingFloor, THRESH_R, type Village, type Compound } from './villages';
import { feature, tag } from './data';

/** which near tiles are drawn (texel tile id + 1; a village's tiles are its index × 4096 + ...: houses.ts tileAt) */
const VNS_W = 512, VNS_H = 300;
export const VILLAGE_NEAR_STATE = new THREE.DataTexture(new Uint8Array(VNS_W * VNS_H * 4), VNS_W, VNS_H, THREE.RGBAFormat, THREE.UnsignedByteType);
/** the far level's cells (m): villages grouped for frustum culling and for casting shadows only near the camera */
export const VILLAGE_CELL = 10000, VILLAGE_CELL_OFF = 5000;
/** a village's raster and houses are built when the eye or the player comes within this of its edge (m) */
export const VILLAGE_BUILD_R = NEAR_R + 250;
const NEAR_HYST = 16;
/** the near meshes: the structure (does not cast: the far level casts for it) and the things (cast) */
const STRUCT: (keyof HB)[] = ['plaster', 'stone', 'timber', 'brick'], THINGS: (keyof HB)[] = ['items', 'props'];
const SRC = 'SUMNER1986;RECON';
const MUD: RGB = [0.56, 0.47, 0.36];
const sh = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
interface ColBox { x: number; y: number; z: number; hx: number; hy: number; hz: number; rot: number }
interface VNear { hs: SiteHouses; vi: number; geo: Partial<Record<keyof HB, { g: THREE.BufferGeometry; owner: Int32Array }>>; tris: number; desc: Desc[] }
interface VCell { key: string; far: Batch; desc: Desc[]; centres: [number, number][] }
/** one village: its plan's frame and each compound's place, ground, colour, description and tile; built lazily: its raster,
 *  houses and colliders */
interface VState {
  v: Village; comps: Compound[]; fr: { frame: Frame; W: number }; cell: VCell;
  cu: Float64Array; cv: Float64Array; inb: boolean[]; base: Float32Array; pcol: RGB[]; pdesc: Int32Array; tile: Int32Array;
  vs: VillageSite | null; hs: SiteHouses | null; fd: Int32Array | null; col: { boxes: ColBox[]; live: any[] | null } | null;
}

export class VillageHouses {
  readonly group = new THREE.Group();
  /** the far level: one mesh per cell and the centres (world x, z) of its villages (plain/index.ts switches shadows on near) */
  readonly cells: { mesh: THREE.Mesh; centres: [number, number][] }[] = [];
  readonly info = { villages: 0, compounds: 0, rooms: 0, gates: 0, fittings: 0, fires: 0, lamps: 0, farTris: 0, floors: 0, built: 0, colliders: 0, liveColliders: 0, buildMs: 0, lazyMs: 0, lazyMaxMs: 0 };
  readonly nearInfo = { tiles: 0, tris: 0, builds: 0, syncBuilds: 0, jobBuilds: 0, buildMs: 0, maxStep: 0, mergeMs: 0, syncMerges: 0 };
  /** the gates (every compound's, from its plan; the same records SiteHouses makes: tests/villages.test.ts) */
  readonly gates: StreetDoor[] = [];
  /** each compound's evening lamp (grid e, n, world y) and its room id, or null */
  readonly lamps: ({ at: [number, number, number]; room: number } | null)[][] = [];
  doors: TownDoors;
  readonly st: VState[] = [];
  private near = new Map<number, VNear>(); private shownSet = new Set<number>(); private wantKey = '';
  private job: { tile: number; gen: Generator<void, void, void>; out: { n?: VNear }; ms: number } | null = null;
  private mergeJob: Generator<void, void, void> | null = null;
  private nearDay = 0;
  private structMesh: THREE.Mesh; private thingsMesh: THREE.Mesh;
  private H: (e: number, n: number) => number;

  constructor(readonly villages: Village[], comps: Compound[][], terrain: Terrain, private phys: Physics | null, fire: FireSystem | null, seed = 1) {
    const t0 = performance.now();
    registerSettlementSurfaces();
    this.group.name = 'plain-villages';
    const vu = feature('villages_unlocated'), lay = vu.layout;
    this.group.userData = { ...tag(vu, 'village houses: courtyard compounds of mud brick built as the town\'s houses are (D-254; layout C, villages_unlocated.layout); positions: Barrington points (C, map-scale +-3 km) or placed by rule (C)') };
    const H = this.H = (e: number, n: number) => terrain.heightAt(e, -n);
    const cells = new Map<string, VCell>();
    const cellOf = (v: Village) => { const key = `${Math.floor((v.x + VILLAGE_CELL_OFF) / VILLAGE_CELL)},${Math.floor((v.y + VILLAGE_CELL_OFF) / VILLAGE_CELL)}`;
      let c = cells.get(key); if (!c) { c = { key, far: plasterBatch(true), desc: [{ tier: 'C', src: SRC, note: 'village (D-254)' }], centres: [] }; cells.set(key, c); } return c; };
    villages.forEach((v, vi) => {
      const cs = comps[vi], fr = villageFrame(v, cs), cell = cellOf(v), n = cs.length; cell.centres.push([v.x, -v.y]);
      const S: VState = { v, comps: cs, fr, cell, cu: new Float64Array(n), cv: new Float64Array(n), inb: [], base: new Float32Array(n), pcol: [], pdesc: new Int32Array(n), tile: new Int32Array(n), vs: null, hs: null, fd: null, col: null };
      this.st.push(S); this.info.villages++;
      const G = (u: number, w: number) => toGrid(fr.frame, u, w), lampRow: VillageHouses['lamps'][number] = []; this.lamps.push(lampRow);
      let rid = 0;
      cs.forEach((c, ci) => {
        const k = compoundCorner(fr, c), cu = -fr.W / 2 + k.i0 + c.w / 2, cv = -fr.W / 2 + k.j0 + c.d / 2; S.cu[ci] = cu; S.cv[ci] = cv; S.inb.push(k.inb);
        const pts: P2[] = [[cu - c.w / 2, cv - c.d / 2], [cu + c.w / 2, cv - c.d / 2], [cu + c.w / 2, cv + c.d / 2], [cu - c.w / 2, cv + c.d / 2], [cu, cv]].map(([u, w]) => G(u, w));
        S.base[ci] = pts.reduce((a, q) => a + H(q[0], q[1]), 0) / pts.length;
        S.tile[ci] = vi * 4096 + Math.floor((cu + fr.W / 2) / TILE) * 64 + Math.floor((cv + fr.W / 2) / TILE);
        const id = `${v.id}-c${ci}`, roofed = c.rooms.reduce((a, r) => a + (r.u1 - r.u0) * (r.v1 - r.v0), 0), L = lifeOf({ id, kind: 'house', roofed } as Plot);
        const rng = new Rng(hashString(id), 'colour'), kk = rng.range(0.88, 1.07), warm = rng.range(-0.012, 0.012); // each household's own batch of loam (as the town's, C)
        S.pcol.push(lin([MUD[0] * kk + warm, MUD[1] * kk, MUD[2] * kk - warm]));
        S.pdesc[ci] = cell.desc.length;
        cell.desc.push({ tier: 'C', src: SRC, note: `${id}: a courtyard compound of ${v.id}, ${c.w} x ${c.d} m, ${c.rooms.length} rooms${c.wing ? ` (a wing on the ${c.wing < 0 ? 'W' : 'E'} side)` : ''}, an animal pen, the gate in the S wall. ${v.name}: ${v.note} Mud brick on a fieldstone footing, mud plaster, flat roofs of poplar poles, brush and earth (the town's houses by the same analogies, D-234; C). The household's standing ${(L.standing * 100).toFixed(0)} of 100, the house ${L.age} years old, re-plastered ${L.sincePlaster} months ago${L.animal ? `, keeps ${L.animal === 'donkey' ? 'a donkey' : L.animal}` : ''} (C).`.replace(/\s+/g, ' ') });
        this.info.compounds++; this.info.rooms += c.rooms.length;
        if (!k.inb) { lampRow.push(null); return; }
        const roomIds = c.rooms.map(() => rid++);
        this.farCompound(cell.far, fr, c, S.tile[ci], S.base[ci], S.pcol[ci], S.pdesc[ci], parapetOf({ id } as Plot, L.standing), lay.yard_wall_h_m);
        // the gate's leaf (as SiteHouses makes a street door: hinge on the inner face at the jamb the household's life names)
        { const mid: P2 = [cu + c.gateU, cv - c.d / 2], nu = 0, nv = 1, t = lay.wall_m / 2 + 0.04, hsg = L.hinge, tu = -nv * hsg, tv = nu * hsg;
          const cs2 = Math.cos(fr.frame.theta), sn2 = Math.sin(fr.frame.theta), worldYaw = (lu: number, lv: number) => { const a = lu * cs2 - lv * sn2, b = -(lu * sn2 + lv * cs2); return Math.atan2(-b, a); };
          const yawIn = Math.atan2(nv, nu), yawAlong = Math.atan2(-tv, -tu), gm = G(mid[0], mid[1]), gl = H(gm[0], gm[1]);
          this.gates.push({ id: `${v.id}:${id}`, plot: ci, tile: S.tile[ci], hinge: G(mid[0] + nu * t + tu * 0.5, mid[1] + nv * t + tv * 0.5), theta: fr.frame.theta, closedYaw: worldYaw(Math.cos(yawAlong), Math.sin(yawAlong)), openYaw: worldYaw(Math.cos(yawIn), Math.sin(yawIn)),
            y: gl + 0.035, h: Math.max(1.6, S.base[ci] + DOOR_H - doorVar(id).drop - gl - 0.06), wood: L.doorWood, kind: 'house', site: v.id }); this.info.gates++; }
        // the fires: the hearth ('home': lit for the evening meal, banked after dark) and the lamp (the ovens: Q-690)
        for (const f of c.fittings) { this.info.fittings++; if (!fire || f.kind !== 'hearth') continue; /* (the ovens are drawn, not fires: Q-690) */ const g = G(cu + f.u, cv + f.v), y = H(g[0], g[1]);
          fire.add(f.kind, new THREE.Vector3(g[0], y, -g[1]), { tier: 'C', src: SRC, note: `${id}: ${f.note}`, sched: 'home', body: false, slow: true }); this.info.fires++; }
        // the evening lamp: a clay saucer lamp on a ledge on the back wall of the first living room (the rooms SiteHouses furnishes
        // as living rooms, houses.ts roomUse: the main range first, then the wing), 1.1 m up
        let lamp: VillageHouses['lamps'][number][number] = null;
        const order = c.rooms.map((r, ri) => ({ r, ri })).sort((a, b) => (Math.abs(b.r.v1 - c.d / 2) < 1e-6 ? 1 : 0) - (Math.abs(a.r.v1 - c.d / 2) < 1e-6 ? 1 : 0));
        for (const { r, ri } of order) { if (hi(roomIds[ri], vi, 5) < 0.35) continue; const main = Math.abs(r.v1 - c.d / 2) < 1e-6;
          const [lu, lw] = main ? [(r.u0 + r.u1) / 2, r.v1 - 0.48] : r.u0 <= -c.w / 2 + 1e-6 ? [r.u0 + 0.48, (r.v0 + r.v1) / 2] : [r.u1 - 0.48, (r.v0 + r.v1) / 2];
          const g = G(cu + lu, cv + lw); lamp = { at: [g[0], g[1], H(g[0], g[1]) + 1.12], room: roomIds[ri] }; break; }
        lampRow.push(lamp);
        if (lamp && fire) { fire.add('lamp', new THREE.Vector3(lamp.at[0], lamp.at[2], -lamp.at[1]), { tier: 'C', src: 'RECON', note: `${id}: a clay saucer lamp on a ledge in the living room, lit at dusk (saucer lamps B by analogy, Q-516; that every house burned one C, Q-560; D-254)`, sched: 'home', body: false, slow: true }); this.info.lamps++; this.info.fires++; }
      });
      this.floor(cell, v, threshingFloor(v, cs, seed));
    });
    // the far meshes (collapsed where drawn near; they cast every compound's shadow, near ones too)
    const far = surfaceMaterial('house_plaster', { vertexColors: true, arch: true, variant: 'village-far' }) as any;
    { const id = int(attribute('tileId', 'float')), stt = textureLoad(VILLAGE_NEAR_STATE, ivec2(id.mod(int(VNS_W)), id.div(int(VNS_W)))).r;
      far.positionNode = positionLocal.mul(float(1).sub(step(0.5, stt))); } far.aoNode = attribute('ao', 'float'); far.castShadowPositionNode = positionLocal;
    for (const c of cells.values()) { if (!c.far.tris) continue;
      const m = new THREE.Mesh(c.far.toGeometry(), far); m.name = 'plain-villages-' + c.key; m.castShadow = false; m.receiveShadow = true; m.matrixAutoUpdate = false; // shadows on near the camera (index.ts)
      const owner = c.far.owner, desc = c.desc;
      m.userData = { ...tag(vu, 'village houses, distant level (D-254): each compound\'s yard walls, pen and room ranges as plastered masses; within ~72 m the houses are built in full'), describe: (hit: any) => partDesc(desc, owner[hit?.faceIndex ?? -1], true) };
      this.group.add(m); this.cells.push({ mesh: m, centres: c.centres }); this.info.farTris += c.far.tris; }
    // the near meshes (one per group of materials; each material a draw)
    const mat = (name: string) => Object.assign(surfaceMaterial(name, { vertexColors: true, ...(name === 'house_plaster' ? { arch: true } : {}) }), { aoNode: attribute('ao', 'float') });
    const M = [mat('house_plaster'), mat('house_socle'), mat('house_timber'), mat('house_brick')];
    this.structMesh = new THREE.Mesh(emptyGeometry(), M); this.structMesh.name = 'plain-villages-near'; this.thingsMesh = new THREE.Mesh(emptyGeometry(), [M[0], M[2]]); this.thingsMesh.name = 'plain-villages-near-things';
    for (const m of [this.structMesh, this.thingsMesh]) { m.castShadow = m === this.thingsMesh; m.receiveShadow = true; m.matrixAutoUpdate = false; m.frustumCulled = false; m.visible = false; m.userData = { ...tag(vu, 'village houses near (D-254)') }; this.group.add(m); }
    this.doors = new TownDoors(this.gates, phys, 1, 'plain-villages-doors'); this.doors.group.userData = { ...tag(vu, 'village gates: leaves of poplar planks (D-234 door system; D-254)') }; this.group.add(this.doors.group);
    this.info.buildMs = performance.now() - t0;
  }

  // ---- the far level ----------------------------------------------------------------------------------------------
  /** a compound's mass in its cell's far batch: the yard walls (to yard_wall_h_m; along the pen to PEN_WALL) split at the gate,
   *  the pen's walls to the yard, the room ranges (main range and wing) to the parapet; each piece tagged with the compound's
   *  tile (its pen shares its rect and tile: villagesite.ts) */
  private farCompound(b: Batch, fr: { frame: Frame }, c: Compound, tile: number, base: number, col: RGB, pd: number, parapet: number, yardH: number) {
    const lay = feature('villages_unlocated').layout, W = c.w / 2, D = c.d / 2, t = Math.min(lay.wall_m, 0.55), tr = lay.wall_m;
    const own = pd * 32 + 1, ownR = pd * 32 + 3, yard = base + yardH, roomTop = base + (c.rooms[0]?.h ?? 2.6) + parapet, pen0 = base + PEN_WALL, y0 = base - 0.4;
    const [lu, lv] = [c.x, c.y]; void fr;
    b.set('tileId', tile + 1).set('ao', 1);
    const ca = Math.cos(c.angle), sa = Math.sin(c.angle);
    const box = (u0: number, v0: number, u1: number, v1: number, top: number, cc: RGB, o: number) => { if (u1 - u0 < 0.01 || v1 - v0 < 0.01) return; const mu = (u0 + u1) / 2, mv = (v0 + v1) / 2;
      b.set('y0', base).set('ytop', top); b.box(lu + mu * ca - mv * sa, lv + mu * sa + mv * ca, c.angle, (u1 - u0) / 2, (v1 - v0) / 2, y0, top, sh(cc, 0.82), cc, o); };
    const main = c.rooms.filter(r => Math.abs(r.v1 - D) < 1e-6), rv0 = Math.min(...main.map(r => r.v0));
    const P = c.pen, penW = P.u0 < 0; // the pen's side (W or E)
    // W and E walls: from the S wall up to the main range (its block covers the rest), lower along the pen
    for (const sd of [-1, 1]) { const x = sd * W, penHere = penW === (sd < 0), top0 = penHere ? P.v1 : -D;
      if (penHere) box(x - t / 2, -D - t / 2, x + t / 2, P.v1, pen0, col, own);
      box(x - t / 2, top0, x + t / 2, rv0, yard, col, own); }
    // S wall: split at the gate and at the pen
    const g0 = c.gateU - 0.5, g1 = c.gateU + 0.5, pa = penW ? P.u1 : P.u0;
    if (penW) { box(-W - t / 2, -D - t / 2, pa, -D + t / 2, pen0, col, own); box(pa, -D - t / 2, g0, -D + t / 2, yard, col, own); box(g1, -D - t / 2, W + t / 2, -D + t / 2, yard, col, own); }
    else { box(-W - t / 2, -D - t / 2, g0, -D + t / 2, yard, col, own); box(g1, -D - t / 2, pa, -D + t / 2, yard, col, own); box(pa, -D - t / 2, W + t / 2, -D + t / 2, pen0, col, own); }
    // the pen's walls to the yard (PEN_T, to the yard wall's height: the taller side, houses.ts wallSpan)
    box(P.u0, P.v1 - PEN_T / 2, P.u1, P.v1 + PEN_T / 2, yard, col, own); { const xi = penW ? P.u1 : P.u0; box(xi - PEN_T / 2, -D, xi + PEN_T / 2, P.v1, yard, col, own); }
    // the room ranges: the main range across the N side, the wing (its rooms' extent), out to the outer walls' faces
    const roofC = sh(col, 0.92);
    box(-W - tr / 2, rv0, W + tr / 2, D + tr / 2, roomTop, roofC, ownR);
    const wing = c.rooms.filter(r => !main.includes(r)); if (wing.length) { const u0 = Math.min(...wing.map(r => r.u0)), u1 = Math.max(...wing.map(r => r.u1)), v0 = Math.min(...wing.map(r => r.v0)), v1 = Math.max(...wing.map(r => r.v1));
      box(u0 - (u0 <= -W + 1e-6 ? tr / 2 : 0), v0 - (v0 <= -D + 1e-6 ? tr / 2 : 0), u1 + (u1 >= W - 1e-6 ? tr / 2 : 0), v1, roomTop, roofC, ownR); }
  }
  /** a threshing floor: beaten earth, a kerb of fieldstones (C) */
  private floor(cell: VCell, v: Village, at: P2) {
    const b = cell.far, d = cell.desc.length; cell.desc.push({ tier: 'C', src: 'RECON', note: `the threshing floor of ${v.id}: a round floor of beaten earth and clay, ${THRESH_R * 2} m across, with a kerb of fieldstones, at the village's edge beyond its houses; the grain is trodden out by oxen or donkeys and winnowed in the wind (C; the region's threshing floors by analogy, RECOLLECTION, NOT SEEN; D-254)` });
    b.set('tileId', 0).set('y0', -1000).set('ytop', 1e4).set('ao', 1);
    b.mound(at[0], at[1], THRESH_R, 0.07, lin([0.6, 0.53, 0.42]), this.H, d * 32, 3, 18);
    const stn = lin([0.52, 0.5, 0.45]), n = 26;
    for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2 + 0.05 * Math.sin(k * 7.1), e = at[0] + Math.cos(a) * (THRESH_R + 0.25), nn = at[1] + Math.sin(a) * (THRESH_R + 0.25), y = this.H(e, nn);
      const r = 0.16 + 0.06 * Math.abs(Math.sin(k * 3.7)); b.box(e, nn, a + 0.3 * Math.sin(k), r * 1.3, r, y - 0.12, y + r * 0.9, sh(stn, 0.8), stn, d * 32); }
    this.info.floors++;
  }

  // ---- a village's raster and houses (lazy) -------------------------------------------------------------------------
  /** the next step of building village vi's raster and houses (one a call); true when built */
  private buildStep(vi: number): boolean {
    const S = this.st[vi]; if (S.hs) return true; const t0 = performance.now();
    if (!S.vs) S.vs = villageSite(S.v, S.comps);
    else {
      const s = S.vs.site, n = s.plots.length, base = new Float32Array(n), local = new Uint8Array(n), pdesc = new Int32Array(n), pcol: RGB[] = [];
      const own = (p: number) => p < S.comps.length ? p : S.vs!.pens.indexOf(p);
      for (let p = 0; p < n; p++) { const o = own(p); base[p] = S.base[o]; pdesc[p] = S.pdesc[o]; pcol[p] = S.pcol[o]; }
      const hs = new SiteHouses(s, vi, this.H, base, local, pcol, pdesc, S.cell.desc);
      const fd = new Int32Array(s.fittings.length); s.fittings.forEach((f, fi) => { fd[fi] = S.cell.desc.length; S.cell.desc.push({ tier: 'C', src: SRC, note: `${f.plot >= 0 ? s.plots[f.plot].id + ': ' : ''}${f.note ?? f.kind + ' (C)'}` }); });
      // colliders: the walls as planned (not the doorways), the fixtures' and fittings' footprints, the bins
      const boxes: ColBox[] = [];
      for (const we of hs.walls) { const w = we.w; if (w.door) continue; const sp = hs.wallSpan(w), along = w.v0 === w.v1, len = along ? w.u1 - w.u0 : w.v1 - w.v0;
        boxes.push({ x: sp.gm[0], y: (sp.y0 + sp.top) / 2, z: -sp.gm[1], hx: along ? len / 2 : w.thick / 2, hy: (sp.top - sp.y0) / 2, hz: along ? w.thick / 2 : len / 2, rot: s.frame.theta }); }
      for (const f of siteFootprints(s)) { const g = s.grid(f.u, f.v), y = this.H(g[0], g[1]); boxes.push({ x: g[0], y: y + f.y, z: -g[1], hx: f.hu, hy: f.hy, hz: f.hv, rot: s.frame.theta + f.rot }); }
      for (const f of s.fittings) if (f.kind === 'bin') { const b = binBox(f), g = s.grid(f.u, f.v), y = this.H(g[0], g[1]); boxes.push({ x: g[0], y: y + b.hy, z: -g[1], hx: b.hu, hy: b.hy, hz: b.hv, rot: s.frame.theta + f.rot }); }
      S.col = { boxes, live: null }; S.fd = fd; S.hs = hs; this.info.built++; this.info.colliders += boxes.length;
    }
    const ms = performance.now() - t0; this.info.lazyMs += ms; this.info.lazyMaxMs = Math.max(this.info.lazyMaxMs, ms);
    return !!S.hs;
  }
  /** build village vi's raster and houses now (tests, tools) */
  ensure(vi: number) { while (!this.buildStep(vi)) { /* both steps */ } return this.st[vi].hs!; }
  /** the villages within reach of (x, z) (world), nearest first */
  private inReach(p: { x: number; z: number }, c: { x: number; z: number }) {
    return this.st.map((S, vi) => ({ vi, d: Math.min(Math.hypot(S.v.x - p.x, -S.v.y - p.z), Math.hypot(S.v.x - c.x, -S.v.y - c.z)) - S.v.r * 1.2 - 30 })).filter(q => q.d < VILLAGE_BUILD_R).sort((a, b) => a.d - b.d);
  }

  // ---- the near level ---------------------------------------------------------------------------------------------
  private *nearSteps(hs: SiteHouses, vi: number, tile: number, B: HB, out: { n?: VNear }): Generator<void, void, void> {
    yield* hs.tileSteps(tile, B, this.nearDay);
    const S = this.st[vi], s = hs.s, fd = S.fd!; let c = 0;
    B.items.set('y0', -1000).set('ytop', 1e4).set('ao', 1);
    for (let fi = 0; fi < s.fittings.length; fi++) { const f = s.fittings[fi]; if (hs.tileOfPlotEl(f.plot, f.u, f.v) !== tile) continue;
      if (f.kind === 'bin') binGeom(s, f, B.items, this.H, fd[fi] * 32); else fittingGeom(s, f, B.items, this.H, fd[fi] * 32); if (++c % 12 === 0) yield; }
    const geo: VNear['geo'] = {}; let tris = 0;
    for (const k of [...STRUCT, ...THINGS]) { const b = B[k]; if (!b.tris) continue; geo[k] = { g: b.toGeometry(), owner: b.owner.slice() }; tris += b.tris; yield; }
    out.n = { hs, vi, geo, tris, desc: S.cell.desc };
  }
  private buildNear(hs: SiteHouses, vi: number, tile: number): VNear {
    const t0 = performance.now(), out: { n?: VNear } = {}; const g = this.nearSteps(hs, vi, tile, newHB(), out); while (!g.next().done) { /* at once */ }
    this.nearInfo.syncBuilds++; this.nearInfo.builds++; this.nearInfo.buildMs += performance.now() - t0; return out.n!;
  }
  private runJob(budgetMs: number, all = false): VNear | null {
    const j = this.job; if (!j) return null; const t0 = performance.now(); let done = false;
    while (!done && (all || performance.now() - t0 < budgetMs)) { const t1 = performance.now(); done = !!j.gen.next().done; this.nearInfo.maxStep = Math.max(this.nearInfo.maxStep, performance.now() - t1); }
    j.ms += performance.now() - t0; if (!done) return null;
    this.job = null; this.nearInfo.jobBuilds++; this.nearInfo.builds++; this.nearInfo.buildMs += j.ms; this.near.set(j.tile, j.out.n!); return j.out.n!;
  }
  /** the near tiles round the eye (as the town's, build.ts nearUpdate): built within NEAR_R (at once when missing), the next
   *  ring a few ms a frame, shown within NEAR_R (kept to NEAR_R + NEAR_HYST), dropped beyond NEAR_R + 80 m; merged and swapped
   *  in with the far level's state texture in one go. A village whose houses are not built yet stays on its far level.
   *  `sync` (tests, tools): the villages round the eye are built and the tiles merged at once */
  nearUpdate(x: number, z: number, prefetch = 1, sync = false) {
    if (sync) for (const q of this.inReach({ x, z }, { x, z })) this.ensure(q.vi);
    let tiles = 0, tris = 0, lost = true; const want: number[] = [];
    this.st.forEach((S, vi) => { const hs = S.hs; if (!hs) return;
      if (Math.hypot(S.v.x - x, -S.v.y - z) > S.v.r * 1.2 + 30 + NEAR_R + 120) { for (const [t, n] of this.near) if (n.hs === hs) this.dropNear(t); return; }
      for (const [t, info] of hs.tiles) { const d = Math.hypot(info.x - x, info.z - z); let n = this.near.get(t);
        if (d < NEAR_R) { if (!n) { n = this.job?.tile === t ? this.runJob(0, true)! : this.buildNear(hs, vi, t); this.near.set(t, n); } }
        else if (d < NEAR_R + 40 && !n && prefetch > 0 && !this.job) { prefetch--; const out: { n?: VNear } = {}; this.job = { tile: t, gen: this.nearSteps(hs, vi, t, newHB(), out), out, ms: 0 }; }
        else if (n && d > NEAR_R + 80) { this.dropNear(t); n = undefined; }
        if (n) { const on = d < NEAR_R || (this.shownSet.has(t) && d < NEAR_R + NEAR_HYST); if (on) { want.push(t); tiles++; tris += n.tris; if (this.shownSet.has(t) && d < NEAR_R) lost = false; } } } });
    if (this.job) { const j = this.job, hs = this.st[Math.floor(j.tile / 4096)].hs!, info = hs.tiles.get(j.tile)!; if (Math.hypot(info.x - x, info.z - z) > NEAR_R + 80) this.job = null; else this.runJob(3); }
    const key = want.sort((p, q) => p - q).join(',');
    if (key !== this.wantKey) { this.wantKey = key; this.mergeJob = this.mergeSteps(want); }
    if (this.mergeJob) { const t0 = performance.now(), all = sync || lost || !want.length; if (all) this.nearInfo.syncMerges++; let done = false;
      while (!done && (all || performance.now() - t0 < 4)) done = !!this.mergeJob.next().done; if (done) this.mergeJob = null; this.nearInfo.mergeMs = performance.now() - t0; }
    this.nearInfo.tiles = tiles; this.nearInfo.tris = tris;
  }
  /** the wanted tiles' geometry, per mesh, one group per material (the attributes a batch lacks filled with their neutral
   *  values); then the swap and the state texture */
  private *mergeSteps(want: number[]): Generator<void, void, void> {
    const parts = want.map(t => ({ t, n: this.near.get(t)! })).filter(q => q.n);
    const build = (keys: (keyof HB)[]) => {
      let nv = 0, ni = 0; for (const k of keys) for (const q of parts) { const x = q.n.geo[k]; if (x) { nv += x.g.getAttribute('position').count; ni += x.g.index!.count; } }
      if (!ni) return null;
      const A: Record<string, { size: number; arr: Float32Array; fill: number }> = { position: { size: 3, arr: new Float32Array(nv * 3), fill: 0 }, normal: { size: 3, arr: new Float32Array(nv * 3), fill: 0 }, color: { size: 3, arr: new Float32Array(nv * 3), fill: 0 },
        y0: { size: 1, arr: new Float32Array(nv), fill: -1000 }, ytop: { size: 1, arr: new Float32Array(nv), fill: 1e4 }, ao: { size: 1, arr: new Float32Array(nv), fill: 1 } };
      const idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni), g = emptyGeometry(), ranges: { f0: number; f1: number; owner: Int32Array; desc: Desc[] }[] = [];
      let vo = 0, io = 0;
      keys.forEach((k, gi) => { const i0 = io;
        for (const q of parts) { const x = q.n.geo[k]; if (!x) continue; const n = x.g.getAttribute('position').count;
          for (const [name, a] of Object.entries(A)) { const src = x.g.getAttribute(name); if (src) a.arr.set(src.array as Float32Array, vo * a.size); else a.arr.fill(a.fill, vo * a.size, (vo + n) * a.size); }
          const si = x.g.index!.array; for (let i = 0; i < si.length; i++) idx[io + i] = si[i] + vo; ranges.push({ f0: io / 3, f1: (io + si.length) / 3, owner: x.owner, desc: q.n.desc }); io += si.length; vo += n; }
        if (io > i0) g.addGroup(i0, io - i0, gi); });
      for (const [name, a] of Object.entries(A)) g.setAttribute(name, new THREE.BufferAttribute(a.arr, a.size)); g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeBoundingSphere();
      return { g, ranges }; };
    const Sg = build(STRUCT); yield; const Tg = build(THINGS); yield;
    for (const [m, x] of [[this.structMesh, Sg], [this.thingsMesh, Tg]] as const) {
      m.geometry.dispose(); if (!x) { m.geometry = emptyGeometry(); m.visible = false; continue; }
      m.geometry = x.g; m.visible = true; const ranges = x.ranges;
      m.userData = { ...m.userData, describe: (hit: any) => { const f = hit?.faceIndex ?? -1; let lo = 0, hi2 = ranges.length - 1; while (lo < hi2) { const mid = (lo + hi2 + 1) >> 1; if (ranges[mid].f0 <= f) lo = mid; else hi2 = mid - 1; } const r = ranges[lo]; return r && f >= r.f0 && f < r.f1 ? partDesc(r.desc, r.owner[f - r.f0], false) : null; } }; }
    const stt = VILLAGE_NEAR_STATE.image.data as Uint8Array; for (const t of this.shownSet) stt[(t + 1) * 4] = 0; this.shownSet = new Set(parts.map(q => q.t)); for (const t of this.shownSet) stt[(t + 1) * 4] = 255; VILLAGE_NEAR_STATE.needsUpdate = true;
  }
  private dropNear(t: number) { if (this.job?.tile === t) this.job = null; if (this.shownSet.has(t)) return; const n = this.near.get(t); if (!n) return; for (const x of Object.values(n.geo)) x?.g.dispose(); this.near.delete(t); }
  private resetNear() { this.job = null; this.mergeJob = null; const stt = VILLAGE_NEAR_STATE.image.data as Uint8Array; for (const t of this.shownSet) stt[(t + 1) * 4] = 0; VILLAGE_NEAR_STATE.needsUpdate = true; this.shownSet.clear(); this.wantKey = '';
    for (const t of [...this.near.keys()]) this.dropNear(t); this.structMesh.visible = this.thingsMesh.visible = false; }
  /** is tile t drawn near? */
  nearTile = (t: number) => this.shownSet.has(t);
  /** the near meshes (tests) */
  nearMeshes() { return [this.structMesh, this.thingsMesh]; }

  // ---- colliders, doors, the frame ------------------------------------------------------------------------------------------
  /** villages within 200 m of the player or the camera get their colliders (at most `budget` boxes a call), beyond 300 m drop them */
  streamColliders(p: { x: number; z: number }, c: { x: number; z: number }, budget = 1500) {
    if (!this.phys) return;
    for (const S of this.st) { const col = S.col; if (!col) continue; const d = Math.min(Math.hypot(S.v.x - p.x, -S.v.y - p.z), Math.hypot(S.v.x - c.x, -S.v.y - c.z)) - S.v.r * 1.2 - 30;
      if (d < 200 && (!col.live || col.live.length < col.boxes.length) && budget > 0) { col.live ??= [];
        while (col.live.length < col.boxes.length && budget-- > 0) { const b = col.boxes[col.live.length]; col.live.push(this.phys.addBox({ x: b.x, y: b.y, z: b.z }, { x: b.hx, y: b.hy, z: b.hz }, b.rot)); this.info.liveColliders++; } }
      else if (d > 300 && col.live) { for (const k of col.live) this.phys.world.removeCollider(k, false); this.info.liveColliders -= col.live.length; col.live = null; } }
  }
  /** the frame: a step of building the nearest village in reach, the colliders, the near tiles, the gates */
  update(dt: number, cam: THREE.Vector3, player: THREE.Vector3, day: number, sunAlt: number) {
    const reach = this.inReach(player, cam); for (const q of reach) if (!this.st[q.vi].hs) { this.buildStep(q.vi); break; }
    this.streamColliders(player, cam, 1500);
    if (seasonOf(day) !== seasonOf(this.nearDay)) this.resetNear(); this.nearDay = day;
    this.nearUpdate(cam.x, cam.z, 1);
    this.doors.update(dt, cam, day, sunAlt, this.nearTile);
  }
  /** E on a gate (main.ts, after the palace and town doors) */
  useDoor(camera: THREE.Camera) { return this.doors.use(camera); }
  stats() { return { ...this.info, near: { ...this.nearInfo }, doors: { ...this.doors.stats } }; }
}

/** an empty geometry that still has a position attribute (the near meshes before anything is near) */
const emptyGeometry = () => new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
/** a storage bin (a fitting of kind 'bin'): a lidded box of unbaked clay against the wall (its depth along `rot`, C) */
export function binBox(f: Site['fittings'][0]) { const k = f.size; return { hu: 0.32 * k, hv: 0.5 * k, hy: 0.55 * k }; }
function binGeom(s: Site, f: Site['fittings'][0], b: Batch, H: (e: number, n: number) => number, d: number) {
  const { hu, hv, hy } = binBox(f), g = s.grid(f.u, f.v), y = H(g[0], g[1]), c = lin([0.58, 0.49, 0.37]), th = s.frame.theta + f.rot;
  b.box(g[0], g[1], th, hu, hv, y - 0.05, y + hy * 2, sh(c, 0.75), c, d);
  b.box(g[0], g[1], th, hu + 0.03, hv + 0.03, y + hy * 2, y + hy * 2 + 0.06, sh(c, 0.9), sh(c, 1.05), d); // the lid
  const ca = Math.cos(th), sa = Math.sin(th), hole = lin([0.25, 0.21, 0.17]); // the outlet stopper low on the front (away from the wall)
  b.box(g[0] - ca * (hu + 0.01), g[1] - sa * (hu + 0.01), th, 0.02, 0.07, y + 0.12, y + 0.24, hole, hole, d);
}
