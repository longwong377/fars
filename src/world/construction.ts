// The Hall of a Hundred Columns follows the simulation's construction state (brief §9.5 "construction advances week by
// week (courses laid, columns raised, reliefs carved)"; Phase 5 gate; D-022). The architecture draws the hall at its
// day-0 state (src/arch/terrace.ts); this view replaces those column instances with ones grouped by each column's state
// in src/people/construction.ts: drums set (the shaft rises drum by drum), fluting done (shafts are fluted after erection,
// C) and capital set. It rebuilds only when that state changes (a few times a week), so a frame costs nothing extra.
// Colliders keep their day-0 height: the player cannot climb a shaft stump (the bell base alone is above the step-up), so
// the difference is not walkable either way (C, noted). Walls and relief carving stay at their day-0 geometry.
// The site itself (brief §1.2: "an active building site, with scaffolds, stone-cutters and rationed work gangs, is
// honest"): the masons' yard N of the portico (people_places.json `worksite`, C) holds the drums the simulation counts —
// quarry-rough ones waiting, dressed ones ready to raise — the capitals finished and the block being carved; timber
// scaffolds stand at the column receiving drums and the shaft being fluted. How drums were raised and shafts fluted is not
// known (no ramp or crane evidence retrieved, D-022): scaffold form, drum stacking and yard layout are all C.
import * as THREE from 'three/webgpu';
import { InstancedLOD, carvedMaterial } from '../arch/meshes';
import { columnMeshesByMaterial, toGeometry, srow, capitalAlone } from '../arch/sculpt';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { surfaceMaterial } from '../render/materials';
import { BUILD } from '../people/construction';
import placesJson from '../data/people_places.json';
import { order } from '../arch/orders';
import { v } from '../arch/spec';
import type { Construction } from '../people/construction';

const B = 'hall100';
/** one column's visible state: drums set, fluted, capital set */
const stateKey = (c: { drums: number; fluted: number; capitalSet: boolean }) => `${c.drums}|${c.fluted >= 1 ? 1 : 0}|${c.capitalSet ? 1 : 0}`;

