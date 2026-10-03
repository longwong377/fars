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
// s17 D-473: on by default (?shareinst=0 for three's own choice). D-290's A/B at test quality drew the same picture; the full
// world's pipelines are each a multi-second compile on the T4, and every distinct instance count was one more
let ON = !(typeof location !== 'undefined' && new URLSearchParams(location.search).get('shareinst') === '0');
/** tests and tools: share (true) or not for shaders built from now on */
export function setShareInstancing(on: boolean) { ON = on; }
/** the attribute path costs vertex attributes: 4 for the matrix, 4 for the previous frame's (the velocity output under TRAA)
 *  and 1 for an instance colour, within WebGPU's 16 (the first opt-in render at quality high failed validation at locations
 *  16-18: session 9) */
export const MAX_VERTEX_ATTRIBUTES = 16;
/** and vertex buffers (D-473): the matrix, the previous frame's and the instance colour are 3 more, within WebGPU's default 8 */
export const MAX_VERTEX_BUFFERS = 8;
export function fitsAttributes(o: any): boolean { const A = Object.values(o.geometry?.attributes ?? {}) as any[];
  return A.length + 9 <= MAX_VERTEX_ATTRIBUTES && new Set(A.map(a => a.isInterleavedBufferAttribute ? a.data : a)).size + 3 <= MAX_VERTEX_BUFFERS; }
if (!proto.__parsaShareInstancing) {
  const base = proto.getUniformBufferLimit;
  proto.getUniformBufferLimit = function (this: any) { const o = this.object; return ON && o?.isInstancedMesh && !o.isSkinnedMesh && fitsAttributes(o) ? 0 : base.call(this); };
  proto.__parsaShareInstancing = true;
}
