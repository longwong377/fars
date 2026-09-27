// Runs Blender headless with the given arguments (no shell: its install path has spaces), for tools/dev/gpu_slot.mjs, whose
// command runs through a shell: node tools/dev/gpu_slot.mjs <label> -- node tools/blender/lib/run_blender.mjs <blender args...>
import { spawnSync } from 'node:child_process';
const BLENDER = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe';
const r = spawnSync(BLENDER, process.argv.slice(2), { stdio: 'inherit' });
process.exit(r.status ?? 1);
