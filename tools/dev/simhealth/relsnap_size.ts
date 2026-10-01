// dev (D-360): how big is the relations' state at day N, and how long does a structured restore take
import { readFileSync } from 'node:fs'; import v8 from 'node:v8'; import { gzipSync } from 'node:zlib';
import { NavGrid } from '../../../src/people/navgrid';
import { PeopleSim, type Env } from '../../../src/people/sim';
const DAY = +(process.argv[2] ?? 300);
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const env = (): Env => ({ rain: 0, lightning: false, windMs: 2, tempC: 20, dust: 0 } as Env);
const S = new PeopleSim(1, nav, env, { bonds: true }); S.bonds.advance(DAY);
const R: any = S.bonds; const F = ['pairs','player','events','news','pregnancies','meets','edges','contacts','wed','homeOv','rep','moodEv','pregBy','bedWeeks','lovBed','arranged','ownWed','busy','pendingShow','week','stats'];
const st: any = {}; for (const f of F) st[f] = R[f];
for (const f of F) { const b = v8.serialize(R[f]); console.log(f, (b.length/1e6).toFixed(2), 'MB'); }
let t = performance.now(); const buf = v8.serialize(st); const ser = performance.now() - t; t = performance.now(); v8.deserialize(buf); const de = performance.now() - t;
console.log({ MB: +(buf.length/1e6).toFixed(2), gzMB: +(gzipSync(buf).length/1e6).toFixed(2), serMs: Math.round(ser), deMs: Math.round(de) });
