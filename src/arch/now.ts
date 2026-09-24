// The Now view (brief §1.1, stretch; D-201): the ruin as it stands today, as a TRANSFORM of the same parts the 467 BCE
// Terrace is built from (terrace.ts), not a separate model. Every 467 part is matched by the first rule of
// src/data/now_view.json whose selector fits it, and the rule's state says what is left of it today (kept, removed, a
// low stump, a column's base or shaft, jambs without their lintels, a modern reconstruction). A few additions are derived
// from parts too (the Gate's stone piers, the shelter over the Apadana E stair) or placed from the supplied guidebook plan
// (two fallen capitals, the monolithic basin). Pure data in, parts out: meshes, colliders and the tests consume it.
//
// Evidence: tier C throughout. The rules are the builder's RECOLLECTION of the site, NOT SEEN in this project (no survey,
// no photograph of the ruin): to be verified against Schmidt 1953 and dated photographs (now_view.json _meta).
import type { Part, Box, Column, ColumnOrder, Material, Pt } from './parts';
import { pointInPoly } from './parts';
import { v } from './spec';
import NOW from '../data/now_view.json';

type Tier = 'A' | 'B' | 'C';
export type NowState = 'kept' | 'removed' | 'stump' | 'base_only' | 'shaft' | 'shaft_fragment' | 'reconstructed' | 'jambs_only' | 'resurface';
export interface NowSelect { building?: string | string[]; kind?: string | string[]; material?: string[]; type?: Part['type']; at?: Pt[]; within?: [number, number, number, number] }
interface NowCommon { id: string; label: string; tier: Tier; confidence: string; src: string; note: string; placeholder?: boolean; modern?: boolean; params?: any }
export interface NowRule extends NowCommon { select: NowSelect; state: NowState }
export interface NowAddition extends NowCommon { make: 'gate_piers' | 'stair_shelter' | 'fallen_capital' | 'basin' }
export interface NowData { _meta: { caption: string; basis: string; tier: string; decision: string }; rules: NowRule[]; additions: NowAddition[]; not_shown: { what: string; why: string }[] }
export const NOW_DATA = NOW as unknown as NowData;
/** the out-of-world caption (English; shown by the shell while the view is on) */
export const NOW_CAPTION = NOW_DATA._meta.caption;

/** a column in the Now parts that still has a shaft (the standing-element list) */
export interface Standing { element: string; building: string; c: Pt; fragment: boolean }
export interface NowResult {
  parts: Part[];
  /** per element (rule or addition id): 467 parts matched and Now parts produced */
  byElement: Record<string, { matched: number; produced: number }>;
  standing: Standing[];
  /** 467 parts no rule matched (must be empty: every part has a stated fate) */
  unmatched: Part[];
}

/** at-selector tolerance (m): a listed column position matches a column centre within this */
export const AT_TOL = 0.3;
const asList = (x: string | string[] | undefined) => (x === undefined ? null : Array.isArray(x) ? x : [x]);
function centre(p: Part): Pt {
  if (p.type !== 'prism') return p.c;
  let x = 0, y = 0; for (const q of p.polygon) { x += q[0]; y += q[1]; } return [x / p.polygon.length, y / p.polygon.length];
}
export function selects(s: NowSelect, p: Part): boolean {
  const b = asList(s.building); if (b && !b.includes(p.building)) return false;
  const k = asList(s.kind); if (k && !k.includes(p.kind)) return false;
  if (s.material && !s.material.includes(p.material)) return false;
  if (s.type && p.type !== s.type) return false;
  const c = centre(p);
  if (s.within) { const [x0, x1, y0, y1] = s.within; if (c[0] < x0 || c[0] > x1 || c[1] < y0 || c[1] > y1) return false; }
  if (s.at && !s.at.some(a => Math.hypot(a[0] - c[0], a[1] - c[1]) <= AT_TOL)) return false;
  return true;
}
/** deterministic 0..1 from a position (stump heights vary per wall without a seed) */
const hash01 = (c: Pt) => { const s = Math.sin(c[0] * 12.9898 + c[1] * 78.233) * 43758.5453; return s - Math.floor(s); };

/** the order of a standing shaft whose capital is gone: shaft to the capital's seat, no capital */
export const shaftOrder = (o: ColumnOrder): ColumnOrder => ({ ...o, id: `${o.id}:now-shaft`, capital: 'none', height: o.height - o.capitalH, capitalH: 0 });
/** a rebuilt modern column: a plain shaft from the base to the order's full height (under the rebuilt roof), no capital */
export const toRoofOrder = (o: ColumnOrder): ColumnOrder => ({ ...o, id: `${o.id}:now-recon`, capital: 'none', capitalH: 0 });

