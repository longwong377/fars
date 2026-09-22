// World clock: local mean time at Pārsa over the regnal year Xerxes 19 (DECISIONS D-003). Default time scale = real time.
import { START_JDN, YEAR_END_JDN, LMT_OFFSET_H, jdnToJulian, babylonianDate, OP_MONTH } from './calendar';

export class WorldClock {
  /** days since START_JDN at local midnight, fractional */
  t = 0;
  scale = 1; // real time
  paused = false;
  constructor(startDay = 0, hour = 7.0) { this.t = startDay + hour / 24; }
  get dayIndex() { return Math.floor(this.t); }
  get jdn() { return START_JDN + this.dayIndex; }
  get localHour() { return (this.t - Math.floor(this.t)) * 24; }
  /** UT Julian date (JD = JDN - 0.5 + UT/24); local mean time = UT + LMT_OFFSET_H */
  get jdUT() { return START_JDN + this.t - 0.5 - LMT_OFFSET_H / 24; }
  advance(realSeconds: number) {
    if (this.paused) return;
    this.t += (realSeconds * this.scale) / 86400;
    const maxT = YEAR_END_JDN - START_JDN + 1 - 1e-6;
    if (this.t > maxT) this.t = maxT; // the date stays within the chosen year
    if (this.t < 0) this.t = 0;
  }
  set(dayIndex: number, hour: number) { this.t = Math.max(0, Math.min(YEAR_END_JDN - START_JDN, dayIndex)) + hour / 24; }
  /** out-of-world label (translation layer / settings only) */
  label(): string {
    const j = jdnToJulian(this.jdn); const b = babylonianDate(this.jdn);
    const mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][j.m - 1];
    const h = Math.floor(this.localHour), mi = Math.floor((this.localHour - h) * 60);
    const bab = b ? `${b.day} ${b.month.name}${OP_MONTH[b.month.monthNo] ? ' (' + OP_MONTH[b.month.monthNo] + ')' : ''}` : '';
    return `${bab}, Xerxes yr 19 · ${j.d} ${mon} ${1 - j.y} BCE (Julian) · ${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')} local mean time`;
  }
}
export const YEAR_DAYS = YEAR_END_JDN - START_JDN + 1;
