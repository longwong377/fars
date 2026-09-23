# ASSET LEDGER (source · licence · credit · tier) — every asset in the build
| Asset | Source | Licence | Credit | Tier |
|---|---|---|---|---|
| Terrain rings (public/generated/terrain_*.u16) | Copernicus GLO-30 DSM, processed (D-006) | Copernicus DEM licence | © DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018, provided under COPERNICUS by the EU and ESA | B |
| Footprints (src/data/geo/footprints.json) | OpenStreetMap via Overture Maps 2026-08-19.0; Pleiades | ODbL; CC-BY | © OpenStreetMap contributors; Pleiades | B |
| Star catalogue (public/generated/stars_*) | HYG database v4.1 | CC BY-SA 4.0 | D. Nash / astronexus | A |
| Calendar table | Parker & Dubberstein 1956 (transcription by S. Redmond) | facts | — | A/B |
| Climate normals | WMO CLINO 1991–2020 (IRIMO) | WMO open data | WMO / IRIMO | A |
| Fonts (Noto Sans Old Persian, Cuneiform, Imperial Aramaic) | @fontsource | SIL OFL 1.1 | Google / Noto project | — |
| three.js, astronomy-engine, Rapier | npm | MIT / MIT / Apache-2.0 | respective authors | — |
| Sky model | three SkyMesh (Preetham) | MIT | three.js authors | B |
| Player body | procedural placeholder | project | — | C (placeholder) |
| All sounds (wind, rain, thunder, birds, jackals, crickets, fire, chisels, footsteps) | procedural Web Audio synthesis (src/audio) | project (no recordings) | — | species B/C (research/SOUNDSCAPE.md); sound design C |
| Reverb impulse responses | generated from room dimensions (Sabine RT60) | project | — | C |
| Sculpted column orders and Gate colossi (src/arch/sculpt.ts, sculpt_models.ts, sdf.ts; src/data/sculpture.json; public/generated/sculpt_*.bin) | procedural: lathes with relief + SDF models → marching cubes → quadric simplification (D-018); marching-cubes tables from three/addons MarchingCubes | project; tables MIT | three.js authors (tables) | C (procedural sculpture from the type, not measured; licensed scans would replace it, NEEDS #10) |
| SSGI node, patched (src/render/ssgi.ts) | three.js r186 examples/jsm/tsl/display/SSGINode.js; sky samples skipped, reversed-Z sky test (D-012) | MIT | three.js authors | — |
