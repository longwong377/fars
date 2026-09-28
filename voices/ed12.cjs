const fs=require('fs');
let p='T:/fars-wt/voices/src/people/converse/voice.ts'; let s=fs.readFileSync(p,'utf8');
const rep=(a,b)=>{ if(!s.includes(a)) throw new Error('miss '+a.slice(0,80)); s=s.replace(a,b); };
rep("export const sentences = (t: string) => t.split(/(?<=[.!?؟…])\\s+/).map(s => s.trim()).filter(Boolean);",
"export const sentences = (t: string) => t.split(/(?<=[.!?؟…])\\s+/).map(s => s.trim()).filter(Boolean);\n/** the pieces a reply is rendered in: its sentences, the first cut at its first comma when long (the first audio sooner: a\n *  synthesis takes time in proportion to its length) */\nexport function chunks(t: string): string[] {\n  const S = sentences(t); if (!S.length) return S; const m = /^(.{12,}?[,،;:])\\s+(.{12,})$/.exec(S[0]);\n  return S[0].length > 40 && m ? [m[1], m[2], ...S.slice(1)] : S;\n}");
rep("  return sentences(layer === 'fa' ? farsi! : english).map(text => ({ text, lang: layer }));", "  return chunks(layer === 'fa' ? farsi! : english).map(text => ({ text, lang: layer }));");
rep("  const ps = replyJobs(layer, units, english, o.farsi).map(j => nv.say(v, j)); const parts",
"  const ps = layer === 'own' ? units.map(u => nv.fetch(v, u.id, u.ipa, u.intonation).then(pcm => (pcm ? { pcm, rate: 24000 } : null))) : replyJobs(layer, units, english, o.farsi).map(j => nv.say(v, j)); const parts");
rep("/** the synthesis jobs of a heard reply: the own language's units (their phonemes), or the opt-in layer's sentences */", "/** the synthesis jobs of a heard reply: the own language's units (their phonemes), or the opt-in layer's pieces */");
fs.writeFileSync(p,s);
p='T:/fars-wt/voices/tests/voices_unique.test.ts'; s=fs.readFileSync(p,'utf8');
rep("import { replyJobs, sentences } from '../src/people/converse/voice';","import { replyJobs, sentences, chunks } from '../src/people/converse/voice';");
rep("    expect(sentences('Not far. The gods willing!')).toEqual(['Not far.', 'The gods willing!']);", "    expect(sentences('Not far. The gods willing!')).toEqual(['Not far.', 'The gods willing!']);\n    expect(chunks('Not too bad, not too bad, the stair is a bit steep. My son helps.')).toEqual(['Not too bad,', 'not too bad, the stair is a bit steep.', 'My son helps.']);");
fs.writeFileSync(p,s);
console.log('ok');
