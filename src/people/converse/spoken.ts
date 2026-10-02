// D-395: numbers as a person says them. The prompt is read by a small model (Qwen2.5-1.5B, D-394) that copies what it is
// told: "17 years ago", "day 21" or "1.5 shekels" came back aloud as digits (the cloud's playtest bot, s15), which the
// fence's no-digits rule then has to refuse. Every message to the model goes through spoken(): numbers in words, ordinals
// as ordinals, halves as halves, a clock time never (the sim gives none; one in the stranger's words is left to the fence).
const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
const ORD: Record<string, string> = { one: 'first', two: 'second', three: 'third', five: 'fifth', eight: 'eighth', nine: 'ninth', twelve: 'twelfth' };

/** a whole number in words (to the millions; beyond, the digits stay: nobody of the town counts so far) */
export function numberWords(n: number): string {
  if (!Number.isFinite(n) || n < 0 || n >= 1e9 || n !== Math.floor(n)) return String(n);
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? '-' + ONES[n % 10] : '');
  if (n < 1000) return ONES[Math.floor(n / 100)] + ' hundred' + (n % 100 ? ' and ' + numberWords(n % 100) : '');
  if (n < 1e6) return numberWords(Math.floor(n / 1000)) + ' thousand' + (n % 1000 ? (n % 1000 < 100 ? ' and ' : ' ') + numberWords(n % 1000) : '');
  return numberWords(Math.floor(n / 1e6)) + ' million' + (n % 1e6 ? ' ' + numberWords(n % 1e6) : '');
}
/** "twenty-one" → "twenty-first" */
export function ordinalWords(n: number): string {
  const w = numberWords(n), m = /([a-z]+)$/.exec(w); if (!m) return w; const last = m[1];
  const o = ORD[last] ?? (last.endsWith('y') ? last.slice(0, -1) + 'ieth' : last + 'th'); return w.slice(0, -last.length) + o;
}

/** the text with its numbers in words ("17 years ago" → "seventeen years ago"; "the 3rd day" → "the third day";
 *  "1.5" → "one and a half"; "2,000" → "two thousand") */
export function spoken(text: string): string {
  if (!/\d/.test(text)) return text;
  return text
    .replace(/\b(\d{1,3}(?:,\d{3})+|\d+)(st|nd|rd|th)\b/g, (_, d: string) => ordinalWords(Number(d.replace(/,/g, ''))))
    .replace(/\b(\d+)\.(25|5|75)\b/g, (_, a: string, f: string) => `${a === '0' ? '' : numberWords(Number(a)) + ' and '}${f === '5' ? 'a half' : f === '25' ? 'a quarter' : 'three quarters'}`.replace(/^and /, ''))
    .replace(/\b(\d+)\.(\d+)\b/g, (_, a: string, b: string) => `about ${numberWords(Math.round(Number(`${a}.${b}`)))}`)
    .replace(/\b\d{1,2}:\d{2}\b|\d{1,3}(?:,\d{3})+(?!\d)|\d+/g, d => (d.includes(':') ? d : numberWords(Number(d.replace(/,/g, '')))));
}
