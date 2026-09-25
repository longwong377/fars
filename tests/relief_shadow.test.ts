// D-226 (rubric s7 pass 2, fix item 1): the relief figures cast shadows on their ground and on themselves. The heights are
// stamped into an atlas in their walls' frames (src/arch/relief_shadow.ts) and the sun's light marches it (render/
// reliefShadow.ts, CPU mirror reliefShadowAt). Measured here: the shadow of a straight carved edge under a raking sun against
// the geometry and against an exact march of the figure's L0 heightfield, its growth with the carving depth, a figure's
// shaded ground and its false self-shadows, the slices of a façade wider than the atlas, the plan grid, and the shader's
// code generation.
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { positionWorld, uniform } from 'three/tsl';
import { planReliefShadow, stampField, reliefShadowAt, REACH, HSCALE, ATLAS_W, type ShadowItem, type ReliefShadowData } from '../src/arch/relief_shadow';
import { rasterize } from '../src/arch/relief_field';
import { figureDef, defBounds } from '../src/arch/relief_figures';
import { setReliefShadow, reliefShadowNode } from '../src/render/reliefShadow';
import { paintedStoneMaterial, surfaceMaterial } from '../src/render/materials';

/** the sun `off` degrees off the wall plane (a wall facing +z), its direction within the plane `phi` degrees above the
 *  horizontal, from the viewer's left */
const sunAt = (off: number, phi: number): [number, number, number] => { const e = (off * Math.PI) / 180, p = (phi * Math.PI) / 180; return [-Math.cos(e) * Math.cos(p), Math.cos(e) * Math.sin(p), Math.sin(e)]; };
function one(kind: string, S: number, D: number, o: [number, number, number] = [0, 0, 0], X: [number, number] = [1, 0], Z: [number, number] = [0, 1]): ReliefShadowData {
  const it: ShadowItem = { kind, seed: 0, o, X, Z, S, D, mirror: false, embed: 0.001 };
  const d = planReliefShadow([it]); for (const [k, j] of [...d.jobs]) stampField(d, k, rasterize(figureDef(j.kind, j.seed), j.n, true)); return d;
}
/** the exact reference: the L0 heightfield (1025², point-sampled) marched in 1 mm steps */
function exact(kind: string, S: number, depth: number, L: [number, number, number]) {
  const f = rasterize(figureDef(kind, 0), 1025, false);
  const h = (x: number, y: number) => { const gi = Math.round((x / S - f.x0) / f.cell), gj = Math.round((y / S - f.y0) / f.cell);
    return gi < 0 || gj < 0 || gi >= f.n || gj >= f.n ? 0 : Math.max(0, f.h[gj * f.n + gi] * depth - 0.001); };
  const lit = (x: number, y: number, z0: number) => { for (let t = 0.001; t < 0.6; t += 0.001) { const z = z0 + L[2] * t; if (z > depth) return 1; if (h(x + L[0] * t, y + L[1] * t) > z + 0.0002) return 0; } return 1; };
  return { h, lit };
}

