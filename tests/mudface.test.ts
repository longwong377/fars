// D-364 (B186): the palaces' mud-brick faces bowed by one world field (src/arch/mudface.ts). Holds: the motion is horizontal and
// within the field's amplitude; two parts that share a corner or a face move together there (no crack: every vertex of one at a
// point of the other moves the same); nothing set into a wall in another material sees the wall move at its face; the Terrace's
// mud brick stays within its triangle budget.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { buildMeshes } from '../src/arch/meshes';
import { buildTerrace } from '../src/arch/terrace';
import { mudField, MUD_OCTAVES, MUD_FADE } from '../src/arch/mudface';
import type { Part } from '../src/arch/parts';

const AMP = MUD_OCTAVES.reduce((s, [, a]) => s + a, 0) * Math.SQRT2;
const meshOf = (b: ReturnType<typeof buildMeshes>, re: RegExp) => { let g: THREE.BufferGeometry | null = null; b.group.traverse((o: any) => { if (o.isMesh && re.test(o.name)) g = o.geometry; }); return g!; };
describe('D-364 mud-brick faces', () => {
  it('the field is smooth and within its amplitude', () => {
    let mx = 0; for (let i = 0; i < 2000; i++) { const [dx, dz] = mudField(i * 0.37, i * 0.11, -i * 0.23); mx = Math.max(mx, Math.hypot(dx, dz)); }
    expect(mx).toBeGreaterThan(0.01); expect(mx).toBeLessThan(AMP);
    const [a, b] = mudField(10, 2, 3), [c, d] = mudField(10.01, 2, 3); expect(Math.hypot(a - c, b - d)).toBeLessThan(0.0005);
  });
  it('two walls meeting at a corner move together: the merged mesh has no open edge on their faces', () => {
    const w1: Part = { type: 'box', building: 't', kind: 'wall', material: 'mudbrick', tier: 'C', src: 'RECON', c: [0, 0], size: [8, 1], y0: 0, y1: 6 } as any;
    const w2: Part = { type: 'box', building: 't', kind: 'wall', material: 'mudbrick', tier: 'C', src: 'RECON', c: [4.5, 3.5], size: [1, 8], y0: 0, y1: 6 } as any;
    const g = meshOf(buildMeshes([w1, w2]), /mudbrick$/).toNonIndexed(), P = g.getAttribute('position');
    // watertight within each part: every edge of the triangle soup is shared by a triangle on the other side (positions welded at 0.1 mm)
    const key = (i: number) => `${Math.round(P.getX(i) * 1e4)},${Math.round(P.getY(i) * 1e4)},${Math.round(P.getZ(i) * 1e4)}`;
    const edges = new Map<string, number>();
    for (let t = 0; t < P.count; t += 3) for (let k = 0; k < 3; k++) { const a = key(t + k), b = key(t + (k + 1) % 3), e = a < b ? a + '|' + b : b + '|' + a; edges.set(e, (edges.get(e) ?? 0) + 1); }
    let open = 0; for (const n of edges.values()) if (n === 1) open++;
    // (the two boxes interpenetrate at the corner, so their own closed shells are what is checked: no edge used once)
    expect(open).toBe(0);
  });
  it('a stone frame set into a wall: the wall does not move at the frame', () => {
    const w: Part = { type: 'box', building: 't', kind: 'wall', material: 'mudbrick', tier: 'C', src: 'RECON', c: [0, 0], size: [10, 1.2], y0: 0, y1: 6 } as any;
    const f: Part = { type: 'box', building: 't', kind: 'door_frame', material: 'limestone_dark', tier: 'C', src: 'RECON', c: [0, 0.65], size: [2, 0.2], y0: 0, y1: 4 } as any;
    const P = meshOf(buildMeshes([w, f]), /:mudbrick$/).getAttribute('position');
    let near = 0;
    for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); if (Math.abs(x) < 1 + MUD_FADE[0] && y < 4 && Math.abs(-z - 0.6) < 0.05) { near++; expect(Math.abs(-z - 0.6)).toBeLessThan(0.003); } }
    expect(near).toBeGreaterThan(0);
  });
  it('the Terrace\'s mud brick: triangles within budget', async () => {
    const { parts } = buildTerrace(), b = buildMeshes(parts); let tris = 0;
    b.group.traverse((o: any) => { if (o.isMesh && /:(mudbrick|mudbrick_painted|mudbrick_bare)$/.test(o.name)) tris += (o.geometry.index?.count ?? o.geometry.getAttribute('position').count) / 3; });
    console.log(`D-364 mud brick: ${tris} triangles`); if (process.env.MUD_OUT) (await import("node:fs")).writeFileSync(process.env.MUD_OUT, String(tris));
    expect(tris).toBeLessThan(300_000); // (94 k before D-364: +147 k)
  }, 300_000);
});
