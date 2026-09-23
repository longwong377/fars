// Column orders per building, from SITE_SPEC rows; sculpted profiles in sculpt.ts (D-014).
import { SPEC, row, v, tierOf } from './spec';
import type { ColumnOrder } from './parts';
import S from '../data/sculpture.json';
const has = (b: string, k: string) => SPEC[b]?.[k]?.v !== undefined;
/** capital height by type where SITE_SPEC has none for it: the composite keeps the Apadana's capital/shaft-diameter
 *  ratio (DERIVED, C); bull and plain capitals use sculpture.json (C) */
export function capitalHeight(type: ColumnOrder['capital'], shaftD: number): number {
  if (type === 'composite') return shaftD * (v('apadana', 'capital_height') / v('apadana', 'shaft_diameter_base'));
  if (type === 'bull') return shaftD * (S as any).capital.bull.v.h_over_d;
  if (type === 'plain') return shaftD * (S as any).capital.plain.v.h_over_d;
  return 0;
}
export function order(building: string, opts: Partial<ColumnOrder> = {}): ColumnOrder {
  const P = v<any>('global', 'r_column_proportions');
  const H = v(building, 'column_height');
  const shaftD: number = opts.shaftD ?? (has(building, 'shaft_diameter_base') ? v(building, 'shaft_diameter_base') : has(building, 'r_shaft') ? v(building, 'r_shaft') : Math.max(P.shaft_min, H * P.default_shaft_over_h));
  const cap = opts.capital ?? 'bull';
  // a building's capital_height row describes its own capital type (row `capital`, e.g. the Apadana's composite)
  const rowType = String(SPEC[building]?.capital?.v ?? '').split(':')[0].trim();
  const capH = has(building, 'capital_height') && (!rowType || rowType === cap) ? v(building, 'capital_height') : capitalHeight(cap, shaftD) || H * P.capital_frac_default;
  return { id: building, height: H, base: 'bell', baseH: Math.min(P.base_h_max, H * P.base_h_frac), baseW: shaftD * P.base_w_over_shaft, shaftD,
    flutes: has(building, 'flutes') ? v(building, 'flutes') : 40, capital: cap, capitalH: capH, material: 'limestone', ...opts };
}
export const orderTier = (building: string) => tierOf(row(building, 'column_height'));
