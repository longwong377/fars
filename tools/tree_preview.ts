// Dev tool: node-side previews of the tree kit (no browser). Each cell of the sheet is one tree rasterised by the
// impostor baker's CPU rasteriser (src/world/trees/impostor.ts, the same cards, atlas, season rules and shading model as
// the GPU), at the pixel scale a 960x540, 70 deg view gives the tree at the chosen distance, then lit here with the
// same terms as the leaf shader (render.ts): sun (N.L), hemisphere sky/ground, leaf translucency toward the sun
// (shade.ts). No shadow map: the crown's own directional self-shadowing is not in these sheets. For judging shapes,
// normals, occlusion, tiles and seasons only; the judgement that counts is the browser render (plain.spec, treelab.spec).
//
//   npx tsx tools/tree_preview.ts [--out f.png] [--doy 102] [--sun 35,140] [--zoom 3] cell cell ...
//   cell = species[:lod[:distance[:azimuth[:variant]]]]   lod 0 | 1 | imp (impostor at the quality's tile size)
//   e.g.  plane:1:60  plane:0:25  fig:0:8  cypress:imp:250
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { allModels, rowOf } from '../src/world/trees/model';
import { calibrateAndDrawAtlas } from '../src/world/trees/kitdata';
import { ImpostorBaker, groupStates, NV, srgbToLinear, linearToSrgb } from '../src/world/trees/impostor';
import { speciesIndex, groupIndex } from '../src/world/trees/species';
import { foliageTable } from '../src/world/plain/seasonal';
import { SHADE, crownOf } from '../src/world/trees/shade';
const { PNG } = createRequire(import.meta.url)('playwright-core/lib/utilsBundle');

const args = process.argv.slice(2), opt = (k: string, d: string) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
const out = opt('--out', 'shots/tree-preview.png'), doy = +opt('--doy', '102'), [sunEl, sunAz] = opt('--sun', '35,140').split(',').map(Number), zoom = +opt('--zoom', '3');
const impPx = +opt('--imppx', '96'), cellPx = +opt('--cell', '120'), useTrans = opt('--trans', '1') === '1';
const cells = args.length ? args : ['plane:1:60', 'plane:0:25', 'poplar:1:60', 'willow:1:60', 'fig:0:8', 'pomegranate:0:10', 'cypress:0:15', 'tamarisk:1:50'];
const models = allModels(), atlas = calibrateAndDrawAtlas(models), st = groupStates(foliageTable(doy));
const PXM = 385.6; // px per metre at 1 m: 540 px over a 70 deg vertical field of view
// light in the view frame (x right, y up, z toward the viewer); sunAz 0 = the sun behind the viewer, 90 = on the right
const el = sunEl * Math.PI / 180, az = sunAz * Math.PI / 180, L = [Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az)];
const E_SUN = 3.0, SKY = [0.45, 0.6, 0.9].map(v => v * 0.9), GROUND = [0.3, 0.26, 0.2].map(v => v * 0.35), EXPO = 1.1;
const aces = (x: number) => Math.max(0, Math.min(1, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)));
// cells: each as wide as its tree (at least cellPx), the sheet as tall as the tallest tree, all at `zoom`
const plans = cells.map(spec => { const [sp, lodS = '1', distS = '50', azS = '0', varS = '0'] = spec.split(':');
  const lod = lodS === 'imp' ? 'imp' : (+lodS as 0 | 1), dist = +distS, view = Math.round(((+azS % 360) + 360) % 360 / (360 / NV)) % NV, variant = +varS;
  const row = rowOf(speciesIndex(sp), variant), m = models[row], screenPx = Math.round((m.T * PXM) / dist);
  return { spec, lod, dist, view, variant, m, screenPx, px: lod === 'imp' ? impPx : Math.max(8, screenPx), w: Math.max(cellPx, screenPx + 8) * zoom }; });
const W = plans.reduce((a, q) => a + q.w, 0), H = (Math.max(cellPx, ...plans.map(q => q.screenPx)) + 16) * zoom, img = new PNG({ width: W, height: H });
// background: sky over ground
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const o = (y * W + x) * 4, t = y / H, sky = y < H - 8 * zoom;
  const c = sky ? [0.55 + 0.25 * t, 0.68 + 0.2 * t, 0.88] : [0.47, 0.41, 0.32]; img.data[o] = c[0] * 255; img.data[o + 1] = c[1] * 255; img.data[o + 2] = c[2] * 255; img.data[o + 3] = 255; }
let x0 = 0;
for (const q of plans) {
  const { spec, lod, dist, view, variant, m, screenPx, px } = q;
  const b = new ImpostorBaker([m], atlas, px, lod === 'imp' ? 1 : (lod as 0 | 1)), g = st[groupIndex(m.species.group)];
  b.bakeRow(0, g);
  const col = b.out.col[0], nrm = b.out.nrm[0], scale = screenPx / px, cr = crownOf(m);
  const ox = x0 + Math.round((q.w - screenPx * zoom) / 2), oy = H - 8 * zoom - screenPx * zoom; x0 += q.w;
  for (let y = 0; y < screenPx * zoom; y++) for (let x = 0; x < screenPx * zoom; x++) {
    const tx = Math.min(px - 1, Math.floor(x / zoom / scale)), ty = Math.min(px - 1, Math.floor((screenPx * zoom - 1 - y) / zoom / scale));
    const i = (ty * b.width + view * px + tx) * 4; if (col.data[i + 3] < 128) continue;
    const alb = [0, 1, 2].map(k => srgbToLinear(col.data[i + k] / 255)), n = [0, 1, 2].map(k => nrm.data[i + k] / 255 * 2 - 1), nl = Math.hypot(n[0], n[1], n[2]) || 1; n[0] /= nl; n[1] /= nl; n[2] /= nl;
    const ndl = n[0] * L[0] + n[1] * L[1] + n[2] * L[2], hemi = 0.5 + 0.5 * n[1];
    const back = Math.max(0, -ndl), trans = SHADE.trans * back * Math.exp(-cr.kappa * back);
    const X = ox + x, Y = oy + y; if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const o = (Y * W + X) * 4;
    for (let k = 0; k < 3; k++) { const e = E_SUN * Math.max(0, ndl) + (GROUND[k] + (SKY[k] - GROUND[k]) * hemi) + (useTrans ? E_SUN * trans * SHADE.transTint[k] : 0);
      img.data[o + k] = Math.round(255 * linearToSrgb(aces(alb[k] / Math.PI * e * EXPO * 2.2))); }
  }
  console.log(`${spec}: ${m.species.id}/${variant} lod ${lod} ${dist} m: ${screenPx} px tall (bake ${px} px), leaf ${g.leaf[3].toFixed(2)} blossom ${g.blossom[3].toFixed(2)}`);
}
writeFileSync(out, PNG.sync.write(img)); console.log('wrote', out, `${W}x${H}`);
void NV;
