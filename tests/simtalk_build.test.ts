import { it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { day300 } from './simtalk_world';
it('builds the day-300 cache', () => { const r = day300(); const E = r.sim.econTo(300); writeFileSync(process.env.SIMTALK_LOG ?? 'simtalk_build.log', JSON.stringify({ built: r.built, ms: r.ms, day: E.day, ev: E.events.length, living: r.sim.living.stats })); }, 3_600_000);
