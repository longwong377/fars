# s18 C14 (D-790): the scanned face's relief on the people's heads. The Lee Perry-Smith head scan (Infinite-Realities, CC BY
# 3.0; assets-raw/faces/skin/scan_lee_perry_smith on branch s18-face-assets) carries a tangent-space normal map of the real
# skin's relief (the lids' creases, the nasolabial and mentolabial folds, the lip lines, the ears' rims, the pores at its
# resolution) on its own UVs. This script
#   1. integrates that normal map into a height map in the scan's UV space (Frankot-Chellappa, in metres: the texel's size
#      on the fitted surface), high-passed so only the relief remains (the broad shape is the mesh's own);
#   2. fits the scan to the reference head (a similarity transform from five landmarks: the eyes' centres and the mouth's
#      corners read off the scan's albedo, the nose tip from its geometry) and
#   3. casts from every texel of the reference head's UV (MakeHuman's, the UV every body keeps) along its normal onto the
#      fitted scan and samples the height there.
# Writes <out.png> (1024^2 grey + alpha: R = 0.5 + h / (2 RANGE), A = coverage) for tools/humans/skin.ts, and a preview.
# Run: $HOME/bpy/bin/python tools/blender/face_scan.py <scan dir> <head.json> <out.png>   (head.json: tools/humans/face_scan_src.ts)
import bpy, sys, json, math
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

SCAN, HEAD, OUT = sys.argv[-3:]
N = 1024
RANGE = 0.0006  # m: the stored height's half range (skin.ts DETAIL_SCALE.crease is 0.45 mm; the scan's deepest folds clip)
HP_SIGMA_M = 0.006  # m: the high-pass (relief finer than ~1 cm kept; the broad shape is the mesh's)
# the scan's landmarks in its albedo's pixels (x right, y down): read off Map-COL.jpg (the eyes' centres between the lids'
# corners, the mouth's corners)
LM_PX = {'eye_a': (440, 307), 'eye_b': (583, 307), 'mouth_a': (457, 477), 'mouth_b': (570, 477)}

def log(*a): print('[face_scan]', *a, flush=True)

# ---------------------------------------------------------------- the scan
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SCAN + '/LeePerrySmith.glb')
ob = next(o for o in bpy.data.objects if o.type == 'MESH'); me = ob.data
me.calc_loop_triangles()
Vb = np.array([ob.matrix_world @ v.co for v in me.vertices])
V = Vb  # (as imported; the landmark fit finds the rotation into ours)
uvl = me.uv_layers.active.data
LT = np.array([lt.vertices[:] for lt in me.loop_triangles]); LL = np.array([lt.loops[:] for lt in me.loop_triangles])
UV = np.array([uvl[i].uv[:] for i in range(len(uvl))])  # per loop (u, v up)
TU = UV[LL]  # (T, 3, 2)
log('scan', len(V), 'verts', len(LT), 'tris')

def raster(tri_uv, n, flip=False):
    """per texel (row y down, col x) the triangle index and barycentrics: -1 outside"""
    tid = -np.ones((n, n), np.int32); bc = np.zeros((n, n, 3), np.float32)
    P = tri_uv * n
    if flip: P[:, :, 1] = n - P[:, :, 1]  # (the people's atlas: rows run with 1 - v, tools/humans/skin.ts)
    # pixel coords: the image's rows run with v here (the scan's import: measured, its nose at v 0.387, row 396)
    for t in range(len(P)):
        a, b, c = P[t]; x0, x1 = int(max(0, math.floor(min(a[0], b[0], c[0])))), int(min(n - 1, math.ceil(max(a[0], b[0], c[0]))))
        y0, y1 = int(max(0, math.floor(min(a[1], b[1], c[1])))), int(min(n - 1, math.ceil(max(a[1], b[1], c[1]))))
        if x1 < x0 or y1 < y0: continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        d = (b[1] - c[1]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[1] - c[1])
        if abs(d) < 1e-12: continue
        l0 = ((b[1] - c[1]) * (xs - c[0]) + (c[0] - b[0]) * (ys - c[1])) / d; l1 = ((c[1] - a[1]) * (xs - c[0]) + (a[0] - c[0]) * (ys - c[1])) / d; l2 = 1 - l0 - l1
        m = (l0 >= -1e-4) & (l1 >= -1e-4) & (l2 >= -1e-4)
        if not m.any(): continue
        yy, xx = np.nonzero(m); yy += y0; xx += x0
        tid[yy, xx] = t; bc[yy, xx] = np.stack([l0[m], l1[m], l2[m]], 1)
    return tid, bc

