"""D-232: the Terrace retaining wall's masonry measured on photograph #24 (references/INDEX.md §6; the W wall from the plain,
2019-02-08). The photo is rectified onto the wall planes with the solved camera of D-230 (tools/dev/calib24_camera.py):
face A = the Apadana salient's W face (grid e = -61.45, from its NW corner n = 59.71 southward; 116-195 m from the camera,
0.08-0.13 m per photo pixel), face B = the W wall S of the salient (e = -53.2 -> -52.5, n = -70.8 -> -158.4; 213-291 m,
0.15-0.20 m per pixel). s = metres along the face from its N end, z = metres above the court datum (the model's).
The joints were read by eye on 4-5x crops of the rectified face with a 0.5 m grid (READ below), checked against an automatic
bed profile (the 60th percentile along s of the vertical luminance gradient: AUTO); the overlay is written for checking.
Run: python3 tools/dev/masonry_photo_d232.py   (writes shots/masonry_d232_faceA.png, prints the distributions as JSON)
"""
import sys, math, json
import numpy as np
from PIL import Image, ImageDraw
from scipy.signal import find_peaks
from scipy.ndimage import gaussian_filter
sys.path.insert(0, 'tools/dev')
from calib24_camera import Cam, PHOTO  # noqa: E402
from calib24_compare import PHOTO_CAM  # noqa: E402

RES = 0.05
FACES = {'A': (-61.45, 59.71, -61.49, -55.4), 'B': (-53.18, -70.79, -52.51, -158.4)}
# joints read by eye on face A (m). beds: [z, s0, s1] (a bed line and the span it was seen over); heads: [z_top, z_bottom, [s...]]
READ = {
    'beds': [[0.65, 0, 62], [-0.53, 0, 62], [-1.9, 0, 62], [-3.25, 2, 6], [-3.55, 8.5, 10], [-3.7, 5.1, 8.5], [-2.4, 10, 15.5], [-2.4, 25, 28.3],
             [-3.5, 10, 62], [-5.15, 0, 40], [-4.5, 47.5, 62], [-5.9, 40, 62], [-6.6, 0, 10], [-6.25, 16, 25], [-6.4, 25, 40]],
    'heads': [[0.65, -0.53, [2.9, 5.0, 7.0, 13.25, 18.0, 21.4, 27.6, 30.0, 34.1, 36.25, 38.25]],
              [-0.53, -1.9, [1.65, 4.0, 8.15, 9.6, 11.1, 12.25, 14.4, 16.6, 20.6, 22.75, 24.75, 26.9, 28.1, 30.0, 32.0, 34.25, 37.0, 39.25, 41.4, 43.5, 45.5]],
              [-1.9, -3.5, [2.1, 6.0, 7.6, 9.6, 15.6, 18.5, 22.5, 25.9, 28.25, 29.9, 32.0, 34.5, 36.5, 38.25, 42.2, 47.3, 48.5]],
              [-3.6, -5.15, [5.1, 8.0, 12.1, 16.6, 17.75, 23.9, 26.0, 28.6, 31.1, 35.75]],
              [-5.15, -6.4, [16.4, 19.9, 22.1, 27.25, 30.0, 33.5, 35.6]],
              [-4.5, -5.9, [40.4, 47.4]]],
    # the head joints' runs: a course's list is split where a stretch was not read (the lengths only between neighbours read
    # in one run): the breaks, per course, in s
    'breaks': {0: [9, 12, 26], 1: [], 2: [11, 14, 24], 3: [9, 11], 4: [], 5: []},
    # the top of the lower zone of large irregular (polygonal) blocks and bedrock (z), along face A; face B has none
    'foot': [[0, -7.0], [10, -7.2], [12, -6.6], [16, -6.3], [24, -6.3], [26, -6.4], [40, -7.2], [44, -7.0], [53, -7.0], [56, -6.4],
             [62, -6.8], [70, -9.5], [77, -11.6], [115, -11.6]],
    # the lower zone's blocks read (s0, s1, z_top, z_bottom): mostly big, some small fillers between them
    'foot_blocks': [[0, 5.8, -7.4, -9.5], [0, 6.8, -9.8, -12.0], [10.2, 16.0, -6.9, -9.0], [10.0, 15.75, -6.6, -8.0], [16.6, 20.1, -6.3, -7.8],
                    [20.3, 23.8, -6.3, -7.8], [7.5, 8.5, -8.3, -9.2], [8.5, 9.5, -8.3, -9.3]],
}
GROUND = -11.8  # the DEM at the wall foot (model frame)


def rectify(face):
    e0, n0, e1, n1 = FACES[face]
    c = Cam(PHOTO_CAM['e'], PHOTO_CAM['n'], PHOTO_CAM['eye'], PHOTO_CAM['az'], PHOTO_CAM['pitch'], PHOTO_CAM['f'], PHOTO_CAM['roll'])
    im = np.asarray(Image.open(PHOTO).convert('RGB')).astype(float)
    L = math.hypot(e1 - e0, n1 - n0); W = int(L / RES); H = int(17.5 / RES)
    out = np.zeros((H, W, 3))
    for i in range(W):
        t = (i + 0.5) / W; e = e0 + (e1 - e0) * t; n = n0 + (n1 - n0) * t
        for j in range(H):
            q = c.proj(e, n, 1.5 - (j + 0.5) * RES)
            if q is None: continue
            u, v = q
            if 0 <= u < im.shape[1] - 1 and 0 <= v < im.shape[0] - 1:
                x0, y0 = int(u), int(v); fx, fy = u - x0, v - y0
                out[j, i] = (im[y0, x0] * (1 - fx) + im[y0, x0 + 1] * fx) * (1 - fy) + (im[y0 + 1, x0] * (1 - fx) + im[y0 + 1, x0 + 1] * fx) * fy
    return out


