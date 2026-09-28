// D-336: UTMOS of the clips a GPU probe rendered (tools/dev/voices_probe.ts run.clips), per dtype: does fp16 on WebGPU
// sound as good as fp32?   npx tsx tools/dev/voices_probe_mos.ts T:/fars-assets-s12/voices/probe2.json
import { readFileSync } from 'node:fs';
import { Instruments, to16k } from './voices_measure';
const R = JSON.parse(readFileSync(process.argv[2], 'utf8')); const I = await Instruments.load({ ecapa: false });
for (const run of R.runs) { const m: number[] = [], e: number[] = [];
  for (const c of run.clips ?? []) { const b = Buffer.from(c.b64, 'base64'), i16 = new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2), x = Float32Array.from(i16, v => v / 32768);
    const s = (await I.mos(to16k(x, c.rate)))!; (c.en ? e : m).push(s); }
  const avg = (a: number[]) => a.length ? +(a.reduce((p, q) => p + q, 0) / a.length).toFixed(3) : null;
  console.log(run.dtype, run.device, 'MOS period', avg(m), JSON.stringify(m.map(v => +v.toFixed(2))), 'English', avg(e), JSON.stringify(e.map(v => +v.toFixed(2)))); }
