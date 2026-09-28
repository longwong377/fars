# PARSA small creatures (D-332; BLENDER_PLAN row 20), the Blender stage: every kind of tools/blender/life_small.json modelled
# from its anatomy, headless and scripted:
#   blender -b --factory-startup --python tools/blender/life_small.py -- <job.json>
# job.json: { "reg": "tools/blender/life_small.json", "ids": [...], "out": dir, "device": "CPU"|"GPU", "threads": n }
# Per kind:
#  1. the anatomy (the builders below, the game's frame: +z forward, y up, metres, standing on y = 0; the insects centred on
#     the origin as the game hovers them): blended ellipsoids (Blender metaballs, each tagged with its part) and sheets (the
#     insects' wings, their outlines cut from a grid);
#  2. the dense source: the metaball surface at ~L/160 with each part's relief (scales, scutes and their growth rings, spines,
#     quills, fur, segments) displaced along the normal, and the colour of each point from its part and the kind's marks as
#     vertex colours; the wings at high resolution with their veins as relief and colour, the membrane cut to a stipple;
#  3. lod0: the plain surface (no relief) decimated to its target with the wing envelopes added; Smart UV Project; lod1: lod0
#     decimated again (its uvs kept);
#  4. Cycles bakes onto lod0: normal, occlusion, albedo, coverage (the wings' cut-outs); the butterfly's albedo baked three
#     times into three columns (its three species);
#  5. <id>_albedo.png (RGB, A coverage), <id>_nrm.png (RGB normal, A occlusion) and <id>.glb (lod0, lod1; COLOR_0.r = the wing
#     weight: 0 on the body, 1 at the wing tips).
import bpy, sys, os, json, math, time
import numpy as np
from mathutils import Matrix, Euler
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from life_lib import log, reset, Parts, grid_faces, orient, mesh_object, tris, triangulate, emit_mat, Baker, save_png, dilate_alpha_rgb, export_glb, g2b, activate

job = json.load(open(sys.argv[sys.argv.index('--') + 1]))
REG = json.load(open(job['reg']))
M = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], float)  # game -> Blender

def sm(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)
def hsh(*v):
    h = np.uint64(1469598103934665603) * np.ones(np.broadcast(*[np.asarray(x) for x in v]).shape, np.uint64)
    for x in v: h ^= np.asarray(x, np.int64).astype(np.uint64); h *= np.uint64(1099511628211); h ^= h >> np.uint64(29)
    return (h & np.uint64(0xFFFFFF)).astype(np.float64) / float(0xFFFFFF)
def rot_to(d):
    """a rotation whose z axis is along d (game frame)"""
    d = np.asarray(d, float); d = d / (np.linalg.norm(d) + 1e-12); a = np.array([0, 1.0, 0]) if abs(d[1]) < 0.9 else np.array([1.0, 0, 0])
    x = np.cross(a, d); x /= np.linalg.norm(x); y = np.cross(d, x); return np.stack([x, y, d], 1)

class Body:
    def __init__(s, L): s.L = L; s.els = []; s.wings = []
    def ell(s, c, a, R=None, part='body'):
        s.els.append((np.asarray(c, float), np.asarray(a, float), np.eye(3) if R is None else np.asarray(R, float), part)); return s
    def chain(s, pts, radii, part='body', flat=1.0, step=0.45):
        pts = [np.asarray(p, float) for p in pts]
        for i in range(len(pts) - 1):
            p0, p1, r0, r1 = pts[i], pts[i + 1], radii[i], radii[i + 1]; d = p1 - p0; ln = np.linalg.norm(d); n = max(1, int(math.ceil(ln / (step * min(r0, r1)))))
            for k in range(n + (1 if i == len(pts) - 2 else 0)):
                t = k / n; r = r0 + (r1 - r0) * t; s.ell(p0 + d * t, [r, r * flat, r * 1.15], rot_to(d), part)
        return s
    def wing(s, root, half, chord, sweep, outline, colour, relief, side=1, pair=0, y=0.0, up=0.0):
        """a wing sheet: u along the span (root at `root`), v along the chord; outline(u, v) -> inside; colour(u, v, top) -> rgb"""
        s.wings.append(dict(root=np.asarray(root, float), half=half, chord=chord, sweep=sweep, outline=outline, colour=colour, relief=relief, side=side, y=y, up=up))
    def wing_grid(s, w, nu, nv, sheet):
        u, v = np.meshgrid(np.linspace(0, 1, nu + 1), np.linspace(0, 1, nv + 1), indexing='ij'); ch = w['chord'](u) if callable(w['chord']) else w['chord'] * np.ones_like(u)
        x = w['side'] * (w['root'][0] + u * w['half']); z = w['root'][2] + 0.5 * ch - v * ch - w['sweep'] * u ** 1.5
        y = w['root'][1] + w['y'] + w['up'] * u + sheet * 0.0006 * s.L
        return np.stack([x, y, z], -1).reshape(-1, 3), u.reshape(-1), v.reshape(-1)

# ------------------------------------------------------------------------------------------------ the anatomies
def ins_wing_outline(tip=0.9):
    return lambda u, v: (((u - 0.0) / 1.0) ** 2 + ((v - 0.5) / 0.5) ** 2 * (0.3 + 0.7 * u) ** 2 <= 1.02) & (v >= 0.02 * (1 - u)) & (v <= 1 - 0.04 * u)
def membrane(u, v, cells=18, veins=0.08, fill=0.35):
    """a clear wing: veins (solid) in a cell network, the membrane a stipple of `fill` coverage: inside mask"""
    cu, cv = u * cells, v * cells * 0.45; fu, fv = cu % 1, cv % 1
    vein = (np.minimum(fu, 1 - fu) < veins) | (np.minimum(fv, 1 - fv) < veins * 1.4) | (v < 0.06) | (v > 0.94)
    return vein | (hsh((u * 400).astype(int), (v * 400).astype(int), 5) < fill)