def at_px(tid, bc, tris, X, px):
    x, y = px; t = tid[y, x]
    if t < 0: raise SystemExit('landmark off the scan: %s' % (px,))
    return (X[tris[t]] * bc[y, x][:, None]).sum(0)

stid, sbc = raster(TU, N)
log('scan UV raster: %.1f%% covered' % (100 * (stid >= 0).mean()))
L = {k: at_px(stid, sbc, LT, V, p) for k, p in LM_PX.items()}
# the face's direction: from the scan's centroid out through its eyes and mouth; the nose tip is the vertex farthest along it
fc = (L['eye_a'] + L['eye_b'] + L['mouth_a'] + L['mouth_b']) / 4; fdir = fc - V.mean(0); fdir /= np.linalg.norm(fdir)
near = np.linalg.norm(V - fc, axis=1) < 1.0 * np.linalg.norm(L['eye_a'] - L['eye_b'])
nose = V[np.argmax(np.where(near, V @ fdir, -1e9))]
# which landmark is the head's left (+x in ours): the left eye is on the left of the face looking out (up x face)
up = (L['eye_a'] + L['eye_b']) / 2 - (L['mouth_a'] + L['mouth_b']) / 2; left = np.cross(up, fdir)
eyes = sorted([L['eye_a'], L['eye_b']], key=lambda p: -(p @ left)); mouth = sorted([L['mouth_a'], L['mouth_b']], key=lambda p: -(p @ left))
log('scan lm', {k: np.round(v, 3).tolist() for k, v in L.items()}, 'nose', np.round(nose, 3).tolist())
# the chin: the scan's midline vertex farthest out along the face below the mouth by as much as the nose is above it
mz = (mouth[0] + mouth[1]) / 2; down = -up / np.linalg.norm(up); mid = np.abs((V - fc) @ (left / np.linalg.norm(left))) < 0.06 * np.linalg.norm(L['eye_a'] - L['eye_b'])
below = mid & ((V - mz) @ down > 0.25 * np.linalg.norm(up)) & ((V - mz) @ down < 1.2 * np.linalg.norm(up))
chin = V[np.argmax(np.where(below & ((V - mz) @ fdir > -0.5 * np.linalg.norm(up)), (V - mz) @ (down + 0.5 * fdir), -1e9))]  # (the menton: down and still in front)
src = np.array([eyes[0], eyes[1], mouth[0], mouth[1], nose, chin])
H = json.load(open(HEAD)); lm = H['lm']
dst = np.array([lm['eye_l'], lm['eye_r'], lm['mouth_l'], lm['mouth_r'], lm['nose'], lm['chin']])
# an affine fit (the faces' proportions differ: the reference's eyes are set closer and its lower face is longer than the
# scan's; a similarity left 13 mm at the eyes): least squares over the six landmarks
X = np.hstack([src, np.ones((len(src), 1))]); M, *_ = np.linalg.lstsq(X, dst, rcond=None)
res = np.linalg.norm(X @ M - dst, axis=1)
log('chin', np.round(chin, 3).tolist(), 'mapped', np.round(X @ M, 4).tolist(), 'dst', np.round(dst, 4).tolist())
log('affine fit: residuals (mm) eyes %.1f %.1f mouth %.1f %.1f nose %.1f chin %.1f' % tuple(res * 1000))
# then a thin-plate warp (3-D biharmonic kernel r) carries the six landmarks onto the reference's exactly, bending smoothly
# between them (the mouth's corners 7 mm apart from the affine's)
C = X @ M; Rr = dst - C; K = np.linalg.norm(C[:, None] - C[None], axis=2); Pm = np.hstack([np.ones((len(C), 1)), C])
Asys = np.zeros((len(C) + 4, len(C) + 4)); Asys[:len(C), :len(C)] = K; Asys[:len(C), len(C):] = Pm; Asys[len(C):, :len(C)] = Pm.T
WA = np.linalg.solve(Asys, np.vstack([Rr, np.zeros((4, 3))])); Wt, At = WA[:len(C)], WA[len(C):]
def warp(Q):
    Q = np.hstack([Q, np.ones((len(Q), 1))]) @ M
    return Q + np.linalg.norm(Q[:, None] - C[None], axis=2) @ Wt + np.hstack([np.ones((len(Q), 1)), Q]) @ At
