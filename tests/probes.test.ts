// Light probes (D-110 … D-113): the ray tracer against the parts, the bake on synthetic rooms, and the baked field of the
// Terrace (public/generated/probes.*): bounded values, open ground ≈ 1, the Apadana hall ≪ 1 but > 0 and brighter at its
// doorways and porticoes than at its centre, monotone with the size of the opening, and up to date with the architecture.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import type { Part, Box, Prism, Material } from '../src/arch/parts';
import { buildTerrace } from '../src/arch/terrace';
import { v as specV } from '../src/arch/spec';
import { SURFACES } from '../src/render/materials';
import { TraceScene, sceneFromParts } from '../src/render/probes/trace';
import { BAKE, BakeOptions, bakeAll, sunSet, surfaceTable, albedoFn, probeVolumes, yearSunSamples } from '../src/render/probes/bake';
import { REACH, reachFrac, TINT_DOWN } from '../src/render/probes/field';
import { ProbeField, ProbeVolume, PROBE_STRIDE, sampleField, fieldVisibility, evalSample, openField, atlasData, encodeField, decodeField, probeIndex, volumeWeight, gridExtent } from '../src/render/probes/field';

const SURF = surfaceTable(SURFACES as any), ALB = albedoFn(SURF);
const CAPS = { protome: [3.4, 1.1] as [number, number], plain: 1.4, volute: [1.25, 0.9] as [number, number] };
const scene = (parts: Part[]) => sceneFromParts(parts, ALB, CAPS);
const base = { building: 'test', material: 'mudbrick' as Material, tier: 'C' as const, src: 'TEST' };
const box = (c: [number, number], size: [number, number], y0: number, y1: number, extra: Partial<Box> = {}): Box => ({ ...base, kind: 'wall', type: 'box', c, size, y0, y1, ...extra });
const ground = (half = 200): Prism => ({ ...base, kind: 'platform', material: 'terrace', type: 'prism', polygon: [[-half, -half], [half, -half], [half, half], [-half, half]], y0: -1, y1: 0 });
/** a closed room: interior 20 × 20 m, 8 m high, 1 m walls, floor at 0, roof slab 8–9 m; a doorway of width `door` (m) and
 *  height 4 m in the S wall (0 = no opening) */
function room(door: number): Part[] {
  const H = 8, t = 1, half = 10, out: Part[] = [ground()];
  out.push(box([0, half + t / 2], [2 * half + 2 * t, t], 0, H)); // N
  out.push(box([half + t / 2, 0], [t, 2 * half], 0, H), box([-half - t / 2, 0], [t, 2 * half], 0, H)); // E, W
  const sy = -half - t / 2, L = 2 * half + 2 * t;
  if (door <= 0) out.push(box([0, sy], [L, t], 0, H));
  else {
    const a = (L - door) / 2; out.push(box([-L / 2 + a / 2, sy], [a, t], 0, H), box([L / 2 - a / 2, sy], [a, t], 0, H), box([0, sy], [door, t], 4, H)); // jambs' walls + lintel wall
  }
  out.push({ ...box([0, 0], [L, L], H, H + 1), kind: 'roof', material: 'timber' });
  return out;
}
/** a single-volume probe grid over the room (and 6 m beyond it) */
function roomVolume(): ProbeVolume {
  return { building: 'test', origin: [-16, 0.25, -16], spacing: [2, 2.5, 2], dims: [17, 4, 17], roof: [-11, 11, -11, 11], full: 2, yLo: [-1, -0.05], yHi: [8, 9], offset: 0 };
}
const FAST: BakeOptions = { ...BAKE, skyDirs: 2048, rays: 512 };
// a clear midday sun from due south (grid), 60° up: it shines through a S doorway onto the floor
const noonSun = sunSet([{ dir: [0, Math.sin(Math.PI / 3), Math.cos(Math.PI / 3)], alt: 60 }]);
const PLAIN = ALB('earth', true);
const S = 0.8, U = 2.1, RHO = 0.2; // a clear midday in renderer units (sky, horizontal sun), open ground albedo (C)
const bake = (parts: Part[], vol = roomVolume()) => bakeAll(scene(parts), [vol], noonSun, PLAIN, FAST);
const visAt = (F: ProbeField, x: number, y: number, z: number) => fieldVisibility(F, x, y, z, S, U, RHO).vis;

