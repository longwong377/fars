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
