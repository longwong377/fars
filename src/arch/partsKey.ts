// The architecture parts as the probe, nav and fire-occlusion bakes key them (their `partsHash`). Numbers are rounded to 12
// significant digits: Chrome's and Node's Math.atan2/sin differ in the last bit (session 11: rotations 1e-16 rad apart made the
// page warn of stale probes on a fresh bake), and the bakes do not depend on anything that fine.
export const partsKey = (parts: unknown): string =>
  JSON.stringify(parts, (_k, v) => (typeof v === 'number' && Number.isFinite(v) ? +v.toPrecision(12) : v));
