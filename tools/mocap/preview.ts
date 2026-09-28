// D-333: contact sheets of retargeted poses (iteration only, not evidence of the game's look): each pose is skinned on a
// real body variant with the game's own rig (humanRig.ts RigSolver: the same FK, plant and seat passes the crowd uses)
// and written into one OBJ, bodies in a grid on the ground (y-up metres); tools/mocap/sheet.py renders it in Blender
// (Workbench, orthographic side and front views, a ground grid of 0.5 m) to a PNG.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { decodeHumanAssets, type HumanAssets } from '../../src/people/humanAssets';
import { RigSolver, PALETTE_STRIDE, skinPoint, type RigInput } from '../../src/people/humanRig';
import { PART } from '../../src/people/humanFormat';
import type { Pose } from '../../src/people/anim';

let A: HumanAssets | null = null;
export function assets() {
  if (!A) { const b = readFileSync('public/generated/humans/humans.bin'); A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer); }
  return A;
}
export interface Cell { pose: Pose; label?: string; variant?: string; seat?: boolean; plant?: boolean; x?: number; z?: number; yaw?: number; grip?: [number, number] }
const BLENDER = 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe';
/** write the OBJ of cells laid out in rows (`cols` per row, `dx`/`dz` apart) and render it; returns the PNG path */
export function sheet(out: string, cells: Cell[], o: { cols?: number; dx?: number; dz?: number; views?: string[]; res?: number } = {}) {
  const H = assets(); const cols = o.cols ?? cells.length, dx = o.dx ?? 1.0, dz = o.dz ?? 2.2;
  const rig = new RigSolver(H.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE);
  const lines: string[] = []; let vo = 1; const tri = H.lods[1]; const keep = (i: number) => H.part[i] < PART.eye;
  cells.forEach((c, n) => {
    const v = H.byId[c.variant ?? 'm03'] ?? H.variants[0];
    const x = c.x ?? (n % cols) * dx, z = c.z ?? -Math.floor(n / cols) * dz;
    const inp: RigInput = { joints: v.joints, pose: c.pose, face: { jaw: 0, blink: 0, look: null, eyeYaw: 0, eyePitch: 0 }, grip: c.grip ?? c.pose.grip ?? [0.3, 0.3], x, y: 0, z, yaw: c.yaw ?? 0, scale: 1, plant: c.plant ?? !c.seat, seat: !!c.seat };
    rig.setPose(inp); rig.solve(inp, pal, 0);
    const map = new Int32Array(H.NO).fill(-1); const o3 = [0, 0, 0];
    lines.push(`o p${n}`);
    for (let i = 0; i < H.NO; i++) { if (!keep(i)) continue; skinPoint(pal, 0, H.skinIndex.subarray(i * 4, i * 4 + 4), Array.from(H.skinWeight.subarray(i * 4, i * 4 + 4), w => w / 255), v.pos.subarray(i * 3, i * 3 + 3), o3);
      map[i] = vo++; lines.push(`v ${o3[0].toFixed(4)} ${o3[1].toFixed(4)} ${o3[2].toFixed(4)}`); }
    for (let t = 0; t < tri.length; t += 3) { const a = map[tri[t]], b = map[tri[t + 1]], cc = map[tri[t + 2]]; if (a > 0 && b > 0 && cc > 0) lines.push(`f ${a} ${b} ${cc}`); }
  });
  mkdirSync(out.replace(/[^/\\]+$/, ''), { recursive: true });
  const obj = out.replace(/\.png$/, '.obj'); writeFileSync(obj, lines.join('\n'));
  const job = out.replace(/\.png$/, '.json'); writeFileSync(job, JSON.stringify({ obj, png: out, views: o.views ?? ['side', 'front'], res: o.res ?? 1600, labels: cells.map(c => c.label ?? '') }));
  execFileSync(BLENDER, ['-b', '--factory-startup', '--python', 'tools/mocap/sheet.py', '--', job], { stdio: 'pipe' });
  return out;
}
