import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
const nav = await NavGrid.load(async p => { const b = readFileSync('public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); });
const [a, b] = JSON.parse(process.argv[2]) as [[number, number], [number, number]];
const t0 = Date.now(); const p = nav.findPath(a, b); console.log(p ? `${p.length} pts ${JSON.stringify(p.map(q => q.map(x => +x.toFixed(1))))}` : 'NONE', Date.now() - t0, 'ms');
