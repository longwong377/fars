// Terrain seam crossings (audit D M1): the player walks across every kind of seam in the walked terrain, with the
// streamed per-chunk colliders (physics.ts) and the safety net (Player.rescueIfUnderground) active, in the same call
// order as main.ts simStep (stream colliders, move, step, rescue). Used by tests/terrain_walk.test.ts (a sample) and
// tools/dev/terrain_seams.ts (thousands).
//   ring seams: near/mid at ±2,048 m, mid/far at ±10,240 m; chunk seams: every 512 m in the near ring, 2,048 m in the mid,
//   20,480 m in the far; chunk corners. Directions: perpendicular and oblique (up to ±60°), both ways; walk and run.
// Per crossing: fell (feet ever > 0.3 m below the drawn surface), rescued (the safety net fired: must be 0), stopped by
// a slope steeper than the controller climbs (drawn, legitimate), stopped elsewhere (an invisible wall: must be 0), and the
// worst |feet − drawn surface| while grounded on ground under 30° (on a cliff the capsule's side rests on the face).
import * as THREE from 'three/webgpu';
import type { Terrain } from '../../src/terrain/heightfield';
import { TerrainMesh } from '../../src/terrain/terrainMesh';
import { Physics } from '../../src/player/physics';
import { Player } from '../../src/player/player';

export interface SeamResult { crossings: number; fell: number; rescued: number; slopeStopped: number; wall: number; worstGroundGap: number; worstGapAt: string;
  byKind: Record<string, { n: number; fell: number; rescued: number; wall: number; slope: number }>; walls: string[]; falls: string[]; ms: number }

/** deterministic LCG in [0, 1) */
const rng = (seed: number) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };

/** the drawn slope angle (deg) at (x, z) along the unit direction (dx, dz), steepest over the next 1.5 m */
function slopeAhead(T: Terrain, x: number, z: number, dx: number, dz: number) {
  let worst = 0;
  for (let s = 0; s <= 1.5; s += 0.25) { const ax = x + dx * s, az = z + dz * s, h0 = T.heightAt(ax, az), h1 = T.heightAt(ax + dx * 0.5, az + dz * 0.5);
    // the full gradient too: a slope across the direction can stop the capsule sliding along it
    const gx = (T.heightAt(ax + 0.5, az) - T.heightAt(ax - 0.5, az)), gz = (T.heightAt(ax, az + 0.5) - T.heightAt(ax, az - 0.5));
    worst = Math.max(worst, Math.atan2(Math.abs(h1 - h0), 0.5) * 180 / Math.PI, Math.atan(Math.hypot(gx, gz)) * 180 / Math.PI); }
  return worst;
}