describe('relief cast shadows (D-226)', () => {
  it('a straight carved edge under a 15° raking sun: the shadow band grows with the depth, within 15 % of the exact march', () => {
    const L = sunAt(15, 35), S = 4, out: number[] = [];
    for (const depth of [0.03, 0.045, 0.06]) {
      const d = one('rail', S, depth), ex = exact('rail', S, depth, L);
      let wA = 0, wE = 0, k = 0;
      for (let x = -1.5; x <= 1.5; x += 0.15, k++) {
        let y = 0.001; while (ex.h(x, y) > 0) y -= 0.0005;
        let yA = y; while (reliefShadowAt(d, [x, yA, 0], L) < 0.5 && yA > y - 0.5) yA -= 0.0005;
        let yE = y; while (!ex.lit(x, yE, 0) && yE > y - 0.5) yE -= 0.0005;
        wA += y - yA; wE += y - yE;
      }
      wA /= k; wE /= k; out.push(wA);
      expect(Math.abs(wA - wE) / wE, `band ${wA} vs exact ${wE} at D ${depth}`).toBeLessThan(0.16);
      // the geometry: the ledge's crest (its step, 0.65 of 0.7 of the depth, at the least) × L_up / L_out
      expect(wA).toBeGreaterThan(0.65 * 0.7 * depth * (L[1] / L[2]) * 0.8);
    }
    // it grows with the depth: every 1.5 cm of carving adds 1.4–2.6 cm of band at this sun (L_up/L_out = 2.14)
    expect(out[1] - out[0]).toBeGreaterThan(0.014); expect(out[1] - out[0]).toBeLessThan(0.026);
    expect(out[2] - out[1]).toBeGreaterThan(0.014); expect(out[2] - out[1]).toBeLessThan(0.026);
    console.warn(`rail shadow band at 15°: ${out.map(w => (w * 100).toFixed(2)).join(' / ')} cm for 3 / 4.5 / 6 cm of carving`);
  });
  it('a guard: its shaded ground agrees with the exact march on ≥ 95 % of the points, and < 2 % of its sunward faces are falsely shaded', () => {
    const L = sunAt(15, 35), S = 0.741, depth = 0.045, d = one('guard', S, depth), ex = exact('guard', S, depth, L), b = defBounds(figureDef('guard', 0));
    let agree = 0, n = 0, on = 0, falseSh = 0, area = 0;
    for (let y = b[1] * S - 0.3; y < b[3] * S; y += 0.006) for (let x = b[0] * S - 0.05; x < b[2] * S + 0.3; x += 0.006) {
      const hz = ex.h(x, y);
      if (hz > 0) {
        const s = 0.003, gx = (ex.h(x + s, y) - ex.h(x - s, y)) / (2 * s), gy = (ex.h(x, y + s) - ex.h(x, y - s)) / (2 * s);
        if ((-gx * L[0] - gy * L[1] + L[2]) / Math.hypot(gx, gy, 1) < 0.1) continue;
        on++; if (reliefShadowAt(d, [x, y, hz], L) < 0.5 && ex.lit(x, y, hz)) falseSh++; continue;
      }
      const v = reliefShadowAt(d, [x, y, 0], L), l = ex.lit(x, y, 0); n++; area += 1 - v; if ((v < 0.5 ? 0 : 1) === l) agree++;
    }
    expect(agree / n).toBeGreaterThan(0.95); expect(falseSh / on).toBeLessThan(0.02); expect(area).toBeGreaterThan(100);
  });
  it('no shadow where the sun is behind the wall, beyond the reach, or in front of the relief\'s top', () => {
    const d = one('guard', 0.741, 0.045), L = sunAt(15, 35);
    expect(reliefShadowAt(d, [0.15, 0.3, 0], [L[0], L[1], -L[2]])).toBe(1); // the wall faces away: its own N·L darkens it
    expect(reliefShadowAt(d, [0.15, 0.3, 0.2], L)).toBe(1); // 20 cm in front of the wall
    expect(reliefShadowAt(d, [1.5, 0.3, 0], L)).toBe(1); // beyond the reach along the wall
    // just below and right of the robe's front hem the ground is shaded
    let shaded = 0; for (let x = 0.05; x < 0.2; x += 0.005) if (reliefShadowAt(d, [x, 0.01, 0], L) < 0.5) shaded++;
    expect(shaded).toBeGreaterThan(3);
  });
  it('a wall wider than the atlas is cut into slices that hold every point once and whose heights cover their marches', () => {
    // a row of guards along 90 m (the Apadana façade is 81 m): slices; every point near the wall is held by exactly one
    const items: ShadowItem[] = []; for (let u = -45; u <= 45; u += 0.5) items.push({ kind: 'guard', seed: 0, o: [u, 0, 0], X: [1, 0], Z: [0, 1], S: 0.741, D: 0.045, mirror: false, embed: 0.001 });
    const d = planReliefShadow(items);
    expect(d.panels.length).toBeGreaterThan(1);
    for (const p of d.panels) { expect(p.aw + 2).toBeLessThanOrEqual(ATLAS_W); expect(p.hold[0]).toBeGreaterThanOrEqual(-REACH - 1e-9); expect(p.hold[1]).toBeLessThanOrEqual(p.aw * p.texel + REACH + 1e-6);
      // a slice's own points are at least REACH from the ends of its rectangle, except at the wall's ends
      if (p.hold[0] > -REACH + 1e-6) expect(p.hold[0]).toBeGreaterThanOrEqual(REACH - 1e-6);
      if (p.hold[1] < p.aw * p.texel) expect(p.aw * p.texel - p.hold[1]).toBeGreaterThanOrEqual(REACH - p.texel - 1e-6); }
    for (let x = -45.3; x < 45.3; x += 0.37) { let held = 0; for (const p of d.panels) { const u = x - p.o[0] * p.X[0]; if (u >= p.hold[0] && u <= p.hold[1]) held++; } expect(held, `x ${x}`).toBe(1); }
    for (const [k, j] of [...d.jobs]) stampField(d, k, rasterize(figureDef(j.kind, j.seed), j.n, true));
    // the same ground point's shadow does not depend on which slice holds it: compare with a single guard at the seam
    const L = sunAt(15, 35), seams = d.panels.map(p => p.o[0] + p.hold[1]).filter(x => x < 44);
    for (const s of seams) { const g = Math.round(s * 2) / 2, single = one('guard', 0.741, 0.045, [g, 0, 0]);
      // the shaded length right of the guard at the seam matches a lone guard's to within 1 cm (the texel grids differ in phase)
      let a = 0, b = 0; for (let x = g + 0.02; x < g + 0.3; x += 0.002) { a += (1 - reliefShadowAt(d, [x, 0.05, 0], L)) * 0.002; b += (1 - reliefShadowAt(single, [x, 0.05, 0], L)) * 0.002; }
      expect(Math.abs(a - b), `seam ${s}`).toBeLessThan(0.01); expect(b).toBeGreaterThan(0.05); }
  });
  it('heights are metres above the wall face over HSCALE; the plan grid lists the panels near the wall and no cell overflows', () => {
    const d = one('guard', 0.741, 0.06); let hi = 0; for (let i = 0; i < d.gridRow0 * d.aw; i++) hi = Math.max(hi, d.atlas[i]);
    expect((hi / 255) * HSCALE).toBeGreaterThan(0.04); expect((hi / 255) * HSCALE).toBeLessThanOrEqual(0.06);
    expect(d.overflow).toBe(0);
    const c = Math.floor((0 - d.gz0) / d.gc) * d.gw + Math.floor((0.1 - d.gx0) / d.gc); expect(d.grid[c * 4]).toBe(1);
    const far = Math.floor((1.5 - d.gz0) / d.gc) * d.gw + Math.floor((0.1 - d.gx0) / d.gc); if (far < d.gw * d.gh) expect(d.grid[far * 4]).toBe(0);
  });
  it('the sun\'s relief shadow node generates WGSL in the painted stone and a plain stone material (two texture bindings)', async () => {
    const d = one('guard', 0.741, 0.045); setReliefShadow(d);
    const canvas: any = { style: {}, width: 64, height: 64, getContext: () => null, addEventListener() {}, removeEventListener() {} };
    const r: any = new (THREE as any).WebGPURenderer({ canvas, antialias: false }); r.hasFeature = () => true;
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(46, 1, 0.05, 1000), sun = new THREE.DirectionalLight(0xffffff, 3);
    const dir = uniform(new THREE.Vector3(0.3, 0.5, 0.8).normalize());
    (sun as any).colorNode = uniform(new THREE.Color(1, 1, 1)).mul(reliefShadowNode(positionWorld, dir));
    scene.add(sun, sun.target);
    const counts: number[] = [];
    for (const mat of [paintedStoneMaterial(), surfaceMaterial('limestone')]) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat), b = new (THREE as any).WGSLNodeBuilder(mesh, r);
      b.scene = scene; b.camera = camera; b.material = mat; b.lightsNode = r.lighting.getNode(scene, camera); b.lightsNode.setLights([sun]); b.build();
      const f = b.fragmentShader as string; expect(f.length).toBeGreaterThan(100); expect(f).toMatch(/textureLoad/);
      counts.push((f.match(/texture_2d</g) ?? []).length); if (process.env.DUMP_WGSL) (await import("node:fs")).writeFileSync(process.env.DUMP_WGSL + counts.length + ".wgsl", f);
    }
    for (const c of counts) expect(c).toBeLessThanOrEqual(16);
  });
});
