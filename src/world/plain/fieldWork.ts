// D-670 (C12's finding through the lead: the fields 4-7 km out empty of people at working hours): what each field plot of
// the plain asks of its people today, for the people layer (C1) to staff. Pure, from the same plots, land use and crop
// calendar the terrain draws (fields.ts plotAt/landUseAt, seasonal.ts cropState): a plot's village (the nearest built
// village within 2.5 km), its use, crop, the season's stage, and the spots where its workers stand: the ploughman behind
// the ard at the furrow front, the reapers in a line across the strip with binders behind them, gleaners on the stubble,
// the waterer at the plot's head on irrigation days, weeders, pruners and pickers in the vines and orchards, a herder on
// the grazed fallow and on the open range within 4.5 km of a village. Fronts move along the strip as the work goes on through its days. All C (the calendar is
// seasonal.ts'; the gangs by analogy with the Persepolis Fortification texts' workers and the plain's practice).
//
//   const work = plain.fieldWork(e, n, 1200, dayIndex);   // plots within 1.2 km with work today
//   for (const p of work) for (const s of p.spots) ...      // s.e, s.n, s.yaw (facing, as works.ts), s.act
//
// Threshing is at the village's floor (fieldFill.ts threshingFloor), not in the field.
import { plotAt, landUseAt, hash2, unit, type ZoneMap, type LandUse } from './fields';
import { cropState, doyOf, type CropRow } from './seasonal';
import { settlementZones, pointInPolygon } from './data';

export type FieldAct = 'plough' | 'sow' | 'reap' | 'bind' | 'glean' | 'carry' | 'water' | 'weed' | 'cut' | 'tend' | 'prune' | 'hoe' | 'pick' | 'graze';
export type FieldStage = 'ploughing' | 'growing' | 'reaping' | 'stubble' | 'fallow' | 'vines' | 'orchard' | 'range' | 'idle';
export interface FieldSpot { e: number; n: number; /** facing (as works.ts WorkSpot: atan2(toE, -toN)) */ yaw: number; act: FieldAct }
export interface FieldPlotWork {
  /** plot key (fields.ts Plot.h) */ plot: number; village: string | null; use: LandUse; crop: CropRow; stage: FieldStage;
  /** the plot's centre (e, n) and strip size (m) */ e: number; n: number; w: number; l: number; spots: FieldSpot[];
}
export interface FieldVillage { id: string; x: number; y: number; r: number }
export const FIELD_WORK = { villageReach: 2500, rangeReach: 4500, step: 30, tag: { tier: 'C', src: 'RECON;PF', note: 'field work by plot and season (D-670): stages from the crop calendar (seasonal.ts), gangs and their places by analogy (C)' } } as const;

let ZONES: [number, number][][] | null = null; const zones = () => (ZONES ??= settlementZones());
const yawOf = (dE: number, dN: number) => Math.atan2(dE, -dN);
/** the plot's stage and its work today (pure): from the crop state a week either side (the plot's own offset applied) */
export function plotStage(row: CropRow, doy: number, h: number): { stage: FieldStage; acts: [FieldAct, number][]; progress: number } {
  const at = (d: number) => cropState(row, d), s = at(doy), back = at(doy - 7), fwd = at(doy + 8), r = unit(hash2(h >>> 0, Math.floor(doy), 77));
  // the open range: a herder with the village's flock on about one patch in 25, all year (the flocks off the crops; C)
  if (row === 'steppe') return { stage: 'range', acts: r < 0.04 ? [['graze', 1]] : [], progress: 0 };
  if (row === 'fallow') return { stage: 'fallow', acts: r < 0.35 ? [['graze', 1]] : [], progress: 0 };
  if (row === 'vineyard') { const acts: [FieldAct, number][] = doy >= 30 && doy < 75 ? [['prune', 2]] : doy >= 75 && doy < 100 ? [['hoe', 2]] : doy >= 255 && doy < 300 ? [['pick', 4], ['carry', 1]] : [];
    return { stage: 'vines', acts, progress: ((doy * 13 + (h & 255)) % 100) / 100 }; }
  if (row === 'orchard_floor') { const acts: [FieldAct, number][] = doy >= 170 && doy < 265 ? [['pick', 3], ['carry', 1]] : doy >= 100 && doy < 290 && r < 0.4 ? [['water', 1]] : doy >= 20 && doy < 60 ? [['prune', 1]] : [];
    return { stage: 'orchard', acts, progress: ((doy * 13 + (h & 255)) % 100) / 100 }; }
  // ploughing and sowing: the furrows opening (tilled rising) on bare ground; the seed-plough sows as it goes, a sower behind
  if (s.tilled > 0.3 && s.height < 0.03 && s.tilled >= back.tilled - 0.05) return { stage: 'ploughing', acts: [['plough', 1], ['sow', 1]], progress: Math.min(1, s.tilled) };
  // reaping: a ripe stand that will be cut within the week; the front walks the strip over those days
  if (s.height > 0.1 && s.straw > 0.3 && fwd.height < 0.02) { const left = [1, 2, 3, 4, 5, 6, 7, 8].find(k => at(doy + k).height < 0.02) ?? 8;
    return { stage: 'reaping', acts: [['reap', 4], ['bind', 2]], progress: 1 - left / 8 }; }
  // just cut: the sheaves carried to the floor, gleaners after them
  if (s.height < 0.02 && back.height > 0.1) return { stage: 'stubble', acts: [['carry', 2], ['glean', 2]], progress: 0.5 };
  if (s.height >= 0.03) { const acts: [FieldAct, number][] = [];
    if (row === 'alfalfa' && s.straw > 0.3) acts.push(['cut', 2]);
    if (row === 'garden') acts.push(['tend', 2]);
    else if (doy >= 40 && doy < 120 && r < 0.5) acts.push(['weed', 2]);
    if (r > 0.65 && row !== 'pulses' && row !== 'flax') acts.push(['water', 1]); // on its turn of the water (irrigated only: below)
    return { stage: 'growing', acts, progress: r }; }
  return { stage: 'idle', acts: [], progress: 0 };
}

