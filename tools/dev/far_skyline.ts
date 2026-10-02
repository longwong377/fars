// D-600: does the terrain's end (the far ring's edge, ±71,680 m) ever stand in the skyline? From walkable eyes (the coverage
// points, and the highest summits within reach), for every azimuth (0.5 deg), the skyline's elevation (apparent heights:
// curvature and refraction included, as drawn) and whether its highest point is the ring's last sample (a cut against the
// sky) or within 1 px of it (1080 px over 60 deg).
// Usage: npx tsx tools/dev/far_skyline.ts [--every=N]
import { readFileSync } from 'node:fs';
import { loadTerrain } from '../../tests/plainLib';
const T = loadTerrain(), F = T.far, HALF = F.half, PX = (60 * Math.PI) / 180 / 1080;
const every = +(process.argv.find(a => a.startsWith('--every='))?.slice(8) ?? 5);
const pts: any[] = JSON.parse(readFileSync('tests/data/coverage_points.json', 'utf8')).points.filter((_: unknown, i: number) => i % every === 0);
// plus the highest ground within 8 km of the Terrace (a walker can climb any slope under 42 deg)
let top = { x: 0, z: 0, h: -1e9 }; for (let x = -8000; x <= 8000; x += 64) for (let z = -8000; z <= 8000; z += 64) { const h = T.surfaceAt(x, z); if (h > top.h) top = { x, z, h }; }
const eyes = [...pts.map(p => ({ id: p.id, x: p.e, z: -p.n, y: (p.area === 'terrace' ? Math.max(0, T.surfaceAt(p.e, -p.n)) : T.surfaceAt(p.e, -p.n)) + (p.eye ?? 1.6) })), { id: 'summit<8km', x: top.x, z: top.z, y: top.h + 1.6 }];
let cuts = 0, near1 = 0, rays = 0, maxPx = 0, maxAt = ''; const worst: string[] = [];
for (const E of eyes) {
  let eyeCuts = 0;
  for (let a = 0; a < 360; a += 0.5) { const dx = Math.sin((a * Math.PI) / 180), dz = -Math.cos((a * Math.PI) / 180); rays++;
    // march to the ring's edge (Chebyshev) in 40 m steps, then the edge sample itself
    const tEdge = Math.min((HALF - 1 - Math.sign(dx) * E.x) / Math.max(1e-9, Math.abs(dx)), (HALF - 1 - Math.sign(dz) * E.z) / Math.max(1e-9, Math.abs(dz)));
    let best = -Infinity;
    for (let t = 40; t < tEdge - 80; t += t < 4000 ? 40 : 80) { const h = T.surfaceAt(E.x + dx * t, E.z + dz * t); best = Math.max(best, Math.atan2(h - E.y, t)); }
    const he = T.surfaceAt(E.x + dx * tEdge, E.z + dz * tEdge), ee = Math.atan2(he - E.y, tEdge);
    if (ee > best) { cuts++; eyeCuts++; if ((ee - best) / PX > maxPx) { maxPx = (ee - best) / PX; maxAt = `${E.id} az ${a}`; } if (worst.length < 12) worst.push(`${E.id} az ${a}: edge at ${(tEdge / 1000).toFixed(1)} km stands ${((ee - best) / PX).toFixed(1)} px above the nearer skyline`); }
    else if (ee > best - PX) near1++;
  }
  if (eyeCuts) console.log(`${E.id} (${E.x.toFixed(0)}, ${(-E.z).toFixed(0)}, y ${E.y.toFixed(0)}): ${eyeCuts} of 720 azimuths end at the ring's edge`);
}
console.log(`${eyes.length} eyes, ${rays} rays: the ring's edge IS the skyline on ${cuts} (by at most ${maxPx.toFixed(2)} px, ${maxAt}), within 1 px of it on ${near1}`); worst.forEach(w => console.log('  ' + w));
