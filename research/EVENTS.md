# EVENTS: the year 467 BCE (Xerxes yr 19), 1 Nisannu = 17 April 467 to 29 Addaru = 5 April 466
Machine-readable: `src/data/events_calendar.json` (the simulation reads that file; this file explains it).
Population, rations and work-group templates are in `research/PEOPLE.md` §P5 and `src/data/population.json`.
Source keys are in `src/data/sources.json`. Access: `FT` = read in full this session; `SX` = web-search extract of a
named page (capped at B); `NS` = not seen (capped at C, "RECOLLECTION, NOT SEEN, verify").

**Read this first: what is broken, weak or placeholder.**
- **No event is attested for 467 itself.** The dated evidence is Darius-era: the Fortification texts (509–493), of which
  only 67 were read in full (CDLI-PF). Carrying any rhythm forward to Xerxes yr 19 is tier C. The one exception is the
  Treasury's activity (payments in silver), which does peak in Xerxes yrs 19–20 (IR-TREAS, SX, B).
- **The court is absent by default (D-003).** So there are no delegations, no royal feasts, no New Year journeys to the
  king and no royal-table deliveries. They exist only under the setting *Court calendar = seasonal pattern* (C).
- **Within-month timing is not recorded** in any retrieved text. The texts give the month a ration is *for*, not the
  day it is issued. Every "day 1–5" rule is C.
- **The agricultural calendar is modern Fars agronomy (SX) plus Old Persian month-name glosses (SX).** No Achaemenid
  farming calendar was retrieved.
- **The rates for births, deaths, sickness and marriage are a Roman Egypt analogue (SX) or have no source (C).**
- Religious events are limited to what the Persepolis Fortification texts attest: *lan*, *šip*, offerings to named gods,
  mountains and rivers, magi (*makuš*) and priests (*šatin*). Details of performance are not attested, so they stay
  minimal. Herodotus' description of Persian sacrifice is a Greek claim (B). Zoroastrianism is a living religion, so
  nothing is invented.

## 1. The months of year 19 (P&D via `src/data/calendar_467.json`; names via WP-CAL, SX)
| # | Babylonian | Old Persian | Elamite (PF) | gloss (etymology; **not** evidence of practice) | Julian dates | days |
|---|---|---|---|---|---|---|
| 1 | Nisanu | Ādukanaiša | Hadukannaš | "sowing (month)" (disputed) | 17 Apr – 15 May 467 | 29 |
| 2 | Aiaru | Θūravāhara | Turmar | "(month of) strong spring" | 16 May – 14 Jun | 30 |
| 3 | Simanu | Θāigraciš | Sākurriziš | "garlic-collecting (month)" | 15 Jun – 14 Jul | 30 |
| 4 | Duzu | Garmapada | Karmabataš | "heat-station (month)" | 15 Jul – 12 Aug | 29 |
| 5 | Abu | \*Dṛnabāji | Turnabaziš | "harvest (month)" | 13 Aug – 11 Sep | 30 |
| 6 | Ululu | Kārapaθiya (?) | Karbašiyaš | uncertain | 12 Sep – 10 Oct | 29 |
| 7 | Tashritu | Bāgayādiš | Bakeyatiš | "(month of) the worship of *baga*" | 11 Oct – 9 Nov | 30 |
| 8 | Arahsamnu | \*Vṛkazana | Markašanaš | "wolf-killing (month)" | 10 Nov – 8 Dec | 29 |
| 9 | Kislimu | Āçiyādiya | Hašiyatiš | "(month) of the worship of the fire" | 9 Dec 467 – 7 Jan 466 | 30 |
| 10 | Tebetu | Anāmaka | Hanamakaš | "(month of) the nameless god(?)" | 8 Jan – 5 Feb 466 | 29 |
| 11 | Shabatu | \*Θwayauvā | Samiyamaš | "(month of) the terrible one" | 6 Feb – 7 Mar 466 | 30 |
| 12 | Addaru | Viyax(a)na | Miyakannaš | "digging-up (month)" | 8 Mar – 5 Apr 466 | 29 |

