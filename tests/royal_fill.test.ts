// D-214 (gap audit items 27 and 28): the royal inscriptions' remaining copies, carved at their most probable places (C) from
// the published texts in the corpus: XPc on the Tachara's portico antae, XPd on the Hadish N portico's antae, DPb and XPk on
// the king's garment, XPj and XPm round the Hadish N portico's column-base drums, XPg on its plaque in the Apadana's N
// portico. Measured here: where each copy stands, that its cuts lie on the surface they are cut into, that its signs are
// the corpus's, and what it costs.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import * as THREE from 'three/webgpu';
import { buildTerrace } from '../src/arch/terrace';
import { loadInscriptionFonts, buildInscriptions, buildPhase4Reliefs, garmentFieldOf, fieldHeight } from '../src/arch/decor';
import { panelText } from '../src/arch/inscription_text';
import { antaPlan, baseRingPlan, xpgPlaquePlan } from '../src/arch/royal_fill';
import { v } from '../src/arch/spec';
import type { Box, Column, Pt } from '../src/arch/parts';
import type { InscriptionPlacement } from '../src/arch/relief_programmes';

let B: ReturnType<typeof buildTerrace>, g: THREE.Group, P4: ReturnType<typeof buildPhase4Reliefs>;
beforeAll(async () => {
  await loadInscriptionFonts(async p => { const b = readFileSync('public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; });
  B = buildTerrace(); P4 = buildPhase4Reliefs(B.doorways); g = buildInscriptions(B.manifest, B.parts, P4.inscriptions); g.updateMatrixWorld(true);
}, 180_000);
const carved = (id: string, ver?: string) => g.children.filter(c => c.name.startsWith(`inscription:${id}:${ver ?? ''}`) && !c.name.endsWith(':pick')) as THREE.Mesh[];
const squash = (s: string) => s.replace(/\s+/g, '');
const worldBox = (m: THREE.Mesh) => new THREE.Box3().setFromObject(m);
const normalOf = (m: THREE.Mesh) => new THREE.Vector3(0, 0, 1).transformDirection(m.matrixWorld);
const originOf = (m: THREE.Mesh) => new THREE.Vector3().setFromMatrixPosition(m.matrixWorld);

describe('XPc and XPd on the portico antae (tachara / hadish r_anta_inscription)', () => {
  it('two more copies of each, all three versions stacked, on the anta face turned to the portico, inside the stone\'s face', () => {
    const { stones, fields } = antaPlan(B.manifest);
    expect(stones.map(s => s.id).sort()).toEqual(['hadish-anta-E', 'hadish-anta-W', 'tachara-anta-E', 'tachara-anta-W']);
    for (const [id, bld] of [['XPc', 'tachara'], ['XPd', 'hadish']] as const) {
      const st = stones.filter(s => s.id.startsWith(bld)), midX = st.reduce((q, s) => q + s.c[0], 0) / st.length;
      for (const ver of ['op', 'el', 'bab']) {
        const anta = carved(id, ver).filter(m => !m.userData.snapped); // the stair copy is snapped to its façade
        expect(anta.length, `${id} ${ver}`).toBe(2);
        for (const m of anta) {
          const o = originOf(m), n = normalOf(m), b = worldBox(m), s = st.find(q => Math.abs(q.c[0] - o.x) < q.size[0] / 2 + 0.01)!;
          expect(s, `${m.name} on an anta`).toBeTruthy();
          expect(Math.abs(n.x), `${m.name} faces grid E or W`).toBeCloseTo(1, 6);
          expect(Math.sign(n.x), `${m.name} faces the portico`).toBe(Math.sign(midX - s.c[0]));
          expect(Math.abs(o.x - (s.c[0] + Math.sign(n.x) * s.size[0] / 2)), `${m.name} on the stone's face`).toBeLessThan(1e-6);
          // the cut quads lie in the face (0.5 mm lift), inside the face's rectangle
          expect(b.min.y).toBeGreaterThan(s.y0); expect(b.max.y).toBeLessThan(s.y1);
          expect(-b.max.z).toBeGreaterThan(s.c[1] - s.size[1] / 2); expect(-b.min.z).toBeLessThan(s.c[1] + s.size[1] / 2);
          const pos = m.geometry.getAttribute('position'); for (let i = 0; i < pos.count; i++) expect(Math.abs(pos.getZ(i))).toBeLessThanOrEqual(0.001);
          expect(m.userData.host).toBe('limestone_dark'); expect(m.userData.note).toMatch(/anta/);
        }
      }
      // stacked: the Old Persian above the Elamite above the Babylonian on each anta
      for (const side of [-1, 1]) {
        const top = (ver: string) => worldBox(carved(id, ver).filter(m => !m.userData.snapped).find(m => Math.sign(originOf(m).x - midX) === side)!).max.y;
        expect(top('op')).toBeGreaterThan(top('el')); expect(top('el')).toBeGreaterThan(top('bab'));
      }
    }
    expect(fields.length).toBe(4);
  });
  it('the Tachara antae case the S ends of the portico\'s side walls; the Hadish antae stand clear of every part, in line with the hall\'s side walls and the portico\'s front row', () => {
    const { stones } = antaPlan(B.manifest), A = v<any>('tachara', 'r_anta_inscription');
    for (const s of stones.filter(q => q.id.startsWith('tachara'))) {
      expect(s.solid).toBe(false);
      const w = (v<any[]>('tachara', 'plan_walls')).find(q => A.walls.includes(q.id) && Math.abs((q.x[0] + q.x[1]) / 2 - s.c[0]) < 0.01)!;
      expect(w, s.id).toBeTruthy(); const front = Math.min(...w.y);
      // the casing wraps the wall end: proud of both faces and the front, `length` m back
      expect(s.c[0] - s.size[0] / 2).toBeCloseTo(w.x[0] - A.proud, 6); expect(s.c[0] + s.size[0] / 2).toBeCloseTo(w.x[1] + A.proud, 6);
      expect(s.c[1] - s.size[1] / 2).toBeCloseTo(front - A.proud, 6); expect(s.c[1] + s.size[1] / 2).toBeCloseTo(front + A.length, 6);
      expect(s.y1 - s.y0).toBeCloseTo(v<number>('tachara', 'column_height'), 6);
    }
    const H = v<any>('hadish', 'r_anta_inscription'), solids = g.userData.solids as { c: Pt; size: [number, number]; y0: number; y1: number }[];
    expect(solids.length).toBe(2);
    const hallSides = (B.parts.filter(p => p.building === 'hadish' && p.kind === 'wall' && p.type === 'box' && Math.abs((p as Box).size[0] - H.size) < 1e-6) as Box[]).map(b => b.c[0]);
    for (const s of solids) {
      expect(s.c[1]).toBeCloseTo(v<any>('hadish', 'portico_layout').rows_y[0], 6);
      expect(hallSides.some(x => Math.abs(x - s.c[0]) < 1e-6), `${s.c} in line with a hall side wall`).toBe(true);
      for (const p of B.parts) { // no overlap with any part within the pier's height (plan footprints, 1 cm tolerance)
        let hit = false;
        if (p.type === 'box') { const b = p as Box; if (b.rot) continue; hit = b.y1 > s.y0 + 0.01 && b.y0 < s.y1 && Math.abs(b.c[0] - s.c[0]) < (b.size[0] + s.size[0]) / 2 - 0.01 && Math.abs(b.c[1] - s.c[1]) < (b.size[1] + s.size[1]) / 2 - 0.01; }
        else if (p.type === 'column') { const c = p as Column; hit = Math.abs(c.c[0] - s.c[0]) < c.order.baseW / 2 + s.size[0] / 2 && Math.abs(c.c[1] - s.c[1]) < c.order.baseW / 2 + s.size[1] / 2; }
        expect(hit, `${p.building}:${p.kind} overlaps the pier at ${s.c}`).toBe(false);
      }
    }
    expect(g.getObjectByName('inscription-stones')!.children.length, 'the stones: one mesh per stone material').toBe(1);
  });
});

describe('XPj and XPm round the column-base drums of the Hadish N portico (hadish.r_base_inscriptions)', () => {
  it('six copies of each text in each version, every cut on the drum\'s own (conical) face, within the drum, centred toward the court', () => {
    const rings = baseRingPlan(B.parts), lift = v<any>('global', 'r_inscription_carving').lift;
    expect(rings.filter(r => r.id === 'XPj').length).toBe(6); expect(rings.filter(r => r.id === 'XPm').length).toBe(6);
    for (const id of ['XPj', 'XPm']) for (const ver of ['op', 'el', 'bab'] as const) {
      const ms = carved(id, ver); expect(ms.length, `${id} ${ver}: one mesh for its six bases`).toBe(1);
      const m = ms[0], list = m.userData.carved as { signs: string }[]; expect(list.length).toBe(6);
      for (const c of list) expect(c.signs, `${id} ${ver}`).toBe(squash(panelText(id, ver)!.lines.join('')));
      const pos = m.geometry.getAttribute('position'); let off = 0;
      for (const c of list) { // a copy's quads are contiguous: 4 vertices per sign
        const nv = 4 * [...c.signs].length; let sx = 0, sy = 0; let R: typeof rings[number] | undefined;
        for (let i = off; i < off + nv; i++) {
          const e = pos.getX(i), y = pos.getY(i), n = -pos.getZ(i);
          R ??= rings.filter(r => r.id === id).sort((a, b) => Math.hypot(a.c[0] - e, a.c[1] - n) - Math.hypot(b.c[0] - e, b.c[1] - n))[0];
          const h = y - R.y0, r = Math.hypot(e - R.c[0], n - R.c[1]), want = R.r0 + ((R.r1 - R.r0) * h) / R.hd + lift;
          expect(Math.abs(r - want), `${id} ${ver}: on the drum's face`).toBeLessThan(1e-4);
          expect(h).toBeGreaterThan(0.005); expect(h).toBeLessThan(R.hd - 0.01); // on the drum, a centimetre under the torus (a tall sign's quad runs a few mm above the band: its margin is uncut)
          sx += e - R.c[0]; sy += n - R.c[1];
        }
        // the line's middle: halfway between its first and last sign (round the axis, unwrapped)
        const az = (i: number) => Math.atan2(-pos.getZ(i) - R!.c[1], pos.getX(i) - R!.c[0]);
        let a0 = az(off), a1 = az(off + nv - 2); while (a1 < a0) a1 += 2 * Math.PI;
        expect((a0 + a1) / 2, `${id} ${ver}: centred on the side toward the court`).toBeCloseTo(Math.PI / 2, 1);
        void sx; void sy;
        off += nv;
      }
      expect(off).toBe(pos.count);
      expect(m.userData.ring).toBe(true); expect(m.userData.host).toBe('limestone_carved');
    }
    // the front row carries XPj, the back row XPm
    const rows = v<any>('hadish', 'r_base_inscriptions').rows;
    for (const r of rings) expect(r.c[1]).toBeCloseTo(rows[r.id], 6);
  });
});

describe('DPb and XPk on the king\'s garment (global.r_garment_inscription)', () => {
  it('one line per version across the lower robe of the chosen kings; each sign\'s cut lies on the carved robe, never buried in it', () => {
    const G = v<any>('global', 'r_garment_inscription'), emb = v<any>('apadana', 'r_relief_carving').embed, lift = v<any>('global', 'r_inscription_carving').lift;
    const placements = P4.inscriptions.filter(p => p.garment) as InscriptionPlacement[];
    expect(placements.map(p => `${p.id}:${(p.versions ?? []).join('+')}`).sort()).toEqual(['DPb:op', 'XPk:op+el+bab']);
    for (const p of placements) {
      const Gm = p.garment!, copy = G.copies.find((c: any) => c.id === p.id), f = garmentFieldOf(Gm.kind, Gm.seed, Gm.sample), sx = Gm.mirror ? -1 : 1;
      // the king this copy is on: the relief item on that doorway's reveal
      expect(p.where).toContain(copy.doorway.replace(':', ' '));
      for (const ver of p.versions!) {
        const ms = carved(p.id, ver).filter(m => m.userData.garment); expect(ms.length, `${p.id} ${ver}`).toBe(1);
        const m = ms[0], pos = m.geometry.getAttribute('position');
        expect((m.userData.carved as any[])[0].signs).toBe(squash(panelText(p.id, ver)!.lines.join(''))); // the whole text, as one line
        let y0 = Infinity, y1 = -Infinity;
        const left = Math.min(Gm.S * sx * Gm.fx[0], Gm.S * sx * Gm.fx[1]);
        for (let k = 0; k < pos.count; k += 4) {
          const z = pos.getZ(k), xs = [pos.getX(k), pos.getX(k + 2)], ys = [pos.getY(k), pos.getY(k + 2)];
          for (let c = 1; c < 4; c++) expect(pos.getZ(k + c)).toBe(z); // each sign's quad is flat
          const hAt = (x: number, y: number) => fieldHeight(f, (left + x) / (Gm.S * sx), (p.yTop + y - Gm.o[1]) / Gm.S);
          let hMax = -Infinity; for (const x of xs) for (const y of ys) hMax = Math.max(hMax, hAt(x, y));
          const surf = (h: number) => Gm.D * h - emb; // the robe's surface off the reveal (m)
          expect(z, `${m.name}: a cut buried in the robe`).toBeGreaterThanOrEqual(surf(hMax) + lift - 1e-6); // (float32 positions)
          const hc = hAt((xs[0] + xs[1]) / 2, (ys[0] + ys[1]) / 2);
          expect(z - surf(hc), `${m.name}: a cut standing off the robe`).toBeLessThan(0.012);
          // on the carved figure (a mass, not the background) and inside the robe's band (fx, fy)
          const fx = (left + (xs[0] + xs[1]) / 2) / (Gm.S * sx), fy = (p.yTop + (ys[0] + ys[1]) / 2 - Gm.o[1]) / Gm.S;
          expect(fx).toBeGreaterThan(Gm.fx[0] - 0.01); expect(fx).toBeLessThan(Gm.fx[1] + 0.01); expect(fy).toBeGreaterThan(Gm.fy[0] - 0.01); expect(fy).toBeLessThan(Gm.fy[1] + 0.01);
          const gi = Math.round((fx - f.x0) / f.cell), gj = Math.round((fy - f.y0) / f.cell);
          expect(f.col[gj * f.n + gi], `${m.name}: on the figure, not the background`).not.toBe(0); expect(hc).toBeGreaterThan(0.05);
          y0 = Math.min(y0, ys[0]); y1 = Math.max(y1, ys[1]);
        }
        expect(y1 - y0, `${m.name}: one line (two would span over 3.5 signs' height)`).toBeLessThan(3 * m.userData.glyph);
        expect(m.userData.glyph).toBeGreaterThanOrEqual(G.glyph_min - 1e-9); expect(m.userData.glyph).toBeLessThanOrEqual(G.glyph_max);
        expect(m.userData.note).toMatch(/garment/);
      }
    }
    // DPb: the Old Persian only, on the Tachara's king (the garment copy); XPk on the Hadish E doorway's
    expect(carved('DPb', 'el').filter(m => m.userData.garment).length).toBe(0);
    expect(originOf(carved('DPb', 'op').find(m => m.userData.garment)!).x).toBeLessThan(0); // the Tachara lies W of the grid origin
    expect(originOf(carved('XPk', 'op')[0]).x).toBeGreaterThan(30);
  });
});

describe('XPg on its plaque (apadana.r_xpg_plaque)', () => {
  it('the Old Persian only, on a slab of dark stone on the hall\'s N wall inside the N portico, beside the main doorway', () => {
    const X = xpgPlaquePlan(B.parts, B.manifest)!, P = v<any>('apadana', 'r_xpg_plaque'), a = B.manifest.apadana as any;
    const faceY = a.room[1] + a.room[3] / 2 + a.wallThickness;
    expect(X.stone.c[1] + X.stone.size[1] / 2).toBeCloseTo(faceY + P.proud, 6); // its front `proud` of the wall face
    expect(X.stone.c[1] - X.stone.size[1] / 2).toBeLessThan(faceY); // its back set into the wall
    const frames = B.parts.filter(p => p.building === 'apadana' && p.kind === 'door_frame' && Math.abs((p as Box).c[1] - (faceY - a.wallThickness / 2)) < a.wallThickness) as Box[];
    const frameEdge = Math.max(...frames.filter(f => f.c[0] > a.room[0]).map(f => f.c[0] + f.size[0] / 2).filter(x => x < X.stone.c[0]));
    expect(X.stone.c[0] - X.stone.size[0] / 2 - frameEdge).toBeCloseTo(P.from_frame, 6);
    expect(carved('XPg', 'el').length + carved('XPg', 'bab').length).toBe(0);
    const m = carved('XPg', 'op'); expect(m.length).toBe(1);
    const b = worldBox(m[0]), n = normalOf(m[0]);
    expect(n.z).toBeCloseTo(-1, 6); // faces grid north, into the portico
    expect(b.min.x).toBeGreaterThan(X.stone.c[0] - X.stone.size[0] / 2); expect(b.max.x).toBeLessThan(X.stone.c[0] + X.stone.size[0] / 2);
    expect(b.min.y).toBeGreaterThan(X.stone.y0); expect(b.max.y).toBeLessThan(X.stone.y1);
    expect(Math.abs(-b.max.z - (faceY + P.proud))).toBeLessThan(0.002);
    expect((m[0].userData.carved as any[])[0].signs).toBe(squash(panelText('XPg', 'op')!.lines.join('')));
  });
});

describe('what D-214 adds to the inscriptions costs little', () => {
  it('≤ 26 draws and ≤ 40 k triangles for the new copies and their stones', () => {
    const extra = g.children.filter(c => (c as THREE.Mesh).isMesh && c.layers.mask === 1 && (c.userData.garment || c.userData.ring || (/inscription:(XPc|XPd):/.test(c.name) && !c.userData.snapped) || /inscription:XPg:/.test(c.name))) as THREE.Mesh[];
    const stones = (g.getObjectByName('inscription-stones')!.children as THREE.Mesh[]);
    const all = [...extra, ...stones], tris = all.reduce((q, m) => q + (m.geometry.index ? m.geometry.index.count : m.geometry.getAttribute('position').count) / 3, 0);
    console.log(`D-214 inscriptions: ${all.length} draws, ${tris} triangles`);
    expect(all.length).toBeLessThanOrEqual(26); expect(tris).toBeLessThanOrEqual(40_000);
  });
});
