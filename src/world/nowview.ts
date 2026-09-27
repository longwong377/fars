// The Now view at run time (brief §1.1, stretch, out-of-world, OFF by default; D-201): from any spot, switch the world to
// the ruin as it stands today and back again. The camera and the player are not touched: the view swaps what is drawn
// and what is solid around them.
//  - drawn: the Now parts (src/arch/now.ts: a transform of the same 467 parts) built with the same mesh builder, in
//    weathered surfaces (grey-dark patina on the limestone, paint gone). Every other child of the world root is hidden
//    (people, fires, doors, furnishings, the town, the plain, the 467 architecture and its construction site) except what
//    the caller keeps: the carved reliefs and inscriptions (their paint swapped for bare weathered stone), weather and birds;
//  - solid: the 467 colliders (architecture, town, doors, the people's capsules) are disabled and the Now colliders
//    enabled; the terrain and the kept bodies (the player) are untouched;
//  - lit: the roofs are gone (probes/roofs.ts ROOFS_PRESENT = 0: no light-probe interiors, rain reaches the old floors).
// Built on first use, so it costs nothing while off. Back again restores exactly what was there.
import * as THREE from 'three/webgpu';
import { positionWorld, normalWorld, mx_noise_float, mix, vec3, float, clamp, smoothstep, max } from 'three/tsl';
import type RAPIER from '@dimforge/rapier3d-compat';
import type { Part, Box, Material } from '../arch/parts';
import type { Physics } from '../player/physics';
import { buildMeshes, carvedMaterial, flatMaterial } from '../arch/meshes';
import { colossusFrontProjections } from '../arch/sculpt';
import { surfaceMaterial, paintedStoneMaterial, NOW_GROUND, type Layer } from '../render/materials';
import { setRoofsPresent } from '../render/probes/roofs';
import { setReliefMaterialOverride } from '../arch/reliefs';
import { nowParts, NOW_DATA, type NowResult } from '../arch/now';

const ALL: Material[] = ['limestone', 'limestone_dark', 'mudbrick', 'mudbrick_painted', 'plaster', 'plaster_red', 'timber', 'glazed', 'earth', 'scaffold', 'rubble', 'bronze', 'court_fill', 'terrace', 'steel'];
/** weathering of exposed limestone (C, RECOLLECTION of the site's look: grey stone darkened by a patchy grey-black crust and
 *  lichen, streaked where water runs down, darkest on up-facing surfaces; paint gone). Albedo mixed toward `dark` by a
 *  blotch-and-streak field; roughness raised to at least `rough` (the polish is gone except on the dark stone's faces). */
/** D-285 (session 11, the lead's GPU measurement of calib-24-now against photograph #24, display sRGB luma of the retaining
 *  wall's sunlit face and the plain in front of it): wall/ground 0.73 in the photo, 1.47 in the render; the wall's R/B 1.65 in
 *  the photo, 1.19 in the render (the ruin's stone reads warm brown-grey, the render's a neutral pale grey: "grey concrete").
 *  Inverting AgX (tests/lib/stone_cpu.ts agxGrey) at the render's levels, the stone's scene-linear radiance must fall to 0.22 of
 *  the render's (per channel 0.28 / 0.21 / 0.20 to reach the photo's hue at the photo's wall/ground ratio): the weathered stone's
 *  albedo, crust, dust and iron staining together, applied as one factor on the Now view's limestone (tier C: the photo is
 *  Lightroom-graded, its tone curve unknown; the ratio is exposure-free but not grade-free). The 467 stone (≈50 years from the
 *  quarry) keeps its pale grey (D-230, D-285) */
/** D-300 (session 11 render calib-24-now, display sRGB over the wall_sun region: luma 92.7 against the photo's 86.3, R/B 1.33
 *  against 1.74): the red kept and green and blue lowered by the display-to-linear ratios (1.15, 0.84, 0.74 of the D-285 factor) */
export const NOW_STONE_TINT: [number, number, number] = [0.327, 0.178, 0.15];
function patina(strength: number, dark: [number, number, number], rough: number, tint?: [number, number, number]) {
  return (L: Layer): Layer => {
    const p = positionWorld, n = normalWorld, n01 = (x: any) => mx_noise_float(x).mul(0.5).add(0.5);
    const blotch = n01(p.mul(0.23)).mul(0.6).add(n01(p.mul(1.7)).mul(0.4));
    const streak = n01(vec3(p.x.mul(3.1), p.y.mul(0.18), p.z.mul(3.1)));
    const up = smoothstep(0.4, 0.9, n.y);
    const m = clamp(smoothstep(0.35, 0.75, blotch.mul(0.55).add(streak.mul(0.45))).add(up.mul(0.25)), 0, 1).mul(strength);
    const alb = mix(L.alb.mul(0.86), vec3(dark[0], dark[1], dark[2]), m);
    return { ...L, alb: tint ? alb.mul(vec3(tint[0], tint[1], tint[2])) : alb, rough: max(L.rough, float(rough)) };
  };
}
const NOTE = 'Now view surface (C, D-201): RECOLLECTION of the weathered stone, NOT SEEN; patina procedural, paint gone';
let steelMat: THREE.MeshStandardNodeMaterial | null = null;
/** the Now surface for a part material; `arch`: merged part meshes (they carry the per-vertex part attributes), else carved
 *  members (columns, colossi) and reliefs */
