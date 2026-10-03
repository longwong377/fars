// s15/ship (D-368): the site's own files kept in the browser's Cache Storage, so a second visit loads nothing over the network.
// The HTTP cache cannot do it: the first minute fetches ~400 MB, past Chrome's HTTP-cache size, and its LRU evicts the early
// files while the late ones arrive (measured: a second visit fetched every file again). Cache Storage has the origin's quota.
// Same-origin GETs under this scope only (the models on Hugging Face are cached by their own loaders). The build stamps
// BUILD (tools/deploy/build_site.mjs): a new deploy is a new worker, with a cache of its own.
// D-580 (s17): a new deploy no longer fetches the whole site again (~340 MB before the player can walk): the build lists every
// file's content hash (site-files.json, kept in each build's cache at install); a file the new build has unchanged is taken
// from the previous build's cache (and stored in the new one) instead of the network. One previous cache is kept; older ones
// are dropped when a new worker activates.
const BUILD = '__PARSA_BUILD__', CACHE = 'parsa-site-' + BUILD, MANIFEST = 'site-files.json';
const tsOf = k => parseInt(k.split('-').pop(), 36) || 0, others = async () => (await caches.keys()).filter(k => k.startsWith('parsa-site-') && k !== CACHE).sort((a, b) => tsOf(b) - tsOf(a));
let carryP = null;
const carry = () => (carryP ??= (async () => {
  const ks = await others(); if (!ks.length) return null; const prev = await caches.open(ks[0]), u = new URL(MANIFEST, self.registration.scope).href;
  const [a, b] = await Promise.all([prev.match(u), caches.open(CACHE).then(c => c.match(u))]); if (!a || !b) return null;
  const [ma, mb] = await Promise.all([a.json(), b.json()]);
  return { prev, same: new Set(Object.keys(mb).filter(p => ma[p] && ma[p] === mb[p])) };
})().catch(() => null));
// D-393: a file already on its way (the page's early warming, src/shell/warm.ts, and then its loader) is fetched once: the
// second request waits for the first to be stored and is answered from the cache
const inflight = new Map();
self.addEventListener('install', e => { self.skipWaiting(); e.waitUntil((async () => { try {
  const u = new URL(MANIFEST, self.registration.scope).href, r = await fetch(u, { cache: 'no-store' }); if (r.ok) await (await caches.open(CACHE)).put(u, r); } catch { /* no list: nothing carried over */ } })()); });
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of (await others()).slice(1)) await caches.delete(k); // (the newest previous build's cache is kept: carry())
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== self.location.origin || !u.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  if (r.headers.has('range')) return; // (media range requests: the network)
  e.respondWith(serve(r, u, e.waitUntil.bind(e)));
});
// D-580: the page's prefetch (src/core/prefetch.ts) runs here, off the page's main thread: read there, the downloads stalled
// whenever the page decoded (measured: 8 MB in 5 s of a 100 Mbit/s line while the scans decoded). The page posts the list
// (the files a cold visit needs before it can walk, in the order it asks for them); `n` at a time, each stored once (the
// loaders' own requests for a file on its way wait for it, below); the page hears {prefetched: stats} at the end
self.addEventListener('message', e => {
  const m = e.data; if (!m || m.type !== 'prefetch' || !Array.isArray(m.urls)) return;
  const st = { files: m.urls.length, done: 0, failed: 0, cached: 0, bytes: 0, ms: 0 }, t0 = Date.now(); let next = 0;
  const one = async () => { while (next < m.urls.length) { const url = new URL(m.urls[next++], self.registration.scope);
    try { const c = await caches.open(CACHE); if (await c.match(url.origin + url.pathname + url.search)) { st.cached++; continue; }
      const res = await serve(new Request(url.href), url, p => p); if (res.ok) { st.bytes += (await res.arrayBuffer()).byteLength; st.done++; } else st.failed++; }
    catch { st.failed++; } } };
  const all = Promise.all(Array.from({ length: Math.max(1, Math.min(6, m.n | 0 || 3)) }, one)).then(() => { st.ms = Date.now() - t0; e.source?.postMessage?.({ prefetched: st }); });
  e.waitUntil(all);
});
async function serve(r, u, waitUntil) {
  {
    const c = await caches.open(CACHE), key = u.origin + u.pathname + u.search;
    if (r.mode === 'navigate') { // the page itself from the network (a new deploy's page and code at once), the cache when offline
      try { const res = await fetch(r); if (res.ok) waitUntil(c.put(key, res.clone()).catch(() => {})); return res; }
      catch (err) { const h = await c.match(key); if (h) return h; throw err; } }
    const hit = await c.match(key);
    if (hit) return hit;
    const cr = u.search ? null : await carry(), rel = u.pathname.slice(new URL(self.registration.scope).pathname.length);
    if (cr?.same.has(rel)) { const h = await cr.prev.match(key); if (h) { const copy = h.clone(); waitUntil(copy.arrayBuffer().then(b => c.put(key, new Response(b, { status: 200, headers: copy.headers }))).catch(() => {})); return h; } }
    const was = inflight.get(key);
    if (was) { await was; const h = await c.match(key); if (h) return h; }
    let done; inflight.set(key, new Promise(ok => { done = ok; }));
    const end = () => { inflight.delete(key); done(); };
    try { const res = await fetch(r.url, { credentials: 'same-origin' });
      // (D-393: stored from the body's bytes: Chrome refused to store a network-backed response over ~10 MB here, Cache.put()
      // "network error" for the 14-44 MB files, so every visit fetched them again; a response made from the bytes is stored)
      if (res.ok && res.status === 200 && res.type === 'basic') { const copy = res.clone();
        waitUntil(copy.arrayBuffer().then(b => c.put(key, new Response(b, { status: 200, headers: copy.headers }))).catch(() => {}).finally(end)); } else end();
      return res; }
    catch (err) { end(); throw err; }
  }
}
