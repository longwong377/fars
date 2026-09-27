// Coverage evidence dependencies (D-235, MASTER_PLAN §5): a hash of the source files a rendered view depends on (the page's
// code, its generated data and the measuring spec). A board cell whose evidence carries another hash than the tree's reads
// STALE. Deliberately broad: any change to the renderer, the world or its data stales every render cell until re-rendered or
// carried by canaries (MASTER_PLAN §4.2).
// D-277: the same for every tool that writes evidence (depHashFor): the tool's own file and what it reads. Tools whose
// dependencies are not listed in TOOL_DEPS get the broad default (the tool, src, the generated data, the data files and the
// lock file): broad on purpose, so a cell goes STALE rather than stay falsely fresh.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';

export const DEP_ROOTS = ['src', 'public/generated', 'index.html', 'vite.config.ts', 'package-lock.json', 'tests/e2e/coverage.spec.ts'];
const WORLD = ['src', 'public/generated', 'data', 'package-lock.json'];
/** per tool (the `tool` field of gates/thresholds.json) the files and directories its evidence depends on, besides itself */
export const TOOL_DEPS: Record<string, string[]> = {
  'tools/dev/coverage_report.ts': DEP_ROOTS, 'tools/dev/coverage_points.ts': [...DEP_ROOTS, 'tools/dev/coverage_time.ts'], 'tests/e2e/coverage.spec.ts': DEP_ROOTS,
  'tools/dev/areas.ts': [...WORLD.filter(r => r !== 'data'), 'tools/dev/lib', 'tests/plainLib.ts'],
  'tools/dev/tier0.ts': [...WORLD.filter(r => r !== 'data'), 'data/areas.json', 'tools/dev/lib', 'tests/plainLib.ts'],
};
function files(root: string, rel: string, out: string[]) {
  const p = join(root, rel); if (!existsSync(p)) return; const st = statSync(p);
  if (st.isDirectory()) { for (const f of readdirSync(p).sort()) files(root, join(rel, f), out); } else out.push(rel);
}
const cache = new Map<string, string>();
/** sha1 (hex) over one file or directory's paths and contents */
function rootHash(root: string, r: string) {
  const key = `${root}\0${r}`, hit = cache.get(key); if (hit) return hit;
  const list: string[] = []; files(root, r, list); const h = createHash('sha1');
  for (const f of list.sort()) { h.update(f); h.update('\0'); h.update(readFileSync(join(root, f))); h.update('\0'); }
  const d = h.digest('hex'); cache.set(key, d); return d;
}
/** sha1 (12 hex) over the dependency files' paths and contents under `root` */
export function depHash(root = '.'): string {
  const list: string[] = []; for (const r of DEP_ROOTS) files(root, r, list);
  const h = createHash('sha1'); for (const f of list.sort()) { h.update(f); h.update('\0'); h.update(readFileSync(join(root, f))); h.update('\0'); }
  return h.digest('hex').slice(0, 12);
}
/** the roots a tool's evidence depends on (its own file first) */
export const depRootsFor = (tool: string) => [tool, ...(TOOL_DEPS[tool] ?? [...WORLD, 'tests/plainLib.ts'])].filter((r, i, a) => a.indexOf(r) === i);
/** sha1 (12 hex) of a tool's dependency roots (depRootsFor), each root hashed once per process */
export function depHashFor(tool: string, root = '.'): string {
  if (tool === 'tools/dev/coverage_report.ts' || tool === 'tests/e2e/coverage.spec.ts') return depHash(root); // the render cells keep D-235's hash
  const h = createHash('sha1'); for (const r of depRootsFor(tool).sort()) { h.update(r); h.update('\0'); h.update(rootHash(root, r)); h.update('\0'); }
  return h.digest('hex').slice(0, 12);
}
