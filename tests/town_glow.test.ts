// D-227: the town at dusk from the Terrace and from Kuh-e Rahmat (§1.1 "smoke rising from the town at dusk as lamps are lit";
// moments town-smoke-dusk, town-smoke-dusk-rahmat). Measured with the real people sim, town and smoke model:
//  - the households' lit hearths by hour (the sim's household day, hearthSmoke.ts), on the old moment's day (14, a warm
//    evening: the fires die to embers by sunset) and on a calm, cool evening (the fires kept low until bedtime);
//  - how many of the lit fires a moment camera sees by line of sight over the town's walls and roofs (a 0.5 m height raster
//    of the town's up-facing surfaces), and what their light on their own courts' walls sends it;
//  - the solid angle a hearth's light leaves its court by (FIRE_ESCAPE_SR) and the fire light on the smoke layer against
//    its skylight at the moment's hour;
//  - the smoke layer's optical depth toward the quarters at the moment's hour (it must still read: τ ≥ 0.1 from the Terrace).
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, type Env } from '../src/people/sim';
import { WeatherSystem } from '../src/weather/weatherState';
import { FireSystem, scheduleLit, fireLight, type FireKind } from '../src/world/fire';
import { Settlement } from '../src/world/settlement/build';
import { SmokeModel, cellTau, FIRE_ESCAPE_SR, COLD_EVENING_C, type SmokeCell, type SmokeSite } from '../src/world/hearthSmoke';
import { loadTerrain, loadRiversFile } from './plainLib';
import { placeVillages } from '../src/world/plain/villages';
import { buildCanals } from '../src/world/plain/canals';
import { sunTimes } from '../src/people/calendar';
import { sunAltAt, heightRaster, CAMS, viewStats, frameClip, escapeSr, type Cam } from './lib/townLos';
import { skyLux, REN_PER_LUX_SKY, NIGHT_LUX } from '../src/sky/illuminance';
import { skyGain, fireLightScale } from '../src/sky/exposure';

