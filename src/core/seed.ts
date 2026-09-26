// A new world seed per new game (D-236, UD-09; MASTER_PLAN §6 order, step 1): every new world is drawn afresh, so two players
// (or one player twice) never walk the same year; the seed still reproduces its world exactly (brief §6) and is shown in the
// settings. Tests and the bench keep the fixed default so their views are reproducible; ?seed=N always wins.
import { WORLD_SEED_DEFAULT } from './rng';

const KEY = 'parsa.worldSeed';
type Store = Pick<Storage, 'getItem' | 'setItem'>;
const storage = (): Store | null => { try { return globalThis.localStorage ?? null; } catch { return null; } };

/** a fresh seed from the platform's entropy (the one place a seed is drawn; nothing in the world uses Math.random) */
export function drawSeed(): number {
  const a = new Uint32Array(1); globalThis.crypto.getRandomValues(a); return (a[0] % 2147483646) + 1;
}
/** the seed this world runs on: ?seed=N, else the fixed default for tests and the bench, else this browser's current world
 *  (drawn and kept on the first visit) */
export function chooseWorldSeed(param: string | null, fixed: boolean, store: Store | null = storage()): number {
  if (param !== null && Number.isFinite(+param) && param.trim() !== '') return +param;
  if (fixed) return WORLD_SEED_DEFAULT;
  const kept = store?.getItem(KEY);
  if (kept && Number.isFinite(+kept)) return +kept;
  const s = drawSeed(); try { store?.setItem(KEY, String(s)); } catch { /* private window: the world lasts the session */ }
  return s;
}
/** begin a new world: draw a seed and keep it (the caller clears the save and reloads) */
export function newWorldSeed(store: Store | null = storage()): number {
  const s = drawSeed(); try { store?.setItem(KEY, String(s)); } catch { /* as above */ } return s;
}
/** keep a loaded save's seed as this browser's current world */
export function keepWorldSeed(seed: number, store: Store | null = storage()) { try { store?.setItem(KEY, String(seed)); } catch { /* as above */ } }
