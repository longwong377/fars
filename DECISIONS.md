# DECISIONS (decision · alternatives · evidence · reversible?)

## D-001 Engine stack (Phase 0, provisional until Phase 1 benchmarks)
- **Three.js r186 WebGPURenderer + TSL**, automatic WebGL2 backend fallback (`forceWebGL` for the separate test path).
  Alt: Babylon.js (brief mandates Three.js). Evidence: both paths verified available in headless Chromium (PREFLIGHT.md).
- **TypeScript + Vite**; tests: **Vitest** (unit/dimension/sky/weather/soak) + **Playwright** (camera rig, walkthrough bots, bench).
- **Sky/ephemeris: astronomy-engine** (MIT; VSOP87 truncated + ΔT model of Espenak–Meeus; supports dates back to −2000s,
  proleptic Julian handling via our own calendar layer). Alt: hand-rolled Meeus (more error-prone), JPL Horizons (blocked, B2).
- **Physics: Rapier (`@dimforge/rapier3d-compat`)** for character controller (step-up, slopes, falls). Alt: custom capsule vs BVH
  (three-mesh-bvh) — kept as fallback if WASM init fails in tests.
- **Navigation: recast-navigation-js** (Recast/Detour WASM, crowd). Alt: grid A* (C-tier fallback for sim-LOD agents).
- **Randomness: one seeded PRNG tree** (sfc32 streams derived from WORLD_SEED + subsystem name) — deterministic tests.
- **Fonts: @fontsource Noto Sans Old Persian / Cuneiform / Imperial Aramaic** (OFL).

## D-002 Georeference and world frame
- World frame: local ENU metres, origin at a fixed geodetic point on the Terrace (set in SITE_SPEC once coordinates are sourced),
  +X east, +Y up, −Z north (Three.js convention: north = −Z). Heights are metres above EGM2008 geoid (Copernicus vertical datum).
- Projection for data processing: UTM 39N (EPSG:32639) → ENU by subtracting origin (scale error < 0.05% over 40 km; logged).

## D-003 YEAR = 467 BCE (Xerxes I regnal year 19; astronomical year −466). Default start: 1 Nisannu = 17 April 467 BCE (proleptic Julian), JDN 1550958
**Alternatives:**
- 498 BCE (Darius I yr 24): the Fortification Archive peak, recommended by research subagent C (`research/_date_decision_C.md`).
- 466 BCE: the other Treasury peak year.

**Why 467:**
1. §3 priority 4 and Phase 3 require the route plain → Grand Stairway → **Gate of All Nations** → Apadana. The Gate of All Nations is Xerxes' (XPa, tier A), so it did not exist in 498. The Grand Stairway's builder is disputed (Darius vs Xerxes), so it too may be absent in 498. The 498 date would break the brief's core route.
2. "Height of its glory": the Apadana (completed by Xerxes), Tachara (completed, XPc), Hadish, Gate of All Nations, Harem and final Treasury all stand (tier A/B).
3. Construction is an asset: the Hall of a Hundred Columns is a live building site (begun by Xerxes, finished by Artaxerxes I; tier B).
4. The Treasury Archive peaks in Xerxes yrs 19–20 (Iranica, via extract; B), so this is the best-documented year of the Treasury period for named people. Examples are the treasurer Baratkama and the Treasury workmen paid partly in silver.

**Cost, accepted and logged:** far fewer named people than 498 (128 of 753 Treasury tablets published vs 2,120+ PF texts). The Fortification-era individuals named in brief §4.4 do not appear in person: Parnakka died c. 497/6, and Irdabama and Irtašduna are Darius-era. Irtašduna may still be alive (C). Earlier PF names may be reused only for *unnamed* NPC names, never as the same person (§9.1).

**Default start:** 1 Nisannu yr 19 falls in spring. It is 17 Apr 467 BCE per Parker & Dubberstein, via the machine-readable transcription seanredmond/parker_and_dubberstein (row `1550958 -466 4 17 1 Nisanu 30`), tier A for the Babylonian calendar. It is tier B for its Persian equivalence: Adukanaiša ≈ Nisannu. Year −466 is intercalary (Addaru II precedes it).

**Court presence on that date: NOT sourced** (OPEN_QUESTIONS Q-005). New Year court traffic is a B-tier pattern for the Darius period (King 2022), and presence for 467 is assumed at tier C. The king is modelled *present* from Nisannu through Simanu (C) and absent otherwise, pending evidence. This is reversible.

## D-004 Climate target
WMO CLINO 1991–2020 Shiraz 40848 (tier A, modern). Persepolis adjustment: Tmean and Tmin −1.5 °C, Tmax −1.0 °C, precipitation unchanged (tier C; lapse rate plus the Zarghan comparison). No paleoclimate temperature correction is applied (none sourced). A precipitation multiplier of 1.0 applies, with at most +10% as a C tunable (Maharlou cores: wet 3800–2000 BP; B). Modern dust and haze day counts are scaled ×0.5 for pre-modern (C) because modern pollution is excluded.
