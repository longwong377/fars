// The Terrace as built (terrace.ts buildTerrace), once per process, for readers that need the built parts without
// drawing them: where the roofs are (people/roofs.ts, D-276), the benches people work at (people/popgeo.ts).
import { buildTerrace } from './terrace';
import type { BuildResult } from './parts';

let T: BuildResult | null = null;
export const terraceBuilt = (): BuildResult => (T ??= buildTerrace());
