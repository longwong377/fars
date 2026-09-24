// The Now view (brief §1.1 stretch, out-of-world; D-201): the ruin as it stands today as a transform of the same parts.
// What is tested here is the transform against its own data file (src/data/now_view.json) and the switch there and back.
// Nothing here checks the Now view against the real site: every element is RECOLLECTION, NOT SEEN (tier C).
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../src/arch/terrace';
import { buildMeshes } from '../src/arch/meshes';
import type { Part, Box, Column } from '../src/arch/parts';
import { pointInPoly } from '../src/arch/parts';
import { nowParts, NOW_DATA, AT_TOL, insideBox, nowFloorAt, elementOf, NOW_CAPTION } from '../src/arch/now';
import { NowView } from '../src/world/nowview';
import { Physics } from '../src/player/physics';
import { Player } from '../src/player/player';
import { ROOFS_PRESENT, roofsPresent, roofedAt } from '../src/render/probes/roofs';
import { paintedStoneMaterial } from '../src/render/materials';
import { installProbeLight } from '../src/render/probes/runtime';
import { memberMaterials } from '../src/arch/sculpt';
import { DEFAULT_SETTINGS, DEFAULT_KEYS } from '../src/core/settings';
import sources from '../src/data/sources.json';

const { parts } = buildTerrace();
const N = nowParts(parts);
const elements = [...NOW_DATA.rules, ...NOW_DATA.additions];

describe('Now view data (src/data/now_view.json)', () => {
  it('every element has a tier, a confidence, known sources and a note that says what it rests on', () => {
    expect(NOW_DATA._meta.tier).toBe('C');
    expect(NOW_DATA._meta.basis).toMatch(/RECOLLECTION, NOT SEEN/);
    const ids = new Set<string>();
    for (const e of elements) {
      expect(ids.has(e.id), `duplicate id ${e.id}`).toBe(false); ids.add(e.id);
      expect(e.tier, e.id).toBe('C'); // nothing in the Now view is better than a reconstruction (D-201)
      expect(e.confidence, e.id).toBeTruthy(); expect(e.note.length, e.id).toBeGreaterThan(20);
      for (const k of e.src.split(';')) expect(Object.keys(sources), `${e.id}: src ${k}`).toContain(k);
      // recollection is said so; the items placed from the supplied plan name it
      if (e.src.startsWith('REF-DIAGRAM')) expect(e.note, e.id).toMatch(/persepolis_diagram\.jpg/);
      else expect(e.note, e.id).toMatch(/RECOLLECTION, NOT SEEN, verify/);
      if (e.src.includes('REF-DIAGRAM')) expect(e.note, e.id).toMatch(/persepolis_diagram\.jpg|REF-DIAGRAM/);
      if (e.placeholder) expect(e.note, e.id).toMatch(/PLACEHOLDER/);
    }
    expect(NOW_CAPTION).toMatch(/tier C/); expect(NOW_CAPTION).toMatch(/not 467 BCE/);
  });
  it('every 467 part has a stated fate, every rule matches something, every addition makes something', () => {
    expect(N.unmatched.map(p => `${p.building} ${p.kind}`)).toEqual([]);
    for (const r of NOW_DATA.rules) expect(N.byElement[r.id].matched, r.id).toBeGreaterThan(0);
    for (const a of NOW_DATA.additions) expect(N.byElement[a.id].produced, a.id).toBeGreaterThan(0);
    const produced = Object.values(N.byElement).reduce((s, e) => s + e.produced, 0);
    expect(produced).toBe(N.parts.length);
    console.log(`Now view: ${parts.length} parts of 467 → ${N.parts.length} (${N.parts.filter(p => p.placeholder).length} placeholder)`);
  });
});

