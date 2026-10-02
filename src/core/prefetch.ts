// s17/load (D-580, UD-31): a cold visit's network sat idle from ~5 s to ~20 s while the scans decoded (measured: 5 MB in those
// 15 s at a 100 Mbit/s cap), and the world's files were asked for only when the build reached them (the Terrace's set at 20 s,
// the town's and the plain's at 36 s; the build then waited 12 s and 10 s for them). This has the service worker (public/sw.js)
// fetch the files a cold visit needs before it can walk (dist/boot-files.json, in the order the page asks for them:
// tools/deploy/boot_list.mjs) a few at a time from the first seconds, so they are in its cache when their loaders ask (a
// loader asking for one on its way waits for it). Bytes only: every decode stays where it was (on a 4-thread box decoding
// early slowed the boot, D-393). In the worker, not here: read on the page's main thread the downloads stalled whenever the
// page decoded. Only under the service worker; ?prefetch=0 turns it off.
// (It replaces shell/warm.ts's opt-in warming, which read six at a time on the page: on the measuring server's HTTP/1.1 that
// took all six of the browser's connections to the host and queued the scans behind 28 MB files.)
export const prefetchStats: { files: number; skipped?: string; done?: number; failed?: number; cached?: number; bytes?: number; ms?: number } = { files: 0 };
export async function prefetchBootFiles(base: string, seed: number, concurrency = 3): Promise<typeof prefetchStats> {
  const q = new URLSearchParams(location.search), sw = navigator.serviceWorker?.controller;
  if (q.get('prefetch') === '0') { prefetchStats.skipped = 'off (?prefetch=0)'; return prefetchStats; }
  if (!sw) { prefetchStats.skipped = 'no service worker in control'; return prefetchStats; }
  let list: string[];
  try { const r = await fetch(base + 'boot-files.json'); if (!r.ok) { prefetchStats.skipped = `boot-files.json ${r.status}`; return prefetchStats; } list = await r.json(); }
  catch (e) { prefetchStats.skipped = String(e); return prefetchStats; }
  prefetchStats.files = list.length;
  const done = new Promise<void>(res => navigator.serviceWorker.addEventListener('message', function on(e: MessageEvent) {
    if (!e.data?.prefetched) return; Object.assign(prefetchStats, e.data.prefetched); navigator.serviceWorker.removeEventListener('message', on); res(); }));
  navigator.serviceWorker.startMessages?.();
  sw.postMessage({ type: 'prefetch', n: +(q.get('prefetch') ?? concurrency) || concurrency, urls: list.map(p => base + p.split('{seed}').join(String(seed))) });
  await done; return prefetchStats;
}
