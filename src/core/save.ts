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
export function clearSave(): void { try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ } }

/** autosave interval (real milliseconds; gates T-H3: ≤ 5 minutes). The save is ~60 kB (the 135 detailed people, their
 *  memory and relations, the chronicle, the visitor, the doors), a few ms to write. */
export const AUTOSAVE_MS = 60_000;
/** saves the visit without being asked (audit D M9): every AUTOSAVE_MS of real time while `active()`, and at once when the
 *  page is hidden (tab switched or closed: visibilitychange) or unloaded (pagehide, beforeunload). */
export class Autosaver {
  saves = 0; failures = 0; last: { at: number; reason: string } | null = null;
  /** off once the visit is being abandoned (a new visit: the save is cleared and must not be written back on unload) */
  enabled = true;
  private nextAt: number;
  constructor(private write: () => boolean, private active: () => boolean, private now: () => number = () => Date.now(), readonly intervalMs = AUTOSAVE_MS) { this.nextAt = now() + intervalMs; }
  /** save now (a reason for the log); skipped while not active */
  save(reason: string): boolean {
    if (!this.enabled || !this.active()) return false;
    const ok = this.write(); if (ok) this.saves++; else this.failures++;
    this.last = { at: this.now(), reason }; this.nextAt = this.now() + this.intervalMs; return ok;
  }
  /** call every frame: saves when the interval has passed */
  tick(): boolean { return this.now() >= this.nextAt ? this.save('interval') : false; }
  /** listen for the page being hidden or closed */
  attach(win: Pick<Window, 'addEventListener'>, doc: Pick<Document, 'addEventListener' | 'visibilityState'>) {
    doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'hidden') this.save('hidden'); });
    win.addEventListener('pagehide', () => this.save('pagehide'));
    win.addEventListener('beforeunload', () => this.save('beforeunload'));
  }
}
