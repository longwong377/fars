// Save/load of world state + settings (brief §6 Determinism and saves). World state is fully reconstructible from
// (seed, clock, overrides, player) plus the NPC snapshot added in Phase 5.
// Storage (H workstream; gates T-H3s, T-H3v): IndexedDB holds the save (no 5 MB localStorage ceiling, asynchronous); a
// localStorage copy is kept beside it while it fits, because it is written synchronously and so survives a tab closed in
// the middle of an asynchronous write. A failed save and a save that cannot be loaded are announced out-of-world
// (`onSaveProblem`, shown by the shell), never lost silently.
export interface SaveGame {
  v: 1; savedAt: string; seed: number; clockT: number; timeScale: number; weatherOverride: string;
  player: { x: number; y: number; z: number; yaw: number; pitch: number };
  npc?: unknown; memory?: unknown;
  /** door states (D-051): swing target, barred, sealed, moved by the visitor */
  doors?: unknown;
}
const KEY = 'parsa.save.v1', DB = 'parsa', STORE = 'saves';
/** the save's size ceiling (T-H3s: ≤ 2 MB after 100 bot-hours); a larger save is still written, and announced */
export const MAX_SAVE_BYTES = 2 * 1024 * 1024;
/** out-of-world notices about saving and loading (the shell shows them; English, never in the world) */
export let onSaveProblem: (message: string) => void = m => console.warn('[save]', m);
export function setSaveProblemHandler(f: (message: string) => void) { onSaveProblem = f; }
/** bytes of a save as stored (UTF-16 in localStorage; the JSON's length is the measure used for T-H3s) */
export const saveBytes = (s: SaveGame | string) => (typeof s === 'string' ? s : JSON.stringify(s)).length;

let dbP: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  if (dbP) return dbP;
  dbP = new Promise(res => {
    try { if (typeof indexedDB === 'undefined') return res(null);
      const rq = indexedDB.open(DB, 1); rq.onupgradeneeded = () => rq.result.createObjectStore(STORE); rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); rq.onblocked = () => res(null);
    } catch { res(null); } });
  return dbP;
}
const idbPut = async (json: string) => { const d = await db(); if (!d) throw new Error('IndexedDB unavailable');
  await new Promise<void>((res, rej) => { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(json, KEY); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error); }); };
const idbGet = async (): Promise<string | null> => { const d = await db(); if (!d) return null;
  return new Promise(res => { try { const rq = d.transaction(STORE, 'readonly').objectStore(STORE).get(KEY); rq.onsuccess = () => res(typeof rq.result === 'string' ? rq.result : null); rq.onerror = () => res(null); } catch { res(null); } }); };
const idbDel = async () => { const d = await db(); if (!d) return; await new Promise<void>(res => { try { const tx = d.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(KEY); tx.oncomplete = () => res(); tx.onerror = () => res(); } catch { res(); } }); };

/** the last write's outcome (tests): bytes, where it went, and the asynchronous IndexedDB write's promise */
export const lastWrite: { bytes: number; local: boolean; idb: Promise<boolean> | null } = { bytes: 0, local: false, idb: null };
/** write the save: IndexedDB (asynchronous) and the localStorage copy (synchronous, while it fits). True when it was
 *  accepted by at least one store now or IndexedDB is writing it; a failure of both is announced. */
export function writeSave(s: SaveGame): boolean {
  const json = JSON.stringify(s), bytes = saveBytes(json); lastWrite.bytes = bytes;
  if (bytes > MAX_SAVE_BYTES) onSaveProblem(`The saved visit is large (${(bytes / 1048576).toFixed(1)} MB); it is kept, but saving may be slow.`);
  let local = false; try { localStorage.setItem(KEY, json); local = true; } catch { try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ } }
  lastWrite.local = local;
  const hasIdb = typeof indexedDB !== 'undefined';
  lastWrite.idb = hasIdb ? idbPut(json).then(() => true, e => { if (!local) onSaveProblem(`The visit could not be saved (${String(e?.message ?? e)}).`); return false; }) : null;
  if (!local && !hasIdb) onSaveProblem('The visit could not be saved: this browser keeps no storage for the page.');
  return local || hasIdb;
}
/** parse a stored save, migrating older versions (T-H3v): a save of the previous build (v1, without the walks in progress,
 *  the chronicle or the route cache) loads as it is; anything unreadable is announced and dropped */
export function parseSave(raw: string | null): SaveGame | null {
  if (!raw) return null;
  let s: any; try { s = JSON.parse(raw); } catch { onSaveProblem('The saved visit could not be read and was set aside; a new visit begins.'); return null; }
  if (!s || typeof s !== 'object') return null;
  if (s.v !== 1 || typeof s.seed !== 'number' || typeof s.clockT !== 'number' || !s.player) { onSaveProblem(`The saved visit is from a version this build cannot read (${String(s.v)}); a new visit begins.`); return null; }
  return s as SaveGame;
}
/** the localStorage copy (synchronous) */
export function readSave(): SaveGame | null { let r: string | null = null; try { r = localStorage.getItem(KEY); } catch { /* storage unavailable */ } return parseSave(r); }
/** the save: IndexedDB first, else the localStorage copy (whichever was written last wins when both exist) */
export async function readSaveAsync(): Promise<SaveGame | null> {
  let local: string | null = null; try { local = localStorage.getItem(KEY); } catch { /* storage unavailable */ }
  const idb = await idbGet().catch(() => null);
  if (idb && local) { try { return parseSave(Date.parse(JSON.parse(idb).savedAt) >= Date.parse(JSON.parse(local).savedAt) ? idb : local); } catch { return parseSave(idb); } }
  return parseSave(idb ?? local);
}
export function clearSave(): void { try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ } void idbDel(); }

/** autosave interval (real milliseconds; gates T-H3: ≤ 5 minutes). The save is ~90 kB (the 135 detailed people, their
 *  memory and relations, the chronicle, the route cache, the visitor, the doors), a few ms to write. */
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
