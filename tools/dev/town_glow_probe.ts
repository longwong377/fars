// D-227 probe (tools; node): how much of the town's evening fire light a camera on the Terrace or Kuh-e Rahmat can see.
// Builds the real town (settlement build.ts, with its FireSystem), the people sim and the smoke model, rasterises the
// town's up-facing surfaces into a 0.5 m max-height grid, and for each lit fire at the moment's hour measures
//   (1) whether its flame is in line of sight of the camera (three points up the flame),
//   (2) what its light on the courtyard walls sends toward the camera: rays from the fire over the sphere find the wall
//       they light; each wall patch the camera sees adds ρ/π · dω · cos θ_view candela per candela of the fire (a Lambertian
//       wall lit by a point source: L·A = ρ I dω / π, independent of the wall's distance from the fire),
// and the lit fires by hour on a day. Usage: npx tsx tools/dev/town_glow_probe.ts [day] [hour]   (MODE=scan: calm dusks)
import { readFileSync } from 'node:fs';
import * as THREE from 'three/webgpu';
import { NavGrid } from '../../src/people/navgrid';
import { PeopleSim, type Env } from '../../src/people/sim';
import { WeatherSystem } from '../../src/weather/weatherState';
import { FireSystem, scheduleLit } from '../../src/world/fire';
import { Settlement } from '../../src/world/settlement/build';
import { SmokeModel, type SmokeSite } from '../../src/world/hearthSmoke';
import { loadTerrain } from '../../tests/plainLib';
import { sunTimes } from '../../src/people/calendar';
import { sunAltAt, heightRaster, CAMS, viewStats, frameClip } from '../../tests/lib/townLos';

const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
const mode = process.env.MODE ?? 'probe';
if (mode === 'scan') {
  // calm, clear dusks with a cool night (the evening fire kept low until bedtime: hearthSmoke.ts COLD_EVENING_C)
  const rows: string[] = [];
  for (let d = 0; d < 360; d++) { const s = sunTimes(d).set, h = s + 0.35, c = W.conditions(d, h), day = W.days[d];
    if (c.windMs <= 1.5 && c.cloud < 0.3 && c.rain === 0 && !day.wet) rows.push(`day ${d} set ${s.toFixed(2)} wind ${c.windMs.toFixed(2)} cloud ${c.cloud.toFixed(2)} tmin ${day.tmin.toFixed(1)} ${day.tmin < 8 ? 'COOL' : ''}`); }
  console.log(rows.join('\n'));
  process.exit(0);
}
const DAY = +(process.argv[2] ?? 14), HOUR = process.argv[3] ? +process.argv[3] : NaN;
const sim = new PeopleSim(1, new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8'))), env);
const P = (sim as any).pop; const T = loadTerrain(), H = (e: number, n: number) => T.heightAt(e, -n);
const fire = new FireSystem(0); const town = new Settlement(null, T, fire, 'test');
const sites: SmokeSite[] = town.plan.sites.map((s: any) => ({ id: s.id, e: s.frame.c[0], n: s.frame.c[1], R: Math.sqrt(s.W * s.H) / 2, kind: 'quarter' as const }));
const model = new SmokeModel(P, fire.fires, sites, H);
const set = sunTimes(DAY).set; console.log(`day ${DAY}: sunset ${set.toFixed(3)} h, tmin ${W.days[DAY].tmin.toFixed(1)} °C`);
// lit fires by hour (the town's fires the households drive, and all the town's fires)
const townIdx = fire.fires.map((f, i) => (f.group ? i : -1)).filter(i => i >= 0);
for (let h = 16.5; h <= 21.51; h += 1 / 6) { const c = W.conditions(DAY, h); model.update(DAY, h, c.windMs, c.windDirDeg, sunAltAt(DAY, h));
  let lit = 0, drv = 0, smoke = 0; for (const i of townIdx) { if (model.lit[i] === 1) lit++; if (model.lit[i] >= 0) drv++; if (model.gh[i] > 0) smoke++; }
  console.log(`  ${Math.floor(h)}:${String(Math.round((h % 1) * 60)).padStart(2, '0')} sun ${sunAltAt(DAY, h).toFixed(1)}° wind ${c.windMs.toFixed(2)} flaming ${lit}/${drv} smoking ${smoke}`); }
// line of sight (the household fires the sim drives, and the fires on their own schedules: the compounds' court hearths,
// the precinct's kept fire, workshops)
const ONLY_TOP = !!process.env.TOP; const ALT = process.env.ALT ? [0, 1, 2].map(k => ({ ...CAMS[1], n: `rahmat+${k * 100}m-e`, e: 380 + k * 100 })) : [];
const TOP = { ...CAMS[0], n: 'sanity: 300 m over q_s1 looking down', e: sites[0].e, n_: sites[0].n + 100, absY: H(sites[0].e, sites[0].n) + 300, az: 161, pitch: -72, fov: 60 };
for (const cam of ONLY_TOP ? [TOP] : [...CAMS, ...ALT, TOP]) {
  const h = Number.isFinite(HOUR) ? HOUR : cam.hour, c = W.conditions(DAY, h), alt = sunAltAt(DAY, h); model.update(DAY, h, c.windMs, c.windDirDeg, alt);
  const eye = new THREE.Vector3(cam.e, cam.absY ?? H(cam.e, cam.n_) + cam.eye, -cam.n_);
  const isLit = (i: number) => { const f = fire.fires[i]; if (!f.group) return false; const sl = model.lit[i]; return sl >= 0 ? sl === 1 : scheduleLit((f.sched ?? 'night') as any, h, alt, f.seed); };
  const R = heightRaster(town.group, 0.5, /^settlement:/, frameClip(cam, eye, fire.fires as any));
  const s = viewStats(R, T, cam, eye, fire.fires as any, isLit);
  console.log(`${cam.n} @ ${h.toFixed(2)} h (sun ${alt.toFixed(1)}°): eye y ${eye.y.toFixed(1)}, raster ${R.nx}×${R.nz}; lit town fires ${s.lit}, in frame ${s.inFrustum} (${s.dMin.toFixed(0)}–${s.dMax.toFixed(0)} m, median ${s.dMed.toFixed(0)}); flame in sight ${s.flameSeen} (${s.inFrustum ? ((100 * s.flameSeen) / s.inFrustum).toFixed(1) : 0} %), Σ flame ${s.flameSum.toFixed(2)} I; lit walls seen from ${s.glowFires} fires, Σ ${s.glowSum.toFixed(3)} I; by kind ${JSON.stringify(s.byKind)}`);
}
