# s17 V2 materials: report (D-490)

**Broken / placeholder / unseen first**
- Not judged in a full-world render: all judging was on house_lab, terrace_probe and light_lab (under light v1). Nothing I did has been seen through the full pipeline yet.
- The houses' oval repair patches and rectangular brick-loss decals (houses.ts `decal`, owned by C1) still read as hard-edged stickers. The material can't fix that; the geometry needs feathered edges.
- In the plain probe, the near ground shows a pixel-blocky dark speckle and black, unlit flora cards (camelthorn/thistle). These are in terrainPlain.ts and groundFlora.ts (C2), not my files; my last A/B run was lost in the crash, so I haven't confirmed the cause.
- The palace walls are still close to flat past 20 m (the bays are now stronger); the Terrace limestone reads as grey-cream stone in the probe; doors, wood and cloth are untouched.
- The new scans now ship as KTX2 (public/textures/ktx.json, loaded through sharedKTX2; the jpgs remain as the fallback). Doors and wood are unchanged: rough_wood on every timber part (a door-only plank scan would need towndoors.ts to use its own surface, C1's file).

**What a player now sees differently**
- Town and village house walls show an earthen coat of pores, grit and chaff (Dirt Floor scan), with darker damp feet and stronger rain streaks.
- Footings are real fieldstones in mud (Stone Wall scan); the procedural voronoi stones are gone.
- Roofs and wall tops show kahgel straw (Raked Dirt); before, they had no scan at all.
- Fallen-plaster patches show real mud-brick courses (Clay Block Wall scan).
- Lanes and courts look like trodden earth instead of pale concrete.
- Limestone is warmer grey-cream, and the chisel hatching no longer shows past about 4 m.
- Water's reflection of the far bank follows the season.

**Frames judged:** shots/a2, a3 (house_lab), shots/L1, L2 (light lab, light v1), shots/t3 (terrace). The shots folder is gitignored.

**Views for the train:** court:q_s1:3 at 12.5 h; door:q_s3:11:3.5 at 16.5 h; above:q_s1:5 at 11 h; the Terrace W wall at e -66 n 22 eye 1.6 az 71 pitch 12.

**Files:** src/render/scans.ts (ScanUse `chroma` and `hue`, rotated second tile), blockface.ts, src/world/settlement/surfaces.ts, src/world/plain/waterShade.ts, src/data/scans.json, public/textures/{dirt_floor,raked_dirt,stone_wall}, tools/dev/ph_fetch.mjs, ASSET_LEDGER.md, DECISIONS.md.

**Tests:** 29 material/scan/surface vitest files pass; guards pass.