def build_fly(L):
    b = Body(L); s = L / 8.0
    b.ell([0, 0, 3.0 * s], [1.1 * s, 1.0 * s, 0.8 * s], part='head')
    for x in (-0.75, 0.75): b.ell([x * s, 0.15 * s, 3.1 * s], [0.55 * s, 0.85 * s, 0.7 * s], part='eye')
    b.ell([0, 0.1 * s, 1.1 * s], [1.3 * s, 1.25 * s, 1.7 * s], part='thorax'); b.ell([0, -0.1 * s, -2.1 * s], [1.45 * s, 1.1 * s, 2.2 * s], part='abdomen')
    for side in (-1, 1):
        for k, z in enumerate((2.0, 1.1, 0.2)):
            b.chain([[side * 0.7 * s, -0.7 * s, z * s], [side * 2.0 * s, -1.2 * s, (z + 0.4 - 0.6 * k) * s], [side * 2.4 * s, -2.8 * s, (z + 0.2 - 0.9 * k) * s]], [0.16 * s, 0.13 * s, 0.1 * s], part='leg')
        b.wing([0.9 * s, 0.9 * s, 0.9 * s], 5.6 * s, 2.3 * s, 2.2 * s, ins_wing_outline(), None, None, side=side)
    return b
def col_fly(P, part, loc, L):
    c = np.tile([0.14, 0.13, 0.12], (len(P), 1)); c[part == 'eye'] = [0.45, 0.12, 0.08]; c[part == 'thorax'] = [0.3, 0.3, 0.3]
    st = (part == 'thorax') & (np.abs((P[:, 0] / L * 8) % 0.9 - 0.45) < 0.12); c[st] = [0.08, 0.08, 0.08]
    ab = part == 'abdomen'; c[ab] = [0.35, 0.3, 0.22]; c[ab & (hsh((P[:, 0] * 8000).astype(int), (P[:, 2] * 8000).astype(int), 3) > 0.5)] = [0.12, 0.11, 0.1]
    return c

def build_dragonfly(L):
    b = Body(L); s = L / 70.0
    for x in (-1, 1): b.ell([x * 2.2 * s, 0.6 * s, 29 * s], [2.6 * s, 2.8 * s, 2.6 * s], part='eye')
    b.ell([0, 0, 28 * s], [2.0 * s, 1.8 * s, 1.8 * s], part='head'); b.ell([0, 0.3 * s, 21.5 * s], [3.2 * s, 3.8 * s, 5.2 * s], part='thorax')
    b.chain([[0, 0.2 * s, 16.5 * s], [0, 0, 8 * s], [0, -0.3 * s, -20 * s], [0, -0.6 * s, -33 * s]], [2.2 * s, 1.9 * s, 1.5 * s, 1.3 * s], part='abdomen', flat=0.9)
    for side in (-1, 1):
        for k, z in enumerate((24, 22, 20)): b.chain([[side * 1.5 * s, -2.8 * s, z * s], [side * 3.5 * s, -4.5 * s, (z + 1) * s], [side * 4.5 * s, -6.5 * s, (z - 1) * s]], [0.45 * s, 0.35 * s, 0.25 * s], part='leg')
        b.wing([1.8 * s, 3.0 * s, 24.5 * s], 43 * s, (lambda u: (7.5 - 2.0 * u) * s), 1.0 * s, ins_wing_outline(), None, None, side=side, pair=0)
        b.wing([1.8 * s, 2.9 * s, 19.0 * s], 41 * s, (lambda u: (10.5 - 4.5 * u) * s), 2.0 * s, ins_wing_outline(), None, None, side=side, pair=1)
    return b
def col_dragonfly(P, part, loc, L):
    c = np.tile([0.32, 0.46, 0.6], (len(P), 1)); c[part == 'eye'] = [0.18, 0.3, 0.38]; c[part == 'thorax'] = [0.3, 0.36, 0.38]; c[part == 'leg'] = [0.06, 0.06, 0.06]
    tip = (part == 'abdomen') & (P[:, 2] < -24 / 70 * L); c[tip] = [0.07, 0.07, 0.08]; c[part == 'head'] = [0.25, 0.3, 0.3]
    seg = (part == 'abdomen') & (((P[:, 2] / L * 70) % 4.5) < 0.5); c[seg] = c[seg] * 0.45
    return c

BUTTERFLIES = ['white', 'yellow', 'lady']
def build_butterfly(L):
    b = Body(L); s = L / 20.0
    b.ell([0, 0, 8.5 * s], [1.1 * s, 1.1 * s, 1.0 * s], part='head'); b.ell([0, 0, 5 * s], [1.3 * s, 1.3 * s, 3.0 * s], part='thorax')
    b.chain([[0, 0, 2 * s], [0, -0.3 * s, -9.5 * s]], [1.1 * s, 0.6 * s], part='abdomen')
    for side in (-1, 1):
        b.chain([[side * 0.4 * s, 0.6 * s, 9.2 * s], [side * 2.5 * s, 3.0 * s, 16 * s], [side * 3.0 * s, 3.4 * s, 17 * s]], [0.18 * s, 0.14 * s, 0.4 * s], part='antenna')
        fore = lambda u, v: (((u / 1.0) ** 2 + ((v - 0.35) / 0.5) ** 2 <= 1.0) | ((u < 0.75) & (v < 0.9) & (v > 0.0))) & (v <= 1 - 0.55 * u ** 1.5) & (v >= -0.02 + 0.25 * u ** 3)
        hind = lambda u, v: ((u / 0.95) ** 2 + ((v - 0.45) / 0.55) ** 2 <= 1.0)
        b.wing([0.9 * s, 0.6 * s, 6.5 * s], 26 * s, (lambda u: 14 * s * np.ones_like(u)), -3 * s, fore, None, None, side=side, pair=0)
        b.wing([0.9 * s, 0.5 * s, -0.5 * s], 19 * s, (lambda u: 13 * s * np.ones_like(u)), 5 * s, hind, None, None, side=side, pair=1)
    return b
