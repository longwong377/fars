// s18 C14 (D-790): blend the scanned face's relief (tools/humans/data/face_relief.png, tools/blender/face_scan.py) into the
// built skin.png's crease channel without re-baking it (tools/humans/skin.ts applyFaceRelief; bakeSkin applies it too).
// Run once on a skin.png baked before the relief existed: npx tsx tools/humans/face_relief_apply.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { decodePNG, encodePNG } from './png';
import { applyFaceRelief, FACE_RELIEF } from './skin';
const F = 'public/generated/humans/skin.png', sk = decodePNG(readFileSync(F)), W = sk.width / 2;
const n = applyFaceRelief(sk.data, sk.width, W, W, sk.height, decodePNG(readFileSync(FACE_RELIEF.file)));
writeFileSync(F, encodePNG(sk.width, sk.height, sk.data, 4)); console.log(`[face relief] ${n} texels of ${F}`);
