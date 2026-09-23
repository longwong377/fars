// dev: the built Tachara as a horizontal section (the plan convention: cut above the window sills, so doorways, windows
// and niches read as openings), for tools/dev/tachara_overlay.py. Prints JSON {level, boxes: [[x0, x1, y0, y1], …],
// columns: [[x, y], …]}: every solid Tachara wall / frame box the cut passes through, and the column centres.
// Run: npx tsx tools/dev/tachara_section.ts [height above the floor, default 2] > section.json
import { buildTerrace } from '../../src/arch/terrace';
import { v } from '../../src/arch/spec';

const above = Number(process.argv[2] ?? 2), level = v<number>('tachara', 'floor') + above;
const { parts } = buildTerrace();
const boxes: number[][] = [], columns: number[][] = [];
for (const p of parts) {
  if (p.building !== 'tachara') continue;
  if (p.type === 'column') { columns.push(p.c); continue; }
  if (p.type !== 'box' || p.solid === false || p.kind === 'roof' || p.kind === 'door_leaf' || p.kind === 'step' || p.kind === 'parapet' || p.kind === 'landing') continue;
  if (!(p.y0 <= level && p.y1 > level)) continue;
  if (p.rot) throw new Error(`rotated ${p.kind}`);
  boxes.push([p.c[0] - p.size[0] / 2, p.c[0] + p.size[0] / 2, p.c[1] - p.size[1] / 2, p.c[1] + p.size[1] / 2]);
}
console.log(JSON.stringify({ level, boxes, columns }));
