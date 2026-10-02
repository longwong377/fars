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
import { InstancedLOD, carvedMaterial, memberLOD, shaftLOD } from '../arch/meshes';
import { modelledParts, memberModel, columnBaked, bakedSurface, columnSeed, drumGeometry } from '../arch/column_models';
import { memberBox, memberMesh, shaftDrumH, SHAFT_TILE, type MemberName } from '../arch/sculpt';
import { columnMeshesByMaterial, toGeometry, srow, capitalAlone, protomeBox, protomeMesh, type Lod } from '../arch/sculpt';
import { model, fitLevel, bakedMaterial, registerSwap } from '../render/models';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { surfaceMaterial, DEBRIS } from '../render/materials';
import { BUILD } from '../people/construction';
import placesJson from '../data/people_places.json';
import { order } from '../arch/orders';
import { v } from '../arch/spec';
import type { Construction } from '../people/construction';
import { drumMark, marksMesh, type MarkAt } from '../arch/marks';

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
  /** D-570: the earth ramp to the column being raised (null: none today) and its colliders (stepped boxes, walkable) */
  ramp: { col: number; H: number; L: number; dir: number } | null = null; private rampCols: unknown[] = [];
  constructor(arch: THREE.Object3D, private construction: () => Construction | null, private phys: { addBox(c: { x: number; y: number; z: number }, h: { x: number; y: number; z: number }, rotY?: number): unknown; world: { removeCollider(c: any, wake: boolean): void } } | null = null) {
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
    // D-328: the members drawn by their Blender-built models, one draw each over every state (the bases of all the hall's
    // columns; the collars of those whose capital is set)
    const memberAt = new Map<MemberName, number[]>();
    for (const [k, cols] of groups) {
      // D-312: a set capital's double-bull protome is the Blender-built model (public/models/capital_protome.glb) as on the
      // finished halls (arch/meshes.ts), the capital drawn without its procedural protome; the procedural one when not loaded
      const c0 = cols[0], built = c0.drums / c0.drumsTotal, PM = c0.capitalSet && protomeBox(o) ? model('capital_protome') : null;
      const MP = modelledParts(o, built, { fluted: c0.fluted >= 1, capital: c0.capitalSet });
      const st = { fluted: c0.fluted >= 1, capital: c0.capitalSet, ...(PM ? { protome: false } : {}), omit: MP.omit };
      const top = o.baseH + shaftH * built + (st.capital ? o.capitalH : 0); // instance height for the LOD distance rule
      const at = new Float32Array(cols.length * 4); cols.forEach((c, i) => at.set([c.at[0], this.floor, -c.at[1], top], i * 4));
      const L0 = columnMeshesByMaterial(o, built, 0, st), L1 = columnMeshesByMaterial(o, built, 1, st);
      for (const m of MP.members) { if (!memberAt.has(m)) memberAt.set(m, []); memberAt.get(m)!.push(...at); }
      if (MP.shaft) {
        const r = shaftLOD(o, built, { fluted: st.fluted }, MP.shaft, B, at, cols.map(c => c.at as [number, number]), { tier: 'C', src: 'RECON', name: `${B}:construction:${k}:shaft`,
          note: `Hall of 100 Columns under construction, ${cols.length} column(s): ${c0.drums}/${c0.drumsTotal} drums set, ${st.fluted ? 'fluted' : 'shaft plain (fluting follows erection, C)'}: the game's own shaft with the baked map of a Blender-built tile (D-328: drum joints, the dressing${st.fluted ? ', the flute arrises' : ''}); state from the simulation (src/people/construction.ts, D-022)` });
        this.group.add(r.lod);
      }
      for (const { material: mat, mesh } of L0) {
        const lod = new InstancedLOD([toGeometry(mesh), toGeometry(L1.find(x => x.material === mat)!.mesh)], carvedMaterial(mat), at, SW.column, SW.hysteresis);
        lod.name = `${B}:construction:${k}`;
        lod.userData = { tier: 'C', src: 'RECON', building: B, placeholder: false,
          note: `Hall of 100 Columns under construction, ${cols.length} column(s): ${c0.drums}/${c0.drumsTotal} drums set, ${st.fluted ? 'fluted' : 'shaft plain (fluting follows erection, C)'}, ${st.capital ? 'capital set' : 'no capital yet'}; state from the simulation (src/people/construction.ts, D-022; rates C)` };
        lod.levels.forEach((im, j) => { im.name = `${lod.name}:lod${j}`; im.userData = lod.userData; });
        this.group.add(lod);
      }
      if (PM) {
        const [lo, hi] = protomeBox(o)!, surf = 'limestone_carved';
        const mats = PM.maps.map((map, j) => bakedMaterial(surf, map, `${PM.id}:${j}`));
        const lod = new InstancedLOD(PM.lods.map(g => fitLevel(g, lo, hi)), mats[0], at, SW.column, SW.hysteresis);
        lod.name = `${B}:construction:${k}:protome`;
        lod.userData = { tier: 'C', src: 'RECON;PHOTO', building: B, placeholder: false, model: PM.id,
          note: `double-bull protome of the capitals set on ${cols.length} column(s) under construction: the Blender-built model (D-305/D-306, proportions re-measured on the photographed capitals D-312, form C)` };
        lod.levels.forEach((im, j) => { im.material = mats[j] ?? mats[0]; im.name = `${lod.name}:lod${j}`; im.userData = lod.userData;
          const pm = protomeMesh(o, j as Lod); if (pm) registerSwap(im, [toGeometry(pm), carvedMaterial('limestone')]); });
        this.group.add(lod);
      }
    }
    for (const [m, a] of memberAt) { const r = memberLOD(o, m, B, new Float32Array(a), { tier: 'C', src: 'RECON', name: `${B}:construction:${m}`,
      note: `${m === 'collar' ? 'collars of the capitals set' : 'bases'} of the Hall of 100 Columns under construction (${a.length / 4} columns): the Blender-built member (D-328), form C` }); if (r) this.group.add(r.lod); }
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
    const [[ex0, ny0], [ex1, ny1]] = yardPl.span as [number, number][]; const [cx, cy] = capPl.at as [number, number];
    // the dressing waste on the yard's ground (D-188): the whole yard while it holds work (drums dressed there since the
    // season began), and round the capital block while it is carved (C)
    DEBRIS.rect.value.set(ex0, -ny1, ex1, -ny0); DEBRIS.amount.value = site.waiting + site.dressed + site.capitalsReady > 0 || site.capitalInWork ? 1 : 0.5;
    DEBRIS.work.value.set(cx, -cy, 3.5, site.capitalInWork ? 1 : 0);
    const rough: THREE.BufferGeometry[] = [], dressed: THREE.BufferGeometry[] = [], timber: THREE.BufferGeometry[] = [];
    const cyl = (rad: number, h: number, e: number, n: number, seg = 20) => new THREE.CylinderGeometry(rad, rad, h, seg).translate(e, y + h / 2, -n);
    const pitch = 2 * r + 0.6, perRow = Math.max(1, Math.floor((cx - 6 - ex0) / pitch));
    // quarry-rough drums (a few cm of waste left on, C) in the S rows; dressed drums in the N rows, nearest the portico ramp
    for (let k = 0; k < site.waiting; k++) rough.push(cyl(r + 0.06, dh + 0.08, ex0 + 1.5 + (k % perRow) * pitch, ny0 + 1.6 + Math.floor(k / perRow) * pitch, 9));
    // each dressed drum carries its team's mark on the upper bedding face (D-212: masons' marks B, the shapes of Pasargadae
    // and the Persepolis reliefs; on the bedding face, hidden once the next drum is set, C)
    const marks: MarkAt[] = [];
    // D-328: the dressed drums take the drum tile of the unfluted shafts (column_shaft_drums.glb) when it is loaded
    const DM = model('column_shaft_drums'), drums: THREE.BufferGeometry[] = [];
    for (let k = 0; k < site.dressed; k++) { const e = ex0 + 1.5 + (k % perRow) * pitch, n = ny0 + 1.6 + (2 + Math.floor(k / perRow)) * pitch;
      if (DM) drums.push(drumGeometry(r, dh, 24, [e, y, -n], columnSeed(e, n, 48), SHAFT_TILE.drums * shaftDrumH(o))); else dressed.push(cyl(r, dh, e, n)); marks.push(drumMark(new THREE.Vector3(e, y + dh, -n), r, k)); }
    // capitals: finished ones beside the carving place, the block in work as a roughed-out box of the capital's size
    // D-312: the finished capitals' protomes are the Blender-built model (as on the columns), the rest of the capital procedural
    const YM = protomeBox(o) ? model('capital_protome') : null, CM = memberModel('collar'), cap = capitalAlone(o, 1, !YM, CM ? { collar: true } : {}), capFull = capitalAlone(o, 1);
    if (cap && capFull) {
      const gf = toGeometry(capFull); gf.computeBoundingBox(); const bb = gf.boundingBox!; gf.dispose();
      const g0 = toGeometry(cap), y0c = o.height - o.capitalH;
      for (let k = 0; k < site.capitalsReady; k++) dressed.push(g0.clone().translate(cx - 6 - k * 6, y, -cy));
      if (YM && site.capitalsReady > 0) {
        const [lo, hi] = protomeBox(o)!, pg = fitLevel(YM.lods[0], lo, hi), mat = bakedMaterial('limestone_carved', YM.maps[0], `${YM.id}:0`);
        const im = new THREE.InstancedMesh(pg, mat, site.capitalsReady), M4 = new THREE.Matrix4();
        for (let k = 0; k < site.capitalsReady; k++) im.setMatrixAt(k, M4.makeTranslation(cx - 6 - k * 6, y - y0c, -cy));
        im.castShadow = im.receiveShadow = true; im.name = 'hall100:site:protome';
        im.userData = { tier: 'C', src: 'RECON;PHOTO', building: B, placeholder: false, model: YM.id, note: `masons' yard: the protome of ${site.capitalsReady} finished capital(s), the Blender-built model (D-305/D-306/D-312)` };
        this.yard.add(im);
      }
      if (CM && site.capitalsReady > 0) { // D-328: their collars, the Blender-built member
        const [lo, hi] = memberBox(o, 'collar')!, pg = fitLevel(CM.lods[0], lo, hi), mat = columnBaked(`${CM.id}:0:limestone_carved`, bakedSurface('limestone_carved', `${CM.id}:0`), CM.maps[0], false);
        const im = new THREE.InstancedMesh(pg, mat, site.capitalsReady), M4 = new THREE.Matrix4();
        for (let k = 0; k < site.capitalsReady; k++) im.setMatrixAt(k, M4.makeTranslation(cx - 6 - k * 6, y - y0c, -cy));
        im.castShadow = im.receiveShadow = true; im.name = 'hall100:site:collar';
        im.userData = { tier: 'C', src: 'RECON;PHOTO', building: B, placeholder: false, model: CM.id, note: `masons' yard: the collars of ${site.capitalsReady} finished capital(s), the Blender-built member (D-328)` };
        registerSwap(im, [toGeometry(memberMesh(o, 'collar', 0)!), carvedMaterial('limestone')]);
        this.yard.add(im);
      }
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
    // D-570: the earth ramp the gang hauls the drums up (BUILD.raiseDays: "to haul one drum up the earth ramp and set it"; the
    // sim's gangs "hauling a drum up the ramp to column N", "building up the earth ramp"). How the drums went up is not known
    // (D-022, Q-710): an earth ramp between mud-brick kerbs, 1 in 3.5, along the aisle beside the column's row (clear of its
    // neighbours), from the hall's floor toward the side with room, up to the scaffold's deck or as far as the hall allows,
    // a plank bridge from its head to the deck, timber sleepers across its slope and a drum on its way up; walkable (C)
    const earth: THREE.BufferGeometry[] = []; for (const k of this.rampCols) this.phys?.world.removeCollider(k, false); this.rampCols = []; this.ramp = null;
    { const ri = t?.raise; const c = ri != null && ri >= 0 ? C.columns[ri] : null;
      if (c && c.ring === 'hall' && c.drums < c.drumsTotal) {
        const top = y + o.baseH + shaftH * (c.drums / c.drumsTotal), deck = Math.max(y + 1.5, top - 1.3), want = deck - y, hall = C.columns.filter(q => q.ring === 'hall').map(q => q.at[1]);
        const nMax = Math.max(...hall) + 3, nMin = Math.min(...hall) - 3, roomN = nMax - c.at[1], roomS = c.at[1] - nMin, dir = roomN >= roomS ? 1 : -1, room = Math.max(roomN, roomS);
        const L = Math.min(want * 3.5, room), H = L / 3.5, W = 2.4, side = 3.0, e0 = c.at[0] + side, n1 = c.at[1], n0 = n1 + dir * L;
        if (H > 0.4) { this.ramp = { col: c.i, H, L, dir };
          // the body: the slope, the two kerbed sides and the head wall (world: x = e, z = -n)
          const P = (e: number, n: number, h: number) => [e, y + h, -n], q = (a: number[], b: number[], cc: number[], d: number[], out: number[]) => out.push(...a, ...b, ...cc, ...a, ...cc, ...d);
          const pos: number[] = [], A = P(e0 - W / 2, n0, 0), B = P(e0 + W / 2, n0, 0), Ct = P(e0 + W / 2, n1, H), D = P(e0 - W / 2, n1, H), Cb = P(e0 + W / 2, n1, 0), Db = P(e0 - W / 2, n1, 0);
          q(A, B, Ct, D, pos); pos.push(...B, ...Cb, ...Ct, ...A, ...D, ...Db); q(Db, D, Ct, Cb, pos);
          const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
          // (winding by the slope's direction: as written the faces look out when it runs south; flipped when it runs north)
          if (dir > 0) { const a = g.getAttribute('position').array as Float32Array; for (let i = 0; i < a.length; i += 9) for (let k = 0; k < 3; k++) { const t0 = a[i + 3 + k]; a[i + 3 + k] = a[i + 6 + k]; a[i + 6 + k] = t0; } g.computeVertexNormals(); }
          earth.push(g);
          // the sleepers across the slope every 1.1 m, the plank bridge from the head to the deck, a drum part-way up on rollers
          for (let s = 0.6; s < L - 0.3; s += 1.1) { const h = H * (1 - s / L), ang = Math.atan2(H, L) * dir; timber.push(new THREE.BoxGeometry(W + 0.2, 0.1, 0.16).rotateX(ang).translate(e0, y + h + 0.05, -(n1 + dir * s))); }
          const a = r + 0.7, bx = (c.at[0] + a + e0 - W / 2) / 2, bw = e0 - W / 2 - (c.at[0] + a) + 0.4; if (bw > 0) timber.push(new THREE.BoxGeometry(bw, 0.08, 1.4).translate(bx, y + H + 0.04, -n1));
          const sd = L * 0.55, hd = H * (1 - sd / L); rough.push(new THREE.CylinderGeometry(r, r, dh, 18).rotateZ(Math.PI / 2).translate(e0, y + hd + r + 0.12, -(n1 + dir * sd)));
          for (const k of [-0.6, 0.6]) timber.push(new THREE.CylinderGeometry(0.09, 0.09, W + 0.3, 6).rotateZ(Math.PI / 2).translate(e0, y + H * (1 - (sd + k) / L) + 0.09, -(n1 + dir * (sd + k))));
          // colliders: steps of 0.2 m up the slope (the player walks it as a stair), and the sides
          if (this.phys) { const N = Math.ceil(H / 0.2), ds = L / N; for (let j = 0; j < N; j++) { const hTop = H * (j + 1) / N, sMid = L - (j + 0.5) * ds;
            this.rampCols.push(this.phys.addBox({ x: e0, y: y + hTop / 2, z: -(n1 + dir * sMid) }, { x: W / 2, y: hTop / 2, z: ds / 2 })); } }
        } } }
    const add = (gs: THREE.BufferGeometry[], mat: string, note: string) => {
      if (!gs.length) return;
      const g = mergeGeometries(gs.map(q => { const n = q.index ? q.toNonIndexed() : q; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; }))!;
      const m = new THREE.Mesh(g, surfaceMaterial(mat)); m.castShadow = m.receiveShadow = true; m.name = `hall100:site:${mat}`;
      m.userData = { tier: 'C', src: 'RECON', building: B, placeholder: false, note }; this.yard.add(m);
    };
    add(rough, 'stone_rough', `masons' yard: ${site.waiting} quarry-rough drum(s) waiting${site.capitalInWork ? ', a capital block being carved' : ''} (counts from the simulation, D-022; stacking and yard layout C)`);
    if (DM && drums.length) {
      const g = mergeGeometries(drums)!, mat = columnBaked(`${DM.id}:0:limestone_carved`, bakedSurface('limestone_carved', `${DM.id}:0`), DM.maps[0], true);
      const m = new THREE.Mesh(g, mat); m.castShadow = m.receiveShadow = true; m.name = 'hall100:site:drums';
      m.userData = { tier: 'C', src: 'RECON', building: B, placeholder: false, model: DM.id, note: `masons' yard: ${drums.length} dressed drum(s) ready to raise, with the baked map of the Blender-built drum tile (D-328; counts from the simulation, layout C)` };
      this.yard.add(m);
    }
    add(dressed, 'limestone', `masons' yard: ${site.dressed} dressed drum(s) ready to raise, ${site.capitalsReady} finished capital(s) (counts from the simulation; layout C)`);
    add(timber, 'scaffold', `timber scaffold(s) at column(s) ${site.scaffolds.map(i => i + 1).join(', ')} (receiving drums / being fluted); form C: no evidence of the method was retrieved (D-022)`);
    add(earth, 'earth', `the earth ramp to column ${this.ramp ? this.ramp.col + 1 : '-'} (${this.ramp ? this.ramp.H.toFixed(1) : 0} m high, ${this.ramp ? this.ramp.L.toFixed(0) : 0} m long): BUILD.raiseDays "up the earth ramp"; its form and place C (D-570, D-022)`);
    const mk = marksMesh(marks, 'limestone', v<any>('global', 'r_masons_marks').drum.lift, 'hall100:site:marks', 'masons\' marks on the dressed drums\' upper bedding faces (D-212; marks B, shapes B elsewhere, this placement C)');
    if (mk) { mk.userData = { ...mk.userData, building: B, placeholder: false }; this.yard.add(mk); }
  }
}
