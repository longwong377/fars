// The court in the town's economy (D-383; UD-10, UD-26). While the court is in residence its table is fed from the royal
// stores (the Fortification texts' rations for the king's travels and table, B: grain, flour and beer drawn by the day for the
// king and his people), its purveyors buy barley in the market, its household hires day labour paid in barley, and its people
// buy the crafts' goods; when it leaves, what is left of its stores comes down to the market and the crafts' trade goes slack.
// The amounts are C (reasoned to the town's scale, tuned so that a lean year cuts the rations and a common one does not).
/** the court's days, as courtYear(seed) gives them (only these two are read) */
export interface CourtDays { arrive: number; leave: number }
export const COURT = {
  /** the royal stores drawn for the court's table each day, as a multiple of the town's daily ration need (C; the king's
   *  table was said to feed some 15,000 a day: Heracleides of Cumae in Athenaeus IV 145, B) */
  table: 2,
  /** the stores the province brings ahead for the king's coming, in days of the table's draw, scaled by the year's rains
   *  (a dry winter, a short gathering: the lean year in which the rations are cut; B for the gathering, C for the amount) */
  ahead: 18,
  /** the purveyors' first buying on the arrival (kg per household, at most `arriveShare` of the market), and every few days
   *  while it stays, a share of what the market holds (C) */
  buyArrive: 25, arriveShare: 0.6, buyEvery: 5, buyShare: 0.15,
  /** the court's household hires up to this many day labourers a day, paid in barley (eat * days of pay; C) */
  hires: 16, pay: 8,
  /** the crafts' goods: demand while the court stays, and for SLACK days after it leaves (C) */
  demandStay: 1.35, demandAfter: 0.8, slack: 30,
  /** what is left of the court's stores sold off on the leave day, as a share of all its purveyors bought (C) */
  sellOff: 0.4,
} as const;
