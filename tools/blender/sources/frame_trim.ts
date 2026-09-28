// D-330: the frame trim's Blender job from the project's own profile code (src/arch/frames.ts trimLayout: the rows, their
// low-poly profiles and their places in the texture, from SITE_SPEC global.r_frame_profile and r_door_frame), so the game's
// frames and the baked texture are one geometry. Run by tools/blender/decor.mjs:
//   npx tsx tools/blender/sources/frame_trim.ts <out.json>
import { writeFileSync } from 'node:fs';
import { trimLayout, corniceProfile, FRAME_TRIM } from '../../../src/arch/frames';

const out = process.argv[2]; if (!out) throw new Error('usage: frame_trim.ts <out.json>');
const L = trimLayout(), S = L.spec, F = L.dims;
// the high source's cornice: the same curves, finely sampled (the low profile's torus and gorge are chords of these)
const fine = corniceProfile(S, F, L.lead, L.leadTop, 48, 96);
const job = {
  W: L.W, H: L.H, period: L.period, lead: L.lead, leadTop: L.leadTop, margin: FRAME_TRIM.margin,
  spec: S, dims: F,
  rows: Object.fromEntries(Object.entries(L.rows).map(([k, r]) => [k, { v0: r.v0, px: r.px, arc: r.arc, pts: r.pts, cum: r.cum }])),
  high: {
    // the sharp corners the high source rounds (convex: worn round; concave: a fine fillet), per strip row
    convex: { pts: [[L.lead, 0], [0, 0], [0, -L.lead]], round: [{ i: 1, r: 0.005 }] },
    step: { pts: [[L.lead, S.step], [0, S.step], [0, 0], [-L.lead, 0]], round: [{ i: 1, r: 0.005 }, { i: 2, r: 0.0015 }] },
    cornice: { pts: [...fine.pts.slice(0, fine.pts.length - 3), [F.cornice_projection, F.cornice_height], [F.cornice_projection - L.leadTop, F.cornice_height]], round: [{ i: fine.pts.length - 3, r: 0.005 }], torus: fine.torus, gorge: fine.gorge },
  },
  gorge: L.gorge, torus: L.torus, arrises: L.arrises,
};
writeFileSync(out, JSON.stringify(job, null, 1));
console.log(`[frame_trim] job: ${Object.entries(L.rows).map(([k, r]) => `${k} v0 ${r.v0} px ${r.px} arc ${r.arc.toFixed(4)}`).join('; ')}`);