function meta(e: NowCommon, p?: Part) {
  const was = p ? ` [467 part: ${p.building} ${p.kind}, ${p.material}, tier ${p.tier}]` : '';
  return { tier: e.tier, src: e.src, placeholder: !!e.placeholder, now: e.id, note: `NOW VIEW ${e.id} (confidence ${e.confidence}): ${e.note}${was}` };
}

function applyRule(r: NowRule, p: Part): Part[] {
  const m = meta(r, p), P = r.params ?? {};
  switch (r.state) {
    case 'removed': return [];
    case 'kept': return [{ ...p, ...m } as Part];
    case 'resurface': return [{ ...p, ...m, material: P.material as Material } as Part];
    case 'jambs_only': return p.type !== 'column' && p.y1 - p.y0 >= P.min_height ? [{ ...p, ...m } as Part] : [];
    case 'stump': {
      if (p.type !== 'box') throw new Error(`now: stump rule ${r.id} on a ${p.type}`);
      const h = Math.min(p.y1 - p.y0, Math.max(0.1, P.height + (hash01(p.c) * 2 - 1) * (P.jitter ?? 0)));
      return [{ ...p, ...m, kind: 'stump', material: (P.material ?? 'earth') as Material, y1: p.y0 + h, solid: true } as Box];
    }
    case 'base_only': {
      if (p.type !== 'column') throw new Error(`now: base_only rule ${r.id} on a ${p.type}`);
      return [{ ...p, ...m, built: 0 } as Column];
    }
    case 'shaft': case 'shaft_fragment': {
      if (p.type !== 'column') throw new Error(`now: ${r.state} rule ${r.id} on a ${p.type}`);
      const o = shaftOrder(p.order), out: Part[] = [{ ...p, ...m, order: o, built: 1 } as Column];
      if (r.state === 'shaft_fragment') {
        const w = p.order.shaftD * P.width_of_shaft, y0 = p.y0 + o.height;
        out.push({ ...m, building: p.building, kind: 'capital_fragment', material: p.order.material === 'timber' ? 'limestone' : p.order.material, type: 'box', c: p.c, size: [w, w], y0, y1: y0 + p.order.capitalH * P.fraction_of_capital, solid: true } as Box);
      }
      return out;
    }
    case 'reconstructed': {
      if (p.type === 'column') return [{ ...p, ...m, order: toRoofOrder(p.order), built: 1 } as Column];
      return [{ ...p, ...m, material: (P.material ?? p.material) as Material, kind: P.kind ?? p.kind, solid: P.kind === 'modern_roof' ? true : p.solid } as Part];
    }
  }
}

function footprintBounds(ps: Box[]) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  for (const p of ps) { x0 = Math.min(x0, p.c[0] - p.size[0] / 2); x1 = Math.max(x1, p.c[0] + p.size[0] / 2); y0 = Math.min(y0, p.c[1] - p.size[1] / 2); y1 = Math.max(y1, p.c[1] + p.size[1] / 2); z0 = Math.min(z0, p.y0); z1 = Math.max(z1, p.y1); }
  return { x0, x1, y0, y1, z0, z1 };
}
/** the floor under a grid point among the given parts (highest top of a platform, floor, landing, step or pavement part
 *  containing it), or the court datum 0 when nothing stands there but the Terrace platform */
function floorAt(parts: Part[], x: number, y: number): number {
  let top = -Infinity;
  for (const p of parts) {
    if (p.type === 'column') continue;
    if (!['platform', 'floor', 'landing', 'step', 'pavement', 'portico_floor'].includes(p.kind)) continue;
    if (p.type === 'prism' ? pointInPoly(x, y, p.polygon) : insideBox(p, x, y, 0)) top = Math.max(top, p.y1);
  }
  return top;
}
export function insideBox(b: Box, x: number, y: number, pad: number): boolean {
  const r = -(b.rot ?? 0), dx = x - b.c[0], dy = y - b.c[1];
  const u = dx * Math.cos(r) - dy * Math.sin(r), w = dx * Math.sin(r) + dy * Math.cos(r);
  return Math.abs(u) <= b.size[0] / 2 + pad && Math.abs(w) <= b.size[1] / 2 + pad;
}

