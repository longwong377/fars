// The shared interface of the emergent economy (s13, UD-26, T-F9; D-338). Owned by the economy; the living-talk layer codes to it.
export type NeedKind = 'food' | 'fuel' | 'water' | 'cash' | 'help' | 'health' | 'kin';
export interface HouseholdNeed { hh: string; kind: NeedKind; urgency: number /* 0..1 */ }
export interface Intent { kind: 'trade' | 'work' | 'help' | 'visit' | 'news' | 'loan' | 'petition'; from: string; to: string; day: number;
  /** the deed's goods and words; `causes`: the economy event ids it answers (D-340) */ payload: Record<string, number | string | number[]> }
export interface EconWorld {
  needsOf(hh: string): HouseholdNeed[];
  price(good: string, day: number): number;
  applyIntent(i: Intent): { ok: boolean; changes: string[] };
  step(day: number): void;
  snapshot(): unknown;
}