def butterfly_wing_colour(var, u, v, pair):
    n = len(u)
    if var == 'white':
        c = np.tile([0.93, 0.92, 0.86], (n, 1)); tip = (pair == 0) & (u > 0.72) & (v < 0.45); c[tip] = [0.12, 0.12, 0.12]
        sp = (pair == 0) & (np.hypot(u - 0.55, v - 0.55) < 0.07); c[sp] = [0.15, 0.15, 0.15]; c[(u < 0.18)] = c[(u < 0.18)] * 0.8
    elif var == 'yellow':
        c = np.tile([0.95, 0.72, 0.15], (n, 1)); edge = (u > 0.75) | ((pair == 1) & (v > 0.8)) | ((pair == 0) & (v > 0.85)); c[edge] = [0.12, 0.1, 0.08]
        sp = (pair == 0) & (np.hypot(u - 0.4, v - 0.4) < 0.06); c[sp] = [0.1, 0.08, 0.06]; c[edge & (hsh((u * 12).astype(int), (v * 8).astype(int), 2) > 0.7)] = [0.9, 0.75, 0.3]
    else:
        c = np.tile([0.85, 0.48, 0.22], (n, 1)); ap = (pair == 0) & (u > 0.6) & (v < 0.55); c[ap] = [0.08, 0.07, 0.06]
        ws = ap & (np.hypot((u - 0.8) * 1.3, v - 0.25) < 0.08); c[ws] = [0.92, 0.9, 0.85]
        mk = hsh((u * 7).astype(int), (v * 6).astype(int), pair + 3) > 0.72; c[mk & ~ap] = [0.12, 0.08, 0.05]; c[(pair == 1) & (v > 0.82)] = [0.15, 0.1, 0.07]
    c[u < 0.1] = c[u < 0.1] * 0.7 + 0.3 * np.array([0.3, 0.26, 0.22])
    return c
def col_butterfly(P, part, loc, L):
    c = np.tile([0.18, 0.16, 0.14], (len(P), 1)); c[part == 'antenna'] = [0.1, 0.1, 0.1]; return c

def build_lizard(L):
    b = Body(L); s = L / 300.0  # mm
    b.ell([0, 11 * s, 108 * s], [14 * s, 9 * s, 17 * s], part='head'); b.ell([0, 9 * s, 124 * s], [8 * s, 6 * s, 10 * s], part='head')
    b.ell([0, 10 * s, 88 * s], [12 * s, 9 * s, 12 * s], part='neck'); b.ell([0, 11 * s, 50 * s], [22 * s, 10 * s, 40 * s], part='body')
    b.chain([[0, 10 * s, 14 * s], [0, 8 * s, -30 * s], [0, 5 * s, -90 * s], [0, 3 * s, -150 * s], [0, 2 * s, -175 * s]], [11 * s, 7 * s, 4.5 * s, 2.5 * s, 1.2 * s], part='tail', flat=0.85)
    for side in (-1, 1):
        for z0, fw in ((78, 1), (22, -1)):
            sh = [side * 16 * s, 10 * s, z0 * s]; el = [side * 34 * s, 9 * s, (z0 + 6 * fw) * s]; ft = [side * 40 * s, 1.5 * s, (z0 + 16 * fw) * s]
            b.chain([sh, el, ft], [6 * s, 4 * s, 3 * s], part='leg')
            for k in range(4): b.chain([ft, [ft[0] + side * (4 + 3 * k) * s, 1 * s, ft[2] + (12 - 5 * k) * s]], [1.4 * s, 0.8 * s], part='toe')
    return b
def col_lizard(P, part, loc, L):
    s = L / 300; c = np.tile([0.42, 0.38, 0.32], (len(P), 1)); y = P[:, 1] / s; z = P[:, 2] / s
    bel = y < 6; c[bel] = [0.6, 0.56, 0.48]
    band = ((z % 26) < 9) & (y > 12) & ((part == 'body') | (part == 'tail') | (part == 'neck')); c[band] = [0.25, 0.22, 0.2]
    spot = (hsh((P[:, 0] / s / 4).astype(int), (z / 4).astype(int), 7) > 0.8) & (y > 10); c[spot] = [0.68, 0.64, 0.55]
    c[(part == 'head') & (y < 8)] = [0.5, 0.45, 0.38]; th = (part == 'head') & (y < 6) & (z < 115); c[th] = [0.3, 0.32, 0.45]
    c[part == 'toe'] = [0.35, 0.32, 0.28]
    ey = (part == 'head') & (np.abs(np.abs(P[:, 0] / s) - 11) < 3) & (np.abs(z - 116) < 3) & (y > 11); c[ey] = [0.05, 0.04, 0.03]
    return c * (0.9 + 0.2 * hsh((P[:, 0] / s / 1.5).astype(int), (z / 1.5).astype(int), (y / 1.5).astype(int)))[:, None]

def build_frog(L):
    b = Body(L); s = L / 80.0
    b.ell([0, 13 * s, 2 * s], [21 * s, 12 * s, 26 * s], part='body'); b.ell([0, 11 * s, 26 * s], [17 * s, 9 * s, 15 * s], part='head')
    for x in (-1, 1): b.ell([x * 8 * s, 18 * s, 29 * s], [4.5 * s, 4.5 * s, 5 * s], part='eye')
    for side in (-1, 1):
        b.chain([[side * 14 * s, 9 * s, -16 * s], [side * 25 * s, 7 * s, 4 * s], [side * 20 * s, 3 * s, -22 * s], [side * 28 * s, 1.5 * s, -2 * s]], [7 * s, 5 * s, 3.5 * s, 2.5 * s], part='leg')
        b.chain([[side * 13 * s, 8 * s, 18 * s], [side * 17 * s, 3 * s, 26 * s], [side * 18 * s, 1.5 * s, 33 * s]], [4 * s, 3 * s, 2 * s], part='leg')
    return b
def col_frog(P, part, loc, L):
    s = L / 80; c = np.tile([0.36, 0.44, 0.22], (len(P), 1)); y = P[:, 1] / s
    c[y < 6] = [0.78, 0.76, 0.62]; strip = (np.abs(P[:, 0] / s) < 2.2) & (y > 20); c[strip] = [0.55, 0.65, 0.3]
    gx, gz = np.floor(P[:, 0] / s / 6), np.floor(P[:, 2] / s / 6); jx, jz = hsh(gx, gz, 1) * 0.5 + 0.25, hsh(gx, gz, 2) * 0.5 + 0.25
    dd = np.hypot(P[:, 0] / s / 6 - gx - jx, P[:, 2] / s / 6 - gz - jz); sp = (dd < 0.18 + 0.12 * hsh(gx, gz, 3)) & (hsh(gx, gz, 4) > 0.45) & (y > 8); c[sp] = [0.18, 0.2, 0.1]
    c[part == 'eye'] = [0.55, 0.48, 0.25]; ey = (part == 'eye') & (y > 20); c[ey] = [0.05, 0.05, 0.04]
    return c

