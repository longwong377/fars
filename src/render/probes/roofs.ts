// Under the roofs (session 5): rain, wetness, puddles and snow stop at the roofed halls' eaves. The roofed footprints are the
// light-probe volumes' roof rectangles (field.ts ProbeVolume.roof) below each roof's underside (yHi[0]); runtime.ts
// publishes them when the probe field loads. A box per hall (C): in the Apadana ~2 % of the box's floor sees open sky
// (probe sky visibility > 0.8, session-5 measurement), so a few corners stay dry in rain; rain blown under a portico's
// front edge is not modelled. No imports from the probe runtime or the materials (both use this module).
import { float, max, smoothstep, Fn, positionWorld, uniform } from 'three/tsl';

/** Whether the 467 BCE roofs are there (1) or not (0: the Now view, D-201, the ruin with no roofs). Multiplies the roof mask
 *  (rain, wetness, puddles and snow reach the old hall floors again) and the light-probe field's weight (runtime.ts: the
 *  probes were baked under the roofs; without them every point takes the plain skylight). A uniform, so the shaders need
 *  no rebuild when the view switches. */
export const ROOFS_PRESENT = uniform(1);
let roofsOn = true;
export function setRoofsPresent(on: boolean) { roofsOn = on; ROOFS_PRESENT.value = on ? 1 : 0; }
export const roofsPresent = () => roofsOn;

export interface RoofBox { x0: number; x1: number; z0: number; z1: number; yLo: number; yHi: number }
let BOXES: RoofBox[] = [];
export function setRoofBoxes(b: RoofBox[]) { BOXES = b; }
export function roofBoxes(): readonly RoofBox[] { return BOXES; }
/** CPU: 1 under a roof, 0 in the open (the same boxes and edge ramps as the node) */
export function roofedAt(x: number, y: number, z: number): number {
  if (!roofsOn) return 0; // the Now view (D-201)
  const ss = (a: number, b: number, t: number) => { const u = Math.min(1, Math.max(0, (t - a) / (b - a))); return u * u * (3 - 2 * u); };
  let m = 0;
  for (const r of BOXES) m = Math.max(m, ss(r.x0 - E, r.x0 + E, x) * (1 - ss(r.x1 - E, r.x1 + E, x)) * ss(r.z0 - E, r.z0 + E, z) * (1 - ss(r.z1 - E, r.z1 + E, z)) * ss(r.yLo - 0.5, r.yLo, y) * (1 - ss(r.yHi - 0.5, r.yHi, y)));
  return m;
}
/** the eaves' soft edge (m) */
const E = 0.25;
/** TSL: 1 under a roof at the fragment's world position, 0 in the open. The boxes are read when the shader is built (the
 *  probe field has loaded by then); with none, a constant 0 */
export const roofedNode = Fn(() => {
  const p = positionWorld; let m: any = float(0);
  for (const r of BOXES) {
    const inX = smoothstep(r.x0 - E, r.x0 + E, p.x).mul(float(1).sub(smoothstep(r.x1 - E, r.x1 + E, p.x)));
    const inZ = smoothstep(r.z0 - E, r.z0 + E, p.z).mul(float(1).sub(smoothstep(r.z1 - E, r.z1 + E, p.z)));
    const inY = smoothstep(r.yLo - 0.5, r.yLo, p.y).mul(float(1).sub(smoothstep(r.yHi - 0.5, r.yHi, p.y)));
    m = max(m, inX.mul(inZ).mul(inY));
  }
  return m.mul(ROOFS_PRESENT);
});
