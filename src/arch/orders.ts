// Column orders per building, from SITE_SPEC rows (greybox profiles; detailed carving is Phase 3).
import { row, v, tierOf } from './spec';
import type { ColumnOrder } from './parts';

/** composite capital proportions (C): bell/palm 23%, volute block 33%, double-protome 44% of capital height */
export function order(building: string, opts: Partial<ColumnOrder> = {}): ColumnOrder {
  const H = v(building, 'column_height');
  const capH = SPECHAS(building, 'capital_height') ? v(building, 'capital_height') : H * 0.18;
  const shaftD = SPECHAS(building, 'shaft_diameter_base') ? v(building, 'shaft_diameter_base') : Math.max(0.6, H / 12);
  return { id: `${building}`, height: H, base: 'bell', baseH: Math.min(1.6, H * 0.075), baseW: shaftD * 1.55, shaftD, flutes: SPECHAS(building, 'flutes') ? v(building, 'flutes') : 40,
    capital: 'bull', capitalH: capH, material: 'limestone', ...opts };
}
import { SPEC } from './spec';
function SPECHAS(b: string, k: string) { return SPEC[b]?.[k]?.v !== undefined; }
export function orderTier(building: string) { return tierOf(row(building, 'column_height')); }