def build_tortoise(L, turtle=False):
    b = Body(L); s = L / 200.0; h = 30 if turtle else 52
    b.ell([0, (20 + h * 0.45) * s, 0], [72 * s, h * s, 98 * s], part='shell'); b.ell([0, 20 * s, 0], [66 * s, 14 * s, 90 * s], part='plastron')
    b.chain([[0, 22 * s, 80 * s], [0, 26 * s, 100 * s], [0, 26 * s, 112 * s]], [14 * s, 12 * s, 11 * s], part='neck'); b.ell([0, 28 * s, 118 * s], [13 * s, 11 * s, 17 * s], part='head')
    for sx, sz in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
        b.chain([[sx * 50 * s, 22 * s, sz * 58 * s], [sx * 62 * s, 8 * s, sz * 66 * s], [sx * 64 * s, 2 * s, sz * 68 * s]], [16 * s, 13 * s, 11 * s], part='leg')
    b.chain([[0, 22 * s, -90 * s], [0, 14 * s, -104 * s]], [7 * s, 3 * s], part='leg')
    return b
def scute(P, L):
    """carapace scutes: the nearest of the vertebral (5), costal (4 a side) and marginal (11 a side) centres on the dome"""
    s = L / 200; x, z = P[:, 0] / s, P[:, 2] / s
    cen = [(0, zz) for zz in (-62, -30, 0, 30, 62)] + [(sx * 40, zz) for sx in (-1, 1) for zz in (-48, -16, 16, 48)] + [(sx * 64 * math.cos(a), 92 * math.sin(a)) for sx in (-1, 1) for a in np.linspace(-1.35, 1.35, 11)]
    C = np.array(cen); d = np.hypot(x[:, None] - C[None, :, 0], z[:, None] - C[None, :, 1]); o = np.sort(d, 1)
    return np.argmin(d, 1), o[:, 1] - o[:, 0], o[:, 0]
def col_tortoise(P, part, loc, L, turtle=False):
    c = np.tile([0.62, 0.52, 0.28] if not turtle else [0.22, 0.24, 0.17], (len(P), 1)); sh = part == 'shell'
    k, edge, rc = scute(P, L); dark = (edge < 4) | (hsh(k, 2) > 0.5) & (rc < 8)
    c[sh & dark] = [0.2, 0.16, 0.1] if not turtle else [0.1, 0.1, 0.08]
    c[part == 'plastron'] = [0.6, 0.55, 0.35] if not turtle else [0.3, 0.3, 0.2]
    skin = (part == 'leg') | (part == 'neck') | (part == 'head'); c[skin] = [0.42, 0.38, 0.28] if not turtle else [0.2, 0.22, 0.16]
    if turtle: st = (part == 'neck') & (((P[:, 0] / L * 200) % 5) < 1.4); c[st] = [0.62, 0.58, 0.25]
    ey = (part == 'head') & (np.abs(np.abs(P[:, 0] / L * 200) - 9) < 3) & (P[:, 2] / L * 200 > 122); c[ey] = [0.04, 0.03, 0.03]
    return c

def build_snake(L):
    b = Body(L); s = L / 900.0; n = 14; zs = np.linspace(440, -450, n); r = [14, 11, 16, 20, 21, 21, 20, 19, 17, 14, 10, 7, 4, 1.8]
    b.ell([0, 11 * s, 445 * s], [16 * s, 9 * s, 22 * s], part='head')
    b.chain([[0, max(rr * 0.8, 2) * s, z * s] for z, rr in zip(zs, r)], [rr * s for rr in r], part='body', flat=0.8)
    return b
def col_snake(P, part, loc, L):
    s = L / 900; c = np.tile([0.55, 0.5, 0.42], (len(P), 1)); z = P[:, 2] / s; y = P[:, 1] / s
    sad = ((z % 60) < 26) & (np.abs(P[:, 0] / s) < 12) & (y > 8); c[sad] = [0.32, 0.27, 0.22]
    lat = ((z % 60) > 30) & ((z % 60) < 42) & (np.abs(P[:, 0] / s) > 12) & (y > 5); c[lat] = [0.35, 0.3, 0.25]
    c[y < 3] = [0.7, 0.66, 0.58]; c[(part == 'head') & (y > 12)] = [0.4, 0.36, 0.3]
    ey = (part == 'head') & (np.abs(np.abs(P[:, 0] / s) - 12) < 3) & (np.abs(z - 452) < 4); c[ey] = [0.06, 0.05, 0.04]
    return c * (0.9 + 0.2 * hsh((P[:, 0] / s / 5).astype(int), (z / 5).astype(int), 1))[:, None]

def build_jird(L):
    b = Body(L); s = L / 250.0
    b.ell([0, 30 * s, 20 * s], [26 * s, 25 * s, 45 * s], part='body'); b.ell([0, 34 * s, 75 * s], [18 * s, 17 * s, 22 * s], part='head'); b.ell([0, 30 * s, 94 * s], [9 * s, 9 * s, 10 * s], part='head')
    for x in (-1, 1):
        b.ell([x * 11 * s, 52 * s, 66 * s], [7 * s, 11 * s, 3 * s], R=rot_to([x * 0.3, 1, -0.3]) @ np.diag([1, 1, 1]), part='ear'); b.ell([x * 13 * s, 40 * s, 82 * s], [4.5 * s, 4.5 * s, 4.5 * s], part='eye')
        b.chain([[x * 20 * s, 22 * s, -8 * s], [x * 22 * s, 10 * s, 10 * s], [x * 20 * s, 2 * s, -5 * s], [x * 20 * s, 1.5 * s, 18 * s]], [13 * s, 7 * s, 4 * s, 3 * s], part='leg')
        b.chain([[x * 12 * s, 18 * s, 50 * s], [x * 13 * s, 3 * s, 58 * s]], [5 * s, 3 * s], part='leg')
    b.chain([[0, 22 * s, -22 * s], [0, 10 * s, -70 * s], [0, 5 * s, -125 * s], [0, 6 * s, -150 * s]], [6 * s, 4 * s, 3 * s, 5 * s], part='tail')
    return b
def col_jird(P, part, loc, L):
    s = L / 250; c = np.tile([0.66, 0.53, 0.36], (len(P), 1)); y = P[:, 1] / s
    c[(y < 20) & (part != 'tail')] = [0.9, 0.87, 0.8]; c[part == 'ear'] = [0.75, 0.6, 0.5]; c[part == 'eye'] = [0.04, 0.03, 0.03]
    tuft = (part == 'tail') & (P[:, 2] / s < -120); c[tuft] = [0.2, 0.16, 0.12]
    return c * (0.92 + 0.16 * hsh((P[:, 0] / s / 2).astype(int), (P[:, 2] / s / 2).astype(int), (y / 2).astype(int)))[:, None]

