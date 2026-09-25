// Carved-stone surfaces and relief paint (D-029..D-031): the polychromy rows, the pigment albedos derived from them, the
// paint coverage and wear the relief meshes carry, the hairline (not sunk) masonry joints, the joint-free carved stone used
// by columns, colossi and reliefs, and the dark grey (not black) door-frame limestone. Measurements, not screenshots.
import { describe, it, expect } from 'vitest';
import PC from '../src/data/polychromy.json';
import sources from '../src/data/sources.json';
import { labToLinear, linearToSrgb, srgbToLinear, luminance, munsellY } from '../src/core/colour';
import { SURFACES, paintedStoneMaterial, surfaceMaterial } from '../src/render/materials';
import { PIGMENT, figureDef } from '../src/arch/relief_figures';
import { STONE_SRGB, GILT_SRGB, rasterize, rtinErrors, extractLod } from '../src/arch/relief_field';
import { reliefLodMesh, lodGeometry, RELIEF_LODS } from '../src/arch/reliefs';
import { buildTerrace } from '../src/arch/terrace';
import { buildMeshes } from '../src/arch/meshes';

const lin = (c: number[]) => c.map(srgbToLinear) as [number, number, number];

describe('colour conversions', () => {
  it('CIELAB → linear sRGB reproduces the D65 white, a mid grey and the sRGB transfer function round trip', () => {
    const w = labToLinear(100, 0, 0); for (const c of w) expect(c).toBeCloseTo(1, 3);
    const g = labToLinear(50, 0, 0); for (const c of g) expect(c).toBeCloseTo(0.1842, 3); // Y(L* = 50) = 18.42 %
    for (const v of [0, 0.002, 0.2, 0.5, 1]) expect(srgbToLinear(linearToSrgb(v))).toBeCloseTo(v, 6);
  });
  it('Munsell neutral value → luminous reflectance (ASTM D1535): N3 6.4 %, N5 19.3 %, N9.5 about 89 %', () => {
    expect(munsellY(3)).toBeCloseTo(0.0639, 3); expect(munsellY(5)).toBeCloseTo(0.1927, 3); expect(munsellY(9.5)).toBeGreaterThan(0.85);
  });
});

describe('polychromy.json', () => {
  it('every row has v/u/src/tier/note with known source keys; colour values are tier C', () => {
    for (const [g, rows] of Object.entries<any>(PC)) { if (g.startsWith('_')) continue;
      for (const [k, r] of Object.entries<any>(rows)) {
        for (const f of ['v', 'u', 'src', 'tier', 'note']) expect(r, `${g}.${k}.${f}`).toHaveProperty(f);
        expect(r.tier, `${g}.${k}`).toBe('C'); expect(r.note.length).toBeGreaterThan(20);
        for (const s of String(r.src).split(';')) expect(Object.keys(sources), `${g}.${k} src ${s}`).toContain(s);
      } }
  });
  it('the relief palette is the Lab rows converted, not display colours: plausible linear albedos for matte pigment films', () => {
    const P = (PC as any).pigment, Y = (k: string) => luminance(labToLinear(P[k].v[0], P[k].v[1], P[k].v[2]));
    expect(lin(PIGMENT.egyptianBlue)[2]).toBeCloseTo(labToLinear(50, -3, -34)[2], 2);
    expect(Y('egyptian_blue')).toBeGreaterThan(0.12); expect(Y('egyptian_blue')).toBeLessThan(0.3);   // a light mid blue, not navy
    expect(Y('dark_blue')).toBeGreaterThan(0.03); expect(Y('dark_blue')).toBeLessThan(0.1);            // dark, but not black
    expect(Y('black')).toBeGreaterThan(0.02);                                                          // a matte black film is ~3 %
    expect(Y('white')).toBeLessThan(0.9);                                                              // calcite white, not 100 %
    for (const k of Object.keys(P)) { const c = labToLinear(P[k].v[0], P[k].v[1], P[k].v[2]); for (const x of c) { expect(x, k).toBeGreaterThanOrEqual(0); expect(x, k).toBeLessThanOrEqual(0.9); } }
    // chroma stays mineral: no channel above 0.9 and the saturated reds keep some green/blue
    expect(lin(PIGMENT.cinnabar)[1]).toBeGreaterThan(0.03);
  });
  it('the unpainted relief stone is the carved limestone of the materials', () => {
    expect(STONE_SRGB).toEqual(SURFACES.limestone_carved.albedo); expect(PIGMENT.stone).toEqual(STONE_SRGB);
  });
});

