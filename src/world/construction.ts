// The Hall of a Hundred Columns follows the simulation's construction state (brief §9.5 "construction advances week by
// week (courses laid, columns raised, reliefs carved)"; Phase 5 gate; D-022). The architecture draws the hall at its
// day-0 state (src/arch/terrace.ts); this view replaces those column instances with ones grouped by each column's state
// in src/people/construction.ts: drums set (the shaft rises drum by drum), fluting done (shafts are fluted after erection,
// C) and capital set. It rebuilds only when that state changes (a few times a week), so a frame costs nothing extra.
// Colliders keep their day-0 height: the player cannot climb a shaft stump (the bell base alone is above the step-up), so
// the difference is not walkable either way (C, noted). Walls, relief carving and the yard stay at their day-0 geometry.
import * as THREE from 'three/webgpu';
import { InstancedLOD, carvedMaterial } from '../arch/meshes';
import { columnMeshesByMaterial, toGeometry, srow } from '../arch/sculpt';
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
  constructor(arch: THREE.Object3D, private construction: () => Construction | null) {
    this.group.name = 'hall100:construction';
    // the architecture's static hall columns give way to this view
    const old: THREE.Object3D[] = []; arch.traverse(o => { if (o.name.startsWith(`${B}:columns`) && !o.name.includes(':lod')) old.push(o); });
    for (const o of old) o.removeFromParent();
    this.sync();
  }
  /** rebuild the column instances if any column's state changed since the last call */
  sync(): boolean {
    const C = this.construction(); if (!C) return false;
    const sig = C.columns.map(stateKey).join(',');
    if (sig === this.sig) return false;
    this.sig = sig; this.rebuilds++;
    for (const o of [...this.group.children]) { o.removeFromParent(); o.traverse(q => { const m = q as THREE.InstancedMesh; if (m.isInstancedMesh) { m.geometry.dispose(); m.dispose(); } }); }
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
}
