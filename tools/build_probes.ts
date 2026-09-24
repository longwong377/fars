// Bake the light probes of the roofed buildings (D-110, D-111): ray casting against the architecture's parts, three passes
// (sky seen directly + validity; first bounce of sun and sky; second bounce), each farmed out to worker processes.
// Output: public/generated/probes.f16 (half floats, PROBE_STRIDE per probe) + probes.json (volumes, options, parts hash).
// Rerun after any architecture change: `npx tsx tools/build_probes.ts` (tests/probes.test.ts checks the parts hash).
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir, cpus } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildTerrace } from '../src/arch/terrace';
import { memberMaterials } from '../src/arch/sculpt';
import { SPEC } from '../src/arch/spec';
import { SURFACES } from '../src/render/materials';
import { BAKE, BakeContext, probeVolumes, probePositions, probeSky, probeBounce, probeReach, probeReachY, smoothBounce, BOUNCE_W, traceScene, surfaceTable, sunSet, yearSunSamples, sphereDirs, fieldOf, SKY_SLOTS, bounceSlots, assemble, albedoFn, dilate, DILATED } from '../src/render/probes/bake';
import { encodeField, PROBE_STRIDE, ProbeVolume, fieldVisibility, ProbeField } from '../src/render/probes/field';

const T0 = Date.now();
const { parts, manifest } = buildTerrace();
const vols = probeVolumes(parts, manifest, BAKE);
const pos = probePositions(vols);
const self = fileURLToPath(import.meta.url);

