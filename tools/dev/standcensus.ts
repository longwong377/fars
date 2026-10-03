// dev (s18 C5, D-690): who stands where near the walk's crowded places. For each place: the population's people standing
// within R m (the detailed agents counted apart), the nearest-neighbour distances between them (share under 1.0 m and
// 0.6 m), how many stand in a door opening or its apron (PopView.inDoor), how many stand facing one way as a grid would
// (the share of the group within 20° of the group's commonest heading), and making way: the eye walked through each
// place at walking pace, the most people stepping aside at once and the nearest a standing person stayed to the eye.
// Usage: npx tsx tools/dev/standcensus.ts [--day 25] [--hour 10] [--r 6]
import { buildOfflineWorld } from './lib/offline_world';
type P2 = [number, number];
const argv = process.argv.slice(2), flag = (k: string, d: number) => { const i = argv.indexOf(k); return i >= 0 ? +argv[i + 1] : d; };
const DAY = flag('--day', 25), HOUR = flag('--hour', 10), R = flag('--r', 6);
const W = await buildOfflineWorld({ seed: 1, day: DAY, hour: HOUR, court: true });
const view = W.view!, sim = W.sim!;
const PLACES: [string, P2][] = [['Treasury N court', [178, -98]], ['Harem W entrance', [112, -118]], ['Hall of 100 W door', [112, -42]], ['Hall of 100 N door', [134, 5]],
  ['Tachara S', [-21, -90]], ['royal kitchens', [-31, -161]], ['Gate of All Nations', [-15, 95]], ['Apadana N stairs', [10, 40]],
  ['town q_s1 lane', [-433, -1068]], ['town q_s3 lane', [-1114, -894]], ['town q_w2 lane', [-1026, 487]], ['town q_s2 lane', [-789, -1018]]];
const t = sim.t;
for (const [name, c] of PLACES) {
  view.settle(t, c); for (let i = 0; i < 4; i++) view.update(t + i * 1e-5, c);
  const all = view.query(c, R), st = all.filter(v => !v.moving && v.agent < 0 && !v.indoor && !v.hand), agents = sim.agents.filter(a => !a.offmap && Math.hypot(a.pos[0] - c[0], a.pos[1] - c[1]) < R);
  let u1 = 0, u06 = 0, door = 0; const nn: number[] = [];
  for (const v of st) { let d = Infinity; for (const w of st) if (w !== v) d = Math.min(d, Math.hypot(w.e - v.e, w.n - v.n)); for (const a of agents) d = Math.min(d, Math.hypot(a.pos[0] - v.e, a.pos[1] - v.n));
    nn.push(d); if (d < 1) u1++; if (d < 0.6) u06++;
    const sp = (view as any).ps.get(v.pid)?.spot; if (sp && (view as any).inDoor?.(sp, v.e, v.n)) door++; }
  const hb = new Map<number, number>(); for (const v of st) { const b = Math.round(((v.heading % 360) + 360) % 360 / 20) % 18; hb.set(b, (hb.get(b) ?? 0) + 1); }
  const top = Math.max(0, ...hb.values());
  nn.sort((a, b) => a - b);
  // the eye walked through the place, W to E then S to N, at 1.35 m/s, the view updated every frame (30 a second)
  let maxY = 0, closest = Infinity;
  for (const [a, b] of [[[c[0] - 8, c[1]], [c[0] + 8, c[1]]], [[c[0], c[1] - 8], [c[0], c[1] + 8]]] as [P2, P2][]) {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]), steps = Math.ceil(L / 1.35 * 30);
    for (let i = 0; i <= steps; i++) { const f = i / steps, e: P2 = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
      view.update(t + 1e-5 * (10 + i), e); maxY = Math.max(maxY, (view.stats as any).yielding ?? 0);
      for (const v of view.query(e, 2)) if (!v.moving && v.agent < 0 && !v.indoor) closest = Math.min(closest, Math.hypot(v.e - e[0], v.n - e[1])); } }
  console.log(`${name.padEnd(22)} standing ${String(st.length).padStart(3)} (+${agents.length} agents, ${all.length - st.length} walking or other) | nearest median ${(nn[nn.length >> 1] ?? NaN).toFixed(2)} m, under 1 m ${u1}, under 0.6 m ${u06} | in a doorway ${door} | facing one way ${st.length ? (100 * top / st.length).toFixed(0) : '-'} % | making way: at most ${maxY} at once, nearest standing to the walking eye ${closest.toFixed(2)} m`);
}
console.log(`view stats: spread ${view.stats.spread}, no room ${view.stats.crowded}, kept off doorways ${(view.stats as any).doorKept}, steps aside ${(view.stats as any).yieldSteps} (no room, not drawn: the no-room count)`);
process.exit(0);
