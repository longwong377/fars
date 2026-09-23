# regenerate research/CHRONOLOGY.md from src/data/chronology.json
import json
c=json.load(open('src/data/chronology.json')); rows=c['structures']
L=["# CHRONOLOGY — filter for YEAR = 467 BCE (Xerxes yr 19)","Generated from `src/data/chronology.json` by `tools/chrono_to_md.py`. The JSON is the source of truth; it is used by `npm run lint:chrono` and by the generators.",
"**Rule: fail-closed.** Anything not listed as present is absent. Tier = evidence class, capped at B when only a search extract was seen (BLOCKERS B6).","",
"| id | Structure | Built by | State at 1 Nisannu 467 | Present | Tier | Sources | Basis |","|---|---|---|---|---|---|---|---|"]
for r in rows: L.append(f"| {r['id']} | {r['name']} | {r['builder']} | {r['state']} | {'yes' if r['present'] else 'no'} | {r['tier']} | {r['src']} | {r['basis']} |")
L+=["","## Archives in use in 467 BCE","| Archive | State | Tier | Sources |","|---|---|---|---|",
"| Treasury Archive (492–458; peak Xerxes yrs 19–20) | active | B | IR-TREAS |","| Fortification Archive (509–493) | closed; tablets stored in the fortification | B | CHRON-C |","",
"## King and court (brief §2)","- No source places Xerxes at Persepolis on any date in 467 BCE (Q-005).",
"- General pattern: Persepolis was a seasonal spring/summer residence of a mobile court (WP-PERS-SEASON, RESIDENCE2021; B for the pattern, C for any given year). Under Darius I, trips to the king peaked at the New Year (KING2022, B).",
"- **Default (evidence-strict): the king is ABSENT**, with a smaller garrison guarding the Treasury (§9.1). The setting *Court calendar = seasonal pattern* (out-of-world, tier C) puts the court in residence Nisannu–Du'uzu. See DECISIONS D-003.",
"","## People filter","- Named NPCs must be attested around Xerxes yrs 15–20 (Treasury tablets) or be long-tenured. Darius-era Fortification Archive individuals are allowed only as tier C, and only if their life plausibly spans to 467."]
# Phases 6-7: settlement and plain features (src/data/settlement.json, src/data/plain.json). Not yet in chronology.json:
# add an id there before any asset uses it as a `structure` (lint:chrono is fail-closed).
import os
rows67=[]
for fn in ('src/data/settlement.json','src/data/plain.json'):
    if os.path.exists(fn):
        for f in json.load(open(fn))['features']:
            if f['kind'] in ('field_zone','field_zone_rule','orchard_rule','landcover_rule','horizon','river_node','canal_system','village_set'): continue
            p=f.get('present_467'); rows67.append((f['id'],f['name'],f['date_range'],'yes' if p is True else ('no' if p is False else 'open'),f['tier'],f['src'].replace(';','; '),os.path.basename(fn)))
if rows67:
    L+=["","## Settlement and plain (Phases 6–7)","Generated from `src/data/settlement.json` and `src/data/plain.json` (research/SETTLEMENT.md, research/PLAIN.md). Tier = the lower of existence and position. `open` = not placed pending a decision.","",
        "| id | Feature | Date | Present 467 | Tier | Sources | File |","|---|---|---|---|---|---|---|"]
    for r in rows67: L.append("| "+" | ".join(r)+" |")
open('research/CHRONOLOGY.md','w').write("\n".join(L)+"\n")
