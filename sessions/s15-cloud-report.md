# State of the game, end of session 15/16 (cloud lead "Fars 18", 2026-10-02)

For the user to assess. Plain English; what is broken or unproven comes first in every part.

## In one paragraph

PĀRSA is a deep historical simulation of a whole town (Pārsa, 467 BC) with people you can talk to by voice, in a
browser. Its depth is real and now much wider than this morning: every person has a home, family, work, a past, a
personality and, new today, a **mind** (feelings toward others, memories of what was done to them, decisions with reasons)
and an **open set of deeds**: your words can propose almost anything (help, hunt, fight, steal, lie, promise, teach, hire,
court, accuse...), the person's mind decides, and the world carries it out (their day changes, goods move, wounds, the law,
rumours). The town also acts **on its own** without you (help, quarrels, thefts, feuds, visits, hunts, roof repairs).
**But almost none of this has been seen or heard in the game itself yet**: it is proven by tests and simulated runs in node,
not by a person playing. The look (graphics) has not been judged since session 14. The public site loads, but slower than
the target.

## Try it

- Public URL: https://longwong377.github.io/fars/ (deployed today 10:41 UTC from s14-int 9cb464ee).
- **What the live site contains:** the world bake, talk with Qwen2.5-1.5B on by default, reactions on sight and heads turning
  to a shout (Vagon talk16), the stranger's work/guest-right/petitions/market (up to D-455). **Not yet on it:** today's
  open deeds, minds, law, physical deeds, names, brides, talk-eval fixes (all on branch `cloud-s15-depth`, waiting for a
  built-site check, see Load).
- Expect: ~100 s cold to walkable on a 4-core machine (likely less on a fast PC; never measured on one), ~70 s warm; the
  talk model (~950 MB) streams in after that; before it arrives people answer with a line of their own.

## Broken, unproven or placeholder (first)

1. **Nothing of today's work has been played or seen.** No frame rendered, no voice heard in the browser with the deeds and
   minds. Vagon's next session must play it.
2. **Load misses the target:** ~100 s cold / 70 s warm (target under 60 s), page memory 5.6 GB (target 5). The wait is
   mostly the last assets arriving (animals), not CPU.
3. **The voice:** 75.8 % of turns are clean with the shipped model (was 53.5 % this morning). Still: ~6.5 % narrate or
   echo, some refusals sound like a chatbot ("Sorry, I can't assist you"), the model rarely writes the tag that marks an
   ask (the grammar catches most asks instead). Not measured on the GPU itself.
4. **Free speech -> deed by the model is untested** (the scaffold is ready, 150 labelled lines; not run). The grammar reads
   the common phrasings; the model reading is wired in the page but unmeasured.
5. **Sentences on the stranger are recorded but not enforced** (held, fined, labour, expelled change how the town treats him,
   but nothing stops him walking or bars a gate).
6. **Stand-in animations** for dancing, drinking, hunting with a bow, wrestling, swimming (nearest existing ones); request
   list for Vagon: handoff/briefs/s16/deeds_render.md.
