// The Apadana foundation deposits (D-068): DPh from the edition, a stone box under the NE and SE hall corners with a gold and
// a silver plate, sealed below the floor under the wall, and a translation-layer pick at each corner.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../src/arch/terrace';
import { buildFoundationDeposits, INSCRIPTION_PICK_LAYER } from '../src/arch/decor';
import inscriptions from '../src/data/inscriptions.json';

const { parts, manifest } = buildTerrace();
const g = buildFoundationDeposits(manifest); g.updateMatrixWorld(true);
const a = manifest.apadana as any;

describe('Apadana foundation deposits', () => {
  it('DPh is the edition text in three versions', () => {
    const t = (inscriptions as any).DPh;
    expect(t.ario).toBe('Q007164');
    expect(t.op_translit).toContain('hacā Sakai̯biš tayai̯ para Sugdam amata yātā ā Kūšā hacā Hindau̯ amata yātā ā Spardā');
    expect(t.el_atf.startsWith('{DIŠ}da-ri-ia-ma-u-iš')).toBe(true);
    expect(t.bab_atf.startsWith('{m}da-a-ri-ia-muš LUGAL GAL-u₂')).toBe(true);
    expect(t.el_unmapped).toEqual([]); expect(t.bab_unmapped).toEqual([]);
  });
  it('a sealed box under the NE and SE corners of the hall wall, below the floor, with a gold and a silver plate', () => {
    for (const c of ['NE', 'SE']) {
      const box = g.getObjectByName(`foundation-box:${c}`) as THREE.Mesh; expect(box, c).toBeTruthy();
      const bb = new THREE.Box3().setFromObject(box);
      expect(bb.max.y, 'under the floor').toBeLessThan(a.podium - 0.3);
      const e = (bb.min.x + bb.max.x) / 2, n = -(bb.min.z + bb.max.z) / 2;
      const wall = parts.some((p: any) => p.building === 'apadana' && p.type === 'box' && p.kind === 'wall' && Math.abs(e - p.c[0]) < p.size[0] / 2 && Math.abs(n - p.c[1]) < p.size[1] / 2);
      expect(wall, `${c} box under the hall wall`).toBe(true);
      expect(Math.sign(e - a.hallCentre[0])).toBe(1); expect(Math.sign(n - a.hallCentre[1])).toBe(c === 'NE' ? 1 : -1);
      for (const metal of ['gold', 'silver']) {
        const p = g.getObjectByName(`foundation-plate:${c}:${metal}`) as THREE.Mesh; expect(p, metal).toBeTruthy();
        expect(bb.containsBox(new THREE.Box3().setFromObject(p)), `${metal} plate inside the box`).toBe(true);
        expect(p.userData.inscription).toBe('DPh');
      }
      const pick = g.getObjectByName(`inscription:DPh:deposit:${c}:pick`)!;
      expect(pick.layers.isEnabled(INSCRIPTION_PICK_LAYER)).toBe(true); expect(pick.layers.isEnabled(0)).toBe(false);
    }
    g.traverse(o => { if ((o as any).isMesh) expect(['A', 'B', 'C']).toContain(o.userData.tier); });
  });
});
