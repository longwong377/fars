# Date decision: recommendation from subagent C

Inputs are `_chronology_C.md` (buildings, archives) and the Parker & Dubberstein (P&D) calendar table.

## Criteria
1. **Named people.** Individuals attested in dated administrative texts, and how many there are.
2. **Finished buildings.** Structures standing on the Terrace.
3. **Court presence in spring.** New Year (Adukanaiša, which corresponds to Nisannu) visits to the king.

## Candidates

| Year BCE | Regnal year | Named people (archives) | Buildings standing (Terrace) | Spring court evidence | Verdict |
|---|---|---|---|---|---|
| **498** | Darius I yr 24 | **Maximum.** The Fortification archive peaks in years 23–25 (499–496) ([Iranica](https://www.iranicaonline.org/articles/persepolis-elamite-tablets/)). There are thousands of named workers, officials (e.g. Parnakka) and royal women (Irdabama, Irtaštuna). **A** | Terrace (A); Apadana under construction, with its foundation deposit laid 519–510 (A/B); Tachara partly built (B); Treasury phases 1–2 (B); tomb of Darius I at Naqsh-e Rustam (C for its state then). **No** Gate of All Nations, Hadish, Harem, or Hall of 100 Columns. The Tripylon is disputed. Tol-e Ajori stands (C) | Trips to the king peak around the New Year across 509–493 (King 2022). **B** | **Recommended** |
| 494 | Darius I yr 28 | The archive thins out at its end (year 28 is the last) | Same as 498, possibly further along | Same as 498 | Weaker than 498 |
| 467 | Xerxes yr 19 | The Treasury tablets peak in Xerxes years 19–20, but only 128 of 753 tablets are published. That is **an order of magnitude fewer names**, mostly silver-ration recipients | Apadana, Tachara, Gate of All Nations, Hadish, Harem and Treasury (final phase) are finished; the Hall of 100 Columns is under construction | No sourced month-level evidence | Best Terrace; thin population |
| 480s–470s | Xerxes yrs 1–15 | Few dated texts | Xerxes buildings are in progress | – | Worst of both |

### Pros and cons
- **498 BCE**
  - Pros: densest named population in any Achaemenid archive, which serves the brief's "ordinary, often named, lives". Spring New Year traffic to the court is evidenced for this period. The Apadana is the centrepiece whose construction is being paid for in these very tablets.
  - Cons: the Terrace is visibly a building site. The Gate of All Nations and Hadish are absent. The Apadana's completion state in 498 is unknown (C). The king's presence in a specific month is **not** yet source-checked (see `_chronology_C.md` §3).
- **467 BCE**
  - Pros: the iconic Terrace is largely complete.
  - Cons: few published names. The dynasty is two years from Xerxes' death (465), and no spring presence evidence was retrieved.

## Recommendation
**498 BCE (Darius I, regnal year 24).**
- Tier B, as a judgement resting on A-tier archive dates.
- Fallback: 499 or 497 BCE (years 23 and 25) keep the same archive density if a specific royal-presence text turns up for another year.

## Default start date
**1 Adukanaiša (OP) = Elamite Hadukannaš = Babylonian Nisannu 1, Darius I year 24 = 31 March 498 BCE, proleptic Julian (JDN 1539618).**
- The Babylonian day began at the preceding sunset, 30 March.
- Year 498 BCE = astronomical year −497.
- The year is **not intercalary**: 12 months, and Nisannu has 29 days. For comparison, 494 BCE has an Addaru II, and its Nisannu 1 falls on 16 April.
- Source: P&D, *Babylonian Chronology 626 B.C.–A.D. 75* (1956), tables pp. 25–46, via the machine-readable transcription [seanredmond/parker_and_dubberstein (TSV)](https://github.com/seanredmond/parker_and_dubberstein), row `1539618 -497 3 31 1 Nisanu 29`. **Tier A** for the Babylonian calendar. **B** for applying it to Persepolis: Adukanaiša corresponds to Nisannu ([Iranica, "Adukanaiša"](https://www.iranicaonline.org/articles/adukanaisa-a-du-u-k-n-i-s-name-of-the-first-month-march-april-of-the-old-persian-calendar-see-kent-old-persian-p/)), and the Persian intercalation is assumed to match the Babylonian.

### Months of Darius yr 24 (P&D, day 1, proleptic Julian)

| # | Babylonian | Old Persian (Iranica) | Day 1 | Days |
|---|---|---|---|---|
| 1 | Nisannu | Adukanaiša | 31 Mar 498 | 29 |
| 2 | Ayyaru | Θūravāhara | 30 Apr 498 | 30 |
| 3 | Simanu | Θāigraciš | 29 May 498 | 29 |
| 4 | Du'uzu | Garmapada | 28 Jun 498 | 30 |
| 5 | Abu | – | 27 Jul 498 | 29 |
| 6 | Ululu | – | 26 Aug 498 | 30 |
| 7 | Tashritu | – | 24 Sep 498 | 29 |
| 8 | Arahsamnu | – | 24 Oct 498 | 30 |
| 9 | Kislimu | – | 22 Nov 498 | 29 |
| 10 | Tebetu | – | 22 Dec 498 | 30 |

Old Persian names for months 5–12 were not retrieved in this pass.

### Nisannu 1 for alternative years (same source)

| Year BCE | Nisannu 1 |
|---|---|
| 499 | 11 Apr |
| 497 | 18 Apr |
| 494 | 16 Apr |
| 480 | 11 Apr |
| 467 | 17 Apr |
| 466 | 6 Apr |

## Open items
- Royal presence at Persepolis by month for years 23–25 needs Henkelman 2010 ("Consumed before the King") and Hallock 1969; both were blocked.
- Whether the Apadana was complete in 498 should be logged in OPEN_QUESTIONS.
