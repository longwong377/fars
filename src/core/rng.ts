// One seed drives all randomness (brief §6). Each subsystem derives its own stream from WORLD_SEED + a name,
// so adding a consumer never perturbs another subsystem's sequence.
export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}

export class Rng {
  private a: number; private b: number; private c: number; private d: number;
  constructor(seed: number, stream = '') {
    const h = hashString(stream);
    this.a = seed >>> 0; this.b = h; this.c = (seed ^ 0x9e3779b9) >>> 0; this.d = (h ^ 0x85ebca6b) >>> 0;
    for (let i = 0; i < 16; i++) this.next();
  }
  /** sfc32, uniform in [0,1) */
  next(): number {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = this.b ^ (this.b >>> 9);
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.c = (this.c + t) >>> 0;
    return t / 4294967296;
  }
  range(lo: number, hi: number) { return lo + (hi - lo) * this.next(); }
  int(lo: number, hiIncl: number) { return lo + Math.floor(this.next() * (hiIncl - lo + 1)); }
  chance(p: number) { return this.next() < p; }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
  /** standard normal (Box-Muller) */
  normal(): number {
    let u = 0; while (u === 0) u = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.next());
  }
  state(): number[] { return [this.a, this.b, this.c, this.d]; }
  setState(s: number[]) { [this.a, this.b, this.c, this.d] = s; }
}

export const WORLD_SEED_DEFAULT = 1;
export function stream(seed: number, name: string) { return new Rng(seed, name); }
