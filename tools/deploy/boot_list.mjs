// s17/load (D-580): tools/deploy/boot_files.txt from a measured cold visit (tools/deploy/measure.mjs's visits.json): every
// file the page fetched before ready, in the order it first asked for it (the page prefetches them in this order, src/core/
// prefetch.ts). Left out: the page, the service worker, the scans and the terrain (fetched in the first seconds by their own
// loaders), the code chunks (hashed names; vite preloads them). The world cache's per-world units carry `{seed}` (the page
// fills in its world's seed) and its hashed units `*` (build_site.mjs expands it in the dist). The animals go last (they stream
// in after walkable, world.ts STREAM_LATE).
//   node tools/deploy/boot_list.mjs [visits.json] > tools/deploy/boot_files.txt
import { readFileSync } from 'node:fs';

const v = JSON.parse(readFileSync(process.argv[2] ?? 'visits.json', 'utf8')).visits.cold, seen = new Set(), out = [], late = [];
const seedOf = v.served.map(([p]) => /^world-cache\/zones-(\d+)_/.exec(p)?.[1]).find(Boolean);
for (const [p0, b, t] of [...v.served].sort((x, y) => x[2] - y[2])) {
  if (!b || t > v.readyS * 1000) continue;
  if (/^(index\.html|sw\.js|boot-files\.json|site\.json|favicon\.svg|textures\/|generated\/terrain_|assets\/)/.test(p0)) continue;
  let p = p0;
  if (/^world-cache\//.test(p)) {
    if (seedOf && /_\d+\.bin$|-\d+_/.test(p)) p = p.replace(new RegExp(`(?<=[-_])${seedOf}(?=[_.])`), '{seed}');
    p = p.replace(/-[0-9a-f]{16}(?=[_.])/, '-*');
    if (/navcore-\*_\d+\.bin$/.test(p)) continue; // (the other worlds' nav cores: the page asks for every one; tiny, its own prefetch)
  }
  if (seen.has(p)) continue; seen.add(p);
  (/^models\/animals\//.test(p) ? late : out).push(p);
}
console.log(`# s17/load (D-580): the files a cold visit fetches before the player can walk, past the scans and the terrain, in the order
# the page first asks for them (measured on the built site: tools/deploy/measure.mjs, then tools/deploy/boot_list.mjs; regenerate
# after big asset changes). build_site.mjs writes the ones that exist to dist/boot-files.json ('*' expanded there, '{seed}' filled
# in by the page); the page prefetches them, two at a time, while the scans and the terrain decode (src/core/prefetch.ts).
# The animals go last: they stream in after walkable.`);
for (const p of [...out, ...late]) console.log(p);
