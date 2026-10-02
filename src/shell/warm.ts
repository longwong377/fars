// s15/ship (D-393): warm the world's files from the page's first seconds. A cold visit spent its first ~24 s decoding the
// terrain and the scans with the network nearly idle, then waited ~30 s more for the models the world build needs; here the
// bytes of those files (dist/boot-files.json, written by tools/deploy/build_site.mjs from tools/deploy/boot_files.txt) are
// fetched at low priority while the scans decode, and kept by the site's service worker (public/sw.js) or the HTTP cache, so
// the loaders find them there. Only bytes: the decoding stays where it was (decoding early slowed a 2-core box). The dev
// server has no list and warms nothing. Only under the service worker, which fetches a file once however often it is asked
// (without it the warming and the loader fetched the same large files twice: measured, 403 MB before ready instead of 333).
export const warmStats = { files: 0, done: 0, failed: 0, bytes: 0, ms: 0 };
export async function warmBootFiles(base: string, concurrency = 6): Promise<void> {
  const t0 = performance.now();
  // (opt-in, ?warm: on the 4-thread measuring box the warming slowed the terrain and scans' decode (19 s -> 37 s) more than
  // it saved; a many-core machine may gain: measure there before turning it on)
  if (!new URLSearchParams(location.search).has('warm')) { (globalThis as any).__warm = { skipped: 'off (?warm turns it on)' }; return; }
  if (!navigator.serviceWorker?.controller) { (globalThis as any).__warm = { ...warmStats, skipped: 'no service worker in control' }; return; }
  let list: string[];
  try { const r = await fetch(base + 'boot-files.json'); if (!r.ok) return; list = await r.json(); } catch { return; }
  warmStats.files = list.length; let next = 0;
  const one = async () => {
    while (next < list.length) { const p = list[next++];
      try { const r = await fetch(base + p, { priority: 'low' } as RequestInit); if (r.ok) { warmStats.bytes += (await r.arrayBuffer()).byteLength; warmStats.done++; } else warmStats.failed++; }
      catch { warmStats.failed++; } }
  };
  await Promise.all(Array.from({ length: concurrency }, one));
  warmStats.ms = Math.round(performance.now() - t0);
  (globalThis as any).__warm = warmStats;
}