def build_hedgehog(L):
    b = Body(L); s = L / 200.0
    b.ell([0, 45 * s, -5 * s], [58 * s, 44 * s, 82 * s], part='spines'); b.ell([0, 32 * s, 55 * s], [28 * s, 25 * s, 30 * s], part='face'); b.ell([0, 26 * s, 85 * s], [9 * s, 8 * s, 14 * s], part='snout')
    b.ell([0, 25 * s, 99 * s], [4 * s, 4 * s, 3 * s], part='nose')
    for x in (-1, 1):
        b.ell([x * 20 * s, 58 * s, 50 * s], [10 * s, 15 * s, 4 * s], part='ear'); b.ell([x * 13 * s, 38 * s, 76 * s], [4 * s, 4 * s, 4 * s], part='eye')
        for z in (40, -45): b.chain([[x * 30 * s, 22 * s, z * s], [x * 34 * s, 2 * s, (z + 6) * s]], [9 * s, 6 * s], part='leg')
    return b
def col_hedgehog(P, part, loc, L):
    s = L / 200; c = np.tile([0.62, 0.56, 0.47], (len(P), 1)); sp = part == 'spines'
    Q = P - np.array([0, 45 * s, -5 * s]); th, ph = np.arctan2(Q[:, 0], Q[:, 2]), np.arctan2(Q[:, 1], np.hypot(Q[:, 0], Q[:, 2])); ci, cj = np.floor(th * 90), np.floor(ph * 90)
    rr = np.linalg.norm(Q / np.array([58, 44, 82]), axis=1); band = ((rr * 14 + 3 * hsh(ci, cj, 1)) % 3) < 1.3; c[sp & band] = [0.24, 0.2, 0.16]; c[sp & ~band] = [0.82, 0.77, 0.68]
    c[(part == 'face') | (part == 'snout')] = [0.78, 0.72, 0.62]; c[part == 'ear'] = [0.6, 0.48, 0.42]; c[part == 'nose'] = [0.08, 0.06, 0.06]; c[part == 'eye'] = [0.03, 0.02, 0.02]; c[part == 'leg'] = [0.45, 0.38, 0.32]
    c[(P[:, 1] / s < 15) & ~sp] = [0.7, 0.64, 0.55]
    return c

def build_porcupine(L):
    b = Body(L); s = L / 700.0
    b.ell([0, 150 * s, -40 * s], [150 * s, 145 * s, 250 * s], part='quills'); b.ell([0, 120 * s, 60 * s], [105 * s, 100 * s, 150 * s], part='body')
    b.ell([0, 120 * s, 220 * s], [60 * s, 58 * s, 75 * s], part='head'); b.ell([0, 105 * s, 290 * s], [30 * s, 30 * s, 26 * s], part='snout')
    b.ell([0, 230 * s, 140 * s], [30 * s, 55 * s, 90 * s], R=rot_to([0, 0.5, -1]), part='crest')
    for x in (-1, 1):
        b.ell([x * 32 * s, 140 * s, 270 * s], [9 * s, 9 * s, 9 * s], part='eye')
        for z in (150, -120): b.chain([[x * 80 * s, 60 * s, z * s], [x * 85 * s, 5 * s, (z + 15) * s]], [32 * s, 22 * s], part='leg')
    return b
def col_porcupine(P, part, loc, L):
    s = L / 700; c = np.tile([0.14, 0.12, 0.11], (len(P), 1)); q = (part == 'quills') | (part == 'crest')
    band = ((np.hypot(P[:, 0], P[:, 1] - 0.1 * L) / s + 12 * hsh((P[:, 0] / s / 6).astype(int), (P[:, 2] / s / 6).astype(int), 1)) % 34) < 14
    c[q & band] = [0.85, 0.83, 0.78]; c[q & ~band] = [0.1, 0.09, 0.08]; c[part == 'eye'] = [0.02, 0.02, 0.02]; c[part == 'snout'] = [0.2, 0.17, 0.15]
    return c

def build_scorpion(L):
    b = Body(L); s = L / 80.0
    b.ell([0, 3.2 * s, 14 * s], [6 * s, 2.6 * s, 6.5 * s], part='prosoma'); b.chain([[0, 3.4 * s, 8 * s], [0, 3.6 * s, -6 * s], [0, 3.2 * s, -12 * s]], [6.5 * s, 7 * s, 5 * s], part='meso', flat=0.45, step=0.5)
    tail = [[0, 4 * s, -13 * s], [0, 7 * s, -19 * s], [0, 12 * s, -23 * s], [0, 18 * s, -23 * s], [0, 23 * s, -19 * s], [0, 25 * s, -13 * s]]
    b.chain(tail, [2.6 * s, 2.5 * s, 2.5 * s, 2.5 * s, 2.6 * s, 2.8 * s], part='tail', step=0.6)
    b.ell([0, 24 * s, -8 * s], [2.3 * s, 2.3 * s, 3.2 * s], R=rot_to([0, -0.6, 1]), part='telson'); b.chain([[0, 22 * s, -5 * s], [0, 19 * s, -4 * s]], [1.0 * s, 0.3 * s], part='sting')
    for side in (-1, 1):
        b.chain([[side * 3 * s, 3 * s, 18 * s], [side * 10 * s, 3.5 * s, 23 * s], [side * 11 * s, 3.2 * s, 31 * s]], [1.3 * s, 1.2 * s, 1.2 * s], part='palp')
        b.ell([side * 11.5 * s, 3.2 * s, 35 * s], [2.4 * s, 1.5 * s, 4.5 * s], part='claw'); b.chain([[side * 10.5 * s, 3.2 * s, 38 * s], [side * 10 * s, 3.2 * s, 42 * s]], [0.8 * s, 0.4 * s], part='claw'); b.chain([[side * 12.8 * s, 3.2 * s, 38 * s], [side * 12 * s, 3.2 * s, 42 * s]], [0.7 * s, 0.35 * s], part='claw')
        for k, z in enumerate((13, 10, 6, 2)):
            b.chain([[side * 4.5 * s, 2.5 * s, z * s], [side * 11 * s, 6 * s, (z + 2 - 2 * k) * s], [side * 16 * s, 0.4 * s, (z + 3 - 4 * k) * s]], [0.9 * s, 0.7 * s, 0.4 * s], part='leg')
    return b
