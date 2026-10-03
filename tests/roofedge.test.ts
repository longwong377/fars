// D-334: the palaces' wall heads, roof edges and wall feet (src/arch/roofedge.ts), the roof-edge kit (src/arch/palacekit.ts,
// tools/blender/palacekit.py), the painted interiors and the bare courses of the walls under construction (meshes.ts), the
// roofs' earth and the Blender bakes (scans.ts WALL_BAKE). The class, world-wide: every roof of the Terrace and every exposed
// mud-brick top carries its edge; nothing of it is a part (colliders, the walkable grid, the probes and the plan tests keep
// the parts); within the budget.
import { describe, it, expect } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { buildTerrace } from '../src/arch/terrace';
import { roofEdges, wallFeet, ROOFEDGE } from '../src/arch/roofedge';
import { buildMeshes, PAINTED_INTERIORS, renderMaterial } from '../src/arch/meshes';
import { PALACE_KIT, pieceMatrix, PIECE_SWITCH } from '../src/arch/palacekit';
import { SURFACES } from '../src/render/materials';
import { WALL_BAKE, SCAN_USE } from '../src/render/scans';
import type { Box } from '../src/arch/parts';

const { parts } = buildTerrace();
const R = roofEdges(parts), F = wallFeet(parts);

describe('D-334 roof edges and wall heads', () => {
  it('every roof of every finished building has a parapet on its free edges, and nothing of it is a part', () => {
    const roofs = parts.filter(p => p.kind === 'roof') as Box[];
    expect(roofs.length).toBeGreaterThan(20);
    for (const b of new Set(roofs.map(r => r.building))) expect(R.boxes.some(x => x.building === b && x.kind === 'parapet'), b).toBe(true);
    // every free edge metre is drawn: parapets cover (within the sampling) the free metres
    const parapetM = R.boxes.filter(x => x.kind === 'parapet').reduce((a, x) => a + x.size[0], 0);
    expect(parapetM).toBeCloseTo(R.stats.metres, -1);
    for (const x of [...R.boxes, ...F]) { expect(x.solid).toBe(false); expect(x.tier).toBe('C'); expect(parts.includes(x)).toBe(false); }
    expect(parts.some(p => ['string_course', 'fascia', 'roof_cap', 'wall_foot'].includes(p.kind))).toBe(false); // ('parapet' and 'coping' are also the stairs' own parts)
  });
  it('porticos take the timber entablature (three fasciae, the joists\' ends at their spacing); walls the string course and spouts', () => {
    expect(R.stats.open).toBeGreaterThan(5);
    for (const b of ['apadana', 'tachara', 'hadish']) {
      expect(R.pieces.some(p => p.building === b && p.kind === 'dentil'), b).toBe(true);
      expect(R.boxes.filter(x => x.building === b && x.kind === 'fascia').length % ROOFEDGE.fasciae.n, b).toBe(0);
    }
    expect(R.pieces.filter(p => p.kind === 'spout').length).toBeGreaterThan(200);
    expect(R.boxes.some(x => x.building === 'fortification_e' && x.kind === 'merlon')).toBe(true);
    // no piece on another piece: dentils of a run stand >= their width apart
    const d = R.pieces.filter(p => p.kind === 'dentil');
    for (let i = 1; i < d.length; i++) if (d[i].az === d[i - 1].az && d[i].building === d[i - 1].building) {
      const g = Math.hypot(d[i].e - d[i - 1].e, d[i].n - d[i - 1].n); if (g < 2) expect(g).toBeGreaterThan(ROOFEDGE.dentil.w);
    }
  });
  it('a piece stands out of its wall along the edge\'s outward normal', () => {
    const p = { kind: 'spout' as const, building: 'x', e: 10, n: 20, y: 5, az: Math.PI / 2, len: 0.55 }; // outward = grid north
    const m = pieceMatrix(p, 1).elements; // column-major: local z -> world (m[8], m[9], m[10])
    expect(m[8]).toBeCloseTo(0, 6); expect(m[10]).toBeCloseTo(-0.55, 6); // world -z = grid north, scaled by the length
    expect([m[12], m[13], m[14]]).toEqual([10, 5, -20]);
  });
  it('the wall feet: the halls\' red floor coat turned up at the walls, the mud fillet on the paving', () => {
    expect(F.some(f => f.material === 'plaster_red')).toBe(true); expect(F.some(f => f.material === 'mudbrick')).toBe(true);
    const m = F.reduce((a, f) => a + f.size[0], 0); expect(m).toBeGreaterThan(3000);
  });
  it('the kit: modelled pieces, AO baked, within their budget; a far level for each', () => {
    for (const k of ['dentil0', 'dentil1', 'dentil2', 'spout0', 'spout1']) { const q = PALACE_KIT[k]; expect(q.tris, k).toBeGreaterThan(100); expect(q.tris, k).toBeLessThanOrEqual(320);
      const ao = q.ao; expect(Math.min(...ao)).toBeLessThan(0.95); expect(Math.max(...ao)).toBeLessThanOrEqual(1); }
    expect(PALACE_KIT.dentilL.tris).toBe(12); expect(PALACE_KIT.spoutL.tris).toBe(12); expect(PIECE_SWITCH).toBeLessThan(40);
  });
  it('built with the world: triangles within budget, the class drawn in its materials', () => {
    const B = buildMeshes(parts), B0 = buildMeshes(parts, undefined, { noRoofEdges: true });
    const added = B.triangles - B0.triangles;
    expect(added).toBeGreaterThan(0); expect(added).toBeLessThan(600000); // (the pieces at full detail: ~310 k; beyond 28 m 12 each)
    const names = new Set<string>(); B.group.traverse(o => names.add(o.name));
    expect([...names].some(n => n.startsWith('roofedge:dentil'))).toBe(true); expect([...names].some(n => n.startsWith('roofedge:spout'))).toBe(true);
    expect([...names].some(n => /:roof_earth(:edge)?$/.test(n))).toBe(true);
    // the Now view keeps none of it (no work there, UD-20)
    expect(buildMeshes(parts.map(p => ({ ...p, now: 'x' }) as any)).roofEdges).toBeUndefined();
  }, 600000);
});

