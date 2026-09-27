// D-311: regenerate the house kit (src/data/housekit.json) with Blender (tools/blender/housekit.py); a preview render with
// `node tools/blender/housekit.mjs --preview <out.png>` (tools/blender/preview_housekit.py).
import { execFileSync } from 'node:child_process';
const BL = process.env.BLENDER ?? 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe';
const a = process.argv.slice(2);
if (a[0] === '--preview') execFileSync(BL, ['-b', '--factory-startup', '--python', 'tools/blender/preview_housekit.py', '--', 'src/data/housekit.json', a[1] ?? 'housekit_preview.png'], { stdio: 'inherit' });
else execFileSync(BL, ['-b', '--factory-startup', '--python', 'tools/blender/housekit.py', '--', a[0] ?? 'src/data/housekit.json'], { stdio: 'inherit' });
