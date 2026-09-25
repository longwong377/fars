// The court as an assembly (D-221; rubric s7 pass 2 item 7): order metrics over the population view's people at a time.
//  - guards: of the king's spearmen standing at their posts, the share whose nearest file-mate stands 0.8-1.3 m away, who
//    face within 10 deg of their file's heading and stand within 0.25 m of their post (not pushed off it);
//  - parties: of the petitioners' and delegates' parties waiting on the Terrace (standing, not walking), the share of members
//    within 3 m of their party's centroid at that place;
//  - focus: of the people waiting on the Terrace for the audience (visitors, the Persians of rank and the ushers standing in
//    the forecourt, below the E stair and in the hall), the mean cosine between the way they face and the bearing to what
//    they wait on (the N stair, the E stair, the throne), and the share within 30 deg.
import type { PopView, ViewPerson } from '../../src/people/popview';
import { COURT_PLACES, COURT_SLOTS, focusOf } from '../../src/people/court';

type P2 = [number, number];
const POST = new Map(COURT_PLACES.filter(p => p.kind === 'post' && p.anchor).map(p => [p.id, p]));
const SLOT_OF = new Map<string, number>(); COURT_SLOTS.forEach((s, i) => s.posts.forEach(p => SLOT_OF.set(p, i)));
const angDiff = (a: number, b: number) => { const d = (((a - b) % 360) + 540) % 360 - 180; return Math.abs(d); };
const bearing = (from: P2, to: P2) => (Math.atan2(to[0] - from[0], to[1] - from[1]) * 180) / Math.PI;

export interface CourtOrder {
  guards: number; guardsOrdered: number; guardShare: number; guardSpacingMedian: number;
  waiting: number; partyNear: number; partyShare: number; parties: number;
  focusN: number; focusCos: number; focus30: number;
}
export function courtOrder(view: PopView, centre: P2, radius: number): CourtOrder {
  const K = view.pop.court!; const all = view.query(centre, radius).filter(o => o.agent < 0 && K.owns(o.pid)) as ViewPerson[];
  // guards
  const bySlot = new Map<number, ViewPerson[]>();
  for (const o of all) { if (o.moving || o.act !== 'stand_guard' || !POST.has(o.place)) continue; const s = SLOT_OF.get(o.place)!; (bySlot.get(s) ?? bySlot.set(s, []).get(s)!).push(o); }
  let guards = 0, ordered = 0; const sp: number[] = [];
  for (const L of bySlot.values()) for (const o of L) { guards++; let d = Infinity; for (const q of L) if (q !== o) d = Math.min(d, Math.hypot(q.e - o.e, q.n - o.n));
    const P = POST.get(o.place)!; if (Number.isFinite(d)) sp.push(d);
    if (d >= 0.8 && d <= 1.3 && angDiff(o.heading, P.heading ?? 0) <= 10 && Math.hypot(o.e - P.at[0], o.n - P.at[1]) <= 0.25) ordered++; }
  sp.sort((a, b) => a - b);
  // parties waiting
  const groups = new Map<string, ViewPerson[]>();
  for (const o of all) { if (o.moving || K.member(o.pid)?.g !== 'visitor') continue; if (!/^(queue|rest|talk|shelter|inspect)$/.test(o.act)) continue;
    const k = `${view.pop.persons[o.pid].idx}|${o.place}`; (groups.get(k) ?? groups.set(k, []).get(k)!).push(o); }
  let waiting = 0, near = 0, parties = 0;
  for (const L of groups.values()) { if (L.length < 2) continue; parties++; const ce = L.reduce((s, o) => s + o.e, 0) / L.length, cn = L.reduce((s, o) => s + o.n, 0) / L.length;
    for (const o of L) { waiting++; if (Math.hypot(o.e - ce, o.n - cn) <= 3) near++; } }
  // focus
  let fn = 0, fc = 0, f30 = 0;
  for (const o of all) { if (o.moving) continue; const m = K.member(o.pid); if (!m) continue;
    const waits = (m.g === 'visitor' && /^(queue|rest|shelter|inspect)$/.test(o.act)) || (m.g === 'nobles' && o.act === 'inspect') || (m.g === 'officials' && m.role === 'usher' && o.act === 'inspect');
    if (!waits) continue; const f = focusOf(o.place, o.e, o.n); if (!f) continue; const b = bearing([o.e, o.n], f); fn++; fc += Math.cos((angDiff(o.heading, b) * Math.PI) / 180); if (angDiff(o.heading, b) <= 30) f30++; }
  return { guards, guardsOrdered: ordered, guardShare: guards ? ordered / guards : 0, guardSpacingMedian: sp.length ? sp[sp.length >> 1] : NaN,
    waiting, partyNear: near, partyShare: waiting ? near / waiting : 0, parties, focusN: fn, focusCos: fn ? fc / fn : 0, focus30: fn ? f30 / fn : 0 };
}
