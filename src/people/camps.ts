// The court's camps and their tents (D-199; court setting only, D-003). Every camp of the court setting (src/data/court.json
// `camps`: the court's own camp below the Terrace, the retinue's camps in the town and on the plain) is laid out here as
// lines of tents, a pure function of the camp's definition and the kinds of its tents, so the simulation (which household
// sleeps in which tent: court.ts), the population view (where a person stands at the camp: popgeo.ts) and the renderer
// (world/courtCamps.ts) agree without sharing state.
//
// Evidence: that the court travelled with its tents and pitched them is a claim of the Greek authors (Herodotus 9.70 and
// 9.82: the Persian camp's tents, Xerxes' own tent left to Mardonius: HDT, B claims about an army in the field); the
// black goat-hair tent of the Iranian and Near-Eastern herders is an ethnographic analogue (C); the ridge tent of cloth on
// two poles and a ridge pole is C. Sizes, lines, lanes, spacing and the camps' places are C. Nothing about a court camp at
// Persepolis is known (Q-333).
import courtData from '../data/court.json';

type P2 = [number, number];
export type TentKind = 'ridge' | 'black' | 'pavilion';
/** tent sizes (m; w across the door, d front to back, h at the ridge; C) and how many sleep in one (C) */
export const TENT_KINDS: Record<TentKind, { w: number; d: number; h: number; sleeps: number; tier: 'C'; note: string }> = {
  ridge: { w: 4.6, d: 6.4, h: 2.3, sleeps: 10, tier: 'C', note: 'a ridge tent of undyed wool or linen cloth on two upright poles and a ridge pole, the walls pegged out low; sleeps about ten (C)' },
  black: { w: 8.6, d: 6.2, h: 1.9, sleeps: 12, tier: 'C', note: 'a black tent of woven goat hair on poles, low and wide with its long side to the front, which is open (the herders’ tent of Iran and the Near East: an ethnographic analogue, C)' },
  pavilion: { w: 7.2, d: 7.2, h: 3.3, sleeps: 10, tier: 'C', note: 'a larger tent of dyed cloth with a peaked roof for Persians of rank and officials (the king’s own tent is a Greek claim, HDT 9.82, B; this form C)' },
};
export interface CampDef { id: string; zone: 'town' | 'plain'; c: P2; r: number; axis: number; label: string; tier: string; src: string; note: string }
export interface Tent { camp: string; i: number; e: number; n: number; heading: number; kind: TentKind; w: number; d: number; h: number }
export const CAMPS: CampDef[] = (courtData as any).camps;
export const CAMP_BY_ID = new Map(CAMPS.map(c => [c.id, c]));
/** the place id of a camp in the plans (the court's own camp keeps its D-182 id) */
export const campPlace = (id: string) => (id === 'court' ? 'court_camp' : `rcamp:${id}`);
export const campOfPlace = (place: string): CampDef | null => (place === 'court_camp' ? CAMP_BY_ID.get('court')! : place.startsWith('rcamp:') ? CAMP_BY_ID.get(place.slice(6)) ?? null : null);

const LANE = 6, GAP = 3;
const jit = (i: number, s: number) => { const x = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return x - Math.floor(x); };
/** lay out `kinds.length` tents in lines across the camp's axis, nearest the centre first; the disc grows by 10 % steps
 *  when the tents do not fit (the radius used is returned) */
export function layoutCamp(def: CampDef, kinds: TentKind[]): { tents: Tent[]; r: number } {
  const n = kinds.length; if (!n) return { tents: [], r: def.r };
  const big = kinds.reduce((m, k) => ({ w: Math.max(m.w, TENT_KINDS[k].w), d: Math.max(m.d, TENT_KINDS[k].d) }), { w: 0, d: 0 });
  const pu = big.w + GAP, pv = big.d + LANE, a = (def.axis * Math.PI) / 180, fe = Math.sin(a), fn = Math.cos(a); // forward (the doors face it)
  let r = def.r, cells: P2[] = [];
  for (let k = 0; k < 20; k++, r *= 1.1) {
    cells = []; const nu = Math.ceil(r / pu), nv = Math.ceil(r / pv);
    for (let iv = -nv; iv <= nv; iv++) for (let iu = -nu; iu <= nu; iu++) { const u = iu * pu + (iv % 2 ? pu / 2 : 0), v = iv * pv; if (Math.hypot(u, v) <= r - Math.max(big.w, big.d) / 2) cells.push([u, v]); }
    if (cells.length >= n) break;
  }
  cells.sort((p, q) => Math.hypot(p[0], p[1]) - Math.hypot(q[0], q[1]) || p[1] - q[1] || p[0] - q[0]);
  const tents: Tent[] = kinds.map((kind, i) => { const [u, v] = cells[i], K = TENT_KINDS[kind], ju = (jit(i, 1) - 0.5) * 0.8, jv = (jit(i, 2) - 0.5) * 0.8;
    // u runs to the right of the forward direction: (e, n) = (fn, −fe)
    const e = def.c[0] + (u + ju) * fn + (v + jv) * fe, nn = def.c[1] - (u + ju) * fe + (v + jv) * fn;
    return { camp: def.id, i, e: +e.toFixed(2), n: +nn.toFixed(2), heading: def.axis + (jit(i, 3) - 0.5) * 8, kind, w: K.w, d: K.d, h: K.h }; });
  return { tents, r };
}
/** the point in front of a tent's door (m out from the front, m across from its middle) and the tent's forward heading */
export function beforeDoor(t: Tent, out: number, across: number): P2 {
  const a = (t.heading * Math.PI) / 180, fe = Math.sin(a), fn = Math.cos(a), f = t.d / 2 + out;
  return [t.e + fe * f + fn * across, t.n + fn * f - fe * across];
}
