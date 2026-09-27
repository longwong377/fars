// D-303 probe: the lanes' litter of one quarter's near tiles (houses.ts litterNear), counted per tile, with the site's cell codes.
// npx tsx tools/dev/litter_probe.ts [site]
import { buildTownPlan } from '../../src/world/settlement/plan';
import { SiteHouses, newHB } from '../../src/world/settlement/houses';
const plan = buildTownPlan(), id = process.argv[2] ?? 'q_s1', si = plan.sites.findIndex(x => x.id === id), s = plan.sites[si];
const n = s.plots.length, hs = new SiteHouses(s, si, () => 0, new Float32Array(n), new Uint8Array(n), s.plots.map(() => [0.3, 0.2, 0.1] as [number, number, number]), new Int32Array(n), []);
const codes = new Map<number, number>(); for (let k = 0; k < s.cell.length; k++) { const c = s.cell[k] < 0 ? s.cell[k] : 100 + s.sub[k]; codes.set(c, (codes.get(c) ?? 0) + 1); }
console.log('cell codes (negative: open ground kinds; 100 + sub: plot cells)', JSON.stringify([...codes].sort((a, b) => a[0] - b[0])));
let tris = 0, tiles = 0; for (const t of hs.tiles.keys()) { const B = newHB(); hs.buildTile(t, B, 25); tris += B.litter.tris; tiles++; }
console.log(`${id}: ${tiles} tiles, litter ${tris} triangles (${(tris / tiles).toFixed(0)} a tile)`);
{ // the colours in one tile's litter (sherds are the reddest)
  const t = [...hs.tiles.keys()][20], B = newHB(); hs.buildTile(t, B, 25); const g = B.litter.toGeometry(), c = g.getAttribute('color'), p = g.getAttribute('position');
  let red = 0; const ys: number[] = []; for (let i = 0; i < c.count; i++) if (c.getX(i) > c.getZ(i) * 2.5) { red++; if (ys.length < 6) ys.push(+p.getY(i).toFixed(3)); }
  console.log('tile', t, 'vertices', c.count, 'sherd-coloured', red, 'their y', ys.join(' '));
}
