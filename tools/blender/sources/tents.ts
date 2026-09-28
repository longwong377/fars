// D-330: the tents' Blender job from the project's own tent forms (src/world/tentForms.ts, from camps.ts TENT_KINDS): per kind,
// every cloth panel as a grid at GRID m in its pitched rest shape, its faces wound outward, the held vertices (pins: the
// ridge, pole tops, eave and hem points at the ropes and pegs; whole edges roped taut) and the door cut out; the poles (the
// simulation's colliders). Blender axes (x, −z, y). Usage: npx tsx tools/blender/sources/tents.ts <outDir>
import { mkdirSync, writeFileSync } from 'node:fs';
import { tentForm, panelAt } from '../../../src/world/tentForms';
import type { TentKind } from '../../../src/people/camps';

const out = process.argv[2]; if (!out) throw new Error('usage: tents.ts <outDir>');
mkdirSync(out, { recursive: true });
const GRID = 0.05, KINDS: TentKind[] = ['ridge', 'black', 'pavilion'];
const B = (p: number[]) => [+(p[0]).toFixed(5), +(-p[2]).toFixed(5), +(p[1]).toFixed(5)];
const job: any = { grid: GRID, kinds: [], out_dir: out,
  // the cloth (C): woven wool, linen, goat hair: a light canvas (mass per vertex of a GRID m grid), stiff in tension, soft in bending
  cloth: { mass: 0.004, tension: 20, shear: 6, bending: 4, air: 1.0, quality: 10, frames: 90, thickness: 0.008, slack: 0.03 },
  lod_tris: [1600, 320] };
for (const kind of KINDS) {
  const F = tentForm(kind), panels: any[] = [];
  const ctr = [0, F.h * 0.35, 0];
  for (const P of F.panels) {
    const ns = Math.max(2, Math.ceil(P.ls / GRID)), nt = Math.max(2, Math.ceil(P.lt / GRID)), V: number[][] = [];
    for (let j = 0; j <= nt; j++) for (let i = 0; i <= ns; i++) V.push(panelAt(kind, P.id, i / ns, j / nt));
    const id = (i: number, j: number) => j * (ns + 1) + i, faces: number[][] = [];
    for (let j = 0; j < nt; j++) for (let i = 0; i < ns; i++) {
      const sm = (i + 0.5) / ns, tm = (j + 0.5) / nt; if (P.cut && sm > P.cut.s0 && sm < P.cut.s1 && tm > P.cut.t0 && tm < P.cut.t1) continue;
      let f = [id(i, j), id(i + 1, j), id(i + 1, j + 1), id(i, j + 1)];
      const a = V[f[0]], b = V[f[1]], c = V[f[2]], u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], w = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]], m = [(a[0] + c[0]) / 2 - ctr[0], (a[1] + c[1]) / 2 - ctr[1], (a[2] + c[2]) / 2 - ctr[2]];
      if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0) f = [f[0], f[3], f[2], f[1]]; // (outward: away from the tent's middle)
      faces.push(f);
    }
    const pin = new Set<number>();
    for (const [s, t] of P.pins) { const ci = Math.round(s * ns), cj = Math.round(t * nt); for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const i = ci + di, j = cj + dj; if (i >= 0 && i <= ns && j >= 0 && j <= nt) pin.add(id(i, j)); } }
    if (P.diag) for (let i = 0; i <= ns; i++) { const j = Math.round((i / ns) * nt), k = Math.round((1 - i / ns) * nt); pin.add(id(i, j)); pin.add(id(i, k)); }
    for (const L of P.pinLines) { if (L.s !== undefined) { const i = Math.round(L.s * ns); for (let j = 0; j <= nt; j++) pin.add(id(i, j)); } if (L.t !== undefined) { const j = Math.round(L.t * nt); for (let i = 0; i <= ns; i++) pin.add(id(i, j)); } }
    panels.push({ id: P.id, ns, nt, verts: V.map(B), faces, pins: [...pin].sort((a, b) => a - b) });
  }
  job.kinds.push({ kind, w: F.w, d: F.d, h: F.h, panels, poles: F.poles.map(p => ({ a: B(p.a), b: B(p.b), r: p.r })) });
  console.log(`[tents] ${kind}: ${panels.map(p => `${p.id} ${p.verts.length} v, ${p.faces.length} f, ${p.pins.length} pinned`).join('; ')}`);
}
writeFileSync(`${out}/job.json`, JSON.stringify(job));
