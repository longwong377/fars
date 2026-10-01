// The baked light of the Terrace and the town (D-357): runs the outdoor light-field bake (src/render/probes/outdoor_bake.ts:
// ray tracing against the built world, worker processes) and writes public/lightmaps/outdoor.{bin,json}.
//   node tools/blender/lightmaps.mjs [--only=<region,...>] [--encode-only]   (RAW_DIR keeps the traced values; WORKERS)
// Heavy: run it through tools/dev/cpu_slot.mjs. The interior probes of the roofed halls stay tools/build_probes.ts (D-110).
import { spawnSync } from 'node:child_process';
const r = spawnSync('npx', ['tsx', 'src/render/probes/outdoor_bake.ts', ...process.argv.slice(2)], { stdio: 'inherit', shell: true });
process.exit(r.status ?? 1);
