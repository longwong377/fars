// s15/ship (D-368): the site's own files kept in the browser's Cache Storage, so a second visit loads nothing over the network.
// The HTTP cache cannot do it: the first minute fetches ~400 MB, past Chrome's HTTP-cache size, and its LRU evicts the early
// files while the late ones arrive (measured: a second visit fetched every file again). Cache Storage has the origin's quota.
// Same-origin GETs under this scope only (the models on Hugging Face are cached by their own loaders). The build stamps
// BUILD (tools/deploy/build_site.mjs): a new deploy is a new worker, which drops the old build's cache when it activates.
const BUILD = '__PARSA_BUILD__', CACHE = 'parsa-site-' + BUILD;
// D-393: a file already on its way (the page's early warming, src/shell/warm.ts, and then its loader) is fetched once: the
// second request waits for the first to be stored and is answered from the cache
const inflight = new Map();
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k.startsWith('parsa-site-') && k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const r = e.request, u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== self.location.origin || !u.pathname.startsWith(new URL(self.registration.scope).pathname)) return;
  if (r.headers.has('range')) return; // (media range requests: the network)
  e.respondWith((async () => {
    const c = await caches.open(CACHE), key = u.origin + u.pathname + u.search;
    if (r.mode === 'navigate') { // the page itself from the network (a new deploy's page and code at once), the cache when offline
      try { const res = await fetch(r); if (res.ok) e.waitUntil(c.put(key, res.clone()).catch(() => {})); return res; }
      catch (err) { const h = await c.match(key); if (h) return h; throw err; } }
    const hit = await c.match(key);
    if (hit) return hit;
    const was = inflight.get(key);
    if (was) { await was; const h = await c.match(key); if (h) return h; }
    let done; inflight.set(key, new Promise(ok => { done = ok; }));
    const end = () => { inflight.delete(key); done(); };
    try { const res = await fetch(r.url, { credentials: 'same-origin' });
      // (D-393: stored from the body's bytes: Chrome refused to store a network-backed response over ~10 MB here, Cache.put()
      // "network error" for the 14-44 MB files, so every visit fetched them again; a response made from the bytes is stored)
      if (res.ok && res.status === 200 && res.type === 'basic') { const copy = res.clone();
        e.waitUntil(copy.arrayBuffer().then(b => c.put(key, new Response(b, { status: 200, headers: copy.headers }))).catch(() => {}).finally(end)); } else end();
      return res; }
    catch (err) { end(); throw err; }
  })());
});
