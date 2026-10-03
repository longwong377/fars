// The wild animals beyond the town (session 9; src/world/beasts.ts): their ranges come out of the real terrain, rivers and land
// use; each species keeps to its ground and its hours; they keep their distance from a person; their calls are the night's.
import { describe, it, expect } from 'vitest';
import { loadTerrain, loadRiversFile } from './plainLib';
import { buildZones, landUseAt } from '../src/world/plain/fields';
import { buildCanals } from '../src/world/plain/canals';
import { placeVillages } from '../src/world/plain/villages';
import { beastRanges, beastsAt, keepAway, callsNow, BeastFlight, FLIGHT, type P2 } from '../src/world/beasts';
import townData from '../src/data/town.json';

const T = loadTerrain(), R = loadRiversFile(), canals = buildCanals(T, R.rivers, 1), villages = placeVillages(T, R.rivers, canals, 1);
const Z = buildZones({ terrain: T, rivers: R.rivers.map(r => ({ x: r.x, y: r.y, halfCorridor: r.carveRadius.mid + 24 })), villages: villages.map(v => ({ x: v.x, y: v.y, r: v.r })) });
const people: P2[] = [[0, 0], ...(townData as any).facilities.map((f: any) => f.at as P2), ...villages.map(v => [v.x, v.y] as P2)];
const ground = (e: number, n: number) => T.heightAt(e, -n), natural = (e: number, n: number) => landUseAt(Z, e, -n).use === 'natural';
const B = beastRanges({ ground, natural, rivers: R.rivers.map(r => Array.from(r.x, (x, i) => [x, r.y[i]] as P2)), people });
B.hyenaMidden = [-900, 300];
const sun = { rise: 5.4, set: 18.9 };
const d = (a: P2, b: P2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

describe('the wild animals\' ground', () => {
  it('the wolves walk the mountain\'s foot and the leopard the rocks above it, E of the Terrace', () => {
    expect(B.wolfPath.length).toBeGreaterThan(20); expect(B.leopardPath.length).toBeGreaterThan(20);
    for (const p of B.wolfPath) { expect(p[0]).toBeGreaterThan(-300); expect(ground(p[0], p[1])).toBeGreaterThan(55); }
    for (const p of B.leopardPath) expect(ground(p[0], p[1])).toBeGreaterThan(170);
    expect(B.wolfDen).not.toBeNull();
  });
  it('the lions\' reach is 2 km of river kilometres from any village, the town or the Terrace', () => {
    expect(B.lionReach.length).toBeGreaterThan(1); let L = 0; for (let i = 1; i < B.lionReach.length; i++) L += d(B.lionReach[i - 1], B.lionReach[i]);
    expect(L).toBeGreaterThanOrEqual(2000); for (const p of B.lionReach) for (const q of people) expect(d(p, q)).toBeGreaterThan(2500);
  });
  it('the onagers\' and cheetahs\' steppe is uncultivated flat land 3 km from people', () => {
    expect(B.steppe).not.toBeNull(); const s = B.steppe!; expect(natural(s[0], s[1])).toBe(true); for (const q of people) expect(d(s, q)).toBeGreaterThanOrEqual(3000);
  });
});
describe('the smaller wild animals (the gap hunters)', () => {
  it('wild goats on the high rocks by day, a gazelle herd on the plain, foxes and hares at the fields\' edges at night', () => {
    const morning = beastsAt(B, 1, 80000, 9, sun, 3), night = beastsAt(B, 1, 80000, 1, sun, 3);
    expect(morning.filter(b => b.sp === 'wild_goat').length).toBe(7); expect(morning.filter(b => b.sp === 'urial').length).toBe(9);
    expect(B.gazellePlain).not.toBeNull(); expect(morning.filter(b => b.sp === 'gazelle' || b.sp === 'gazelle_m').length).toBe(7);
    expect(B.fieldEdges.length).toBeGreaterThan(5); expect(night.filter(b => b.sp === 'fox').length).toBe(2); expect(night.filter(b => b.sp === 'hare').length).toBe(4);
    expect(morning.filter(b => b.sp === 'fox' || b.sp === 'hare').length).toBe(0);
  });
});
describe('the wild animals\' days', () => {
  it('the same for everyone at the same time', () => { expect(beastsAt(B, 1, 50000, 23, sun, 3)).toEqual(beastsAt(B, 1, 50000, 23, sun, 3)); });
  it('wolves and lions travel by night and lie up by day; the onagers graze by day', () => {
    const night = beastsAt(B, 1, 80000, 1, sun, 3), noon = beastsAt(B, 1, 80000, 13, sun, 3), morning = beastsAt(B, 1, 80000, 9, sun, 3);
    expect(night.filter(b => b.sp === 'wolf').length).toBe(4); expect(noon.filter(b => b.sp === 'wolf').every(b => b.lie === 1)).toBe(true);
    expect(noon.filter(b => b.sp === 'lion' || b.sp === 'lioness').every(b => b.lie === 1)).toBe(true);
    expect(morning.filter(b => b.sp === 'onager').some(b => b.graze === 1)).toBe(true);
    expect(noon.filter(b => b.sp === 'hyena').length).toBe(0); expect(night.filter(b => b.sp === 'hyena').length).toBe(2);
  });
  it('they keep their distance from a person and never come at one', () => {
    for (const b of beastsAt(B, 1, 80000, 1, sun, 3)) { const p: P2 = [b.e + 5, b.n + 5], k = keepAway(b, p); expect(d([k.e, k.n], p)).toBeGreaterThanOrEqual(24.9); }
  });
  it('their calls are the night\'s: none by day, a few an hour at night', () => {
    let day = 0, night = 0; for (let t = 0; t < 86400; t++) { const h = t / 3600; if (callsNow(1, 'roar', 1e6 + t, h, sun, 3)) { if (h > sun.rise && h < sun.set) day++; else night++; } }
    expect(day).toBe(0); expect(night).toBeGreaterThan(2); expect(night).toBeLessThan(40);
  });
});
describe('the herds flee and come back (s18 C14, D-790)', () => {
  it('a herd bolts from a person at its flight distance with an alarm and hooves, runs off, watches, then drifts home', () => {
    const F = new BeastFlight(), t0 = 80000, hour = 9; const sounds: string[] = [];
    const ons = (t: number) => beastsAt(B, 1, t, hour, sun, 3).filter(b => b.sp === 'onager');
    const c0 = ons(t0); const ce = c0.reduce((a, b) => a + b.e, 0) / c0.length, cn = c0.reduce((a, b) => a + b.n, 0) / c0.length;
    const me: P2 = [ce + 120, cn]; // inside the onagers' 150 m
    let first = F.apply(ons(t0), [me], t0, k => sounds.push(k)).filter(b => b.sp === 'onager');
    for (let k = 1; k <= 60 * 10; k++) first = F.apply(ons(t0 + k / 10), [me], t0 + k / 10, s => sounds.push(s)).filter(b => b.sp === 'onager'); // 60 s
    const mid = first.reduce((a, b) => a + d([b.e, b.n], me), 0) / first.length;
    expect(sounds.filter(s => s === 'snort').length, 'one alarm').toBe(1); expect(sounds.filter(s => s === 'hoof').length).toBeGreaterThan(20);
    expect(mid, 'they ran well past their flight distance').toBeGreaterThan(FLIGHT.onager.R + 200);
    // the person leaves: within a quarter of an hour they are walking home and grazing again near their own place
    let back = first; for (let k = 1; k <= 3600; k++) back = F.apply(ons(t0 + 60 + k / 2), [], t0 + 60 + k / 2).filter(b => b.sp === 'onager');
    const home = ons(t0 + 1860); expect(d([back[0].e, back[0].n], [home[0].e, home[0].n])).toBeLessThan(5);
  });
  it('the grazing herds walk to water at dawn and dusk', () => {
    expect(B.water?.steppe).toBeTruthy();
    const c = (h: number) => { const o = beastsAt(B, 1, 80000, h, sun, 3).filter(b => b.sp === 'onager'); return [o.reduce((a, b) => a + b.e, 0) / o.length, o.reduce((a, b) => a + b.n, 0) / o.length] as P2; };
    expect(d(c(sun.rise + 0.35), B.water!.steppe!)).toBeLessThan(d(c(10), B.water!.steppe!) - 100);
  });
});
