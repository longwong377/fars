// People's bodies: the Phase 3 procedural rigs (PLACEHOLDER) were replaced by the MakeHuman-derived bodies in period
// dress (D-025: humanAssets.ts, outfits.ts, looks.ts, humanRig.ts, humanMaterial.ts, humanGPU.ts, crowd.ts). This module
// keeps the dress vocabulary the simulation imports (src/people/sim.ts) and the prop geometry entry point.
export type { Dress } from './outfits';
export { propGeometry } from './props';
