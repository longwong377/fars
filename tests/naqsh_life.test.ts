// s18 C15 (D-800): Naqsh-e Rustam in use: the façades painted and gilded, the DNc-DNe captions carved from the edition, the
// second tomb's works, the keepers' house where the people's keepers live, the offering table
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { loadTerrain, loadRiversFile } from './plainLib';
import { buildNaqsh, KEEPERS_HOUSE } from '../src/world/plain/naqsh';
import { facadePaint } from '../src/world/plain/naqsh_paint';
import { NAQSH } from '../src/people/population';
import { loadInscriptionFonts } from '../src/arch/decor';
import { loadMonumentsNode } from './lib/monuments_node';
import CAP from '../src/world/plain/naqsh_captions.json';

beforeAll(async () => { await loadInscriptionFonts(async p => { const b = readFileSync('public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; }); loadMonumentsNode(); });
describe('Naqsh-e Rustam in 467 (D-800)', () => {
  const T = loadTerrain(), R = loadRiversFile();
  it('the façades are painted and gilded on their architecture, the reliefs\' ground left bare', () => {
    const N = buildNaqsh(T, R.nrAncientFootAsl), nr = N.group;
    for (const id of ['nr_darius_tomb', 'nr_xerxes_tomb']) { const m = nr.getObjectByName(id) as THREE.Mesh, g = m.geometry, cov = g.getAttribute('pcov'), gl = g.getAttribute('pgilt');
      let painted = 0, gilt = 0; for (let i = 0; i < cov.count; i++) { if (cov.getX(i) > 0) painted++; if (gl.getX(i) > 0.5) gilt++; }
      expect(painted / cov.count, id).toBeGreaterThan(0.15); expect(painted / cov.count, id).toBeLessThan(0.9); expect(gilt, id).toBeGreaterThan(20); }
    const F = { hMid: 21.83, hTop: 29.43, ch: 5.3, colX: [-5.6, -2.1, 2.1, 5.6], doorW: 1.4, doorH: 2.8, span: 8.6, bearerH: 1.35 };
    expect(facadePaint(F, 0, 33, 0.01, 0)[1], 'the recess\'s back (the reliefs\' ground) is bare').toBe(0);
    expect(facadePaint(F, 0, 18, 0.3, 0)[1], 'the lower arm is bare').toBe(0);
    expect(facadePaint(F, 0, 27.3, 0.3, 0)[1], 'the architrave is painted').toBeGreaterThan(0.5);
  });
  it('the captions are the edition\'s Old Persian (ARIo Q007154-6), lost lines uncut', () => {
    expect((CAP as any).DNc.op_signs[0]).toMatch(/^ga-u-ba-ru-u-va : pa-a-ta-i-ša-u-va-ra-i-ša/); // Gaubaruva Pātišuvariš
    expect((CAP as any).DNd.op_signs[0]).toMatch(/^a-sa-pa-ca-na-a : va-ça-ba-ra/); // Aspacanā vaçabara
    const L = (CAP as any).DNe.lines as (string[] | null)[]; expect(L.length).toBe(30); expect(L.filter(x => !x).length).toBe(12); expect(L[0]![0]).toBe('i-ya-ma : pa-a-ra-sa');
    const note = String((buildNaqsh(T, R.nrAncientFootAsl).texts.getObjectByName('nr-inscriptions-carved') as THREE.Mesh).userData.note);
    expect(note).toMatch(/DNc: \d+ signs/); expect(note).toMatch(/DNe1: \d+ signs/); expect(note).not.toMatch(/DOES NOT FIT/); expect(note).toMatch(/Elamite and Babylonian/);
  });
  it('the second tomb\'s scaffold and spoil, the keepers\' house at the people\'s house, the offering table', () => {
    expect(KEEPERS_HOUSE).toEqual(NAQSH.house);
    const life = buildNaqsh(T, R.nrAncientFootAsl).group.userData.life; console.log(JSON.stringify(life));
    expect(life.scaffoldMembers).toBeGreaterThan(100); expect(life.keepersHouse).toBe(1); expect(life.offering).toBe(1); expect(life.tris).toBeLessThan(20000);
  });
});
