// dev (D-276): every people place and court place on the walkable grid? (npx tsx tools/dev/places_walkable.ts)
import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
import { PLACES } from '../../src/people/sim';
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
for (const [id, P] of Object.entries(PLACES) as [string, any][]) if (P.at && !nav.walkable(P.at[0], P.at[1])) console.log('not walkable:', id, P.at, P.kind);
