import { describe, it, expect } from 'vitest';
import { accessZoneAt, terraceZoneAt, indexTown, decide, businessZones, ZONES, ROW_ZONE, ERRAND, VisitorCtx } from '../src/world/visitor/access';
import { buildTownPlan } from '../src/world/settlement/plan';
import places from '../src/data/people_places.json';
import plots from '../src/data/town_plots.json';

// visitor mode (D-100 … D-104; research/ACCESS.md): zones and rules from src/data/access.json
const P = (id: string) => (places as any).places.find((p: any) => p.id === id).at as [number, number];
const plot = (id: string) => (plots as any).plots.find((p: any) => p.id === id);
describe('visitor access zones', () => {
  const town = indexTown(buildTownPlan() as any);
  it('every town-element row of the built town maps to an access zone', () => {
    const rows = new Set(((plots as any).plots as any[]).map(p => p.row));
    for (const r of rows) expect(ROW_ZONE[r], r).toBeTruthy();
    for (const z of Object.values(ROW_ZONE)) expect(ZONES.has(z), z).toBe(true);
  });
  it('places on the Terrace fall in the zones the research names', () => {
    expect(terraceZoneAt(...P('gate_hall'))).toBe('gate_nations');
    expect(terraceZoneAt(-28, 121.5)).toBe('grand_stair'); // the landing at the stair heads, before the Gate's W door
    expect(terraceZoneAt(...P('forecourt'))).toBe('terrace_courts');
    expect(terraceZoneAt(...P('treasury_desk'))).toBe('treasury_desk');
    expect(terraceZoneAt(...P('post_treas_1'))).toBe('treasury_street');
    expect(terraceZoneAt(1.9, -4.9)).toBe('apadana');
    expect(accessZoneAt(...P('stair_foot'), town)).toBe('stair_foot');
    expect(accessZoneAt(-300, 120, town)).toBe('plain_approach');
  });
  it('town plots fall in their zones; the errand places are where the errand says', () => {
    for (const [id, zone] of [['stores-0001', 'town_stores'], ['stables-0001', 'town_stables'], ['official-0001', 'official_court'], ['waystation-0001', 'waystation'], ['q_s1-0001', 'town_houses']] as const)
      expect(accessZoneAt(...(plot(id).c as [number, number]), town), id).toBe(zone);
    for (const s of ERRAND.steps) expect(ZONES.has(s.zone), `step ${s.n}`).toBe(true);
  });
  it('rules: open ground is free; the Gate asks for the halmi and business; courts need an escort; palaces are closed', () => {
    const ctx = (o: Partial<VisitorCtx> = {}): VisitorCtx => ({ night: false, court: false, admitted: new Set(), business: new Set(), escorted: false, recognised: false, ...o });
    expect(decide('stair_foot', ctx()).allowed).toBe(true);
    expect(decide('grand_stair', ctx()).allowed).toBe(true);
    expect(decide('grand_stair', ctx({ night: true })).allowed).toBe(false);
    expect(decide('gate_nations', ctx()).needs).toBe('never'); // no business there
    const gate = businessZones(3); expect(gate.has('gate_nations')).toBe(true);
    expect(decide('gate_nations', ctx({ business: gate })).needs).toBe('halmi');
    expect(decide('gate_nations', ctx({ business: gate, admitted: new Set(['gate_nations']) })).allowed).toBe(true);
    expect(decide('terrace_courts', ctx()).needs).toBe('escort');
    expect(decide('terrace_courts', ctx({ escorted: true })).allowed).toBe(true);
    expect(decide('apadana', ctx({ escorted: true })).allowed).toBe(false);
    expect(decide('town_houses', ctx()).allowed).toBe(false);
    expect(decide('town_lanes', ctx()).allowed).toBe(true);
    // recognised on the next day with the same errand: the courts relax to business (recognition rules, C)
    expect(decide('terrace_courts', ctx({ recognised: true, business: businessZones(4) })).allowed).toBe(true);
  });
});
