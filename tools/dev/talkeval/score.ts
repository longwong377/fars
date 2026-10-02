// D-456: the score of a talk-eval run (run.ts JSONL): every turn checked against its own brief, failures by class with
// examples, latencies. Writes a JSON summary and prints a markdown table; with a second run, the before/after table.
//   npx tsx tools/dev/talkeval/score.ts <run.jsonl> [after.jsonl] [--md out.md]
import { readFileSync, writeFileSync } from 'node:fs';
import { fenceHits } from '../../../src/people/converse/fence';

type Row = any;
const STOP = new Set('about after with from that this they them their there have been will what when where which your yours into over under some just only also more most other than then such very much many each every of the and for are was were not but you his her its our out off own same well near little short walk house houses home town plain work worker workers a an in on at to by as is be or it who whom'.split(' '));
const content = (s: string) => (s.toLowerCase().match(/\p{L}{4,}/gu) ?? []).filter(w => !STOP.has(w));
const stem = (w: string) => w.slice(0, 5);
const NUMW: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const REL: [RegExp, (rels: string[], f: any) => boolean][] = [
  [/\bmy (?:wife)\b/i, r => r.includes('wife')], [/\bmy (?:husband)\b/i, r => r.includes('husband')],
  [/\bmy sons?\b/i, r => r.includes('son')], [/\bmy daughters?\b/i, r => r.includes('daughter')], [/\bmy (?:children|child|little ones)\b/i, r => r.includes('son') || r.includes('daughter')],
  [/\bmy mother\b/i, r => r.includes('mother')], [/\bmy father\b/i, (r, f) => r.includes('father') || !!f.byname],
  [/\bmy brothers?\b/i, (r, f) => r.includes('brother') || f.kinHouses.some((k: string) => /brother/.test(k))], [/\bmy sisters?\b/i, (r, f) => r.includes('sister') || f.kinHouses.some((k: string) => /sister/.test(k))],
  [/\bmy (?:grandson|granddaughter|grandchild(?:ren)?)\b/i, (r, f) => f.kinHouses.some((k: string) => /grand/.test(k)) || r.some(x => /grand/.test(x))],
];
const DEFLECT = /\b(?:do not know|don['’]t know|cannot say|can['’]t say|could not say|couldn['’]t say|never heard|not heard|have not heard|haven['’]t heard|know nothing|knows? nothing|no one knows|nobody knows|who can (?:say|know)|only the gods|the gods (?:know|alone|will)|gods willing|not for me to|not my place|don['’]t understand|do not understand|did not understand|didn['’]t understand|what is that|strange words?|foreign words?|your words|not know (?:it|that|of|the)|i know only|i only know|i know of no|no idea|not something i know|beyond me|i am only a|i'm only a|i am just a|i'm just a|how would i know|how should i know|what would i know)\b/i;
const NARRATE = /^(?:you see|a (?:stranger|foreigner|man|woman)\b|the (?:stranger|foreigner)\b|he |she |they )|\b(?:the stranger|the foreigner)\s+(?:approaches|says|asks|comes|looks|walks|nods|smiles)\b|\bstranger:|\n\s*(?:stranger|you|me)\s*:/i;

