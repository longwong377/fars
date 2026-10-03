// D-780 (holes #10, #18; UD-09, UD-10, UD-29): the court's recurring events, as simulation and not as cutscenes. A pure
// function of the world seed and the day (and the court's year, courtYear.ts), so the calendar, the court's people
// (court.ts), the music (audio/performers.ts) and the census (tools/dev/court_census.ts) all read the same programme, and a
// player who walks the Terrace on any day of the residence meets what that day holds. The Apadana reliefs are the
// programme (src/data/court.json `ceremony`, every day, hour, count and place C):
//  - the audience: the king enthroned under the canopy in the Apadana, the chiliarch before him with his hand raised before
//    his mouth, the parties led up by their ushers and presented, the leader bowing (TREAS-AUD, IR-CHIL: B for the form);
//  - the days of the peoples' gifts: every delegation at Persepolis goes up in the reliefs' order behind its usher with its
//    gifts and animals (APA-RELIEF: B for the form; KING2022: the New Year's trips to the king, B pattern);
//  - the king's gifts and sacrifice the morning after he comes (Xenophon Cyr. 8.5.21, a claim: B), and the tukta, his
//    birthday feast (Herodotus 9.110: B claim), on a day the seed draws;
//  - great banquets in the Apadana at night: the Persians of rank and the senior officials at low tables between the columns,
//    the servers crossing the Terrace from the kitchens with the dishes, lamps (Heracleides in Athenaeus 4.145: B claim);
//  - the king's ride out from the palace down the Great Stair to the royal horse lines and back, and the hunt on the plain
//    (Cyr. 8.3, 1.4, 8.1.38: B claims);
//  - every day: the watches changing at 06, 14 and 22, the magi's fire at dawn, the grooms exercising the horses, and the
//    royal-road couriers riding in at the gallop (HDT 8.98: B claim).
// Nothing here moves anyone: court.ts reads the programme into each person's day.
import courtData from '../data/court.json';
import siteSpec from '../data/site_spec.json';
import { u01, salt } from './hash';
import { courtYear } from './courtYear';

const CE = (courtData as any).ceremony, KING = (courtData as any).king;
const S = { gift: salt('cer-gift'), giftStep: salt('cer-gift-step'), aud: salt('court-audience'), ride: salt('cer-ride'), hunt: salt('cer-hunt'), huntStep: salt('cer-hunt-step'),
  bq: salt('cer-banquet'), bday: salt('cer-birthday'), hours: salt('cer-hours'), cour: salt('cer-couriers') };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const rng = (seed: number, s: number, ...k: number[]) => u01(seed, s, ...k);

export type CeremonyKind = 'audience' | 'gift_day' | 'king_gifts' | 'birthday' | 'banquet' | 'ride' | 'hunt' | 'guard_change' | 'dawn_rite' | 'exercise' | 'courier';
/** one event of the court's day: when, where, who (by role, with counts) and what it is (the dev overlay and the census) */
export interface Ceremony { kind: CeremonyKind; day: number; t0: number; t1: number; place: string; who: [string, number][]; tier: 'B' | 'C'; src: string; note: string }

