const fs=require('fs');
let p='T:/fars-wt/voices/src/audio/voices.ts'; let s=fs.readFileSync(p,'utf8');
const rep=(a,b)=>{ if(!s.includes(a)) throw new Error('miss '+a.slice(0,80)); s=s.replace(a,b); };
rep("spoke: now - 5 * r.next() }; this.slots.set(p.key, s); }",
"spoke: now - 5 * r.next() }; this.slots.set(p.key, s);\n      // D-336: a person newly in earshot has two of their units rendered ahead, at the bed's priority (their first words come sooner)\n      if (this.neural?.stats.ready) { const L = voiceLang(p.lang, p.langs).lang, U = L ? unitsFor(L) : null; if (U?.words.length) this.neural.prefetch(s.nv, [r.pick(U.words), U.lines.length ? r.pick(U.lines) : r.pick(U.words)], PRIO.bed); } }");
rep("    const tune: Unit = u.kind !== 'line' ? { ...u, intonation: r.chance(0.6) ? u.intonation : r.pick(['fall', 'level', 'rise'] as Intonation[]) } : u;",
"    let tune: Unit = u.kind !== 'line' ? { ...u, intonation: r.chance(0.6) ? u.intonation : r.pick(['fall', 'level', 'rise'] as Intonation[]) } : u;\n    // D-336: a bed grain is one of this person's units already rendered when there is one (the bed never waits on the model)\n    if (kind === 'bed' && this.neural?.stats.ready && !o.unit && !this.neural.has(s.nv, tune.id, tune.intonation, tune.kind === 'line' ? 0 : s.n & 1)) {\n      const U = lang ? unitsFor(lang) : null, fresh = (x: Unit) => (s.recent.get(x.id) ?? -1e9) < now - 60;\n      const alt = U ? [...U.lines, ...U.words].find(x => fresh(x) && this.neural!.has(s.nv, x.id, x.intonation, x.kind === 'line' ? 0 : s.n & 1)) : undefined;\n      if (alt) tune = alt;\n    }");
// the neural get must use the tune's id (the grain may have been swapped)
rep("const pcm = nv.get(s.nv, u.id, u.ipa, tune.intonation,", "const pcm = nv.get(s.nv, tune.id, tune.ipa, tune.intonation,");
rep("u.kind === 'line' ? 0 : s.n & 1);\n      if (!pcm)", "tune.kind === 'line' ? 0 : s.n & 1);\n      if (!pcm)");
fs.writeFileSync(p,s);
console.log('ok');
