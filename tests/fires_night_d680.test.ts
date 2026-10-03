// D-680: the fires of some nights only (firePlaces.ts occasionalFires): the night watch's braziers on the court's nights,
// the Apadana's banquet braziers on banquet nights, torches in the halls' doors; none in the fixed list
import { describe, it, expect, afterEach } from 'vitest';
import { buildTerrace } from '../src/arch/terrace';
import { occasionalFires, terraceFireLights, banquetFireLights } from '../src/world/firePlaces';
import { FIRE_DAY } from '../src/world/fire';
import { isBanquetNight, inResidence } from '../src/people/ceremony';
import { COURT_NIGHT_FIRES } from '../src/people/court';

const T: any = buildTerrace();
afterEach(() => { FIRE_DAY.day = -1; FIRE_DAY.hour = 12; FIRE_DAY.seed = 1; });
describe('D-680 occasional fires', () => {
  const O = occasionalFires(T.manifest, T.doorways);
  it('a brazier per night-watch line, 16 banquet braziers in the Apadana, torches in the halls\' doors', () => {
    expect(O.filter(o => /night watch/.test(o.meta.note)).length).toBe(COURT_NIGHT_FIRES.length);
    expect(O.filter(o => /banquet/.test(o.meta.note)).length).toBe(16);
    expect(O.filter(o => o.kind === 'torch').length).toBeGreaterThanOrEqual(20);
    expect(banquetFireLights(T.manifest, T.parts, T.doorways).length).toBe(O.length);
    const fixed = new Set(terraceFireLights(T.manifest, T.parts, T.doorways).map(f => f.pos.join()));
    expect(banquetFireLights(T.manifest, T.parts, T.doorways).some(f => fixed.has(f.pos.join()))).toBe(false);
  });
  it('the banquet lights burn on banquet nights only (past midnight too); the watch on residence nights', () => {
    const bq = O.find(o => /banquet/.test(o.meta.note))!, watch = O.find(o => /night watch/.test(o.meta.note))!;
    let d = 0; while (d < 400 && !isBanquetNight(1, d)) d++; expect(d).toBeLessThan(400);
    FIRE_DAY.day = d; FIRE_DAY.hour = 21; expect(bq.meta.stands!()).toBe(true); expect(watch.meta.stands!()).toBe(true);
    FIRE_DAY.day = d + 1; FIRE_DAY.hour = 2; expect(bq.meta.stands!()).toBe(true);
    let q = 0; while (q < 400 && (isBanquetNight(1, q) || !inResidence(1, q))) q++; FIRE_DAY.day = q; FIRE_DAY.hour = 21; expect(bq.meta.stands!()).toBe(false);
    let a = 0; while (a < 400 && inResidence(1, a)) a++; FIRE_DAY.day = a; expect(watch.meta.stands!()).toBe(false);
    FIRE_DAY.day = -1; expect(watch.meta.stands!()).toBe(true); expect(bq.meta.stands!()).toBe(false);
  });
});
