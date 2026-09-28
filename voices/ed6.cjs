const fs=require('fs');const p='T:/fars-wt/voices/tools/dev/voices_probe.mjs';let s=fs.readFileSync(p,'utf8');
s=s.replace("p.on('pageerror', e => logs.push('pageerror ' + e));", "p.on('pageerror', e => logs.push('pageerror ' + e)); p.on('response', r => { if (r.status() >= 400) logs.push('HTTP ' + r.status() + ' ' + r.url()); });\np.on('worker', w => { logs.push('worker ' + w.url()); w.on('console', m => logs.push('W ' + m.type() + ' ' + m.text().slice(0, 300))); });");
fs.writeFileSync(p,s);
const q='T:/fars-wt/voices/src/audio/neural/neural_worker.ts'; let w=fs.readFileSync(q,'utf8');
w=w.replace("const dbg = 0;","");
w=w.replace("      queue.sort(", "      if (DBG) console.log('[neural] job', queue.length);\n      queue.sort(");
w=w.replace("localModels(self.location.origin);", "localModels(self.location.origin);\nconst DBG = /[?&]neuraldebug/.test(self.location.search) || (self as any).name === 'debug';");
fs.writeFileSync(q,w);
