// Settlement builder (Phase 6): turns the town plan (plan.ts) into meshes on the terrain, box colliders streamed near the
// player, fires registered with the fire system, trees, water, roads, the Tol-e Ajori gate and the smoke haze.
// Draw calls are kept low by merging each cluster (a quarter with the compounds and orchards near it) into one mesh per
// material; every face keeps an owner id so the dev overlay (F3) names the plot or object and its tier and basis.
import * as THREE from 'three/webgpu';
import type { Physics } from '../../player/physics';
import type { Terrain } from '../../terrain/heightfield';
import type { FireSystem, FireKind, FireSchedule } from '../fire';
import { surfaceMaterial } from '../../render/materials';
import { registerSettlementSurfaces } from './surfaces';
import { Batch, RGB, lin } from './geom';
import { buildTownPlan, TownPlan, ROWS, FEATURES, Prop } from './plan';
import { Site, Plot, Wall, ROOF_T, DOOR_H, P2 } from './site';
import { HOUSE_BASIS } from './town_rules';
import { hashString, Rng } from '../../core/rng';
import { buildAjori } from './ajori';
import { TreeField } from './trees';
import { buildWaterAndRoads } from './water';
import { TownHaze } from './haze';

export interface Desc { tier: string; src: string; note: string; placeholder?: boolean }
interface ColBox { x: number; y: number; z: number; hx: number; hy: number; hz: number; rot: number }
interface Cluster { id: string; c: P2; batches: Map<string, Batch>; desc: Desc[] }
interface SiteCol { id: string; c: P2; r: number; boxes: ColBox[]; live: any[] | null }

const MUD: RGB = [0.56, 0.47, 0.36], TIMBER: RGB = [0.36, 0.26, 0.17], POT: RGB = [0.63, 0.43, 0.3], STONE: RGB = [0.55, 0.53, 0.49], BONE: RGB = [0.82, 0.78, 0.68];
const shade = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];
/** town meshes farther than this from the camera cast no shadows (they would only fill the Terrace's far cascades) */
export const SHADOW_RANGE = 150;

