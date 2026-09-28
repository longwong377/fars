const fs=require('fs');
let p='T:/fars-wt/voices/src/audio/neural/client.ts'; let s=fs.readFileSync(p,'utf8');
s=s.replace("{ type: 'module' }); } catch (e)", "{ type: 'module', name: typeof location !== 'undefined' && /[?&]neuraldebug/.test(location.search) ? 'debug' : 'voices' }); } catch (e)");
fs.writeFileSync(p,s);
p='T:/fars-wt/voices/src/audio/neural/neural_worker.ts'; s=fs.readFileSync(p,'utf8');
s=s.replace("const DBG = /[?&]neuraldebug/.test(self.location.search) || (self as any).name === 'debug';","const DBG = (self as any).name === 'debug';");
s=s.replace("        const pcm = ph ? await K.speak(ph, j.voice, { speed: j.speed }) : new Float32Array(0);", "        if (DBG) console.log('[neural] speak', ph, JSON.stringify(j.voice).slice(0, 200));\n        const pcm = ph ? await K.speak(ph, j.voice, { speed: j.speed }) : new Float32Array(0);\n        if (DBG) console.log('[neural] done', pcm.length, (performance.now() - t0).toFixed(0), 'ms');");
s=s.replace("  } else if (m.type === 'speak') { queue.push", "  } else if (m.type === 'speak') { if (DBG) console.log('[neural] got speak', m.id, !!K, busy); queue.push");
fs.writeFileSync(p,s);