describe('D-334 surfaces', () => {
  it('the roofs are earth on top, cedar at the sides, matting under; the walls under construction bare brick', () => {
    expect(SURFACES.roof_timber.top).toBe('roof_earth'); expect(SURFACES.roof_timber.under).toBe('matting');
    expect(SURFACES.roof_earth).toBeDefined(); expect(SCAN_USE.roof_earth.alb).toBeGreaterThanOrEqual(0.3);
    const uc = parts.filter(p => p.material === 'mudbrick' && /under construction/.test(p.note ?? ''));
    expect(uc.length).toBeGreaterThan(0); for (const p of uc) expect(renderMaterial(p)).toBe('mudbrick_bare');
    expect(SURFACES.mudbrick_bare.joints).toBeDefined();
  });
  it('the palaces\' interiors are painted (the evidenced scheme\'s colours), the service ranges not', () => {
    for (const k of ['mudbrick', 'mudbrick_painted', 'palace_plaster']) expect(SURFACES[k].paint, k).toBeDefined();
    expect(SURFACES.palace_plaster.outerPaint).toBeDefined(); expect(SURFACES.palace_plaster.earthWeather!.loss.cover).toBe(0); // D-752: painted outside too, no fallen plaster
    expect(PAINTED_INTERIORS.has('apadana')).toBe(true); expect(PAINTED_INTERIORS.has('garrison')).toBe(false); expect(PAINTED_INTERIORS.has('hall100')).toBe(false);
    const B = buildMeshes(parts); let inner = 0, outer = 0;
    B.group.traverse(o => { const g = (o as any).geometry; if (!g || !/^(apadana|garrison):(mudbrick|palace_plaster)/.test(o.name)) return; /* (D-752: the palaces' walls draw in palace_plaster) */ const a = g.getAttribute('inner'); if (!a) return;
      for (let i = 0; i < a.count; i++) { if (a.getX(i) > 0.5) { if (o.name.startsWith('garrison')) outer++; else inner++; } } });
    expect(inner).toBeGreaterThan(100); expect(outer).toBe(0);
  }, 600000);
  it('the Blender bakes are shipped as KTX2 and laid on every palace wall and roof', () => {
    for (const k of ['mudbrick', 'mudbrick_painted', 'palace_plaster', 'roof_earth']) { const b = WALL_BAKE[k]; expect(b?.ktx, k).toBe(true);
      const f = `public/textures/${b.tex}/bake.ktx2`; expect(existsSync(f), f).toBe(true); expect(statSync(f).size).toBeLessThan(2e6); }
  });
});