/** one plot's work today at a point (null when the point is not in a worked plot) */
export function plotWork(zm: ZoneMap, villages: FieldVillage[], e: number, n: number, dayIndex: number): FieldPlotWork | null {
  const u = landUseAt(zm, e, -n), p = u.plot;
  const [sx, sz] = p.seed, ce = sx, cn = -sz;
  if (villages.some(v => Math.hypot(v.x - ce, v.y - cn) < v.r + 15)) return null;
  // the open range is grazed from the villages within a day's walk out and back; the fields are the nearest village's
  let village: string | null = null, best: number = u.use === 'natural' ? FIELD_WORK.rangeReach : FIELD_WORK.villageReach;
  for (const v of villages) { const d = Math.hypot(v.x - ce, v.y - cn); if (d < best) { best = d; village = v.id; } }
  if (u.use === 'natural' && (!village || zones().some(z => pointInPolygon(ce, cn, z)))) return null; // not the town's or the Terrace's ground
  const doy = doyOf(dayIndex) + u.offsetDays, st = plotStage(u.row, doy, p.h);
  let acts = st.acts; if (u.use !== 'irrigated' && u.use !== 'orchard') acts = acts.filter(([a]) => a !== 'water');
  // the strip frame: across (w) along (cos, sin) of the angle in world x/z; along the strip (l) its normal; to (e, n): n = -z
  const ca = Math.cos(p.angle), sa = Math.sin(p.angle), Ae = ca, An = -sa, Le = -sa, Ln = -ca;
  const spots: FieldSpot[] = [], hw = p.w * 0.35, hl = p.l * 0.4, front = -hl + 2 * hl * st.progress;
  const at = (a: number, b: number): [number, number] => [ce + Ae * a + Le * b, cn + An * a + Ln * b];
  const put = (a: number, b: number, fe: number, fn: number, act: FieldAct) => { const [se, sn] = at(a, b); if (plotAt(se, -sn).h !== p.h) return; spots.push({ e: se, n: sn, yaw: yawOf(fe, fn), act }); };
  const jit = (k: number, m: number) => (unit(hash2(p.h >>> 0, k, 78 + m)) - 0.5);
  for (const [act, count] of acts) for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) - 0.5 : jit(i, 1) * 0.6;
    switch (act) {
      case 'plough': put(hw * (st.progress * 2 - 1) * 0.9, front, Le, Ln, act); break; // walking the furrow along the strip
      case 'sow': put(hw * (st.progress * 2 - 1) * 0.9 + 1.2, front - 6, Le, Ln, act); break;
      case 'reap': put(t * hw * 1.6, front + jit(i, 2) * 1.5, Le, Ln, act); break; // a line across the strip, facing the standing crop
      case 'bind': put(t * hw * 1.2, front - 4 - jit(i, 3) * 2, -Le, -Ln, act); break;
      case 'carry': put(hw * 0.8, -hl * 0.9 + i * 3, -Le, -Ln, act); break; // at the plot's foot, toward the track
      case 'glean': put(jit(i, 4) * hw * 1.6, jit(i, 5) * hl * 1.6, Ae, An, act); break;
      case 'water': put(jit(i, 6) * hw, hl * 0.95, -Le, -Ln, act); break; // at the head where the water comes in
      case 'graze': put(jit(i, 7) * hw * 1.4, jit(i, 8) * hl * 1.4, Le, Ln, act); break;
      default: put(jit(i, 9) * hw * 1.6, jit(i, 10) * hl * 1.6, jit(i, 11) > 0 ? Le : -Le, jit(i, 11) > 0 ? Ln : -Ln, act);
    }
  }
  return { plot: p.h, village, use: u.use, crop: u.row, stage: st.stage, e: ce, n: cn, w: p.w, l: p.l, spots };
}

/** every worked plot within r of (e, n) with work today (its spots non-empty), nearest first, at most `max` */
export function fieldWorkNear(zm: ZoneMap, villages: FieldVillage[], e: number, n: number, r: number, dayIndex: number, max = 200): FieldPlotWork[] {
  const seen = new Set<number>(), out: (FieldPlotWork & { d: number })[] = [], S = FIELD_WORK.step;
  for (let y = -r; y <= r; y += S) for (let x = -r; x <= r; x += S) {
    if (x * x + y * y > r * r) continue;
    const pe = e + x, pn = n + y, h = plotAt(pe, -pn).h; if (seen.has(h)) continue; seen.add(h);
    const w = plotWork(zm, villages, pe, pn, dayIndex); if (w && w.spots.length) out.push({ ...w, d: Math.hypot(w.e - e, w.n - n) });
  }
  return out.sort((a, b) => a.d - b.d).slice(0, max).map(({ d, ...w }) => (void d, w));
}
