// Writes src/data/town_plots.json: every plot the town generator builds (src/world/settlement/plan.ts), as house plots
// for the population simulation (brief §9.2 "every NPC has a home"). Deterministic; tests/settlement.test.ts fails when
// the file is stale. Run: npx tsx tools/build_town.ts
import { writeFileSync, readFileSync } from 'node:fs';
import { buildTownPlan, plotRows, siteExits, TOWN_SEED } from '../src/world/settlement/plan';
import { HOUSE, HOUSE_BASIS } from '../src/world/settlement/town_rules';

export function townPlotsJson(): string {
  const plan = buildTownPlan(); const rows = plotRows(plan);
  const pop = JSON.parse(readFileSync('src/data/population.json', 'utf8'));
  const town = pop.zones.find((z: any) => z.id === 'town');
  const byZone: Record<string, { plots: number; homes: number; capacity: number }> = {};
  for (const r of rows) { const k = `${r.pop_zone}:${r.zone}`; byZone[k] ??= { plots: 0, homes: 0, capacity: 0 }; byZone[k].plots++; if (r.capacity > 0) byZone[k].homes++; byZone[k].capacity += r.capacity; }
  const cap = (z: string) => rows.filter(r => r.pop_zone === z).reduce((a, r) => a + r.capacity, 0);
  const meta = {
    title: 'House plots of the Persepolis settlement, 467 BCE (Phase 6 build): homes for the population simulation',
    generator: `src/world/settlement/plan.ts (seed ${TOWN_SEED}); written by tools/build_town.ts`,
    tier: 'C', basis: HOUSE_BASIS, capacity_rule: `houses: rooms (m²) / ${HOUSE.m2PerPerson}, 3-10 (large 6-16); workshops keep a family (2-6); elite estates 25; official building 60; way-station 12; stores 6; stable 8; yards, pens and gardens 0 (all C)`,
    frame: 'grid metres (x = grid east, y = grid north; world x = e, z = -n), D-002',
    sites_doc: 'per site: centre, rotation (deg CCW from grid east), raster size, and exits = where its lanes open onto the plain (join points for a future town walkable grid)',
    fields: 'id; site (quarter or compound); zone (settlement.json feature); pop_zone (population.json zone: town | plain); kind (house, house_large, workshop, elite, official, store, stable, station, yard, pen, garden, craft_area); craft (workshops); c = plot centre; door = the lane/open-ground point just outside the street door (walkable; NPC routes can end here); door_in = just inside the door; area_m2, roofed_m2; capacity = people it can house; row = settlement.json town_elements row (basis, sources)',
    target: { town_night_court_absent: town?.court_absent?.night?.spring ?? null, src: 'src/data/population.json zones.town (C derivation)' },
    capacity: { town: cap('town'), plain: cap('plain'), total: cap('town') + cap('plain') },
    by_zone: byZone,
    homes: rows.filter(r => r.capacity > 0).length, plots: rows.length,
    sites: plan.sites.map(s => ({ id: s.id, kind: s.meta.kind, zone: s.meta.zone, c: s.frame.c.map(x => Math.round(x * 10) / 10), theta_deg: Math.round(s.frame.theta * 1800 / Math.PI) / 10, size_m: [s.W, s.H], exits: siteExits(s) })),
  };
  return '{\n "_meta": ' + JSON.stringify(meta, null, 1).replace(/\n/g, '\n ') + ',\n "plots": [\n' + rows.map(r => '  ' + JSON.stringify(r)).join(',\n') + '\n ]\n}\n';
}
if (process.argv[1]?.endsWith('build_town.ts')) {
  const s = townPlotsJson(); writeFileSync('src/data/town_plots.json', s);
  const m = JSON.parse(s)._meta; console.log(`town_plots.json: ${m.plots} plots, ${m.homes} homes, capacity town ${m.capacity.town}, plain ${m.capacity.plain}`);
}
