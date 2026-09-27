// The inputs of a generated asset and their hash (D-305): the build writes it into public/models/manifest.json and
// tests/blender_assets.test.ts recomputes it, so an asset whose data, model code or bake settings changed after its build
// fails the test until `node tools/blender/build.mjs <id>` is run again. Plain node: the build and the tests share it.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const PIPELINE_FILES = ['tools/blender/bake.py']; // the Blender stage: every asset depends on it
export const readRegistry = (root = '.') => JSON.parse(readFileSync(`${root}/tools/blender/assets.json`, 'utf8'));

/** the list of (label, content) the hash is taken over, in a fixed order */
export function assetInputs(id, entry, root = '.') {
  const read = p => readFileSync(`${root}/${p}`);
  const out = [['entry', Buffer.from(JSON.stringify({ id, source: entry.source, lods: entry.lods, bake: entry.bake }))]];
  for (const p of [...PIPELINE_FILES, entry.source.script, ...entry.source.inputs]) out.push([p, read(p)]);
  if (entry.source.spec_values?.length) {
    const spec = JSON.parse(readFileSync(`${root}/src/data/site_spec.json`, 'utf8'));
    for (const [b, k] of entry.source.spec_values) out.push([`site_spec:${b}.${k}`, Buffer.from(JSON.stringify(spec[b]?.[k]?.v ?? null))]);
  }
  return out;
}
export function inputHash(id, entry, root = '.') {
  const h = createHash('sha256');
  for (const [label, buf] of assetInputs(id, entry, root)) { h.update(label); h.update('\0'); h.update(String(buf.length)); h.update('\0'); h.update(buf); }
  return h.digest('hex');
}
