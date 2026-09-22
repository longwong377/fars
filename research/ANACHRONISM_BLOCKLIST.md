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
