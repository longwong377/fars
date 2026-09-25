// dev (D-223): what a plain.spec view holds, counted in node without a render. One ray per 4 x 4 pixels (960 x 540, the
// spec's lens) is marched over the terrain heightfield (the Terrace platform as a box at the court datum), and each hit is
// classed as the terrain shader would draw it: field plot (and how much of a plot's own contrast the far fade keeps
// there, terrainPlain.ts plotKeep), the town's trodden ground, a worn path, a road or village track, a built site, hill
// slope or natural ground. Objects are counted inside the frustum by distance band: plain trees (river and canal lines,
// orchard plots, woodland), village compounds, the town's built sites; "resolved" = at least 1.5 px tall.
// Usage: npx tsx tools/dev/plain_view_census.ts [view ...]   (views: stair-noon-plain, stair-dawn-plain, rahmat-west-pm, town-smoke-dusk)
import { loadTerrain, loadRiversFile } from '../../tests/plainLib';
import { buildTownPlan } from '../../src/world/settlement/plan';
import { buildTownGround, groundAt, desireLines } from '../../src/world/plain/townGround';
import { buildZones, landUseAt, zoneAt } from '../../src/world/plain/fields';
import { buildCanals } from '../../src/world/plain/canals';
import { placeVillages, villageCompounds } from '../../src/world/plain/villages';
import { riparianTrees, canalTrees, orchardPlots, orchardPlotTrees, woodlandTrees, type Tree } from '../../src/world/plain/trees';
import { trackLines } from '../../src/world/plain/ribbons';
import { toLocal } from '../../src/world/settlement/site';
import { distToSegment } from '../../src/world/plain/data';

const VIEWS: Record<string, [number, number, number, number, number, number?]> = {
  'stair-noon-plain': [-36.4, 122.45, 1.6, 251, -3], 'stair-dawn-plain': [-39.6, 122.45, 1.6, 251, -4], 'rahmat-west-pm': [-250, 500, 1.6, 95, 6],
  'town-smoke-dusk': [-50.5, -120, 1.6, 205, -1.5, 24], // moments.spec (D-220)
};
const TERRACE = { e0: -61, e1: 256, n0: -239, n1: 235 };
const W = 960, H = 540, STEP = 4;
const BANDS = [200, 500, 1000, 2500, 5000, 10000, 1e9];
const band = (d: number) => BANDS.findIndex(b => d < b);
const bandName = (i: number) => (i === 0 ? '<200' : i === BANDS.length - 1 ? `>${BANDS[i - 1] / 1000}k` : `${BANDS[i - 1] >= 1000 ? BANDS[i - 1] / 1000 + 'k' : BANDS[i - 1]}-${BANDS[i] >= 1000 ? BANDS[i] / 1000 + 'k' : BANDS[i]}`);

