// D-330: the carved stone frames (src/arch/frames.ts): every frame part of the Terrace is found in an assembly and drawn
// carved; the geometry is closed where it is seen, faces outward, keeps inside its boxes; the trim's layout fits its texture.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildTerrace } from '../src/arch/terrace';
import { PartIndex } from '../src/arch/meshes';
import { frameAssemblies, frameGeometries, trimLayout, FRAME_KINDS, frameProfileSpec } from '../src/arch/frames';
import type { Box } from '../src/arch/parts';

const { parts } = buildTerrace(), index = new PartIndex(parts);
describe('stone frames (D-330)', () => {
  it('every door, window and niche frame part of every generator is in an assembly (none left as a box)', () => {
    const frames = parts.filter(p => p.type === 'box' && FRAME_KINDS.has(p.kind));
    const { asms, loose } = frameAssemblies(parts, index);
    expect(frames.length).toBeGreaterThan(200); expect(loose.map(b => `${b.building}:${b.kind}`)).toEqual([]);
    const byKind: Record<string, number> = {}; for (const a of asms) byKind[a.kind] = (byKind[a.kind] ?? 0) + 1;
    expect(asms.filter(a => a.kind !== 'niche_frame' && !(a.framed[0] && a.framed[1])).length, 'doors and windows carved on one face only (the other against a part)').toBeLessThanOrEqual(2);
    expect(byKind.door_frame).toBeGreaterThanOrEqual(30); expect(byKind.window_frame).toBeGreaterThanOrEqual(10); expect(byKind.niche_frame).toBeGreaterThanOrEqual(10);
    for (const a of asms) { expect(a.cornice, `${a.building} ${a.kind}`).not.toBeNull(); expect(a.framed.some(Boolean)).toBe(true);
      if (a.kind === 'niche_frame') expect(a.framed.filter(Boolean).length).toBe(1);
      if (a.kind !== 'door_frame') expect(a.sill).not.toBeNull(); }
  });
  it('the geometry: every frame part drawn, inside its box (± the carving), normals unit and facing out of the box, uv and tangents present', () => {
    const { byPart, stats } = frameGeometries(parts, index);
    expect(stats.loose).toBe(0); expect(stats.triangles).toBeLessThan(40_000);
    for (const [b, g] of byPart) {
      const P = g.getAttribute('position'), N = g.getAttribute('normal'), U = g.getAttribute('uv'), T = g.getAttribute('tangent');
      expect(U.count).toBe(P.count); expect(T.count).toBe(P.count);
      const cx = b.c[0], cz = -b.c[1], cy = (b.y0 + b.y1) / 2, hx = b.size[0] / 2 + 1e-3, hz = b.size[1] / 2 + 1e-3, hy = (b.y1 - b.y0) / 2 + 1e-3;
      for (let i = 0; i < P.count; i++) {
        expect(Math.abs(P.getX(i) - cx)).toBeLessThanOrEqual(hx + 0.2); expect(Math.abs(P.getZ(i) - cz)).toBeLessThanOrEqual(hz + 0.2); expect(Math.abs(P.getY(i) - cy)).toBeLessThanOrEqual(hy + 0.2);
        expect(Math.hypot(N.getX(i), N.getY(i), N.getZ(i))).toBeCloseTo(1, 4);
      }
      // winding agrees with the normals (counter-clockwise from outside)
      for (let t = 0; t < P.count; t += 3) { const a = new THREE.Vector3().fromBufferAttribute(P as any, t), bb = new THREE.Vector3().fromBufferAttribute(P as any, t + 1), c = new THREE.Vector3().fromBufferAttribute(P as any, t + 2);
        const n = new THREE.Vector3().subVectors(bb, a).cross(new THREE.Vector3().subVectors(c, a)); if (n.length() < 1e-9) continue;
        expect(n.normalize().dot(new THREE.Vector3().fromBufferAttribute(N as any, t))).toBeGreaterThan(0.99); }
    }
  });
  it('the fasciae step back by r_frame_profile.step toward the opening; the cornice reaches its projection', () => {
    const S = frameProfileSpec(), { asms } = frameAssemblies(parts, index), A = asms.find(a => a.kind === 'door_frame' && a.building === 'tachara')!;
    const { byPart } = frameGeometries(parts.filter(p => p.type !== 'box' || [...A.jambs, A.lintel, A.cornice].includes(p as Box) || !FRAME_KINDS.has(p.kind)), index);
    const g = byPart.get(A.jambs[0])!, P = g.getAttribute('position'), across = new Set<number>();
    for (let i = 0; i < P.count; i++) across.add(+(A.ax === 0 ? -P.getZ(i) : P.getX(i)).toFixed(4));
    for (let k = 0; k < S.fasciae; k++) expect([...across].some(c => Math.abs(c - (A.c1 - k * S.step)) < 1e-3), `face at c1 − ${k} steps`).toBe(true);
    const K = byPart.get(A.cornice!)!, Q = K.getAttribute('position'); let far = 0;
    for (let i = 0; i < Q.count; i++) far = Math.max(far, (A.ax === 0 ? -Q.getZ(i) : Q.getX(i)) - A.c1);
    expect(far).toBeCloseTo(A.cornice!.size[A.ax === 0 ? 1 : 0] / 2 - (A.c1 - A.c0) / 2, 3);
  });
  it('the trim layout fits its texture and every row keeps ~1 mm per texel across the profile', () => {
    const L = trimLayout(); let top = 0;
    for (const r of Object.values(L.rows)) { top = Math.max(top, r.v0 + r.px); if (r.id !== 'flat') expect(r.px / (r.arc * 1000)).toBeGreaterThan(0.95); }
    expect(top).toBeLessThanOrEqual(L.H); expect(L.period / L.spec.tongue_pitch).toBeCloseTo(Math.round(L.period / L.spec.tongue_pitch), 6);
  });
});
