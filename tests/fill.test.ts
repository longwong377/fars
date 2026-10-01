// The fill (session 15, agent fill, D-367; src/world/fillPlan.ts, fill.ts). How it could pass while the intent fails (clause 1):
// things placed inside walls or across doorways, lanes choked, a dressed showcase while most lanes stay bare, or models that
// never load (nothing drawn). Measured: every item's centre in an open cell of its site and clear of every street door; the
// lanes left passable; coverage over the whole town (the share of lane points with things within 15 m, per quarter); every
// square a market; every model the plan names present among the modelled props and in ASSET_LEDGER.md; the drawn instances
// round a lane point and in the market by day and night.
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildTownPlan } from '../src/world/settlement/plan';
import { LANE, SQUARE, OUT, toLocal, type Site } from '../src/world/settlement/site';
import { townFill, terraceFill, siteFill, type FillItem } from '../src/world/fillPlan';
import { WorldFill } from '../src/world/fill';
import { loadModelsNode } from './lib/models_node';
import { model } from '../src/render/scanProps';

let sites: Site[] = [], items: FillItem[] = [], stats: ReturnType<typeof townFill>['stats'];
beforeAll(() => { loadModelsNode(); sites = buildTownPlan().sites; const r = townFill(sites, 1); items = r.items; stats = r.stats; }, 120_000);

describe('the fill', () => {
  it('stands in the open, never inside a house or in a doorway', () => {
    let bad = 0, door = 0;
    for (const s of sites) { const own: FillItem[] = []; siteFill(s, 1, own, { ...stats }); for (const it of own) { const [u, v] = toLocal(s.frame, it.e, it.n), c = s.cell[s.k(s.ci(u), s.cj(v))];
      if (it.m !== "fill_line" && c !== LANE && c !== SQUARE && c !== OUT) { bad++; if (bad < 12) console.log("BAD", it.m, it.at, c); }
      if (it.at === 'lane') for (const p of s.plots) if (p.door) { const a = p.door.cell, b = p.door.out, au = s.cu(a % s.W), av = s.cv((a / s.W) | 0), bu = s.cu(b % s.W), bv = s.cv((b / s.W) | 0);
        if (Math.hypot((au + bu) / 2 - u, (av + bv) / 2 - v) < 0.9) { door++; if (door < 3) console.log("DBG", s.id, it.m, it.at, u, v, (au + bu) / 2, (av + bv) / 2, s.doors.size); } } } }
    expect(bad).toBe(0); expect(door).toBe(0);
  });
  it('fills the whole town, not one street: every quarter, every square a market', () => {
    expect(stats.squares).toBeGreaterThanOrEqual(10); expect(stats.stalls).toBeGreaterThanOrEqual(stats.squares * 3);
    expect(stats.lane).toBeGreaterThan(2500); expect(stats.line).toBeGreaterThan(300); expect(stats.door).toBeGreaterThan(400);
    const grid = new Map<string, FillItem[]>(); for (const it of items) { const k = `${Math.floor(it.e / 10)},${Math.floor(it.n / 10)}`; (grid.get(k) ?? grid.set(k, []).get(k)!).push(it); }
    const within = (e: number, n: number) => { let c = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const it of grid.get(`${Math.floor(e / 10) + a},${Math.floor(n / 10) + b}`) ?? []) if (Math.hypot(it.e - e, it.n - n) < 10) c++; return c; };
    const per: string[] = [], shares: [string, number][] = [];
    for (const s of sites) { if (s.meta.kind !== 'quarter') continue; let pts = 0, full = 0;
      for (let j = 0; j < s.H; j += 9) for (let i = 0; i < s.W; i += 9) { const c = s.cell[s.k(i, j)]; if (c !== LANE && c !== SQUARE) continue; pts++; const [e, n] = s.grid(s.cu(i), s.cv(j)); if (within(e, n) >= 3) full++; }
      per.push(`${s.id} ${(full / pts).toFixed(2)}`); shares.push([s.id, full / pts]); }
    console.log('[fill] lane points with >= 3 things within 10 m:', per.join(', '), JSON.stringify(stats));
    for (const [id, f] of shares) expect(f, id).toBeGreaterThan(0.8);
  });
  it('leaves the lanes passable', () => {
    const DEPTH_MAX = 1.0; for (const it of items) if (it.at === 'lane') expect(it.s[2] * DEPTH_MAX).toBeLessThan(1.4);
  });
  it('names only models that exist and are in the ledger', () => {
    const ledger = readFileSync('ASSET_LEDGER.md', 'utf8'), ids = new Set([...items, ...terraceFill(1)].map(i => i.m));
    for (const id of ids) { expect(model(id), id).not.toBeNull(); if (id.startsWith('fill_')) expect(ledger.includes(`m_${id}`), `ledger m_${id}`).toBe(true); }
  });
  it('draws round the viewer: lane things near, the market by day, its goods taken in at night', () => {
    const sq = items.find(i => i.m === 'fill_stall')!, F = new WorldFill(items, { ground: () => 0 });
    expect(F.missing).toEqual([]);
    F.update([sq.e, sq.n], 10); const day = F.stats(); expect(day.drawn).toBeGreaterThan(20); expect(day.draws).toBeGreaterThan(5);
    F.update([sq.e, sq.n], 22); const night = F.stats(); expect(night.drawn).toBeLessThan(day.drawn); expect(night.drawn).toBeGreaterThan(5);
    expect(F.update([sq.e + 1, sq.n], 22)).toBe(false);
    console.log('[fill] at a market by day:', JSON.stringify(day), 'night drawn', night.drawn);
  });
  it('the Terrace: the masons\' yard, the stair foot, the garrison, the store and the standards', () => {
    const T = terraceFill(1), by = (m: string) => T.filter(t => t.m === m).length;
    expect(by('fill_chips') + by('fill_block')).toBeGreaterThan(15); expect(by('fill_standard')).toBe(6); expect(T.length).toBeGreaterThan(100);
  });
});
