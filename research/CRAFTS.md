# CRAFTS — the crafts and the record-keeping acts of D-255 (session 9)

What the evidence says and what is reconstructed for the seven activities that filled WORLD_INVENTORY G20, G26, G27, G28, G29,
GB4 and GB13 (hunters' rows A045, A095, A096, A098, A099; B-009, B-037, B-056, B-095; P-010, P-014, P-022, P-039, P-047).
Tiers: A attested / B inferred (search extracts and analogies capped at B) / C reconstructed. **No primary source was read this
session**: every attestation below is carried over from the project's own research files (PEOPLE.md, EVENTS.md, SETTLEMENT.md)
or is marked RECOLLECTION, NOT SEEN. Where the evidence is silent the most probable reconstruction by analogy is used (D-207,
UD-14) and marked C. The code: `src/people/activities.ts` (the notes the F3 overlay prints), `workAnims.ts` (the motions),
`props.ts`, `workObjects.ts`, `audio/soundscape.ts` (the strike kinds), `population.ts` (who, where, when), `popgeo.ts` (the
spots), `src/data/town.json` (the tannery and the press), `src/data/lives.json` (job_tasks.goldsmith, treasury_staff).

| Activity | Attested (tier) | Reconstructed (C) | Who, where, when in the simulation |
|---|---|---|---|
| **smith** — at the forge: hammer and tongs at the anvil, the bar reheated in the forge's fire while the bag bellows are worked, every third heat quenched | metal workshops among the Treasury's craftsmen (PT craftsmen: woodworkers, goldsmiths, stonecutters; IR-PET, IR-TREAS via PEOPLE.md: B); iron tools and smithing in the Achaemenid world (B, general) | the anvil on a stump, the tongs, the bag bellows (Egyptian tomb paintings show bag bellows trodden by foot: RECOLLECTION, NOT SEEN; pressed by hand here), the quench jar, the cycle's tempo; which workshops are smithies (town_plots.json 'metal', C) | the town's craftsmen whose house is a metal workshop (7 men in 6 houses, seed 1): at its forge 7:00-12:00 and 13:15-16:30, the second smith of a house and a smith's son at the bellows; 15 % of days the tools carried to the royal stores. The Treasury's goldsmiths at its metal workshops' forges on 15 % of days, two to a forge (Population.treasuryForge) |
| **goldsmith** — chasing a silver bowl on the stake (punch and small hammer), raising a sheet over it | goldsmiths among the PT craftsmen (B); the Treasury's gold and silver vessels and its "shiners" (LIVIUS-TREAS: B); chased and repoussé phialai of the period (B) | the stake in its block, the punch, the posture and tempo | the men of the Treasury's shiners' groups at its metal workshops: by the day's lot shining 35 %, chasing 35 %, raising 15 %, the forge 15 % (lives.json job_tasks.goldsmith); the shiners inside the Treasury chase on 25 % of half-days |
| **weigh** — silver weighed on a hand balance, the stone weights graded on the table | silver paid by weight in lieu of rations (PT; E-05: B); inscribed stone weights of Darius from the Treasury (RECOLLECTION of Schmidt's finds, NOT SEEN: B at most) | the equal-arm balance's form (Egyptian and Mesopotamian balances: B analogy), the table, the motion | the Treasury's weighers inside it (weighing 60 % of half-days) and the day's weigher at a silver payment (E-05, 1.8 h then the payment's tablet sealed). Was performed as `inspect` (REVIEWS/escapes.md) |
| **seal** — a cylinder seal rolled across a tablet, or over the clay on a jar's stopper and a sack's cord | the rollings on the Fortification and Treasury tablets (PFS, thousands of seals: A); sealings of jars and sacks (A as objects) | the posture, how often, who seals | the storekeepers inside the Treasury (15 % of half-days: the store's jars and sacks), the weigher after a payment, the Terrace scribe sealing the ration issue's tablets (E-01), a scribe's letters for the road station |
| **cut_seal** — a stone cylinder worked with the bow drill at a low block, with wet sand | seals by the thousand (A); the bow drill for stone (B analogy) | that seals were cut at Persepolis, by whom and where (C: WORLD_INVENTORY G29, hunter B's P-047 "C") | two men of each Treasury shiners' group (8), at its metal workshops or at home |
| **tan** — hides scraped on the sloping beam, turned in the vats; the drying frames, lime heap and stained ground | hides of the slaughter delivered to the Treasury for its workshops (PF 58-60, CE-07: A, Darius-era) | the tannery and its place, its method (lime or oak-gall: not known), the tools | the men and boys of the Treasury handlers' group 8 (14 people): at the tannery 7:00-16:00, home in a storm or a long rain; the morning after hides come into the Treasury, two carry them down from its store (Population.hideCarriers) |
| **press_oil** — roasted sesame pounded in a stone mortar; the paste worked in hot water and the oil skimmed off | sesame moved and issued in the PF (PF 56; E-11: A); sesame oil the Near East's lamp and cooking oil (B analogy); the lamps of the palaces (population.json "lamp keepers": C) | the press and its place, the pounding and hot-water method (C: the traditional way of getting sesame oil without a lever press) | one town craftsman in 25 (12 men) at the press by the royal stores 7:00-16:00, jars carried to the royal stores on some days; the lamp keepers fetch the lamps' oil from it on their lamp days |

## Places (C; Q-700, Q-701)
- **The tannery** ([428, 432], town.json): no tannery is located. The brief (§5.5) asks for it "at the town's downwind edge, by
  water". The wind at Persepolis blows from the W-SW in 11 months of 12 (climate.json wind_dir_deg 220-270), so everything E-NE
  of the town is downwind of it, and the Terrace is E of the town. Placed beside the last reach of the Kuh-e Rahmat canal NE of
  the Terrace, 14 m off its NW bank: downwind of the town and of the Terrace's N corner, by water, 350 m from the Terrace's NE
  corner. It stands UPSTREAM of the canal's end at the Terrace foot: the reconstruction has it take its water by a cut and let
  its spent liquor out onto the waste ground N of it, not back into the canal (C). The alternatives (the Pulvar N of the town:
  upwind; the lower town's S edge: dry, and upwind of the Terrace in a S wind) are worse on the brief's two conditions.
- **The oil press** ([-215, -690]): between the mill and the royal stores, which keep the oil (C).
- Neither is built as a structure: their people work in the open at those points with the beams, vats, frames, mortars and jars
  their performances carry (popgeo.ts; like the mill, the stockyard and the brickyard). The smiths work at the forge fittings the
  metal workshops already have (quarter.ts), which were lit with nobody at them (B-037).

## What is not done
- The flies at the tannery: the soundscape's flies follow dung and middens (world/fauna.ts `dungPts`), which the tannery is not
  one of; a one-line change there (out of this brief's files) would make them heard at the tannery.
- The tannery and the press as built places (walls, a shed, the pits cut in the ground) and a smell's visual trace beyond the
  stained ground and the heaps drawn with the tanners.