describe('Now view: what stands', () => {
  it('the standing columns are exactly the ones listed in the data file (13 of the Apadana\'s 72, 2 of the Gate\'s 4)', () => {
    const listed = NOW_DATA.rules.filter(r => r.state === 'shaft' || r.state === 'shaft_fragment').flatMap(r => r.select.at!.map(at => ({ at, rule: r.id, building: r.select.building as string, fragment: r.state === 'shaft_fragment' })));
    const key = (b: string, c: [number, number]) => `${b}@${c[0].toFixed(1)},${c[1].toFixed(1)}`;
    // every listed position is a column of the 467 build
    for (const l of listed) expect(parts.some(p => p.type === 'column' && p.building === l.building && Math.hypot(p.c[0] - l.at[0], p.c[1] - l.at[1]) <= AT_TOL), key(l.building, l.at)).toBe(true);
    const cols467 = parts.filter(p => p.type === 'column') as Column[];
    expect(N.standing.map(s => key(s.building, s.c)).sort()).toEqual(listed.map(l => key(l.building, cols467.find(p => Math.hypot(p.c[0] - l.at[0], p.c[1] - l.at[1]) <= AT_TOL)!.c)).sort());
    expect(N.standing.filter(s => s.building === 'apadana').length).toBe(13);
    expect(N.standing.filter(s => s.building === 'gate_nations').length).toBe(2);
    // a shaft stands to its capital's seat, with no capital; a fragment sits on it
    const cols = N.parts.filter(p => p.type === 'column') as Column[];
    for (const s of N.standing) {
      const c = cols.find(p => p.c === s.c)!; expect(c.order.capital).toBe('none'); expect(c.built).toBe(1);
      const was = parts.find(p => p.type === 'column' && p.c === s.c) as Column;
      expect(c.order.height).toBeCloseTo(was.order.height - was.order.capitalH, 6);
      const frag = N.parts.filter(p => p.kind === 'capital_fragment' && p.type === 'box' && Math.hypot(p.c[0] - s.c[0], p.c[1] - s.c[1]) < 1e-6) as Box[];
      expect(frag.length, key(s.building, s.c)).toBe(s.fragment ? 1 : 0);
      if (frag[0]) expect(frag[0].y0).toBeCloseTo(c.y0 + c.order.height, 6);
    }
    // every other column: its base only, except the museum hall's rebuilt ones
    for (const c of cols) if (!N.standing.some(s => s.c === c.c)) {
      if (c.now === 'museum_hall_columns') { expect(elementOf(c)!.modern).toBe(true); continue; }
      expect(c.built, `${c.building} ${c.c}`).toBe(0);
    }
    // the same columns, in the same places: the transform removes none and adds none
    expect(cols.length).toBe(parts.filter(p => p.type === 'column').length);
  });
  it('no roofs, timber, glazed brick or plaster floors of 467; mud brick only as low stubs; modern things only where flagged modern', () => {
    for (const p of N.parts) {
      expect(['roof', 'door_leaf', 'floor_finish', 'bench', 'frieze'], `${p.now}: ${p.kind}`).not.toContain(p.kind);
      // what is drawn: a base-only column draws its base member (the Treasury's timber order stands on stone bases)
      const drawn = p.type === 'column' && p.built === 0 ? memberMaterials(p.order).base : p.material;
      expect(['timber', 'glazed', 'plaster_red', 'mudbrick_painted'], `${p.now}: ${drawn}`).not.toContain(drawn);
      expect(p.now, `${p.building} ${p.kind}`).toBeTruthy(); expect(p.tier).toBe('C');
      const e = elementOf(p)!; expect(e, p.now).toBeTruthy();
      if (p.kind.startsWith('modern_') || p.material === 'steel' || p.material === 'plaster') expect(e.modern, `${p.now}: ${p.kind} ${p.material}`).toBe(true);
      if ((p.material === 'mudbrick' || p.material === 'earth') && p.type === 'box' && p.kind === 'stump') expect(p.y1 - p.y0, p.now).toBeLessThanOrEqual(e.params.height + e.params.jitter + 1e-9);
      if (p.material === 'mudbrick') expect(p.kind).toBe('stump');
    }
    // the only roofs are the modern ones: the museum hall's and the stair shelter
    const roofs = N.parts.filter(p => /roof|shelter/.test(p.kind));
    expect([...new Set(roofs.map(p => p.now))].sort()).toEqual(['apadana_e_stair_shelter', 'museum_hall_roof']);
  });
  it('a visitor who could stand somewhere in 467 stands on the same floor there in the Now view, with nothing new around them', () => {
    const solid = (ps: Part[], x: number, y: number, a: number, b: number, skip: (p: Part) => boolean) => ps.some(p => {
      if (skip(p) || p.solid === false) return false;
      if (p.type === 'column') { const h = p.order.baseH + (p.order.height - p.order.baseH) * p.built; return Math.hypot(x - p.c[0], y - p.c[1]) < p.order.baseW / 2 && p.y0 < b && p.y0 + h > a; }
      const inPlan = p.type === 'prism' ? pointInPoly(x, y, p.polygon) : insideBox(p, x, y, 0);
      return inPlan && p.y0 < b && p.y1 > a;
    });
    // parts bucketed on a 6 m grid by plan bounds (the scan is 17,000 points)
    const bucket = (ps: Part[]) => { const m = new Map<string, Part[]>(), C = 6;
      for (const p of ps) {
        const [x0, x1, y0, y1] = p.type === 'column' ? [p.c[0] - p.order.baseW, p.c[0] + p.order.baseW, p.c[1] - p.order.baseW, p.c[1] + p.order.baseW]
          : p.type === 'prism' ? [Math.min(...p.polygon.map(q => q[0])), Math.max(...p.polygon.map(q => q[0])), Math.min(...p.polygon.map(q => q[1])), Math.max(...p.polygon.map(q => q[1]))]
          : (r => [p.c[0] - r, p.c[0] + r, p.c[1] - r, p.c[1] + r])(Math.hypot(p.size[0], p.size[1]) / 2);
        for (let i = Math.floor(x0 / C); i <= Math.floor(x1 / C); i++) for (let j = Math.floor(y0 / C); j <= Math.floor(y1 / C); j++) { const k = `${i},${j}`; if (!m.has(k)) m.set(k, []); m.get(k)!.push(p); }
      }
      return (x: number, y: number) => m.get(`${Math.floor(x / 6)},${Math.floor(y / 6)}`) ?? [];
    };
    const B467 = bucket(parts), BNow = bucket(N.parts);
    let checked = 0, opened = 0, worst = 0, placed = 0; const bad: string[] = [];
    const added = new Set(NOW_DATA.additions.map(a => a.id));
    for (let x = -60; x <= 260; x += 3) for (let y = -235; y <= 230; y += 3) {
      const P467 = B467(x, y), PNow = BNow(x, y);
      const f = nowFloorAt(P467, x, y); if (!Number.isFinite(f)) continue;
      const clear467 = !solid(P467, x, y, f + 0.05, f + 1.8, p => p.type === 'box' && !!p.door);
      // the additions (the Gate's piers, the stair shelter, the fallen capitals and the basin) are placed on purpose: counted, not failed
      const fN = nowFloorAt(PNow, x, y), clearNow = !solid(PNow, x, y, fN + 0.05, fN + 1.8, p => !!elementOf(p)?.modern || added.has(p.now!));
      if (clear467 && solid(PNow, x, y, fN + 0.05, fN + 1.8, p => !added.has(p.now!))) placed++;
      if (!clear467) { if (clearNow && Math.abs(fN - f) < 0.02) opened++; continue; }
      checked++; worst = Math.max(worst, Math.abs(fN - f));
      if (Math.abs(fN - f) > 0.02 || !clearNow) bad.push(`(${x}, ${y}) floor ${f.toFixed(2)} → ${fN.toFixed(2)}${clearNow ? '' : ', obstructed'}`);
    }
    console.log(`floor check: ${checked} spots walkable in 467, worst floor change ${worst.toFixed(3)} m; ${opened} spots opened where 467 walls stood; ${placed} occupied by the placed additions`);
    expect(checked).toBeGreaterThan(5000);
    expect(bad).toEqual([]);
    expect(opened).toBeGreaterThan(500);
  });
});

