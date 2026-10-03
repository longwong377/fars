// s18 C14 (D-790): the anatomy the MakeHuman base mesh (hm08) smooths over, added to every body variant's positions in
// humans.bin (the "2010 stock body" of the reviewers): the collarbones' ridges and the hollow under them, the notch above
// the breastbone, the neck's sternocleidomastoid cords from behind the ear to the breastbone, a man's larynx (Adam's
// apple), the kneecaps, the ankle bones. Each is a smooth relief along the vertex normal, placed from the variant's own
// joints and front surface (so it follows every body), its height in millimetres from standard surface anatomy (C:
// order of magnitude, softened in the heavier bodies and halved in children; no measured series). Positions only: the
// topology, UV, bones and variants are unchanged. Idempotent (humans.json `anatomy` records the version applied).
//   npx tsx tools/humans/anatomy.ts        (then rebuild people_hair, people_cloth and the people impostors)
import { readFileSync, writeFileSync } from 'node:fs';
import { decodeHumanAssets } from '../../src/people/humanAssets';
import { HB, PART } from '../../src/people/humanFormat';

export const ANATOMY = { version: 1,
  /** heights (m) and widths (m, Gaussian sigma) */
  clavicle: { h: 0.003, w: 0.006, hollow: -0.0016, hollowW: 0.011, hollowDy: -0.024 },
  notch: { h: -0.0035, w: 0.011 }, scm: { h: 0.0019, w: 0.0065 }, larynx: { h: 0.003, w: 0.009 },
  kneecap: { h: 0.003, w: 0.022 }, malleolus: { h: 0.0028, w: 0.009 } };

const HD = 'public/generated/humans', metaF = `${HD}/humans.json`, binF = `${HD}/humans.bin`;
type V3 = [number, number, number];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const g = (d: number, w: number) => Math.exp(-0.5 * (d / w) ** 2);
/** distance from p to the segment a-b */
const segD = (p: V3, a: V3, b: V3) => { const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab))); return Math.hypot(...sub(p, [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t])); };

