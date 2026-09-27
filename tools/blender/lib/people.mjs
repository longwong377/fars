// The people's assets in the Blender pipeline (D-307): registry tools/blender/people.json, outputs in public/models/people/,
// manifest public/models/people/manifest.json. Unlike the GLB assets (bake.py), each is several files the game reads directly
// (src/people/peopleModels.ts): a node source writes what the project's own code knows (the bodies, the fitted pieces) and
// the Blender job, Blender does its part (the strand atlas render, the cloth simulation), an optional node post-step reads
// Blender's results back, and PNG maps become KTX2 (UASTC + zstd, mipmaps; the KTX-Software CLI). Everything is hashed:
// inputs (entry, scripts, data) -> manifest.inHash; each output file -> its sha256; --verify rebuilds and compares.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

export const PEOPLE_REGISTRY = 'tools/blender/people.json';
export const PEOPLE_DIR = 'public/models/people';
export const PEOPLE_MANIFEST = `${PEOPLE_DIR}/manifest.json`;
export const readPeopleRegistry = (root = '.') => existsSync(`${root}/${PEOPLE_REGISTRY}`) ? JSON.parse(readFileSync(`${root}/${PEOPLE_REGISTRY}`, 'utf8')) : { assets: {} };
const sha = b => createHash('sha256').update(b).digest('hex');

/** the files whose content decides whether a people asset is stale */
export function peopleInputs(id, E, root = '.') {
  const files = [E.source.script, ...(E.source.inputs ?? []), E.blender?.script, E.post?.script, 'tools/blender/lib/people.mjs'].filter(Boolean);
  const out = [['entry', Buffer.from(JSON.stringify({ id, source: E.source, blender: E.blender ?? null, post: E.post ?? null, ktx: E.ktx ?? [], outputs: E.outputs }))]];
  for (const p of files) out.push([p, readFileSync(`${root}/${p}`)]);
  return out;
}
export function peopleInputHash(id, E, root = '.') {
  const h = createHash('sha256');
  for (const [label, buf] of peopleInputs(id, E, root)) { h.update(label); h.update('\0'); h.update(String(buf.length)); h.update('\0'); h.update(buf); }
  return h.digest('hex');
}
export const readPeopleManifest = (root = '.') => existsSync(`${root}/${PEOPLE_MANIFEST}`) ? JSON.parse(readFileSync(`${root}/${PEOPLE_MANIFEST}`, 'utf8')) : { about: '', assets: {} };

/** build (or --verify) one people asset. `run(cmd, argv, opts)` spawns and throws on failure. Returns a report. */
export function buildPeopleAsset(id, E, o) {
  const { work, blender, ktx, run, verify, device, slot, noslot, blenderVersion } = o;
  const src = `${work}/${id}/src`, out = `${work}/${id}/out`; mkdirSync(src, { recursive: true }); mkdirSync(out, { recursive: true });
  const t0 = Date.now(), inHash = peopleInputHash(id, E);
  writeFileSync(`${src}/args.json`, JSON.stringify(E.source.args ?? {}));
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx', shell = process.platform === 'win32';
  run(npx, ['tsx', E.source.script, src, out, `${src}/args.json`], { shell });
  if (E.blender) {
    const bargs = ['-b', '--factory-startup', '--python', E.blender.script, '--', `${src}/job.json`];
    if (E.blender.gpu && device === 'GPU' && !noslot) run('node', [slot, 'blender', '--', `"${blender}"`, ...bargs]);
    else run(blender, bargs);
  }
  if (E.post) run(npx, ['tsx', E.post.script, src, out, `${src}/args.json`], { shell });
  for (const png of E.ktx ?? []) {
    if (!ktx) throw new Error(`${id}: ${png} needs the KTX-Software CLI (ktx) and none was found`);
    run(ktx, ['create', '--format', 'R8G8B8A8_UNORM', '--assign-tf', 'linear', '--encode', 'uastc', '--uastc-quality', '2', '--zstd', '18', '--generate-mipmap', `${out}/${png}`, `${out}/${png.replace(/\.png$/, '.ktx2')}`]);
  }
  const files = {}; let bytes = 0;
  for (const f of E.outputs) { const b = readFileSync(`${out}/${f}`); files[f] = { sha256: sha(b), bytes: b.length }; bytes += b.length; }
  const stats = existsSync(`${src}/source_stats.json`) ? JSON.parse(readFileSync(`${src}/source_stats.json`, 'utf8')) : {};
  const post = existsSync(`${out}/post_stats.json`) ? JSON.parse(readFileSync(`${out}/post_stats.json`, 'utf8')) : null;
  // budgets: download, GPU (the KTX2 maps' decoded size: UASTC 1 byte a texel, x 4/3 with mips), triangles per set
  const over = []; let gpu = 0;
  for (const f of E.outputs) if (f.endsWith('.ktx2')) { const b = readFileSync(`${out}/${f}`); const w = b.readUInt32LE(20), h = b.readUInt32LE(24); gpu += Math.round(w * h * 4 / 3); }
  if (E.budget?.bytes && bytes > E.budget.bytes) over.push(`download ${bytes} B > ${E.budget.bytes}`);
  if (E.budget?.gpu_bytes && gpu > E.budget.gpu_bytes) over.push(`GPU ${gpu} B > ${E.budget.gpu_bytes}`);
  for (const [k, lim] of Object.entries(E.budget?.tris ?? {})) { const t = stats[k]?.tris; if (t == null) over.push(`${k}: no triangle count`); else if (t > lim) over.push(`${k} ${t} tris > ${lim}`); }
  const report = { id, inHash, files, bytes, gpuBytes: gpu, stats, post, over, seconds: Math.round((Date.now() - t0) / 1000) };
  if (over.length || verify) return report;
  mkdirSync(PEOPLE_DIR, { recursive: true });
  for (const f of E.outputs) copyFileSync(`${out}/${f}`, `${PEOPLE_DIR}/${f}`);
  return report;
}

/** record a build (or a verification) in the people manifest */
export function recordPeople(manifest, rep, E, meta) {
  const prev = manifest.assets[rep.id];
  if (meta.verify) {
    const same = prev && Object.keys(rep.files).every(f => prev.files?.[f]?.sha256 === rep.files[f].sha256) && Object.keys(prev.files ?? {}).length === Object.keys(rep.files).length;
    if (same) prev.reproduced = { files: Object.fromEntries(Object.entries(rep.files).map(([f, v]) => [f, v.sha256])), blender: meta.blenderVersion };
    return !!same;
  }
  manifest.assets[rep.id] = { files: rep.files, inHash: rep.inHash, bytes: rep.bytes, gpuBytes: rep.gpuBytes, stats: rep.stats, post: rep.post, tier: E.tier, src: E.src,
    blender: meta.blenderVersion, ktx: meta.ktxVersion, build_s: rep.seconds };
  return true;
}
export function writePeopleManifest(manifest) {
  mkdirSync(PEOPLE_DIR, { recursive: true });
  const sorted = Object.fromEntries(Object.keys(manifest.assets).sort().map(k => [k, manifest.assets[k]]));
  writeFileSync(PEOPLE_MANIFEST, JSON.stringify({ about: 'Generated by tools/blender/build.mjs from tools/blender/people.json (D-307); do not edit. Per asset: the input hash (tools/blender/lib/people.mjs), each output file and its sha256, measured stats (cards, triangles, drape), the build, and `reproduced` once --verify rebuilt the same bytes.', assets: sorted }, null, 1) + '\n');
}
export { statSync };
