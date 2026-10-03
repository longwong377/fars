// dev (C9): who and what stands around a spot where the walk bots stopped (the offline world at day 25 10:00, the court)
// Usage: npx tsx tools/dev/walk_spot.ts e n [r=6]
import { buildOfflineWorld } from './lib/offline_world';
const [e, n, r = 6] = process.argv.slice(2).map(Number);
const W = await buildOfflineWorld({ seed: 1, day: 25, hour: 10, court: true });
const pl = W.spawn(e, -n); for (let i = 0; i < 30; i++) W.step(pl, 1 / 30, { forward: 0, yaw: 0 });
console.log('agents (detailed):');
for (const a of W.sim?.agents ?? []) { const d = Math.hypot(a.pos[0] - e, a.pos[1] - n); if (!a.offmap && d < r) console.log(`  ${(a as any).id} ${(a as any).role ?? ''} ${(a as any).activity ?? (a as any).act ?? ''} walking=${a.walking} at (${a.pos[0].toFixed(1)}, ${a.pos[1].toFixed(1)}) d ${d.toFixed(1)}`); }
console.log('population drawn:');
for (const v of W.view?.query([e, n], r) ?? []) console.log(`  agent ${v.agent} moving=${v.moving} at (${v.e.toFixed(1)}, ${v.n.toFixed(1)}) ${JSON.stringify(Object.fromEntries(Object.entries(v).filter(([k, x]) => typeof x !== 'object' && !['e', 'n', 'agent', 'moving'].includes(k))))}`.slice(0, 260));
console.log('walkable', W.nav.walkable(e, n), 'h', W.nav.heightAt(e, n));