export class Settlement {
  readonly group = new THREE.Group();
  readonly plan: TownPlan;
  private cols: SiteCol[] = [];
  private trees!: TreeField; private haze!: TownHaze; private wr!: ReturnType<typeof buildWaterAndRoads>;
  private fireIdx: { site: string; kind: FireKind }[] = [];
  private fire: FireSystem;
  /** town meshes cast shadows only within SHADOW_RANGE of the camera: distant town content stays out of the cascades */
  private casters: THREE.Mesh[] = [];
  readonly info = { tris: 0, meshes: 0, colliders: 0, liveColliders: 0, fires: 0, trees: 0, buildMs: 0, phases: {} as Record<string, number> };
  constructor(private phys: Physics | null, private terrain: Terrain, fire: FireSystem, quality = 'high') {
    const t0 = performance.now();
    this.fire = fire;
    registerSettlementSurfaces();
    this.group.name = 'settlement';
    this.group.userData = { tier: 'C', src: 'RECON', note: 'settlement (Phase 6): zones and named features from settlement.json; town layout reconstructed (C)' };
    this.plan = buildTownPlan();
    let tp = performance.now(); const phase = (n: string) => { const t = performance.now(); this.info.phases[n] = Math.round(t - tp); tp = t; }; phase('plan');
    const H = (e: number, n: number) => terrain.heightAt(e, -n);
    // clusters: every quarter is one; each compound joins the nearest quarter within 450 m, else its zone
    const clusters = new Map<string, Cluster>();
    const quarters = this.plan.sites.filter(s => s.meta.kind === 'quarter');
    const clusterOf = (s: Site): string => {
      if (s.meta.kind === 'quarter') return s.id;
      // low garden and orchard walls in one mesh that casts no shadow; the four estates in one mesh
      if (s.plots.length && s.plots.every(p => p.kind === 'garden')) return 'gardens';
      if (s.id.startsWith('estate_')) return 'estates';
      // a compound joins a quarter's mesh only when it stands within 60 m of the quarter's edge, so a mesh's bounds stay
      // tight (culling, and shadow casting by distance); otherwise it is its own mesh
      const rs = Math.hypot(s.W, s.H) / 2;
      let best = '', bd = Infinity; for (const q of quarters) { const d = Math.hypot(q.frame.c[0] - s.frame.c[0], q.frame.c[1] - s.frame.c[1]) - Math.min(q.W, q.H) / 2 - rs; if (d < 60 && d < bd) { bd = d; best = q.id; } }
      return best || s.id;
    };
    const getC = (id: string, c: P2) => { let x = clusters.get(id); if (!x) { x = { id, c, batches: new Map(), desc: [] }; clusters.set(id, x); } return x; };
    const B = (cl: Cluster, mat: string) => { let b = cl.batches.get(mat); if (!b) { b = new Batch(); cl.batches.set(mat, b); } return b; };

    for (const s of this.plan.sites) {
      const cl = getC(clusterOf(s), s.frame.c); const col: SiteCol = { id: s.id, c: s.frame.c, r: Math.hypot(s.W, s.H) / 2 + 5, boxes: [], live: null };
      this.cols.push(col); this.buildSite(s, cl, B(cl, 'mud'), () => B(cl, 'stone'), col, H);
    }
    phase('sites');
    // props (Takht-e Rustam, the Dasht-e Gohar hall)
    const groupBase = new Map<string, number>(); for (const [g, pts] of this.plan.groups) groupBase.set(g, Math.min(...pts.map(p => H(p[0], p[1]))));
    const propCol = new Map<string, SiteCol>();
    for (const p of this.plan.props) {
      const cl = getC(p.group === 'takht' || p.group === 'hall_gohar' ? 'zone_dasht_e_gohar' : p.group === 'pavilion' ? 'zone_bagh_e_firuzi' : p.group, p.c);
      const b = B(cl, p.mat === 'stone' ? (p.group === 'takht' ? 'takht' : 'stone') : 'mud');
      const base = groupBase.get(p.group) ?? H(p.c[0], p.c[1]);
      const d = cl.desc.length; cl.desc.push({ tier: ROWS[p.row]?.tier ?? FEATURES[p.row]?.tier ?? 'C', src: ROWS[p.row]?.src ?? FEATURES[p.feature]?.src ?? 'RECON', note: p.note });
      const cc = p.colour ? lin(p.colour) : p.mat === 'timber' ? lin(TIMBER) : p.mat === 'stone' ? lin(STONE) : lin(MUD);
      if (p.shape === 'box') b.box(p.c[0], p.c[1], p.theta, p.hu, p.hv, base + p.y0, base + p.y1, p.mat === 'mud' ? shade(cc, 0.75) : cc, cc, d);
      else b.cyl(p.c[0], p.c[1], p.hu, p.hu * (p.r1 ?? 1), base + p.y0, base + p.y1, 12, cc, cc, d);
      if (p.collide) { let pc = propCol.get(p.group); if (!pc) { pc = { id: 'props:' + p.group, c: p.c, r: 60, boxes: [], live: null }; propCol.set(p.group, pc); this.cols.push(pc); }
        pc.boxes.push({ x: p.c[0], y: base + (p.y0 + p.y1) / 2, z: -p.c[1], hx: p.hu, hy: (p.y1 - p.y0) / 2, hz: p.hv, rot: p.theta }); }
    }
    phase('props');
    // trodden ground: lanes, squares, courts and floors of the quarters and compounds are bare packed earth, not the
    // plain's seasonal herb layer (gardens and orchards keep it). One receive-only mesh, 4 m tiles draped on the terrain.
    const ground = new Batch(), gDesc: Desc[] = [{ tier: 'C', src: 'RECON', note: 'trodden earth of lanes, squares, courts and floors (C)' }];
    for (const s of this.plan.sites) {
      const green = (k: number) => { const c = s.cell[k]; if (c < 0) return c === -1; const kd = s.plots[c].kind; return kd === 'garden' || kd === 'yard' || (kd === 'elite' && s.sub[k] === 3); };
      const colOf = (k: number): RGB => { const c = s.cell[k]; if (c < 0) return c === -4 ? lin([0.56, 0.49, 0.39]) : lin([0.53, 0.46, 0.36]); const sb = s.sub[k]; return sb === 1 ? lin([0.44, 0.38, 0.3]) : sb === 2 ? lin([0.56, 0.49, 0.38]) : lin([0.5, 0.43, 0.33]); };
      const tile = (i0: number, j0: number, n: number, c: RGB) => { const P = (i: number, j: number) => { const g = s.grid(s.u0 + i, s.v0 + j); return [g[0], H(g[0], g[1]) + 0.1, -g[1]]; };
        ground.quad(P(i0, j0), P(i0 + n, j0), P(i0 + n, j0 + n), P(i0, j0 + n), [0, 1, 0], c, c, c, c, 0); };
      for (let bj = 0; bj < s.H; bj += 4) for (let bi = 0; bi < s.W; bi += 4) {
        let all = true; for (let j = bj; j < Math.min(s.H, bj + 4) && all; j++) for (let i = bi; i < Math.min(s.W, bi + 4); i++) if (green(s.k(i, j))) { all = false; break; }
        if (all && bi + 4 <= s.W && bj + 4 <= s.H) { tile(bi, bj, 4, colOf(s.k(bi + 1, bj + 1))); continue; }
        for (let j = bj; j < Math.min(s.H, bj + 4); j++) for (let i = bi; i < Math.min(s.W, bi + 4); i++) if (!green(s.k(i, j))) tile(i, j, 1, colOf(s.k(i, j)));
      }
    }
    phase('ground');
    // middens, dung, bone pits: one refuse mesh (grime where work happens, brief 5.5)
    const refuse = new Batch(), rDesc: Desc[] = [];
    for (const m of this.plan.middens) { const d = rDesc.length; rDesc.push({ tier: 'C', src: ROWS[m.row]?.src ?? 'RECON', note: `${m.kind === 'bone' ? 'pit of bone fragments (PW2017, B activity; form C)' : m.kind === 'dung' ? 'dung in an animal pen (C)' : 'midden: ash, sherds, bone and dung (C)'}` });
      const c = lin(m.kind === 'bone' ? [0.62, 0.58, 0.5] : m.kind === 'dung' ? [0.3, 0.25, 0.18] : [0.36, 0.32, 0.27]);
      refuse.mound(m.c[0], m.c[1], m.r, m.h, c, H, d); }
    // finish meshes
    const mats: Record<string, THREE.Material> = {
      mud: surfaceMaterial('mud_plaster', { vertexColors: true }), stone: surfaceMaterial('stone_plain', { vertexColors: true }), takht: surfaceMaterial('takht_stone'), refuse: surfaceMaterial('refuse', { vertexColors: true }),
    };
    for (const cl of clusters.values()) for (const [mat, b] of cl.batches) {
      if (!b.tris) continue;
      const m = new THREE.Mesh(b.toGeometry(), mats[mat]); m.name = `settlement:${cl.id}:${mat}`; m.castShadow = true; m.receiveShadow = true; m.matrixAutoUpdate = false;
      const owner = b.owner, desc = cl.desc;
      m.userData = { tier: 'C', src: 'RECON', note: `settlement cluster ${cl.id} (${mat})`, describe: (hit: any) => desc[owner[hit?.faceIndex ?? -1]] ?? null };
      this.group.add(m); this.info.tris += b.tris; this.info.meshes++; if (cl.id === 'gardens') m.castShadow = false; else this.casters.push(m);
    }
    if (ground.tris) { const gm = surfaceMaterial('road', { vertexColors: true }) as any; gm.polygonOffset = true; gm.polygonOffsetFactor = -4; gm.polygonOffsetUnits = -8; // 10 cm over the ground: the terrain's coarser LODs must not poke through
      const m = new THREE.Mesh(ground.toGeometry(), gm); m.name = 'settlement:ground'; m.receiveShadow = true; m.matrixAutoUpdate = false; const own = ground.owner;
      m.userData = { tier: 'C', src: 'RECON', note: gDesc[0].note, describe: (hit: any) => gDesc[own[hit?.faceIndex ?? -1]] ?? gDesc[0] }; this.group.add(m); this.info.tris += ground.tris; this.info.meshes++; }
    if (refuse.tris) { const m = new THREE.Mesh(refuse.toGeometry(), mats.refuse); m.name = 'settlement:refuse'; m.receiveShadow = true; m.matrixAutoUpdate = false; const own = refuse.owner;
      m.userData = { tier: 'C', src: 'RECON', note: 'middens and dung', describe: (hit: any) => rDesc[own[hit?.faceIndex ?? -1]] ?? null }; this.group.add(m); this.info.tris += refuse.tris; this.info.meshes++; }
    phase('meshes');
    // Tol-e Ajori, trees, water/roads/canal, haze
    const aj = buildAjori(this.plan.gate, H); this.group.add(aj.group); aj.group.traverse((o: any) => { if (o.isMesh && o.castShadow) this.casters.push(o); }); this.info.tris += aj.tris; this.info.meshes += aj.meshes;
    this.cols.push({ id: 'tol_ajori', c: this.plan.gate.c, r: 40, boxes: aj.colliders, live: null });
    this.trees = new TreeField(this.plan.trees, H, quality); this.group.add(this.trees.group); this.info.trees = this.plan.trees.length;
    const wr = buildWaterAndRoads(this.plan, H); this.wr = wr; this.group.add(wr.group); this.info.tris += wr.tris; this.info.meshes += wr.meshes;
    this.haze = new TownHaze(this.plan, H, this.fire, this.fireIdx); this.group.add(this.haze.group);
    phase('ajori_trees_water_haze');
    this.info.colliders = this.cols.reduce((a, c) => a + c.boxes.length, 0);
    this.info.buildMs = performance.now() - t0;
  }

