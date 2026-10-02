// A new world seed per new game (D-236, UD-09; MASTER_PLAN §6 order, step 1): every new world is drawn afresh, so two players
// (or one player twice) never walk the same year; the seed still reproduces its world exactly (brief §6) and is shown in the
// settings. Tests and the bench keep the fixed default so their views are reproducible; ?seed=N always wins.
// D-392 (s15/load, the lead's decision for UD-31): a FIRST visit's world is drawn from the baked worlds (WORLD_SEED_POOL: the
// site build bakes each one's seeded stages, so a first visit is walkable in under a minute); the seed still drives the day,
// the events and the people from there, and worlds still differ between visits. A new game (newWorldSeed) draws afresh as
// before: built live once, then kept by the browser (world/cache/worldCache.ts).
import { WORLD_SEED_DEFAULT } from './rng';

const KEY = 'parsa.worldSeed';
/** the worlds the site build bakes (tools/bake_world/bake.ts); the first is the tests' default */
export const WORLD_SEED_POOL: readonly number[] = [WORLD_SEED_DEFAULT, 467, 2203, 5150, 9101, 13013, 31337, 70707];
/** a world from the baked pool, by the platform's entropy */
export function drawPoolSeed(): number { const a = new Uint32Array(1); globalThis.crypto.getRandomValues(a); return WORLD_SEED_POOL[a[0] % WORLD_SEED_POOL.length]; }
type Store = Pick<Storage, 'getItem' | 'setItem'>;
const storage = (): Store | null => { try { return globalThis.localStorage ?? null; } catch { return null; } };

/** a fresh seed from the platform's entropy (the one place a seed is drawn; nothing in the world uses Math.random) */
export function drawSeed(): number {
  const a = new Uint32Array(1); globalThis.crypto.getRandomValues(a); return (a[0] % 2147483646) + 1;
}
/** the seed this world runs on: ?seed=N, else the fixed default for tests and the bench, else this browser's current world
 *  (drawn from the baked pool and kept on the first visit) */
export function chooseWorldSeed(param: string | null, fixed: boolean, store: Store | null = storage()): number {
  if (param !== null && Number.isFinite(+param) && param.trim() !== '') return +param;
  if (fixed) return WORLD_SEED_DEFAULT;
  const kept = store?.getItem(KEY);
  if (kept && Number.isFinite(+kept)) return +kept;
  const s = drawPoolSeed(); try { store?.setItem(KEY, String(s)); } catch { /* private window: the world lasts the session */ }
  return s;
}
/** begin a new world: draw a seed and keep it (the caller clears the save and reloads) */
export function newWorldSeed(store: Store | null = storage()): number {
  const s = drawSeed(); try { store?.setItem(KEY, String(s)); } catch { /* as above */ } return s;
}
/** keep a loaded save's seed as this browser's current world */
export function keepWorldSeed(seed: number, store: Store | null = storage()) { try { store?.setItem(KEY, String(seed)); } catch { /* as above */ } }