def col_scorpion(P, part, loc, L):
    c = np.tile([0.74, 0.62, 0.3], (len(P), 1)); c[part == 'meso'] = [0.62, 0.5, 0.22]; c[part == 'sting'] = [0.15, 0.1, 0.06]; c[part == 'telson'] = [0.7, 0.55, 0.25]
    seg = (part == 'meso') & (((P[:, 2] / L * 80) % 3.2) < 0.6); c[seg] = [0.45, 0.35, 0.15]
    c[(part == 'claw') & (P[:, 2] / L * 80 > 38)] = [0.4, 0.3, 0.14]
    ey = (part == 'prosoma') & (np.abs(P[:, 0]) < 0.8 / 80 * L) & (P[:, 1] > 5.2 / 80 * L); c[ey] = [0.06, 0.05, 0.04]
    return c

def build_snail(L):
    b = Body(L); s = L / 30.0
    b.chain([[0, 1.6 * s, 13 * s], [0, 1.8 * s, 2 * s], [0, 1.4 * s, -12 * s]], [2.2 * s, 3.3 * s, 1.5 * s], part='foot', flat=0.55)
    for x in (-1, 1): b.chain([[x * 0.8 * s, 3 * s, 12 * s], [x * 2.0 * s, 7 * s, 15 * s]], [0.5 * s, 0.35 * s], part='tent')
    # the shell: a log spiral of blended balls round an axis tilted to the left, the aperture over the foot
    for k in range(70):
        t = k / 69; th = t * 3.2 * 2 * math.pi; r = 7.0 * s * math.exp(-0.5 * th / (2 * math.pi) * 1.2); rr = r * 0.85
        p = np.array([r * math.cos(th) * 0.9 - 1.0 * s, 8.5 * s + 4.0 * s * t, -1.5 * s + r * math.sin(th)])
        b.ell(p, [rr, rr, rr], part='shell')
    return b
def col_snail(P, part, loc, L):
    s = L / 30; c = np.tile([0.6, 0.55, 0.45], (len(P), 1)); sh = part == 'shell'
    ang = np.arctan2(P[:, 2] + 1.5 * s, P[:, 0] + 1.0 * s); lat = (P[:, 1] / s - 8.5)
    band = (np.abs(((lat + 1.2 * np.cos(ang)) % 3.4) - 1.7) < 0.35); c[sh] = [0.86, 0.8, 0.62]; c[sh & band] = [0.3, 0.2, 0.12]
    c[part == 'tent'] = [0.4, 0.36, 0.3]
    return c

def build_crab(L):
    b = Body(L); s = L / 70.0
    b.ell([0, 9 * s, 0], [22 * s, 7.5 * s, 18 * s], part='cara'); b.ell([0, 6 * s, 1 * s], [18 * s, 4 * s, 14 * s], part='under')
    for x in (-1, 1):
        b.chain([[x * 5 * s, 11 * s, 16 * s], [x * 5.5 * s, 14 * s, 18 * s]], [1.2 * s, 1.6 * s], part='eye')
        b.chain([[x * 14 * s, 7 * s, 12 * s], [x * 22 * s, 6 * s, 22 * s], [x * 17 * s, 6 * s, 30 * s]], [3 * s, 3.5 * s, 4 * s], part='arm')
        b.ell([x * 14 * s, 6 * s, 33 * s], [5.5 * s, 4 * s, 7.5 * s], part='claw'); b.chain([[x * 12 * s, 6 * s, 38 * s], [x * 11 * s, 6 * s, 44 * s]], [2 * s, 1.2 * s], part='claw')
        for k, z in enumerate((8, 2, -4, -10)):
            b.chain([[x * 18 * s, 6 * s, z * s], [x * 30 * s, 13 * s, (z + 3 - 3 * k) * s], [x * 38 * s, 0.8 * s, (z + 2 - 5 * k) * s]], [2 * s, 1.6 * s, 0.7 * s], part='leg')
    return b
def col_crab(P, part, loc, L):
    c = np.tile([0.45, 0.38, 0.25], (len(P), 1)); c[part == 'under'] = [0.7, 0.62, 0.45]; c[part == 'claw'] = [0.55, 0.36, 0.2]; c[part == 'eye'] = [0.06, 0.05, 0.04]
    c[(part == 'claw') & (P[:, 2] / L * 70 > 39)] = [0.85, 0.6, 0.35]
    return c * (0.9 + 0.2 * hsh((P[:, 0] / L * 300).astype(int), (P[:, 2] / L * 300).astype(int), 2))[:, None]

BUILD = {'fly': (build_fly, col_fly), 'dragonfly': (build_dragonfly, col_dragonfly), 'butterfly': (build_butterfly, col_butterfly), 'lizard': (build_lizard, col_lizard),
         'frog': (build_frog, col_frog), 'tortoise': (build_tortoise, col_tortoise), 'turtle': (lambda L: build_tortoise(L, True), lambda P, p, l, L: col_tortoise(P, p, l, L, True)),
         'snake': (build_snake, col_snake), 'jird': (build_jird, col_jird), 'hedgehog': (build_hedgehog, col_hedgehog), 'porcupine': (build_porcupine, col_porcupine),
         'scorpion': (build_scorpion, col_scorpion), 'snail': (build_snail, col_snail), 'crab': (build_crab, col_crab)}
INSECT = {'fly', 'dragonfly', 'butterfly'}

