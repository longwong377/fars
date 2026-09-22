// Proleptic Julian calendar <-> Julian Day, and the Babylonian/Persian month for YEAR 467 BCE (DECISIONS D-003).
import cal from '../data/calendar_467.json';

export const YEAR_BCE = 467;
export const ASTRO_YEAR = 1 - YEAR_BCE; // -466

/** Julian Day Number (noon-based integer) for a proleptic Julian calendar date (astronomical year numbering). */
export function julianToJDN(y: number, m: number, d: number): number {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - 32083;
}

export function jdnToJulian(jdn: number): { y: number; m: number; d: number } {
  const c = jdn + 32082;
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return { d: e - Math.floor((153 * m + 2) / 5) + 1, m: m + 3 - 12 * Math.floor(m / 10), y: d - 4800 + Math.floor(m / 10) };
}

/** Julian Date (continuous, UT) from Julian-calendar date and local solar-ish clock hours in UT. */
export function julianDateUT(y: number, m: number, d: number, hoursUT: number): number {
  return julianToJDN(y, m, d) - 0.5 + hoursUT / 24;
}

export interface BabMonth { jdn: number; y: number; m: number; d: number; monthNo: number; name: string; days: number }
const months = (cal as { months: BabMonth[] }).months;

/** Old Persian month names retrieved so far (research/CALENDAR_AND_UNITS.md); others unknown => Babylonian name only. */
export const OP_MONTH: Record<number, string> = { 1: 'Adukanaiša', 2: 'Θūravāhara', 3: 'Θāigraciš', 4: 'Garmapada' };

/** Babylonian month containing the civil day starting at the given JDN (month day 1 = P&D date; the day actually began at the previous sunset). */
export function babylonianDate(jdn: number): { month: BabMonth; day: number } | null {
  for (let i = months.length - 1; i >= 0; i--) {
    if (jdn >= months[i].jdn) {
      const day = jdn - months[i].jdn + 1;
      if (day <= months[i].days) return { month: months[i], day };
      return null;
    }
  }
  return null;
}

/** Default start: 1 Nisannu, Xerxes yr 19 = 17 April 467 BCE (proleptic Julian), JDN 1550958. */
export const START_JDN = 1550958;
/** The simulated year runs over the regnal year: 1 Nisannu 467 to the last day of Addaru 466 BCE. */
export const YEAR_START_JDN = START_JDN;
export const YEAR_END_JDN = (() => { const i = months.findIndex(m => m.jdn === START_JDN); const last = months[i + 11]; return last.jdn + last.days - 1; })();

export const LONGITUDE_E = 52.8894969;
export const LATITUDE_N = 29.9351174;
/** Local mean solar time offset from UT, hours. The world clock runs on local mean time. */
export const LMT_OFFSET_H = LONGITUDE_E / 15;
