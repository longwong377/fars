// D-377 (UD-23; T-E12): overheard person-to-person exchanges near the player, chosen per pair and moment from their records.
// A seeded sample of pairs who talk (the living world's own talks, and people at one place in talk in their plans), across
// days and hours: each exchange must be grounded (its topic is a fact of either life, their houses' talk, the market or the
// day, and at least one of its words carries the topic), in a language both speak (their shared home tongue, else Aramaic: C),
// in each speaker's own voice, and not repeated verbatim for the pair within the day. Measured, printed; the threshold is
// T-E12's (90 %). What this cannot tell: whether it sounds like a conversation (the render side plays it).
import { describe, it, expect } from 'vitest';
import { simAt } from './sim_fixture';
import { Overheard } from '../src/people/overheard';
import { voiceIdentity } from '../src/people/talkers';
import { voiceLang } from '../src/audio/voices';
import { HOME_LANG } from '../src/people/exchanges';
import { segAt } from '../src/people/population';
import { u01, salt } from '../src/people/hash';

const TOPIC = /\b(bread|grain|barley|wheat|food|provisions|meal|silver|money|wage|pay|gold|god|gods|father|son|heaven|house|good|happiness|well-being|wine|protect|peace|work|works|stone|bricks|timber|workers|labourers|column|palace|gate|court|king|royal|meat|sheep|earth|stranger|man|land|country|guest|water|river|sky)\b/i;
describe('T-E12 overheard exchanges (D-377)', () => {
  it('a seeded sample of talking pairs: grounded, shared tongue, own voices, no verbatim repeat in a day', () => {
    const rows: any[] = [];
    for (const [day, hours] of [[120, [9, 13, 17]], [150, [10, 15, 19]]] as const) {
      const sim = simAt(1, day, 12, { asks: true }); sim.econTo(day + 1); const O = new Overheard(sim), P = sim.pop;
      const talks = sim.living.talks.filter(t => t.day === day).sort((a, b) => u01(1, salt('te12'), a.id) - u01(1, salt('te12'), b.id)).slice(0, 15);
      const pairs: [number, number][] = talks.map(t => [t.a, t.b]);
      // people at one place, both in talk at the hour (the plans' own conversations)
      for (const h of hours) { const at = new Map<string, number[]>(); for (const p of P.persons) { if (pairs.length > 60 * (rows.length + 1)) break; if (!P.present(p.id, day) || P.ageOn(p.id, day) < 12 || u01(1, salt('te12p'), p.id, day) > 0.05) continue; const s = segAt(P.plan(p.id, day), h); if (s?.act !== 'talk') continue; (at.get(s.place) ?? at.set(s.place, []).get(s.place)!).push(p.id); }
        for (const l of at.values()) if (l.length >= 2) pairs.push([l[0], l[1]]); }
      for (const [a, b] of pairs.slice(0, 40)) for (const h of hours) {
        const ex = O.exchange(a, b, day * 24 + h); if (!ex) { rows.push({ ok: false, why: 'none' }); continue; }
        const lang = ex.lang, own = (x: number) => voiceLang(HOME_LANG[P.persons[x].origin] ?? P.persons[x].origin).lang;
        const shared = lang === 'arc' || (own(a) === lang && own(b) === lang);
        const grounded = !!ex.topic && ex.turns.some(t => t.unit.kind === 'word' && TOPIC.test(t.unit.gloss ?? ''));
        const voices = voiceIdentity(null, a, P, day, 1).seed !== voiceIdentity(null, b, P, day, 1).seed;
        rows.push({ ok: grounded && shared && voices && ex.turns.length >= 3, grounded, shared, voices, src: ex.src, topic: ex.topic, lang, n: ex.turns.length, sig: `${a}:${b}:${day}|${ex.turns.map(t => t.unit.id).join(',')}` });
      }
    }
    const sigs = new Map<string, number>(); for (const r of rows) if (r.sig) sigs.set(r.sig, (sigs.get(r.sig) ?? 0) + 1);
    for (const r of rows) if (r.sig && sigs.get(r.sig)! > 1) { r.ok = false; r.repeat = true; }
    const share = rows.filter(r => r.ok).length / rows.length, src: Record<string, number> = {}; for (const r of rows) src[r.src] = (src[r.src] ?? 0) + 1;
    console.log('[T-E12]', JSON.stringify({ n: rows.length, share: +(share * 100).toFixed(1), src, repeats: rows.filter(r => r.repeat).length, ungrounded: rows.filter(r => r.grounded === false).length, langs: [...new Set(rows.map(r => r.lang))], ex: [...new Set(rows.map(r => r.topic))].slice(0, 12) }));
    expect(rows.length).toBeGreaterThanOrEqual(60); expect(share).toBeGreaterThanOrEqual(0.9);
  }, 1_800_000);
});
