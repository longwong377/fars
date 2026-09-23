// Effect materials in the post pipeline's MRT pass (session 4): flames, smoke, rain, snow, haze and rain shafts draw
// colour only. Their writes to the G-buffer attachments the SSGI composite reads (diffuse colour, packed normal, velocity)
// are zero, which both additive and alpha blending leave unchanged. Before, a flame quad added its own normal and colour
// into those buffers, and the composite drew a pale rectangle around every brazier flame at night (PROGRESS, session 3).
import * as THREE from 'three/webgpu';
import { mrt, vec4, output } from 'three/tsl';

export function colourOnly<T extends THREE.Material>(m: T): T {
  // `output` stays the material's own colour (also where a render target has no renderer MRT)
  (m as any).mrtNode = mrt({ output, diffuseColor: vec4(0), normal: vec4(0), velocity: vec4(0) });
  return m;
}