function addition(a: NowAddition, parts467: Part[]): Part[] {
  const m = meta(a), P = a.params ?? {}, stone: Material = 'limestone';
  const box = (building: string, kind: string, material: Material, c: Pt, size: [number, number], y0: number, y1: number, rot = 0): Box =>
    ({ ...m, building, kind, material, type: 'box', c, size, y0, y1, rot, solid: true });
  switch (a.make) {
    case 'gate_piers': {
      const floor = (parts467.find(p => p.building === 'gate_nations' && p.kind === 'floor') as Box | undefined)?.y1 ?? 0;
      const top = floor + v<number>('gate_nations', 'door_height');
      return (parts467.filter(p => p.building === 'gate_nations' && p.kind === 'colossus') as Box[])
        .map(c => box('gate_nations', 'pier', stone, c.c, c.size, c.y1, Math.max(c.y1 + 0.1, top)));
    }
    case 'stair_shelter': {
      const f = parts467.filter(p => p.building === P.stair && p.type === 'box' && (p.kind === 'facade' || p.kind === 'step') && (P.side === 'E' ? p.c[0] > 45 : false)) as Box[];
      if (!f.length) return [];
      const B = footprintBounds(f), fac = footprintBounds(f.filter(p => p.kind === 'facade'));
      const court = 0, podium = floorAt(parts467, B.x0 - 1, (B.y0 + B.y1) / 2); // the podium top behind the stair
      const xf = fac.x1 + P.front, xb = B.x0 - 0.5 - P.post / 2, roof = court + P.clear_height;
      const out: Box[] = [];
      const n = Math.max(1, Math.round((B.y1 - B.y0) / P.spacing));
      for (let i = 0; i <= n; i++) {
        const y = B.y0 + ((B.y1 - B.y0) * i) / n;
        out.push(box(P.stair, 'modern_shelter', 'steel', [xf, y], [P.post, P.post], court, roof));
        out.push(box(P.stair, 'modern_shelter', 'steel', [xb, y], [P.post, P.post], Number.isFinite(podium) ? podium : court, roof));
      }
      out.push(box(P.stair, 'modern_shelter', 'steel', [(xf + xb) / 2, (B.y0 + B.y1) / 2], [xf - xb + 1.0, B.y1 - B.y0 + 1.0], roof, roof + P.thickness));
      return out;
    }
    case 'fallen_capital': {
      const [x, y] = P.at as Pt, f = floorAt(parts467, x, y), y0 = Number.isFinite(f) ? f : 0;
      return [box('terrace', 'fallen_capital', stone, [x, y], P.size, y0, y0 + P.height, P.rot ?? 0)];
    }
    case 'basin': {
      const [x, y] = P.at as Pt, [sx, sy] = P.size as [number, number], t = P.wall, f = floorAt(parts467, x, y), y0 = Number.isFinite(f) ? f : 0, y1 = y0 + P.height;
      return [
        box('terrace', 'basin', stone, [x, y], [sx, sy], y0, y0 + t), // the floor of the trough
        box('terrace', 'basin', stone, [x, y - sy / 2 + t / 2], [sx, t], y0 + t, y1), box('terrace', 'basin', stone, [x, y + sy / 2 - t / 2], [sx, t], y0 + t, y1),
        box('terrace', 'basin', stone, [x - sx / 2 + t / 2, y], [t, sy - 2 * t], y0 + t, y1), box('terrace', 'basin', stone, [x + sx / 2 - t / 2, y], [t, sy - 2 * t], y0 + t, y1),
      ];
    }
  }
}

/** The Now parts: every 467 part through the first matching rule, then the additions. */
export function nowParts(parts467: Part[], data: NowData = NOW_DATA): NowResult {
  const out: Part[] = [], byElement: NowResult['byElement'] = {}, standing: Standing[] = [], unmatched: Part[] = [];
  for (const r of data.rules) byElement[r.id] = { matched: 0, produced: 0 };
  for (const p of parts467) {
    const r = data.rules.find(q => selects(q.select, p));
    if (!r) { unmatched.push(p); continue; }
    const q = applyRule(r, p); byElement[r.id].matched++; byElement[r.id].produced += q.length; out.push(...q);
    for (const c of q) if (c.type === 'column' && c.built > 0 && (r.state === 'shaft' || r.state === 'shaft_fragment')) standing.push({ element: r.id, building: c.building, c: c.c, fragment: r.state === 'shaft_fragment' });
  }
  for (const a of data.additions) { const q = addition(a, parts467); byElement[a.id] = { matched: 0, produced: q.length }; out.push(...q); }
  return { parts: out, byElement, standing, unmatched };
}
/** the element (rule or addition) of the Now data a Now part came from */
export const elementOf = (p: Part): NowCommon | undefined => { const id = (p as any).now as string | undefined; return id ? (NOW_DATA.rules.find(r => r.id === id) ?? NOW_DATA.additions.find(a => a.id === id)) : undefined; };
export { floorAt as nowFloorAt };
