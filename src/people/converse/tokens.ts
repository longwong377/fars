// D-315: tokens of English prompt text, estimated without a tokenizer (the browser counts before it asks; the node tests
// hold the prompt budget with it). Calibrated on the Qwen2.5 and Gemma-2 tokenizers over the T-E9 set's prompts with
// memory lines (tools/dev/converse_tokens.ts, session 12: the raw count ran 14-22 % over both; scaled by 0.945 it is at or
// above the true count for every prompt of the set, by 0-8 %).
export function approxTokens(s: string): number { let n = 0; for (const w of s.split(/\s+/)) { if (!w) continue; const ascii = /^[\x00-\x7f]*$/.test(w); n += ascii ? Math.max(1, Math.ceil(w.length / 4.2)) + (/[^A-Za-z]/.test(w) ? 0.5 : 0) : Math.ceil(w.length / 1.8); } return Math.ceil(n * 0.945); }
