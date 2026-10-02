# The big-machine session (3-4 h; 16 cores, 63 GB, T4): the look, in bulk

The assets exist (session 11 scans, session 12 Blender wave: capitals, reliefs, 34 animals, flora, frames, tents, Ajori,
Naqsh, birds, garments, hair, house kit). What has never happened: seeing them together. So the session is render -> judge
whole views -> bulk fixes -> render again. No asset hunting, no process, no per-change reviews.

## Minute 0-20: set up and the baseline render (lead)
1. `git clone` (or pull) s14-int; `git config core.autocrlf false`; `npm ci`; models: `public/models` from Hugging Face on
   demand (the site path; the local store is not needed for the look).
2. Render the baseline in ONE load: `node tools/dev/render_train.mjs` with the coverage points
   (tools/dev/coverage_points.ts) + the moments (tests/e2e/moments.spec.ts) at the player's lens, two times of day
   (morning, late afternoon) and one overcast. Meanwhile start the agents below on their known targets.
3. Judge every frame against the AAA bar (a top modern open world: RDR2, Ghost of Tsushima, AC Origins) and the references in
   references/. Rank what breaks the illusion most, by share of the screen. Re-point the agents at the worst.

## Agents (up to 6 at once; each a short brief: goal as the player sees it, files owned, done line)
| agent | the player sees | owns |
|---|---|---|
| light | sun, sky, haze, exposure, bounce, shadows, contact shadow and AO that make it read as a photograph | src/render/pipeline.ts, toneLook.ts, ssgi.ts, sunShadows.ts, airlight.ts, envmap.ts, src/sky/** |
| ground | earth, dust, paths, rocks and plants that sit IN the ground (blend, scatter density, wear), no tiling | src/terrain/**, src/world/groundRocks.ts, groundFlora.ts, roadLitter.ts, src/world/plain/**, src/render/scans.ts |
| town | lanes and houses: wall wear and repair, roofs, doors, clutter, washing, life at the thresholds | src/settlement/**, src/world/fill*.ts, furnish.ts, src/render/grime.ts |
| terrace | the stone: capitals and colossi off CG (2/5 in s12), block joints, weathering, paint, scale cues | src/arch/**, src/render/masonry.ts, monuments.ts, blockface.ts, reliefAtlas.ts |
| people | bodies, skin, cloth, hair and motion at 2-30 m; crowds that read as people, not mannequins | src/people/human*.ts, body*.ts, drape.ts, looks.ts, outfits.ts, impostors.ts, popview.ts, anim.ts |
| interiors | rooms lit by doors and hearths, furnished, lived in | src/arch/rooms.ts, terrace_rooms.ts, src/world/furnish_palaces.ts, fire*.ts |

Each agent iterates on probe pages (tools/dev/ground_probe.*, humanlab.html, treelab.html: seconds per load) and requests
its whole-world views on the render train; never its own full-world load.

## Rhythm
- Train runs every ~45 min on s14-int with everything merged; the lead merges agents as they land (union the record files).
- Budget after each merge (tools/dev/budget.mjs): a merge that makes load, first frame, memory or frame time worse waits.
- Stop rule: a class that judges "reads as real" in all its views stops; its agent moves to the next worst class.
- Last 30 min: final train, push everything, sessions/s17.md with the before/after frames and what still breaks first.
