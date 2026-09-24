// D-199 (court setting only; the default world stays court-absent, D-003): the delegations' dress from the Apadana reliefs,
// the king as a person with his bearers and escort, the camps' tents, and the retinue in the town and on the plain.
// Measured in node (no browser render): data and sources, the looks, the king's days against his bearers' and escort's,
// the throne against the enthroned pose on the rig, the tents against the built world, the zone counts against
// population.json's court-resident values, the plans, and the costs (bench-reports/court-fill.json).
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { NavGrid } from '../src/people/navgrid';
import { PeopleSim, PLACES, type Env } from '../src/people/sim';
import { segAt, type Population, type Seg } from '../src/people/population';
import { checkPlan } from '../src/people/planCheck';
import { COURT, KING, RETINUE, DELEGATIONS_BY_ORIGIN, COURT_PRIVATE } from '../src/people/court';
import { CAMPS, TENT_KINDS, campPlace } from '../src/people/camps';
import { checkCamps } from '../src/people/campCheck';
import { PopGeo } from '../src/people/popgeo';
import { propOf } from '../src/people/popview';
import { WeatherSystem } from '../src/weather/weatherState';
import { buildTownPlan } from '../src/world/settlement/plan';
import { buildCanals } from '../src/world/plain/canals';
import { placeVillages } from '../src/world/plain/villages';
import { buildZones, landUseAt } from '../src/world/plain/fields';
import { buildTownGround } from '../src/world/plain/townGround';
import { loadTerrain, loadRiversFile } from './plainLib';
import { decodeHumanAssets, type HumanAssets } from '../src/people/humanAssets';
import { COSTUMES, COSTUME_OF, DRESSES, PIECES, pieceBit, type Dress } from '../src/people/outfits';
import { lookFor, DELEGATIONS, DYES } from '../src/people/looks';
import { PART } from '../src/people/humanFormat';
import { RigSolver, PALETTE_STRIDE, skinPoint, type RigInput } from '../src/people/humanRig';
import { pose } from '../src/people/anim';
import { workGeometry } from '../src/people/workObjects';
import { CourtCampTents } from '../src/world/courtCamps';
import popData from '../src/data/population.json';
import sources from '../src/data/sources.json';
import delegationsData from '../src/data/delegations.json';