# relief per part: an amplitude (x L) and a pattern of the point
def relief(kind, P, part, L):
    n = len(P); h = np.zeros(n); q = lambda k: (P / (L * k)).astype(int)
    cell = lambda k, sd: hsh(q(k)[:, 0], q(k)[:, 1], q(k)[:, 2], sd)
    def bumps(k, amp, mask): f = (P / (L * k)) % 1 - 0.5; d = np.sqrt((f ** 2).sum(1)); h[mask] += (amp * L * np.clip(0.5 - d, 0, 1) * 2)[mask]
    if kind in ('lizard', 'snake'): bumps(0.012 if kind == 'lizard' else 0.008, 0.0035, np.ones(n, bool))
    if kind == 'lizard': h += (part == 'tail') * 0.002 * L * (((P[:, 2] / L * 300) % 6) < 3)
    if kind in ('tortoise', 'turtle'):
        k, edge, rc = scute(P, L); h += (part == 'shell') * (0.004 * L * (np.sin(rc * 1.6) * 0.5 + 0.5) - 0.01 * L * np.exp(-edge / 1.2))
    if kind == 'hedgehog': h += (part == 'spines') * 0.012 * L * (cell(0.012, 1) > 0.4)
    if kind == 'porcupine': m = (part == 'quills') | (part == 'crest'); h += m * 0.02 * L * (np.sin(P[:, 0] / L * 400) * 0.5 + 0.5) * (cell(0.02, 2) > 0.3)
    if kind in ('jird', 'hedgehog', 'porcupine'): h += 0.0015 * L * (cell(0.006, 3) - 0.5)
    if kind == 'frog': bumps(0.03, 0.004, np.ones(n, bool))
    if kind in ('scorpion', 'crab', 'fly', 'dragonfly'): h += 0.002 * L * (cell(0.01, 4) - 0.5)
    if kind == 'snail': sh = part == 'shell'; ang = np.arctan2(P[:, 2], P[:, 0]); h += sh * 0.004 * L * (np.sin(ang * 60) * 0.5 + 0.5)
    return h

def metaball_mesh(b, res, name):
    K = 1.0 / b.L  # (built at unit length: Blender clamps a metaball's resolution, too coarse for a fly at its own size)
    mb = bpy.data.metaballs.new(name); o = bpy.data.objects.new(name, mb); bpy.context.scene.collection.objects.link(o)
    mb.resolution = res * K; mb.render_resolution = res * K; mb.threshold = 0.6
    for c, a, R, part in b.els:
        e = mb.elements.new(type='ELLIPSOID'); cb = M @ (c * K); e.co = tuple(cb); e.radius = 1.0; e.stiffness = 2.0
        Rb = M @ R @ M.T; e.rotation = Matrix(Rb.tolist()).to_quaternion()
        e.size_x, e.size_y, e.size_z = a[0] * K / 0.5735, a[2] * K / 0.5735, a[1] * K / 0.5735  # (blender y = game -z, blender z = game y)
    dg = bpy.context.evaluated_depsgraph_get(); me = bpy.data.meshes.new_from_object(o.evaluated_get(dg)); bpy.data.objects.remove(o, do_unlink=True); bpy.data.metaballs.remove(mb)
    V = np.empty(len(me.vertices) * 3); me.vertices.foreach_get('co', V); V = V.reshape(-1, 3); V = np.stack([V[:, 0], V[:, 2], -V[:, 1]], 1) / K  # to game, at the creature's size
    F = [list(p.vertices) for p in me.polygons]; bpy.data.meshes.remove(me); return V, F

def nearest_part(b, P):
    best = np.full(len(P), 1e9); idx = np.zeros(len(P), int)
    for i, (c, a, R, part) in enumerate(b.els):
        l = (P - c) @ R; d = (np.sqrt(((l / a) ** 2).sum(1)) - 1) * a.min()
        m = d < best; best[m] = d[m]; idx[m] = i
    return np.array([b.els[i][3] for i in idx]), idx

def vnormals(V, F):
    N = np.zeros_like(V)
    for f in F:
        p = V[f]; n = np.cross(p[1] - p[0], p[2] - p[0]) if len(f) == 3 else np.cross(p[2] - p[0], p[3] - p[1])
        N[f] += n
    return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)

def wing_high(b, w, colour, var=None):
    """a wing sheet at high resolution, both surfaces; faces outside the outline (and the clear membrane's gaps) removed"""
    out = []
    for sheet in (1, -1):
        P, u, v = b.wing_grid(w, 140, 60, sheet); ins = w['outline'](u, v)
        if colour == 'clear': keep_pt = ins & membrane(u, v); col = np.tile([0.18, 0.16, 0.14], (len(P), 1)); ps = (u > 0.82) & (u < 0.9) & (v < 0.22); col[ps] = [0.1, 0.08, 0.06]
        else: keep_pt = ins; col = colour(u, v)
        F = [f for f in grid_faces(140, 60) if keep_pt[f].all()]
        F = orient(P, F, lambda c, k, sd=sheet: np.array([0, sd, 0])); out.append((P, F, col))
    return out

