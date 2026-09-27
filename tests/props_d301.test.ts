// D-301 (every inch real: the interiors): the scanned furnishing and interior materials build to WGSL in node with stand-in
// scan textures (as the browser builds them with the real ones), each within WebGPU's default 16 sampled textures per
// fragment stage (D-295); the furnishings' new forms are closed, smooth and the size they were; the store rooms' jars stand
// along the doorway wall, out of the walking line between the benches. Not a compiler: WGSL validity is the browser's.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { registerScanTextures, SCAN_USE } from '../src/render/scans';
import { propMaterial, propMaterialMulti, surfaceMaterial } from '../src/render/materials';
import { jarGeometry, baleGeometry, quernGeometry } from '../src/world/furnish';
import { terraceRooms, roomFit } from '../src/arch/terrace_rooms';

const tex = () => { const t = new THREE.Texture(); t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; return t; };
registerScanTextures([...new Set(Object.values(SCAN_USE).map(u => u.scan))], tex);

function wgsl(material: THREE.Material, attrs: string[] = []) {
  const g = new THREE.BoxGeometry(1, 1, 1); const n = g.getAttribute('position').count;
  for (const a of attrs) g.setAttribute(a, new THREE.BufferAttribute(new Float32Array(n * (a === 'color' ? 3 : 1)), a === 'color' ? 3 : 1));
  const mesh = new THREE.Mesh(g, material);
  const canvas: any = { style: {}, width: 4, height: 4, addEventListener() {}, removeEventListener() {}, getContext() { return null; }, getRootNode() { return null; } };
  const renderer: any = new (THREE as any).WebGPURenderer({ canvas }); renderer.hasFeature = () => false; if (renderer.backend) renderer.backend.hasFeature = () => false;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(), sun = new THREE.DirectionalLight(), hemi = new THREE.HemisphereLight(); scene.add(sun, hemi, mesh);
  const b = new (THREE as any).WGSLNodeBuilder(mesh, renderer); b.scene = scene; b.camera = cam; b.material = material;
  b.lightsNode = renderer.lighting.getNode(scene, cam); b.lightsNode.setLights([sun, hemi]); b.build();
  const frag = String(b.fragmentShader ?? ''); return { frag, textures: (frag.match(/: texture_2d</g) ?? []).length };
}

describe('D-301 scanned interiors and furnishings', () => {
  it('every interior surface and furnishing material carries its scan and builds within 16 textures', () => {
    const cases: [string, THREE.Material, string[]][] = [
      ...['plaster_red', 'mudbrick_painted', 'limestone_carved', 'roof_timber', 'bronze', 'furn_textile'].map(n => [n, surfaceMaterial(n), []] as [string, THREE.Material, string[]]),
      ...['reed', 'felt', 'textile', 'clay', 'stone', 'leather', 'metal', 'wood', 'wicker', 'mud'].map(k => [k, propMaterial(k, { color: [0.5, 0.4, 0.3], rough: 0.8 }), []] as [string, THREE.Material, string[]]),
      ['multi', propMaterialMulti(['reed', 'felt', 'clay', 'stone']), ['color', 'aRough', 'aKind']],
    ];
    for (const [n, m, attrs] of cases) {
      expect((m as any).userData.scan, n).toBeTruthy();
      const r = wgsl(m, attrs); expect(r.frag.length, n).toBeGreaterThan(1000); expect(r.textures, n).toBeLessThanOrEqual(16);
    }
  });
  it('the ceilings take the reed matting\'s own scan on their undersides', () => {
    const r = wgsl(surfaceMaterial('roof_timber', { variant: 'd301-test' }));
    expect(r.textures).toBeGreaterThanOrEqual(4); // rough_wood and Wicker010B, each diffuse and arm
  });
  it('the jars, bales and querns are smooth closed forms of their sizes', () => {
    const j = jarGeometry(0.3, 0.75, 40); j.computeBoundingBox(); const b = j.boundingBox!;
    expect(b.max.y).toBeCloseTo(0.75, 2); expect(b.max.x).toBeGreaterThan(0.28); expect(b.max.x).toBeLessThan(0.33);
    expect(j.getAttribute('position').count).toBeGreaterThan(40 * 15);
    const bl = baleGeometry(0.42, 0.16, 0.3); bl.computeBoundingBox(); expect(bl.boundingBox!.min.y).toBeGreaterThan(-0.03); expect(bl.boundingBox!.max.x).toBeLessThan(0.3);
    const q = quernGeometry(0.55, 0.12, 0.4); q.computeBoundingBox(); expect(q.boundingBox!.max.y).toBeLessThanOrEqual(0.121); expect(q.boundingBox!.min.y).toBeGreaterThanOrEqual(-1e-6);
  });
  it('the store rooms\' jars stand along the doorway wall, out of the walking line between the benches', () => {
    const F = roomFit(); let n = 0;
    for (const { room, fit } of terraceRooms()) { if (room.use !== 'store') continue; const d = room.doors[0];
      for (const j of fit.jars) { n++; const along = Math.abs((j[0] - d.c[0]) * d.n[0] + (j[1] - d.c[1]) * d.n[1]); // distance in from the doorway's wall line
        expect(along, `${room.id} jar at ${j}`).toBeLessThan(d.depth / 2 + F.wall_gap + F.jar_r + 0.05); } }
    expect(n).toBeGreaterThan(50);
  });
});