export function seamCrossings(T: Terrain, P: Physics, n: number, seed = 1, opts: { before?: number; after?: number } = {}): SeamResult {
  const t0 = Date.now(), R = rng(seed), before = opts.before ?? 10, after = opts.after ?? 10;
  const near = T.near.half, mid = T.mid.half, far = T.far.half;
  // seam families: [kind, lines (positions along the crossing axis), extent along the seam]
  const lines = (step: number, half: number) => { const o: number[] = []; for (let v = -half + step; v < half - 1e-6; v += step) o.push(v); return o; };
  const fam: [string, number[], number, number][] = [ // kind, seam positions, extent lo, extent hi (|along| range)
    ['ring near/mid', [-near, near], 0, near],
    ['ring mid/far', [-mid, mid], 0, mid],
    ['chunk near', lines(512, near), 0, near],
    ['chunk mid', lines(2048, mid).filter(v => Math.abs(v) > near), 0, mid],
    ['chunk far', lines(20480, far).filter(v => Math.abs(v) > mid), mid, 50000],
    ['corner near', lines(512, near), 0, 0],
    ['corner mid', lines(2048, mid).filter(v => Math.abs(v) >= near), 0, 0],
  ];
  const res: SeamResult = { crossings: 0, fell: 0, rescued: 0, slopeStopped: 0, wall: 0, worstGroundGap: 0, worstGapAt: '', byKind: {}, walls: [], falls: [], ms: 0 };
  const dt = 1 / 30;
  for (let k = 0; k < n; k++) {
    const [kind, pos, lo, hi] = fam[k % fam.length];
    const seamAt = pos[Math.floor(R() * pos.length)];
    let x: number, z: number; const alongX = R() < 0.5; // the seam runs along x (a z-line) or along z (an x-line)
    let along: number;
    if (kind.startsWith('corner')) along = pos[Math.floor(R() * pos.length)];
    else { along = (lo + (hi - lo) * R()) * (R() < 0.5 ? -1 : 1); if (kind === 'ring near/mid' || kind === 'ring mid/far') along = Math.max(-(hi - 1), Math.min(hi - 1, along)); }
    // crossing direction: across the seam, both ways, ±60° oblique (a corner: any direction)
    const sign = R() < 0.5 ? -1 : 1, obl = kind.startsWith('corner') ? R() * Math.PI * 2 : (R() - 0.5) * (Math.PI * 2 / 3);
    let dx: number, dz: number;
    if (alongX) { dx = Math.sin(obl); dz = sign * Math.cos(obl); x = along; z = seamAt; } else { dx = sign * Math.cos(obl); dz = Math.sin(obl); x = seamAt; z = along; }
    if (kind.startsWith('corner')) { const d = Math.hypot(dx, dz); dx /= d; dz /= d; }
    const x0 = x - dx * before, z0 = z - dz * before, run = R() < 0.4;
    P.updateTerrain(T, { x: x0, y: 0, z: z0 });
    const pl = new Player(P, x0, T.heightAt(x0, z0) + 0.05, z0);
    const yaw = Math.atan2(-dx, -dz); // yaw 0 looks toward −z; forward = (−sin yaw, −cos yaw)
    const step = (fwd: number) => { P.updateTerrain(T, pl.position); pl.update(dt, { forward: fwd, right: 0, run, yaw, pitch: 0 }); P.step(dt); pl.rescueIfUnderground((a, b) => T.heightAt(a, b)); };
    for (let i = 0; i < 8; i++) step(0);
    let fell = false, best = -Infinity, lastProgress = 0, t = 0, stopped = false;
    const total = before + after, speed = run ? 3.2 : 1.35, tMax = (total / speed) * 3 + 4;
    while (t < tMax) {
      step(1); t += dt;
      const p = pl.position, prog = (p.x - x0) * dx + (p.z - z0) * dz, g = T.heightAt(p.x, p.z), gap = pl.feetY - g;
      if (gap < -0.3) fell = true;
      if (pl.grounded && Math.abs(gap) > res.worstGroundGap && Math.abs(gap) < 5 && slopeAhead(T, p.x, p.z, dx, dz) < 30) { res.worstGroundGap = Math.abs(gap); res.worstGapAt = `${kind} at world (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) gap ${gap.toFixed(2)} dir (${dx.toFixed(3)}, ${dz.toFixed(3)}) run ${run} t ${t.toFixed(2)} slope ${slopeAhead(T, p.x, p.z, dx, dz).toFixed(0)}°`; }
      if (prog >= total) break;
      if (prog > best + 0.05) { best = prog; lastProgress = t; }
      if (t - lastProgress > 3) { stopped = true; break; }
    }
    const b = (res.byKind[kind] ??= { n: 0, fell: 0, rescued: 0, wall: 0, slope: 0 }); b.n++; res.crossings++;
    const rescued = pl.rescues > 0;
    if (fell) { res.fell++; b.fell++; if (res.falls.length < 20) res.falls.push(`${kind} at (${pl.position.x.toFixed(0)}, ${pl.position.z.toFixed(0)})`); }
    if (rescued) { res.rescued++; b.rescued++; }
    if (stopped) {
      const p = pl.position, s = slopeAhead(T, p.x, p.z, dx, dz);
      if (s > 38) { res.slopeStopped++; b.slope++; }
      else { res.wall++; b.wall++; if (res.walls.length < 20) res.walls.push(`${kind} at world (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) dir (${dx.toFixed(2)}, ${dz.toFixed(2)}) slope ${s.toFixed(0)}°`); }
    }
    P.world.removeCollider(pl.collider, false); P.world.removeRigidBody(pl.body); P.world.removeCharacterController(pl.controller);
  }
  res.ms = Date.now() - t0;
  return res;
}

