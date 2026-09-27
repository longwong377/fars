// Loop subdivision (Loop 1987) of a triangle mesh with open boundaries, for the Blender pipeline's cloth simulations (D-322):
// a garment piece as the game builds it (outfits.ts, 3-8 cm edges) is refined to the 1.5-2.6 cm the cloth solver needs to
// fold, smoothly (a midpoint split would leave the coarse facets' kinks in the cloth's rest shape, which the solver's bending
// springs keep as creases). Interior vertices take Loop's weights, boundary (hem, cuff, neck) vertices and edges the cubic
// B-spline rule along the boundary, so the rims stay where they are. Per-vertex attributes (any number of channels) are
// interpolated linearly (midpoints), except those listed in `smooth`, which take the same rules as the positions.
// The first n output vertices are the input's (repositioned); vertex n + k is the midpoint of the k-th distinct edge.

export interface SubMesh { pos: Float32Array; idx: Uint32Array; attrs: Record<string, Float32Array>; /** per vertex: [a, b] parents (a === b: an original vertex) at the first level */ parent?: Int32Array }

export function loopSubdivide(m: SubMesh, levels: number, smooth: string[] = []): SubMesh {
  let cur = m;
  for (let l = 0; l < levels; l++) cur = loopOnce(cur, smooth);
  return cur;
}

function loopOnce(m: SubMesh, smooth: string[]): SubMesh {
  const n = m.pos.length / 3, T = m.idx.length / 3;
  const ek = (a: number, b: number) => (a < b ? a * 4294967296 + b : b * 4294967296 + a);
  // edges: id, the vertices opposite in each adjacent triangle
  const edgeId = new Map<number, number>(), eA: number[] = [], eB: number[] = [], opp: number[][] = [];
  for (let t = 0; t < T; t++) for (let e = 0; e < 3; e++) {
    const a = m.idx[t * 3 + e], b = m.idx[t * 3 + (e + 1) % 3], c = m.idx[t * 3 + (e + 2) % 3], k = ek(a, b);
    let id = edgeId.get(k); if (id === undefined) { id = eA.length; edgeId.set(k, id); eA.push(a); eB.push(b); opp.push([]); }
    opp[id].push(c);
  }
  const E = eA.length, boundary = Uint8Array.from(opp, o => (o.length === 1 ? 1 : 0));
  const nbr: number[][] = Array.from({ length: n }, () => []), bnb: number[][] = Array.from({ length: n }, () => []);
  for (let e = 0; e < E; e++) { nbr[eA[e]].push(eB[e]); nbr[eB[e]].push(eA[e]); if (boundary[e]) { bnb[eA[e]].push(eB[e]); bnb[eB[e]].push(eA[e]); } }
  const chans = (a: Float32Array) => a.length / n;
  const mix = (src: Float32Array, c: number, out: Float32Array, i: number, terms: [number, number][]) => { for (let q = 0; q < c; q++) { let s = 0; for (const [v, w] of terms) s += src[v * c + q] * w; out[i * c + q] = s; } };
  // the rules: an original vertex (interior: Loop's β; boundary: 1/8, 3/4, 1/8 along the boundary; a corner (≠ 2 boundary
  // neighbours) stays), a new edge vertex (interior: 3/8, 3/8, 1/8, 1/8; boundary: 1/2, 1/2)
  const vRule = (i: number): [number, number][] => {
    if (bnb[i].length) return bnb[i].length === 2 ? [[i, 0.75], [bnb[i][0], 0.125], [bnb[i][1], 0.125]] : [[i, 1]];
    const k = nbr[i].length; if (k < 3) return [[i, 1]];
    const beta = k === 3 ? 3 / 16 : 3 / (8 * k); return [[i, 1 - k * beta], ...nbr[i].map(j => [j, beta] as [number, number])];
  };
  const eRule = (e: number): [number, number][] => boundary[e] || opp[e].length !== 2 ? [[eA[e], 0.5], [eB[e], 0.5]] : [[eA[e], 0.375], [eB[e], 0.375], [opp[e][0], 0.125], [opp[e][1], 0.125]];
  const eMid = (e: number): [number, number][] => [[eA[e], 0.5], [eB[e], 0.5]];
  const N = n + E, pos = new Float32Array(N * 3), attrs: Record<string, Float32Array> = {};
  for (let i = 0; i < n; i++) mix(m.pos, 3, pos, i, vRule(i));
  for (let e = 0; e < E; e++) mix(m.pos, 3, pos, n + e, eRule(e));
  for (const [k, a] of Object.entries(m.attrs)) { const c = chans(a), o = new Float32Array(N * c), sm = smooth.includes(k);
    for (let i = 0; i < n; i++) mix(a, c, o, i, sm ? vRule(i) : [[i, 1]]);
    for (let e = 0; e < E; e++) mix(a, c, o, n + e, sm ? eRule(e) : eMid(e)); attrs[k] = o; }
  const idx = new Uint32Array(T * 12);
  for (let t = 0; t < T; t++) {
    const a = m.idx[t * 3], b = m.idx[t * 3 + 1], c = m.idx[t * 3 + 2];
    const ab = n + edgeId.get(ek(a, b))!, bc = n + edgeId.get(ek(b, c))!, ca = n + edgeId.get(ek(c, a))!;
    idx.set([a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca], t * 12);
  }
  const parent = new Int32Array(N * 2); for (let i = 0; i < n; i++) { parent[i * 2] = i; parent[i * 2 + 1] = i; } for (let e = 0; e < E; e++) { parent[(n + e) * 2] = eA[e]; parent[(n + e) * 2 + 1] = eB[e]; }
  return { pos, idx, attrs, parent };
}
