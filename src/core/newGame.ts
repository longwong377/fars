// D-239 (D-252): where a new game begins in time. With the court coming and going by default (D-236), a new game (a fresh world
// seed, no ?day and no save) begins at dawn 1-3 days (the seed's draw) before the seed's arrival of the court, so the first
// visit can hold the defining event: the preparations, the heralds on the road, the column coming in. The day is the seed's,
// never the player's (T-F6); a player can still pick any date. With the court setting off it is the old start, day 0 at 07:00.
import courtData from '../data/court.json';
import { newGameDay } from '../people/courtYear';
import { sunTimes } from '../people/calendar';

/** the start of a new game for a world seed: the day of the regnal year and the hour (local) */
export function newGameStart(seed: number, court = true): { day: number; hour: number } {
  if (!court) return { day: 0, hour: 7.0 };
  const day = newGameDay(seed); return { day, hour: +(sunTimes(day).rise - (courtData as any).arrival.dawn_before_rise_h).toFixed(3) };
}