if (process.argv[1]?.endsWith('anatomy.ts')) {
  const meta = JSON.parse(readFileSync(metaF, 'utf8')), buf = readFileSync(binF);
  if ((meta.anatomy ?? 0) >= ANATOMY.version) { console.log(`[anatomy] already applied (v${meta.anatomy})`); process.exit(0); }
  const A = decodeHumanAssets(meta, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer), s = meta.posScale, NP = A.NP;
  const out = Buffer.from(buf), C = ANATOMY;
  for (const v of A.variants) {
    const vm = v.meta, J = (b: number): V3 => [v.joints[b * 3], v.joints[b * 3 + 1], v.joints[b * 3 + 2]], P = (i: number): V3 => [v.pos[i * 3], v.pos[i * 3 + 1], v.pos[i * 3 + 2]];
    const child = vm.group === 'child', man = vm.sex === 'm' && !child;
    const k = (child ? 0.5 : 1) * Math.max(0.55, Math.min(1.15, 1.3 - (vm.macro?.weight ?? 0.5))); // (fat softens the bones' relief)
    // the front surface at the breastbone's top: the frontmost chest or neck vertex near the midline at the clavicles' height
    const cl = J(HB.clavicle_l), cr = J(HB.clavicle_r), yN = (cl[1] + cr[1]) / 2 + 0.008;
    let zN = -1; for (let i = 0; i < A.NO; i++) { const pt = A.part[i]; if (pt !== PART.chest && pt !== PART.neck) continue; const p = P(i); if (Math.abs(p[0]) < 0.015 && Math.abs(p[1] - yN) < 0.012) zN = Math.max(zN, p[2]); }
    const notch: V3 = [0, yN, zN], head = J(HB.head), neck = J(HB.neck_01);
    const ends = (sg: 1 | -1) => { const c = sg > 0 ? cl : cr, ua = J(sg > 0 ? HB.upperarm_l : HB.upperarm_r);
      return { med: [sg * 0.022, yN - 0.004, zN - 0.006] as V3, lat: [ua[0] - sg * 0.015, ua[1] + 0.035, (ua[2] + c[2]) / 2 + 0.02] as V3,
        mastoid: [sg * 0.048, head[1] - 0.012, head[2] - 0.02] as V3 }; };
    const L = ends(1), R = ends(-1);
    const larynx: V3 = [0, neck[1] + 0.35 * (head[1] - neck[1]) - 0.02, 0];
    const knees = [J(HB.calf_l), J(HB.calf_r)], ankles = [J(HB.foot_l), J(HB.foot_r)];
    const d = new Float64Array(NP); const seen = new Uint8Array(NP); let maxD = 0;
    for (let i = 0; i < A.NO; i++) { const p0 = A.orig[i]; if (seen[p0]) continue; seen[p0] = 1; const pt = A.part[i];
      const p = P(i), n: V3 = [v.nrm[i * 3], v.nrm[i * 3 + 1], v.nrm[i * 3 + 2]]; let h = 0;
      if (pt === PART.chest || pt === PART.neck) {
        const front = Math.max(0, Math.min(1, (n[2] - 0.15) / 0.4));
        for (const E of [L, R]) {
          // the collarbone: a ridge along it (seen from the front: x, y), the hollow below it
          const pf: V3 = [p[0], p[1], 0], m: V3 = [E.med[0], E.med[1], 0], l: V3 = [E.lat[0], E.lat[1], 0];
          if (p[2] > zN - 0.09) { h += front * (C.clavicle.h * g(segD(pf, m, l), C.clavicle.w) + C.clavicle.hollow * g(segD(pf, [m[0], m[1] + C.clavicle.hollowDy, 0], [l[0], l[1] + C.clavicle.hollowDy, 0]), C.clavicle.hollowW)); }
          // the neck's cord, from behind the ear to the breastbone's top (neck only, its front and side)
          if (pt === PART.neck && n[2] > -0.3) h += C.scm.h * g(segD(p, E.mastoid, E.med), C.scm.w);
        }
        h += front * C.notch.h * g(Math.hypot(...sub(p, notch)), C.notch.w);
        if (man && pt === PART.neck && n[2] > 0.3) h += C.larynx.h * g(Math.hypot((p[0]) / 0.8, (p[1] - larynx[1]) / 1.4), C.larynx.w);
      }
      if ((pt === PART.thigh_l || pt === PART.thigh_r || pt === PART.calf_l || pt === PART.calf_r) && n[2] > 0.2) for (const kn of knees) { const c: V3 = [kn[0], kn[1] + 0.012, kn[2] + 0.03]; h += Math.min(1, (n[2] - 0.2) / 0.4) * C.kneecap.h * g(Math.hypot(...sub(p, c)), C.kneecap.w); }
      if (pt === PART.calf_l || pt === PART.calf_r || pt === PART.foot_l || pt === PART.foot_r) for (const an of ankles) for (const sx of [-1, 1]) { const c: V3 = [an[0] + sx * 0.032, an[1] + 0.004, an[2] - 0.005]; h += C.malleolus.h * g(Math.hypot(...sub(p, c)), C.malleolus.w); }
      h *= k; d[p0] = h; maxD = Math.max(maxD, Math.abs(h));
      const q = new Int16Array(out.buffer, out.byteOffset + vm.posOffset + p0 * 6, 3);
      for (let c = 0; c < 3; c++) q[c] = Math.max(-32767, Math.min(32767, Math.round(q[c] + (h * n[c]) / s))); }
    console.log(`[anatomy] ${vm.id}: k ${k.toFixed(2)}, max ${(maxD * 1000).toFixed(2)} mm, notch at y ${yN.toFixed(3)} z ${zN.toFixed(3)}`);
  }
  meta.anatomy = ANATOMY.version; meta.anatomyNote = 's18 C14 D-790: tools/humans/anatomy.ts relief added to the positions (collarbones, notch, neck cords, larynx, kneecaps, ankle bones; C)';
  writeFileSync(binF, out); writeFileSync(metaF, JSON.stringify(meta));
}