export function checkRow(r: Row) {
  const f = r.facts, t: string = r.text ?? '', raw: string = r.raw ?? '', fails: string[] = [], info: string[] = [];
  if (r.refused) return { fails: ['refused-to-talk'], info };
  if (!r.ok) fails.push(t.length > 1 ? 'fence:' + (r.hits ?? []).map((h: any) => h.kind + '=' + h.term).join(',') : 'empty');
  if (r.tries > 1) info.push('retried');
  if (/\d/.test(t)) fails.push('digits');
  if (/[֐-ࣿऀ-෿぀-ヿ㐀-鿿가-힯]/.test(t)) fails.push('foreign-script');
  const rawHits = fenceHits(raw); if (rawHits.length && r.ok) info.push('fence-caught-first:' + rawHits.map(h => h.term).join(','));
  if (NARRATE.test(raw.trim())) fails.push('narrates');
  if (/[\[\]{}]/.test(t)) fails.push('tag-leak');
  if (t && !/[.!?…"”’]$/.test(t.trim())) fails.push('cut-off');
  // names: every capitalised word not at a sentence start must be in what the person was told (brief, notes, the words)
  const told = [r.system, r.said, ...(r.calls ?? []).map((c: any) => c.last)].join(' ');
  const allow = /^(I|I'm|I've|I'll|I'd|King|Xerxes|Parsa|Terrace|Auramazda|Ahuramazda|Mithra|Anahita|Humban|Marduk|Nabû|Persian|Persians|Elamite|Elamites|Babylon|Babylonian|Egypt|Egyptian|Lydian|Ionian|Mede|Median|Stranger|Friend|Lord|Master|Sir|Great|Hall|Hundred|Columns|Treasury|Gate|Nations|Apadana|Susa|Ecbatana|Sardis|Kur|Pulvar|Gods?)$/;
  const newNames: string[] = [];
  for (const m of t.matchAll(/(^|[.!?:;"“—-]\s*|\s)([\p{Lu}][\p{L}\-’']{2,})/gu)) {
    const w = m[2].replace(/[’'](?:s|t|re|ve|ll|d|m)$/, ''), start = m[1] !== ' ' && m[1] !== '' ? true : m.index === 0;
    if (allow.test(w) || told.includes(w)) continue;
    if (start && /^[A-Za-z’']+$/.test(w)) continue; // a sentence's ordinary first word
    newNames.push(w);
  }
  if (newNames.length) fails.push('invented-name:' + newNames.join(','));
  const rels = f.household.map((h: any) => h.rel.replace(/^the old (man|woman) of the house$/, 'elder'));
  for (const [re, ok] of REL) { const m = re.exec(t); if (m && !ok(rels, f)) fails.push('invented-kin:' + m[0].toLowerCase()); }
  // a kin word next to the wrong name ("my wife X" where X is not the wife)
  for (const m of t.matchAll(/\bmy (wife|husband|son|daughter|mother|father|brother|sister),? (?:named |called )?([\p{Lu}][\p{L}\-’']+)/gu)) {
    const h = f.household.find((x: any) => x.name.startsWith(m[2]) || m[2].startsWith(x.name.split(' ')[0])); if (h && h.rel !== m[1]) fails.push(`wrong-kin:${m[1]}=${m[2]}(${h.rel})`); }
  for (const m of t.matchAll(/\b(one|two|three|four|five|six|seven|eight|nine|ten) (sons|daughters|children)\b/gi)) {
    const n = NUMW[m[1].toLowerCase()], have = f.household.filter((h: any) => m[2] === 'children' ? /^(son|daughter)$/.test(h.rel) : h.rel === m[2].slice(0, -1)).length;
    if (n !== have) fails.push(`wrong-count:${m[0]}(${have})`); }
  // the person's own name in their mouth as someone else ("my son Rasamada")
  const first = f.name.split(/[ ,]/)[0], firstRe = first.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (new RegExp(`\\b(?:my|your) \\w+ ${firstRe}\\b`, 'u').test(t)) fails.push('own-name-as-kin');
  // what the turn asked for
  const has = (words: string[]) => { const ws = new Set(content(t).map(stem)); return words.some(w => ws.has(stem(w))); };
  if (r.kind === 'greet' && !t.includes(first)) fails.push('no-own-name');
  if (r.kind === 'family' && f.household.length && !f.household.some((h: any) => t.includes(h.name.split(' ')[0])) && !/\b(wife|husband|son|daughter|mother|father|brother|sister|children)\b/i.test(t)) fails.push('no-kin');
  if (r.kind === 'work' && !has([...content(f.work), f.job, f.sub ?? 'xxxxx'].filter(Boolean))) fails.push('no-work');
  if (r.kind === 'home') {
    if (!has(content(f.home)) && !/\b(town|village|terrace|garrison|estate|camp|road|plain|stair)\b/i.test(t)) fails.push('no-home');
    if (r.ask) {
      info.push('tag:' + (r.tag?.kind ?? 'none'));
      if (r.decision && !r.decision.ok && !r.saidNo && !r.retold) fails.push('promise-against-sim');
      if (r.decision && !r.decision.ok && r.retold) info.push('retold-refusal');
      if (r.decision && r.decision.ok && r.saidNo) info.push('declined-though-free');
    }
  }
  if (r.kind !== 'home' && r.tag && r.tag.kind !== 'none') info.push('stray-tag:' + r.tag.kind);
  if (r.kind === 'unknowable') {
    if (DEFLECT.test(t)) info.push('deflects');
    else if (/\b(?:thousands?|hundreds?|tens of|myriads?)\b/i.test(t) || newNames.length || /\b(?:will be|shall be|is to be) king\b/i.test(t)) fails.push('answers-the-unknowable');
    else fails.push('ignores-the-question');
  }
  return { fails, info };
}

function summarise(path: string) {
  const rows: Row[] = readFileSync(path, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(r => !r.error);
  const byClass: Record<string, { n: number; ex: Row[] }> = {}, byKind: Record<string, [number, number]> = {}, info: Record<string, number> = {};
  const people = new Set<string>(), badPeople = new Set<string>(); let pass = 0;
  for (const r of rows) {
    const c = checkRow(r), key = `${r.seed}:${r.pid}`; people.add(key); r._c = c;
    byKind[r.kind] ??= [0, 0]; byKind[r.kind][1]++; if (!c.fails.length) { byKind[r.kind][0]++; pass++; } else badPeople.add(key);
    for (const x of c.fails) { const k = x.split(':')[0]; byClass[k] ??= { n: 0, ex: [] }; byClass[k].n++; if (byClass[k].ex.length < 4) byClass[k].ex.push({ who: `${r.facts.name} (${r.facts.age}, ${r.facts.job}, ${r.facts.zone})`, said: r.said, text: r.text, why: x }); }
    for (const x of c.info) { const k = x.split(':').slice(0, x.startsWith('tag:') || x.startsWith('stray-tag:') ? 2 : 1).join(':'); info[k] = (info[k] ?? 0) + 1; }
  }
  const calls = rows.flatMap(r => r.calls ?? []), talk = calls.filter((c: any) => c.kind === 'talk');
  const q = (a: number[], p: number) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
  const reprimes = rows.filter(r => r.kind !== 'greet' && (r.calls ?? []).some((c: any) => /^\(The stranger comes up to you\.\)/.test(c.last))).length;
  const narratedPrime = rows.filter(r => (r.calls ?? []).some((c: any) => /^\(The stranger comes up to you\.\)/.test(c.last) && NARRATE.test(c.text.trim()))).length;
  return { path, turns: rows.length, people: people.size, pass, share: +(100 * pass / rows.length).toFixed(1), peopleClean: people.size - badPeople.size,
    byKind: Object.fromEntries(Object.entries(byKind).map(([k, [p, n]]) => [k, `${p}/${n} (${(100 * p / n).toFixed(0)} %)`])),
    classes: Object.fromEntries(Object.entries(byClass).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => [k, { n: v.n, share: +(100 * v.n / rows.length).toFixed(1), ex: v.ex }])), info,
    reprimedMidTalk: reprimes, narratedPrime, sysTokens: { median: q(rows.filter(r => r.kind === 'greet').map(r => r.facts.sysTokens), 0.5), max: Math.max(...rows.map(r => r.facts.sysTokens)) },
    latency: { replyTokensMedian: q(talk.map((c: any) => c.tok), 0.5), replyTokensP90: q(talk.map((c: any) => c.tok), 0.9), hitMax: talk.filter((c: any) => c.tok >= 64).length,
      freshPrefillTps: +(q(talk.filter((c: any) => c.cached < 32).map((c: any) => (c.ptok - c.cached) / c.prefill_s), 0.5)).toFixed(1),
      inBatchDecodeTps: +(q(talk.filter((c: any) => c.tok > 8).map((c: any) => c.tok / Math.max(c.total_s - c.ttft_s, 1e-3)), 0.5)).toFixed(2), batchMedian: q(talk.map((c: any) => c.batch), 0.5) } };
}

const args = process.argv.slice(2), md = args.indexOf('--md'), mdPath = md >= 0 ? args[md + 1] : null, runs = args.filter((a, i) => !a.startsWith('--') && i !== md + 1 || md < 0 && !a.startsWith('--'));
const S = runs.map(summarise);
writeFileSync(runs[0].replace(/\.jsonl$/, '') + '.score.json', JSON.stringify(S, null, 1));
const classes = [...new Set(S.flatMap(s => Object.keys(s.classes)))].sort((a, b) => (S[0].classes[b]?.n ?? 0) - (S[0].classes[a]?.n ?? 0));
const L: string[] = [`| | ${S.map(s => s.path.split('/').pop()).join(' | ')} |`, `|---|${S.map(() => '---').join('|')}|`,
  `| turns clean (no failure) | ${S.map(s => `${s.pass}/${s.turns} (${s.share} %)`).join(' | ')} |`, `| people with every turn clean | ${S.map(s => `${s.peopleClean}/${s.people}`).join(' | ')} |`,
  ...Object.keys(S[0].byKind).map(k => `| ${k} turns clean | ${S.map(s => s.byKind[k] ?? '-').join(' | ')} |`),
  ...classes.map(c => `| ${c} | ${S.map(s => s.classes[c] ? `${s.classes[c].n} (${s.classes[c].share} %)` : '0').join(' | ')} |`),
  `| talk re-primed mid-talk (judge reset) | ${S.map(s => s.reprimedMidTalk).join(' | ')} |`, `| prime reply narrates | ${S.map(s => s.narratedPrime).join(' | ')} |`,
  `| brief tokens median / max | ${S.map(s => `${s.sysTokens.median} / ${s.sysTokens.max}`).join(' | ')} |`];
console.log(L.join('\n')); console.log(JSON.stringify(S.map(s => ({ info: s.info, latency: s.latency })), null, 1));
if (mdPath) writeFileSync(mdPath, L.join('\n') + '\n');
