// The fill drawn (session 15, agent fill, D-367): the plan of fillPlan.ts (the markets, the lanes' frontage, the washing lines,
// the Terrace's yards and standards) drawn round the viewer from the project's modelled props (tools/blender/fill_props.py and
// model_props.py: the AO baked in, every asset in ASSET_LEDGER.md). One InstancedMesh per model, part and level, rebuilt when
// the viewer has moved 3 m or the market has opened or closed; level 0 within 7 m, 1 within 22 m, 2 beyond; small things within
// 55 m, the large (stalls, awnings, lines, standards) within 110 m. Each part is drawn in the material of what it is made of
// (materials.ts propMaterial: the CC0 scan's grain over the written colour), its colour per instance (the cloths' dyes).
// A model that failed to load is not drawn and is listed in stats().missing (PLACEHOLDER: nothing stands in for it).
import * as THREE from 'three/webgpu';
import { model, modelParts, aoFactor } from '../render/scanProps';
import { propMaterial } from '../render/materials';
import type { FillItem, RGB } from './fillPlan';

/** what each part name is made of: [the material's kind, the default sRGB colour, metalness] */
const PART: Record<string, [string, RGB, number?]> = {
  wood: ['wood', [0.47, 0.37, 0.27]], wood_d: ['wood', [0.38, 0.3, 0.22]], mud: ['mud', [0.6, 0.48, 0.36]], brick: ['mud', [0.64, 0.5, 0.37]], dung: ['mud', [0.36, 0.3, 0.22]],
  cloth: ['textile', [0.72, 0.64, 0.5]], cord: ['textile', [0.58, 0.5, 0.36]], textile: ['textile', [0.7, 0.6, 0.46]], textile_a: ['textile', [0.78, 0.7, 0.56]], textile_b: ['textile', [0.55, 0.22, 0.16]],
  cloth_a: ['textile', [0.82, 0.78, 0.68]], cloth_b: ['textile', [0.6, 0.3, 0.2]], linen: ['textile', [0.84, 0.8, 0.7]], red: ['textile', [0.56, 0.2, 0.15]],
  wicker: ['wicker', [0.64, 0.54, 0.36]], fruit: ['leather', [0.55, 0.15, 0.1]], grain: ['mud', [0.78, 0.66, 0.42]], reed: ['reed', [0.72, 0.62, 0.42]], matting: ['reed', [0.72, 0.62, 0.42]],
  clay: ['clay', [0.66, 0.46, 0.32]], stone: ['stone', [0.74, 0.7, 0.62]], fines: ['stone', [0.8, 0.76, 0.68]], gilt: ['metal', [0.85, 0.66, 0.3], 0.75],
  // s17 C1 (D-550): the parts of the household things the gap fill and the lanes' litter add (tools, straw, fleeces, sherds, ash)
  iron: ['metal', [0.3, 0.28, 0.26], 0.55], straw: ['reed', [0.8, 0.7, 0.46]], straw_d: ['reed', [0.66, 0.57, 0.38]], wool: ['textile', [0.82, 0.77, 0.66]], wool_d: ['textile', [0.6, 0.52, 0.42]],
  earth: ['mud', [0.56, 0.48, 0.38]], mud_wet: ['mud', [0.44, 0.36, 0.27]], hide: ['leather', [0.62, 0.48, 0.34]], hide_d: ['leather', [0.48, 0.36, 0.25]], bone: ['stone', [0.86, 0.82, 0.72]],
  s0: ['clay', [0.68, 0.45, 0.3]], s1: ['clay', [0.62, 0.41, 0.28]], s2: ['clay', [0.72, 0.52, 0.36]], s3: ['clay', [0.58, 0.38, 0.27]], nut: ['wood', [0.52, 0.38, 0.24]],
};
const BIG = new Set(['fill_stall', 'fill_awning', 'fill_line', 'fill_standard', 'fill_scaffold']);
const SHADOW = new Set(['fill_stall', 'fill_awning', 'fill_standard', 'fill_scaffold', 'fill_chips', 'fill_block', 'fill_line', 'timber_stack', 'jar_store', 'wo_drying_rack', 'brush_pile']);
/** s17 C1 (D-550): the gap fill's and the litter's small things are drawn at one level only (their lod1 holds the form at a few
 *  hundred triangles; the litter is flat junk at lod2) and not beyond their range (m), so the many kinds they add cost one draw
 *  per part, not three: [level, range] */