7. **Most free speech to women is refused** by the period-manners rule (10 of 18 refusals in the bot's run): probably too
   strict.
8. **Women's names:** the new names are reconstructions from attested name parts (tier C); no newly attested name was added.
9. **Tests that time out on the cloud box** (no assertion failed): year-wide people_days r6/r8 cases, the court letters
   case, talk_world's prompt sweep under vitest. Three people_days_r6 assertion failures (infant/minding/mourning) predate
   today's work and belong to the depth track.
10. **Adult brides (B230):** merged; its comparison against the newest main line (r7-r11 day tests) was not finished.

## What a player would meet (if it works on screen as in the tests)

- **Talk to anyone** in their own voice and tongue; they answer from their own life (home, kin, work, past, worries, what
  their house needs, the talk of the quarter, what they remember of you and heard about you).
- **Say anything; it can be a deed.** "Let me fix your roof", "let's go hunting tomorrow", "I'll fight him", "tell your
  father Bagadata stole the goat", "lend me two shekels", "teach me to weave", "come drink with me tonight", "you are a
  liar". The person is told the world's verdict and their own leaning and answers in their words; if it happens:
  - they walk there and do it (the hunt in the hills tomorrow, the roof replastered), the outcome goes into the economy;
  - they remember it and feel about you (gratitude, anger, fear, respect, affection), their house trusts you more or less;
  - a wrong leaves wounds, a case before the elder or the king's judges, a feud with your victim's kin, news that travels;
  - lies can be found out; promises are held to their day.
- **Live there:** take a day's carrying at the market, sell your grain, buy bread by the loaf, be hired, learn a craft and
  be paid more for it, hire a porter or guide, be someone's guest (three nights of custom), petition the elder.
- **The town without you:** kin help the sick and burnt-out, neighbours comfort the bereaved, friends visit and share
  meals, hungry houses borrow and sometimes steal, quarrels and feuds run their course through the elders, people hunt,
  fish, drink and mend roofs (1,119 roofs leaking by day 80 in one run).

## Numbers (node, seed 1 unless noted)

- Voice (shipped Qwen2.5-1.5B, exact weights, CPU; same 80 people before -> after today's fixes): clean turns 53.5 -> 75.8 %;
  people clean on all 5 turns 3 -> 33; "where do you live" names the place 26 -> 61 %; unknowable questions honestly
  deflected 14 -> 64 %; digits 4 -> 0; invented names 10 -> 2 (bench-reports/talk_eval_s15.md).
- The town's own deeds without the stranger: a month (days 60-90) ~3,700 deeds by ~3,300 people; 15 days with the law:
  3 thefts, 82 cases (79 ruled), 9 feuds; 60 days: 52 hunts, 50 fishing trips, 250 evenings of beer, 305 roofs mended.
- The minds' cost: ~72 ms of CPU a game day (cut from 2.7 s today).
- The stranger's living: 0 hungry days in 150 (was: silver ran out, grain piled up).
- Names: women sharing a name in a quarter 2.18 -> 0.72 % (Persian), 1.65 -> 0.72 % (Elamite).
- Load (built site, headless 4-core, 100 Mbit): cold 100 s, warm 70 s, 5.6 GB.

## Branches

- `s14-int` (live): Vagon's s16-candidate + the boot fix (D-463).
- `cloud-s15-depth` (everything consolidated, not yet live): D-455..D-462, names, talk eval, talk16 hooks, brides; guards green.
- Merge order for the next lead: built-site check of cloud-s15-depth (in progress, see below) -> merge into s14-int -> play.

## The sessions of today (all reported, merged and archived unless noted)

| Package | Result |
|---|---|
| D-455 the stranger's living loop (lead) | market stalls, day's hire, bread by the loaf |
| D-456 voice eval on the shipped model | 53.5 -> 75.8 % clean turns; deed-reading eval not run |
| D-457 women's names | namesakes under 1 % |
| D-458 market stallholders | PENDING |
| D-459 open deeds and minds (lead) | the core: 57 verbs, minds for everyone, the town acts alone |
| D-460 law, feuds, consequences | thefts found out, lies found out, feuds, the watch, judges |
| D-461 minds' long-term goals | PENDING |
| D-462 deeds made physical | hunts, roofs, lessons, hiring, errands into the economy |
| D-463 built-site boot hang | two causes fixed; site live again |
| B230 adult brides (inherited) | merged; comparison unfinished |

## What I would do next (for you to decide)

1. **Play it.** Vagon: merge cloud-s15-depth into s14-int (after the built-site check), open the site, walk into a lane,
   talk to five people, try ten free deeds, follow one person home. Everything above is unproven until that happens.
2. **The look** (Vagon big machine, handoff/briefs/s16/bigbox.md): it has not been judged since session 14.
3. **Load under 60 s:** the animals and the last assets after "walkable", not before.
4. **Voice polish:** the post-filter for echo and chatbot refusals; run the deed-reading eval; consider the 3B model.
