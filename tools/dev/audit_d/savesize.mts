import { readFileSync } from 'node:fs';
process.chdir('/home/user/fars');
const { NavGrid } = await import('/home/user/fars/src/people/navgrid');
const { PeopleSim } = await import('/home/user/fars/src/people/sim');
const { WeatherSystem } = await import('/home/user/fars/src/weather/weatherState');
const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const W = new WeatherSystem(1);
const env = (t: number) => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
for (const court of [false, true]) {
  const t0 = performance.now(); const sim: any = new PeopleSim(1, nav, env, { court }); const tb = performance.now() - t0;
  const s = JSON.stringify(sim.save());
  console.log(`court ${court}: persons ${sim.pop.persons.length}, detailed agents ${sim.agents.length}; build ${(tb / 1000).toFixed(1)} s; save JSON ${(s.length / 1048576).toFixed(2)} MB (UTF-16 in localStorage: ${(2 * s.length / 1048576).toFixed(2)} MB; Chrome's quota ~5 M chars)`);
}