const ONE_LEVEL: Record<string, [number, number]> = { gap: [1, 40], litter: [2, 30] };
export const FILL_R = { small: 55, big: 110, lod0: 7, lod1: 22, move: 3 } as const;
const CELL = 32;
const _c = new THREE.Color();

interface Slot { mesh: THREE.InstancedMesh; part: string; n: number }
export interface FillEnv { ground: (e: number, n: number) => number; phys?: { addBox(c: { x: number; y: number; z: number }, h: { x: number; y: number; z: number }, rotY?: number): unknown } | null; nav?: { blockDisc(e: number, n: number, r: number): void; walkable?(e: number, n: number): boolean } | null }

export class WorldFill {
  readonly group = new THREE.Group();
  private grid = new Map<number, number[]>();
  private y: Float32Array;
  private slots = new Map<string, Slot[][]>(); // model -> level -> parts
  private last: [number, number] = [1e9, 1e9]; private lastDay = -1;
  private m4 = new THREE.Matrix4(); private q = new THREE.Quaternion(); private qt = new THREE.Quaternion(); private xAxis = new THREE.Vector3(1, 0, 0); private up = new THREE.Vector3(0, 1, 0); private p = new THREE.Vector3(); private sc = new THREE.Vector3();
  readonly missing: string[] = []; drawn = 0; meshes = 0; solids = 0;
  constructor(readonly items: FillItem[], private env: FillEnv) {
    this.group.name = 'fill';
    this.group.userData = { tier: 'C', src: 'RECON', note: 'the fill (D-367): market stalls and their goods, the lanes\' fuel, jars, sacks and rubble, awnings over doors, washing lines across the lanes, the masons\' waste, the goods at the stair foot and the standards on the Terrace: placed by rule (fillPlan.ts), modelled props (C)' };
    this.y = new Float32Array(items.length);
    const count = new Map<string, number>();
    items.forEach((it, i) => { const y = env.ground(it.e, it.n); this.y[i] = Number.isFinite(y) && !(it.at === 'terrace' && env.nav?.walkable && !env.nav.walkable(it.e, it.n)) ? y : NaN; /* (a Terrace item off the walkable floor, in a wall or a hall: not drawn) */ count.set(it.m, (count.get(it.m) ?? 0) + 1);
      const k = this.key(Math.floor(it.e / CELL), Math.floor(it.n / CELL)); (this.grid.get(k) ?? this.grid.set(k, []).get(k)!).push(i);
      if (it.solid && Number.isFinite(this.y[i])) { const [hx, hz] = it.solid;
        env.phys?.addBox({ x: it.e, y: this.y[i] + it.dy + 0.5, z: -it.n }, { x: hx * it.s[0], y: 0.5, z: hz * it.s[2] }, it.rot); env.nav?.blockDisc(it.e, it.n, Math.max(hx, hz) * it.s[0]); this.solids++; } });
    for (const [m, n] of count) {
      const M = model(m); if (!M) { this.missing.push(m); continue; }
      const cap = Math.min(n, BIG.has(m) ? 400 : 700), levels: Slot[][] = [];
      for (let l = 0; l < 3; l++) { const parts = modelParts(m, l)!, L: Slot[] = [];
        for (const [part, g0] of Object.entries(parts)) { const def = PART[part] ?? ['clay', [0.6, 0.5, 0.4]], g = new THREE.BufferGeometry(), N = g0.getAttribute('position').count, col = new Float32Array(N * 3);
          for (let i = 0; i < N; i++) { const a = aoFactor(g0, i); col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = a; }
          g.setAttribute('position', g0.getAttribute('position')); g.setAttribute('normal', g0.getAttribute('normal') ?? (g0.computeVertexNormals(), g0.getAttribute('normal'))); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); if (g0.index) g.setIndex(g0.index);
          g.computeBoundingSphere();
          const mat = propMaterial(def[0], { vertexColors: true, metal: def[2] ?? 0, rough: def[0] === 'metal' ? 0.45 : undefined });
          const mesh = new THREE.InstancedMesh(g, mat, cap); mesh.count = 0; mesh.visible = false; mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.castShadow = SHADOW.has(m) && l < 2;
          mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); mesh.name = `fill:${m}:${part}:lod${l}`;
          mesh.userData = { tier: 'C', src: 'RECON', note: `${m} (${part}), the fill (D-367): placed by rule, modelled (tools/blender/${m.startsWith('fill_') ? 'fill_props' : 'model_props'}.py)` };
          this.group.add(mesh); this.meshes++; L.push({ mesh, part, n: 0 }); }
        levels.push(L); }
      this.slots.set(m, levels);
    }
  }
  private key(i: number, j: number) { return (i + 4096) * 8192 + (j + 4096); }
  /** rebuild round the viewer (grid e, n) when it has moved FILL_R.move m, the market opened or closed (local hour) or rain began or stopped */
  update(viewer: [number, number], hour: number, rain = 0, force = false): boolean {
    // (in rain the goods are taken in and the washing too; s17 C1: through the afternoon, hour by hour, sold goods go)
    const open = hour >= 6.5 && hour < 19, day = (open ? 1 : 0) + (rain > 0.15 ? 2 : 0) + (open && hour >= 12.5 ? 4 * Math.floor(hour - 11.5) : 0), wet = (day & 2) !== 0;
    if (!force && day === this.lastDay && Math.hypot(viewer[0] - this.last[0], viewer[1] - this.last[1]) < FILL_R.move) return false;
    this.last = [viewer[0], viewer[1]]; this.lastDay = day;
    for (const L of this.slots.values()) for (const S of L) for (const s of S) s.n = 0;
    const R = FILL_R.big, i0 = Math.floor((viewer[0] - R) / CELL), i1 = Math.floor((viewer[0] + R) / CELL), j0 = Math.floor((viewer[1] - R) / CELL), j1 = Math.floor((viewer[1] + R) / CELL);
    let drawn = 0;
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) for (const k of this.grid.get(this.key(i, j)) ?? []) {
      const it = this.items[k], y = this.y[k]; if (!Number.isFinite(y) || (it.day && (!open || wet || (it.until !== undefined && hour >= it.until))) || (wet && it.m === 'fill_line')) continue;
      const d = Math.hypot(it.e - viewer[0], it.n - viewer[1]), one = ONE_LEVEL[it.at]; if (d > (one ? one[1] : BIG.has(it.m) ? FILL_R.big : FILL_R.small)) continue;
      const levels = this.slots.get(it.m); if (!levels) continue;
      const L = levels[one ? one[0] : d < FILL_R.lod0 ? 0 : d < FILL_R.lod1 ? 1 : 2];
      this.q.setFromAxisAngle(this.up, it.rot); if (it.tilt) this.q.multiply(this.qt.setFromAxisAngle(this.xAxis, it.tilt)); this.m4.compose(this.p.set(it.e, y + it.dy, -it.n), this.q, this.sc.set(it.s[0], it.s[1], it.s[2]));
      const shade = 0.88 + 0.24 * (((k * 2654435761) >>> 0) / 4294967296);
      for (const s of L) { if (s.n >= s.mesh.instanceMatrix.count) continue;
        const c = it.col?.[s.part] ?? (PART[s.part]?.[1] ?? [0.6, 0.5, 0.4]);
        s.mesh.setMatrixAt(s.n, this.m4); _c.setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace).multiplyScalar(shade); s.mesh.setColorAt(s.n, _c); s.n++; }
      drawn++;
    }
    for (const L of this.slots.values()) for (const S of L) for (const s of S) { s.mesh.count = s.n; s.mesh.visible = s.n > 0; if (s.n) { s.mesh.instanceMatrix.needsUpdate = true; s.mesh.instanceColor!.needsUpdate = true; } }
    this.drawn = drawn; return true;
  }
  stats() { let draws = 0, tris = 0; this.group.traverse(o => { const m = o as THREE.InstancedMesh; if (m.isInstancedMesh && m.visible) { draws++; tris += m.count * ((m.geometry.index?.count ?? m.geometry.getAttribute('position').count) / 3); } });
    const by: Record<string, number> = {}; for (const it of this.items) by[it.at] = (by[it.at] ?? 0) + 1;
    return { items: this.items.length, by, drawn: this.drawn, draws, tris: Math.round(tris), meshes: this.meshes, solids: this.solids, missing: this.missing }; }
}
