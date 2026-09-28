// D-336 probe: the Farsi of the opt-in layer by the llm route (the conversation model asked for the Persian of its own
// in-character reply). ?model=gemma-2-2b-it-q4f16_1-MLC&n=24 ; results on window.__probe
import { Mind } from '../../src/people/converse/mind';
import { llmFarsi, fenceFa } from '../../src/people/converse/farsi';
import replies from '../../REVIEWS/evidence/s12-voices/replies.json';

const P = new URLSearchParams(location.search); const model = P.get('model') ?? 'gemma-2-2b-it-q4f16_1-MLC', n = +(P.get('n') ?? 24);
const out: any = { model, rows: [] }; (window as any).__probe = out;
const mind = new Mind(); const t0 = performance.now();
try {
  const L = await mind.load(model); out.loadMs = L.ms;
  for (const en of (replies as any).replies.slice(0, n)) { const r = await llmFarsi(mind, en); out.rows.push({ en, fa: r?.fa ?? null, ms: r?.ms ?? -1, hits: r ? fenceFa(r.fa) : ['none'] }); }
} catch (e) { out.error = String(e); }
out.wallMs = performance.now() - t0; out.done = true;
