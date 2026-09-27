# A before/after sheet for the pipeline's renders (D-305): the two frames side by side, and under them the centre crop of
# each (the views aim at the asset) enlarged 2x with nearest-neighbour, so a reviewer sees the same pixels the player does.
# blender -b --factory-startup --python tools/blender/sheet.py -- <before.png> <after.png> <out.png> [crop=0.3] [cy=0.5]
import bpy, sys, numpy as np
a = sys.argv[sys.argv.index('--') + 1:]
crop = float(a[3]) if len(a) > 3 else 0.3
cy = float(a[4]) if len(a) > 4 else 0.5  # the crop's centre, as a fraction of the height from the top
ims = []
for p in a[:2]:
    im = bpy.data.images.load(p); w, h = im.size
    ims.append(np.array(im.pixels[:], np.float32).reshape(h, w, 4))
h, w = ims[0].shape[:2]
ch, cw = int(h * crop), int(w * crop)
y0, x0 = min(h - ch, max(0, int(h * (1 - cy)) - ch // 2)), (w - cw) // 2  # (rows are bottom-up)
crops = [np.repeat(np.repeat(x[y0:y0 + ch, x0:x0 + cw], 2, 0), 2, 1) for x in ims]
top = np.concatenate(ims, axis=1)
bot = np.concatenate(crops, axis=1)
pad = np.zeros((bot.shape[0], top.shape[1] - bot.shape[1], 4), np.float32); pad[..., 3] = 1
sheet = np.concatenate([np.concatenate([bot, pad], axis=1), top], axis=0)  # Blender images are bottom-up: crops end below
out = bpy.data.images.new('sheet', sheet.shape[1], sheet.shape[0]); out.pixels.foreach_set(sheet.ravel())
out.filepath_raw = a[2]; out.file_format = 'PNG'; out.save()
print('[sheet]', a[2])