export class ConstructionView {
  readonly group = new THREE.Group();
  private sig = '';
  private ord = order(B, { base: 'bell', capital: 'bull' });
  private floor = v(B, 'floor') as number;
  /** rebuilds done so far (the first is the day-0 state) */
  rebuilds = 0;
  private yard = new THREE.Group(); private yardSig = '';
  /** what the site shows now (tests, overlay) */
  site = { waiting: 0, dressed: 0, capitalsReady: 0, capitalInWork: false, scaffolds: [] as number[] };
  constructor(arch: THREE.Object3D, private construction: () => Construction | null) {
    this.group.name = 'hall100:construction';
    this.group.add(this.yard); this.yard.name = 'hall100:site';
    // the architecture's static hall columns give way to this view
    const old: THREE.Object3D[] = []; arch.traverse(o => { if (o.name.startsWith(`${B}:columns`) && !o.name.includes(':lod')) old.push(o); });
    for (const o of old) o.removeFromParent();
    this.sync();
  }
  /** rebuild the column instances if any column's state changed since the last call */
  sync(): boolean {
    const C = this.construction(); if (!C) return false;
    this.syncSite(C);
    const sig = C.columns.map(stateKey).join(',');
    if (sig === this.sig) return false;
    this.sig = sig; this.rebuilds++;
    for (const o of [...this.group.children]) { if (o === this.yard) continue; o.removeFromParent(); o.traverse(q => { const m = q as THREE.InstancedMesh; if (m.isInstancedMesh) { m.geometry.dispose(); m.dispose(); } }); }
    const groups = new Map<string, typeof C.columns>();
    for (const c of C.columns) { const k = stateKey(c); if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(c); }
    const SW = srow<any>('lod', 'switch'), o = this.ord, shaftH = o.height - o.baseH - o.capitalH;
    for (const [k, cols] of groups) {
      const c0 = cols[0], built = c0.drums / c0.drumsTotal, st = { fluted: c0.fluted >= 1, capital: c0.capitalSet };
      const top = o.baseH + shaftH * built + (st.capital ? o.capitalH : 0); // instance height for the LOD distance rule
      const at = new Float32Array(cols.length * 4); cols.forEach((c, i) => at.set([c.at[0], this.floor, -c.at[1], top], i * 4));
      const L0 = columnMeshesByMaterial(o, built, 0, st), L1 = columnMeshesByMaterial(o, built, 1, st);
      for (const { material: mat, mesh } of L0) {
        const lod = new InstancedLOD([toGeometry(mesh), toGeometry(L1.find(x => x.material === mat)!.mesh)], carvedMaterial(mat), at, SW.column, SW.hysteresis);
        lod.name = `${B}:construction:${k}`;
        lod.userData = { tier: 'C', src: 'RECON', building: B, placeholder: false,
          note: `Hall of 100 Columns under construction, ${cols.length} column(s): ${c0.drums}/${c0.drumsTotal} drums set, ${st.fluted ? 'fluted' : 'shaft plain (fluting follows erection, C)'}, ${st.capital ? 'capital set' : 'no capital yet'}; state from the simulation (src/people/construction.ts, D-022; rates C)` };
        lod.levels.forEach((im, j) => { im.name = `${lod.name}:lod${j}`; im.userData = lod.userData; });
        this.group.add(lod);
      }
    }
    return true;
  }
  /** the masons' yard and the scaffolds, from the simulation's yard counts and today's tasks */
  private syncSite(C: Construction) {
    const t = C.tasks[C.day] ?? C.tasks[C.tasks.length - 1];
    const MAXD = 36; // drums drawn per stack kind (the yard holds at most a few weeks of deliveries, C)
    const site = { waiting: Math.min(MAXD, C.yard.waiting), dressed: Math.min(MAXD, C.yard.dressed), capitalsReady: Math.min(2, C.yard.capitalsReady), capitalInWork: C.yard.capitalWork > 0,
      scaffolds: [...new Set([t?.raise, t?.flute].filter((i): i is number => i != null && i >= 0))] };
    const sig = JSON.stringify(site) + site.scaffolds.map(i => C.columns[i].drums).join(',');
    if (sig === this.yardSig) return; this.yardSig = sig; this.site = site;
    for (const o of [...this.yard.children]) { o.removeFromParent(); (o as THREE.Mesh).geometry?.dispose(); }
    const o = this.ord, r = o.shaftD / 2, dh = BUILD.drumH.v, y = this.floor, shaftH = o.height - o.baseH - o.capitalH;
    const yardPl = (placesJson as any).places.find((q: any) => q.id === 'worksite'), capPl = (placesJson as any).places.find((q: any) => q.id === 'worksite_capital');
    const [[ex0, ny0]] = yardPl.span as [number, number][]; const [cx, cy] = capPl.at as [number, number];
    const rough: THREE.BufferGeometry[] = [], dressed: THREE.BufferGeometry[] = [], timber: THREE.BufferGeometry[] = [];
    const cyl = (rad: number, h: number, e: number, n: number, seg = 20) => new THREE.CylinderGeometry(rad, rad, h, seg).translate(e, y + h / 2, -n);
    const pitch = 2 * r + 0.6, perRow = Math.max(1, Math.floor((cx - 6 - ex0) / pitch));
    // quarry-rough drums (a few cm of waste left on, C) in the S rows; dressed drums in the N rows, nearest the portico ramp
    for (let k = 0; k < site.waiting; k++) rough.push(cyl(r + 0.06, dh + 0.08, ex0 + 1.5 + (k % perRow) * pitch, ny0 + 1.6 + Math.floor(k / perRow) * pitch, 9));
    for (let k = 0; k < site.dressed; k++) dressed.push(cyl(r, dh, ex0 + 1.5 + (k % perRow) * pitch, ny0 + 1.6 + (2 + Math.floor(k / perRow)) * pitch));
    // capitals: finished ones beside the carving place, the block in work as a roughed-out box of the capital's size
    const cap = capitalAlone(o, 1);
    if (cap) {
      const g0 = toGeometry(cap); g0.computeBoundingBox(); const bb = g0.boundingBox!;
      for (let k = 0; k < site.capitalsReady; k++) dressed.push(g0.clone().translate(cx - 6 - k * 6, y, -cy));
      if (site.capitalInWork) rough.push(new THREE.BoxGeometry(bb.max.x - bb.min.x + 0.2, bb.max.y - bb.min.y + 0.15, bb.max.z - bb.min.z + 0.2).translate(cx, y + (bb.max.y - bb.min.y + 0.15) / 2, -cy));
      g0.dispose();
    }
    // scaffolds: four poles round the shaft, ledgers every 2 m, a plank deck at the working height (C)
    for (const i of site.scaffolds) {
      const c = C.columns[i], top = y + o.baseH + shaftH * (c.drums / c.drumsTotal), H = Math.max(3, top - y + 1.2), a = r + 0.7;
      for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) timber.push(new THREE.CylinderGeometry(0.07, 0.08, H, 6).translate(c.at[0] + sx * a, y + H / 2, -c.at[1] + sz * a));
      for (let h = 2; h < H; h += 2) for (const [sx, sz, len, rot] of [[0, -1, 2 * a, 0], [0, 1, 2 * a, 0], [-1, 0, 2 * a, 1], [1, 0, 2 * a, 1]] as const)
        timber.push(new THREE.BoxGeometry(rot ? 0.08 : len, 0.08, rot ? len : 0.08).translate(c.at[0] + sx * a, y + h, -c.at[1] + sz * a));
      const deck = Math.max(y + 1.5, top - 1.3); // the carvers stand a man's height below the shaft top
      for (const sz of [-1, 1]) timber.push(new THREE.BoxGeometry(2 * a + 0.3, 0.06, a - r).translate(c.at[0], deck, -c.at[1] + sz * (r + (a - r) / 2)));
    }
    const add = (gs: THREE.BufferGeometry[], mat: string, note: string) => {
      if (!gs.length) return;
      const g = mergeGeometries(gs.map(q => { const n = q.index ? q.toNonIndexed() : q; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; }))!;
      const m = new THREE.Mesh(g, surfaceMaterial(mat)); m.castShadow = m.receiveShadow = true; m.name = `hall100:site:${mat}`;
      m.userData = { tier: 'C', src: 'RECON', building: B, placeholder: false, note }; this.yard.add(m);
    };
    add(rough, 'rubble', `masons' yard: ${site.waiting} quarry-rough drum(s) waiting${site.capitalInWork ? ', a capital block being carved' : ''} (counts from the simulation, D-022; stacking and yard layout C)`);
    add(dressed, 'limestone', `masons' yard: ${site.dressed} dressed drum(s) ready to raise, ${site.capitalsReady} finished capital(s) (counts from the simulation; layout C)`);
    add(timber, 'scaffold', `timber scaffold(s) at column(s) ${site.scaffolds.map(i => i + 1).join(', ')} (receiving drums / being fluted); form C: no evidence of the method was retrieved (D-022)`);
  }
}
