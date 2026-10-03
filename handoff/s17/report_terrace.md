# V4 terrace report (s17, D-510..D-512; branch s17-terrace)

**Broken, placeholder or unseen first**
- Nothing here has been seen in a full-world render; everything was judged on probe frames only. Train views are requested below.
- The W bull (D-510) is a composite. Its pressed wing still leaves faint ridges along the upper back. The bull-head scan is
  coarse (12.5 k triangles, smoothed), and its poll was cut flat where the scan was open. The beard's drawn-in cap reads as a
  plain plate above the chest.
- The protome capitals (D-511) are fore-parts cut from that same bull, so they share its flaws. They were seen only from below, at 20 m.
- `build --verify` gives different bytes for both new assets: Blender's bake is not byte-stable here. The "reproducible" test fails for them.
- These test failures were already there before my work: 10 stale Blender assets, the sculpt-pieces hash, and column_shaft_plaster.
- Still to do: the relief figures are still procedural (flat cut-outs with weak carving). The real fix is an atlas re-bake
  (relief_atlas.ts) or the scanned relief "Two Persian courtiers" (CC-BY, Objaverse 2af5acdf, checked: a museum fragment with real carving).
- Not merged here: a 3 % merlon inset meant to stop the dark stripes along the stair parapets. Those stripes came from the probe
  page missing the decor merlon; the world's merlon is fine.

**What a player now sees differently**
- **W bulls of the Gate (B361):** they now come from the licensed sculpts. The body is the lamassu sculpt with the wing pressed
  in and the human head drawn in; the head is a CC-BY bull-head scan. No longer the SDF model.
- **Protome capitals (B360, 210 capitals):** two kneeling bull fore-parts from those same sculpts.
- **Relief paint:** now a mineral wash (opacity ~0.5) with the stone and the carving showing through, instead of flat saturated cut-outs.
- **Inscriptions:** no salt-and-pepper speckle at 5-10 m.
- **Gate doorway bands:** glazed rosette bands where there were flat blue slabs.

**Probe frames:** shots/v4/*-{e,g,h}.png. These are untracked; regenerate them with tools/dev/v4_probe.mjs.

**Views for the lead's train** (e, n, eye, heading, pitch; day 17 Apr, 10:00 and 16:00):
- -30, 125, 1.6, 63, 12 (W bulls)
- -14, 74, 1.6, 167, 3 (Apadana N stair)
- -4, 47, 1.6, 180, 60 (capitals)
- -21, -107, 1.6, 180, 0 (Tachara S stair)
- 64, 125, 1.6, 265, 5 (Gate E)

**Files:**
- tools/blender/scans/{bull_from_lamassu.ts, bull_graft.py, protome_scan.ts, colossus_scan.ts, scanlib.ts, scans.json}
- tools/blender/assets.json
- public/models/{colossus_bull, capital_protome}.glb and manifest.json
- src/data/polychromy.json, src/render/incision.ts, src/arch/glazed.ts
- tools/dev/v4_probe.*
- tests/blender_assets.test.ts
- ASSET_LEDGER.md

**Tests:** blender_assets, sculpt, columns_baked, paint_glaze, crenellation, inscriptions and polychromy add no new failures
except "reproducible" on the two rebuilt assets. guards pass.

**Hook for V2:** the paint's sun-fade (chroma toward the stone) belongs in materials.ts paintedStoneMaterial.
