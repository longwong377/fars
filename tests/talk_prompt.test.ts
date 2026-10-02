// D-395: the prompts as the 1.5 B talk model (D-394) reads them: under the read-in cap (the GPU watchdog), no digits it could
// read aloud, and a fence that refuses no ordinary period answer. With the deterministic stand-in model (tests/talk_standin.ts),
// over the T-E9 set (who, house, work, day, events, place, gods and the adversarial) and the T-E10 asks: every message the
// model would read is checked, and every stand-in reply (made of the person's own facts) must pass the fence.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';
import { Mind } from '../src/people/converse/mind';
import { talkTurn } from '../src/people/converse/turn';
import { buildTestSet } from '../src/people/converse/testset';
import { buildTalkSet } from '../src/people/converse/talkset';
import { approxTokens, PROMPT_TOKENS, TURN_TOKENS, userTurn, systemPrompt } from '../src/people/converse/prompt';
import { lifeRecord } from '../src/people/converse/life';
import { fenceHits } from '../src/people/converse/fence';
import { spoken, numberWords, ordinalWords } from '../src/people/converse/spoken';
import { standInEngine } from './talk_standin';
import { simAt } from './sim_fixture';

describe('numbers as a person says them (spoken.ts)', () => {
  it('words for counts, ordinals, halves and thousands; text without digits unchanged', () => {
    expect(numberWords(0)).toBe('zero'); expect(numberWords(17)).toBe('seventeen'); expect(numberWords(21)).toBe('twenty-one');
    expect(numberWords(340)).toBe('three hundred and forty'); expect(numberWords(2000)).toBe('two thousand'); expect(numberWords(1005)).toBe('one thousand and five');
    expect(ordinalWords(21)).toBe('twenty-first'); expect(ordinalWords(12)).toBe('twelfth'); expect(ordinalWords(30)).toBe('thirtieth');
    expect(spoken('17 years ago, on day 21 of the 3rd month, 1.5 shekels and 2,000 bricks')).toBe('seventeen years ago, on day twenty-one of the third month, one and a half shekels and two thousand bricks');
    expect(spoken('0.5 of a measure')).toBe('a half of a measure');
    const s = 'No digits here, stranger.'; expect(spoken(s)).toBe(s);
  });
});

describe('the fence lets ordinary period answers through (D-395)', () => {
  const good = ['I fish from the muddy bank below the village.', 'My house is on the bank of the Pulvar.', 'We sit on the bank and mend the nets.', 'The river bank is green this month.',
    'I am the potter’s assistant; I knead the clay.', 'The estate keeps two thousand sheep on the hills.', 'There are 400 men of the garrison on the Terrace.', 'After the brief rain the lane was mud.',
    'I do as the foreman’s instructions say: the stones to the hall.', 'It is my job to fetch the water before the sun is high.'];
  const bad = ['Keep your silver in the bank, stranger.', 'Is there a bank in this town?', 'It was in 480 BC.', 'In 2024 the town was full of tourists.', 'Meet me at 10:30.', 'As an AI assistant I cannot say.', 'In two thousand years this will be ruins.'];
  it('passes the good and still refuses the bad', () => {
    for (const g of good) expect(fenceHits(g), g).toEqual([]);
    for (const b of bad) expect(fenceHits(b).length, b).toBeGreaterThan(0);
  });
});

