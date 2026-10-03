// s18 C15 (D-800): the elite estates, the garden pavilion and the Dasht-e Gohar hall as porticoed, painted buildings
import { describe, it, expect } from 'vitest';
import { buildTownPlan } from '../src/world/settlement/plan';
import { EST } from '../src/world/settlement/estates';

describe('the elite architecture of the plain (D-800)', () => {
  const plan = buildTownPlan();
  it('each estate has its garden porch, its talar and its gate piers, standing as column fittings (colliders, far level)', () => {
    const es = plan.sites.filter(s => s.id.startsWith('estate_')); expect(es.length).toBe(4);
    for (const s of es) { expect(s.fittings.filter(f => f.kind === 'column').length, s.id).toBe(9 + 4 + 2); expect(s.fittings.filter(f => f.kind === 'channel').length, s.id).toBe(4);
      expect(s.fittings.filter(f => f.kind === 'pool').length, s.id).toBe(1); }
    const P = plan.props.filter(p => p.group === 'estates');
    expect(P.filter(p => p.mat === 'glaze').length, 'the glazed friezes').toBeGreaterThan(4 * 50);
    expect(P.filter(p => p.colour && p.colour.join() === EST.shaft.join()).length, 'painted shafts').toBe(4 * 13);
    expect(P.every(p => p.mat !== 'stone' && !p.collide), 'one mud batch, colliders from the fittings').toBe(true);
  });
  it('the pavilion and the hall are porticoed and painted, not mud boxes', () => {
    for (const g of ['pavilion', 'hall_gohar']) { const P = plan.props.filter(p => p.group === g);
      expect(P.filter(p => p.colour && p.colour.join() === EST.shaft.join()).length, g).toBe(g === 'pavilion' ? 8 : 20);
      expect(P.some(p => p.mat === 'glaze'), g).toBe(true); expect(P.filter(p => p.colour?.join() === EST.white.join()).length, g).toBeGreaterThan(2);
      expect(P.filter(p => p.collide).length, g).toBeGreaterThan(8); }
  });
});