describe('ray tracer against parts', () => {
  const sc = scene([box([0, 0], [2, 4], 0, 3), { ...box([10, 0], [2, 2], 0, 2), rot: Math.PI / 4 }, ground(50)]);
  it('hits an axis-aligned box face at the right distance with the outward normal', () => {
    const h = sc.intersect(-5, 1, 0, 1, 0, 0)!; // from grid west toward the box: its W face at x = −1
    expect(h.t).toBeCloseTo(4, 6); expect(h.nx).toBeCloseTo(-1, 6);
    const g = sc.intersect(0, 10, 0, 0, -1, 0)!; expect(g.t).toBeCloseTo(7, 6); expect(g.ny).toBeCloseTo(1, 6);
  });
  it('hits a rotated box at its corner distance and the platform top as ground', () => {
    const h = sc.intersect(5, 1, 0, 1, 0, 0)!; expect(h.t).toBeCloseTo(5 - Math.SQRT2, 5); // 45° box: the W corner at x = 10 − √2
    const g = sc.intersect(20, 5, 20, 0, -1, 0)!; expect(g.t).toBeCloseTo(5, 6);
    const top = sc.albedoAt(g.prim, g.ny, [0, 0, 0]), want = ALB('terrace', true); top.forEach((c, k) => expect(c).toBeCloseTo(want[k], 6)); // the court fill on top
  });
  it('a ray that starts on a face and heads into the solid is blocked (no leaks through walls)', () => {
    expect(sc.occluded(-1, 1, 0, 1, 0, 0)).toBe(true); expect(sc.intersect(-1, 1, 0, 1, 0, 0)).not.toBeNull();
    expect(sc.occluded(-1, 1, 0, -1, 0, 0)).toBe(false); // heading away: free
  });
  it('knows solid interiors and escapes to the sky', () => {
    expect(sc.inside(0, 1, 0)).toBe(true); expect(sc.inside(0, 1, 3)).toBe(false); expect(sc.inside(20, -0.5, 20)).toBe(true);
    expect(sc.occluded(20, 1, 20, 0, 1, 0)).toBe(false); expect(sc.intersect(20, 1, 20, 0, 1, 0)).toBeNull();
  });
  it('builds columns as base, shaft and capital', () => {
    const { parts } = buildTerrace(); const col = parts.find(p => p.type === 'column' && p.building === 'apadana' && p.built >= 1)!;
    const s = scene([col]), x = (col as any).c[0], z = -(col as any).c[1], o = (col as any).order;
    const h = s.intersect(x - 10, (col as any).y0 + o.baseH + 3, z, 1, 0, 0)!; expect(h.t).toBeCloseTo(10 - o.shaftD / 2, 5); // the shaft
    expect(s.occluded(x, (col as any).y0 + o.height + 0.1, z, 0, 1, 0)).toBe(false); // nothing above the capital
  });
});

