import { WeatherSystem } from '../../../src/weather/weatherState';
process.chdir('/home/user/fars');
const W = new WeatherSystem(1); const out: string[] = [];
for (let d = 0; d < 354; d++) { let r = 0, hrs = 0; for (let h = 8; h < 16; h += 0.5) { const c = W.conditions(d, h); if (c.rain > 0.2) { hrs += 0.5; r = Math.max(r, c.rain); } } if (hrs >= 4) out.push(`${d}:${hrs}h max${r.toFixed(2)} t${W.conditions(d,12).tempC.toFixed(0)}`); }
console.log(out.join(' '));
