import { readFileSync } from 'node:fs';
import { NavGrid } from '../../src/people/navgrid';
const nav = await NavGrid.load(async p => { const b = readFileSync('public/' + p); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); });
const from: [number, number] = [0, 80]; // court N of the Apadana
const probes: [string, number, number, number][] = [
  ['Tachara hall', -21.3, -80, 2.6], ['Tachara portico', -21.3, -94, 2.6], ['Tachara N room', -27, -65, 2.6],
  ['Hadish N court', 20, -120, 6], ['Hadish hall', 22, -159.5, 6], ['Hadish W stair lower', -3.8, -120, 0.9], ['Hadish E stair top', 50, -120.5, 6],
  ['Tripylon hall', 82, -72, 2.6], ['Tripylon N terrace', 82, -53, 2.6], ['Tripylon S court', 82, -95, 2.6], ['Tripylon E corridor', 96, -72, 2.6],
  ['Hall100 hall', 146, -29, 0.5], ['Hall100 portico', 146, 20, 0.5], ['Harem court', 114, -118, 1.0], ['Harem hall', 114.75, -142.5, 1.0],
  ['Treasury inside', 180, -120, 0.3], ['street S of Hall100', 170, -72, 0],
];
for (const [name, e, n, z] of probes) {
  const w = nav.walkable(e, n), h = nav.heightAt(e, n);
  const t0 = Date.now(); const path = w ? nav.findPath(from, [e, n]) : null;
  console.log(`${name.padEnd(22)} walkable=${w} h=${Number.isNaN(h) ? 'NaN' : h.toFixed(2)} (expect ${z}) path=${path ? path.length + ' pts' : 'NONE'} ${Date.now() - t0} ms`);
}
