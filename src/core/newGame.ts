// D-239 (D-252): where a new game begins in time. With the court coming and going by default (D-236), a new game (a fresh world
// seed, no ?day and no save) begins at dawn. The day is the seed's, never the player's (T-F6); a player can still pick any date.
// With the court setting off it is the old start, day 0 at 07:00.
// D-651 (s18 C12's hole #2): at dawn on the day AFTER the court's seed-chosen arrival, the court in residence. It began 1-3 days
// before the arrival, to hold the preparations and the column coming in; at the game's time scale that was 24-72 real hours of
// a Terrace with no court, and the king never in sight in a first visit. The arrival day itself stays the seed's (courtYear).
import courtData from '../data/court.json';
import { courtYear } from '../people/courtYear';
import { sunTimes } from '../people/calendar';

/** the start of a new game for a world seed: the day of the regnal year and the hour (local) */
export function newGameStart(seed: number, court = true): { day: number; hour: number } {
  if (!court) return { day: 0, hour: 7.0 };
  const day = courtYear(seed).arrive + 1; return { day, hour: +(sunTimes(day).rise - (courtData as any).arrival.dawn_before_rise_h).toFixed(3) };
}