/** the court's set days of a seed's residence (cached): gift days, hunts, the birthday, the great banquets */
export interface CourtSetDays { gift: number[]; hunt: number[]; birthday: number; kingGifts: number; banquet: Set<number> }
const cache = new Map<number, CourtSetDays>();
export function courtSetDays(seed: number): CourtSetDays {
  let y = cache.get(seed); if (y) return y; const Y = courtYear(seed), G = CE.gift_days, H = CE.hunt, B = CE.banquet;
  const gift: number[] = []; let g = Y.arrive + G.first_after[0] + Math.floor(rng(seed, S.gift) * (G.first_after[1] - G.first_after[0] + 1));
  for (let k = 0; g <= Y.lastDay - G.before_leave; k++) { gift.push(g); g += G.step[0] + Math.floor(rng(seed, S.giftStep, k) * (G.step[1] - G.step[0] + 1)); }
  const hunt: number[] = []; let h = Y.arrive + H.first_after;
  for (let k = 0; h < Y.lastDay; k++) { const day = gift.includes(h) || gift.includes(h + 1) ? h + 2 : h; if (day < Y.lastDay) hunt.push(day); h = day + H.step[0] + Math.floor(rng(seed, S.huntStep, k) * (H.step[1] - H.step[0] + 1)); }
  const W = CE.birthday.window; let birthday = Y.arrive + W[0] + Math.floor(rng(seed, S.bday) * (W[1] - W[0] + 1));
  if (birthday >= Y.lastDay) birthday = Y.lastDay - 2; while (gift.includes(birthday) || hunt.includes(birthday)) birthday++;
  const kingGifts = Y.arrive + 1, banquet = new Set<number>([kingGifts, ...gift, birthday]);
  for (let d = Y.arrive + 2; d < Y.lastDay; d++) if (!hunt.includes(d) && rng(seed, S.bq, d) < B.share) banquet.add(d);
  y = { gift, hunt, birthday, kingGifts, banquet }; cache.set(seed, y); return y;
}
/** is day d inside the residence, the king's day and the leave day excluded (the days the court's programme runs) */
export const inResidence = (seed: number, d: number) => { const Y = courtYear(seed); return d > Y.arrive && d < Y.leave; };
export const isGiftDay = (seed: number, d: number) => courtSetDays(seed).gift.includes(d);
export const isHuntDay = (seed: number, d: number) => courtSetDays(seed).hunt.includes(d);
export const isBanquetNight = (seed: number, d: number) => inResidence(seed, d) && courtSetDays(seed).banquet.has(d);
/** the king's audience by the seed's draw (the king's illness aside: CourtResidents.audienceDay): most mornings of the
 *  residence (C1's ask, the king seen daily: court.json ceremony.audience_share), a gift day always, a hunt day never */
export function audienceDraw(seed: number, d: number): boolean {
  if (!inResidence(seed, d) || isHuntDay(seed, d)) return false; if (isGiftDay(seed, d)) return true;
  return u01(seed, S.aud, d) < CE.audience_share;
}
/** the king drives out this afternoon (not on a hunt day, not on the day of his gifts) */
export const isRideDay = (seed: number, d: number) => inResidence(seed, d) && !isHuntDay(seed, d) && d !== courtSetDays(seed).kingGifts && rng(seed, S.ride, d) < CE.ride.share;
/** the hours of a day's events (shared by everyone in them) */
export function ceremonyHours(seed: number, d: number) {
  const u = (k: number) => rng(seed, S.hours, d, k), R = CE.ride, H = CE.hunt, B = CE.banquet, G = CE.gift_days;
  const ride0 = lerp(R.start[0], R.start[1], u(1)), hunt0 = lerp(H.start[0], H.start[1], u(3)), bq0 = lerp(B.start[0], B.start[1], u(5)), gift0 = lerp(G.start[0], G.start[1], u(7));
  return { ride: [ride0, ride0 + lerp(R.len[0], R.len[1], u(2))] as [number, number], hunt: [hunt0, hunt0 + lerp(H.len[0], H.len[1], u(4))] as [number, number],
    banquet: [bq0, bq0 + lerp(B.len[0], B.len[1], u(6))] as [number, number], gift0 };
}
/** the royal-road couriers riding in on day d: the hour each reaches the road station (C) */
export function couriersOn(seed: number, d: number): number[] {
  if (!inResidence(seed, d)) return []; const C = CE.couriers, n = C.per_day[0] + Math.floor(rng(seed, S.cour, d) * (C.per_day[1] - C.per_day[0] + 1));
  return Array.from({ length: n }, (_, i) => +lerp(C.hour[0], C.hour[1], (i + rng(seed, S.cour, d, i + 1)) / n).toFixed(3));
}

// ------------------------------------------------------------------ the banquet hall's seats
type P2 = [number, number];
/** D-780: the seats of a great banquet in the Apadana: round a low table in each bay between the columns (the 6 × 6 columns
 *  at the site_spec interaxial about the hall's centre), the bays on the carpet road from the N door to the throne and those
 *  beside the throne left clear; each seat with the heading that faces its table (C) */
