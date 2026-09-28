// D-321 rev 2 (B145 approach 1): the dressed stone's free arrises as geometry near the eye (src/arch/arris.ts). Holds: the band stays
// inside its part's chamfered box (it only removes stone), its chips are real cavities of the recorded sizes, the band ends at
// ARRIS_W where the base mesh's discard ends, and the near field over the Terrace stays within its triangle budget.
import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../src/arch/terrace';
import { buildMeshes } from '../src/arch/meshes';
import { footGeometry } from '../src/arch/terrace_foot';
import { faceJoints } from '../src/arch/arris_joints';
import { SURFACES } from '../src/render/materials';
import { ashlarCells as ashlarCellsCpu } from './lib/stone_cpu';
import { ArrisField, bandGeometry, chipsOf, profile, ARRIS_W, ARRIS_R, CHIPS, PIECE, ARRIS_LAP } from '../src/arch/arris';
import type { Part } from '../src/arch/parts';

const buf = () => ({ pos: [] as number[], nrm: [] as number[], y0: [] as number[], pbox: [] as number[], ytop: [] as number[], stair: [] as number[], adist: [] as number[], aseed: [] as number[], index: [] as number[] });
describe('D-321 rev 2 arris bands', () => {
  const wall: Part = { type: 'box', building: 't', kind: 'wall', material: 'limestone', tier: 'C', src: 'RECON', c: [0, 0], size: [6, 1.2], y0: 0, y1: 2, rot: 0.3 } as any;
  const built = buildMeshes([wall]);
  it('a free-standing block records its 12 free arrises', () => { expect(built.arris.length).toBe(12); });
  it('the band only removes stone: every vertex inside the part\'s chamfered box; chips are cavities of the recorded depth', () => {
    let maxIn = 0, chips = 0, len = 0;
    for (const e of built.arris) {
      const B = buf(), L = e.a.distanceTo(e.b); len += L; bandGeometry(e, 0, L, B, 1000); chips += chipsOf(e, L).length;
      const t = e.b.clone().sub(e.a).normalize(), P = profile(e.r);
      for (let i = 0; i < B.pos.length; i += 3) {
        const X = new THREE.Vector3(B.pos[i], B.pos[i + 1], B.pos[i + 2]);
        for (const pl of e.planes) expect(pl.n.dot(X) - pl.d).toBeLessThan(1e-5);
        // depth below the nominal worn surface: distance inside both face planes beyond the profile's own
        const C = e.a.clone().addScaledVector(t, X.clone().sub(e.a).dot(t)), d = X.clone().sub(C), u = -d.dot(e.nb), v = -d.dot(e.na);
        const nearest = Math.min(...P.map(([pu, pv]) => Math.hypot(u - pu, v - pv))); maxIn = Math.max(maxIn, nearest);
      }
    }
    expect(chips / len).toBeGreaterThan(CHIPS.rate * 0.3); expect(chips / len).toBeLessThan(CHIPS.rate * 2.5);
    expect(maxIn).toBeGreaterThan(0.002); // chips cut at least 2 mm
    expect(maxIn).toBeLessThan(ARRIS_W); // and stay inside the band
    // the profile's outer rows lie on the faces at ARRIS_W (where the base mesh's discard ends)
    const P = profile(0.01); expect(P[0]).toEqual([ARRIS_W + ARRIS_LAP, 0]); expect(P[P.length - 1]).toEqual([0, ARRIS_W + ARRIS_LAP]); // (overlapping the base's face past its discard)
  });
  it('rev 4: a dressed prism records its free top edges and convex corners, and its faces carry the distances to them', () => {
    const pr: Part = { type: 'prism', building: 'p', kind: 'platform', material: 'limestone', tier: 'C', src: 'RECON', polygon: [[0, 0], [4, 0], [4, 4], [0, 4]], y0: 0, y1: 2 } as any;
    const b = buildMeshes([pr]); expect(b.arris.length).toBe(8);
    let checked = 0;
    b.group.traverse((o: any) => { if (!o.isMesh) return; const P = o.geometry.getAttribute('position'), A = o.geometry.getAttribute('adist'); if (!A) return;
      for (let i = 0; i < P.count; i++) { const x = P.getX(i), y = P.getY(i), z = P.getZ(i), n = -z;
        const dA = Math.min(A.getX(i), A.getY(i), A.getZ(i), A.getW(i)) + 1000, top = y > 1.999;
        const want = top ? Math.min(x, 4 - x, n, 4 - n) : Math.min(2 - y, Math.min(x, 4 - x) < 1e-6 ? Math.min(n, 4 - n) : Math.min(x, 4 - x));
        if (top && want > 0.14 && dA > 900) continue; // (the inner polygon carries none)
        expect(Math.abs(dA - want)).toBeLessThan(1e-3); checked++; } });
    expect(checked).toBeGreaterThan(40);
  });
  it('rev 4: the foot blocks record an arris per face edge, their faces the distances to them (0 on the chamfer)', () => {
    const { parts } = buildTerrace(), fg = footGeometry(parts);
    expect(fg.arris.length).toBeGreaterThan(fg.blocks * 4);
    const A = fg.geo!.getAttribute('adist'); let onArris = 0; for (let i = 0; i < A.count; i++) if (Math.abs(A.getX(i) + 1000) < 1e-6) onArris++;
    expect(onArris).toBeGreaterThan(fg.arris.length * 6 - 1); // every chamfer quad's six vertices
    for (const e of fg.arris.slice(0, 40)) { const B = buf(); bandGeometry(e, 0, e.a.distanceTo(e.b), B, 1000);
      for (let i = 0; i < B.pos.length; i += 3) for (const pl of e.planes) expect(pl.n.x * B.pos[i] + pl.n.y * B.pos[i + 1] + pl.n.z * B.pos[i + 2] - pl.d).toBeLessThan(1e-4); }
  });
  it('rev 4: a palace wall\'s joints: the grooves lie on the joints the shader draws (its CPU mirror)', () => {
    const w: Part = { type: 'box', building: 't', kind: 'wall', material: 'limestone', tier: 'C', src: 'RECON', c: [3, 7], size: [9, 1.2], y0: 0, y1: 6, rot: 0.4 } as any;
    const b = buildMeshes([w]), J = SURFACES.limestone.joints!, faces = b.jointFaces;
    expect(faces.length).toBeGreaterThan(3);
    let n = 0, worst = 0;
    for (const F of faces) {
      const { beds, heads } = faceJoints(F);
      // sample the face: where the shader's joint distance is small, a CPU joint line is as near
      for (let i = 0; i < 4000; i++) {
        const t = F.t0 + 0.05 + Math.random() * (F.t1 - F.t0 - 0.1), y = F.y0 + 0.05 + Math.random() * (F.y1 - F.y0 - 0.1);
        const W = ashlarCellsCpu(t, y, J), dS = Math.min(W.dBed, W.dHead); if (dS > 0.01) continue;
        const dC = Math.min(...beds.filter(q => t >= q[1] && t <= q[2]).map(q => Math.abs(y - q[0])), ...heads.filter(q => y >= q[1] - 1e-6 && y <= q[2] + 1e-6).map(q => Math.abs(t - q[0])));
        worst = Math.max(worst, Math.abs(dC - dS)); n++;
      }
    }
    expect(n).toBeGreaterThan(50); expect(worst).toBeLessThan(0.004); // (the band's lap; the mirror's hash is float64, the grooves' float32 as the GPU's)
  });
  it('the near field over the Terrace: bands within R, triangles and rebuild time within budget', () => {
    const { parts } = buildTerrace(), g = buildMeshes(parts);
    const mat = new THREE.MeshBasicMaterial(), f = new ArrisField(g.arris, () => mat, 1000); f.addFaces(g.jointFaces, () => -12); // (the plain's level, about)
    const rows: string[] = [`free dressed-stone arrises: ${g.arris.length}, ${g.arris.reduce((s, e) => s + e.a.distanceTo(e.b), 0).toFixed(0)} m`];
    let worst = 0;
    for (const [n, e, y, nn] of [['grand stair', -43.9, 3, 128], ['stair-foot', -60, 1.6, 112], ['apadana court', -50, 1.6, 70], ['tachara stair', -21, 1.6, -112], ['apadana e stair', 80, 1.6, -14]] as [string, number, number, number][]) {
      const t0 = performance.now(); f.update(new THREE.Vector3(e, y, -nn), 1e9); const full = performance.now() - t0; f.update(new THREE.Vector3(e + 1.6, y, -nn)); let inc = 0; for (let k = 1; k <= 12; k++) { f.update(new THREE.Vector3(e + k * 0.4, y, -nn)); inc = Math.max(inc, f.stats.ms); expect(f.stats.ready).toBe(true); } worst = Math.max(worst, f.stats.triangles);
      rows.push(`${n}: ${f.stats.cells} cells, ${f.stats.draws} draws, ${f.stats.triangles} triangles, first build ${full.toFixed(0)} ms, a 1.6 m step ${inc} ms (pending ${f.stats.pending})`); expect(inc).toBeLessThan(8); expect(f.stats.ready).toBe(true);
      f.group.traverse((o: any) => { if (o.isMesh && o.visible) { const p = o.geometry.getAttribute('position'); for (let i = 0; i < p.count; i += 97) expect(Math.hypot(p.getX(i) - e, p.getY(i) - y, p.getZ(i) + nn)).toBeLessThan(45); } });
    }
    mkdirSync('bench-reports', { recursive: true }); writeFileSync('bench-reports/arris-d321.txt', rows.join('\n') + '\n');
    expect(worst).toBeGreaterThan(1000); // there are arrises near the stairs
    expect(worst).toBeLessThan(250_000); // well within the 12 M frame budget with the shadow cascades (x5)
    f.update(null); expect(f.group.visible).toBe(false);
  }, 300_000);
});
