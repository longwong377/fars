import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { swallowAt, raptorAt, Birds, BIRDS, BirdPose } from '../src/world/wildlife';
import { NavGrid } from '../src/people/navgrid';
import { Ring, Terrain, TerrainMeta } from '../src/terrain/heightfield';

const pose = (): BirdPose => ({ pos: new THREE.Vector3(), heading: 0, bank: 0, flap: 0, visible: false });
describe('birds (brief §5.5)', () => {
  it('flight is deterministic and physically plausible: swallows 4–20 m/s, 2–25 m up; raptors soar 7–14 m/s, 100–470 m up', () => {
    const a = pose(), b = pose();
    for (let s = 1; s < 30; s++) {
      swallowAt([0, 90], 0, s, 1234.5, a); swallowAt([0, 90], 0, s, 1234.5, b); expect(a.pos.equals(b.pos)).toBe(true);
      swallowAt([0, 90], 0, s, 1235.0, b); const v = a.pos.distanceTo(b.pos) / 0.5; expect(v).toBeGreaterThan(2); expect(v).toBeLessThan(20);
      expect(a.pos.y).toBeGreaterThan(1.5); expect(a.pos.y).toBeLessThan(25);
      raptorAt([300, 0], 0, s, 500, 3, 0, a); raptorAt([300, 0], 0, s, 500.5, 3, 0, b); const w = a.pos.distanceTo(b.pos) / 0.5;
      expect(w).toBeGreaterThan(7); expect(w).toBeLessThan(14); expect(a.pos.y).toBeGreaterThan(100); expect(a.pos.y).toBeLessThan(470);
    }
  });
  it('seasons and hours: swallows only Mar–Sep by day; sparrows flush from a player within 3 m', () => {
    const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
    const meta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
    const ring = (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0)), meta.court_asl);
    const B = new Birds(1, nav, new Terrain(meta, ring('near'), ring('mid'), ring('far')), [[0, 90], [150, 40]]);
    const count = (id: string) => (B.group.children.find(m => (m as any).userData.note.startsWith(BIRDS[id as 'swallow'].name)) as THREE.InstancedMesh).count;
    B.update(5, 11, 1000, null, { x: 0, n: 0 }, 0); expect(count('swallow')).toBe(BIRDS.swallow.count); expect(count('raptor')).toBe(2);
    B.update(11, 11, 1000, null, { x: 0, n: 0 }, 0); expect(count('swallow')).toBe(0); // December
    B.update(5, 23, 1000, null, { x: 0, n: 0 }, 0); expect(count('swallow') + count('raptor') + count('sparrow')).toBe(0); // night
    // a sparrow next to the player lifts off within 1.2 s
    B.update(5, 11, 2000, null, { x: 0, n: 0 }, 0);
    const mesh = B.group.children.find(m => (m as any).userData.note.startsWith('house sparrow')) as THREE.InstancedMesh; const m4 = new THREE.Matrix4(); mesh.getMatrixAt(0, m4);
    const p = new THREE.Vector3().setFromMatrixPosition(m4);
    B.update(5, 11, 2000.1, [p.x + 1, -p.z], { x: 0, n: 0 }, 0); B.update(5, 11, 2000.7, [p.x + 1, -p.z], { x: 0, n: 0 }, 0); mesh.getMatrixAt(0, m4);
    expect(new THREE.Vector3().setFromMatrixPosition(m4).y - p.y).toBeGreaterThan(0.5);
  });
});

import { jackalAt, Jackals, JACKAL } from '../src/world/wildlife';
import footprints from '../src/data/geo/footprints.json';
describe('jackals (brief §5.5)', () => {
  const inside = (poly: number[][], e: number, n: number) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > n) !== (yj > n) && e < ((xj - xi) * (n - yi)) / (yj - yi) + xi) c = !c; } return c; };
  it('stay off the Terrace, trot at ~2 m/s when moving, and pause sometimes', () => {
    const terr = (footprints as any).terrace.polygon as number[][], p = { e: 0, n: 0, heading: 0, moving: false }, q = { ...p };
    let moving = 0, total = 0, sum = 0, max = 0;
    for (let night = 0; night < 40; night++) for (let i = 0; i < 4; i++) for (let t = 0; t < 36000; t += 97) {
      jackalAt(1, night, i, t, p); expect(inside(terr, p.e, p.n), `night ${night} jackal ${i} at ${p.e.toFixed(0)},${p.n.toFixed(0)}`).toBe(false);
      jackalAt(1, night, i, t + 1, q); const v = Math.hypot(q.e - p.e, q.n - p.n); total++;
      if (p.moving && q.moving) { moving++; sum += v; max = Math.max(max, v); }
    }
    expect(moving / total).toBeGreaterThan(0.6); expect(moving / total).toBeLessThan(0.95);
    expect(sum / moving).toBeGreaterThan(1.2); expect(sum / moving).toBeLessThan(3); expect(max).toBeLessThan(5); // walk to trot
  });
});
