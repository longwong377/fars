"""D-232: the rectified photograph #24 (face A, the Apadana salient's W face) over the node previews of the wall's joint layout
before and after (tools/dev/masonry_preview_d232.ts). Writes shots/masonry_compare_d232.png (s 0-60 m).
Run: npx tsx tools/dev/masonry_preview_d232.ts && python3 tools/dev/masonry_compare_d232.py
"""
import sys
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, 'tools/dev')
from masonry_photo_d232 import rectify, RES  # noqa: E402

W, H = 2300, 249
A = rectify('A')  # rows from z = 1.5 down at RES
j0 = int((1.5 - 0.65) / RES); photo = A[j0:j0 + H, :W]
enc = lambda v: (np.clip(v, 0, 1) ** (1 / 2.2) * 255).astype(np.uint8)
panels = [Image.fromarray(photo.clip(0, 255).astype(np.uint8))]
for w in ('before', 'after'):
    a = np.fromfile(f'shots/masonry_preview_{w}.f32', dtype=np.float32).reshape(H, W, 3)
    panels.append(Image.fromarray(enc(a)))
cut = int(60 / RES)
out = Image.new('RGB', (cut, (H + 18) * 3), (0, 0, 0)); d = ImageDraw.Draw(out)
for i, (p, lab) in enumerate(zip(panels, ['photo #24 rectified (face A, s 0-60 m, 5 cm/px)', 'before: D-218 coursing (tone 13 %, joints 1 px)', 'after: D-232 layout (CPU mirror)'])):
    out.paste(p.crop((0, 0, cut, H)), (0, i * (H + 18) + 18)); d.text((4, i * (H + 18) + 3), lab, fill=(255, 255, 0))
out.save('shots/masonry_compare_d232.png')
print('wrote shots/masonry_compare_d232.png', out.size)
