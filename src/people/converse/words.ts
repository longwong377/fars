// D-450: numbers as a person of the town would say them, for what the language model is told (the brief is out of world
// English, but a 1-2 B model repeats "17 years ago" or "0.42 of silver" verbatim, and nobody in Parsa speaks in figures).
// One helper for every brief and every line of talk the simulation writes: counts, ages, ordinals, silver by weight.
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ORD: Record<string, string> = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' };

function card(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n < 1000) { const h = Math.floor(n / 100), r = n % 100; return (h === 1 ? 'a hundred' : `${ONES[h]} hundred`) + (r ? ' and ' + card(r) : ''); }
  if (n < 1e6) { const t = Math.floor(n / 1000), r = n % 1000; return (t === 1 ? 'a thousand' : `${card(t)} thousand`) + (r ? (r < 100 ? ' and ' : ' ') + card(r) : ''); }
  return 'many thousands';
}
/** a whole count in words: 0 → "no", 17 → "seventeen", 365 → "three hundred and sixty-five" (rounded; negatives as their size) */
export function numWords(n: number): string { const k = Math.round(Math.abs(n)); return k === 0 ? 'no' : card(k); }
/** an age in words ("a baby" under one year) */
export function ageWords(a: number): string { return a < 1 ? 'a baby' : card(Math.round(a)); }
/** an ordinal in words: 19 → "nineteenth", 21 → "twenty-first" */
export function ordWords(n: number): string {
  const w = card(Math.max(1, Math.round(n))); const m = w.match(/^(.*?)([a-z]+)$/)!; const last = m[2];
  return m[1] + (ORD[last] ?? (last.endsWith('y') ? last.slice(0, -1) + 'ieth' : last + 'th'));
}
/** "N days" / "a day" */
export const countWords = (n: number, unit: string, plural = unit + 's') => n === 1 ? `a ${unit}` : `${numWords(n)} ${plural}`;
/** how long ago, in days: "today", "yesterday", "three days ago", "half a month ago", "about three months ago" */
export function daysAgoWords(k: number): string {
  k = Math.max(0, Math.round(k)); if (k === 0) return 'today'; if (k === 1) return 'yesterday'; if (k < 8) return `${numWords(k)} days ago`;
  // (D-720, W5: Persis had no seven-day week: days, half a month, a month)
  if (k < 12) return `${numWords(k)} days ago`; if (k < 22) return 'half a month ago'; if (k < 45) return 'about a month ago';
  if (k < 330) { const m = Math.round(k / 30); return `about ${numWords(m)} months ago`; }
  const y = Math.round(k / 365); return y <= 1 ? 'about a year ago' : `about ${numWords(y)} years ago`;
}
/** silver by weight, as it was weighed out (a shekel ~8.3 g; the town's words, rounded to the fractions people used) */
export function silverSpoken(v: number): string {
  if (!(v > 0)) return 'no silver';
  if (v < 0.09) return 'a few grains of silver';
  if (v < 1) {
    const F: [number, string][] = [[1 / 8, 'an eighth of a shekel'], [1 / 4, 'a quarter of a shekel'], [1 / 3, 'a third of a shekel'], [1 / 2, 'half a shekel'], [2 / 3, 'two thirds of a shekel'], [3 / 4, 'three quarters of a shekel'], [1, 'a shekel']];
    let best = F[0]; for (const f of F) if (Math.abs(f[0] - v) < Math.abs(best[0] - v)) best = f; return `about ${best[1]} of silver`;
  }
  if (v < 20) { const h = Math.round(v * 2) / 2, w = Math.floor(h), half = h - w > 0;
    return `about ${w === 1 ? (half ? 'a shekel and a half' : 'a shekel') : `${card(w)}${half ? ' and a half' : ''} shekels`} of silver`; }
  return `about ${card(Math.round(v / 5) * 5)} shekels of silver`;
}
/** a safety net for text built elsewhere: every run of ASCII digits written as words ("19th" → "nineteenth", "3" → "three");
 *  a decimal is rounded to the nearest whole */
export function spellDigits(s: string): string {
  return s.replace(/\b(\d+)(st|nd|rd|th)\b/g, (_, d) => ordWords(Number(d))).replace(/\d+(?:\.\d+)?/g, d => numWords(Number(d)));
}
