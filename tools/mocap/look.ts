// D-333: a contact sheet of a take at given times (iteration): npx tsx tools/mocap/look.ts <out.png> <take@fps> t1 t2 …  [SEAT=1]
import { still } from './cycles';
import { sheet } from './preview';
const [out, tk, ...ts] = process.argv.slice(2); const [id, f] = tk.split('@');
const cells = ts.map(t => ({ pose: still(id, +(f ?? 120), +t).pose, label: t, seat: !!process.env.SEAT, plant: !process.env.SEAT }));
const side = (process.env.VIEWS ?? '') === 'side';
console.log(sheet(out, cells, { cols: side ? 1 : cells.length, dx: 1.1, dz: 1.3, views: (process.env.VIEWS ?? 'front,side').split(',') , res: +(process.env.RES ?? 1400) }));
