// dev (D-226): the relief shadow atlas for every relief set on the Terrace (panels, texels, memory, grid slots, build time)
// and the raking-sun measurement the rubric asks for: a figure on a wall, the sun 15° off the wall plane, the shadow it casts
// on its ground measured with the shader's CPU mirror (reliefShadowAt) against the exact march on the figure's L0 heightfield,
// for three carving depths (the shadow's width should scale with the depth).
//   npx tsx tools/dev/relief_shadow_check.ts [--quick]
import { buildTerrace } from '../../src/arch/terrace';
import { buildReliefs, buildPhase4Reliefs } from '../../src/arch/decor';
import { ReliefSet, buildReliefShadow } from '../../src/arch/reliefs';
import { planReliefShadow, stampField, reliefShadowAt, HSCALE, type ReliefShadowData } from '../../src/arch/relief_shadow';
import { rasterize } from '../../src/arch/relief_field';
import { figureDef, defBounds } from '../../src/arch/relief_figures';

const quick = process.argv.includes('--quick');
if (!quick) {
  const t0 = performance.now();
  const { manifest, doorways } = buildTerrace() as any;
  const sets = [...buildReliefs(manifest).children, ...buildPhase4Reliefs(doorways).group.children].filter(c => c instanceof ReliefSet) as ReliefSet[];
  const t1 = performance.now();
  const D = buildReliefShadow(sets);
  const t2 = performance.now();
  const byT = new Map<number, number>(); for (const p of D.panels) byT.set(p.texel, (byT.get(p.texel) ?? 0) + p.aw * p.ah);
  let used = 0; for (let i = 0; i < D.gridRow0 * D.aw; i++) if (D.atlas[i]) used++;
  const slots = [0, 0, 0, 0, 0]; for (let c = 0; c < D.gw * D.gh; c++) { let k = 0; while (k < 4 && D.grid[c * 4 + k]) k++; slots[k]++; }
  console.log(`sets ${sets.length}, items ${D.items.length}, panels ${D.panels.length}; atlas ${D.aw} × ${D.gridRow0} height rows + ${D.ah - D.gridRow0} grid rows = ${(D.aw * D.ah / 1048576).toFixed(1)} MiB (R8); heights non-zero ${(used / 1e6).toFixed(2)} M texels`);
  console.log(`texels (m → panel texels): ${[...byT].map(([t, n]) => `${(t * 1000).toFixed(1)} mm: ${(n / 1e6).toFixed(2)} M`).join(', ')}`);
  console.log(`grid ${D.gw} × ${D.gh} cells of ${D.gc} m from (${D.gx0}, ${D.gz0}); cells by panels held 0..4: ${slots.join(' / ')}; overflow ${D.overflow}`);
  console.log(`build: sets ${(t1 - t0).toFixed(0)} ms, shadow atlas (plan + ${new Set(D.items.map(i => i.kind + '|' + i.seed)).size} fields rasterised + stamped, synchronous) ${(t2 - t1).toFixed(0)} ms; highest texel ${(D.atlas.subarray(0, D.gridRow0 * D.aw).reduce((a, b) => Math.max(a, b), 0) / 255 * HSCALE * 100).toFixed(2)} cm`);
}

// ---------------- the rubric's moments: the sun on the Apadana façades ----------------
{
  const { WorldClock } = await import('../../src/core/clock');
  const { sunHorizon, azAltToWorld } = await import('../../src/sky/ephemeris');
  for (const [name, day, hour, face, Z] of [['apadana-e-stair-raking', 25, 10, 'E façade', [1, 0]], ['reliefs-raking', 25, 16, 'N façade', [0, -1]]] as [string, number, number, string, [number, number]][]) {
    const c = new WorldClock(day, hour), s = sunHorizon(c.jdUT), d = azAltToWorld(s.azimuth, s.altitude);
    const sw = d[0] * Z[0] + d[2] * Z[1], X: [number, number] = [-Z[1], Z[0]], su = d[0] * X[0] + d[2] * X[1];
    const off = (Math.asin(Math.max(-1, Math.min(1, sw))) * 180) / Math.PI;
    console.log(`${name} (day ${day} ${hour} h): sun altitude ${s.altitude.toFixed(1)}°, azimuth ${s.azimuth.toFixed(1)}° true; ${face}: sun ${off.toFixed(1)}° off the wall plane; a vertical step of 1 cm casts ${(Math.hypot(su, d[1]) / Math.max(1e-3, sw)).toFixed(2)} cm along the light (${(Math.abs(su) / Math.max(1e-3, sw)).toFixed(2)} across, ${(d[1] / Math.max(1e-3, sw)).toFixed(2)} down)`);
  }
}
// ---------------- the raking-sun test ----------------
/** a wall facing +z (world), the figure's ground line at y = 0, walking toward +x; sun 15° off the wall plane, its in-plane
 *  direction 35° above the horizontal from the viewer's left (the figure's shadow falls right and down) */