const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
/** the moments as the spec has them (day, hour) */
const spec = readFileSync('tests/e2e/moments.spec.ts', 'utf8');
const shot = (n: string) => { const m = new RegExp(`n: '${n}', day: (\\d+), hour: ([\\d.]+)`).exec(spec)!; return { day: +m[1], hour: +m[2] }; };
let model: SmokeModel, fire: FireSystem, town: Settlement, T: ReturnType<typeof loadTerrain>, H: (e: number, n: number) => number;
beforeAll(() => {
  const sim = new PeopleSim(1, new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8'))), env);
  T = loadTerrain(); H = (e, n) => T.heightAt(e, -n); fire = new FireSystem(0); town = new Settlement(null, T, fire, 'test');
  const R = loadRiversFile(), C = buildCanals(T, R.rivers, 1), V = placeVillages(T, R.rivers, C, 1);
  const sites: SmokeSite[] = [...town.plan.sites.map((s: any) => ({ id: s.id, e: s.frame.c[0], n: s.frame.c[1], R: Math.sqrt(s.W * s.H) / 2, kind: 'quarter' as const })),
    ...V.map(v => ({ id: v.id, e: v.x, n: v.y, R: (v.r * Math.sqrt(Math.PI)) / 2, kind: 'village' as const, pop: v.pop }))];
  model = new SmokeModel((sim as any).pop, fire.fires, sites, H);
}, 300_000);
const townFires = () => fire.fires.map((f, i) => (f.group ? i : -1)).filter(i => i >= 0);
const update = (day: number, h: number) => { const c = W.conditions(day, h); model.update(day, h, c.windMs, c.windDirDeg, sunAltAt(day, h)); return c; };
/** lit as the fire system has it (fire.ts update: the sim's phase where a household drives the fire, else its schedule) */
const litAt = (day: number, h: number) => { const alt = sunAltAt(day, h); return (i: number) => { const f = fire.fires[i]; if (!f.group) return false; const s = model.lit[i]; return s >= 0 ? s === 1 : scheduleLit((f.sched ?? 'night') as any, h, alt, f.seed); }; };
const countLit = (day: number, h: number) => { update(day, h); const L = litAt(day, h); return townFires().filter(L).length; };

describe('the town\'s evening fires by hour (the people sim, D-220 → D-227)', () => {
  it('on day 14 (the old moment, a warm evening) the hearths are embers by dusk; on the new day they burn low until bedtime', () => {
    const rows: string[] = []; let best = { h: 0, n: -1 }, bestDark = { h: 0, n: -1 };
    const m = shot('town-smoke-dusk');
    for (const day of [14, m.day]) for (let h = 17; h <= 20.01; h += 1 / 12) { const n = countLit(day, h), alt = sunAltAt(day, h);
      if (day === m.day) { if (n > best.n) best = { h, n }; if (alt <= -4 && n >= bestDark.n) bestDark = { h, n }; }
      if (Math.round(h * 12) % 2 === 0) rows.push(`day ${day} ${h.toFixed(2)} h sun ${alt.toFixed(1)}° lit ${n}`); }
    console.log(rows.join('\n'));
    const old = countLit(14, 18.8); console.log(`old moment (day 14 18:48): ${old} town fires lit; new day ${m.day}: most ${best.n} at ${best.h.toFixed(2)} h, most with the sun ≤ −4°: ${bestDark.n} until ${bestDark.h.toFixed(2)} h`);
    expect(old).toBeLessThan(60);
    // the new moment: a calm, cool, dry evening (the fire kept low until bedtime), at the most fires lit in the dusk
    const c = W.conditions(m.day, m.hour), dw = W.days[m.day];
    expect(c.windMs).toBeLessThan(1.5); expect(dw.wet).toBeFalsy(); expect(dw.tmin).toBeLessThan(COLD_EVENING_C);
    expect(sunAltAt(m.day, m.hour)).toBeLessThan(-4); expect(sunAltAt(m.day, m.hour)).toBeGreaterThan(-8);
    const now = countLit(m.day, m.hour); expect(now).toBeGreaterThanOrEqual(0.95 * best.n); expect(now).toBeGreaterThan(800);
    expect(shot('town-smoke-dusk-rahmat')).toEqual(m);
    expect(m.hour).toBeGreaterThan(sunTimes(m.day).set);
  });
});

describe('what the moment cameras see of the fires (line of sight over the town, D-227)', () => {
  it('from the Terrace and Kuh-e Rahmat the courts\' walls hide every flame; seen from 300 m above, about half show', () => {
    const m = shot('town-smoke-dusk'); update(m.day, m.hour); const L = litAt(m.day, m.hour);
    const s0 = townFires()[0], q = town.plan.sites.find(s => s.id === 'q_s1')!;
    const top: Cam = { ...CAMS[0], n: 'overhead q_s1', e: q.frame.c[0], n_: q.frame.c[1] + 100, absY: H(q.frame.c[0], q.frame.c[1]) + 300, az: 161, pitch: -72, fov: 60 }; void s0;
    const out: Record<string, ReturnType<typeof viewStats>> = {};
    for (const cam of [...CAMS, top]) { const eye = new THREE.Vector3(cam.e, cam.absY ?? H(cam.e, cam.n_) + cam.eye, -cam.n_);
      const R = heightRaster(town.group, 0.5, /^settlement:/, frameClip(cam, eye, fire.fires));
      const isLit = (i: number) => (fire.fires[i].group ? L(i) : false);
      out[cam.n] = viewStats(R, T, cam, eye, fire.fires, isLit);
      const s = out[cam.n]; console.log(`${cam.n}: lit ${s.lit}, in frame ${s.inFrustum} at ${s.dMin.toFixed(0)}–${s.dMax.toFixed(0)} m (median ${s.dMed.toFixed(0)}); flames in sight ${s.flameSeen} (Σ ${s.flameSum.toFixed(2)} fire-candela); lit walls seen from ${s.glowFires} fires (Σ ${s.glowSum.toFixed(3)} fire-candela)`); }
    const t = out['town-smoke-dusk'], r = out['town-smoke-dusk-rahmat'], o = out['overhead q_s1'];
    expect(t.inFrustum).toBeGreaterThan(300); expect(r.inFrustum).toBeGreaterThan(300);
    expect(t.flameSeen / t.inFrustum).toBeLessThan(0.02); expect(r.flameSeen / r.inFrustum).toBeLessThan(0.02);
    // all their light on their courts' walls that the camera sees, summed over the town: under one fire's own candela
    expect(t.glowSum).toBeLessThan(1); expect(r.glowSum).toBeLessThan(1);
    expect(o.flameSeen / o.inFrustum).toBeGreaterThan(0.3); expect(o.glowSum / o.inFrustum).toBeGreaterThan(0.03); // the method sees them when they are to be seen
  }, 600_000);
  it('a hearth\'s light leaves its court upward by FIRE_ESCAPE_SR (±25 %); on the layer it is a few % of the skylight at the moment', () => {
    const m = shot('town-smoke-dusk'); update(m.day, m.hour); const L = litAt(m.day, m.hour);
    const q = town.plan.sites.find(s => s.id === 'q_s1')!, c = { x0: q.frame.c[0] - 200, x1: q.frame.c[0] + 200, z0: -q.frame.c[1] - 200, z1: -q.frame.c[1] + 200 };
    const R = heightRaster(town.group, 0.5, /^settlement:/, c);
    const inQ = townFires().filter(i => fire.fires[i].group === 'q_s1' && L(i)); let sr = 0; for (const i of inQ) sr += escapeSr(R, T, fire.fires[i].pos);
    const mean = sr / inQ.length; console.log(`q_s1: ${inQ.length} lit hearths, mean escaping solid angle ${mean.toFixed(2)} sr (FIRE_ESCAPE_SR ${FIRE_ESCAPE_SR})`);
    expect(inQ.length).toBeGreaterThan(50); expect(Math.abs(mean / FIRE_ESCAPE_SR - 1)).toBeLessThan(0.25);
    // the fire light on q_s1's layer from below against the layer's skylight (fire.ts smokeSkyRadiance: hemi E(1 + 0.25) / 2π)
    const lit = fire.fires.map((f, i) => ({ lit: L(i), kind: f.kind, group: f.group }));
    const sum = model.setFireLight(lit, k => fireLight(k as FireKind).candela), cell = model.cells.find(x => x.id === 'q_s1')!;
    const alt = sunAltAt(m.day, m.hour), skyL = (skyLux(alt) + NIGHT_LUX) * (1 - 0.3 * 0.05), gain = skyGain(skyL * REN_PER_LUX_SKY * 0.8, skyL, skyL), hemiI = gain * skyL * REN_PER_LUX_SKY, fs = fireLightScale(gain); // (skySystem.ts: hemi intensity = gain × the sky's renderer units)
    const G = 0.6, pSide = (1 - G * G) / (4 * Math.PI) / Math.pow(1 + G * G, 1.5), skyRad = (hemiI * 1.25) / (2 * Math.PI);
    const ratio = (cell.fireE! * fs * pSide) / skyRad;
    console.log(`q_s1 at ${m.hour} h (sun ${alt.toFixed(1)}°): Σ lit candela ${sum.get('q_s1')?.toFixed(0)}, fire irradiance on the layer ${cell.fireE!.toExponential(2)} (fire scale 1) × scale ${fs.toExponential(2)}; its in-scatter / the skylight's = ${(100 * ratio).toFixed(2)} %`);
    expect(cell.fireE!).toBeGreaterThan(0); expect(ratio).toBeGreaterThan(0); expect(ratio).toBeLessThan(0.5);
    // through the dusk (the same fires; the sky darkens and the eye's gain rises)
    const rows: string[] = [];
    for (const h of [18.8, 18.9, 19.0, 19.1, 19.2, 19.25]) { update(m.day, h); const L2 = litAt(m.day, h); model.setFireLight(fire.fires.map((f, i) => ({ lit: L2(i), kind: f.kind, group: f.group })), k => fireLight(k as FireKind).candela);
      const cl = model.cells.find(x => x.id === 'q_s1')!, a = sunAltAt(m.day, h), sl = (skyLux(a) + NIGHT_LUX) * (1 - 0.3 * 0.05), g2 = skyGain(sl * REN_PER_LUX_SKY * 0.8, sl, sl), hi = g2 * sl * REN_PER_LUX_SKY, f2 = fireLightScale(g2);
      rows.push(`${h.toFixed(2)} h sun ${a.toFixed(1)}° (sky ${sl.toFixed(2)} lx): fire in-scatter / sky ${((100 * cl.fireE! * f2 * pSide) / ((hi * 1.25) / (2 * Math.PI))).toFixed(1)} %, q_s1 σ ${cl.sigma.toExponential(2)}`); }
    console.log(rows.join('\n'));
  }, 600_000);
});

describe('the smoke layer at the new moment (D-220 test carried to D-227)', () => {
  const ray = (cells: SmokeCell[], e: number, n: number, y: number, te: number, tn: number, ty: number) => {
    const o: [number, number, number] = [e, y, -n], d = [te - e, ty - y, -tn + n], L = Math.hypot(d[0], d[1], d[2]);
    return cells.reduce((s, c) => s + cellTau(c, o, [d[0] / L, d[1] / L, d[2] / L]), 0);
  };
  it('still reads from the Terrace over the S quarters (τ ≥ 0.1) and from Kuh-e Rahmat (τ ≥ 0.05)', () => {
    const m = shot('town-smoke-dusk'); const rows: string[] = [];
    for (const [day, h] of [[14, 18.8], [m.day, m.hour - 0.25], [m.day, m.hour], [m.day, m.hour + 0.25]] as [number, number][]) { update(day, h);
      const tD = ray(model.cells, -50.5, -120, 1.6, -900, -1300, H(-900, -1300) + 4), yR = H(380, -60) + 1.6, tR = Math.max(ray(model.cells, 380, -60, yR, -935, -95, H(-935, -95) + 4), ray(model.cells, 380, -60, yR, -815, -1095, H(-815, -1095) + 4));
      rows.push(`day ${day} ${h.toFixed(2)} h: τ Terrace→S ${tD.toFixed(3)}, Rahmat→W/S ${tR.toFixed(3)}`);
      if (day === m.day && h === m.hour) { expect(tD).toBeGreaterThan(0.1); expect(tR).toBeGreaterThan(0.05); } }
    console.log(rows.join('\n'));
  });
});
