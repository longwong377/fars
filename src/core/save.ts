// Save/load of world state + settings (brief §6 Determinism and saves). World state is fully reconstructible from
// (seed, clock, overrides, player) plus the NPC snapshot added in Phase 5.
export interface SaveGame {
  v: 1; savedAt: string; seed: number; clockT: number; timeScale: number; weatherOverride: string;
  player: { x: number; y: number; z: number; yaw: number; pitch: number };
  npc?: unknown; memory?: unknown;
  /** door states (D-051): swing target, barred, sealed, moved by the visitor */
  doors?: unknown;
}
const KEY = 'parsa.save.v1';
export function writeSave(s: SaveGame): boolean { try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; } }
export function readSave(): SaveGame | null { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return null; } }
export function clearSave(): void { try { localStorage.removeItem(KEY); } catch { /* nothing kept */ } }
