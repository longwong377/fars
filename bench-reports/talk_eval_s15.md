# Talk eval, session 15 (D-456): the shipped 1.5B over the real briefs

**INTERIM (2026-10-02 08:15 UTC): first 95 people of seed 1 (407 turns), the code as shipped (before any fix). The full
200-person run, the fixes and the before/after table follow in this file when they are done.**

## Broken first
- **The person forgets the talk twice in five turns.** On turn 2 the person is told "You know this stranger's face" (turn.ts
  counted the rows of the talk that is still going on), the prime key changes and the model is primed afresh; after any ask
  the judge (mind.ts) drops the priming again. 182 of 322 later turns started a fresh talk.
- **"Where do you live? Will you take me to your house?" is answered with the family, not the place: 25 % clean.** ground.ts
  read "live / house" as a family question ("I live with my wife Hubāmā.").
- **Questions the person cannot know: 16 % clean.** The model answers them anyway ("The king ate a loaf of bread.", "The king
  after Xerxes will be Darius.", "The king of the Indians is called King Tut.") or passes over them. The ground fact sent with
  the question was the person's day, which pulled the reply away from saying "I do not know".
- **Narration: 8 % of answers; 58 of 95 opening (prime) replies narrate the scene** ("A foreigner approaches, speaking in a
  different language."); after a re-prime the talk goes on narrating ("…" You respond: "My wife is …").
- **Digits from our own prompt:** the ground fact for "who are you" gave the age in digits ("son of Ziššukka, 52, an Elamite").
- **Brief bugs:** a person with no name of their own was told "You are (no name recorded: he gives his father’s house)";
  unnamed kin were listed as "unnamed"; the visible-marks line (D-452) had no rule in the token budget.

## How it was run (no GPU, no Hugging Face)
- Weights: the exact MLC shards the game streams (models-archive, `models/mlc-ai/Qwen2.5-1.5B-Instruct-q4f16_1-MLC`),
  dequantized (4-bit groups of 32, f16 scales, `(q-7)*s`) and run by a small numpy Qwen2 forward pass
  (`tools/dev/talkeval/qwen_mlc.py`). llama.cpp was not used: this box may not build code cloned from GitHub. The archive
  has no `tokenizer.json`/`vocab.json` for this model (only `merges.txt`): the vocabulary is rebuilt from the merges and
  checked (`Hello world` -> [9707, 1879], round-trips exact; "What is the capital of France?" -> "Paris").
- Sampling as WebLLM (mind.ts): temperature 0.7, top_p 0.9, frequency 0.3, presence 0.1, the chat config's repetition 1.1;
  the qwen2 chat template of mlc-chat-config.json. f32 arithmetic (the T4 runs f16): small numeric differences.
- The talk is the game's own path: `talkTurn` -> `Mind.answer` (prime, notes, ground fact, fence retry, judge), with an
  engine that sends each call to the runner (`tools/dev/talkeval/run.ts`). Sims: seed 1 day 150 11:00, seed 7 day 150
  16:00 (`simAt`, asks on), people stratified by zone, job and age (8 and over). Five stranger turns each: greeting /
  family / work / "Where do you live? Will you take me to your house?" / one unknowable question (six rotated).
- Scoring (`tools/dev/talkeval/score.ts`): fence hits, digits, foreign script, narration, tag leaks, cut-off replies,
  capitalised names not in what the person was told, kin words the house does not have, wrong counts of children, and
  per turn: own name / a housemate / the work / the place named, the unknowable deflected. lint:lang's list is common
  English (it guards in-world text) and cannot be applied to the English replies: the fence's lists are used instead.
  The checks are automatic; a few are approximate (a name spelt with another diacritic, a dead daughter from "Lately").

## Interim numbers (before, 95 people, 407 turns)
| | before |
|---|---|
| turns clean | 224/407 (55 %) |
| people with every turn clean | 13/95 |
| greet clean (own name) | 72/85 (85 %) |
| family clean | 53/81 (65 %) |
| work clean | 66/81 (81 %) |
| home clean (the place named) | 20/81 (25 %) |
| unknowable clean (says it does not know) | 13/79 (16 %) |
| ignores the question / answers it | 56 / 5 |
| narrates | 33 (8.1 %) |
| cut off at 64 tokens | 12 (2.9 %) |
| invented name / invented kin / wrong count | 6 / 5 / 5 |
| digits / fence failures after the retry | 3 / 2 |
| modern words caught by the fence before the retry | 3 |
| asks ("take me to your house"): tag emitted / grammar only | 4 / 77 |
| the sim said no and the words promised anyway | 0 (20 retold as a refusal) |
| brief tokens median / max | 442 / 450 |

Latency on this CPU (numpy, 4 cores; not the T4): one stream 6.9 tokens/s decode; 12 talks batched ~18 tokens/s in all;
brief read-in ~80 tokens/s (a fresh 440-token brief ~5.5 s). Replies: median 21 tokens, p90 42, 15 hit the 64-token cap.
