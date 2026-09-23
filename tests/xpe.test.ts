// XPe on the Hadish E and W doorways (D-066): the edition text (ARIo Q007213) in three versions, carved on both reveals of
// each doorway above the king and attendants, inside the reveal, facing into the opening.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../src/arch/terrace';
import { loadInscriptionFonts, buildInscriptions, buildPhase4Reliefs } from '../src/arch/decor';
import { phase4Programmes } from '../src/arch/relief_programmes';
import { kindBounds, baseKind } from '../src/arch/relief_figures';
import inscriptions from '../src/data/inscriptions.json';

beforeAll(async () => { await loadInscriptionFonts(async p => { const b = readFileSync('public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; }); });

describe('XPe (Hadish E and W doorways)', () => {
  it('the text is the edition\'s: Xerxes, great king, king of kings, son of king Darius, the Achaemenid', () => {
    const t = (inscriptions as any).XPe;
    expect(t.ario).toBe('Q007213');
    expect(t.op_translit.split(' ')).toEqual(['Xšayaṛšā', 'xšāyaθiya', 'vazṛka', 'xšāyaθiya', 'xšāyaθiyānām', 'Dārayavahau̯š', 'xšāyaθiyahyā', 'puça', 'Haxāmanišiya']);
    expect(t.el_unmapped).toEqual([]); expect(t.bab_unmapped).toEqual([]);
    expect(t.bab_atf.startsWith('{m}hi-ši-ʾ-ar-ši LUGAL GAL-u₂')).toBe(true);
  });
  it('carved on both reveals of both doorways, three versions each, above the figures and inside the reveal', () => {
    const { manifest, parts, doorways } = buildTerrace();
    const p4 = buildPhase4Reliefs(doorways), g = buildInscriptions(manifest, parts, p4.inscriptions); g.updateMatrixWorld(true);
    const figures = phase4Programmes(doorways).find(p => p.name === 'relief:hadish-jambs')!.items;
    for (const ver of ['op', 'el', 'bab']) expect(g.children.filter(c => c.name === `inscription:XPe:${ver}`).length, ver).toBe(4);
    for (const door of ['E', 'W']) {
      const d = doorways.find(q => q.building === 'hadish' && q.door === door)!;
      const panels = g.children.filter(c => c.name.startsWith('inscription:XPe:') && !c.name.endsWith(':pick')) as THREE.Mesh[];
      const mine = panels.filter(m => { const b = new THREE.Box3().setFromObject(m), c = b.getCenter(new THREE.Vector3()); return Math.hypot(c.x - d.c[0], -c.z - d.c[1]) < d.width / 2 + d.depth; });
      expect(mine.length, door).toBe(6);
      const figTop = Math.max(...figures.filter(i => String((i.meta as any).where).startsWith(`hadish:${door} `)).map(i => i.o.y + i.S * kindBounds(baseKind(i.kind), i.seed)[3]));
      for (const m of mine) {
        m.updateMatrixWorld(true); const b = new THREE.Box3().setFromObject(m);
        expect(b.min.y, `${door} ${m.name} above the figures`).toBeGreaterThan(figTop + 0.05);
        const tris = (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; expect(tris, 'flat signs').toBeLessThan(20000);
        expect(b.max.y, `${door} ${m.name} under the reveal top`).toBeLessThan(d.y0 + d.height);
        // on a reveal: half the door width from the axis, within the passage depth
        const c = b.getCenter(new THREE.Vector3()), rel = [c.x - d.c[0], -c.z - d.c[1]];
        const across = Math.abs(rel[0] * d.u[0] + rel[1] * d.u[1]), along = Math.abs(rel[0] * d.n[0] + rel[1] * d.n[1]);
        expect(across, m.name).toBeCloseTo(d.width / 2, 1); expect(along + 0.01, m.name).toBeLessThan(d.depth / 2 + d.proj);
      }
    }
  });
});