describe('Now view: the switch, there and back (node: three + Rapier, no rendering)', () => {
  let phys: Physics;
  beforeAll(async () => { phys = await Physics.create(); });
  it('builds, hides 467, swaps paint and colliders, keeps the player where he stands; back again restores everything', { timeout: 240_000 }, () => {
    const t0 = performance.now();
    const arch = buildMeshes(parts, phys, { dynamicDoors: false });
    const root = new THREE.Group(); root.add(arch.group);
    // stand-ins for the rest of the world root: people, fires (hidden in the view), carved reliefs and weather (kept)
    const crowd = new THREE.Group(); crowd.name = 'crowd'; crowd.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.7, 0.3), new THREE.MeshStandardNodeMaterial())); root.add(crowd);
    const fire = new THREE.Group(); fire.name = 'fire'; fire.add(new THREE.Mesh(new THREE.SphereGeometry(0.2), new THREE.MeshBasicNodeMaterial())); root.add(fire);
    const reliefs = new THREE.Group(); reliefs.name = 'reliefs'; const relief = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), paintedStoneMaterial()); reliefs.add(relief);
    const merlons = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardNodeMaterial()); merlons.name = 'crenellations'; reliefs.add(merlons); root.add(reliefs);
    const weather = new THREE.Group(); weather.name = 'weather-vfx'; root.add(weather);
    // a person's capsule (kinematic, as the crowd's): solid in 467, not in the Now view
    const pb = phys.world.createRigidBody(phys.R.RigidBodyDesc.kinematicPositionBased().setTranslation(1.9 + 3, 3.9, 4.9));
    const pc = phys.world.createCollider(phys.R.ColliderDesc.capsule(0.55, 0.25), pb);
    // the player in the middle of the Apadana hall, under its roof
    const [px, pz] = [1.9, 4.9]; // grid (1.9, −4.9): between the hall's column rows
    const player = new Player(phys, px, 3.05, pz);
    const settle = (n: number) => { for (let i = 0; i < n; i++) { player.update(1 / 60, { forward: 0, right: 0, run: false, yaw: 0, pitch: 0 }); phys.step(1 / 60); } };
    settle(30);
    expect(player.grounded).toBe(true); expect(player.feetY).toBeCloseTo(3, 1);
    const feet467 = player.feetY, pos467 = { ...player.position };
    const down = () => phys.castRayDown(px, pz, 40, player.collider); // the solid floor under the player
    // what is drawn above the player: the Apadana roof in 467 (roofs have no colliders), nothing but the floor in the Now view
    const sky = (o: THREE.Object3D) => new THREE.Raycaster(new THREE.Vector3(px, 40, pz), new THREE.Vector3(0, -1, 0)).intersectObject(o, true)[0]?.point.y ?? null;
    expect(sky(arch.group)!).toBeGreaterThan(20);
    const across = () => { const hit = phys.world.castRay(new phys.R.Ray({ x: -20, y: 5, z: 22 }, { x: -1, y: 0, z: 0 }), 20, true); return hit ? hit.timeOfImpact : null; }; // W along grid y −22, 2 m above the hall floor
    expect(down()!).toBeCloseTo(3, 2);
    const wall467 = across(); expect(wall467).not.toBeNull(); expect(wall467!).toBeLessThan(10); // the hall's W wall (mud brick)
    const vis = new Map<THREE.Object3D, boolean>(); root.traverse(o => vis.set(o, o.visible));
    const enabled = new Set<number>(); phys.world.forEachCollider(c => { if (c.isEnabled()) enabled.add(c.handle); });

    const view = new NowView({ root, parts, phys, keep: [reliefs, weather], hideWithin: [merlons], keepBodies: () => [player.body] });
    let changes = 0; view.onChange = () => { changes++; };
    expect(view.group).toBeNull(); // nothing built while off
    expect(view.set(true)).toBe(true); expect(view.active).toBe(true); expect(changes).toBe(1);
    phys.step(1 / 240); // collider changes reach the scene queries at the next step (the world steps every frame)
    const buildMs = view.buildMs;
    // drawn: the Now group and what was kept; nothing of 467's people, fires, architecture or merlons
    const g = view.group!; expect(g.visible).toBe(true);
    for (const o of [arch.group, crowd, fire, merlons]) expect(o.visible, o.name).toBe(false);
    for (const o of [reliefs, weather]) expect(o.visible, o.name).toBe(true);
    const shown: THREE.Object3D[] = [];
    const walk = (o: THREE.Object3D) => { if (!o.visible) return; if ((o as any).isMesh) shown.push(o); o.children.forEach(walk); };
    walk(root);
    for (const m of shown) {
      let a: THREE.Object3D | null = m; while (a && a !== g && a !== reliefs && a !== weather) a = a.parent;
      expect(a, m.name).not.toBeNull();
      if (a === g) { expect(m.userData.tier, m.name).toBe('C'); expect(m.userData.now, m.name).toBeTruthy(); expect(m.name).not.toMatch(/:timber|:glazed|:plaster_red/); }
    }
    expect(shown.filter(m => g.getObjectById(m.id)).length).toBeGreaterThan(20);
    expect(relief.material).not.toBe(paintedStoneMaterial()); // the paint is gone
    expect(ROOFS_PRESENT.value).toBe(0); expect(roofsPresent()).toBe(false); expect(roofedAt(10.55, 3.0, -12.4)).toBe(0);
    // the roof is gone and the floor is where it was; the walls are not solid, nor is the person's capsule; the player is
    expect(sky(g)!).toBeCloseTo(3, 2); expect(down()!).toBeCloseTo(3, 2);
    expect(across()).toBeNull();
    expect(pc.isEnabled()).toBe(false); expect(player.collider.isEnabled()).toBe(true);
    settle(60);
    expect(player.grounded).toBe(true); expect(Math.abs(player.feetY - feet467)).toBeLessThan(0.03);
    expect(Math.hypot(player.position.x - pos467.x, player.position.z - pos467.z)).toBeLessThan(0.01); // the camera stays where it was
    console.log(view.summary(), `; arch build ${(performance.now() - t0 - buildMs).toFixed(0)} ms`);

    // and back
    expect(view.set(false)).toBe(true); expect(changes).toBe(2); expect(view.set(false)).toBe(false); phys.step(1 / 240);
    const diff: string[] = []; root.traverse(o => { if (vis.has(o) && vis.get(o) !== o.visible) diff.push(o.name || o.type); });
    expect(diff).toEqual([]); expect(g.visible).toBe(false);
    expect(relief.material).toBe(paintedStoneMaterial());
    expect(ROOFS_PRESENT.value).toBe(1); expect(roofsPresent()).toBe(true);
    const enabled2 = new Set<number>(); phys.world.forEachCollider(c => { if (c.isEnabled()) enabled2.add(c.handle); });
    expect([...enabled2].sort()).toEqual([...enabled].sort());
    expect(down()!).toBeCloseTo(3, 2); expect(across()).toBeCloseTo(wall467!, 6);
    settle(30); expect(Math.abs(player.feetY - feet467)).toBeLessThan(0.03);
    // a second time round: the build is reused
    view.set(true); phys.step(1 / 240); expect(view.group).toBe(g); expect(across()).toBeNull(); view.set(false);
  });
  it('the Now surfaces build as WGSL (the weathered stone, the carved members, the modern steel)', { timeout: 120_000 }, () => {
    const view = new NowView({ root: new THREE.Group(), parts });
    const g = view.build();
    const canvas: any = { style: {}, width: 64, height: 64, getContext: () => null, addEventListener() {}, removeEventListener() {} };
    const r: any = new (THREE as any).WebGPURenderer({ canvas, antialias: false }); installProbeLight(r); r.hasFeature = () => true;
    const frag = (m: THREE.Mesh) => {
      const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(46, 1, 0.05, 1000); const sun = new THREE.DirectionalLight(0xffffff, 3); sun.castShadow = true;
      scene.add(m, new THREE.HemisphereLight(0xbfd6ff, 0x6b5a45, 0.6), sun, sun.target);
      const b = new (THREE as any).WGSLNodeBuilder(m, r); b.scene = scene; b.camera = cam; b.material = m.material; b.lightsNode = r.lighting.getNode(scene, cam); b.build();
      return b.fragmentShader as string;
    };
    const pick = (re: RegExp) => { let hit: THREE.Mesh | null = null; g.traverse(o => { if (!hit && (o as any).isMesh && re.test(o.name)) hit = o as THREE.Mesh; }); return hit as THREE.Mesh | null; };
    // (instanced members need a device's limits to build: the carved Now surface is checked on a colossus, a plain mesh)
    for (const re of [/^apadana:limestone$/, /colossus:bull:lod0$/, /:steel$/, /:limestone_dark$/, /:earth$/]) {
      const m = pick(re); expect(m, String(re)).toBeTruthy();
      expect(frag(m!), String(re)).toMatch(/fn main/);
    }
  });
});

describe('Now view settings (out-of-world, off by default)', () => {
  it('is off by default and has its own key', () => {
    expect(DEFAULT_SETTINGS.nowView).toBe(false);
    expect(DEFAULT_KEYS.nowView).toBe('KeyN');
    const codes = Object.values(DEFAULT_KEYS); expect(codes.filter(c => c === 'KeyN').length).toBe(1);
  });
});
