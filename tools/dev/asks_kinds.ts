// Counts the economy's event kinds over a year with the life stub (D-352): npx tsx tools/dev/asks_kinds.ts [seed]
import { Population } from '../../src/people/population';
import { Economy } from '../../src/people/economy/world';
import { householdsOf } from '../../src/people/economy/chains';
const seed = Number(process.argv[2] ?? 1), hs = householdsOf(new Population(seed));
const E = new Economy(seed, hs, { life: { deaths: () => 0, sicken: (_h, _f, _u, dieOn) => ({ ok: true, died: dieOn >= 0 }) } }); for (let d = 0; d < 354; d++) E.step(d);
const k: Record<string, number> = {}; for (const e of E.events) k[e.kind] = (k[e.kind] ?? 0) + 1; console.log(JSON.stringify(k));
