// D-802: regenerate the town kit (public/models/kit/town/: kit.json, manifest.json, town_kit.glb) with Blender
// (tools/blender/kit_town.py); `--preview <dir>` also renders tools/blender/preview_kit_town.py's two contact sheets.
// BLENDER=tools/blender/bpy_cli.sh in the cloud (pip bpy 5.0.1).
import { execFileSync } from 'node:child_process';
const BL = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe', OUT = 'public/models/kit/town';
const a = process.argv.slice(2);
execFileSync(BL, ['-b', '--factory-startup', '--python', 'tools/blender/kit_town.py', '--', OUT], { stdio: 'inherit' });
if (a[0] === '--preview') for (const p of [0, 1]) execFileSync(BL, ['-b', '--factory-startup', '--python', 'tools/blender/preview_kit_town.py', '--', `${OUT}/kit.json`, `${a[1] ?? '.'}/kit_town_${p}.png`, String(p)], { stdio: 'inherit' });
