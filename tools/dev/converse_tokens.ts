// D-296: the prompt length of the T-E9 set in tokens (the Qwen2.5 and Gemma-2 tokenizers from the local models): the runtime
// prompt must stay under ~450 tokens (the GPU watchdog, life.ts lifeBriefShort). D-315: also with the memory of the stranger
// (two rows of ~60 tokens) and the tag line, and the estimate prompt.ts uses without a tokenizer (approxTokens) against
// the true counts. Usage: npx tsx tools/dev/converse_tokens.ts [1: print the longest]
import { readFileSync, existsSync } from 'node:fs';
import { PreTrainedTokenizer } from '@huggingface/transformers';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { lifeRecord } from '../../src/people/converse/life';
import { systemPrompt } from '../../src/people/converse/prompt';
import { approxTokens } from '../../src/people/converse/tokens';
import { buildTestSet } from '../../src/people/converse/testset';
const M = 'C:/Users/Administrator/fars-assets/models/mlc-ai/';
const toks = ['Qwen2.5-1.5B-Instruct-q4f16_1-MLC', 'gemma-2-2b-it-q4f16_1-MLC'].map(m => M + m + '/resolve/main/').filter(d => existsSync(d + 'tokenizer.json'))
  .map(d => new PreTrainedTokenizer(JSON.parse(readFileSync(d + 'tokenizer.json', 'utf8')), JSON.parse(readFileSync(d + 'tokenizer_config.json', 'utf8'))));
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(1), env2 = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const S = new PeopleSim(1, nav, env2);
const MEM = ['Yesterday at midday the stranger spoke with you. He said: “Can you show me the way to the well?”. You showed him the way to the well. You told him: “Come, it is by the lane.”',
  '2 days ago your wife Dātabāmā told you: a foreign stranger talked with her; she gave him water.'];
for (const [label, mem, intents] of [['T-E9 prompt (no memory, no tags)', null, false], ['with the tag line', null, true], ['with two memory rows and the tag line', MEM, true]] as const) {
  const n: number[][] = toks.map(() => []), est: number[] = [], ratio: number[] = []; let worst = '', wmax = 0;
  for (const c of buildTestSet(S.pop, 1, 72)) { const s = systemPrompt(lifeRecord(S.pop, S.cal, c.pid, c.day, c.hour), 'none', null, mem ? [...mem] : null, intents);
    const k = toks.map(t => t.encode(s).length); k.forEach((x, i) => n[i].push(x)); const e = approxTokens(s); est.push(e); ratio.push(e / Math.max(...k)); if (Math.max(...k) > wmax) { wmax = Math.max(...k); worst = s; } }
  const q = (a: number[], p: number) => [...a].sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor(p * a.length))];
  console.log(label, toks.map((_, i) => `tok${i} median ${q(n[i], 0.5)} max ${q(n[i], 1)}`).join('; '), `| estimate median ${q(est, 0.5)} max ${q(est, 1)} | est/true min ${q(ratio, 0).toFixed(3)} p05 ${q(ratio, 0.05).toFixed(3)} median ${q(ratio, 0.5).toFixed(3)}`);
  if (process.argv[2]) console.log(worst);
}
