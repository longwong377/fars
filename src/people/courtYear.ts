// The court's year (D-252; D-236, D-239; UD-09, UD-10): the day the court arrives, a pure function of the world seed alone, so
// the event log is the seed's and never the player's (T-F6: "the world does not perform"). Everything here is C
// (src/data/court.json `arrival`): one residence a year in spring, the court coming from Susa on a day the seed draws in the
// first weeks of Nisannu and leaving on E-26's day. No imports beyond the data and the hash, so the calendar (calendar.ts),
// the court (court.ts), the camps and the boot (core/newGame.ts) can all read it without a cycle.
import courtData from '../data/court.json';
import { u01, salt } from './hash';

const A = (courtData as any).arrival, R = (courtData as any).resident;
const S = { day: salt('court-arrival-day'), hour: salt('court-arrival-hour'), start: salt('court-new-game'), herald: salt('court-herald') };
export interface CourtYear {
  /** the king's day: the day the court's column comes in and the residence begins (day of the regnal year) */
  arrive: number;
  /** the hour the king reaches the road station on his day */
  kingHour: number;
  /** the first day anyone of the court is at Persepolis (the household that comes ahead to make ready) */
  first: number;
  /** the last day anyone of the court arrives (the camp followers) */
  last: number;
  /** the heralds' days (the couriers riding ahead with the word: T-F5) */
  heraldDays: [number, number];
  /** the last day of the residence and the leave day (E-26) */
  lastDay: number; leave: number;
}
const cache = new Map<number, CourtYear>();
/** the court's year for a world seed (C; D-252) */
export function courtYear(seed: number): CourtYear {
  let y = cache.get(seed); if (y) return y;
  const [w0, w1] = A.window as [number, number], arrive = w0 + Math.floor(u01(seed, S.day) * (w1 - w0 + 1));
  const kh = A.king_hour as [number, number], kingHour = kh[0] + (kh[1] - kh[0]) * u01(seed, S.hour);
  const offs = [...Object.values(A.groups as Record<string, any>).flatMap((g: any) => [g.day, g.advance_day ?? g.day]), ...Object.values(A.retinue as Record<string, any>).map((g: any) => g.day), A.heralds.days[0]];
  y = { arrive, kingHour, first: arrive + Math.min(...offs), last: arrive + Math.max(...offs), heraldDays: [arrive + A.heralds.days[0], arrive + A.heralds.days[1]], lastDay: R.last_day, leave: R.leave_day };
  cache.set(seed, y); return y;
}
/** D-239: the day a new game begins (dawn of it: core/newGame.ts), 1-3 days (the seed's draw) before the seed's arrival */
export function newGameDay(seed: number): number {
  const [a, b] = A.start_before as [number, number]; return courtYear(seed).arrive - (a + Math.floor(u01(seed, S.start) * (b - a + 1)));
}
/** is the court in residence on day d (from the king's day to the leave day, as E-25 to E-26) */
export const courtResident = (seed: number, d: number) => { const y = courtYear(seed); return d >= y.arrive && d <= y.leave; };
/** T-F5: the heralds riding ahead with the word (court.json arrival.heralds; C): for each, the day and the hour he reaches the
 *  road station; he takes the word up to the Gate, sleeps at the station and rides out W the next morning */
export function heralds(seed: number): { i: number; day: number; hour: number }[] {
  const H = A.heralds, y = courtYear(seed), out: { i: number; day: number; hour: number }[] = [];
  for (let d = y.heraldDays[0], i = 0; d <= y.heraldDays[1]; d++) for (let k = 0; k < H.per_day && i < H.n; k++, i++)
    out.push({ i, day: d, hour: +(H.hour[0] + (H.hour[1] - H.hour[0]) * (k + u01(seed, S.herald, i)) / H.per_day).toFixed(3) });
  return out;
}