let nav: NavGrid;
const W = new WeatherSystem(1), env = (t: number): Env => { const dd = Math.floor(t / 24), c = W.conditions(dd, t - dd * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
beforeAll(() => { nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8'))); }, 120_000);

// the whole sweep walks the world through the year (~25 min of CPU: the economy day by day); by default the cases of the
// first FIRST_DAYS days, TALK_FULL=1 for all (run for D-395: 281 calls, system max 450, turn max 217, none refused)
const FULL = !!process.env.TALK_FULL, FIRST_DAYS = 40;
describe('the prompts the model reads (stand-in model, T-E9 and T-E10 sets)', () => {
  it('every person of both sets: the system prompt, with memory lines in digits, within PROMPT_TOKENS and without a digit', () => {
    const sim = simAt(1, 355, 10); let max = 0; // (the cached world at the year's end: every day's plans and dealings are there)
    const mem = ['17 days ago in the morning the foreign stranger spoke with you. He said: “Show me the well.” You showed him the way.', '2 days ago your wife told you: a foreign stranger asked for water on day 21; she gave him 1.5 measures of barley.'];
    const people = [...buildTestSet(sim.pop, 1, 72), ...buildTalkSet(sim.pop, sim.cal, 1, 64)];
    for (const c of people) { const p = systemPrompt(lifeRecord(sim.pop, sim.cal, c.pid, c.day, c.hour), 'recognise', null, mem); max = Math.max(max, approxTokens(p)); expect(p, `pid ${c.pid}`).not.toMatch(/\d/); }
    expect(max).toBeLessThanOrEqual(PROMPT_TOKENS);
  }, FULL ? 3_600_000 : 600_000);
  it('through the talk (stand-in): every system prompt within PROMPT_TOKENS, every turn within TURN_TOKENS, no digits read or said; no stand-in reply refused', async () => {
    const eng = standInEngine(); const m = new Mind(); (m as any).engine = eng; m.model = 'stand-in';
    const sim = new PeopleSim(1, nav, env); const refused: string[] = [];
    const cases = [...buildTestSet(sim.pop, 1, 72).map(c => ({ pid: c.pid, day: c.day, hour: c.hour, say: c.prompt, adv: ['future', 'fate', 'modern', 'meta', 'break'].includes(c.kind) })),
      ...buildTalkSet(sim.pop, sim.cal, 1, 64).filter(c => c.kind !== 'recall' && c.kind !== 'heard').map(c => ({ pid: c.pid, day: c.day, hour: c.hour, say: c.say, adv: false }))].filter(c => FULL || c.day < FIRST_DAYS).sort((a, b) => a.day * 24 + a.hour - (b.day * 24 + b.hour));
    expect(cases.length).toBeGreaterThan(FULL ? 120 : 8);
    for (const c of cases) { sim.jumpTo(c.day * 24 + c.hour); const o = await talkTurn(m, sim, c.pid, c.say, { conv: sim.t }); m.forget();
      if (!o.answer.ok && o.answer.tries) refused.push(`${c.say} -> ${o.answer.raw} ${JSON.stringify(o.answer.hits)}`);
      expect(o.answer.text, 'said in words').not.toMatch(/\d/); }
    let maxSys = 0, maxTurn = 0; const digits: string[] = [];
    for (const msgs of eng.calls) { maxSys = Math.max(maxSys, approxTokens(msgs[0].content));
      const last = msgs[msgs.length - 1]; if (last.role === 'user') maxTurn = Math.max(maxTurn, approxTokens(last.content));
      for (const x of msgs) if (x.role !== 'assistant' && /\d/.test(x.content.replace(/“[^”]*”/g, ''))) digits.push(x.content.match(/.{0,30}\d.{0,30}/)![0]); }
    console.log(`prompts: ${eng.calls.length} calls, system max ${maxSys} tokens (cap ${PROMPT_TOKENS}), turn max ${maxTurn} (cap ${TURN_TOKENS}); refused ${refused.length}`);
    expect(maxSys).toBeLessThanOrEqual(PROMPT_TOKENS); expect(maxTurn).toBeLessThanOrEqual(TURN_TOKENS);
    expect(digits, 'digits in what the model reads').toEqual([]);
    expect(refused, 'stand-in replies of the person’s own facts refused by the fence').toEqual([]);
  }, FULL ? 3_600_000 : 600_000);
  it('a long turn is cut to the cap, keeping the stranger’s words and the closing note', () => {
    const before = Array.from({ length: 12 }, (_, i) => `(Line ${i + 1}: the house sold the stranger barley ${i + 2} days ago for a shekel of silver.)`).join('\n');
    const s = userTurn('Mikrašba', { text: 'Do you remember me?' }, { before, ground: 'your wife Dātabāmā grinds barley at home' });
    expect(approxTokens(s)).toBeLessThanOrEqual(TURN_TOKENS); expect(s).toContain('Do you remember me?'); expect(s).toContain('Answer as Mikrašba'); expect(s).not.toMatch(/\d/);
  });
});