export function nowMaterial(m: Material, arch: boolean): THREE.Material {
  const tag = (x: THREE.MeshStandardNodeMaterial) => { x.userData = { ...x.userData, tier: 'C', note: NOTE }; return x; };
  switch (m) {
    case 'limestone': case 'terrace': case 'rubble': // (D-232: the Terrace's walls keep their photographed joint layout in the ruin)
      return tag(surfaceMaterial(arch ? (m === 'terrace' ? 'terrace_now' : 'limestone') : 'limestone_carved', { arch, variant: 'now', modify: patina(0.85, [0.2, 0.195, 0.185], 0.7, NOW_STONE_TINT) }));
    case 'limestone_dark':
      return tag(surfaceMaterial('limestone_dark', { arch, variant: 'now', modify: patina(0.45, [0.1, 0.1, 0.1], 0.3) }));
    case 'steel':
      return (steelMat ??= Object.assign(new THREE.MeshStandardNodeMaterial({ color: new THREE.Color().setRGB(0.3, 0.3, 0.31, THREE.SRGBColorSpace), metalness: 0.6, roughness: 0.5 }),
        { userData: { tier: 'C', note: 'modern steel shelter (Now view, D-201): form not recalled, PLACEHOLDER' } }));
    default: return surfaceMaterial(m, { arch }); // earth mounds, the museum's render, modern mud brick, court fill: as in the 467 world
  }
}

export interface NowViewOptions {
  /** the world root: its children are hidden while the view is on, except `keep` and the view's own group */
  root: THREE.Object3D;
  /** the 467 parts (the transform's input) */
  parts: Part[];
  phys?: Physics;
  /** root children that stay (reliefs, inscriptions, weather, birds): their painted and fresh stone becomes weathered */
  keep?: THREE.Object3D[];
  /** descendants of kept objects to hide all the same (freestanding merlons, the foundation deposits removed in 1933) */
  hideWithin?: (THREE.Object3D | null | undefined)[];
  /** rigid bodies whose colliders stay enabled (the player's) */
  keepBodies?: () => (RAPIER.RigidBody | null | undefined)[];
}

export class NowView {
  active = false; group: THREE.Group | null = null; result: NowResult | null = null; buildMs = 0;
  /** called after every switch (world.ts mutes the 467 voices, music and effects) */
  onChange: (on: boolean) => void = () => {};
  private hidden: { o: THREE.Object3D; was: boolean }[] = [];
  private swapped: { o: THREE.Mesh; was: THREE.Material | THREE.Material[] }[] = [];
  private disabled: number[] = [];
  private own: number[] = [];
  private frame = 0;
  private swapMap = new Map<THREE.Material, THREE.Material>();
  private reliefNow: THREE.MeshStandardNodeMaterial | null = null;
  constructor(readonly o: NowViewOptions) {}

  /** the Now group, its colliders (disabled until the view is on) and the material map; once */
  build(): THREE.Group {
    if (this.group) return this.group;
    const t0 = performance.now();
    this.result = nowParts(this.o.parts);
    const g = new THREE.Group(); g.name = 'now-view'; g.visible = false;
    const phys = this.o.phys, before = new Set<number>();
    if (phys) phys.world.forEachCollider(c => { before.add(c.handle); });
    // one build per element, so each mesh carries its element's tier, source and note (the dev overlay reads them)
    const byEl = new Map<string, Part[]>();
    for (const p of this.result.parts) { const k = p.now ?? '?'; if (!byEl.has(k)) byEl.set(k, []); byEl.get(k)!.push(p); }
    // the colossi keep the fore-part they were carved with (measured against the 467 walls, as the 467 build does)
    const fr = colossusFrontProjections(this.o.parts.filter(p => p.type === 'box') as Box[]), colossusFront = fr.length ? fr.reduce((a, b) => a + b, 0) / fr.length : undefined;
    for (const [id, ps] of byEl) {
      const b = buildMeshes(ps, phys, { colossusFront }); b.group.name = `now:${id}`;
      const p0 = ps[0], ud = { tier: p0.tier, src: p0.src, placeholder: !!p0.placeholder, note: p0.note, building: p0.building, now: id };
      b.group.userData = ud;
      b.group.traverse(o => { if (o !== b.group) o.userData = { ...ud, building: o.userData?.building ?? p0.building }; });
      g.add(b.group);
    }
    // the surfaces: every material the builder can have given a part (arch, carved, flat) → its weathered Now surface
    const map = new Map<THREE.Material, THREE.Material>();
    for (const m of ALL) {
      const arch = surfaceMaterial(m, { arch: true }), carved = carvedMaterial(m), flat = flatMaterial(m);
      if (!map.has(arch)) map.set(arch, nowMaterial(m, true));
      if (!map.has(carved)) map.set(carved, nowMaterial(m, false));
      if (!map.has(flat)) map.set(flat, nowMaterial(m, true));
    }
    // D-300: the foot's proud blocks (kept, world.ts) in the ruin's weathered stone and block tone (#24)
    map.set(surfaceMaterial('terrace_foot'), (() => { const x = surfaceMaterial('terrace_now', { variant: 'now-foot', modify: patina(0.85, [0.2, 0.195, 0.185], 0.7, NOW_STONE_TINT) }); x.userData = { ...x.userData, tier: 'C', note: NOTE }; return x; })());
    this.swapMap = map;
    g.traverse(o => { const m = o as THREE.Mesh; if (!(m as any).isMesh) return; const r = map.get(m.material as THREE.Material); if (r) m.material = r; });
    if (phys) phys.world.forEachCollider(c => { if (!before.has(c.handle)) { this.own.push(c.handle); c.setEnabled(false); } });
    this.reliefNow = nowMaterial('limestone', false) as THREE.MeshStandardNodeMaterial;
    this.o.root.add(g);
    this.group = g; this.buildMs = performance.now() - t0;
    return g;
  }

