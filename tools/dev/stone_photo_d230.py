"""D-230 (B40): the stone's tone variation measured on the site photographs (references/INDEX.md §6), split into per-block
means, within-block texture and the rest (joints, shadows, carved form, cracks).

Linear luminance Y from the sRGB decode (the photographs are processed JPEG/WebP: Lightroom, phone HDR; ratios only).
Blocks are hand-picked boxes inside block faces, away from joints, cracks and the shelter's shadows, picked on 4x crops
(each box checked on an overlay). Run: python3 tools/dev/stone_photo_d230.py
"""
import numpy as np
from PIL import Image

REF = 'references/'
P24 = 'persepolis and the mountain behind the ruins 2.webp'  # #24 the Terrace W wall (2019-02-08 15:59, Lightroom)
P29 = 'reliefs.webp'                                          # #29 the Apadana E stair (buried until the 1930s; phone HDR)
P05 = 'The Gate of All Nations 2.webp'                        # #5 the Gate of All Nations, lintel and piers (2010)
P33 = 'stairs today.webp'                                     # #33 the Grand Stair and the Terrace wall (stock)

# #24: 31 boxes on the W face of the Apadana salient, courses above the polygonal base (x 190-510, y 500-590); box 25 holds a
# clamp hole and is dropped
B24 = [[232, 500, 250, 506], [265, 501, 285, 507], [300, 504, 325, 510], [355, 507, 380, 513], [420, 511, 450, 516], [220, 513, 235, 522],
       [250, 512, 268, 520], [295, 520, 315, 528], [340, 518, 355, 525], [390, 526, 420, 535], [430, 528, 445, 536], [473, 530, 490, 538],
       [268, 531, 282, 540], [235, 532, 255, 540], [300, 541, 320, 549], [340, 541, 360, 548], [380, 548, 400, 556], [425, 545, 445, 552],
       [460, 548, 480, 556], [255, 556, 285, 566], [300, 558, 320, 566], [345, 557, 370, 566], [395, 560, 420, 568], [440, 560, 465, 570],
       [490, 560, 505, 570], [220, 572, 240, 582], [270, 575, 290, 584], [320, 574, 345, 584], [370, 575, 395, 585], [420, 578, 440, 586],
       [460, 578, 490, 588]]
DROP24 = {25}
# #29: sunlit patches of the relief ground, by block (A: the upper-left guard panel, of which only one patch is out of the
# shelter's shadow; B: the inserted guard block; C: the lion-bull block; D: the block right of it)
B29 = {'A': [[200, 450, 235, 500]],
       'B': [[330, 395, 370, 440], [372, 395, 410, 440], [440, 395, 480, 440], [490, 395, 530, 440], [630, 400, 690, 440], [570, 450, 600, 500]],
       'C': [[1100, 390, 1150, 430], [1160, 390, 1230, 430]],
       'D': [[1290, 400, 1340, 450], [1360, 400, 1420, 450]]}
# #29: five merlons (monoliths) in the shelter's shade (uniform skylight), the lowest step either side of the slot
M29 = [[[95, 100, 125, 128], [165, 100, 195, 128]], [[255, 105, 280, 130], [325, 105, 360, 130]], [[410, 105, 440, 130], [495, 105, 530, 130]],
       [[575, 105, 600, 130], [660, 105, 690, 130]], [[745, 100, 775, 128], [830, 100, 860, 128]]]
# #5: the lintel's weathered grey skin and the fresh stone where the skin has spalled off
SKIN5 = [[320, 385, 355, 420], [640, 340, 700, 380], [720, 330, 780, 370], [855, 300, 900, 360], [300, 440, 330, 470]]
SPALL5 = [[460, 360, 560, 420], [520, 330, 580, 360], [600, 330, 640, 370]]
# regions for the whole-wall figure in 48 px windows (as the lead measured it)
WIN = {P24: [190, 500, 1080, 596], P33: [0, 200, 250, 700], P05: [190, 300, 900, 510]}