  /** plot base heights, walls, roofs, doors, fittings of one site into its cluster's batch; colliders; fires */
  private buildSite(s: Site, cl: Cluster, mud: Batch, stone: () => Batch, col: SiteCol, H: (e: number, n: number) => number) {
    const plots = s.plots, base = new Float32Array(plots.length), local = new Uint8Array(plots.length), pdesc = new Int32Array(plots.length), pcol: RGB[] = [];
    for (const p of plots) {
      const [i0, j0, i1, j1] = p.rect; const pts: P2[] = [[i0, j0], [i1, j0], [i1, j1], [i0, j1], [(i0 + i1) / 2, (j0 + j1) / 2]].map(([i, j]) => s.grid(s.u0 + i, s.v0 + j));
      base[p.idx] = pts.reduce((a, q) => a + H(q[0], q[1]), 0) / pts.length;
      local[p.idx] = (i1 - i0) * (j1 - j0) > 2500 ? 1 : 0; // big enclosures: walls follow the ground
      const row = ROWS[p.row];
      pdesc[p.idx] = cl.desc.length;
      cl.desc.push({ tier: row?.tier ?? 'C', src: row?.src ?? 'RECON', note: `${p.id}: ${kindLabel(p)}${p.capacity ? `, houses ${p.capacity}` : ''}, ${p.area} m² (${p.roofed} m² roofed). ${p.note || ''} ${row?.note ?? HOUSE_BASIS}`.replace(/\s+/g, ' ') });
      const rng = new Rng(hashString(p.id), 'colour');
      const official = p.kind === 'official';
      // each house its own batch of loam: brightness varies, the hue only slightly toward warmer or greyer (C)
      const k = rng.range(0.88, 1.07), warm = rng.range(-0.012, 0.012);
      const baseC: RGB = official ? [0.58, 0.57, 0.45] : [MUD[0] * k + warm, MUD[1] * k, MUD[2] * k - warm];
      pcol[p.idx] = lin(baseC);
    }
    // walls
    for (const w of s.walls()) {
      const along = w.v0 === w.v1; // u-direction wall
      const cu = (w.u0 + w.u1) / 2, cv = (w.v0 + w.v1) / 2, len = along ? w.u1 - w.u0 : w.v1 - w.v0;
      const g0 = s.grid(w.u0, w.v0), g1 = s.grid(w.u1, w.v1), gm = s.grid(cu, cv);
      const hA = H(g0[0], g0[1]), hB = H(g1[0], g1[1]), hM = H(gm[0], gm[1]); const gmin = Math.min(hA, hB, hM), gmax = Math.max(hA, hB, hM);
      let top = -Infinity, doorBase = Infinity, owner = -1, colr: RGB = pcol[w.sides[0].plot];
      for (const sd of w.sides) { const b = local[sd.plot] ? gmin : base[sd.plot]; top = Math.max(top, b + sd.top); doorBase = Math.min(doorBase, b); if (owner < 0) { owner = pdesc[sd.plot]; colr = pcol[sd.plot]; } }
      top = Math.max(top, gmax + 0.9);
      const y0 = gmin - 0.4;
      const hu = along ? len / 2 : w.thick / 2, hv = along ? w.thick / 2 : len / 2;
      if (w.door) {
        const yl = Math.max(doorBase, gmax) + DOOR_H; if (top - yl > 0.05) mud.box(gm[0], gm[1], s.frame.theta, hu, hv, yl, top, shade(colr, 0.9), colr, owner);
        continue;
      }
      mud.box(gm[0], gm[1], s.frame.theta, hu, hv, y0, top, shade(colr, 0.72), colr, owner);
      col.boxes.push({ x: gm[0], y: (y0 + top) / 2, z: -gm[1], hx: hu, hy: (top - y0) / 2, hz: hv, rot: s.frame.theta });
    }
    // roofs
    for (const r of s.roofs()) {
      const p = plots[r.plot]; const top = base[r.plot] + p.height;
      const g = s.grid(s.u0 + (r.i0 + r.i1) / 2, s.v0 + (r.j0 + r.j1) / 2);
      mud.box(g[0], g[1], s.frame.theta, (r.i1 - r.i0) / 2, (r.j1 - r.j0) / 2, top - ROOF_T, top, shade(pcol[r.plot], 0.8), pcol[r.plot], pdesc[r.plot]);
    }
    // street doors: timber leaves, standing open against the vestibule wall (C: doors do not move in the town yet)
    const tb = lin(TIMBER);
    for (const p of plots) { const d = s.doorPoints(p); if (!d || p.kind === 'garden') continue;
      const ia = p.door!.cell % s.W, ja = (p.door!.cell / s.W) | 0, ib = p.door!.out % s.W, jb = (p.door!.out / s.W) | 0;
      const nu = ia - ib, nv = ja - jb; // inward
      const hinge = [d.mid[0] + nu * 0.45 + (nv ? 0.45 : 0), d.mid[1] + nv * 0.45 + (nu ? 0.45 : 0)] as P2;
      const leaf = s.grid(hinge[0] + nu * 0.45, hinge[1] + nv * 0.45); const b = base[p.idx];
      mud.box(leaf[0], leaf[1], s.frame.theta, nv ? 0.03 : 0.45, nv ? 0.45 : 0.03, b, b + 1.95, tb, shade(tb, 1.1), pdesc[p.idx]);
    }
    // fittings
    for (const f of s.fittings) {
      if (f.kind === 'tree' || f.kind === 'channel' || f.kind === 'ditch' || f.kind === 'midden' || f.kind === 'pen_dung' || f.kind === 'pit') {
        if (f.kind === 'channel') { const dd = cl.desc.length; cl.desc.push({ tier: 'C', src: ROWS[plots[f.plot]?.row]?.src ?? 'RECON', note: f.note ?? 'stone-lined channel (C)' }); this.kerbs(s, f, stone(), H, dd); }
        continue; }
      const g = s.grid(f.u, f.v), y = H(g[0], g[1]), th = s.frame.theta + f.rot;
      const d = cl.desc.length; cl.desc.push({ tier: 'C', src: f.plot >= 0 ? (ROWS[plots[f.plot].row]?.src ?? 'RECON') : 'RECON', note: f.note ?? `${f.kind} (C)` });
      const at = (du: number, dv: number): P2 => { const c = Math.cos(th), sn = Math.sin(th); return [g[0] + du * c - dv * sn, g[1] + du * sn + dv * c]; };
      const pot = lin(POT), st = lin(STONE), tim = lin(TIMBER), mc = lin(MUD);
      const fireMeta = (sched: FireSchedule) => ({ tier: 'C', src: f.plot >= 0 ? (ROWS[plots[f.plot].row]?.src ?? 'RECON') : 'RECON', note: f.note ?? `${f.kind} (C)`, sched, group: s.id });
      const addFire = (kind: FireKind, e: number, n: number, yy: number, sched: FireSchedule) => { this.fire.add(kind, new THREE.Vector3(e, yy, -n), { ...fireMeta(sched), body: false }); this.fireIdx.push({ site: s.id, kind }); this.info.fires++; };
      switch (f.kind) {
        case 'hearth': this.hearthRing(mud, g, y, d); addFire('hearth', g[0], g[1], y, plots[f.plot]?.kind === 'official' || plots[f.plot]?.kind === 'station' || plots[f.plot]?.kind === 'store' || plots[f.plot]?.kind === 'stable' ? 'night' : 'home'); break;
        case 'oven': { const oc = lin([0.6, 0.47, 0.34]); mud.cyl(g[0], g[1], 0.42, 0.34, y - 0.1, y + 0.75, 8, shade(oc, 0.7), oc, d, false); mud.cyl(g[0], g[1], 0.34, 0.2, y + 0.75, y + 0.82, 8, oc, shade(oc, 0.25), d, true);
          col.boxes.push({ x: g[0], y: y + 0.4, z: -g[1], hx: 0.35, hy: 0.45, hz: 0.35, rot: 0 }); addFire('oven', g[0], g[1], y + 0.55, 'bake'); break; }
        case 'forge': mud.box(g[0], g[1], th, 0.5 * f.size, 0.4 * f.size, y - 0.1, y + 0.55, shade(mc, 0.5), shade(mc, 0.35), d); addFire('hearth', g[0], g[1], y + 0.45, 'day'); break;
        case 'kiln': { const r = 1.2 * f.size; mud.cyl(g[0], g[1], r, r * 0.92, y - 0.1, y + 1.3 * f.size, 12, shade(mc, 0.55), shade(mc, 0.85), d, false); mud.cyl(g[0], g[1], r * 0.92, 0.35, y + 1.3 * f.size, y + 2.0 * f.size, 12, shade(mc, 0.85), shade(mc, 0.4), d);
          col.boxes.push({ x: g[0], y: y + 1, z: -g[1], hx: r * 0.8, hy: 1, hz: r * 0.8, rot: 0 }); addFire('kiln', g[0], g[1], y, 'day'); break; }
        case 'jar': case 'jar_big': case 'vat': { const k = (f.kind === 'jar' ? 1 : f.kind === 'jar_big' ? 1.5 : 1.7) * f.size, wide = f.kind === 'vat' ? 1.5 : 1;
          mud.lathe(g[0], g[1], y - 0.05, [[0.12 * k * wide, 0], [0.25 * k * wide, 0.22 * k], [0.24 * k * wide, 0.48 * k], [0.12 * k * wide, 0.68 * k], [0.11 * k * wide, 0.72 * k]], 7, pot, d); break; }
        case 'quern': mud.box(g[0], g[1], th, 0.28, 0.2, y - 0.05, y + 0.14, st, st, d); mud.box(...at(0, 0.02), th, 0.12, 0.08, y + 0.14, y + 0.22, st, st, d); break;
        case 'grind_slab': { mud.box(g[0], g[1], th, 0.32, 0.22, y - 0.05, y + 0.1, st, st, d);
          const pig: RGB[] = [[0.12, 0.28, 0.62], [0.22, 0.48, 0.34], [0.55, 0.2, 0.13], [0.76, 0.58, 0.26]]; pig.forEach((pc, i) => mud.box(...at(-0.2 + i * 0.13, 0.05), th, 0.035, 0.035, y + 0.1, y + 0.15, lin(pc), lin(pc), d)); break; }
        case 'loom': { for (const s2 of [-0.7, 0.7]) mud.box(...at(s2, 0), th, 0.05, 0.05, y - 0.1, y + 1.7, tim, tim, d); mud.box(...at(0, 0), th, 0.8, 0.05, y + 1.62, y + 1.72, tim, tim, d);
          mud.box(...at(0, 0.02), th, 0.62, 0.008, y + 0.25, y + 1.6, lin([0.8, 0.76, 0.66]), lin([0.78, 0.7, 0.58]), d); break; }
        case 'timber': { const L = (f.len ?? 3) / 2; for (let x = 0; x < 5; x++) mud.box(...at(0, -0.6 + (x % 3) * 0.3), th, L, 0.13, y + (x > 2 ? 0.26 : 0), y + (x > 2 ? 0.5 : 0.25), tim, shade(tim, 1.15), d); break; }
        case 'anvil': mud.box(g[0], g[1], th, 0.22, 0.2, y - 0.05, y + 0.5, st, shade(st, 0.8), d); break;
        case 'bench': mud.box(g[0], g[1], th, 0.8, 0.25, y, y + 0.8, tim, tim, d); break;
        case 'knucklebones': for (let x = 0; x < 5; x++) mud.box(...at(x * 0.07 - 0.14, (x % 2) * 0.05), th + x, 0.018, 0.012, y, y + 0.02, lin(BONE), lin(BONE), d); break;
        case 'trough': mud.box(g[0], g[1], th, 0.7 * f.size, 0.28, y - 0.05, y + 0.5, st, st, d); col.boxes.push({ x: g[0], y: y + 0.25, z: -g[1], hx: 0.7 * f.size, hy: 0.3, hz: 0.28, rot: th }); break;
        case 'manger': mud.box(g[0], g[1], th, 0.9, 0.3, y - 0.05, y + 0.85, shade(mc, 0.85), mc, d); col.boxes.push({ x: g[0], y: y + 0.4, z: -g[1], hx: 0.9, hy: 0.45, hz: 0.3, rot: th }); break;
        case 'well': this.well(g, y, mud, d); col.boxes.push({ x: g[0], y: y + 0.35, z: -g[1], hx: 0.85, hy: 0.4, hz: 0.85, rot: 0 }); break;
        case 'column': { mud.cyl(g[0], g[1], 0.55, 0.5, y - 0.2, y + 0.4, 10, st, st, d); mud.cyl(g[0], g[1], 0.3, 0.27, y + 0.4, y + f.size, 10, lin([0.78, 0.72, 0.62]), lin([0.78, 0.72, 0.62]), d, false);
          mud.box(g[0], g[1], th, 0.45, 0.45, y + f.size, y + f.size + 0.35, tim, tim, d); col.boxes.push({ x: g[0], y: y + f.size / 2, z: -g[1], hx: 0.35, hy: f.size / 2, hz: 0.35, rot: 0 }); break; }
        case 'pool': this.poolKerb(s, f, s.plots[f.plot]?.kind === 'garden' ? stone() : mud, H, d); break;
        default: break;
      }
    }
  }
  /** a ring of hearth stones with ash inside (C) */
  private hearthRing(b: Batch, g: P2, y: number, d: number) {
    const st = lin([0.5, 0.48, 0.44]), ash = lin([0.2, 0.19, 0.18]);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; b.box(g[0] + Math.cos(a) * 0.42, g[1] + Math.sin(a) * 0.42, a, 0.1, 0.13, y - 0.05, y + 0.14, st, shade(st, 1.1), d); }
    b.cyl(g[0], g[1], 0.34, 0.3, y - 0.05, y + 0.03, 6, ash, ash, d);
  }
  private well(g: P2, y: number, b: Batch, d: number) {
    const st = lin(STONE), ro = 0.8, ri = 0.55, n = 10, x = g[0], z = -g[1];
    b.cyl(g[0], g[1], ro, ro * 0.96, y - 0.2, y + 0.7, n, shade(st, 0.8), st, d, false);
    for (let s = 0; s < n; s++) { const a0 = (s / n) * Math.PI * 2, a1 = ((s + 1) / n) * Math.PI * 2, am = (a0 + a1) / 2;
      b.quad([x + Math.cos(a0) * ri, y - 0.1, z + Math.sin(a0) * ri], [x + Math.cos(a1) * ri, y - 0.1, z + Math.sin(a1) * ri], [x + Math.cos(a1) * ri, y + 0.7, z + Math.sin(a1) * ri], [x + Math.cos(a0) * ri, y + 0.7, z + Math.sin(a0) * ri], [-Math.cos(am), 0, -Math.sin(am)], shade(st, 0.4), shade(st, 0.4), st, st, d);
      b.quad([x + Math.cos(a0) * ri, y + 0.7, z + Math.sin(a0) * ri], [x + Math.cos(a1) * ri, y + 0.7, z + Math.sin(a1) * ri], [x + Math.cos(a1) * ro * 0.96, y + 0.7, z + Math.sin(a1) * ro * 0.96], [x + Math.cos(a0) * ro * 0.96, y + 0.7, z + Math.sin(a0) * ro * 0.96], [0, 1, 0], st, st, st, st, d); }
  }
  private kerbs(s: Site, f: Site['fittings'][0], b: Batch, H: (e: number, n: number) => number, d: number) {
    // stone-lined channel: two kerbs along its length, laid in 6 m pieces that follow the ground
    const L = f.len ?? 1, du = Math.cos(f.rot), dv = Math.sin(f.rot), w = (f.wid ?? 0.3) / 2 + 0.1, st = lin(STONE);
    for (let x = -L / 2; x < L / 2; x += 6) { const l = Math.min(6, L / 2 - x), cu = f.u + du * (x + l / 2), cv = f.v + dv * (x + l / 2);
      for (const sd of [-1, 1]) { const g = s.grid(cu - dv * w * sd, cv + du * w * sd); const y = H(g[0], g[1]); b.box(g[0], g[1], s.frame.theta + f.rot, l / 2, 0.1, y - 0.15, y + 0.12, st, st, d); } }
  }
  private poolKerb(s: Site, f: Site['fittings'][0], b: Batch, H: (e: number, n: number) => number, d: number) {
    const L = (f.len ?? 5) / 2, W = (f.wid ?? 5) / 2, st = lin(STONE), g = s.grid(f.u, f.v), y = H(g[0], g[1]);
    for (const [cu, cv, hu, hv] of [[0, W + 0.2, L + 0.4, 0.2], [0, -W - 0.2, L + 0.4, 0.2], [L + 0.2, 0, 0.2, W], [-L - 0.2, 0, 0.2, W]]) { const q = s.grid(f.u + cu, f.v + cv); b.box(q[0], q[1], s.frame.theta, hu, hv, y - 0.3, y + 0.3, st, st, d); }
  }

  /** stream colliders: sites within 200 m of the player get theirs (at most `budget` boxes per call, so entering the
   *  town never stalls a frame for long), sites beyond 300 m drop them */
  streamColliders(x: number, z: number, budget = 1500) {
    if (!this.phys) return;
    const e = x, n = -z;
    for (const c of this.cols) {
      const d = Math.hypot(c.c[0] - e, c.c[1] - n) - c.r;
      if (d < 200 && (!c.live || c.live.length < c.boxes.length) && budget > 0) {
        c.live ??= [];
        while (c.live.length < c.boxes.length && budget-- > 0) { const b = c.boxes[c.live.length]; c.live.push(this.phys.addBox({ x: b.x, y: b.y, z: b.z }, { x: b.hx, y: b.hy, z: b.hz }, b.rot)); this.info.liveColliders++; }
      } else if (d > 300 && c.live) { for (const k of c.live) this.phys.world.removeCollider(k, false); this.info.liveColliders -= c.live.length; c.live = null; }
    }
  }
  update(dt: number, ctx: { camera: THREE.Camera; clock: any; sky: any; cond: any; player: any }) {
    const p = ctx.player?.position ?? ctx.camera.position; this.streamColliders(p.x, p.z);
    const cp = ctx.camera.position;
    for (const m of this.casters) { const bs = m.geometry.boundingSphere!; m.castShadow = bs.center.distanceTo(cp) - bs.radius < SHADOW_RANGE; }
    this.trees.update(ctx.camera, ctx.clock?.dayIndex ?? 0, ctx.cond?.windMs ?? 2); this.wr.update(ctx.camera.position);
    this.haze.update(dt, ctx.camera, ctx.sky?.sunAlt ?? 30, ctx.cond?.windMs ?? 2, ctx.cond?.windDirDeg ?? 0, ctx.clock?.localHour ?? 12, ctx.sky);
  }
  stats() { return { ...this.info, casting: this.casters.filter(m => m.castShadow).length, trees: this.trees.stats(), haze: this.haze.stats() }; }
}

function kindLabel(p: Plot) {
  switch (p.kind) {
    case 'house': return 'courtyard house'; case 'house_large': return 'large courtyard house'; case 'workshop': return `workshop (${p.craft}) with rooms`;
    case 'yard': return 'walled yard (garden or orchard)'; case 'pen': return 'animal pen'; case 'garden': return 'walled garden'; case 'elite': return 'elite estate';
    default: return p.kind;
  }
}
export type { Wall, Prop };
