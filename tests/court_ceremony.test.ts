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
import { RECLINE } from '../src/people/workAnims';
import { pose } from '../src/people/anim';
import { decodeHumanAssets } from '../src/people/humanAssets';
import { RigSolver, PALETTE_STRIDE, skinPoint, type RigInput } from '../src/people/humanRig';
import { PART } from '../src/people/humanFormat';

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
      const toT = Math.atan2(s.table[0] - s.at[0], s.table[1] - s.at[1]) * 180 / Math.PI; expect(Math.abs(((s.heading - toT) % 360 + 540) % 360 - 180)).toBeLessThan(s.couch ? 25 : 1);
      if (!s.couch) continue;
      // a couch (workAnims RECLINE, in the diner's frame: x left, z ahead) clear of its table, of the columns and of every other couch
      const h = s.heading * Math.PI / 180, f = [Math.sin(h), Math.cos(h)], lt = [-Math.cos(h), Math.sin(h)], corners: number[][] = [];
      for (const x of [RECLINE.x0, RECLINE.x1]) for (const z of [-RECLINE.w / 2, RECLINE.w / 2]) corners.push([s.at[0] + x * lt[0] + z * f[0], s.at[1] + x * lt[1] + z * f[1]]);
      const lo = [Math.min(...corners.map(c => c[0])), Math.min(...corners.map(c => c[1]))], hi = [Math.max(...corners.map(c => c[0])), Math.max(...corners.map(c => c[1]))];
      for (const it of solid) expect(lo[0] < it.e + it.hu + 0.05 && hi[0] > it.e - it.hu - 0.05 && lo[1] < it.n + it.hv + 0.05 && hi[1] > it.n - it.hv - 0.05, `couch at ${s.at} in a ${it.kind}`).toBe(false);
      for (const c of cols) expect(lo[0] < c.c[0] + c.order.baseW / 2 + 0.2 && hi[0] > c.c[0] - c.order.baseW / 2 - 0.2 && lo[1] < c.c[1] + c.order.baseW / 2 + 0.2 && hi[1] > c.c[1] - c.order.baseW / 2 - 0.2, `couch at ${s.at} by a column`).toBe(false);
    }
    const couches = FEAST_SEATS.filter(s => s.couch); expect(couches.length).toBe(2 * (courtJson as any).ceremony.banquet.couch_tables);
    for (const a of couches) for (const b of couches) if (a !== b) expect(Math.abs(a.at[0] - b.at[0]) > 2.2 || Math.abs(a.at[1] - b.at[1]) > 0.9, `couches at ${a.at} and ${b.at}`).toBe(true);
    // the couches are the first seats: the top ranks recline nearest the throne
    expect(FEAST_SEATS.slice(0, couches.length).every(s => s.couch)).toBe(true);
  });
  it('the reclining diner lies on the couch at every man’s body the crowd draws (the Persians of rank and the chiliarch): the seat within 6 cm of the mattress, nothing under it, the elbow on the bolster', () => {
    const b = readFileSync('public/generated/humans/humans.bin'), A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
    const rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE), o = [0, 0, 0], bx = [RECLINE.x1 - 0.36, RECLINE.x1 - 0.16];
    for (const v of A.variants.filter(v => v.meta.sex === 'm' && v.meta.group !== 'child')) for (const t of [0, 8.4]) {
      const inp = { joints: v.joints, pose: pose('recline' as any, t, 0, 0), face: { jaw: 0, blink: 0, look: null, eyeYaw: 0, eyePitch: 0 }, grip: [0.5, 0.5], x: 0, y: 0, z: 0, yaw: 0, scale: 1 } as unknown as RigInput;
      rig.setPose(inp); rig.solve(inp, pal, 0); let seat = 9, under = 0, elbow = 9, off = 0;
      for (let i = 0; i < A.NO; i += 2) { const pt = A.part[i]; if (pt >= PART.eye) continue; skinPoint(pal, 0, A.skinIndex.subarray(i * 4, i * 4 + 4), Array.from(A.skinWeight.subarray(i * 4, i * 4 + 4), x => x / 255), v.pos.subarray(i * 3, i * 3 + 3), o);
        const on = o[0] > RECLINE.x0 && o[0] < RECLINE.x1 && Math.abs(o[2]) < RECLINE.w / 2; if (!on && o[1] < RECLINE.top + 0.02) off++; if (on) under = Math.max(under, RECLINE.top - o[1]);
        if (pt === PART.pelvis || pt === PART.thigh_l || pt === PART.thigh_r) seat = Math.min(seat, o[1]);
        if ((pt === PART.uarm_l || pt === PART.farm_l) && o[0] > bx[0] && o[0] < bx[1]) elbow = Math.min(elbow, o[1]); }
      expect(Math.abs(seat - RECLINE.top), `${v.meta.id}: seat`).toBeLessThan(0.065); expect(under, `${v.meta.id}: into the couch`).toBeLessThan(0.07); expect(off, `${v.meta.id}: hanging off the couch`).toBe(0);
      expect(Math.abs(elbow - (RECLINE.top + 0.18)), `${v.meta.id}: the elbow on the bolster`).toBeLessThan(0.09); } // (by stature: the 1.50 m body's arm 9 cm into the soft bolster, the 1.79 m one's seat 6 cm above the mattress: the pose cannot know the body)
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
  it('UD-27 at the court: the great houses are married into one another and have rivals; the king’s favour seats them and places them', () => {
    const H = K.houses(), N: number[] = K.byGroup.get('nobles');
    expect(H.hh.length).toBeGreaterThan(20); expect(H.allies.every((a: number[]) => a.length >= 1)).toBe(true); expect(H.rivals.filter((a: number[]) => a.length).length).toBeGreaterThan(H.hh.length / 2);
    for (let i = 0; i < H.hh.length; i++) for (const j of H.rivals[i]) expect(H.allies[i]).not.toContain(j);
    // the favour moves over the residence
    const Y = courtYear(seed); let moved = 0; for (let i = 0; i < H.hh.length; i++) if (Math.abs(K.houseFavour(i, Y.arrive + 2) - K.houseFavour(i, Y.leave - 2)) > 0.15) moved++; expect(moved).toBeGreaterThan(H.hh.length / 4);
    // the banquet: the most favoured sit nearest the throne
    const bd = [...courtSetDays(seed).banquet][2], ds = N.filter(p => K.seatOf(p, bd) >= 0).sort((a, b) => K.seatOf(a, bd) - K.seatOf(b, bd)), mf = (xs: number[]) => xs.reduce((s, p) => s + K.favour(p, bd), 0) / xs.length;
    expect(mf(ds.slice(0, 40))).toBeGreaterThan(mf(ds.slice(-40)) + 0.3);
    // an audience morning: the favoured stand in the hall more than the out of favour; men talk with their allies by name
    let d = Y.arrive + 3; while (!courtProgramme(seed, d).some(e => e.kind === 'audience') || courtProgramme(seed, d).some(e => e.kind === 'gift_day')) d++;
    const hall = { hi: [0, 0], lo: [0, 0] }; let ally = 0;
    for (const p of N) { if (!pop.present(p, d)) continue; const f = K.favour(p, d), b = f > 0.66 ? hall.hi : f < 0.33 ? hall.lo : null;
      for (const s of pop.plan(p, d)) { if (/joined to by marriage/.test(s.why)) ally++; if (!b || s.t1 < 8.5 || s.t0 > 12 || !/^(apadana_hall|court_portico|forecourt|gate_hall|court_apadana_e)$/.test(s.place)) continue; b[1] += s.t1 - s.t0; if (s.place === 'apadana_hall') b[0] += s.t1 - s.t0; } }
    expect(hall.hi[0] / hall.hi[1]).toBeGreaterThan(1.5 * hall.lo[0] / hall.lo[1]); expect(ally).toBeGreaterThan(50);
  }, 120_000);
  it('every plan of a court person on the programme’s days is contiguous and ends the day', () => {
    const SD = courtSetDays(seed), days = [SD.kingGifts, SD.gift[0], SD.hunt[0], SD.birthday];
    for (const d of days) for (let pid = K.first; pid < K.end; pid += 7) { if (!pop.present(pid, d)) continue; const P = pop.plan(pid, d);
      let t = 0; for (const s of P) { expect(s.t0, `pid ${pid} day ${d}: ${s.why}`).toBeCloseTo(t, 6); expect(s.t1).toBeGreaterThan(s.t0); t = s.t1; } expect(t).toBeCloseTo(24, 6); }
  }, 120_000);
});
