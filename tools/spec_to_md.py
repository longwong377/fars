# regenerate research/SITE_SPEC.md from src/data/site_spec.json (logic kept in sync with Phase 0 generator)
import json
spec=json.load(open('src/data/site_spec.json')); S=json.load(open('src/data/sources.json'))
L=["# SITE_SPEC — Terrace (generated from `src/data/site_spec.json` by `tools/spec_to_md.py`; edit the JSON, not this file)","",
"**Status:** "+spec['_meta']['status'],"","Frame: "+spec['_meta']['frame'],"","Footprint polygons: `src/data/geo/footprints.json` (OSM/Overture, ODbL; `tools/osm_to_grid.py`).",""]
for k,v in spec.items():
  if k.startswith('_'): continue
  L.append(f"## {k}"+(f" — state in 467 BCE: **{v['state']}**" if 'state' in v else ""))
  L.append("| parameter | value | unit | source | tier | note |"); L.append("|---|---|---|---|---|---|")
  for pk,pv in v.items():
    if isinstance(pv,dict) and 'v' in pv:
      L.append(f"| {pk} | {json.dumps(pv['v'],ensure_ascii=False)} | {pv['u']} | {pv['src']} | {pv['tier']} | {pv['note']} |")
  L.append("")
L.append("## Source keys\n| key | citation | access |\n|---|---|---|")
for k,v in S.items(): L.append(f"| {k} | {v['cite']} {v['url']} | {v['access']} |")
open('research/SITE_SPEC.md','w').write("\n".join(L)+"\n")
