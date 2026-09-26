// dev (session 9): the planets' year over Pārsa: close pairings (≤ 2°) of two planets or a planet and the Moon, seen with the sun
// ≥ 8° down and both ≥ 8° up, at dusk and dawn. Usage: npx tsx tools/dev/planets_467.ts
import * as A from 'astronomy-engine';
import { WorldClock } from '../../src/core/clock';
import { planetsAt } from '../../src/sky/planets';
import { sunHorizon, moonHorizon } from '../../src/sky/ephemeris';
const sep = (a: { az: number; alt: number }, b: { az: number; alt: number }) => { const r = Math.PI / 180, c = Math.sin(a.alt * r) * Math.sin(b.alt * r) + Math.cos(a.alt * r) * Math.cos(b.alt * r) * Math.cos((a.az - b.az) * r); return Math.acos(Math.min(1, c)) / r; };
for (let d = 0; d < 354; d++) for (let h = 17; h < 30; h += 0.25) { const c = new WorldClock(d + Math.floor(h / 24), h % 24), jd = c.jdUT; if (sunHorizon(jd).altitude > -8) continue;
  const P = planetsAt(jd).filter(p => p.alt > 8); const mo = moonHorizon(jd);
  for (let i = 0; i < P.length; i++) { for (let j = i + 1; j < P.length; j++) { const s = sep(P[i], P[j]); if (s < 2) { console.log(`day ${d + Math.floor(h / 24)} ${(h % 24).toFixed(2)}h: ${P[i].name} and ${P[j].name} ${s.toFixed(2)}° apart, alt ${P[i].alt.toFixed(0)}°, az ${P[i].az.toFixed(0)}°`); h += 3; } }
    if (mo.altitude > 8) { const s = sep(P[i], { az: mo.azimuth, alt: mo.altitude }); if (s < 2) { console.log(`day ${d + Math.floor(h / 24)} ${(h % 24).toFixed(2)}h: the Moon and ${P[i].name} ${s.toFixed(2)}° apart, alt ${mo.altitude.toFixed(0)}°, az ${mo.azimuth.toFixed(0)}°`); h += 3; } } } }
void A;