describe('light probes: synthetic room', () => {
  const open = bake([ground()]);
  const rooms = [0, 1, 2, 4, 8].map(d => ({ d, F: bake(room(d)) }));
  it('are bounded and finite', () => {
    for (const F of [open, ...rooms.map(r => r.F)]) for (let i = 0; i < F.count; i++) {
      const o = i * PROBE_STRIDE, d = F.data;
      for (let j = 0; j < PROBE_STRIDE; j++) expect(Number.isFinite(d[o + j])).toBe(true);
      if (!d[o + 11]) continue;
      expect(d[o]).toBeGreaterThanOrEqual(0); expect(d[o]).toBeLessThanOrEqual(1.5); // sky channel mean (open: 0.5 sky + bounce)
      expect(Math.hypot(d[o + 1], d[o + 2], d[o + 3])).toBeLessThanOrEqual(2 * d[o] + 1e-6); // L1 of a non-negative radiance: |b| ≤ 2a
      expect(d[o + 4]).toBeGreaterThanOrEqual(0); expect(d[o + 4]).toBeLessThanOrEqual(1.5);
      expect(d[o + 10]).toBeGreaterThanOrEqual(0); expect(d[o + 10]).toBeLessThanOrEqual(1);
    }
  });
  it('read ≈ 1 on open ground (the hemisphere light, sky part exact)', () => {
    const smp = sampleField(open, 0, 1.6, 0)!; const [up, upU] = evalSample(smp.s, 0, 1, 0);
    expect(up).toBeCloseTo(1, 1); expect(evalSample(smp.s, 1, 0, 0)[0]).toBeGreaterThan(0.45); // a wall sees half the sky
    expect(upU).toBeLessThan(0.02); // nothing sunlit above
    expect(visAt(open, 0, 1.6, 0)).toBeGreaterThan(0.93); expect(visAt(open, 0, 1.6, 0)).toBeLessThan(1.001);
  });
  it('a closed room is dark; the ambient grows monotonically with the doorway', () => {
    const v = rooms.map(r => visAt(r.F, 0, 1.6, 0));
    expect(v[0]).toBeLessThan(1e-3);
    for (let i = 1; i < v.length; i++) expect(v[i]).toBeGreaterThan(v[i - 1]);
    expect(v[v.length - 1]).toBeLessThan(0.5); // still well below the open field
  });
  it('is brighter near the doorway than at the back of the room', () => {
    const F = rooms.find(r => r.d === 4)!.F;
    expect(visAt(F, 0, 1.6, 7)).toBeGreaterThan(2 * visAt(F, 0, 1.6, -7)); // grid y −7 (near the S door) vs y +7 (N wall)
  });
  it('faces toward the doorway get more light than faces away from it', () => {
    const F = rooms.find(r => r.d === 4)!.F, smp = sampleField(F, 0, 1.6, 0)!;
    const toward = evalSample(smp.s, 0, 0, 1), away = evalSample(smp.s, 0, 0, -1); // world +z = grid south
    expect(S * toward[0] + U * toward[1]).toBeGreaterThan(S * away[0] + U * away[1]);
  });
  it('no light leaks through a wall thinner than the probe spacing (reach, D-152)', () => {
    // the closed room's probe grid shifted so a probe row stands 0.2 m inside the 1 m W wall (world x −9.8) and the next
    // 0.8 m outside it (x −11.8), in sunlit open ground: without the reach test the floor at the wall's foot mixes them
    const vol = { ...roomVolume(), origin: [-15.8, 0.25, -15.8] as [number, number, number] };
    const F = bake(room(0), vol), F0: ProbeField = { ...F, data: F.data.slice() };
    for (let i = 0; i < F0.count; i++) for (let k = 0; k < 4; k++) F0.data[i * PROBE_STRIDE + REACH + k] = 0; // no reach data
    const i0 = probeIndex(vol, 2, 0, 8), i1 = probeIndex(vol, 3, 0, 8); // x −11.8 (outside), x −9.8 (inside)
    expect(F.data[i0 * PROBE_STRIDE + REACH]).toBeCloseTo(0.4, 2); // +x: the wall's outer face 0.8 m away
    expect(F.data[i1 * PROBE_STRIDE + REACH + 1]).toBeCloseTo(0.1, 2); // −x: the inner face 0.2 m away
    expect(F.data[i1 * PROBE_STRIDE + REACH]).toBe(1); // +x: the next probe, in the room, is in sight
    const foot = visAt(F, -9.9, 0.5, 0.3), leak = visAt(F0, -9.9, 0.5, 0.3);
    expect(leak).toBeGreaterThan(0.02); // the old lookup: ~5 % of the open field at the wall's foot
    expect(foot).toBeLessThan(1e-3); // the room is closed: dark up to its wall
    expect(visAt(F, -12.5, 0.5, 0.3)).toBeGreaterThan(0.5); // and outside the wall the open ground stays lit
    // the fraction rule itself: a side none of whose probes reaches the point is left out, else plain bilinear
    expect(reachFrac(0.95, 0.4, 0.4, 0.1, 0.1)).toBe(1); expect(reachFrac(0.05, 0.1, 0, 0.4, 0.4, 0)).toBe(0);
    expect(reachFrac(0.5, 1, 1, 1, 1)).toBe(0.5); expect(reachFrac(0.5, 0, 0, 0, 0)).toBe(0.5);
    // beside a doorway: of the far (low) side, only the corner in line with the opening (lo0, at t = 0) reaches the point;
    // at the jamb's side (t = 1) the far side is left out, in front of the opening (t = 0) the lookup blends as before
    expect(reachFrac(0.9, 1, 0.3, 0.2, 0.2, 1)).toBe(1); expect(reachFrac(0.9, 1, 0.3, 0.2, 0.2, 0)).toBeCloseTo(0.9, 9);
    expect(reachFrac(0.9, 1, 0.3, 0.2, 0.2, 0.5)).toBeGreaterThan(0.9); expect(reachFrac(0.9, 1, 0.3, 0.2, 0.2, 0.5)).toBeLessThan(1);
  });
  it('a red floor tints the light a ceiling gets, not the light the floor itself gets (up/down tints, D-158)', () => {
    // the same room with a limestone and with a red plaster floor slab: the red shows in the light from below far more than
    // in the light from above (which comes off the walls and the ceiling, lit in turn by the floor: a second bounce)
    const tints = (mat: string) => {
      const parts = room(4); parts.push({ ...box([0, 0], [20, 20], 0, 0.05), kind: 'platform', material: mat as Material });
      const smp = sampleField(bake(parts), 0, 2.5, 0)!;
      return { up: smp.s[8], upB: smp.s[9], down: smp.s[TINT_DOWN], downB: smp.s[TINT_DOWN + 1] }; // red, blue relative to luminance 1
    };
    const grey = tints('limestone'), red = tints('plaster_red');
    // measured: limestone floor up/down red 1.45/1.10 (the timber ceiling is brown), red floor 1.80/1.85
    expect(red.down).toBeGreaterThan(1.6); // from below: the red floor (with the doorway's view of the plain and the wall feet)
    expect(red.down - grey.down).toBeGreaterThan(2 * (red.up - grey.up)); // the floor's red reaches the ceiling, not itself
    expect(grey.downB - red.downB).toBeGreaterThan(2 * (grey.upB - red.upB)); // and takes the blue out of it, not out of the floor's own light
  });
  it('the weight is 1 inside the roofed space and 0 beyond the grid', () => {
    const v = roomVolume();
    expect(volumeWeight(v, 0, 2, 0)).toBe(1); expect(volumeWeight(v, 30, 2, 0)).toBe(0); expect(volumeWeight(v, 0, 9.5, 0)).toBe(0);
    expect(volumeWeight(v, 14, 2, 0)).toBeGreaterThan(0); expect(volumeWeight(v, 14, 2, 0)).toBeLessThan(1); // the fade outside the eaves
  });
});

