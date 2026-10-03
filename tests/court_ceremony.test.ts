// D-780 (holes #10, #14, #18; UD-09, UD-10, UD-29): the court's recurring events as simulation (people/ceremony.ts, court.ts):
// the programme over a residence, the people who take part on its days (from their own plans), the banquet's seats on the
// Apadana's walkable floor and clear of its laid tables, and the court's dyed dress.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim } from '../src/people/sim';
import { courtYear } from '../src/people/courtYear';
import { courtProgramme, courtSetDays, isRideDay, FEAST_SEATS, FEAST_TABLES, type CeremonyKind } from '../src/people/ceremony';
import { buildTerrace } from '../src/arch/terrace';
import { palaceFurnishingPlan } from '../src/world/furnish_palaces';
import type { Column } from '../src/arch/parts';
import sources from '../src/data/sources.json';
import courtJson from '../src/data/court.json';

const nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
const env = () => ({ rain: 0, lightning: false, windMs: 2, tempC: 18, dust: 0 });

describe('the court’s programme (ceremony.ts)', () => {
  it('every kind of event happens in a residence, inside it, on the right days; deterministic; sources resolve', () => {
    for (const seed of [1, 2, 7]) {
      const Y = courtYear(seed), SD = courtSetDays(seed), kinds = new Map<CeremonyKind, number>();
      for (let d = 0; d < 354; d++) for (const e of courtProgramme(seed, d)) { kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + 1); expect(d >= Y.arrive && d <= Y.leave, `${e.kind} on day ${d}`).toBe(true); expect(e.t1).toBeGreaterThan(e.t0);
        for (const k of e.src.split(';')) expect((sources as any)[k], `${e.kind}: ${k}`).toBeTruthy(); }
      for (const k of ['audience', 'gift_day', 'king_gifts', 'birthday', 'banquet', 'ride', 'hunt', 'guard_change', 'dawn_rite', 'exercise', 'courier'] as CeremonyKind[]) expect(kinds.get(k) ?? 0, `${k} (seed ${seed})`).toBeGreaterThan(0);
      expect(SD.gift.length).toBeGreaterThanOrEqual(5); expect(SD.hunt.length).toBeGreaterThanOrEqual(6); expect(SD.banquet.size).toBeGreaterThanOrEqual(15);
      for (const g of SD.gift) { expect(SD.hunt).not.toContain(g); expect(SD.banquet.has(g)).toBe(true); }
      // a player who walks the Terrace on any day of the residence meets an audience, a ride, a hunt or the gifts most mornings
      let busy = 0; for (let d = Y.arrive + 1; d < Y.leave; d++) if (courtProgramme(seed, d).some(e => ['audience', 'gift_day', 'ride', 'hunt', 'king_gifts', 'birthday'].includes(e.kind))) busy++;
      expect(busy / (Y.leave - Y.arrive - 1)).toBeGreaterThan(0.7);
    }
    expect(JSON.stringify(courtProgramme(3, courtYear(3).arrive + 9))).toBe(JSON.stringify(courtProgramme(3, courtYear(3).arrive + 9)));
    for (const k of String((courtJson as any).ceremony.src).split(';')) expect((sources as any)[k], k).toBeTruthy();
  });
  it('the banquet’s seats are on the Apadana’s walkable floor, clear of the column bases and of the laid tables, facing their table', () => {
    const { parts, manifest, doorways } = buildTerrace(), plan = palaceFurnishingPlan(parts, manifest, doorways);
    const cols = parts.filter((p): p is Column => p.type === 'column' && p.building === 'apadana');
    const solid = plan.filter(it => it.state === 'use' && it.building === 'apadana' && it.solid);
    expect(FEAST_SEATS.length).toBeGreaterThan(250); expect(FEAST_TABLES.length).toBe(solid.filter(it => it.kind === 'table').length);
    for (const s of FEAST_SEATS) {
      expect(nav.walkable(s.at[0], s.at[1]) || !!nav.snap(s.at[0], s.at[1], 0.4), `seat ${s.at}`).toBe(true);
      for (const c of cols) expect(Math.max(Math.abs(c.c[0] - s.at[0]), Math.abs(c.c[1] - s.at[1])) - c.order.baseW / 2, `seat ${s.at} by a column`).toBeGreaterThan(0.25);
      for (const it of solid) { const dx = Math.abs(s.at[0] - it.e), dy = Math.abs(s.at[1] - it.n); expect(dx < it.hu + 0.2 && dy < it.hv + 0.2, `seat ${s.at} in a ${it.kind}`).toBe(false); }
      const toT = Math.atan2(s.table[0] - s.at[0], s.table[1] - s.at[1]) * 180 / Math.PI; expect(Math.abs(((s.heading - toT) % 360 + 540) % 360 - 180)).toBeLessThan(1);
    }
  });
});

