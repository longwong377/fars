const fs=require('fs');
let p='T:/fars-wt/voices/src/people/converse/ui.ts'; let s=fs.readFileSync(p,'utf8');
const rep=(a,b)=>{ if(!s.includes(a)) throw new Error('miss '+a.slice(0,80)); s=s.replace(a,b); };
rep("    if (!state.loaded || state.busy) return; const n = nearest(c.world, eye(), 6); if (!n) return; const sim = c.world.people.sim;",
"    { // D-336: the lines of the nearest person's language rendered ahead in their voice (their heard reply starts at once)\n      const nv = c.world.neural, n6 = nv?.stats.ready && hearIn() === 'own' ? nearest(c.world, eye(), 6) : null;\n      if (n6 && n6.pid !== prefetchedFor) { prefetchedFor = n6.pid; const sim = c.world.people.sim, { neural: v, id } = replyVoice(sim.pop, n6.pid, c.clock.dayIndex, c.seed, n6.agent !== null ? sim.agents[n6.agent] : null);\n        const L = voiceLang(id.lang, id.langs).lang; nv.prefetch(v, L ? unitsFor(L).lines.slice(0, 32) : WORDLESS); } }\n    if (!state.loaded || state.busy) return; const n = nearest(c.world, eye(), 6); if (!n) return; const sim = c.world.people.sim;");
rep("  let primeP: Promise<any> = Promise.resolve();", "  let primeP: Promise<any> = Promise.resolve(); let prefetchedFor = -1;");
rep("import { heardReply, heardReplyNeural, type HearIn } from './voice';", "import { heardReply, heardReplyNeural, replyVoice, type HearIn } from './voice';\nimport { unitsFor, voiceLang, WORDLESS } from '../../audio/voices';");
fs.writeFileSync(p,s); console.log('ok');