describe('relief paint coverage (D-030)', () => {
  it('faces, animals and the background carry no paint; garments are painted, and worn along the raised arrises', () => {
    const horse = reliefLodMesh('horse', 0, 257, 1), lb = reliefLodMesh('lion_bull', 0, 257, 1);
    const paintedFrac = (m: typeof horse) => { let p = 0; for (let i = 0; i < m.verts; i++) if (m.paint[i] > 0) p++; return p / m.verts; };
    expect(paintedFrac(lb)).toBe(0); expect(paintedFrac(horse)).toBeLessThan(0.05); // the horse carries only its painted harness
    for (const [k, s] of [['persian', 0], ['guard', 0], ['delegate', 10], ['king', 0]] as [string, number][]) {
      const m = reliefLodMesh(k, s, 513, 0); let n = 0, sum = 0, worn = 0;
      for (let i = 0; i < m.verts; i++) if (m.paint[i] > 0) { n++; sum += m.paint[i]; if (m.paint[i] < 0.7) worn++; }
      expect(n / m.verts, `${k} painted share`).toBeGreaterThan(0.5);
      expect(sum / n, `${k} mean coverage`).toBeGreaterThan(0.8); expect(sum / n).toBeLessThan(0.99); // not full-coverage flat colour
      expect(worn / n, `${k} worn arris vertices`).toBeGreaterThan(0.02);
      for (let i = 0; i < m.verts; i++) { expect(m.paint[i]).toBeGreaterThanOrEqual(0); expect(m.paint[i]).toBeLessThanOrEqual(1); }
    }
  });
  it('the geometry carries the coverage and gilding attributes next to the pigment colour', () => {
    const g = lodGeometry(reliefLodMesh('persian', 0, 65, 3), true);
    expect(g.getAttribute('paint').itemSize).toBe(1); expect(g.getAttribute('paint').count).toBe(g.getAttribute('position').count);
    expect(g.getAttribute('gilt').itemSize).toBe(1); expect(g.getAttribute('gilt').count).toBe(g.getAttribute('position').count);
  });
  it('the relief material is the painted carved stone (no joints), not the ashlar limestone', () => {
    const m = paintedStoneMaterial(); expect(m.userData.note).toMatch(/joint-free/); expect(m).not.toBe(surfaceMaterial('limestone'));
  });
});

describe('gilding, the royal robe and paint edges (D-151)', () => {
  it('gilded masses carry gilt = 1 (the king\'s crown), everything else 0; the relief material draws the leaf as gold metal', () => {
    const k = reliefLodMesh('king', 0, 513, 0), gl = srgbToLinear(GILT_SRGB[0]);
    let n = 0; for (let i = 0; i < k.verts; i++) { expect(k.gilt[i] === 0 || k.gilt[i] === 1).toBe(true); if (k.gilt[i]) { n++; expect(k.col[i * 3]).toBeCloseTo(gl, 5); } }
    expect(n / k.verts, 'gilded share of the seated king (crown, sceptre, lotus)').toBeGreaterThan(0.01); expect(n / k.verts).toBeLessThan(0.2);
    const horse = reliefLodMesh('horse', 0, 257, 1); expect(Array.from(horse.gilt).some(x => x > 0), 'no gilding on an unpainted animal').toBe(false);
    const G = (PC as any).paint.gold.v; // the F0 of gold: red > green > blue, all within (0, 1]
    expect(G.f0[0]).toBeGreaterThan(G.f0[1]); expect(G.f0[1]).toBeGreaterThan(G.f0[2]); for (const c of G.f0) { expect(c).toBeGreaterThan(0); expect(c).toBeLessThanOrEqual(1); }
    expect(G.roughness).toBeGreaterThan(0.2); expect(G.roughness).toBeLessThan(0.6); // burnished leaf on carved stone, not a mirror
    const m = paintedStoneMaterial() as any; expect(m.metalnessNode).toBeTruthy(); expect(m.userData.note).toMatch(/gold leaf/);
  });
  it('the kings wear the royal robe: a patterned field and a blue strip with red lions at the hem (Iranica citing Tilia, B); a noble\'s robe is plain', () => {
    const f = rasterize(figureDef('king_walking', 0), 513), noble = rasterize(figureDef('persian', 0), 513);
    // share of the carved cells in a band of the robe (x within the robe, clear of the staff held in front) painted c
    const share = (F: typeof f, c: number[], y0: number, y1: number) => { let n = 0, t = 0; const k = F.palette.findIndex(p => p[0] === c[0] && p[1] === c[1] && p[2] === c[2]);
      for (let j = 0; j < F.n; j++) { const y = F.y0 + j * F.cell; if (y < y0 || y > y1) continue;
        for (let i = 0; i < F.n; i++) { const x = F.x0 + i * F.cell, g = j * F.n + i; if (x < -0.1 || x > 0.08 || F.h[g] <= 0) continue; t++; if (F.col[g] === k) n++; } }
      return n / Math.max(1, t); };
    expect(share(f, PIGMENT.cinnabar, 0.03, 0.08), 'red lions in the hem strip').toBeGreaterThan(0.03);
    expect(share(f, PIGMENT.egyptianBlue, 0.03, 0.08), 'the blue hem strip').toBeGreaterThan(0.2);
    expect(share(f, PIGMENT.yellowOchre, 0.15, 0.45), 'concentric circles on the field').toBeGreaterThan(0.01);
    expect(share(f, PIGMENT.white, 0.15, 0.45), 'lotus blossoms on the field').toBeGreaterThan(0.005);
    expect(share(noble, PIGMENT.yellowOchre, 0.15, 0.45) + share(noble, PIGMENT.white, 0.15, 0.45), 'no pattern on a noble\'s robe').toBeLessThan(0.002);
  });
  it('paint edges are refined at the finest LOD only: the colour-edge error lies between the L0 and L1 error bounds', () => {
    // the errors as the renderer and the workers compute them (default colour-edge error) against none for paint edges:
    // L0 (the arm's-length band) refines the painted pattern's edges, L1 and beyond do not spend triangles on paint
    const f = rasterize(figureDef('king_walking', 0), 513), e = rtinErrors(f), none = rtinErrors(f, 0);
    expect(extractLod(f, e, RELIEF_LODS[0].err, 1).tris, 'L0 follows the paint edges').toBeGreaterThan(extractLod(f, none, RELIEF_LODS[0].err, 1).tris * 1.1);
    expect(extractLod(f, e, RELIEF_LODS[1].err, 1).tris, 'L1 ignores them').toBe(extractLod(f, none, RELIEF_LODS[1].err, 1).tris);
  });
});

