// D-339: the shared economy interface, copied verbatim from the s13 brief. The economy branch owns it
// (src/people/economy/api.ts); until that branch lands this copy stands in, and on merge this file becomes
// `export * from '../economy/api'`. Nothing here may diverge from the brief's text.
export type NeedKind = 'food' | 'fuel' | 'water' | 'cash' | 'help' | 'health' | 'kin';
export interface HouseholdNeed { hh: string; kind: NeedKind; urgency: number /* 0..1 */ }
export interface Intent { kind: 'trade' | 'work' | 'help' | 'visit' | 'news' | 'loan' | 'petition'; from: string; to: string; day: number; payload: Record<string, number | string> }
export interface EconWorld { needsOf(hh: string): HouseholdNeed[]; price(good: string, day: number): number; applyIntent(i: Intent): { ok: boolean; changes: string[] }; step(day: number): void; snapshot(): unknown }
