# Talk eval, session 15 (D-456): the shipped 1.5B over the real briefs

The shipped talk model (Qwen2.5-1.5B-Instruct q4f16_1, the exact MLC weights the game streams) talking with 200 people of
the real simulation (seeds 1 and 7) through the game's own talk path, scored automatically; fixes to the prompt path; the
same people again. Cloud box, CPU only. 2026-10-02.

## Broken first (still, after the fixes)
- **A quarter of turns still fail; 33 of 80 people get through five turns clean.** The model is the limit for most of
  what remains (below): it narrates the scene (6.5 % of turns), echoes the stranger's question back (part of "no-kin",
  "narrates"), drops into assistant speech ("Sorry, I can't assist you.", "How may I assist you today?"), and when the
  simulation says "you cannot do it" it often says only the refusal and not where it lives (no-home 7.5 %).
- **Not measured: the deed-reading eval (D-459).** The scaffolding is committed (tools/dev/talkeval/deeds.ts, 150
  hand-labelled lines, schema-constrained decoding in the runner) but did not run before the session ended.
- **Not on the T4.** f32 numpy arithmetic over the dequantized weights (the T4 runs f16 WebGPU kernels): close, not
  identical; latencies here are the CPU's, not the player's.
- **The after-run is 100 people (50 per seed), not 200**, for time; the table compares the 80 people both runs have with
  all five turns (57 turns of the first run were lost to a client timeout under load, since fixed).
- talk_world/converse tests: see "Tests" at the end.

## The numbers (same 80 people, 400 turns; before = the code as shipped, after = D-456)
| | before | after |
|---|---|---|
| turns clean (no failure) | 214/400 (53.5 %) | **303/400 (75.8 %)** |
| people with every turn clean | 3/80 | **33/80** |
| greet clean (own name) | 66/80 (83 %) | 73/80 (91 %) |
| family clean | 52/80 (65 %) | 61/80 (76 %) |
| work clean | 64/80 (80 %) | 69/80 (86 %) |
| "where do you live, take me there" clean (the place named) | 21/80 (26 %) | **49/80 (61 %)** |
| unknowable clean (says it does not know) | 11/80 (14 %) | **51/80 (64 %)** |
| ignores the unknowable / answers it anyway | 54 / 9 | 19 / 3 |
| narrates | 42 (10.5 %) | 26 (6.5 %) |
| the opening (prime) reply narrates | 62/80 | **1/80** |
| the talk primed afresh mid-talk (forgotten) | 164 turns | 58 (all one retold-refusal path, fixed after the run: be4d8314) |
| invented name / invented kin / wrong kin / wrong count | 10 / 2 / 0 / 5 | 2 / 2 / 1 / 1 |
| digits / fence failure after the retry | 4 / 4 | 0 / 1 |
| cut off at 64 tokens | 8 | 9 |
| the sim said no and the words promised anyway | 1 | 0 (29 retold as a refusal) |
| brief tokens median / max (budget 450) | 443 / 450 | 442 / 450 |

The full first run (199 people, 943 turns, before): 54.2 % clean, greet 84 %, family 66 %, work 84 %, home 24 %,
unknowable 13 %; the same classes in the same order (no-home 14.7 %, ignores 13.4 %, narrates 8.8 %).

Asks: "Will you take me to your house?" is read by the grammar every time (intent.ts); the model wrote a tag in 2-5 of 80
(it almost never follows the tag line), and stray tags on turns that asked nothing fell from 11 to 1. The grammar carries
the asks; the tag line is a cost (~50 tokens of every brief) that the 1.5B barely uses (see "What would fix the rest").

## Failure classes, with examples (after, unless marked)
- **No place / assistant speech when the sim refuses** (no-home 7.5 %): "I am sorry, but I cannot leave the mill." /
  "Sorry, I can't assist you." (a weaver) / "I'm sorry, but I cannot speak to him. The king’s flocks are in his care."
  Before, the commonest: "I live with my wife Hubāmā." (the ground fact was the family).
- **Narrates or echoes** (6.5 %): "The stranger asks about the king of Indians. I don’t know that, but right now in this
  workshop under the storekeeper’s eye, we have shining gold and silver." / "Tell me about your family. Who lives in your
  house?” Bakubeša, son of Manyakka, fifty-four, … has his wife Bagaduxçā …". Longer kept talks echo more (the talk is no
  longer forgotten, so it is longer).
- **The unknowable** (before 63 of 80 failed): "The king ate a loaf of bread." / "The king after Xerxes will be Darius." /
  "The king of the Indians is called King Tut." After: "I don't know who it will be and can’t guess, but today I'm working
  on a loom with my work group."; still "The king has over a hundred thousand soldiers."
- **Kin** (rare, 1-2 %): a steward calls his daughter his wife ("my wife Čiθrazātā" is a daughter of the house); "I live
  with my wife and two sons" (three).
- **Work** (2 %): "I am working on the way." (an official on the road); "hair taken off." (a tanner: the brief's own
  "Right now" phrase recited; life.ts's tanning step reads badly).
- **Fence**: "My job is …" (job is on the modern list; the retry usually fixes it).

## What D-456 changed (the prompt's and the talk path's faults)
1. turn.ts: how well the person knows the stranger is fixed at the talk's first turn (counted from the live talk's own
   rows, the second turn said "You know this stranger’s face", changed the prime and the talk was primed afresh); the
   retold refusal keeps to the primed talk.