export const FEAST_SEATS: { at: P2; heading: number; table: P2; couch?: boolean }[] = (() => {
  const F = CE.feast_hall, ia = (siteSpec as any).apadana.interaxial.v as number, [cx, cy] = F.centre as P2, out: { at: P2; heading: number; table: P2; couch?: boolean }[] = [];
  // (the columns stand at ±(k + ½) interaxials from the centre: the bays' middles at 0, ±1, ±2 interaxials and the outer bays
  // between the last columns and the walls at ±3)
  const offs = [-3 * ia, -2 * ia, -ia, 0, ia, 2 * ia, 3 * ia].map(x => Math.max(-F.half + 3.2, Math.min(F.half - 3.2, x))), offsY = offs;
  const R = F.table_ring_m, N = 8;
  for (const oy of [...offsY].reverse()) for (const ox of offs) { // (the bays nearest the throne last: N first, the W–E rows)
    if (Math.abs(ox) < 1) continue; // the carpet road and the throne bay
    if (oy < -1.5 * ia && Math.abs(ox) < 1.5 * ia) continue; // the bays beside the throne
    const t: P2 = [cx + ox, cy + oy];
    for (let k = 0; k < N; k++) { const a = (k + 0.5) / N * 2 * Math.PI, at: P2 = [+(t[0] + R * Math.sin(a)).toFixed(2), +(t[1] + R * Math.cos(a)).toFixed(2)];
      out.push({ at, heading: (Math.atan2(t[0] - at[0], t[1] - at[1]) * 180 / Math.PI + 360) % 360, table: t }); }
  }
  // D-780 (the lead: guests by rank): the seats nearest the king's place first, so the first diners (the chiliarch, then the
  // Persians of rank, the officials last: CourtResidents.seatOf) sit closest to the throne (C)
  const K0 = F.king_at as P2; out.sort((a, b) => Math.hypot(a.table[0] - K0[0], a.table[1] - K0[1]) - Math.hypot(b.table[0] - K0[0], b.table[1] - K0[1]) || a.at[0] - b.at[0] || a.at[1] - b.at[1]);
  // D-780 (the lead: couches for the top ranks): the tables nearest the throne are each set between two couches, one on its N
  // and one on its S side, in place of their ring of floor seats; the diner reclines facing the table, the couch's length
  // along it (workAnims RECLINE: the couch's middle 0.275 m to the diner's right, its front 0.4 m before him; C)
  const nT = CE.banquet.couch_tables as number, near: P2[] = []; for (const s of out) if (!near.some(t => t[0] === s.table[0] && t[1] === s.table[1])) near.push(s.table);
  const ct = near.slice(0, nT), isC = (t: P2) => ct.some(c => c[0] === t[0] && c[1] === t[1]), couches: typeof out = [];
  for (const t of ct) for (const h of [0, 180]) { const r = h * Math.PI / 180, f: P2 = [Math.sin(r), Math.cos(r)], rt: P2 = [Math.cos(r), -Math.sin(r)];
    couches.push({ at: [+(t[0] - 0.8 * f[0] - 0.275 * rt[0]).toFixed(3), +(t[1] - 0.8 * f[1] - 0.275 * rt[1]).toFixed(3)], heading: h, table: t, couch: true }); }
  return [...couches, ...out.filter(s => !isC(s.table))];
})();
/** the low tables of the banquet (their centres): furnish_palaces.ts lays one in each bay with seats */
export const FEAST_TABLES: P2[] = [...new Map(FEAST_SEATS.map(s => [`${s.table[0]},${s.table[1]}`, s.table])).values()];

