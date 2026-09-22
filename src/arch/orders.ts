// Column orders per building, from SITE_SPEC rows (greybox profiles; detailed carving is Phase 3+).
import { SPEC, row, v, tierOf } from './spec';
import type { ColumnOrder } from './parts';
const has = (b: string, k: string) => SPEC[b]?.[k]?.v !== undefined;
export function order(building: string, opts: Partial<ColumnOrder> = {}): ColumnOrder {
  const P = v<any>('global', 'r_column_proportions');
  const H = v(building, 'column_height');
  const capH = has(building, 'capital_height') ? v(building, 'capital_height') : H * P.capital_frac_default;
  const shaftD: number = opts.shaftD ?? (has(building, 'shaft_diameter_base') ? v(building, 'shaft_diameter_base') : has(building, 'r_shaft') ? v(building, 'r_shaft') : Math.max(P.shaft_min, H * P.default_shaft_over_h));
  return { id: building, height: H, base: 'bell', baseH: Math.min(P.base_h_max, H * P.base_h_frac), baseW: shaftD * P.base_w_over_shaft, shaftD,
    flutes: has(building, 'flutes') ? v(building, 'flutes') : 40, capital: 'bull', capitalH: capH, material: 'limestone', ...opts, ...(opts.shaftD ? {} : {}) };
}
export const orderTier = (building: string) => tierOf(row(building, 'column_height'));