VF = warp(V)  # the scan in the reference head's space
log('warped landmarks off by (mm):', np.round(np.linalg.norm(warp(src) - dst, axis=1) * 1000, 2).tolist())

# ---------------------------------------------------------------- the scan's normal map -> height (m) in its UV
def load_img(path):
    im = bpy.data.images.load(path); im.colorspace_settings.name = 'Non-Color'; w, h = im.size
    a = np.array(im.pixels[:], np.float64).reshape(h, w, 4)[::-1]  # rows top-down
    if (w, h) != (N, N): raise SystemExit('expected %dx%d: %s' % (N, N, path))
    return a
def save_img(path, rgba):
    h, w = rgba.shape[:2]; im = bpy.data.images.new('out', w, h, alpha=True); im.colorspace_settings.name = 'Non-Color'
    im.pixels[:] = (rgba[::-1].astype(np.float64) / 255).ravel().tolist(); im.filepath_raw = path; im.file_format = 'PNG'; im.save()
nm = load_img(SCAN + '/Infinite-Level_02_Tangent_SmoothUV.jpg')[:, :, :3] * 2 - 1
nz = np.clip(nm[:, :, 2], 0.2, 1)
# the texel's size (m) along u and v: |dP/du| / N, |dP/dv| / N per triangle of the fitted scan
P0, P1, P2 = VF[LT[:, 0]], VF[LT[:, 1]], VF[LT[:, 2]]; d1, d2 = P1 - P0, P2 - P0
u1, v1 = TU[:, 1, 0] - TU[:, 0, 0], TU[:, 1, 1] - TU[:, 0, 1]; u2, v2 = TU[:, 2, 0] - TU[:, 0, 0], TU[:, 2, 1] - TU[:, 0, 1]
den = u1 * v2 - u2 * v1; den[np.abs(den) < 1e-12] = 1e-12
dPdu = (d1 * v2[:, None] - d2 * v1[:, None]) / den[:, None]; dPdv = (d2 * u1[:, None] - d1 * u2[:, None]) / den[:, None]
su = np.where(stid >= 0, np.linalg.norm(dPdu, axis=1)[np.maximum(stid, 0)] / N, 0); sv = np.where(stid >= 0, np.linalg.norm(dPdv, axis=1)[np.maximum(stid, 0)] / N, 0)
mpx = np.median(su[stid >= 0]); log('scan texel: %.2f mm' % (mpx * 1000))
inside = stid >= 0
def integrate(sign_g):
    gx = np.where(inside, -nm[:, :, 0] / nz * su, 0)           # dh per texel to the right (+u)
    gy = np.where(inside, sign_g * nm[:, :, 1] / nz * sv, 0)   # dh per texel downward (-v): sign by the map's convention
    wx = np.fft.fftfreq(N) * 2 * np.pi; WX, WY = np.meshgrid(wx, wx)
    D = WX ** 2 + WY ** 2; D[0, 0] = 1
    Hf = (-1j * WX * np.fft.fft2(gx) - 1j * WY * np.fft.fft2(gy)) / D; Hf[0, 0] = 0
    h = np.real(np.fft.ifft2(Hf))
    curl = np.abs(np.diff(gx, axis=0)[:, :-1] - np.diff(gy, axis=1)[:-1, :])[inside[:-1, :-1]].mean()
    return h, curl
(hA, cA), (hB, cB) = integrate(1.0), integrate(-1.0)
h = hA if cA < cB else hB
log('normal map green: %s (curl %.3g vs %.3g)' % ('+ down' if cA < cB else '- down', min(cA, cB), max(cA, cB)))
# high-pass: minus a Gaussian blur of HP_SIGMA_M (in texels at the median texel size), normalised by the mask's blur
def blur(a, sig):
    k = np.fft.fftfreq(N); KX, KY = np.meshgrid(k, k); G = np.exp(-2 * (np.pi * sig) ** 2 * (KX ** 2 + KY ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * G))