describe('masonry joints and carved stone (D-029)', () => {
  it('ashlar joints are hairlines (≤ 1 mm, anti-aliased), never a sunk groove; carved stone has none', () => {
    for (const k of ['limestone', 'terrace']) { const J = SURFACES[k].joints!; expect(J.width, k).toBeLessThanOrEqual(0.001); expect(J.dark).toBeLessThan(1); }
    expect(SURFACES.limestone_carved.joints).toBeUndefined();
  });
  it('columns and colossi are drawn in the joint-free carved stone; the Treasury columns have a stone base, plastered shaft and timber capital', () => {
    const { parts } = buildTerrace();
    const g = buildMeshes(parts.filter(p => p.building === 'apadana' || p.building === 'gate_nations' || p.building === 'treasury'));
    const cols = g.group.children.filter(o => /:columns/.test(o.name)) as any[];
    const surf = (o: any) => (o.levels ? o.levels[0] : o.children[0]).material.userData.note as string;
    for (const o of cols.filter(o => !o.name.startsWith('treasury'))) expect(surf(o), o.name).toBe(SURFACES.limestone_carved.note);
    for (const o of g.group.children.filter(o => o.name.includes(':colossus'))) expect(surf(o), o.name).toBe(SURFACES.limestone_carved.note);
    const tr = cols.filter(o => o.name.startsWith('treasury')).map(o => o.name).sort();
    expect(tr).toEqual(['treasury:columns:limestone', 'treasury:columns:plaster', 'treasury:columns:timber']);
    const byName = (n: string) => cols.find(o => o.name === n);
    expect(surf(byName('treasury:columns:limestone'))).toBe(SURFACES.limestone_carved.note);
    // the plastered shafts carry their paint since D-214 (the most probable scheme, C; Q-020), on the plaster surface
    expect(surf(byName('treasury:columns:plaster'))).toMatch(/^the Treasury shafts' paint \(D-214, Q-020\)/);
    expect(surf(byName('treasury:columns:timber'))).toBe(SURFACES.timber.note);
    expect(byName('treasury:columns:plaster').userData.placeholder).toBe(false);
    expect(byName('treasury:columns:plaster').userData.note).toMatch(/treasury\.r_shaft_paint/);
  });
});

describe('dark door-frame limestone (D-031)', () => {
  it('polished dark grey (Munsell N3 honed, 6.4 %; polished diffuse N2.7, 5.2 %: D-218), not black', () => {
    const Y = luminance(lin(SURFACES.limestone_dark.albedo));
    expect(Y).toBeCloseTo(munsellY(2.7), 3); expect(Y).toBeGreaterThan(0.05);
    expect(Y).toBeLessThan(luminance(lin(SURFACES.limestone.albedo)) / 2); // still clearly darker than the grey limestone
  });
});
