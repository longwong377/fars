// D-296: the prompt length of the T-E9 set in tokens (the Qwen2.5 tokenizer from the local models): the runtime prompt must stay
// under ~450 tokens (the GPU watchdog, life.ts lifeBriefShort). Usage: npx tsx tools/dev/converse_tokens.ts [1: print the longest]
import { readFileSync } from 'node:fs';
import { PreTrainedTokenizer } from '@huggingface/transformers';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { lifeRecord } from '../../src/people/converse/life';
import { systemPrompt } from '../../src/people/converse/prompt';
import { buildTestSet } from '../../src/people/converse/testset';
const TD = 'C:/Users/Administrator/fars-assets/models/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC/resolve/main/';
const tok = new PreTrainedTokenizer(JSON.parse(readFileSync(TD + 'tokenizer.json', 'utf8')), JSON.parse(readFileSync(TD + 'tokenizer_config.json', 'utf8')));
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(1), env2 = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const S = new PeopleSim(1, nav, env2);
const n: number[] = []; let worst = ''; for (const c of buildTestSet(S.pop, 1, 72)) { const s = systemPrompt(lifeRecord(S.pop, S.cal, c.pid, c.day, c.hour), 'none'); const k = tok.encode(s).length; n.push(k); if (k >= Math.max(...n)) worst = s; }
n.sort((a, b) => a - b); console.log('tokens median', n[36], 'max', n[71]); if (process.argv[2]) console.log(worst);
