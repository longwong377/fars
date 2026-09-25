// Masons' and sculptors' marks (D-212; gap audit item 13): only the four attested shapes are cut, as V-section incisions;
// on the Apadana stair reliefs they lie on the background, clear of every figure, on the façade's face; the same run of
// teams on both stairs; on the Hall of 100 Columns' yard each dressed drum carries one on its upper bedding face.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { readFileSync } from 'fs';
import { buildTerrace } from '../src/arch/terrace';
import { buildMeshes } from '../src/arch/meshes';
import { v } from '../src/arch/spec';
import { apadanaFacades, hostFace } from '../src/arch/decor';
import { planFacade } from '../src/arch/reliefs';
import { atlasDepthEm } from '../src/arch/carving';
import { marksAtlas, reliefMarkPlacements, buildReliefMarks, figureBoxes, markClear, drumMark, MARK_SHAPES } from '../src/arch/marks';
import { Construction } from '../src/people/construction';
import { ConstructionView } from '../src/world/construction';
import sources from '../src/data/sources.json';

const { parts, manifest } = buildTerrace();
const MM = v<any>('global', 'r_masons_marks');

describe('masons\' marks: the shapes', () => {
  it('only the four attested shapes are in the atlas, each cut as a V-section of the stroke', () => {
    const A = marksAtlas();
    expect([...A.cells.keys()].sort()).toEqual(['angle', 'circle', 'cross', 'double_lozenge']);
    expect([...MARK_SHAPES()].sort()).toEqual(['angle', 'circle', 'cross', 'double_lozenge']);
    for (const k of A.cells.keys()) expect(A.cells.get(k)!.maxDepthEm, k).toBeCloseTo(MM.stroke_em / 2, 1); // depth = half the stroke (walls at 45°)
    expect(atlasDepthEm(A, 'circle', 0.5, 0.5)).toBe(0); // the circle is a ring
    expect(atlasDepthEm(A, 'circle', 0.5 + 0.42 - MM.stroke_em / 2, 0.5)).toBeGreaterThan(0.02);
    expect(atlasDepthEm(A, 'cross', 0.5, 0.5)).toBeGreaterThan(0.03);
    expect(atlasDepthEm(A, 'double_lozenge', 0.285, 0.5)).toBe(0); // two open lozenges joined point to point
    expect(atlasDepthEm(A, 'double_lozenge', 0.354, 0.657)).toBeGreaterThan(0.03); // mid-stroke on the left lozenge's upper right side
    expect(atlasDepthEm(A, 'angle', 0.6, 0.6)).toBe(0); expect(atlasDepthEm(A, 'angle', 0.28, 0.5)).toBeGreaterThan(0.03);
  });
  it('the row is tier C and its sources exist', () => {
    const r = (JSON.parse(readFileSync('src/data/site_spec.json', 'utf8')) as any).global.r_masons_marks;
    expect(r.tier).toBe('C'); for (const k of r.src.split(';')) expect(Object.keys(sources), k).toContain(k);
  });
});

describe('masons\' marks: the Apadana stair reliefs', () => {
  const P = reliefMarkPlacements(manifest, parts);
  const R = v<any>('apadana', 'r_registers'), CV = v<any>('apadana', 'r_relief_carving'), figH = R.height * CV.figure_fill;
  it('dozens of marks on both stairs, on the background clear of every figure, on the façade\'s own face', () => {
    expect(P.length).toBeGreaterThan(40);
    expect(new Set(P.map(p => p.facade))).toEqual(new Set(['N', 'E']));
    const a = manifest.apadana as any, sg = { spans: a.stairSpans, riser: a.stairRiser, tread: a.stairTread, parapet: a.parapet, podium: a.podium };
    for (const f of apadanaFacades(manifest)) {
      const boxes = figureBoxes(planFacade(f, sg).figures, figH);
      for (const p of P.filter(q => q.facade === f.id)) {
        const along = (p.o.x - f.origin[0]) * f.along[0] + (-p.o.z - f.origin[1]) * f.along[1], y = p.o.y - f.y0;
        expect(markClear(boxes, along, y, p.size), p.where).toBe(true);
        const face = hostFace(parts, [p.o.x, -p.o.z], p.o.y, f.normal as [number, number]);
        expect(face, p.where).not.toBeNull(); expect(Math.abs(face!.d), p.where).toBeLessThan(1e-6); // on the stone's face
        expect(p.o.y).toBeGreaterThan(R.bottom); expect(p.o.y).toBeLessThan(R.bottom + R.count * (R.height + R.gap));
      }
    }
  });
  it('the same run of teams on both stairs (the same teams on both Apadana stairs)', () => {
    const seq = (id: string) => P.filter(p => p.facade === id && p.where.includes('guard')).map(p => p.shape).join(',');
    expect(seq('N').length).toBeGreaterThan(0); expect(seq('N')).toBe(seq('E'));
  });
  it('one mesh of incised quads per host stone, two triangles a mark, tier C with a note per mark', () => {
    const g = buildReliefMarks(manifest, parts); let n = 0;
    g.traverse(o => { const m = o as THREE.Mesh; if (!m.isMesh) return; n += m.userData.marks; expect(m.userData.tier).toBe('C');
      expect(m.geometry.index!.count / 3).toBe(2 * m.userData.marks); expect(m.userData.describe({ faceIndex: 0 }).note).toMatch(/mark/);
      expect(m.userData.depth).toBeGreaterThan(0.001); expect(m.userData.depth).toBeLessThan(0.006); });
    expect(n).toBe(P.length);
  });
});

describe('masons\' marks: the dressed drums', () => {
  it('each mark lies on its drum\'s upper face, inside the drum', () => {
    for (let k = 0; k < 12; k++) { const c = new THREE.Vector3(100, 5, 20), r = 0.8, m = drumMark(c, r, k);
      expect(m.o.y).toBe(c.y); expect(Math.hypot(m.o.x - c.x, m.o.z - c.z) + m.size * 0.75).toBeLessThan(r);
      expect(m.X.clone().cross(m.Y).y).toBeCloseTo(1, 6); } // the cut faces up
  });
  it('the masons\' yard carries one mark per dressed drum', () => {
    const arch = buildMeshes(parts), C = new Construction(1), view = new ConstructionView(arch.group, () => C);
    const marksNow = () => (view.group.getObjectByName('hall100:site')!.getObjectByName('hall100:site:marks') as THREE.Mesh | undefined)?.userData.marks ?? 0;
    expect(view.site.dressed).toBe(0); expect(marksNow()).toBe(0);
    // plenty of stone and few hands: dressed drums wait in the yard (they are raised as soon as they are dressed otherwise)
    let seen = 0;
    for (let d = 0; d < 12; d++) { C.step(d, { stone: 200, labour: 20, brick: 20, frost: false, wet: false, storm: false }); view.sync();
      expect(marksNow(), `day ${d}`).toBe(view.site.dressed); seen = Math.max(seen, view.site.dressed); }
    expect(seen).toBeGreaterThan(0);
  });
});
