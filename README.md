# PĀRSA assets archive (branch `assets-archive`)

Downloads made on the GPU machine in session 11 (2026-09-27), kept here because the cloud environment's proxy cannot reach
their sources (BLOCKERS B6, B7). Openly licensed files only (the repository is public): CC0, CC-BY, CC-BY-SA, CC-BY-NC,
CC-BY-NC-ND (unmodified, non-commercial redistribution) and public domain. Every folder has a manifest.json giving each
file's source URL, licence, authors, byte size and sha256. Files over 95 MB are stored as byte-exact `.partNN` chunks:
join them in order (`cat x.pdf.part* > x.pdf`, then check the sha256 in the manifest).

This branch shares no history with the code branches. To use it from a code checkout:

    git fetch origin assets-archive
    git worktree add ../fars-assets-archive assets-archive

- `textures/`: CC0 PBR materials (Poly Haven, ambientCG), 2K JPG maps. The ones the game loads are also in the code
  branch under public/textures/ (src/render/scans.ts, src/data/scans.json).
- `sources/`: open primary and secondary sources (ISAC volumes, Tolman, open papers) with sources/manifest.json.
  Free-to-read items without an open licence are NOT here; their links are in the manifest's `notRedistributed` list.
- `datasets/`: JPL Horizons (Sun, Moon, planets for 467 BCE from Persepolis), NOAA GHCN-Daily and ISD for Shiraz, NASA POWER,
  Open-Meteo/ERA5 for Persepolis (public domain / CC BY 4.0; datasets/manifest.json).
- `audio/irs/`: 13 measured impulse responses from the OpenAIR library (CC BY 4.0; each attribution in the manifest).
- `humans/makehuman_cc0/`: the MakeHuman system assets (CC0): skins, eyebrows, eyelashes, hair, eyes, proxies.
- `photos/`: 158 Wikimedia Commons photographs of Persepolis, Naqsh-e Rustam, the plain and Fars villages under CC0, CC BY or
  public domain (the 208 CC BY-SA ones stay on the GPU machine as reference-only); photos/manifest.json has author, licence
  and EXIF for each.
- `voices/`: Piper TTS voices under CC0 or MIT (fa_IR amir, ganji, ganji_adabi, reza_ibrahim; el_GR rapunzelina; ur_PK fasih, aegis_female).