Year 19 is not intercalary (354 days). Year 20 begins on 6 April 466. The Elamite forms are confirmed as achE month-name
lemmas in EWB (FT): tu-ir-ma-ir (Turmar, vol. 1 p. 349), tur-na-ba-zí-iš (vol. 1 p. 370), qa-ir-ba-ši-ya-iš
(vol. 1 p. 416). The EWB lemma base does not give the month numbers.

Climate context (Shiraz CLINO, tier A; D-004 adjustment, C). Rain days (≥ 1 mm) per Julian month, Jan→Dec:
6.3 5.4 5.1 3.3 1.3 0.1 0.2 0.2 0 0.8 3.3 4.7. Frost days: 18.2 9.6 1.9 0 … 2.4 12.2. Dust days, which peak in
April–July: 1.0 2.5 6.7 8.6 11.7 8.6 10.6 5.5 2.8 2.0 1.1 0.6 (then × 0.5, C). Tmax peaks at 38.7 °C in July.

## 2. Economy: rations, silver, deliveries
| id | month(s) | event | participants | place | quantities | frequency | source | tier |
|---|---|---|---|---|---|---|---|---|
| E-01 | all | **Monthly ration issue** to each work group (L texts): grain received "as rations for 1 month" | supplier/storekeeper (*kurmin*), apportioner (*šaramana*), the group's head (e.g. *arraššara*), a scribe who seals the tablet; the official who "assigned" the group (e.g. Iršena) is named but need not attend | the storehouse the group draws on (town); a Terrace depot for the Terrace gangs (C) | per head: men 30 qa; women 20 (unskilled) to 40–50 (skilled, head); children 10–20 (the Liduma list: 261½ BAR for 92) | monthly; **day 1–5 of the month (C)** | RATION-30, IR-PET, IR-WOMEN (SX); roles CDLI-PF (FT) | B (scale, roles) / C (day) |
| E-02 | all | **Wine/beer issue** "for rations of workers" | wine carrier (PF 50 "Barukka the wine carrier"), storekeeper | storehouse | PF 50: 36 marriš for a group | monthly for some groups (C) | CDLI-PF | A (the act, Darius-era) / C (frequency) |
| E-03 | all | **Special rations** (M texts) | storekeeper, group | storehouse | "most commonly an extra day's ration per month" | monthly, for some groups | IR-PET | B |
| E-04 | any | **Mother's ration** (N texts) after a birth | the mother, the group head, storekeeper | storehouse | single payment; a boy's mother gets twice a girl's; working amounts 10 qa grain + 10 qa wine/beer (boy), 5 + 5 (girl) | on each birth in a ration group | IR-PET, IR-WOMEN (SX); amounts NS | B / C (amounts; Q-030) |
| E-05 | all | **Treasury payment in silver** in lieu of part or all of a group's sheep, wine or grain rations, authorised by a letter or memorandum (the work, how long, who is responsible, pay by skill) | ordering official ("Budkama declares"), the treasurer, the team chief (e.g. "chief of a team of 100"), a scribe, a weigher (C) | the Treasury on the Terrace (the PT archive was kept there) | e.g. a chief of 100 labourers: 3 karša 2½ shekels (32½ shekels); ordinary rates not retrieved (placeholder 1–1½ shekels/month, C) | **2–4 documents per week** (C derivation: 753 PT tablets over 492–458, "the largest numbers of dated texts from years 19 and 20"; if 30–40 % fall in those 2 years, that is 110–150 a year) | IR-TREAS, IR-PET, PT-WAGE (SX) | B (practice) / C (rhythm) |
| E-06 | 4–8 (peak); 1–3, 9–12 (rare) | **Grain delivery to the royal stores at Persepolis** | receiver + "companion(s)", grain handler (*tumara*), delivery man, pack animals (C) | storehouse | 6–3,000 BAR per consignment; PF 6: 3,000 BAR over months 4–6 | C: 4–12 consignments a month in months 4–8; 0–3 otherwise | CDLI-PF (PF 2–8, 26, 30–33; months: PF 6 = 4–6, PF 7 = 8) | A (quantities, Darius-era) / C (seasonality: n = 2) |
| E-07 | all | **Grain to the mill (*nupištaš*) and flour back** | grain handler, mill workers (women's groups, C) | mill in the town (C) | PF 28–29: 1,132 and 316 BAR; flour consignments 20–730 BAR | C: weekly | CDLI-PF | A (the flow) / C (rhythm) |
| E-08 | all | **Brewing** from *tarmu*: "He made beer" | brewer | brewery (town, C) | PF 40: 700 BAR *tarmu* | C: monthly | CDLI-PF | A (the act) / C |
| E-09 | 6–8 (after the vintage), all (from stores) | **Wine delivery** | wine carrier, receiver | storehouse / royal stores | 5–925 marriš; PF 41: 43 marriš to Persepolis | C: 1–4 a month | CDLI-PF | A (quantities) / C (season) |
| E-10 | 4–6 | **Figs / fruit delivery** to the royal stores | receiver | storehouse | PF 53: 2 BAR figs | C: 1–2 a month in season | CDLI-PF | A / C (season) |
| E-11 | 7–8 | **Sesame** moved between places | receiver | storehouse | PF 56: 60 BAR | C: rare | CDLI-PF | A / C |
| E-12 | all (PF 60: month 1) | **Slaughter at the stockyard; hides delivered to the treasury** | supplier of the animals, slaughterers, two hide receivers (PF 58–60 name them) | stockyard (town), then the Treasury | 6–17 head (goats, rams, ewes, lambs) per text | C: 2–4 a month | CDLI-PF | A (Darius-era) |
| E-13 | 6–8 (C) | **Tax animals and "the sheep of the king" driven to Susa** | shepherds (≈ 700 for one drive), guides | road W out of the plain | PF 57: 4 animals; one drive with ≈ 700 shepherds | C: 1 large drive a year, in autumn | CDLI-PF; IR-ADMIN (SX) | A/B (the act) / C (month) |
| E-14 | all | **Flour drawn "in the treasury" for the *kurakaraš*** | treasury receiver, apportioner (Iršena in PF 405–406) | Treasury / treasury workshop | 20–25 BAR per text | C: monthly | CDLI-PF (PF 403–406) | A (Darius-era, other treasuries) |
| E-15 | all | **Store accounting**: sealed receipts go to the archive; stock is counted | scribes, storekeepers | storehouses, the Treasury | – | C: monthly count; annual accounts | IR-PET (texts are sealed by supplier and recipient and returned as records) | B (practice) / C (rhythm) |

## 3. Travel and communication
| id | month(s) | event | participants | place | quantities | frequency | source | tier |
|---|---|---|---|---|---|---|---|---|
| E-20 | all | **Express courier** arrives or leaves; relays of horse and man, "each horse and man at the interval of a day's journey" | courier (Elam. *pirradaziš*, "express messenger"), station staff, fresh horse | road station at the edge of town (C); letters to the Treasury on the Terrace | 1 rider, 1–2 horses | court absent: 0.3–1 a day; court resident: 2–6 a day (C) | HDT 8.98, XEN-CYR 8.6.17–18 (FT; Greek claims, B); *pirradaziš* (SX, B) | B (institution) / C (rate) |
| E-21 | all | **Travellers with a sealed authorisation (*halmi*)** arrive, show it, and draw travel rations | the party (officials, messengers, workers in transit), their guide (C), the storekeeper | road station / storehouse | 1–1.5 qa flour + ≈ 1 qa beverage per person per day; party size 1–20 typical (C); up to 1,633 (Lycian *marataš*) | court absent: 1–3 parties a week; court resident: 1–3 a day (C) | IR-PET ("sealed documents issued by the king or officials of satrapal level stating the scale"); HYLAND2022 (SX) | B / C (rates) |
| E-22 | all | Traveller routes | – | – | from Susa (via Bessitme ≈ Basht and Dašer, about halfway), Media, India, Arachosia, Sagartia, Areia, Gandara, Bactria; Sardis (Artaphernes' messengers, 495–494) | – | IR-PET, Potts 2009 (SX via search) | B |
| E-23 | any | **Large work-group transfer** arrives (a group of kurtaš reassigned) | group, heads, guide | road → town | 50–1,633 persons | C: 0–2 a year | HYLAND2022 (SX) | B (practice) / C (rate) |
| E-24 | – | **Delegations bearing gifts: none** while the king is absent. Whether the Apadana reliefs show a real annual procession is debated (brief §2) | – | – | – | 0 by default | D-003 | C |
| E-25 | 1 (setting only) | **Court arrives** (setting "seasonal pattern": resident Nisannu–Duzu) | king, household, guards at full strength, officials | Terrace, palaces, town | + the court-resident populations (PEOPLE §P5.6) | once, day 1 of month 1 (C) | D-003; Q-005 | C |
| E-26 | 4 (setting only) | **Court leaves** | same | – | – | once, end of month 4 (C) | D-003 | C |
| E-27 | 12–1 (setting only) | **Journeys to the king at the New Year** (Darius-era pattern) | officials, taxpayers | Terrace | – | court resident only | KING2022 (abstract) | B (Darius-era) / C |
| E-28 | all | Couriers of the post are not stopped "by snow nor rain nor heat nor darkness" | – | – | – | weather never cancels E-20 | HDT 8.98 (FT) | B (claim) |

## 4. Religion (attested rows; how they are shown: the D-209 notes below the table)
| id | month(s) | event | participants | place | quantities | frequency | source | tier |
|---|---|---|---|---|---|---|---|---|
| E-30 | all | ***lan***: "a specific kind of daily sacrifice, which, in economic terms, served as a basic income for individuals with cultic responsibilities"; "the most widespread type of sacrifice" in the archive | magus (*makuš*) or priest (*šatin*); the storekeeper issues the allocation | the offering place (**not on the Terrace**: no evidence; C) | PF 1955: 360 qa barley in four equal shares (*lan*, Mišebaka, a mountain, a river), period not retrieved; wine also used | daily (the allocation is drawn monthly, C) | HENK2008 (SX) | B (the rite exists, Darius-era) / C (continued in 467; place) |
| E-31 | all | **Offerings to a named mountain and a named river** | magus | mountain / river bank (C) | from the same allocation | C: monthly | HENK2008 (SX) | B / C |
| E-32 | all | **Offerings for gods**: Mišebaka ("All Gods"), Auramazdā, Humban (the most offerings; his grain is more than 3 × Auramazdā's), Napiriša, Adad, Šimut | magus or *šatin* (Elamite priest) | as E-30 | barley, wine, sheep | C: monthly | IR-ADMIN, HENK2008 (SX) | B / C |
| E-33 | – | ***šip***: a large sacrificial feast "intimately connected with the crown"; Parnakka presided at Pasargadae and Ziššawiš at Appištapdan; sheep/goats under a *halmi* of Parnakka (NN 2259) | a high official presiding, priests, guests | not at Persepolis in the attested cases | sheep, goats, grain, wine | **not scheduled by default** (neither office-holder is attested in 467); 0–1 a year only if a presiding official is set (C) | HENK2011 (SX) | B (Darius-era) / C |
| E-34 | – | Form of a Persian sacrifice (Greek claim): "they do not build altars or kindle fire, employ libations, or music"; "a Magus comes near and chants"; the sacrificer takes the meat | magus, sacrificer | open ground | – | the households' sacrifices at the precinct (D-209: about 180 a year, C) and the form of E-30 to E-32 as shown | HDT 1.132 (FT) | B (claim) / C (rate, place) |
| E-35 | – (court only) | **King's birthday feast**: "served once a year, on the king's birthday … *tukta* … the king anoints his head and makes gifts to the Persians" | king, court | wherever the king is | – | court resident only; date unknown | HDT 9.110 (FT) | B (claim) |
| E-36 | – (court only) | When the king "comes to Persia" he sacrifices and gives gifts to all the Persians, men and women | king | – | – | court resident only | XEN-CYR 8.5.21, 8.5.26 (FT) | B (claim) |
| E-37 | any | **Birthday meal**: "The day which every man values most is his own birthday … a more abundant meal"; the poorer serve "the lesser kinds of cattle" | household | home | one small animal or better food | once a year per adult (Persian households) | HDT 1.133 (FT) | B (claim) |

**How the religious rows are shown (D-209, session 7; the user's direction D-207: the most probable reconstruction, tier C,
as action, fire, offering and wordless chant; no invented liturgical words; no fire temple, the evidence being against
one in 467).** All of it is reconstruction unless a source is named:
- **The place:** an open-air precinct on the level bench at the foot of Kuh-e Rahmat, 180 m S of the Terrace (C): two stone
  plinths after the Pasargadae sacred precinct (B form, search extracts) and a stepped fire altar after the Naqsh-e Rustam
  tomb reliefs (B form; relief NOT SEEN), with a fire kept on it (C; Herodotus 3.16 "the Persians hold fire to be a god",
  read). No temple, shrine or statue (Herodotus 1.131, read).
- **E-30 (the lan):** the duty magus of three (day % 3) feeds the fire before first light, sets out the day's barley and a
  bowl of wine before it (set out, not poured: Herodotus 1.132 "no libations"), barsom in hand and the mouth covered (the
  Oxus plaques, B), chants without words, and banks the fire at dusk. Put off by the rain (9 days in the year, seed 1).
- **E-31, E-32:** barley set out on the mountain's slope or the river's bank (not in the water: Herodotus 1.138), or before
  the fire for a god, with the barsom and a wordless chant; an E-32 sheep is killed by the magus himself (Herodotus 1.140:
  "the Magi kill with their own hands"), boiled, chanted over and its meat carried home. The killing is never shown: the
  butchery of the joints on the hide is (D-142's rule).
- **E-34 (households' sacrifices):** about 180 a year (seed 1) by Persian and Median men of the town's Persian households
  (nine in ten households of standing a year, two in five of the others: C), each with a magus: the beast led to the
  precinct, the god called on, the beast cut up, its meat boiled and laid on soft grass, the magus chanting over it, the
  meat carried home (Herodotus 1.132, a Greek claim: B).
- **E-71 (funerals):** the day after a death the men of the house carry the dead on a bier to the burial ground (the town's
  at the mountain's foot 1.1 km S of the Terrace, C) and bury it; the women who can leave the little ones follow and stand
  at the grave (Herodotus 1.140: the body coated in wax and buried in the earth, B claim; not shown). A dead magus is only
  carried out to the hillside: exposure is never shown.
- **Not added (household piety):** no offering at meals and no household shrine. Herodotus 1.132 says no Persian sacrifice
  is made without a magus, which argues against a private offering at the hearth; no domestic cult of Persians is attested
  for the period. The house's hearth fire is kept (lit at dusk, banked, relit before dawn: fire.ts 'home'), which is
  practice, not rite. Babylonian and Elamite households' domestic cults (known in Mesopotamia) are an open question
  (Q-471).

## 5. Agriculture, herds and the river (Fars)
| id | month(s) | event | participants | place | quantities | frequency | source | tier |
|---|---|---|---|---|---|---|---|---|
| E-40 | 7–9 (peak 8: 10 Nov – 8 Dec) | **Ploughing and sowing of winter barley and wheat** | farming households, draught animals (C) | fields of the plain and town gardens | – | daily in the window, on dry days | FARS-CROP (irrigated wheat sown 2 Oct – 10 Jan, normal 11 Nov – 1 Dec; modern) | B (modern) / C (467) |
| E-41 | 2–3: days 33–66 (15 May – 17 Jun seasonal) | **Barley harvest** | whole households; hired or assigned kurtaš (C) | fields | – | daily in the window | FARS-CROP ("winter barley … harvested between May and July"); IR-FOODAG (May–Jun); plain.json crop model (cut by mid-June). Was months 1–3 (from 12 Apr), ahead of every source (Q-140) | B (modern) / C |
| E-42 | 2–4: days 50–95 (1 Jun – 16 Jul seasonal) | **Wheat harvest** | as E-41 | fields | – | daily in the window | FARS-CROP ("wheat harvest late May to late July"; rainfed mid-July); IR-FOODAG (Jun–Jul); plain.json (cut by mid-July) (Q-140) | B (modern) / C |
| E-43 | 2–5: days 43–141 (25 May – 31 Aug seasonal) | **Threshing and winnowing; grain carried to stores** | households, grain handlers | threshing floors; then E-06 | – | daily in the window, on days with a working wind for winnowing | inference from E-41/42; OP month 5 is "harvest (month)" (WP-CAL, SX); PF 6 delivery in months 4–6 (FT) (Q-140) | C |
| E-44 | 1 (C) | **Spring sowing of summer crops** (sesame is attested) | households | irrigated fields | – | – | PF 56 sesame (FT); OP month 1 "sowing" (SX; meaning disputed) | C |
| E-45 | 5–7 | **Vintage (grape harvest) and pressing** | households, estate workers | vineyards | – | – | no Fars source (C) | C |
| E-46 | 4–6 | **Fig and fruit harvest** | households | orchards and gardens | – | – | PF 53 figs exist (FT); season C | C |
| E-47 | 12–2 (Mar – May) | **Shearing** | shepherds | folds | – | once a year per flock | RECOLLECTION, NOT SEEN, verify (Babylonian temple flocks were plucked or shorn in spring) | C (Q-040) |
| E-48 | 10–12 | **Lambing** | shepherds | folds | – | – | no source | C |
| E-49 | 12–1 and 6–7 | **Transhumant flocks pass through the plain** (north in spring, south in autumn) | herders, flocks, dogs | roads and plain edges | 500–3,000 people (C) | twice a year | modern Qashqai analogue (SX: north in April, back in September) | C |
| E-50 | 11–12 | **Canal and channel clearing** | village labour | canals of the plain | – | once a year | OP month 12 "digging-up" gloss (SX); canals and weirs are attested in the survey (SUMNER1986, SX) | C |
| E-51 | 8–11 rising; 12–1 high (Mar–May); 2 falling; 3–7 low or dry (Jun–Nov) | **River flow**: the Pulvar and Kur rise with winter rain and spring snowmelt, and are low or dry in late summer and autumn | – | rivers | – | a continuous state | LANDSCAPE.md (B/C); climate (A) | B/C |

## 6. Building works (Hall of 100 Columns and Tripylon under construction; CHRONOLOGY C)
| id | month(s) | event | participants | place | quantities | frequency | source | tier |
|---|---|---|---|---|---|---|---|---|
| E-60 | all | **Daily work**: gangs of about 100 under a chief; masons, porters, stone-cutters | gangs (PT-WAGE: 100 + chief; 136 masons) | Terrace building sites | – | daily, dawn to mid-afternoon | PT-WAGE (SX) | C/B |
| E-61 | all | **Construction progress**: about 5 column shafts a year on the Hall of 100 Columns (≈ 1 every 10 weeks), plus wall courses and relief carving | as E-60 | Hall of 100 Columns | – | continuous | derived: ≈ 70 shafts still to raise (Q-012: ≈ 30 % up in 467) before completion under Artaxerxes I (≈ 15 years) | C |
| E-62 | 9–11 | **Winter slowdown**: no mud-brick, mortar or plaster work on frost or rain days; stone dressing continues on dry days; gang strength × 0.5 | as E-60 | – | – | frost 12–18 days/month, rain 5–6 days/month (Dec–Feb) | climate (A); the rule itself is C (no PT evidence retrieved) | C (Q-037) |
| E-63 | 2–5 | **Mud-brick moulding and drying** season (Babylonian month 3 is "the month of the brick mould of the king, (when) the king sets the brick in the mould") | brick makers | brick yards by water (town) | – | daily in season | WP-CAL (Astrolabe B, via extract) | B (Babylonia) / C (Persepolis) |
| E-64 | any month with Tmax > 33 °C (in practice 2–6) | **Summer heat**: midday rest on the building sites and for all outdoor work (Tmax 36–38 °C) | all outdoor workers | – | – | daily when the day's Tmax > 33 °C (D-086) | climate (A); the rule is C | C |
| E-65 | all | **Silver payment for completed work** (see E-05) | – | Treasury | – | after each work period | IR-TREAS (SX) | B / C |
| W-01 | all (rain days 6.3 / 5.4 / 5.1 in Jan–Mar) | **Rain**: people shelter; outdoor work stops; deliveries are a day late | everyone outdoors except couriers | – | – | on each rain day | climate (A); the rule is C | C |
| W-02 | all (thunder days peak at 1.5–1.8 in Mar–Apr) | **Storm**: all outdoor work stops; couriers still ride | – | – | – | on each storm | climate (A); HDT 8.98 (claim) | C |
| W-03 | all (peak Apr–Jul) | **Dust**: travel and deliveries slow (× 0.7); faces covered; work goes on | – | – | – | on each dust day | climate (A); the rule is C | C |

## 7. Life events (rates per 1,000 persons per year)
| id | event | rate | effect / performance | source | tier |
|---|---|---|---|---|---|
| E-70 | **Birth** | 40 (range 35–54) | triggers E-04; about half boys (Brosius: "almost even balance"); a new child joins the mother's group | BF1994 (SX): Roman Egypt, female birth rate "as high as 54 per thousand", disputed as too high; IR-WOMEN (SX) for the sex ratio | C (rate) / B (sex ratio) |
| E-71 | **Death** | 40 (range 35–45); infant deaths 250–350 per 1,000 births (C) | the household changes and rations stop. Performance: the body is carried out of the settlement. Herodotus: Persians coat the body in wax and bury it in earth; the magi first expose it to birds or dogs (a practice "secretly and obscurely told"). **Do not show exposure.** | BF1994 (SX: life expectancy at birth 22–25, so CDR ≈ 1/e0 ≈ 40–45); HDT 1.140 (FT); infant mortality is RECOLLECTION, NOT SEEN (Coale-Demeny West levels 2–4) | C / B (claim) |
| E-72 | **Sickness episode** | 1,000–2,000 episodes (1–2 per person-year); peak in summer (gut) and winter (chest) | a day or more off work; stays home | no source | C (Q-039) |
| E-73 | **Marriage** | 8–10 | **no rite is attested** for commoners at Persepolis, so no ceremony is shown: the households change quietly | no source | C |
| E-74 | **Dispute** (over a ration shortfall, a place in the queue, a borrowed tool) | 50–150 small disputes; escalation to an official is rare | voices raised at the store or on the site | no PF or PT dispute text was retrieved | C |
| E-75 | **Birthday meal** | 1 per adult Persian | see E-37 | HDT 1.133 (FT) | B (claim) |

## 8. Guards
| id | event | rule | source | tier |
|---|---|---|---|---|
| E-80 | **Change of watch** | three watches a day (the Phase 3 sim) | reconstruction | C |
| E-81 | **Treasury guard doubled** when silver is weighed out (E-05) or a courier arrives | while E-05 or E-20 is running | brief §9.1; reconstruction | C |

## 9. Cause and effect (dependencies the simulation must honour)
| # | cause → effect | evidence | tier |
|---|---|---|---|
| CE-01 | A group's monthly ration issue (E-01) draws down the storehouse by the sum of its ration scale | the ration lists record outlays from a named supplier's store (RATION-30, IR-PET, SX) | B |
| CE-02 | **Store short at issue time → the issue is partly paid in another commodity, or in silver at the Treasury** (E-05) | PT: silver "in lieu of partial or full rations of sheep, wine, or grain" (IR-TREAS, SX) | B (substitution exists) |
| CE-03 | Store short and no substitute → a short ration: the group's hunger rises, work slows, and disputes (E-74) become more likely | no text retrieved | C |
| CE-04 | A late grain delivery (E-06 delayed by weather, or none in months 4–8) → stocks fall → CE-02/CE-03 in the following months | inference from CE-01 and the seasonality of E-06 | C |
| CE-05 | Harvest (E-41/42/43) → grain transports to Persepolis in months 4–8 → stores refill | PF 6 (months 4–6), PF 7 (month 8) (FT) | B (n = 2) / C |
| CE-06 | Grain → mill → flour → rations and travel rations; grain → brewing → beer | PF 28–29, 30–33, 40 (FT) | A (Darius-era flows) |
| CE-07 | Slaughter (E-12) → hides delivered to the treasury → treasury workshop stock | PF 58–60 (FT) | A (Darius-era) |
| CE-08 | Travellers arriving with a *halmi* (E-21) → travel rations issued (1–1.5 qa flour + ≈ 1 qa drink per head per day) → the store falls. **No *halmi*, no rations** | IR-PET, HYLAND2022 (SX); the refusal is inferred | B / C (refusal) |
| CE-09 | Birth (E-70) → a mother's ration (E-04), boy × 2 → a new ration-group member | IR-PET, IR-WOMEN (SX) | B |
| CE-10 | Completed work period → memorandum → silver payment at the Treasury (E-05) → Treasury guard doubled while silver is out (E-81) | IR-TREAS, IR-PET (SX); the guard rule is C | B / C |
| CE-11 | Rain day → outdoor work stops (people shelter); a storm stops all outdoor work, but couriers still ride | climate (A); HDT 8.98 for couriers (FT, claim) | C / B |
| CE-12 | Frost day → no mud-brick, mortar or plaster work; winter gang strength × 0.5 (E-62) | climate (A); rule C | C |
| CE-13 | Dust day → deliveries and travel slow; people cover their faces; work continues | climate (A); rule C | C |
| CE-14 | Summer heat → midday rest (E-64); water carrying increases | climate (A); rule C | C |
| CE-15 | Sickness (E-72) → the worker stays home; the group's output falls; the ration continues (no text says it stops) | none | C |
| CE-16 | Death (E-71) → the household shrinks; that person's ration stops; the group head reports it | none | C |
| CE-17 | *(setting)* Court arrives (E-25) → royal-table supply lines open (flour on the scale of PF 0701, 126,100 qa; sheep on the scale of PF 0696, 1,224 head; poultry on the scale of PF 2034, 1,044 head); guards to full strength; couriers and travellers × 3–6; crowded roads | IR-ADMIN (SX) for the scale; the brief (§9.5) for the consequences | B (scale) / C |
| CE-18 | *(setting)* Court leaves (E-26) → the population falls back to the court-absent values within 1–2 weeks | none | C |
| CE-19 | River low (E-51, months 3–7) → irrigation water is scarce; watering is rationed by channel turn; disputes × 1.5 | LANDSCAPE (B/C) | C |
| CE-20 | Sowing (E-40) needs the first autumn rains (months 7–8) → a dry autumn delays sowing and the next year's harvest | climate (A); rule C | C |

## 10. Weekly variety floor (for the soak test, §13.11)
Distinct event kinds that occur in **every** week of the year, court absent: E-01 or E-03 (only in the first week of a
month), E-05, E-07, E-12, E-15, E-20, E-30, E-60, E-72, E-74, E-80, plus a seasonal farm or herd event (E-40 to E-51).
That gives ≥ 8 kinds a week in every week, and ≥ 10 in the first week of a month and in harvest or sowing weeks.
**Proposed soak floor: ≥ 8 distinct event kinds per week.** This is a design proposal (C), not evidence.
