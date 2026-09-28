const fs=require('fs');
let p='T:/fars-wt/voices/src/world/world.ts'; let s=fs.readFileSync(p,'utf8');
const rep=(a,b)=>{ if(!s.includes(a)) throw new Error('miss '+a.slice(0,80)); s=s.replace(a,b); };
rep("  /** the backend a line will play through for a voice class", "  /** D-336: a conversation's reply played at the person in the world's own graph (the distance law, occlusion, the voices\n   *  channel), piece after piece as the worker renders them; their jaw moves with it and their murmur waits. Returns the end */\n  let replyAt = 0;\n  const sayPcm = (key: string, pcm: Float32Array, rate: number, pos: { x: number; y: number; z: number }): number => {\n    const c = audio.ctx; if (!c || !pcm.length) return 0; const t0 = Math.max(c.currentTime + 0.02, replyAt), b = c.createBuffer(1, pcm.length, rate); b.getChannelData(0).set(pcm);\n    const src = c.createBufferSource(); src.buffer = b; const g = c.createGain(); g.gain.value = voices.level; const pan = audio.panner(pos.x, pos.y, pos.z, 2, 100);\n    src.connect(g); g.connect(pan); audio.route(pan, 'voices', t0 + b.duration); src.start(t0); replyAt = t0 + b.duration + 0.18;\n    voices.speaking.set(key, { from: t0, to: t0 + b.duration }); scriptedUntil.set(key, time + (replyAt - c.currentTime) + 0.3); return replyAt;\n  };\n  /** the backend a line will play through for a voice class");
rep("neural, people: { sim, crowd, nav,", "neural, sayPcm, people: { sim, crowd, nav,");
fs.writeFileSync(p,s);
p='T:/fars-wt/voices/src/main.ts'; s=fs.readFileSync(p,'utf8');
rep("m.mountConverse({ world, camera, clock, seed: SEED })", "m.mountConverse({ world, camera, clock, seed: SEED, settings })");
fs.writeFileSync(p,s);
