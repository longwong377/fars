// D-362 (B179): a bird takes off without a pop. Its flying levels carry their standing twin's positions and normals (the same
// vertices and UVs), and a bird that leaves the ground is drawn through the morph between the poses, eased over
// BIRD_MORPH_S, instead of switching from the standing level to the flying one in a frame.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseLifeGLB, setLifeModel, clearLifeModels } from '../src/world/lifeModels';
import { BIRDS, BIRD_VARIANTS, Birds, BIRD_MORPH_S } from '../src/world/wildlife';
import { NavGrid } from '../src/people/navgrid';
import { Terrain, Ring, type TerrainMeta } from '../src/terrain/heightfield';

describe('a bird takes off without a pop (D-362, B179)', () => {
  it('the flushed sparrow is drawn through the stand-to-fly morph, then flying; its levels share their vertices', () => {
    const MAN = JSON.parse(readFileSync('public/models/life/manifest.json', 'utf8'));
    const load = (id: string) => parseLifeGLB(new Uint8Array(readFileSync(`public/models/life/${id}.glb`)).buffer);
    clearLifeModels(); const ids = Object.keys(BIRDS).flatMap(k => BIRD_VARIANTS[k] ?? [k]);
    for (const id of ids) { const L = load(id); setLifeModel({ id, entry: MAN.assets[id], levels: L, albedo: null, nrm: null });
      if (L.stand0) for (const k of ['0', '1']) expect(L['stand' + k].getAttribute('position').count, `${id} ${k}`).toBe(L['fly' + k].getAttribute('position').count); }
    const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
    const meta: TerrainMeta = JSON.parse(readFileSync('public/generated/terrain.json', 'utf8'));
    const ring = (k: 'near' | 'mid' | 'far') => new Ring(meta.rings[k], new Uint16Array(readFileSync(`public/${meta.rings[k].file}`).buffer.slice(0)), meta.court_asl);
    const B = new Birds(1, nav, new Terrain(meta, ring('near'), ring('mid'), ring('far')), [[0, 90], [150, 40]]);
    const fly0 = B.meshesOf('sparrow').find(m => m.name.endsWith(':fly0'))!; expect(fly0.geometry.getAttribute('standPos')).toBeTruthy();
    const s: [number, number] = (B as any).sparrowSpots[0], far: [number, number] = [s[0] + 200, s[1] + 200], t0 = 7000.2;
    const standAmts = () => B.meshesOf('sparrow').filter(m => /:fly[01]$/.test(m.name)).flatMap(m => { const a = m.geometry.getAttribute('bA'); return Array.from({ length: m.count }, (_, i) => a.getZ(i)); });
    B.update(5, 11, t0, far, { x: 0, n: 0 }, 0); B.update(5, 11, t0 + 0.05, s, { x: 0, n: 0 }, 0); // (it stands; then someone is beside it: it flushes)
    B.update(5, 11, t0 + 0.1, s, { x: 0, n: 0 }, 0);
    const mid = standAmts().filter(k => k > 0.01 && k < 0.99); expect(mid.length, 'drawn between standing and flying').toBeGreaterThan(0);
    expect(Math.max(...mid)).toBeGreaterThan(1 - 0.06 / BIRD_MORPH_S); // (eased: one 50 ms frame takes it a quarter of the way)
    for (let t = t0 + 0.15; t < t0 + 0.6; t += 0.05) B.update(5, 11, t, s, { x: 0, n: 0 }, 0);
    expect(standAmts().filter(k => k > 0.01).length, 'flying once the morph is done').toBe(0);
  }, 600_000);
});