describe('light probes: the baked Terrace field', () => {
  const meta = JSON.parse(readFileSync('public/generated/probes.json', 'utf8'));
  const b = readFileSync('public/generated/probes.f16');
  const F: ProbeField = { volumes: meta.volumes, data: decodeField(new Uint16Array(b.buffer, b.byteOffset, b.byteLength / 2)), count: meta.count, normalBias: meta.normalBias, tier: meta.tier, note: meta.note };
  const { parts, manifest } = buildTerrace();
  const ap = (manifest as any).apadana, [cx, cy] = ap.hallCentre as number[], fl = ap.podium as number, inner = ap.hallInterior / 2;
  const at = (e: number, n: number, h = 1.6) => visAt(F, e, fl + h, -n);
  it('is up to date with the architecture (parts hash) — rerun `npx tsx tools/build_probes.ts` if this fails', () => {
    expect(meta.partsHash).toBe(createHash('sha1').update(JSON.stringify(parts)).digest('hex').slice(0, 16));
    expect(F.count).toBe(F.data.length / PROBE_STRIDE);
    expect(F.volumes.map(v => v.building).sort()).toEqual(probeVolumes(parts, manifest).map(v => v.building).sort());
  });
  it('one volume per roofed space, none overlapping (the shader sums masked terms over the volumes)', () => {
    const E = F.volumes.map(v => ({ v, g: gridExtent(v) }));
    for (const a of E) for (const b of E) if (a !== b) {
      const apart = a.g.x1 < b.g.x0 || b.g.x1 < a.g.x0 || a.g.z1 < b.g.z0 || b.g.z1 < a.g.z0 || a.g.y1 < b.g.y0 || b.g.y1 < a.g.y0;
      expect(apart, `${a.v.building} / ${b.v.building}`).toBe(true);
    }
    const roofed = new Set(parts.filter(p => p.kind === 'roof').map(p => p.building));
    for (const b of roofed) expect(F.volumes.some(v => v.building === b || v.building.startsWith(b + ':')), b).toBe(true);
  });
  it('covers every roofed building with finite, bounded values', () => {
    for (const v of F.volumes) expect(v.dims[0] * v.dims[1] * v.dims[2]).toBeGreaterThan(0);
    let bad = 0; for (let i = 0; i < F.data.length; i++) if (!Number.isFinite(F.data[i]) || Math.abs(F.data[i]) > 8) bad++;
    expect(bad).toBe(0);
  });
  it('reads 1 outdoors, away from the roofed buildings', () => {
    expect(visAt(F, -20, 1.6, -75)).toBe(1); // the court between the Apadana and the Gate (outside every volume)
    expect(fieldVisibility(F, -20, 1.6, -75, S, U, RHO).w).toBe(0);
  });
  it('the Apadana hall is dark (≪ 1) but not black deep inside, brighter at the doorways and in the porticoes', () => {
    // deep inside: the middles of the four quadrants (the exact centre lies on both doorway axes and sees out of all four doors)
    const deep = [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([a, b]) => at(cx + a * inner / 2, cy + b * inner / 2));
    const nDoor = at(cx, cy + inner - 3), wDoor = at(cx - inner + 3, cy), eDoor = at(cx + inner - 3, cy), nPortico = at(cx, cy + inner + ap.wallThickness + 6);
    const deepMax = Math.max(...deep);
    for (const d of deep) { expect(d).toBeGreaterThan(0); expect(d).toBeLessThan(0.01); }
    for (const d of [nDoor, wDoor, eDoor]) expect(d).toBeGreaterThan(3 * deepMax);
    expect(at(cx, cy)).toBeGreaterThan(deepMax); // the crossing of the doorway axes
    expect(nPortico).toBeGreaterThan(nDoor); expect(nPortico).toBeLessThan(0.8);
    // along the N–S axis from the N doorway: falls off with depth, and stays above the quadrants' level
    const axis = [3, 10, 15, 20].map(d => at(cx, cy + inner - d));
    for (let i = 1; i < axis.length; i++) expect(axis[i]).toBeLessThan(axis[i - 1]);
    expect(axis[axis.length - 1]).toBeGreaterThan(deepMax);
  });
  it('carries every probe reach (D-152), and the scribes room floor at the foot of its 1.7 m inner wall reads as the room', () => {
    let out = 0; for (let i = 0; i < F.count; i++) for (let k = 0; k < 4; k++) { const r = F.data[i * PROBE_STRIDE + REACH + k]; if (!(r >= 0 && r <= 1)) out++; }
    expect(out).toBe(0);
    const tr = (manifest as any).treasury.scribesRoom as number[], [sx, , , , sfl] = tr; // [cx, cy, sx, sy, floor, clear]
    const wallN = specV<any>('treasury', 'n_range').inner_wall[1] as number; // the inner wall's N face (grid y)
    // along the wall's foot inside the room, 0.1 m off its face, vs 1.5 m into the room: no bright strip at the wall. The
    // points keep 2.4 m or more from the S doorway (x 184.0–185.1): within one spacing of a doorway a cell whose far side
    // has one probe in line with the opening still blends (D-152: the residual is a ≤ 0.3 m band beside the jambs)
    for (const dx of [-5.5, -3.5, 3.5, 5.5]) {
      const foot = visAt(F, sx + dx, sfl + 0.3, -(wallN + 0.1)), room = visAt(F, sx + dx, sfl + 0.3, -(wallN + 1.5));
      expect(foot, `x ${sx + dx}`).toBeLessThan(Math.max(2 * room, 0.002));
    }
  });
  it('every roofed hall is darker at its centre than open ground', () => {
    for (const [b, v] of Object.entries(meta.hallCentreVisibility as Record<string, number>)) { expect(v, b).toBeGreaterThan(0); expect(v, b).toBeLessThan(0.2); }
  });
  it('the atlas holds the probes premultiplied by validity (half floats round-trip)', () => {
    const A = atlasData(F), v = F.volumes[0], i = probeIndex(v, 3, 1, 4), [u0, v0] = A.pos[0];
    const t = ((v0 + 4) * A.width + (u0 + 1 * v.dims[0] + 3)) * 4, val = F.data[i * PROBE_STRIDE + 11];
    expect(A.textures[2][t + 3]).toBe(val); expect(A.textures[0][t]).toBeCloseTo(F.data[i * PROBE_STRIDE] * val, 6);
    const x = Float32Array.from([0, 1e-4, 0.123, -0.75, 1.5, 3.25]); const y = decodeField(encodeField(x));
    x.forEach((q, k) => expect(Math.abs(y[k] - q)).toBeLessThanOrEqual(Math.abs(q) * 1e-3 + 1e-7));
  });
  it('open-field reference: up = sky, down = sunlit ground', () => {
    expect(openField(1, S, U, RHO)).toBe(S); expect(openField(-1, S, U, RHO)).toBeCloseTo((S + U) * RHO, 9);
  });
  it('the eye reads the probes inside the volumes and its own estimate outside (probeSkyVisibility, D-113)', async () => {
    const THREE = await import('three/webgpu');
    const R = await import('../src/render/probes/runtime');
    R.setProbeField(F); R.setProbeOccluders(parts);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x6b5a45, 0.97); hemi.color.setRGB(0.75, 0.8, 0.9);
    const sun = new THREE.DirectionalLight(0xffffff, 2.44); sun.position.set(0.3, 0.95, 0.1).multiplyScalar(800); sun.target.position.set(0, 0, 0);
    R.updateProbeLights(hemi, sun);
    const eye = (e: number, n: number, h: number) => R.probeSkyVisibility({ x: e, y: h, z: -n }, () => 0.77);
    expect(eye(-20, 75, 1.6)).toBe(0.77); // outside every volume: the caller's own estimate
    const portico = eye(1.9, 36, fl + 1.6), hall = eye(cx + inner / 2, cy + inner / 2, fl + 1.6);
    expect(portico).toBeGreaterThan(0.005); expect(portico).toBeLessThan(0.1); // shade under the portico roof: a few % of sunlit ground
    expect(hall).toBeLessThan(portico / 5); expect(hall).toBeGreaterThan(0);
    R.setProbeField(null); R.setProbeOccluders(null);
  });
  void yearSunSamples; void TraceScene;
});
