// Types for three's bundled meshoptimizer simplifier (MIT; examples/jsm/libs), used by tools/build_humans.ts only.
declare module 'three/addons/libs/meshopt_simplifier.module.js' {
  export const MeshoptSimplifier: {
    ready: Promise<void>;
    simplifyWithAttributes(indices: Uint32Array, positions: Float32Array, positionsStride: number, attributes: Float32Array, attributesStride: number,
      weights: number[], lock: Uint8Array | null, targetIndexCount: number, targetError: number, flags: number): [Uint32Array, number];
  };
}
