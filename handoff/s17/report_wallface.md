# s17 V9 wall faces (D-477), report

**Broken / not done:** no corner wear (houses carry no distance-to-corner attribute; needs an `adist`-style attribute in houses.ts, not my file); no vertex irregularity of tops (the houses' exposed tops already follow a worn line, farCrest); no per-house colour change (vertex tone in houses.ts, not mine). Not seen in a full-world render; the frame-time cost (~7 noise calls on the wall materials) needs the lead's budget check. Wash streaks still read weakly under the probe's flat light.

**What a player now sees:** town and village walls (house_plaster, every level) show a dark, splashed, damp base, patchy recoats with a slightly proud edge, mud streaks under the tops, a bleached rounded crest, and patches of fallen plaster with mud-brick courses behind (soft broken edge, no cut-out outline after the first probe). The palace mud plaster gets the same, lighter (kept in repair in 467).

**Probe frames judged** (C:/Users/Administrator/fars-wt/wallface/shots/, A/B with -off): houselab-door-s3-b, houselab-court-s1-b, houselab-village30-b, houselab-pop40-L0-b, pal-treasury-s30-b, pal-apadana-w30-b.

**Views for the train:** cov-084, cov-042, cov-098, cov-112, cov-238, cov-420 (the scoreboard's set); house_lab door:q_s3:11:3.5.

**Files:** src/render/materials.ts (EarthWeatherDef, SURF_V9, the layer block, PALACE_WEATHER), src/world/settlement/surfaces.ts (house_plaster only), tools/dev/house_lab.mjs (AB=1). **Tests:** samplers_d300, materials_d285, surfaces, grime_d366 pass.