const W = new WeatherSystem(1);
const env = (t: number): Env => { const d = Math.floor(t / 24), c = W.conditions(d, t - d * 24); return { rain: c.rain, lightning: c.lightning, windMs: c.windMs, tempC: c.tempC, dust: c.dust }; };
let nav: NavGrid, court: PeopleSim, P: Population, A: HumanAssets; const OUT: Record<string, unknown> = {};
const save = () => { mkdirSync('bench-reports', { recursive: true }); let old: Record<string, unknown> = {}; try { old = JSON.parse(readFileSync('bench-reports/court-fill.json', 'utf8')); } catch { /* first */ } writeFileSync('bench-reports/court-fill.json', JSON.stringify({ ...old, ...OUT }, null, 1)); };
beforeAll(() => {
  nav = new NavGrid(new Int16Array(readFileSync('public/generated/nav.i16').buffer.slice(0)), new Uint8Array(readFileSync('public/generated/nav_edges.u8')));
  const t0 = performance.now(); court = new PeopleSim(1, nav, env, { court: true }); P = court.pop; OUT.buildMs = +(performance.now() - t0).toFixed(0);
  const b = readFileSync('public/generated/humans/humans.bin'); A = decodeHumanAssets(JSON.parse(readFileSync('public/generated/humans/humans.json', 'utf8')), b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}, 180_000);
const ZONES = (popData as any).zones;

describe('the delegations’ dress (D-199: the Apadana reliefs, form B, colours C)', () => {
  it('23 peoples, one each, numbered I-XXIII; every piece, dye and gift is one the systems have; the sources resolve; NOT SEEN is said', () => {
    expect(DELEGATIONS.length).toBe(23); expect(new Set(DELEGATIONS.map(d => d.origin)).size).toBe(23); expect(new Set(DELEGATIONS.map(d => d.relief)).size).toBe(23);
    expect([...COURT.visitors.origins].sort()).toEqual(DELEGATIONS.map(d => d.origin).sort());
    const props = new Set(['bowl', 'jar', 'cloth', 'basket', 'sack', 'spear']);
    for (const d of DELEGATIONS) { expect(DRESSES, d.id).toContain(d.dress); const opt = COSTUMES[COSTUME_OF[d.dress]].opt;
      for (const id of d.pieces) expect(opt, `${d.id} ${id}`).toContain(id);
      expect(['long', 'short', 'none']).toContain(d.beard);
      for (const k of [...d.dyes.main, ...d.dyes.second, ...d.dyes.trim]) expect(DYES[k], `${d.id} ${k}`).toBeDefined();
      expect(d.gifts.length).toBeGreaterThan(0); for (const [, p] of d.gifts) expect(props.has(p), `${d.id} ${p}`).toBe(true);
      expect(d.note.length).toBeGreaterThan(20); }
    for (const k of String((delegationsData as any)._meta.src).split(';')) expect((sources as any)[k], k).toBeTruthy();
    expect((delegationsData as any)._meta.tiers).toMatch(/NOT SEEN/); expect((sources as any).WALSER1966.access).toMatch(/NOT SEEN/);
    for (const id of ['cap_pointed', 'cap_low', 'crown']) { expect(PIECES[id].tier).toMatch(/^[ABC]$/); for (const k of PIECES[id].src.split(';')) expect((sources as any)[k], k).toBeTruthy(); }
  });
  it('a delegate wears his people’s dress: the costume, its pieces and beard, his people’s dyes; deterministic; the far row set', () => {
    for (const d of DELEGATIONS) for (let s = 0; s < 6; s++) {
      const inp = { id: s, sex: 'm' as const, role: 'traveller', dress: 'median' as Dress, origin: d.origin, seed: 700 + s * 31, delegation: d.id };
      const L = lookFor(A, inp, 1); expect(L).toEqual(lookFor(A, inp, 1)); expect(L.dress).toBe(d.dress);
      for (const id of d.pieces) expect(L.pieces, `${d.id} ${id}`).toContain(id);
      const beard = L.pieces.filter(p => p.startsWith('beard')); if (d.beard === 'none') expect(beard).toEqual([]); else expect(beard.length).toBe(1);
      for (const id of L.pieces) expect([...COSTUMES[d.dress].always, ...COSTUMES[d.dress].opt]).toContain(id);
      for (const id of COSTUMES[COSTUME_OF[d.dress]].opt) expect(((L.mask >> pieceBit(d.dress, id)) & 1) === 1, `${d.id} ${id}`).toBe(L.pieces.includes(id) || COSTUMES[d.dress].always.includes(id));
      expect(L.note).toMatch(new RegExp(`relief ${d.relief}`)); if (d.dress.startsWith('envoy')) expect(L.far).toBeDefined();
    }
  });
  it('the court’s visitors: each party of one of the 23 peoples brings its own gifts, carried as its prop; the men wear its dress, the women theirs', () => {
    const K = P.court!; let men = 0, dressed = 0;
    for (const pa of K.parties) { const d = DELEGATIONS_BY_ORIGIN.get(pa.origin)!; expect(d, pa.origin).toBeDefined(); expect(d.gifts.map(g => g[0])).toContain(pa.gift);
      expect(propOf('queue', `gifts for the king: ${pa.gift}`)).toBe(d.gifts.find(g => g[0] === pa.gift)![1]);
      for (const pid of pa.members) { const L = K.lookOf(pid); if (P.persons[pid].sex === 'm') { men++; if (L?.delegation === d.id) dressed++; } else expect(L).toBeNull(); } }
    expect(dressed).toBe(men); expect(K.placeholder(K.parties[0].members[0])).toBe(false);
  });
});

describe('the king (D-199: B9, Q-335)', () => {
  it('is one person, only with the court setting: Xerxes on the reliefs’ dress, with two bearers and four of his spearmen', () => {
    const K = P.court!; expect(P.nameOf(K.king)).toBe('Xšayāršā'); expect(K.lookOf(K.king)).toEqual({ dress: 'king', stature: 1.66 });
    expect(K.escort.length).toBe(4); expect(K.lookOf(K.bearers.parasol)?.beardless).toBe(true);
    const L = lookFor(A, { id: 1, sex: 'm', role: 'official', dress: 'king', origin: 'Persian', seed: 5, stature: 1.66 }, 1);
    for (const id of ['robe_upper', 'robe_skirt', 'robe_sleeves', 'crown', 'beard_long']) expect(L.pieces).toContain(id);
    expect(L.far).toBe('persian');
    const absent = new PeopleSim(1, nav, env).pop; expect(absent.court).toBeNull(); expect(absent.persons.some(p => p.sub.startsWith('court:king'))).toBe(false);
  });
  it('gives audience on about two mornings in five: walks to the Apadana with staff and lotus, enthroned, walks back; otherwise unseen in the Hadish', () => {
    const K = P.court!, rows: string[] = []; let aud = 0, days = 0;
    const hidden = new Set(COURT_PRIVATE.map(p => p.id));
    for (let d = K.firstDay; d < K.leaveDay; d++) { days++; const s = P.plan(K.king, d), Kd = K.kingDay(d);
      const seen = s.filter(x => x.where !== 'away' && !hidden.has(x.place));
      if (Kd.aud) { aud++; const th = s.find(x => x.act === 'enthroned')!; expect(th, `day ${d}`).toBeDefined(); expect(th.place).toBe(KING.throne);
        expect(Math.abs(th.t1 - Kd.a1)).toBeLessThan(1e-6); expect(Math.abs(th.t0 - Kd.a0)).toBeLessThan(0.02);
        expect(seen.every(x => x.act === 'royal_walk' || x.act === 'enthroned'), `day ${d}: ${seen.map(x => x.act).join(',')}`).toBe(true);
        expect(seen.filter(x => x.act === 'royal_walk').length).toBe(2);
        // his bearers stand at their posts and his escort at theirs while he sits; they walk when he walks
        for (const [pid, act] of [[K.bearers.parasol, 'attend_parasol'], [K.bearers.whisk, 'attend_whisk'], ...K.escort.map(e => [e, 'stand_guard'])] as [number, string][]) {
          if (P.sick(pid, d)) continue; const q = segAt(P.plan(pid, d), (Kd.a0 + Kd.a1) / 2); expect(q.act, `day ${d} ${pid}`).toBe(act); expect(q.place).toMatch(/^court_throne_/); }
        for (const pid of [K.bearers.parasol, K.bearers.whisk]) { if (P.sick(pid, d)) continue; const w = P.plan(pid, d).filter(x => x.act === 'bear_parasol' || x.act === 'bear_whisk'); const kw = s.filter(x => x.act === 'royal_walk');
          expect(w.length).toBe(2); for (let i = 0; i < 2; i++) expect(Math.abs(w[i].t0 - kw[i].t0), `day ${d}: bearer leaves ${w[i].t0} king ${kw[i].t0}`).toBeLessThan(0.02); }
        if (rows.length < 3) rows.push(`day ${d}: enthroned ${Kd.a0.toFixed(2)}-${Kd.a1.toFixed(2)}`); }
      else expect(seen, `day ${d}`).toEqual([]); }
    OUT.king = { audienceDays: aud, residentDays: days, share: +(aud / days).toFixed(2), examples: rows }; save(); console.log(JSON.stringify(OUT.king));
    expect(aud / days).toBeGreaterThan(0.28); expect(aud / days).toBeLessThan(0.5);
    // his rooms are not drawn; the throne and the posts are on the walkable Terrace
    const geo = new PopGeo({ pop: P, nav, town: null, seed: 1 }); expect(geo.spot(K.king, KING.private, 'rest', 3, 10).out).toBe(false); expect(geo.spot(K.king, KING.private, 'rest', 3, 10).ok).toBe(true);
    for (const id of [KING.throne, KING.attend.parasol, KING.attend.whisk, ...KING.attend.escort, 'court_audience', 'court_audience_front', KING.private]) { expect(PLACES[id], id).toBeTruthy(); expect(nav.walkable(PLACES[id].at[0], PLACES[id].at[1]), id).toBe(true); }
  }, 300_000);
  it('each party is led before him on one of his audience mornings within its stay, while he sits', () => {
    const K = P.court!; let led = 0, none = 0;
    for (const pa of K.parties) { if (pa.audience < 0) { none++; continue; } expect(K.kingDay(pa.audience).aud).toBe(true); expect(pa.audience).toBeGreaterThan(pa.day); expect(pa.audience).toBeLessThan(pa.leave);
      const Kd = K.kingDay(pa.audience), s = P.plan(pa.members[0], pa.audience).find(x => x.place === 'court_audience_front' && x.where !== 'road')!; expect(s, `party ${pa.i}`).toBeDefined();
      expect(s.t0).toBeGreaterThan(Kd.a0 - 1e-6); expect(s.t1).toBeLessThan(Kd.a1 + 0.35); led++; }
    OUT.audiences = { led, withoutAudience: none }; save(); expect(led).toBeGreaterThan(0.9 * K.parties.length);
  }, 300_000);
  it('the throne is built to the enthroned pose: the seat under the buttocks and the footstool under the soles (±3 cm) on the bodies the king can have', () => {
    const rig = new RigSolver(A.meta.curlAxes), pal = new Float32Array(PALETTE_STRIDE), g = workGeometry('throne'); g.computeBoundingBox();
    // (as popview.lookInput gives it: the king is 51, an adult body, at the stature fitted to the throne; the crowd scales the
    // body, not the throne, so the seat and soles are compared at the look's scale)
    const bodies = new Map<string, number>(); for (let s = 0; s < 40; s++) { const L = lookFor(A, { id: s, sex: 'm', role: 'official', dress: 'king', seed: 900 + s, stature: 1.66, age: 'adult' }, 1); bodies.set(`${L.variantId}@${L.scale.toFixed(4)}`, L.scale); }
    const rows: string[] = [];
    for (const [key, sc] of bodies) { const id = key.split('@')[0], v = A.byId[id], inp: RigInput = { joints: v.joints, pose: pose('enthroned', 1, 0, 0.3), face: { jaw: 0, blink: 0, look: null, eyeYaw: 0, eyePitch: 0 }, grip: [0.5, 0.5], x: 0, y: 0, z: 0, yaw: 0, scale: 1 } as RigInput;
      rig.setPose(inp); rig.solve(inp, pal, 0); const o = [0, 0, 0]; let seat = 9, sole = 9;
      for (let i = 0; i < A.NO; i += 2) { const pt = A.part[i]; if (pt >= PART.eye) continue; skinPoint(pal, 0, A.skinIndex.subarray(i * 4, i * 4 + 4), Array.from(A.skinWeight.subarray(i * 4, i * 4 + 4), x => x / 255), v.pos.subarray(i * 3, i * 3 + 3), o);
        if (pt === PART.pelvis || pt === PART.thigh_l || pt === PART.thigh_r) seat = Math.min(seat, o[1]); if (pt === PART.foot_l || pt === PART.foot_r) sole = Math.min(sole, o[1]); }
      seat *= sc; sole *= sc; rows.push(`${id} (${v.height.toFixed(2)} m × ${sc.toFixed(3)}): seat ${seat.toFixed(3)}, soles ${sole.toFixed(3)}`);
      expect(Math.abs(seat - 0.525), `${id} seat`).toBeLessThan(0.03); expect(Math.abs(sole - 0.105), `${id} soles`).toBeLessThan(0.03); }
    OUT.throne = rows; save(); console.log(rows.join('\n')); expect(bodies.size).toBeGreaterThan(0);
  });
});

describe('the camps’ tents (D-199: camps.ts, C)', () => {
  it('every household lodged at a camp has a tent; the tents stand clear of the town, its roads and water, the canals, rivers and villages, on level, untilled ground', () => {
    const K = P.court!, terrain = loadTerrain(), rivers = loadRiversFile(), canals = buildCanals(terrain, rivers.rivers, 1), villages = placeVillages(terrain, rivers.rivers, canals, 1), town = buildTownPlan();
    const zones = buildZones({ terrain, rivers: rivers.rivers.map(r => ({ x: r.x, y: r.y, halfCorridor: r.carveRadius.mid + 24 })), villages: villages.map(v => ({ x: v.x, y: v.y, r: v.r })),
      ground: buildTownGround(town, CAMPS.filter(c => c.id !== 'court').map(c => ({ c: c.c, r: c.r }))), sites: town.sites.map(s => ({ c: s.frame.c as [number, number], theta: s.frame.theta, W: s.W, H: s.H })) });
    for (let pid = K.first; pid < K.end; pid++) { const H = P.households[P.persons[pid].hh]; if (H.home === 'court_camp' || H.home.startsWith('rcamp:')) expect(K.tentOf(pid), `${pid} ${H.home}`).not.toBeNull(); }
    const rep = checkCamps(K.tents, { town, villages, canals: canals.map(c => c.pts), rivers: rivers.rivers.map(r => ({ x: r.x, y: r.y, half: r.topWidth / 2 + 10 })), asl: (e, n) => terrain.aslAt(e, -n), landUse: (e, n) => landUseAt(zones, e, -n).use });
    const res: Record<string, unknown> = {};
    for (const c of CAMPS) { const r = rep[c.id]; expect(r, c.id).toBeDefined(); res[c.id] = { tents: r.tents, radius: K.campRadius.get(c.id), maxSlope: +r.maxSlope.toFixed(3), landUse: r.landUse };
      for (const k of ['onPlot', 'onTree', 'onProp', 'onRoad', 'onTownWater', 'onCanal', 'onRiver', 'inVillage', 'overlaps'] as const) expect(r[k], `${c.id} ${k}: ${r.examples.join('; ')}`).toBe(0);
      expect(r.maxSlope, c.id).toBeLessThan(0.05); expect(r.landUse.natural, c.id).toBe(r.tents); expect(K.campRadius.get(c.id)!).toBeLessThanOrEqual(c.r); }
    const sleeps = K.tents.reduce((s, t) => s + TENT_KINDS[t.kind].sleeps, 0);
    OUT.tents = { total: K.tents.length, sleeps, camps: res }; save(); console.log(JSON.stringify(OUT.tents));
  }, 300_000);
  it('the tents drawn: a mesh per camp, a collider per tent, ≤ 20 triangles a tent; the people asleep inside (not drawn), the rest before their door', () => {
    const K = P.court!, t0 = performance.now(), C = new CourtCampTents(K.tents, () => 1600), ms = performance.now() - t0;
    expect(C.info.tents).toBe(K.tents.length); expect(C.info.meshes).toBe(CAMPS.length); expect(C.info.colliders).toBe(K.tents.length); expect(C.info.tris / C.info.tents).toBeLessThanOrEqual(20);
    OUT.tentGeometry = { tents: C.info.tents, triangles: C.info.tris, meshes: C.info.meshes, buildMs: +ms.toFixed(0), perTent: +(C.info.tris / C.info.tents).toFixed(1) }; save();
    const geo = new PopGeo({ pop: P, nav, town: buildTownPlan(), seed: 1 });
    let n = 0; for (const [camp, list] of K.retinue) for (const pid of list.filter((_, i) => i % 97 === 0)) { const t = K.tentOf(pid)!; expect(t.camp).toBe(camp);
      const a = geo.spot(pid, campPlace(camp), 'sleep', 5, 2), b = geo.spot(pid, campPlace(camp), 'talk', 5, 10); expect(a.ok && b.ok).toBe(true); expect(a.out).toBe(false); expect(b.out).toBe(true);
      expect(Math.hypot(a.e - t.e, a.n - t.n)).toBeLessThan(0.01); const d = Math.hypot(b.e - t.e, b.n - t.n); expect(d).toBeGreaterThan(t.d / 2); expect(d).toBeLessThan(t.d / 2 + 4.5); n++; }
    expect(n).toBeGreaterThan(100);
  }, 300_000);
});

describe('the retinue (D-199: Q-333, C)', () => {
  it('its groups are as court.json sizes them, in the camps of their zone', () => {
    const K = P.court!; const byRole = new Map<string, number>(); for (const [, list] of K.retinue) for (const pid of list) { const m = K.member(pid)!; byRole.set(m.role, (byRole.get(m.role) ?? 0) + 1);
      expect(CAMPS.find(c => campPlace(c.id) === m.sleep)!.zone).toBe(RETINUE.find(g => g.id === m.role)!.zone); }
    for (const G of RETINUE) expect(byRole.get(G.id), G.id).toBe(G.n);
    for (const k of String(COURT.retinue.src).split(';')) expect((sources as any)[k], k).toBeTruthy();
  });
  it('the town and the plain hold population.json’s court-resident numbers by night and by day (within 20 % of the working value, inside the range); the Terrace still its own', () => {
    const rows: Record<string, unknown> = {}; const t0 = performance.now();
    for (const d of [30, 90]) for (const h of [2, 10.5]) { const c: Record<string, number> = { terrace: 0, town: 0, plain: 0 };
      for (let pid = 0; pid < P.persons.length; pid++) { if (!P.present(pid, d)) continue; const s = segAt(P.plan(pid, d), h);
        const w = s.where === 'road' ? (s.place.startsWith('road:terrace') ? 'terrace' : s.place.startsWith('road:plain') ? 'plain' : 'town') : s.where; if (w in c) c[w]++; }
      rows[`day ${d} ${h}h`] = c;
      for (const z of ['town', 'plain', 'terrace']) { const T = ZONES.find((x: any) => x.id === z).court_resident[h < 6 ? 'night' : 'day'].all_seasons;
        expect(c[z], `${z} day ${d} ${h}h`).toBeGreaterThanOrEqual(Math.max(T.range[0], 0.8 * T.w)); expect(c[z], `${z} day ${d} ${h}h`).toBeLessThanOrEqual(Math.min(T.range[1], 1.2 * T.w)); } }
    OUT.zones = { counts: rows, ms: +(performance.now() - t0).toFixed(0), persons: P.persons.length, court: P.court!.end - P.court!.first }; save(); console.log(JSON.stringify(OUT.zones));
  }, 600_000);
  it('its plans are well formed over a week (a sample of every tenth person), and it is gone on the court’s leave day', () => {
    const K = P.court!, issues: string[] = []; let n = 0; const t0 = performance.now();
    for (const [, list] of K.retinue) for (let i = 0; i < list.length; i += 10) { const pid = list[i]; let prev: Seg[] | null = null;
      for (let d = 20; d < 27; d++) { const segs = P.plan(pid, d); n++;
        for (const x of checkPlan(P, pid, d, segs, prev ? prev[prev.length - 1].place : null, prev)) issues.push(`${pid} ${K.member(pid)!.role} day ${d}: ${x.kind} ${x.note}`); prev = segs; }
      expect(segAt(P.plan(pid, K.leaveDay), 20).where).toBe('away'); expect(P.present(pid, K.leaveDay + 1)).toBe(false); }
    OUT.retinuePlans = { personDays: n, msPer1000: +((performance.now() - t0) / n * 1000).toFixed(1) }; save();
    expect(issues.slice(0, 10)).toEqual([]);
  }, 600_000);
});