dev = reset(job.get('device', 'CPU'), job.get('threads', 0)); os.makedirs(job['out'], exist_ok=True); stats = {}
for sid in job['ids']:
    t0 = time.time(); sp = REG['species'][sid]; L = sp['L']; bk = REG['bake']; build, colf = BUILD[sid]; b = build(L)
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes): bpy.data.meshes.remove(m)
    for im in list(bpy.data.images): bpy.data.images.remove(im)
    # the dense source
    Vh, Fh = metaball_mesh(b, L / 300, 'mbh'); parth, _ = nearest_part(b, Vh); Nh = vnormals(Vh, Fh)
    Vd = Vh + Nh * relief(sid, Vh, parth, L)[:, None]
    base_y = Vh[:, 1].min() if sid not in INSECT else 0.0
    ph = Parts(); ph.add(Vd, Fh, None, np.concatenate([colf(Vh, parth, None, L), np.ones((len(Vh), 1))], 1))
    variants = BUTTERFLIES if sid == 'butterfly' else [None]
    whigh = {}
    for var in variants:
        whigh[var] = []
        for w in b.wings:
            pair = np.full(141 * 61, 0 if w['root'][2] > 0 or sid != 'butterfly' else 1)
            if sid == 'butterfly':
                pr = 0 if w['root'][2] > 3 / 20 * L else 1; colour = (lambda u, v, pr=pr, var=var: butterfly_wing_colour(var, u, v, np.full(len(u), pr)))
            else: colour = 'clear'
            whigh[var] += wing_high(b, w, colour)
    # the plain surface for the levels
    Vl, Fl = metaball_mesh(b, L / 60, 'mbl')
    pl = Parts(); pl.add(Vl, Fl, None, np.tile([0, 0, 0, 1.0], (len(Vl), 1)))
    for w in b.wings:
        for sheet in (1, -1):
            P, u, v = b.wing_grid(w, 6, 3, sheet); Fw = orient(P, grid_faces(6, 3), lambda c, k, sd=sheet: np.array([0, sd, 0]))
            C = np.zeros((len(P), 4)); C[:, 0] = u; C[:, 1] = 1; C[:, 3] = 1; pl.add(P, Fw, None, C)
    V, F, _, C = pl.arrays()
    if base_y: V = V - [0, base_y, 0]; Vd = Vd - [0, base_y, 0]
    lod0 = mesh_object('lod0', V, F, None, C); nb = len(Vl)
    # decimate only the body (the wing envelopes keep their grids): a vertex group of the body
    activate(lod0); vg = lod0.vertex_groups.new(name='body'); vg.add(list(range(nb)), 1.0, 'REPLACE')
    triangulate(lod0); nt = tris(lod0); wt = sum(1 for f in F[len(Fl):]) * 2
    if nt > sp['tris'][0]:
        m = lod0.modifiers.new('dec', 'DECIMATE'); m.decimate_type = 'COLLAPSE'; m.ratio = max(0.01, (sp['tris'][0] - wt) / max(1, nt - wt)); m.vertex_group = 'body'; m.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=m.name)
    activate(lod0); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.006, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.pack_islands(udim_source='CLOSEST_UDIM', rotate=True, margin=0.006); bpy.ops.object.mode_set(mode='OBJECT')
    nvar = sp.get('variants', 1)
    if nvar > 1:
        uvl = lod0.data.uv_layers.active.data; a = np.empty(len(uvl) * 2); uvl.foreach_get('uv', a); a = a.reshape(-1, 2); a[:, 0] /= nvar; uvl.foreach_set('uv', a.ravel())
    for p in lod0.data.polygons: p.use_smooth = True
    tex = sp['tex']; n, mm = (tex, tex) if isinstance(tex, int) else tex
    # bakes
    Vh2, Fh2, _, Ch2 = ph.arrays(); res = {}
    def make_high(var):
        pa = Parts(); Vq = Vh2 - ([0, base_y, 0] if base_y else 0); pa.add(Vq, Fh2, None, Ch2)
        for (P, Fw, col) in whigh[var]: pa.add(P - ([0, base_y, 0] if base_y else 0), Fw, None, np.concatenate([col, np.ones((len(P), 1))], 1))
        Vv, Ff, _, Cc = pa.arrays(); return mesh_object('high', Vv, Ff, None, Cc)
    high = make_high(variants[0])
    bkr = Baker(high, lod0, n, mm, cage=bk['cage_per_len'] * L, ray=bk['ray_per_len'] * L, ao_dist=bk['ao_per_len'] * L, margin=bk['margin'])
    nrm = bkr.bake('NORMAL', bk['normal_samples']); ao = bkr.bake('AO', bk['ao_samples'])
    col = bkr.bake('EMIT', bk['emit_samples'], mat=emit_mat('col')); cov = bkr.bake('EMIT', 1, mat=emit_mat('cov', const=(1, 1, 1)), margin=0)
    if nvar > 1:
        uvl = lod0.data.uv_layers.active.data; a0 = np.empty(len(uvl) * 2); uvl.foreach_get('uv', a0)
        cols = [col]
        for k in range(1, nvar):
            bpy.data.objects.remove(high, do_unlink=True); high = make_high(variants[k]); bkr.high = high
            a = a0.reshape(-1, 2).copy(); a[:, 0] += k / nvar; uvl.foreach_set('uv', a.ravel())
            cols.append(bkr.bake('EMIT', bk['emit_samples'], mat=emit_mat('col')))
        uvl.foreach_set('uv', a0)
        W = n // nvar; img = lambda x: x.reshape(mm, n, 4)
        comb = img(col).copy(); nr, aa, cv = img(nrm), img(ao), img(cov)
        for k in range(1, nvar): comb[:, k * W:(k + 1) * W] = img(cols[k])[:, k * W:(k + 1) * W]; nr[:, k * W:(k + 1) * W] = nr[:, :W]; aa[:, k * W:(k + 1) * W] = aa[:, :W]; cv[:, k * W:(k + 1) * W] = cv[:, :W]
        col, nrm, ao, cov = comb.reshape(-1, 4), nr.reshape(-1, 4), aa.reshape(-1, 4), cv.reshape(-1, 4)
    alpha = (cov[:, 0] > 0.5).astype(np.float64); rgb = dilate_alpha_rgb(np.clip(col[:, :3], 0, 1), alpha, n, mm)
    save_png(os.path.join(job['out'], f'{sid}_albedo.png'), np.concatenate([rgb, alpha[:, None]], 1), n, mm)
    pk = nrm.copy(); pk[:, 3] = ao[:, 0]; qn = save_png(os.path.join(job['out'], f'{sid}_nrm.png'), pk, n, mm)
    bpy.data.objects.remove(high, do_unlink=True)
    activate(lod0); bpy.ops.object.duplicate(); lod1 = bpy.context.active_object; lod1.name = 'lod1'; lod1.data.name = 'lod1'
    nt1 = tris(lod1)
    if nt1 > sp['tris'][1]:
        m = lod1.modifiers.new('dec', 'DECIMATE'); m.decimate_type = 'COLLAPSE'; m.ratio = sp['tris'][1] / nt1; m.use_collapse_triangulate = True; bpy.ops.object.modifier_apply(modifier=m.name)
    lod0.vertex_groups.clear(); lod1.vertex_groups.clear()
    export_glb(os.path.join(job['out'], f'{sid}.glb'), [lod0, lod1])
    bb = np.array([list(v.co) for v in lod0.data.vertices]); bbg = np.stack([bb[:, 0], bb[:, 2], -bb[:, 1]], 1)
    stats[sid] = {'tris': {'lod0': tris(lod0), 'lod1': tris(lod1)}, 'tex': tex, 'L': L, 'variants': nvar, 'cover': float(alpha.mean()), 'ao_mean': float(qn[:, 3].mean() / 255),
                  'high_tris': len(Fh2), 'seconds': round(time.time() - t0, 1), 'device': dev, 'bbox': [bbg.min(0).tolist(), bbg.max(0).tolist()], 'half': float(max((w['root'][0] + w['half']) for w in b.wings)) if b.wings else 0.0}
    log(sid, json.dumps(stats[sid]))
json.dump(stats, open(os.path.join(job['out'], 'stats_' + job['ids'][0] + f'_{len(job["ids"])}.json'), 'w'), indent=1)
log('done', len(stats))
