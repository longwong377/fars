// Summarise a soak report (bench-reports/soak-*.json; the newest by default). Usage: npx tsx tools/dev/soak_summary.ts [file]
import { readFileSync, readdirSync, statSync } from 'node:fs';
const f = process.argv[2] ?? readdirSync('bench-reports').filter(x => x.startsWith('soak-')).map(x => `bench-reports/${x}`).sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
const r = JSON.parse(readFileSync(f, 'utf8'));
const o = (k: string, v: unknown) => console.log(k, JSON.stringify(v));
o('file', f); o('court/days/population/measured', [r.court, r.days, r.population, r.populationMeasured]); o('gates', r.gates); o('seconds', r.seconds);
o('byRole worst', Object.fromEntries(Object.entries(r.byRole).map(([k, v]: any) => [k, v.worst])));
o('byJob [n, worst, failing]', Object.fromEntries(Object.entries(r.byJob).map(([k, v]: any) => [k, [v.n, v.worst, v.failing]])));
o('failing', r.populationFailing.slice(0, 12)); o('worst', r.populationWorst.slice(0, 6)); o('kindsPerWeek', r.kindsPerWeek);
o('stuck', [r.stuck, r.populationStuck.slice(0, 5)]); o('planChecks', { pd: r.planChecks.personDays, issues: r.planChecks.issues, ex: r.planChecks.examples.slice(0, 8), days: r.planChecks.daysChecked, dayIssues: r.planChecks.dayIssues, dayEx: r.planChecks.dayExamples.slice(0, 5) });
o('planProblems', r.planProblems.slice(0, 6)); o('badRendered', r.badRendered.slice(0, 5));
o('stores', [Object.values(r.stores).every((s: any) => s.ok), r.collapse, r.shortfalls, r.sacks]); o('frameCost', r.frameCost); o('infants', r.infants); o('life', r.life); o('construction', { weeks: r.construction.weeks, adv: r.construction.weeksAdvanced });
