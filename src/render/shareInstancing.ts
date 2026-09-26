// One vertex program for every instanced mesh, whatever its instance count (D-250). three r186 puts the instance matrices of
// an InstancedMesh with ≤ 1,024 instances in a uniform array sized to the count (`array<mat4x4<f32>, N>`), so every distinct
// count is a distinct vertex program and so a distinct render pipeline, and the pipeline compiles its fragment shader again:
// 51 of the 163 pipelines of a test-quality page (3.6 MB of 12.5 MB of WGSL) were such copies, each 1-3 s of SwiftShader
// compile (the load's cost, measured: tools/dev/shader_log.mjs), and a compile hitch on a real GPU (MASTER_PLAN T-K7c).
// For plain (non-skinned) instanced meshes the builder's uniform-buffer limit reads 0, so three takes its per-instance
// attribute path (the path it already takes above 1,024 instances): the same matrices, one program for every count.
// Skinned meshes keep their bone matrices as three chooses.
import { NodeBuilder } from 'three/webgpu';
const proto = NodeBuilder.prototype as any;
let ON = typeof location !== 'undefined' && new URLSearchParams(location.search).get('shareinst') === '1'; // opt-in (?shareinst=1) until verified in a render (D-250)
/** tests and tools: share (true) or not for shaders built from now on */
export function setShareInstancing(on: boolean) { ON = on; }
/** the attribute path costs vertex attributes: 4 for the matrix, 4 for the previous frame's (the velocity output under TRAA)
 *  and 1 for an instance colour, within WebGPU's 16 (the first opt-in render at quality high failed validation at locations
 *  16-18: session 9) */
export const MAX_VERTEX_ATTRIBUTES = 16;
export function fitsAttributes(o: any): boolean { return Object.keys(o.geometry?.attributes ?? {}).length + 9 <= MAX_VERTEX_ATTRIBUTES; }
if (!proto.__parsaShareInstancing) {
  const base = proto.getUniformBufferLimit;
  proto.getUniformBufferLimit = function (this: any) { const o = this.object; return ON && o?.isInstancedMesh && !o.isSkinnedMesh && fitsAttributes(o) ? 0 : base.call(this); };
  proto.__parsaShareInstancing = true;
}