def load(f):
    a = np.asarray(Image.open(REF + f).convert('RGB')).astype(float) / 255
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    return 0.2126 * lin[..., 0] + 0.7152 * lin[..., 1] + 0.0722 * lin[..., 2], lin


def box(Y, b): x0, y0, x1, y1 = b; return Y[y0:y1, x0:x1]


def win48(Y, r, w=48):
    x0, y0, x1, y1 = r; v = []
    for yy in range(y0, y1 - w + 1, w // 2):
        for xx in range(x0, x1 - w + 1, w // 2):
            p = Y[yy:yy + w, xx:xx + w]; v.append(p.std() / p.mean())
    return float(np.mean(v))


def main():
    rows = []
    Y, L = load(P24)
    m = np.array([box(Y, b).mean() for i, b in enumerate(B24) if i not in DROP24])
    w = np.array([box(Y, b).std() / box(Y, b).mean() for i, b in enumerate(B24) if i not in DROP24])
    rb = np.array([box(L[..., 0], b).mean() / box(L[..., 2], b).mean() for i, b in enumerate(B24) if i not in DROP24])
    t = win48(Y, WIN[P24]); btw = m.std() / m.mean(); wit = float(np.sqrt((w ** 2).mean()))
    rows.append(('#24 Terrace W wall (weathered)', len(m), btw, (np.percentile(m, 75) - np.percentile(m, 25)) / 1.349 / np.median(m), wit, t,
                 float(np.sqrt(max(0, t * t - btw * btw - wit * wit))), rb.mean(), rb.std() / rb.mean()))
    Y, L = load(P29)
    bm, ws, rbs = [], [], []
    for k, bs in B29.items():
        bm.append(np.mean([box(Y, b).mean() for b in bs])); ws += [box(Y, b).std() / box(Y, b).mean() for b in bs]
        rbs.append(np.mean([box(L[..., 0], b).mean() / box(L[..., 2], b).mean() for b in bs]))
    bm = np.array(bm); rbs = np.array(rbs)
    rows.append(('#29 Apadana E stair, relief blocks (buried to the 1930s)', len(bm), bm.std() / bm.mean(), None, float(np.sqrt(np.mean(np.square(ws)))), None, None, rbs.mean(), rbs.std() / rbs.mean()))
    mm = np.array([np.mean([box(Y, b).mean() for b in pr]) for pr in M29])
    rows.append(('#29 Apadana E stair, merlons in shade', len(mm), mm.std() / mm.mean(), None, None, None, None, None, None))
    Y, L = load(P05)
    sk = [box(Y, b) for b in SKIN5]; sp = [box(Y, b) for b in SPALL5]
    rbk = [box(L[..., 0], b).mean() / box(L[..., 2], b).mean() for b in SKIN5]; rbp = [box(L[..., 0], b).mean() / box(L[..., 2], b).mean() for b in SPALL5]
    print('#5 Gate lintel: spall/skin luminance %.3f; within-patch: smooth skin %s, fresh spall %s; R/B skin %.2f, spall %.2f'
          % (np.mean([p.mean() for p in sp]) / np.mean([p.mean() for p in sk]), np.round(sorted(p.std() / p.mean() for p in sk), 3),
             np.round([p.std() / p.mean() for p in sp], 3), np.mean(rbk), np.mean(rbp)))
    for f in (P33, P05):
        Yf, _ = load(f); print('%s: Ystd/Y in 48 px windows %.3f' % (f, win48(Yf, WIN[f])))
    print('| photo | n blocks | between-block 1σ | (IQR) | within-block 1σ | 48 px windows | rest (joints, cracks, form) | R/B | R/B 1σ between |')
    print('|---|---|---|---|---|---|---|---|---|')
    fm = lambda v, p=3: '' if v is None else ('%.*f' % (p, v))
    for r in rows: print('| %s | %d | %s | %s | %s | %s | %s | %s | %s |' % (r[0], r[1], fm(r[2]), fm(r[3]), fm(r[4]), fm(r[5]), fm(r[6]), fm(r[7], 2), fm(r[8])))


if __name__ == '__main__':
    main()
