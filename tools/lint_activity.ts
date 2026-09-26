// Activity-coverage lint (brief §9.5, §13; D-142): every activity the simulation can schedule, and every variant of it,
// has a real performance: an existing pose cycle, props with geometry, work objects and animals that exist, a sound the
// soundscape plays, a tier and a note, and no placeholder or abstract-only flag. Exits 1 on any problem.
// Run: npm run lint:activity (part of npm run lint:all; the same check runs in npm test: tests/performances.test.ts).
import { ACTIVITIES } from '../src/people/activities';
import { activityLint } from '../src/people/activityLint';
import { PLAYING } from '../src/people/playing';

// the activities, and the playing performances the music gives in their place (D-200: playing.ts)
const bad = [...activityLint(ACTIVITIES as any), ...activityLint(Object.fromEntries(Object.entries(PLAYING).map(([k, v]) => [`play:${k}`, v])) as any)];
const acts = Object.values(ACTIVITIES), variants = acts.reduce((n, p) => n + (p.variants?.length ?? 0), 0);
if (bad.length) { console.error(`lint:activity FAIL — ${bad.length} problem(s):\n  ${bad.join('\n  ')}`); process.exit(1); }
console.log(`lint:activity OK — ${acts.length} activities, ${variants} variants, ${Object.keys(PLAYING).length} playing performances, 0 placeholders (every pose cycle with impostor frames of its own: D-229)`);