2. mind.ts: the judge no longer clears the priming (after every ask the person forgot the talk); the next answer sends the
   whole talk and WebLLM reads it in again (~600-1,000 tokens: one read-in, well under the 2 s watchdog on a T4).
3. ground.ts: "where do you live / take me to your house" gives the place (it gave the family); a question the person
   cannot know (a later or foreign word, what is to come, the king's own doings, the far kings, the empire's numbers, the
   next king) gives "you do not know that and cannot guess it: say so plainly first, then speak of your own day"; the age
   in words (D-450: no digits; the ground fact gave "52").
4. prompt.ts: the first turn asks for a greeting in their own words (left bare, 62 of 80 primes narrated the scene); the
   visible-marks line (D-452) drops before the past when the budget is tight.
5. fence.ts FENCE_SHORT: "If you do not know a thing, say so; never guess." (+11 tokens; the budget still holds: 450 max).
6. life.ts: one with no name of their own goes by the byname ("the son of Manakka"), not "(no name recorded: he gives his
   father’s house)"; unnamed kin are "your son (three)", not "your son unnamed"; bake.ts counts the byname's names as theirs.

## What would fix the rest (the model is the limit)
- **Narration, echo and assistant speech are the 1.5B's habits** (6.5 % + part of 7.5 %): the prompt already says "never
  narrate". Cheapest next steps, in order: (a) a post-filter in tidy() that cuts a leading echo of the stranger's words and
  a leading "The stranger asks …," clause and re-asks on "assist" (cheap, deterministic); (b) one short few-shot pair in
  the prime (the first assistant turn written by us, "Greetings. I am {name}, {work}." instead of generated: removes the
  prime's cost too); (c) temperature 0.7 -> 0.5 for the talk.
- **The tag line** is followed in ~3 % of asks: the grammar (intent.ts, D-459's parse.ts) does the work. Dropping
  INTENT_LINE from the brief frees ~50 tokens for the life (the past and the marks would stay in more briefs).
- **A larger model** (Qwen2.5-3B, ~1.9 GB q4f16) would be the next step if the post-filter is not enough; not measured.

## How it was run (no GPU, no Hugging Face)
- Weights: models-archive `models/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC` (sparse fetch, 831 MB), dequantized
  (4-bit groups of 32, f16 scales, `(q-7)*s`; c_attn q|k|v, gate|up) and run by a numpy Qwen2 forward pass
  (`tools/dev/talkeval/qwen_mlc.py`, batched decode, prefix KV cache). llama.cpp was not used: this box may not build
  code cloned from GitHub. **The archive has no `tokenizer.json`/`vocab.json` for this model, only `merges.txt`**: the
  vocabulary is rebuilt from the merges (byte-level BPE) and checked: `Hello world` -> [9707, 1879], `user` -> 872,
  round-trips exact; "What is the capital of France?" -> "Paris". (If the game streams the tokenizer from the archive it
  is missing there.)
- Sampling as WebLLM (mind.ts): temperature 0.7, top_p 0.9, frequency 0.3, presence 0.1, the chat config's repetition
  1.1, the qwen2 chat template; the seed per call is a hash of its messages (the same prompt draws the same way in both runs).
- The talk is the game's own path: `talkTurn` -> `Mind.answer` (prime, notes, ground fact, fence retry, judge), its
  engine replaced by one that calls the runner (`tools/dev/talkeval/run.ts`). Sims: seed 1 day 150 11:00, seed 7 day 150
  16:00 (`simAt`, asks on); people stratified over zone x job x age band (8 and over). Five stranger turns: greeting /
  family / work / "Where do you live? Will you take me to your house?" / one unknowable (six rotated).
- Scoring (`tools/dev/talkeval/score.ts`, `--same` for matched people): fence hits, digits, foreign script, narration,
  tag leaks, cut-offs, capitalised names not in what the person was told, kin words the house does not have, kin named
  wrongly, wrong counts of children; per turn: own name / a housemate / the work / the place named, the unknowable
  deflected. Automatic and approximate in places (a name spelt with another diacritic, a scribe's "tablets" not matching
  "scribe", a dead child from "Lately"); read the examples, not only the counts. lint:lang's word list is common English
  (it guards in-world text), so it cannot be applied to the English replies: the fence's lists are used instead.
- Latency on this CPU (4 cores, numpy f32; not the T4): one stream 6.9 tokens/s; 12 talks batched ~15-18 tokens/s in
  all; read-in ~80 tokens/s (a fresh 440-token brief ~5.5 s). Replies: median 22 tokens, p90 41-44; 13 of ~900 calls hit
  the 64-token cap.
- Re-run: `python3 tools/dev/talkeval/qwen_mlc.py <mlc dir> check`, then `... serve 8765 &`,
  `npx tsx tools/dev/talkeval/run.ts out.jsonl 200 12`, `npx tsx tools/dev/talkeval/score.ts before.jsonl after.jsonl --same`.

## Tests
talk_world + stranger_talk + converse, run alone after the after-run: 55/58 pass. The 3 failures are timeouts (120 s) of tests
that call `buildTestSet(pop, 1, 72)`, which takes ~560 s on this box with D-456 and ~554 s without it (measured both ways):
not a regression, the box. The one real assertion D-456 broke (converse: "a reply grounded in the person’s life passes",
for a person with no name, "I am the son of Manakka") is fixed (be4d8314: the byname's names count as theirs) and checked
directly; T-E10 (the stand-in's plumbing number) 99.4 % -> 100 %. Guards 25/25.
