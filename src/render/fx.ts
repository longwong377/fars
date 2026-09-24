// Effect materials in the post pipeline's MRT pass (session 4): flames, smoke, rain, snow, haze and rain shafts draw
// colour only. Their writes to the G-buffer attachments the SSGI composite reads (diffuse colour, packed normal, velocity)
// are zero, which both additive and alpha blending leave unchanged. Before, a flame quad added its own normal and colour
// into those buffers, and the composite drew a pale rectangle around every brazier flame at night (PROGRESS, session 3).
//
// Outside the MRT pass (quality test and low render the scene straight into the renderer's frame-buffer target, whose
// one texture has no name) three's MRTNode matches none of its outputs to an attachment and emits an empty output struct:
// WGSL rejects it ("structures must have at least one member") and every effect material failed to compile at test
// quality (session 5 smoke render). There the material's colour goes to attachment 0, as without an mrtNode.
import * as THREE from 'three/webgpu';
import { MRTNode } from 'three/webgpu';
import { vec4, output } from 'three/tsl';

class ColourOnlyMRT extends (MRTNode as any) {
  constructor(outputs: Record<string, any>) { super(outputs); }
  setup(builder: any) {
    const textures: { name: string }[] = builder.renderer.getRenderTarget()?.textures ?? [];
    const outs = (this as any).outputNodes as Record<string, any>;
    if (!Object.keys(outs).some(n => textures.some(t => t.name === n))) {
      (this as any).members = [outs.output.convert(builder.getOutputType(0))];
      return (THREE as any).OutputStructNode.prototype.setup.call(this, builder);
    }
    return super.setup(builder);
  }
}

export function colourOnly<T extends THREE.Material>(m: T): T {
  (m as any).mrtNode = new ColourOnlyMRT({ output, diffuseColor: vec4(0), normal: vec4(0), velocity: vec4(0) });
  return m;
}
