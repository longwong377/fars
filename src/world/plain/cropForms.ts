// D-356: the standing crop's plant, modelled (replacing the ten one-triangle blades of Phase 7's tuft): a clump of cereal
// tillers as the field shows them at walking distance: five culms rising from one root (a sown seed tillers into 3-8 culms:
// B for barley and wheat), each a stem with one or two leaf blades arching out and down from its lower nodes and, at its top, the
// ear: a slender two-sided spike (barley's and emmer's ears are 6-10 cm, flattened, bearded: C for the form at this scale)
// with its awns as a fine fan above it. Unit height (the crop height scales it in the shader, crops.ts); the attributes the
// crop shader reads: `tip` (0 at the root, 1 at the top: colour ramp and sway), `ear` (1 on the ear and awns: shown only on
// the cereal rows after heading), `ebase` (the ear's base point: an ear not yet out is collapsed onto it). ~80 triangles.
import * as THREE from 'three/webgpu';

const fr = (k: number, s: number) => { const x = Math.sin(k * 127.1 + s * 311.7) * 43758.5453; return x - Math.floor(x); };

export function cerealClumpGeometry(culms = 5): THREE.BufferGeometry {
  const P: number[] = [], T: number[] = [], E: number[] = [], B: number[] = [];
  const tri = (a: number[], b: number[], c: number[], ta: number, tb: number, tc: number, ear: number, base: number[]) => {
    P.push(...a, ...b, ...c); T.push(ta, tb, tc); E.push(ear, ear, ear); B.push(...base, ...base, ...base); };
  const quad = (a: number[], b: number[], c: number[], d: number[], t0: number, t1: number, ear: number, base: number[]) => { tri(a, b, c, t0, t0, t1, ear, base); tri(b, d, c, t0, t1, t1, ear, base); };
  for (let k = 0; k < culms; k++) {
    const az = k * 2.39996 + fr(k, 1) * 0.6, r0 = 0.015 + 0.03 * fr(k, 2), lean = 0.06 + 0.12 * fr(k, 3), H = 0.82 + 0.18 * fr(k, 4);
    const cx = Math.cos(az), cz = Math.sin(az), px = -cz, pz = cx; // outward and across
    const at = (t: number) => [cx * (r0 + lean * t * t), H * t, cz * (r0 + lean * t * t)];
    // the culm: two segments, a thin strip facing across its lean (seen edge-on it all but vanishes: crossed by its leaves)
    const w = 0.0045;
    for (let s = 0; s < 1; s++) { const t0 = 0, t1 = 1, a = at(t0), b = at(t1);
      quad([a[0] - px * w, a[1], a[2] - pz * w], [a[0] + px * w, a[1], a[2] + pz * w], [b[0] - px * w, b[1], b[2] - pz * w], [b[0] + px * w, b[1], b[2] + pz * w], t0 * H, t1 * H, 0, [0, 0, 0]); }
    // two leaf blades from the lower nodes, arching out and drooping (three segments, tapering)
    for (let l = 0; l < 1 + (k % 2); l++) {
      const tn = 0.22 + 0.25 * l + 0.08 * fr(k, 5 + l), n0 = at(tn), la = az + (l ? 2.2 : -2.0) + 0.6 * (fr(k, 7 + l) - 0.5), lx = Math.cos(la), lz = Math.sin(la), qx = -lz, qz = lx;
      const L = 0.2 + 0.12 * fr(k, 9 + l); let prev = n0, pw = 0.009;
      for (let s = 1; s <= 2; s++) { const u = s / 2, out = L * u, up = L * (0.55 * u - 0.75 * u * u), nw = 0.009 * (1 - u * 0.85);
        const cur = [n0[0] + lx * out, n0[1] + up, n0[2] + lz * out];
        quad([prev[0] - qx * pw, prev[1], prev[2] - qz * pw], [prev[0] + qx * pw, prev[1], prev[2] + qz * pw], [cur[0] - qx * nw, cur[1], cur[2] - qz * nw], [cur[0] + qx * nw, cur[1], cur[2] + qz * nw], prev[1], cur[1], 0, [0, 0, 0]);
        prev = cur; pw = nw; }
    }
    // the ear: a spike on the culm's top, two crossed tapered blades (0.08 long, 0.014 wide), and its awns as a fan above
    const top = at(1), dir = [cx * lean * 2 / H, 1, cz * lean * 2 / H], dl = Math.hypot(dir[0], dir[1], dir[2]), d = dir.map(v => v / dl);
    const EL = 0.085, EW = 0.0075;
    for (const [ax, az2] of [[px, pz], [cx, cz]]) {
      const m1 = [top[0] + d[0] * EL * 0.45, top[1] + d[1] * EL * 0.45, top[2] + d[2] * EL * 0.45], e1 = [top[0] + d[0] * EL, top[1] + d[1] * EL, top[2] + d[2] * EL];
      quad([top[0] - ax * EW * 0.6, top[1], top[2] - az2 * EW * 0.6], [top[0] + ax * EW * 0.6, top[1], top[2] + az2 * EW * 0.6], [m1[0] - ax * EW, m1[1], m1[2] - az2 * EW], [m1[0] + ax * EW, m1[1], m1[2] + az2 * EW], H, H + EL * 0.45, 1, top);
      tri([m1[0] - ax * EW, m1[1], m1[2] - az2 * EW], [m1[0] + ax * EW, m1[1], m1[2] + az2 * EW], e1, H + EL * 0.45, H + EL * 0.45, H + EL, 1, top);
    }
    // awns: a thin fan (barley's long beard, 10-15 cm: C), one triangle each side of the ear
    const AW = 0.11, a1 = [top[0] + d[0] * (EL + AW) + px * 0.012, top[1] + d[1] * (EL + AW), top[2] + d[2] * (EL + AW) + pz * 0.012], a2 = [top[0] + d[0] * (EL + AW) - px * 0.012, top[1] + d[1] * (EL + AW), top[2] + d[2] * (EL + AW) - pz * 0.012];
    const eb = [top[0] + d[0] * EL * 0.3, top[1] + d[1] * EL * 0.3, top[2] + d[2] * EL * 0.3];
    tri([eb[0] - px * 0.002, eb[1], eb[2] - pz * 0.002], [eb[0] + px * 0.002, eb[1], eb[2] + pz * 0.002], a1, H, H, H + EL + AW, 1, top);
    tri([eb[0] - px * 0.002, eb[1], eb[2] - pz * 0.002], [eb[0] + px * 0.002, eb[1], eb[2] + pz * 0.002], a2, H, H, H + EL + AW, 1, top);
  }
  // `tip` as the height fraction of the whole plant (its top, awns included, is 1)
  const Hmax = Math.max(...T); for (let i = 0; i < T.length; i++) T[i] = Math.max(0, T[i]) / Hmax;
  const s = 1 / Hmax; for (let i = 0; i < P.length; i += 3) P[i + 1] *= s; for (let i = 0; i < B.length; i += 3) B[i + 1] *= s;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('tip', new THREE.Float32BufferAttribute(T, 1));
  g.setAttribute('ear', new THREE.Float32BufferAttribute(E, 1)); g.setAttribute('ebase', new THREE.Float32BufferAttribute(B, 3));
  g.computeVertexNormals(); return g;
}
