// Garden and orchard trees of the settlement (Phase 6), drawn by the shared tree kit (src/world/trees, D-122): the
// same generated species models, leaf atlas, seasonal state and impostors as the trees of the plain. Species from
// settlement.json garden_planting through the town plan (plane, cypress, pomegranate, olive: Maharlou pollen with
// Achaemenid arboriculture, B; fig, apple, pear, mulberry: PF fruits, B; vine: B species); forms and sizes from
// src/data/trees.json (C), scaled by the plan's size factor; placement C (plan.ts). Within the near radius every tree
// is 3-D (LOD0 close, LOD1 beyond, shadows within SHADOW_R); beyond, one impostor quad each.
import * as THREE from 'three/webgpu';
import { uniform } from 'three/tsl';
import type { TreeSpot } from './plan';
import { DOY_AT_DAY0 } from '../season';
import { hashString } from '../../core/rng';
import { TreeKit, NearTreeSet, ImpostorSet, treeInst, speciesSize, impostorPx, type TreeInst } from '../trees/render';
import { SPECIES_IDS } from '../trees/species';

const RADII: Record<string, { near: number; lod0: number }> = { test: { near: 120, lod0: 30 }, low: { near: 140, lod0: 35 }, medium: { near: 160, lod0: 40 }, high: { near: 180, lod0: 50 }, ultra: { near: 220, lod0: 70 } };
const SHADOW_R = 120, CAP0 = 250, CAP1S = 400, CAP1N = 900;

export class TreeField {
  readonly group = new THREE.Group();
  private kit: TreeKit; private all: { r: TreeInst; x: number; z: number }[] = [];
  private lod0: NearTreeSet; private lod1s: NearTreeSet; private lod1n: NearTreeSet; private imp: ImpostorSet;
  private nearC = uniform(new THREE.Vector3(1e9, 0, 1e9)); private nearR = uniform(0);
  private last = new THREE.Vector3(1e9, 0, 0); private R: { near: number; lod0: number };
  constructor(spots: TreeSpot[], H: (e: number, n: number) => number, quality = 'high') {
    this.group.name = 'settlement:trees';
    this.group.userData = { tier: 'C', src: 'SAEIDI2021;IR-FOODAG;BOTANY-GEN', note: 'garden and orchard trees: species B (pollen, PF fruits); forms and sizes C (src/data/trees.json, generated models); placement C' };
    this.kit = TreeKit.get({ impostorPx: impostorPx(quality) }); this.R = RADII[quality] ?? RADII.high; this.kit.lod0R.value = this.R.lod0;
    for (const s of spots) {
      const sp = SPECIES_IDS.includes(s.species) ? s.species : 'pomegranate', hs = hashString(s.c.join(','));
      const sz = speciesSize(sp, (hs % 1000) / 1000, ((hs >>> 10) % 1000) / 1000);
      this.all.push({ r: treeInst(sp, s.c[0], H(s.c[0], s.c[1]), -s.c[1], sz.h * s.size, sz.w * s.size, hs, `town ${s.row} (${s.feature})`), x: s.c[0], z: -s.c[1] });
    }
    this.lod0 = new NearTreeSet(this.kit, 0, CAP0, true, 'settlement:trees'); this.lod1s = new NearTreeSet(this.kit, 1, CAP1S, true, 'settlement:trees');
    this.lod1n = new NearTreeSet(this.kit, 1, CAP1N, false, 'settlement:trees-noshadow');
    this.imp = new ImpostorSet(this.kit, this.all.length, { c: this.nearC, r: this.nearR }, 20000, 'settlement:trees:far');
    this.imp.set(this.all.map(q => q.r));
    for (const m of [this.lod0.wood, this.lod0.leaves, this.lod1s.wood, this.lod1s.leaves, this.lod1n.wood, this.lod1n.leaves, this.imp.mesh]) this.group.add(m);
  }
  /** the 3-D set around the camera, nearest first; impostors take over at the first tree left out */
  private assign(cam: THREE.Vector3) {
    const R = this.R.near, list: { r: TreeInst; d: number }[] = [];
    for (const q of this.all) { if (Math.abs(q.x - cam.x) > R || Math.abs(q.z - cam.z) > R) continue; const d = Math.hypot(q.x - cam.x, q.z - cam.z); if (d < R) list.push({ r: q.r, d }); }
    list.sort((a, b) => a.d - b.d);
    const a: TreeInst[] = [], b: TreeInst[] = [], c: TreeInst[] = []; let n = 0;
    for (const q of list) { if (q.d < this.R.lod0 && a.length < CAP0) a.push(q.r); else if (q.d < SHADOW_R && b.length < CAP1S) b.push(q.r); else if (c.length < CAP1N) c.push(q.r); else break; n++; }
    this.lod0.set(a); this.lod1s.set(b); this.lod1n.set(c);
    this.nearC.value.set(cam.x, 0, cam.z); this.nearR.value = n < list.length ? list[n].d : R;
  }
  update(camera: THREE.Camera, dayIndex: number, windMs: number) {
    this.kit.setDay((((DOY_AT_DAY0 + dayIndex) % 365) + 365) % 365); this.kit.wind.value = windMs;
    const p = camera.position; if (p.distanceToSquared(this.last) > 100) { this.last.copy(p); this.assign(p); }
  }
  stats() { const near = this.lod0.count() + this.lod1s.count() + this.lod1n.count(); return { total: this.all.length, near, lod0: this.lod0.count(), nearR: Math.round(this.nearR.value), leafDay: this.kit.foliage.doy }; }
}