/** collider vs DRAWN ground at the ring seams (gates T-H1): N samples per seam (near/mid ±2,048 m, mid/far ±10,240 m; a
 *  ±64 m band either side of the seam line, all four sides): a ray cast on the streamed chunk colliders against the height
 *  read from the terrain mesh's own full-resolution chunk geometry (its vertex and index buffers, not Terrain.heightAt) */
export function seamSamples(T: Terrain, P: Physics, N = 10000, seed = 7) {
  const t0 = Date.now(), mesh = new TerrainMesh(T, 1) as any, geoms = new Map<any, THREE.BufferGeometry>();
  const drawnAt = (x: number, z: number): number => {
    const ch = mesh.chunks.find((c: any) => { const x0 = -c.ring.half + c.c0 * c.ring.cell, z0 = -c.ring.half + c.r0 * c.ring.cell, s = c.cells * c.ring.cell; return x >= x0 && x < x0 + s && z >= z0 && z < z0 + s; });
    let g = geoms.get(ch); if (!g) { g = mesh.buildGeometry(ch, 1) as THREE.BufferGeometry; geoms.set(ch, g); }
    const pos = g.attributes.position.array as Float32Array, idx = g.index!.array, cells = ch.cells, cell = ch.ring.cell;
    const x0 = -ch.ring.half + ch.c0 * cell, z0 = -ch.ring.half + ch.r0 * cell, j = Math.min(cells - 1, Math.floor((x - x0) / cell)), i = Math.min(cells - 1, Math.floor((z - z0) / cell));
    const t0_ = (i * cells + j) * 6; // two triangles per cell, in index order
    for (const t of [t0_, t0_ + 3]) {
      const A = idx[t] * 3, B = idx[t + 1] * 3, C = idx[t + 2] * 3;
      const ax = pos[A], az = pos[A + 2], bx = pos[B], bz = pos[B + 2], cx = pos[C], cz = pos[C + 2];
      const d = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz), u = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / d, v = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / d, w = 1 - u - v;
      if (u >= -1e-6 && v >= -1e-6 && w >= -1e-6) return u * pos[A + 1] + v * pos[B + 1] + w * pos[C + 1];
    }
    throw new Error(`no triangle at ${x}, ${z}`);
  };
  const R = rng(seed), lines: string[] = [], seams: Record<string, { worst_m: number; mean_m: number; n: number; at: string }> = {}; let worst = 0;
  for (const [name, H] of [['near/mid', T.near.half], ['mid/far', T.mid.half]] as const) {
    let w = 0, sum = 0, at = '';
    for (let k = 0; k < N; k++) {
      const side = k % 4, along = (R() * 2 - 1) * (H - 1), across = H + (R() * 2 - 1) * 64;
      const [x, z] = side === 0 ? [across, along] : side === 1 ? [-across, along] : side === 2 ? [along, across] : [along, -across];
      P.updateTerrain(T, { x, y: 0, z }); const hit = P.castRayDown(x, z, 6000);
      const d = hit === null ? Infinity : Math.abs(hit - drawnAt(x, z)); sum += d; if (d > w) { w = d; at = `(${x.toFixed(1)}, ${z.toFixed(1)})`; }
    }
    worst = Math.max(worst, w); seams[name] = { worst_m: +w.toFixed(5), mean_m: +(sum / N).toFixed(6), n: N, at };
    lines.push(`  ${name} seam (±64 m band, ${N} samples): collider vs drawn mesh mean ${(sum / N * 1000).toFixed(2)} mm, worst ${(w * 1000).toFixed(2)} mm at ${at}`);
  }
  return { worst, n: N, seams, lines, ms: Date.now() - t0 };
}
