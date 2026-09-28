// D-336: is Kokoro faster on the T4 through onnxruntime-node's DirectML provider than on the (shared) CPU? A few short renders.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { KokoroRunner } from '../../src/audio/neural/runner';
import { KOKORO_REPO, phonemesFor } from '../../src/audio/neural/kokoro';
import { MODELS } from './voices_measure';
const dev = (process.env.DEV ?? 'dml') as any;
const t0 = performance.now();
const K = await KokoroRunner.load({ root: MODELS, device: dev, dtype: (process.env.DTYPE as any) ?? 'fp32', voiceData: async n => { const b = readFileSync(join(MODELS, KOKORO_REPO, 'resolve/main', `voices/${n}.bin`)); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); } });
console.log(dev, 'load', (performance.now() - t0).toFixed(0));
const v = { key: 'x', sex: 'm' as const, age: 30, mix: [['am_adam', 1]] as [string, number][], speed: 1, tract: 1, level: 0.08 };
for (let i = 0; i < 6; i++) { const t = performance.now(); const x = await K.speak(phonemesFor('baɡa wazr̩ka auramazdaː haʃijam'), v); console.log(i, (x.length / 24000).toFixed(2), 's audio', (performance.now() - t).toFixed(0), 'ms'); }