function context(): BakeContext {
  const scene = traceScene(parts, surfaceTable(SURFACES as any), (SPEC as any).global.r_column_proportions.v.capital_boxes, p => memberMaterials(p.order));
  return { scene, dirs: sphereDirs(BAKE.rays), skyDirs: sphereDirs(BAKE.skyDirs), sun: sunSet(yearSunSamples()), o: BAKE, plain: albedoFn(surfaceTable(SURFACES as any))('earth', true) };
}
const readF32 = (f: string) => { const b = readFileSync(f); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
const fieldFrom = (f: string, vs: ProbeVolume[]): ProbeField => ({ volumes: vs, data: readF32(f), count: pos.length, normalBias: BAKE.normalBias, tier: 'C', note: '' });

if (process.argv[2] === 'child') {
  // child: pass, [start, end), tmp dir → <tmp>/pass<k>_<start>.f32 (per probe: 5 values for pass 0, BOUNCE_W for passes 1–2)
  const [pass, start, end] = process.argv.slice(3, 6).map(Number), dir = process.argv[6];
  const ctx = context();
  if (pass >= 1) ctx.sky = fieldFrom(join(dir, 'sky.f32'), vols);
  if (pass >= 2) ctx.bounce1 = fieldFrom(join(dir, 'b1.f32'), vols);
  const W = pass === 0 ? 5 : BOUNCE_W, out = new Float32Array((end - start) * W);
  for (let i = start; i < end; i++) {
    const p = pos[i];
    const r = pass === 0 ? probeSky(ctx, p[0], p[1], p[2]) : probeBounce(ctx, p[0], p[1], p[2], pass as 1 | 2, i);
    out.set(r, (i - start) * W);
  }
  writeFileSync(join(dir, `pass${pass}_${start}.f32`), Buffer.from(out.buffer));
  process.exit(0);
}

async function runPass(pass: number, dir: string, workers: number): Promise<number[][]> {
  const W = pass === 0 ? 5 : BOUNCE_W, n = pos.length, chunk = Math.ceil(n / workers), jobs: Promise<void>[] = [], starts: number[] = [];
  for (let s = 0; s < n; s += chunk) {
    const e = Math.min(n, s + chunk); starts.push(s);
    jobs.push(new Promise((res, rej) => {
      const c = spawn(process.execPath, [...process.execArgv, self, 'child', String(pass), String(s), String(e), dir], { stdio: ['ignore', 'inherit', 'inherit'] });
      c.on('exit', code => (code === 0 ? res() : rej(new Error(`pass ${pass} worker ${s} exited ${code}`))));
    }));
  }
  await Promise.all(jobs);
  const out: number[][] = [];
  for (const s of starts) { const a = readF32(join(dir, `pass${pass}_${s}.f32`)); for (let k = 0; k < a.length / W; k++) out.push(Array.from(a.subarray(k * W, k * W + W))); }
  return out;
}
const toF32 = (f: ProbeField) => Buffer.from(f.data.buffer, f.data.byteOffset, f.data.byteLength);

const workers = Math.max(1, Math.min(+(process.env.WORKERS ?? cpus().length), 8));
const dir = mkdtempSync(join(tmpdir(), 'probes-'));
console.log(`probe volumes: ${vols.map(v => `${v.building} ${v.dims.join('×')}`).join(', ')} = ${pos.length} probes, ${BAKE.skyDirs} sky + ${BAKE.rays} bounce rays each, ${workers} workers`);
// reach along the grid axes (D-152) and between layers: which neighbours each probe sees (4 + 2 rays a probe: in-process)
const reachCtx = context(), reach = pos.map(p => probeReach(reachCtx, p[0], p[1], p[2]));
const reachY = vols.flatMap(v => pos.slice(v.offset, v.offset + v.dims[0] * v.dims[1] * v.dims[2]).map(p => probeReachY(reachCtx, p[0], p[1], p[2], v.spacing[1])));
console.log(`reach (D-152): ${reach.filter(r => r.some(v => v < 1)).length} probes with a solid within one spacing`);
let t = Date.now();
const sky = await runPass(0, dir, workers);
{ const f = fieldOf(vols, sky, SKY_SLOTS, BAKE, reach); dilate(vols, f.data); writeFileSync(join(dir, 'sky.f32'), toF32(f)); }
console.log(`pass 0 (sky, validity): ${((Date.now() - t) / 1000).toFixed(1)} s, ${sky.filter(r => !r[4]).length} probes inside solids`); t = Date.now();
const valid = (i: number) => !!sky[i][4];
const b1 = smoothBounce(vols, await runPass(1, dir, workers), valid, reach, reachY); // bounce noise (D-180)
{ const f = fieldOf(vols, b1, bounceSlots(i => sky[i][4]), BAKE, reach); dilate(vols, f.data); writeFileSync(join(dir, 'b1.f32'), toF32(f)); }
console.log(`pass 1 (first bounce): ${((Date.now() - t) / 1000).toFixed(1)} s`); t = Date.now();
const b2 = smoothBounce(vols, await runPass(2, dir, workers), valid, reach, reachY);
console.log(`pass 2 (second bounce): ${((Date.now() - t) / 1000).toFixed(1)} s`);
rmSync(dir, { recursive: true, force: true });

const data = assemble(sky, b1, b2, reach), filled = dilate(vols, data);
console.log(`dilated into ${filled} probes inside solids (weight ${DILATED})`);
const hash = createHash('sha1').update(JSON.stringify(parts)).digest('hex').slice(0, 16);
const field: ProbeField = { volumes: vols, data, count: pos.length, normalBias: BAKE.normalBias, tier: 'C', note: '' };
// summary: the ambient at each hall's centre relative to open ground (sky 0.8, sun 2.1 in renderer units: a clear midday)
const stats: Record<string, number> = {};
for (const v of vols) { const r = (manifest[v.building] as any)?.room as number[] | undefined; if (!r) continue; const q = fieldVisibility(field, r[0], r[4] + 1.6, -r[1], 0.8, 2.1, 0.2); stats[v.building] = +q.vis.toFixed(4); }
writeFileSync('public/generated/probes.f16', Buffer.from(encodeField(data).buffer));
writeFileSync('public/generated/probes.json', JSON.stringify({
  tier: 'C', stride: PROBE_STRIDE, count: pos.length, normalBias: BAKE.normalBias, options: BAKE, partsHash: hash, built: new Date().toISOString().slice(0, 10),
  note: 'baked light probes of the roofed buildings: sky through the openings, one and two bounces of sun and sky, year-averaged sun (D-110, D-111; model C)',
  hallCentreVisibility: stats, volumes: vols,
}, null, 1));
console.log(`hall-centre ambient / open field (eye height): ${JSON.stringify(stats)}`);
console.log(`wrote public/generated/probes.f16 (${(data.length * 2 / 1024).toFixed(0)} KiB) + probes.json, parts ${hash}, ${((Date.now() - T0) / 1000).toFixed(1)} s`);