const ELEV = +(process.argv.find(a => a.startsWith('--elev='))?.slice(7) ?? 15), PHI = 35;
const e = (ELEV * Math.PI) / 180, ph = (PHI * Math.PI) / 180;
const L: [number, number, number] = [-Math.cos(e) * Math.cos(ph), Math.cos(e) * Math.sin(ph), Math.sin(e)];
const hl = Math.hypot(L[0], L[1]), sw = L[2];
/** the exact reference: the figure's L0 heightfield (1025², point-sampled), marched toward the sun in 1 mm steps */
function exactOf(kind: string, S: number, depth: number) {
  const f = rasterize(figureDef(kind, 0), 1025, false);
  const h = (x: number, y: number) => { const gi = Math.round((x / S - f.x0) / f.cell), gj = Math.round((y / S - f.y0) / f.cell);
    if (gi < 0 || gj < 0 || gi >= f.n || gj >= f.n) return 0; return Math.max(0, f.h[gj * f.n + gi] * depth - 0.001); };
  const lit = (x: number, y: number, z0: number) => { for (let t = 0.001; t < 0.6; t += 0.001) { const z = z0 + sw * t; if (z > depth) return 1; if (h(x + L[0] * t, y + L[1] * t) > z + 0.0002) return 0; } return 1; };
  return { h, lit };
}
function atlasOf(kind: string, S: number, depth: number) {
  const D: ReliefShadowData = planReliefShadow([{ kind, seed: 0, o: [0, 0, 0], X: [1, 0], Z: [0, 1], S, D: depth, mirror: false, embed: 0.001 }]);
  for (const [k, j] of [...D.jobs]) stampField(D, k, rasterize(figureDef(j.kind, j.seed), j.n, true));
  return D;
}
// (1) a straight edge: the throne-bearers' ledge ('rail', 4 m × 0.1 m) seen along its lower edge; the shadow band under it
//     is measured down 40 columns: the geometry gives width = crest height × L_up / L_out
{
  const S = 4, rows: string[] = [];
  for (const depth of [0.03, 0.045, 0.06]) {
    const D = atlasOf('rail', S, depth), ex = exactOf('rail', S, depth);
    let wA = 0, wE = 0, hc = 0, k = 0;
    for (let x = -1.5; x <= 1.5; x += 0.075, k++) {
      let y = 0.001; while (ex.h(x, y) > 0) y -= 0.0005; // the foot of the edge
      let yA = y; while (reliefShadowAt(D, [x, yA, 0], L) < 0.5 && yA > y - 0.5) yA -= 0.0005;
      let yE = y; while (!ex.lit(x, yE, 0) && yE > y - 0.5) yE -= 0.0005;
      wA += y - yA; wE += y - yE; let top = 0; for (let yy = y; yy < 0.1; yy += 0.0005) top = Math.max(top, ex.h(x, yy)); hc += top;
    }
    wA /= k; wE /= k; hc /= k;
    rows.push(`D ${(depth * 100).toFixed(1)} cm: crest ${(hc * 100).toFixed(2)} cm; band under the edge ${(wA * 100).toFixed(2)} cm (exact march ${(wE * 100).toFixed(2)}; crest × L_up/L_out = ${(hc * L[1] / sw * 100).toFixed(2)})`);
  }
  console.log(`straight edge ('rail' at 4 m), sun ${ELEV}° off the wall, in-plane ${PHI}° above the horizontal:\n  ` + rows.join('\n  '));
}
// (2) figures: the shaded ground (mean width across the lit-away outline) and the self-shadow on the figure, atlas vs exact
for (const kind of ['guard', 'lion_bull']) {
  const S = kind === 'guard' ? 0.741 : 2.0, b = defBounds(figureDef(kind, 0));
  const rows: string[] = [];
  for (const depth of [0.03, 0.045, 0.06]) {
    const D = atlasOf(kind, S, depth), ex = exactOf(kind, S, depth);
    const step = 0.002, x0 = b[0] * S - 0.1, x1 = b[2] * S + 0.45, y0 = b[1] * S - 0.45, y1 = b[3] * S + 0.05;
    let area = 0, areaEx = 0, agree = 0, n = 0, edge = 0, fOn = 0, fFalse = 0, fMiss = 0, fShEx = 0;
    for (let y = y0; y < y1; y += step) for (let x = x0; x < x1; x += step) {
      const hz = ex.h(x, y);
      if (hz > 0) { // on the figure: its own shadow, atlas against exact, where the exact surface faces the sun
        if (ex.h(x + step, y) <= 0 || ex.h(x, y - step) <= 0) edge++;
        const gx = (ex.h(x + step, y) - ex.h(x - step, y)) / (2 * step), gy = (ex.h(x, y + step) - ex.h(x, y - step)) / (2 * step), nl = (-gx * L[0] - gy * L[1] + L[2]) / Math.hypot(gx, gy, 1);
        if (nl < 0.1 || (x * 0 + 1) === 0) continue;
        const va = reliefShadowAt(D, [x, y, hz], L), ve = ex.lit(x, y, hz); fOn++; if (!ve) fShEx++;
        if (va < 0.5 && ve) fFalse++; if (va >= 0.5 && !ve) fMiss++;
        continue;
      }
      const vis = reliefShadowAt(D, [x, y, 0], L), lit = ex.lit(x, y, 0);
      area += (1 - vis) * step * step; areaEx += (1 - lit) * step * step; n++; if ((vis < 0.5 ? 0 : 1) === lit) agree++;
    }
    const outline = edge * step, wAt = area / outline, wEx = areaEx / outline;
    rows.push(`D ${(depth * 100).toFixed(1)} cm: ground shaded ${(area * 1e4).toFixed(0)} cm² (exact ${(areaEx * 1e4).toFixed(0)}), mean width ${(wAt * 100).toFixed(2)} cm (exact ${(wEx * 100).toFixed(2)}), ground agreement ${(100 * agree / n).toFixed(1)} %; on the figure's sunward faces: shaded ${(100 * fShEx / fOn).toFixed(1)} % exact, falsely shaded ${(100 * fFalse / fOn).toFixed(2)} %, missed ${(100 * fMiss / fOn).toFixed(2)} %`);
  }
  console.log(`${kind} (S ${S} m), sun ${ELEV}° off the wall, in-plane ${PHI}° above the horizontal:\n  ` + rows.join('\n  '));
}