sig = HP_SIGMA_M / mpx; m = inside.astype(np.float64)
hp = np.where(inside, h - blur(h * m, sig) / np.maximum(blur(m, sig), 1e-3), 0)
log('scan relief: sd %.3f mm, p1 %.3f p99 %.3f mm' % (hp[inside].std() * 1000, np.percentile(hp[inside], 1) * 1000, np.percentile(hp[inside], 99) * 1000))

def sample(img, u, v):
    x = np.clip(u * N - 0.5, 0, N - 1.001); y = np.clip(v * N - 0.5, 0, N - 1.001)
    x0, y0 = int(x), int(y); fx, fy = x - x0, y - y0
    return img[y0, x0] * (1 - fx) * (1 - fy) + img[y0, x0 + 1] * fx * (1 - fy) + img[y0 + 1, x0] * (1 - fx) * fy + img[y0 + 1, x0 + 1] * fx * fy

# ---------------------------------------------------------------- the reference head's UV, cast onto the fitted scan
HP = np.array(H['pos']).reshape(-1, 3); HN = np.array(H['nrm']).reshape(-1, 3); HU = np.array(H['uv']).reshape(-1, 2); HT = np.array(H['tris']).reshape(-1, 3)
htid, hbc = raster(HU[HT], N, flip=True)
log('head UV raster: %d texels' % (htid >= 0).sum())
bvh = BVHTree.FromPolygons([Vector(p) for p in VF], LT.tolist(), all_triangles=True)
out_h = np.zeros((N, N)); cov = np.zeros((N, N))
ys, xs = np.nonzero(htid >= 0)
miss = 0
for y, x in zip(ys, xs):
    tri = HT[htid[y, x]]; b = hbc[y, x]
    p = (HP[tri] * b[:, None]).sum(0); n = (HN[tri] * b[:, None]).sum(0); n /= np.linalg.norm(n) + 1e-12
    best = None
    for d in (n, -n):
        loc, fn, idx, dist = bvh.ray_cast(Vector(p - d * 0.0), Vector(d), 0.015)
        if loc is not None and (best is None or dist < best[3]): best = (loc, fn, idx, dist)
    if best is None: miss += 1; continue
    loc, fn, idx, dist = best
    q = np.array(loc); a, b2, c = VF[LT[idx]]
    # barycentrics of the hit in the scan triangle -> its UV
    v0, v1_, v2_ = b2 - a, c - a, q - a; d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1_, v1_ @ v1_, v2_ @ v0, v2_ @ v1_
    dn = d00 * d11 - d01 * d01 or 1e-18; w1 = (d11 * d20 - d01 * d21) / dn; w2 = (d00 * d21 - d01 * d20) / dn; w0 = 1 - w1 - w2
    uv = TU[idx, 0] * w0 + TU[idx, 1] * w1 + TU[idx, 2] * w2
    # facing: the scan's surface turned more than 60 deg from ours, or a hit 1 cm off, fades out
    fac = abs(float(np.dot(np.array(fn), n))); k = min(1, max(0, (fac - 0.5) / 0.3)) * min(1, max(0, (0.015 - dist) / 0.005))
    out_h[y, x] = sample(hp, uv[0], uv[1]); cov[y, x] = k
log('cast: %d texels hit, %d missed' % (len(ys) - miss, miss))
R8 = np.clip(np.round(255 * (0.5 + out_h / (2 * RANGE))), 0, 255).astype(np.uint8); A8 = np.round(255 * cov).astype(np.uint8)
save_img(OUT, np.stack([R8, R8, R8, A8], 2))
P8 = (np.clip(0.5 + hp / (2 * RANGE), 0, 1) * 255).astype(np.uint8); save_img(OUT.replace('.png', '_scanuv.png'), np.stack([P8, P8, P8, np.full_like(P8, 255)], 2))
log('wrote', OUT, 'relief on the head: sd %.3f mm' % (out_h[cov > 0.5].std() * 1000))
