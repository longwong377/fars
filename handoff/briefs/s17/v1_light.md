# V1 light (D-480..D-489, Q-1410..Q-1419, B510..B519; branch s17-light)
The player sees, by tonight: the art direction's light and tone in every time band. Fars, hard high sun, warm key
(5200-5800 K), cool sky fill, deep but not black shadows, haze lifting the distance to pale ochre-blue (cleaner after the
spring rain, dustier from June), golden mornings and evenings; tone like AC Origins / RDR2: rich, warm, controlled highlights,
never washed grey, never neon. Contact shadows and AO so nothing floats; bounce light in lanes and courts. Then night: moon,
stars, fire light levels, night exposure (dark and readable, never blue-grey soup). Then re-bake the outdoor light
(src/render/probes/outdoor_bake.ts, D-357) under the new light.
Owns: src/render/pipeline.ts, toneLook.ts, ssgi.ts, sunShadows.ts, airlight.ts, envmap.ts, src/sky/**, src/render/probes/**.
**Push a commit titled "light v1" on s17-light by ~hour 2.5** (about 2 h from your start): every other agent's colour is
judged under it. Iterate on outdoor_probe / ground_probe / terrace_probe / house_lab at dawn, noon, late afternoon, overcast,
night; compare side by side with references/. Done line: at all bands the probe frames read as a modern AAA game's light, not
CG; "light v2" with night and the re-bake pushed by ~hour 6.