// ------------------------------------------------------------------ the programme of a day
/** every event of the court's programme on day d (empty outside the residence) */
export function courtProgramme(seed: number, d: number): Ceremony[] {
  const Y = courtYear(seed), out: Ceremony[] = []; if (d < Y.arrive || d > Y.leave) return out;
  const SD = courtSetDays(seed), h = ceremonyHours(seed, d), here = inResidence(seed, d);
  const E = (kind: CeremonyKind, t0: number, t1: number, place: string, who: [string, number][], tier: 'B' | 'C', src: string, note: string) => out.push({ kind, day: d, t0: +t0.toFixed(3), t1: +t1.toFixed(3), place, who, tier, src, note });
  for (const t of CE.guard_change.hours as number[]) E('guard_change', t - 0.25, t + 0.25, 'court_guard_mess', [['king’s spearmen (the relieving files)', 200]], 'C', 'RECON', `the watch of the king’s spearmen changes at ${String(t).padStart(2, '0')}:00: the relieving files march out of the guards’ court to their posts (C)`);
  E('dawn_rite', 4.6, 6.2, 'offering_place', [['magi', 2], ...(d === SD.kingGifts || d === SD.birthday ? [['the king and his escort', 7] as [string, number]] : [])], 'C', 'HENK2008;RECON', CE.dawn_rite.note);
  if (!here) return out;
  E('exercise', CE.exercise.hours[0][0], CE.exercise.hours[0][1], 'rcamp:p_horse', [['grooms exercising the horses', 0]], 'C', 'POTTS2023;RECON', CE.exercise.note);
  E('exercise', CE.exercise.hours[1][0], CE.exercise.hours[1][1], 'rcamp:p_horse', [['grooms exercising the horses', 0]], 'C', 'POTTS2023;RECON', CE.exercise.note);
  for (const c of couriersOn(seed, d)) E('courier', c - 0.05, c + 0.6, 'station', [['a courier of the royal road', 1]], 'B', 'HDT;POTTS2023', 'a royal-road courier rides in at the gallop with letters for the court, takes them up to the Gate and rides out again at dawn (HDT 8.98: B claim; C)');
  if (d === SD.kingGifts) E('king_gifts', 9.0, 11.5, 'court_audience', [['the king', 1], ['Persians of rank', 0], ['officials', 0]], 'B', 'XEN-CYR', 'the king gives gifts to the Persians in the Apadana the morning after he comes to Persia (Cyr. 8.5.21: a claim, B; the place and hours C)');
  if (d === SD.birthday) E('birthday', 9.0, 11.0, 'court_audience', [['the king', 1], ['Persians of rank', 0]], 'B', 'HDT', CE.birthday.note);
  const aud = audienceDraw(seed, d);
  if (isGiftDay(seed, d)) E('gift_day', h.gift0, h.gift0 + CE.gift_days.max_len_h, 'court_audience', [['the king', 1], ['the chiliarch', 1], ['ushers', 0], ['delegations of the peoples', 0]], 'B', 'APA-RELIEF;KING2022', CE.gift_days.note);
  else if (aud) E('audience', KING.audience_start[0], KING.audience_start[1] + KING.audience_len[1], 'court_audience', [['the king', 1], ['the chiliarch', 1], ['ushers', 0], ['petitioners and parties', 0]], 'B', 'TREAS-AUD;IR-CHIL', 'the king enthroned under the canopy, the chiliarch before him, the parties called led up by their ushers and presented, the leader bowing with his hand raised before his mouth (the Treasury relief: B; the hours C)');
  if (isHuntDay(seed, d)) E('hunt', h.hunt[0], h.hunt[1], 'rcamp:p_horse', [['the king', 1], ['Persians of rank', CE.hunt.nobles[1]], ['beaters', CE.hunt.beaters], ['grooms', CE.hunt.grooms]], 'B', 'XEN-CYR', CE.hunt.note);
  else if (isRideDay(seed, d)) E('ride', h.ride[0], h.ride[1], 'rcamp:p_horse', [['the king', 1], ['his escort and bearers', 6], ['Persians of rank', CE.ride.nobles[1]], ['grooms', CE.ride.grooms]], 'B', 'XEN-CYR-8', CE.ride.note);
  if (SD.banquet.has(d)) E('banquet', h.banquet[0], h.banquet[1], 'court_feast', [['the king', 1], ['Persians of rank and officials', FEAST_SEATS.length], ['servers', 0], ['lamp bearers', CE.banquet.lamps]], 'B', 'ATH4-HERACL;ATH13-PARM', CE.banquet.note);
  return out.sort((a, b) => a.t0 - b.t0);
}
