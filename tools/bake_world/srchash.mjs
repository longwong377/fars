// s14/load (D-354): the source hash of each baked-world unit: the unit's entry modules and every module they import under
// src/ (a static walk of relative imports), plus its data inputs (files or directories under public/), hashed by content.
// A cache entry is used only when its recorded hash equals the hash of the tree being served (vite plugin) or tested
// (node); anything else falls back to the live build. Shared by the vite plugin, the bake script and the tests.
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname, relative, join } from 'node:path';

export const UNITS_FILE = 'src/world/cache/units.json';
const IMPORT_RE = /(?:import|export)\s[^'"`;]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)|new URL\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*,\s*import\.meta\.url/g;
const EXT = ['', '.ts', '.js', '.mjs', '.json', '/index.ts'];
function resolveImport(from, spec) {
  const base = resolve(dirname(from), spec.replace(/\?.*$/, ''));
  for (const e of EXT) { const p = base + e; if (existsSync(p) && statSync(p).isFile()) return p; }
  return null;
}
/** every module reachable from the entries by relative imports (absolute paths, sorted) */
export function closure(root, entries) {
  const seen = new Set(), stack = entries.map(e => resolve(root, e));
  while (stack.length) { const f = stack.pop(); if (seen.has(f) || !existsSync(f)) continue; seen.add(f);
    if (!/\.(ts|js|mjs)$/.test(f)) continue;
    const src = readFileSync(f, 'utf8'); for (const m of src.matchAll(IMPORT_RE)) { const r = resolveImport(f, m[1] ?? m[2] ?? m[3]); if (r) stack.push(r); } }
  return [...seen].sort();
}
function filesUnder(p) {
  if (!existsSync(p)) return [];
  if (statSync(p).isFile()) return [p];
  return readdirSync(p, { withFileTypes: true }).flatMap(d => filesUnder(join(p, d.name))).sort();
}
/** { unit: hash } for the tree at root; with detail, the file lists too */
export function sourceHashes(root, detail = false) {
  const units = JSON.parse(readFileSync(resolve(root, UNITS_FILE), 'utf8')).units, out = {}, files = {};
  for (const [name, u] of Object.entries(units)) {
    const list = [...closure(root, u.entries), ...(u.inputs ?? []).flatMap(i => filesUnder(resolve(root, i)))];
    const h = createHash('sha1'); h.update(name + '|' + (u.version ?? 0));
    for (const f of list) { h.update(relative(root, f).replace(/\\/g, '/')); h.update('\0'); h.update(readFileSync(f)); h.update('\0'); }
    out[name] = h.digest('hex').slice(0, 16); if (detail) files[name] = list.map(f => relative(root, f).replace(/\\/g, '/'));
  }
  return detail ? { hashes: out, files } : out;
}