  /** switch; returns whether anything changed */
  set(on: boolean): boolean {
    if (on === this.active) return false;
    if (on) this.enter(); else this.leave();
    this.active = on; this.onChange(on);
    return true;
  }
  toggle() { this.set(!this.active); return this.active; }

  private enter() {
    const g = this.build();
    const keep = new Set<THREE.Object3D>([g, ...(this.o.keep ?? [])]);
    for (const c of this.o.root.children) if (!keep.has(c)) { this.hidden.push({ o: c, was: c.visible }); c.visible = false; }
    for (const c of this.o.hideWithin ?? []) if (c) { this.hidden.push({ o: c, was: c.visible }); c.visible = false; }
    g.visible = true;
    // kept carving: the paint and the fresh stone become bare weathered stone (streamed relief LODs made meanwhile too)
    const painted = paintedStoneMaterial();
    for (const k of this.o.keep ?? []) k.traverse(o => {
      const m = o as THREE.Mesh; if (!(m as any).isMesh || Array.isArray(m.material)) return;
      const to = m.material === painted ? this.reliefNow! : this.swapMap.get(m.material as THREE.Material);
      if (to) { this.swapped.push({ o: m, was: m.material }); m.material = to; }
    });
    setReliefMaterialOverride(this.reliefNow);
    setRoofsPresent(false); NOW_GROUND.value = 1; // (D-300: the gravel forecourt)
    this.physics(true);
  }
  private leave() {
    for (const { o, was } of this.hidden.reverse()) o.visible = was; this.hidden = [];
    for (const { o, was } of this.swapped) o.material = was; this.swapped = [];
    // relief LODs streamed while the view was on carry the Now material: back to the paint
    const painted = paintedStoneMaterial();
    for (const k of this.o.keep ?? []) k.traverse(o => { const m = o as THREE.Mesh; if ((m as any).isMesh && m.material === this.reliefNow) m.material = painted; });
    setReliefMaterialOverride(null);
    setRoofsPresent(true); NOW_GROUND.value = 0;
    if (this.group) this.group.visible = false;
    this.physics(false);
  }
  /** 467 colliders off and the Now ones on (or back); scene queries see the change after the next physics step (the world
   *  steps every frame) */
  private physics(on: boolean) {
    const phys = this.o.phys; if (!phys) return;
    const W = phys.world;
    if (on) { this.disable467(); for (const h of this.own) W.getCollider(h)?.setEnabled(true); }
    else {
      for (const h of this.disabled) W.getCollider(h)?.setEnabled(true); this.disabled = [];
      for (const h of this.own) W.getCollider(h)?.setEnabled(false);
    }
  }
  private disable467() {
    const phys = this.o.phys!, R = phys.R, own = new Set(this.own), kept = new Set((this.o.keepBodies?.() ?? []).filter(Boolean).map(b => b!.handle));
    phys.world.forEachCollider(c => {
      if (own.has(c.handle) || !c.isEnabled()) return;
      if (c.shapeType() === R.ShapeType.HeightField) return; // the terrain
      const b = c.parent(); if (b && kept.has(b.handle)) return; // the player
      c.setEnabled(false); this.disabled.push(c.handle);
    });
  }
  /** per frame while on: colliders made meanwhile (the town streams its colliders) are disabled too, once a second or so */
  update() { if (this.active && this.o.phys && ++this.frame % 60 === 0) this.disable467(); }
  /** dev overlay line */
  summary(): string {
    if (!this.result) return 'Now view: off (not built)';
    const r = this.result, ph = r.parts.filter(p => p.placeholder).length;
    return `Now view (D-201, tier C, RECOLLECTION, NOT SEEN): ${this.active ? 'ON' : 'off'} · ${r.parts.length} parts from ${NOW_DATA.rules.length} rules + ${NOW_DATA.additions.length} additions · ${r.standing.length} standing columns · ${ph} placeholder parts · ${this.own.length} colliders · built in ${this.buildMs.toFixed(0)} ms`;
  }
}
