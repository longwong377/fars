// Coverage evidence dependencies (D-235, MASTER_PLAN §5): a hash of the source files a rendered view depends on (the page's
// code, its generated data and the measuring spec). A board cell whose evidence carries another hash than the tree's reads
// STALE. Deliberately broad: any change to the renderer, the world or its data stales every render cell until re-rendered or
// carried by canaries (MASTER_PLAN §4.2).
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const DEP_ROOTS = ['src', 'public/generated', 'index.html', 'vite.config.ts', 'package-lock.json', 'tests/e2e/coverage.spec.ts'];
function files(root: string, rel: string, out: string[]) {
  const p = join(root, rel); if (!existsSync(p)) return; const st = statSync(p);
  if (st.isDirectory()) { for (const f of readdirSync(p).sort()) files(root, join(rel, f), out); } else out.push(rel);
}
/** sha1 (12 hex) over the dependency files' paths and contents under `root` */
export function depHash(root = '.'): string {
  const list: string[] = []; for (const r of DEP_ROOTS) files(root, r, list);
  const h = createHash('sha1'); for (const f of list.sort()) { h.update(f); h.update('\0'); h.update(readFileSync(join(root, f))); h.update('\0'); }
  return h.digest('hex').slice(0, 12);
}