export function census(names: string[]) {
  const T = loadTerrain(), R = loadRiversFile();
  const plan = buildTownPlan(), G = buildTownGround(plan);
  const canals = buildCanals(T, R.rivers, 1), villages = placeVillages(T, R.rivers, canals, 1);
  const Z = buildZones({ terrain: T, rivers: R.rivers.map(r => ({ x: r.x, y: r.y, halfCorridor: r.carveRadius.mid + 24 })), villages: villages.map(v => ({ x: v.x, y: v.y, r: v.r })), ground: G,
    sites: plan.sites.map(s => ({ c: s.frame.c as [number, number], theta: s.frame.theta, W: s.W, H: s.H })) });
  const roads = plan.roads, tracks = trackLines(villages), lines = desireLines(plan);
  const trees: Tree[] = [...riparianTrees(R.rivers, 1), ...canalTrees(canals, 1)];
  for (const p of orchardPlots(Z, villages)) trees.push(...orchardPlotTrees(Z, p.sx, p.sz));
  const out: Record<string, any> = {};
  for (const name of names) {
    const [e, n, eye, az, pitch, VFOV = 40] = VIEWS[name];
    const inTer = (x: number, z: number) => x >= TERRACE.e0 && x <= TERRACE.e1 && -z >= TERRACE.n0 && -z <= TERRACE.n1;
    const cy = (inTer(e, -n) ? 0 : T.heightAt(e, -n)) + eye;
    const yaw = -((az - 341) * Math.PI) / 180, pt = (pitch * Math.PI) / 180;
    const fwd = [-Math.sin(yaw) * Math.cos(pt), Math.sin(pt), -Math.cos(yaw) * Math.cos(pt)], right = [Math.cos(yaw), 0, -Math.sin(yaw)];
    const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
    const tv = Math.tan((VFOV / 2) * Math.PI / 180), th = tv * W / H, pxRad = (VFOV * Math.PI / 180) / H;
    const cls: Record<string, number[]> = {}; const add = (k: string, b: number) => { (cls[k] ??= new Array(BANDS.length).fill(0))[b] += STEP * STEP; };
    const keep = new Array(BANDS.length).fill(0), keepN = new Array(BANDS.length).fill(0);
    let sky = 0;
    for (let py = STEP / 2; py < H; py += STEP) for (let px = STEP / 2; px < W; px += STEP) {
      const u = (2 * px / W - 1) * th, v = (1 - 2 * py / H) * tv;
      const d = [fwd[0] + right[0] * u + up[0] * v, fwd[1] + right[1] * u + up[1] * v, fwd[2] + right[2] * u + up[2] * v], L = Math.hypot(d[0], d[1], d[2]);
      d[0] /= L; d[1] /= L; d[2] /= L;
      let t = 0.5, hit = -1, prev = 0;
      while (t < 60000) { const x = e + d[0] * t, y = cy + d[1] * t, z = -n + d[2] * t;
        const g = inTer(x, z) ? Math.max(0, T.heightAt(x, z)) : T.heightAt(x, z) - (t * t) / (2 * 6371000) * 0.87;
        if (y < g) { let a = prev, b = t; for (let k = 0; k < 20; k++) { const m = (a + b) / 2, xm = e + d[0] * m, zm = -n + d[2] * m, gm = inTer(xm, zm) ? 0 : T.heightAt(xm, zm); if (cy + d[1] * m < gm) b = m; else a = m; } hit = b; break; }
        prev = t; t += Math.max(0.5, t * 0.004); }
      if (hit < 0) { sky += STEP * STEP; continue; }
      const x = e + d[0] * hit, z = -n + d[2] * hit, ge = x, gn = -z, b = band(hit);
      if (inTer(x, z)) { add('terrace', b); continue; }
      const s = Math.hypot(T.heightAt(x + 4, z) - T.heightAt(x - 4, z), T.heightAt(x, z + 4) - T.heightAt(x, z - 4)) / 8;
      if (plan.sites.some(st => { const [lu, lv] = toLocal(st.frame, ge, gn); return Math.abs(lu) < st.W / 2 && Math.abs(lv) < st.H / 2; })) { add('town site', b); continue; }
      if (roads.some(r => r.pts.some((q, i) => i > 0 && distToSegment(ge, gn, r.pts[i - 1][0], r.pts[i - 1][1], q[0], q[1]) < r.width / 2))) { add('road', b); continue; }
      if (tracks.some(l => l.some((q, i) => i > 0 && distToSegment(ge, gn, l[i - 1][0], l[i - 1][1], q[0], q[1]) < 2.95))) { add('village track', b); continue; }
      const [pathD, trample] = groundAt(G, ge, gn);
      const lu = landUseAt(Z, x, z);
      if (lu.use !== 'natural') {
        add('field:' + lu.use, b);
        // terrainPlain.ts plotKeep: the pixel footprint across (minor) and along (major) the view on the ground
        const graze = Math.max(1e-3, Math.abs(d[1])), minor = hit * pxRad, major = minor / graze;
        const sm = (a: number, bb: number, xx: number) => { const q = Math.min(1, Math.max(0, (xx - a) / (bb - a))); return q * q * (3 - 2 * q); };
        keep[b] += (1 - sm(6, 20, minor)) * Math.min(1, Math.sqrt(40 / major)); keepN[b]++;
        continue;
      }
      if (pathD < 0.9 + hit * pxRad * 0.5) { add('worn path', b); continue; }
      if (trample > 0.3) { add('trodden', b); continue; }
      if (s > 0.12) { add('hill', b); continue; }
      add(zoneAt(Z, x, z)[3] > 60 ? 'woodland' : 'natural', b);
    }
    // objects in the frustum: [count, resolved (>= 1.5 px tall)] by band
    const obj: Record<string, number[][]> = {};
    const seen = (k: string, x: number, y: number, z: number, hgt: number) => {
      const dx = x - e, dy = y - cy, dz = z + n, dist = Math.hypot(dx, dy, dz), f = dx * fwd[0] + dy * fwd[1] + dz * fwd[2]; if (f <= 1) return;
      const u = (dx * right[0] + dy * right[1] + dz * right[2]) / f, v = (dx * up[0] + dy * up[1] + dz * up[2]) / f; if (Math.abs(u) > th || Math.abs(v) > tv) return;
      const b = band(dist); const o = (obj[k] ??= BANDS.map(() => [0, 0])); o[b][0]++; if (hgt / dist / pxRad >= 1.5) o[b][1]++;
    };
    for (const tr of trees) seen('plain tree', tr.x, T.heightAt(tr.x, -tr.y) + tr.h / 2, -tr.y, tr.h);
    for (const tr of woodlandTrees(Z, e, -n, 12000)) seen('woodland tree', tr.x, T.heightAt(tr.x, -tr.y) + tr.h / 2, -tr.y, tr.h);
    for (const vv of villages) for (const c of villageCompounds(vv, T, 1)) seen('village compound', c.x, T.heightAt(c.x, -c.y) + 1.5, -c.y, 3);
    for (const st of plan.sites) for (const p of st.plots) { if (!p.roofed) continue; const [i0, j0, i1, j1] = p.rect, g = st.grid(st.u0 + (i0 + i1) / 2, st.v0 + (j0 + j1) / 2); seen('town roofed plot', g[0], T.heightAt(g[0], -g[1]) + 1.5, -g[1], 3); }
    out[name] = { sky, classes: Object.fromEntries(Object.entries(cls).map(([k, v]) => [k, Object.fromEntries(v.map((c, i) => [bandName(i), c]).filter(q => q[1]))])),
      plotKeep: Object.fromEntries(keep.map((k, i) => [bandName(i), keepN[i] ? +(k / keepN[i]).toFixed(3) : null]).filter(q => q[1] !== null)),
      objects: Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, Object.fromEntries(v.map((c, i) => [bandName(i), `${c[0]}/${c[1]}`]).filter(q => q[1] !== '0/0'))])),
      desireLines: lines.length };
  }
  return out;
}
if (process.argv[1]?.endsWith('plain_view_census.ts')) console.log(JSON.stringify(census(process.argv.slice(2).length ? process.argv.slice(2) : ['stair-noon-plain']), null, 1));
