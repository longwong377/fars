const fs=require('fs');const p='T:/fars-wt/voices/src/world/world.ts';let s=fs.readFileSync(p,'utf8');
const rep=(a,b)=>{ if(!s.includes(a)) throw new Error('miss '+a.slice(0,80)); s=s.replace(a,b); };
rep("speakerId: c.key, backend: 'formant' }; };", "speakerId: c.key, backend: neural?.stats.ready ? 'kokoro' : 'formant' }; };");
rep("  const clipBackend = (line: ResolvedLine, voiceKey: string) => ((voiceManifest.clips", "  const clipBackend = (line: ResolvedLine, voiceKey: string) => neural?.stats.ready ? 'kokoro' : ((voiceManifest.clips");
fs.writeFileSync(p,s);
