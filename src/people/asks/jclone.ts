// D-388: a deep copy with exactly what JSON.parse(JSON.stringify(x)) gives (undefined, functions and symbols dropped from
// objects and null in arrays, non-finite numbers null, -0 as 0, toJSON honoured), ~4x faster on the rumours' saved holds
// (a year's save carries ~370k): the loads of the ask book and the rumour net copied their saves through JSON (~0.9 s at day 280).
export function jclone<T>(x: T): T {
  if (x === null || typeof x !== 'object') return (typeof x === 'number' ? (Number.isFinite(x) ? (x === 0 ? 0 : x) : null) : x) as T;
  if (typeof (x as { toJSON?: unknown }).toJSON === 'function') return JSON.parse(JSON.stringify(x));
  if (Array.isArray(x)) { const n = x.length, o = new Array(n); for (let i = 0; i < n; i++) { const v = x[i]; o[i] = v === undefined || typeof v === 'function' || typeof v === 'symbol' ? null : jclone(v); } return o as T; }
  const o: Record<string, unknown> = {}; for (const k in x) { if (!Object.prototype.hasOwnProperty.call(x, k)) continue; const v = (x as Record<string, unknown>)[k]; if (v === undefined || typeof v === 'function' || typeof v === 'symbol') continue; o[k] = jclone(v); }
  return o as T;
}