describe('the court’s people take part (court.ts plans on the programme’s days)', () => {
  let sim: any, pop: any, K: any; const seed = 1;
  beforeAll(() => { sim = new PeopleSim(seed, nav, env as any, { court: true } as any); pop = sim.pop; K = pop.court; }, 120_000);
  const whys = (d: number, rx: RegExp) => { const who = new Set<number>(); for (let pid = K.first; pid < K.end; pid++) { if (!pop.present(pid, d)) continue; for (const s of pop.plan(pid, d)) if (rx.test(s.why)) { who.add(pid); break; } } return who; };
  it('a day of the peoples’ gifts: the delegations go up in file behind their ushers, the leaders bow, the chiliarch stands before the king, the Persians of rank attend; a banquet at night', () => {
    const d = courtSetDays(seed).gift[0];
    expect(whys(d, /up the Apadana’s stair in file|leading the gift animals/).size).toBeGreaterThan(60);
    const bows = whys(d, /bowing low before the king/).size; expect(bows).toBeGreaterThan(5);
    expect(whys(d, /usher leading/).size).toBeGreaterThanOrEqual(Math.min(bows, 10));
    expect(whys(d, /chiliarch standing before the throne/).size).toBe(1);
    expect(whys(d, /^enthroned/).size).toBe(1);
    expect(whys(d, /standing in the Apadana’s N portico/).size).toBeGreaterThan(150);
    expect(whys(d, /at the king’s banquet in the Apadana/).size).toBeGreaterThan(200);
    expect(whys(d, /over the Terrace (from the king’s kitchens )?to the (king’s )?banquet/).size).toBeGreaterThan(50);
  }, 120_000);
  it('a hunt and a ride: the king, his escort, Persians of rank and grooms on horseback; beaters on foot for the hunt; couriers ride in every day', () => {
    const SD = courtSetDays(seed), h = SD.hunt.find((d: number) => K.kingOut(d) === 'hunt')!;
    expect(whys(h, /on horseback/).size).toBeGreaterThan(40); expect(whys(h, /beating the reeds/).size).toBeGreaterThan(40);
    let r = -1; for (let d = courtYear(seed).arrive + 2; d < courtYear(seed).leave; d++) if (isRideDay(seed, d) && K.kingOut(d) === 'ride') { r = d; break; }
    expect(r).toBeGreaterThan(0); expect(whys(r, /on horseback/).size).toBeGreaterThan(15);
    expect(whys(r, /exercising a horse/).size).toBeGreaterThan(200);
    expect(K.couriers.length).toBeGreaterThan(200); expect(whys(r, /courier riding/).size).toBeGreaterThanOrEqual(2);
  }, 120_000);
  it('every plan of a court person on the programme’s days is contiguous and ends the day', () => {
    const SD = courtSetDays(seed), days = [SD.kingGifts, SD.gift[0], SD.hunt[0], SD.birthday];
    for (const d of days) for (let pid = K.first; pid < K.end; pid += 7) { if (!pop.present(pid, d)) continue; const P = pop.plan(pid, d);
      let t = 0; for (const s of P) { expect(s.t0, `pid ${pid} day ${d}: ${s.why}`).toBeCloseTo(t, 6); expect(s.t1).toBeGreaterThan(s.t0); t = s.t1; } expect(t).toBeCloseTo(24, 6); }
  }, 120_000);
});
