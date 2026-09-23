// Fast keyed hashing for the abstract population (Phase 5, D-021). The detailed simulation draws from `Rng(seed, key)`
// streams; the tens of thousands of abstract people need millions of draws a year, so each draw here is a pure integer
// hash of (seed, salt, a, b, c): no state, no allocation, the same value whenever and in whatever order it is asked for.
// That is what makes a day plan a function of (seed, person, day) alone.
import { hashString } from '../core/rng';

/** 32-bit finaliser (murmur3 fmix) */
function fmix(h: number) { h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16; return h >>> 0; }
/** hash of up to four integers under a seed; uniform in [0, 2^32) */
export function h32(seed: number, a: number, b = 0, c = 0, d = 0): number {
  let h = fmix((seed ^ 0x9e3779b9) >>> 0);
  h = fmix((h ^ Math.imul(a | 0, 0xcc9e2d51)) >>> 0);
  h = fmix((h ^ Math.imul(b | 0, 0x1b873593)) >>> 0);
  h = fmix((h ^ Math.imul(c | 0, 0xe6546b64)) >>> 0);
  h = fmix((h ^ Math.imul(d | 0, 0x85ebca6b)) >>> 0);
  return h;
}
/** uniform in [0, 1) */
export const u01 = (seed: number, a: number, b = 0, c = 0, d = 0) => h32(seed, a, b, c, d) / 4294967296;
/** a named salt (string → int), computed once per call site */
export const salt = (name: string) => hashString(name) | 0;
/** a small stateful stream seeded from a hash (for building one plan: a few dozen draws in a fixed order) */
export class HStream {
  private i = 0;
  constructor(private seed: number, private a: number, private b = 0, private c = 0) {}
  next() { return u01(this.seed, this.a, this.b, this.c, this.i++); }
  range(lo: number, hi: number) { return lo + (hi - lo) * this.next(); }
  int(lo: number, hiIncl: number) { return lo + Math.floor(this.next() * (hiIncl - lo + 1)); }
  chance(p: number) { return this.next() < p; }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
}
/** Poisson count with mean m from one uniform (inverse CDF; m is small here) */
export function poisson(u: number, m: number): number {
  if (m <= 0) return 0;
  let k = 0, p = Math.exp(-m), s = p;
  while (u > s && k < 200) { k++; p *= m / k; s += p; }
  return k;
}
