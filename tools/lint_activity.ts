// Activity-coverage lint (brief §9.5, §13; D-142): every activity the simulation can schedule, and every variant of it,
// has a real performance: an existing pose cycle, props with geometry, work objects and animals that exist, a sound the
// soundscape plays, a tier and a note, and no placeholder or abstract-only flag. Exits 1 on any problem.
// Run: npm run lint:activity (part of npm run lint:all; the same check runs in npm test: tests/performances.test.ts).
import { ACTIVITIES } from '../src/people/activities';
import { activityLint } from '../src/people/activityLint';

const bad = activityLint(ACTIVITIES as any);
const acts = Object.values(ACTIVITIES), variants = acts.reduce((n, p) => n + (p.variants?.length ?? 0), 0);
if (bad.length) { console.error(`lint:activity FAIL — ${bad.length} problem(s):\n  ${bad.join('\n  ')}`); process.exit(1); }
console.log(`lint:activity OK — ${acts.length} activities, ${variants} variants, 0 placeholders`);