def auto_beds(img, s0, s1, ztop, zbot):
    a = img / 255; lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    Y = lin @ [0.2126, 0.7152, 0.0722]; L = gaussian_filter(np.log(Y + 1e-3), 1.0)
    i0, i1 = int(s0 / RES), int(s1 / RES); j0, j1 = int((1.5 - ztop) / RES), int((1.5 - zbot) / RES)
    gz = np.abs(np.gradient(L, axis=0))[j0:j1, i0:i1]; z = ztop - (np.arange(j1 - j0) + 0.5) * RES
    p = np.percentile(gz, 60, axis=1)
    pk, _ = find_peaks(p, distance=int(0.4 / RES), prominence=np.median(p) * 0.35)
    beds = sorted([ztop] + [float(z[k]) for k in pk] + [zbot], reverse=True)
    return [round(a - b, 3) for a, b in zip(beds[:-1], beds[1:])]


def stats(v):
    v = np.array(v, float)
    return dict(n=len(v), median=round(float(np.median(v)), 3), p25=round(float(np.percentile(v, 25)), 3), p75=round(float(np.percentile(v, 75)), 3),
                min=round(float(v.min()), 3), max=round(float(v.max()), 3), mean=round(float(v.mean()), 3))


def main():
    A = rectify('A'); B = rectify('B')
    # course heights: face A read by eye (the continuous beds of the upper zone, s 0-40, and the thin partial courses);
    # the far stretches from the automatic profile (face A s 77-114, face B s 10-85)
    read_h = [1.18, 1.37, 1.6, 1.6, 1.25, 1.12, 1.3, 1.25, 1.35, 1.6, 1.0, 1.4, 1.1]  # s 0-40 (0.65 -> -6.4) and s 40-62 (0.65 -> -7.0)
    split_h = [[0.46, 1.1], [0.45, 1.15]]  # course 3 split into a thin and a tall course over s 10-15.5 and 25-28.3
    auto_h = auto_beds(A, 77, 114, 0.6, -11.6)[1:-1] + auto_beds(B, 10, 45, 0.6, -11.6)[1:-1] + auto_beds(B, 45, 85, 0.6, -11.6)[1:-1]
    auto_h = [h for h in auto_h if h < 2.0]  # a >2 m gap is two or three courses whose joints did not resolve at 0.2 m per pixel
    heights = read_h + [h for p in split_h for h in p] + auto_h
    lengths = []
    for ci, (_, _, hs) in enumerate(READ['heads']):
        br = READ['breaks'].get(ci, [])
        for a, b in zip(hs[:-1], hs[1:]):
            if any(a < x < b for x in br): continue
            lengths.append(round(b - a, 2))
    foot = np.array(READ['foot']); fh = np.interp(np.arange(0, 115, 0.5), foot[:, 0], foot[:, 1]) - GROUND
    lenA = 115.1; lenB = 87.6
    share_len = (fh > 0.5).sum() * 0.5 / (lenA + lenB)
    share_area = fh.clip(0).sum() * 0.5 / ((lenA + lenB) * (0 - GROUND))
    fb = np.array(READ['foot_blocks']); big = fb[(fb[:, 1] - fb[:, 0]) > 2]
    out = dict(course_height=stats(heights), course_thin_share=round(float(np.mean(np.array(heights) < 0.75)), 3), course_tall_share=round(float(np.mean(np.array(heights) >= 1.5)), 3),
               course_heights=heights, block_length=stats(lengths), block_long_share=round(float(np.mean(np.array(lengths) >= 3.5)), 3), block_lengths=lengths,
               foot=dict(length_share=round(float(share_len), 3), area_share=round(float(share_area), 3), height_where_present=stats(fh[fh > 3]),
                         big_block_length=stats(big[:, 1] - big[:, 0]), big_block_height=stats(big[:, 2] - big[:, 3])))
    print(json.dumps(out, indent=1))
    # overlay (face A, s 0-62) for checking the readings
    k = 3; crop = A[:, :int(62 / RES)]
    im = Image.fromarray(crop.clip(0, 255).astype(np.uint8)).resize((crop.shape[1] * k, crop.shape[0] * k)); d = ImageDraw.Draw(im)
    px = lambda s, z: (s / RES * k, (1.5 - z) / RES * k)
    for z, s0, s1 in READ['beds']: d.line([px(s0, z), px(s1, z)], fill=(255, 255, 0), width=2)
    for zt, zb, hs in READ['heads']:
        for s in hs: d.line([px(s, zt), px(s, zb)], fill=(0, 255, 255), width=2)
    d.line([px(s, z) for s, z in READ['foot'] if s <= 62], fill=(255, 0, 255), width=2)
    im.save('shots/masonry_d232_faceA.png')


if __name__ == '__main__':
    main()
