# Anachronism blocklist (applies to the ancient world only; calibration scene and Now view exempt)
Machine-readable copy: `src/data/blocklist.json` — the chronology lint (`npm run lint:chrono`) fails the build
if any asset/tag/text in the world matches. Each asset carries `period`, `source`, `tier` metadata.

| id | Blocked | Reason / note | Seed source |
|---|---|---|---|
| sasanian-relief | Sasanian reliefs and inscriptions at Naqsh-e Rustam, Naqsh-e Rajab | 3rd c. CE+ | brief §12 |
| sasanian-fire-temple | Domed (chahar-taq) fire temples | Sasanian | brief §12 |
| kaba-zartosht? | Ka'ba-ye Zartosht at Naqsh-e Rustam | **Not blocked** — Achaemenid tower; check date vs chosen year (OPEN_QUESTIONS) | — |
| band-e-amir | Band-e Amir dam and later waterworks | 10th c. CE | brief §12 |
| modern-landscape | modern roads, asphalt, power lines, tents, fields in rectangular modern layout, villages, plantations, eucalyptus/pine plantations | modern | brief §12 |
| ruin-graffiti | traveller graffiti (e.g. 19th c. names on Gate of All Nations) | later life of ruin | brief §12 |
| restoration | concrete, steel, restoration capping, modern stair replacements, scaffolding of modern type, roofs over the tombs | modern | brief §12 |
| 1971 | 1971 celebration tent city remnants | modern | brief §12 |
| signage | signage, fences, ticket gates, lamp posts | modern | brief §12 |
| stirrups | stirrups on any saddle/tack | not Achaemenid | brief §12 |
| paper | paper | later (China, Islamic world) | brief §12 |
| coins-everyday | everyday coin use in transactions | payment in kind / weighed silver; darics exist under Darius I — only as treasury/stored items, not market small change (verify, OPEN_QUESTIONS) | brief §12 |
| islamic-dress | chador, turban of Islamic type, Islamic-era garments | later | brief §12 |
| safavid | Safavid motifs, tilework, iwans with muqarnas | later | brief §12 |
| onion-dome | onion or any masonry dome | later | brief §12 |
| pointed-arch | pointed arches | later | brief §12 |
| hollywood-slaves | bare-chested slave-soldiers | trope | brief §12 |
| harem-cliche | harem clichés (veiled dancers etc.) | trope | brief §12 |
| gold-everything | gilding outside attested zones | trope | brief §12 |
| hoplite | Greek hoplite gear on Persians (Corinthian helmet, hoplon on Persians) | trope | brief §12 |
| later-womens-dress | later-period women's dress | later | brief §12 |
| music-cliche | oud, duduk, santur, orchestral "ancient Persia", equal-temperament harmony | brief §11 | brief §11 |
| new-world-crops | maize, tomato, potato, chili, tobacco, sunflower, prickly pear | Columbian exchange | common knowledge; tier A |
| later-crops | rice as a staple crop in Marvdasht, sugar cane, citrus (orange/lemon), cotton fields | later introductions to Fars; rice presence to be checked (OPEN_QUESTIONS) | tier B |
| later-animals | domestic cat as house pet (uncertain), turkey, water buffalo | verify | tier B/C |
| glass-windows | glazed window panes | Roman+ | tier A |
| candles | wax candles | lamps and torches instead; verify | tier B |
| horseshoes | nailed horseshoes | later | tier A |
| spoked-cart-wheels? | **Allowed** — spoked wheels attested on reliefs (chariots) | — | reliefs |
| later-inscriptions | Middle Persian (Sasanian) and Arabic/Persian Islamic-era inscriptions on the Terrace and at Naqsh-e Rustam | post-Achaemenid | Phase 0 re-review M-8 |
| frataraka | "Frataraka" pedestal-temple complex N of the Terrace | post-Achaemenid (Callieri; GONDET2018, SX) | Phase 6 research |
| istakhr-town | Walled town of Istakhr, its mosque and fortress (Qal'a-ye Istakhr) | Sasanian–Islamic: "no evidence … of the pre-Sasanian history" (ISTAKHR2018, SX); Barrington: Roman/Late Antique (PLEIADES-FARS) | Phase 7 research |
| later-sites-plain | Darre-ye Barre, Hajjiabad, Maqsudabad, Kuh-i Ayyub, Kuh-i Shahrak "temples"; Naqsh-i Bahram; Barm-i Dilak | Barrington/Pleiades Roman/Late Antique only (FT) | Phase 7 research |
| spring-cemetery | "Spring Cemetery" slipper-coffin burials | late 4th c. BCE or later (IR-ARCH2, SX) | Phase 6 research |
| later-tombs-nr | Naqsh-e Rustam tombs of Artaxerxes I and Darius II | kings reigning after 465 (the Xerxes tomb is open: Q-030) | Phase 7 research |
| modern-dams | Doroodzan dam, Mulla Sadra dam, Sivand dam and reservoirs; modern canals and pumping | modern (KOR-HSJ2023) | Phase 7 research |
| modern-plain | Marvdasht city, sugar factory, petrochemical complex, Shiraz–Isfahan highway and bridges, sugar-beet fields | modern (OVERTURE-2026) | Phase 7 research |
| date-palms-plain | date palms growing on the Marvdasht plain | dates are imported from the lowlands; 44 frost days a year (C) | Phase 7 research |
| qanat? | qanat shafts and galleries in the plain | not dated to the Achaemenid period (Q-035): **not placed**; unblock only with evidence | Phase 6 research |
