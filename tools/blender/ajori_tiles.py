# PARSA (D-329): the Tol-e Ajori gate's surface tiles, carved as height fields in numpy and baked in Cycles (mon_lib).
# Imported by tools/blender/ajori.py. Units metres. Every tile is one brick module wide and tall so the courses of the plain
# brick facing, the glazed field and the figures line up on the wall:
#   brick 0.330 x 0.330 x 0.080 m laid with ~15 mm joints (the Babylonian square brick; AJORI-BRICK2018 B: baked Ca-rich clay,
#   oxidising kiln 850-900 C -> buff-yellow to pinkish body; the size C by the Babylonian analogy the excavators draw):
#   course 0.095 m, brick pitch 0.345 m, half-brick bond; a tile = 6 bricks x 12 courses = 2.070 x 1.140 m.
# The glazed bricks (AMADORI2023, B): lime-alkali glazes 1.2-2.8 mm thick on a calcareous body; blue (Co, Cu) for the ground and
# the bulls' details, white (Ca and Na antimonate) and orange-yellow (lead antimonate + haematite) for the figures, greenish
# (Cu-Pb-Sb-Fe) for the mušḫuššu's curl and the bull's hoof; the colour fields divided by an outline SUNK into the glaze (not
# raised as at Susa and Persepolis); white-petalled rosettes; figures in low relief (bull to the right, mušḫuššu to the left in
# the excavators' reconstruction on the Babylonian panel). C: relief depth (28 mm), the drawing (from the Babylonian type, not
# traced), the glaze hues' exact values, the joints of the glazed courses (6 mm), the weathering of a 50-70-year-old face.
import math
import numpy as np
import mon_lib as ml

TW, TH = 2.070, 1.140          # tile (m)
PITCH, COURSE = 0.345, 0.095   # brick pitch and course (m)
W, H = 1024, 564               # texels (2.02 mm)
RW, RH = 1024, 188             # rosette band: 4 courses (0.380 m)
PX = TW / W

def coords(Hh, Ww, th):
    """texel centres: X along the tile (m), Z up (m); rows top-down"""
    X = (np.arange(Ww) + 0.5) * TW / Ww
    Z = th - (np.arange(Hh) + 0.5) * th / Hh
    return np.meshgrid(X, Z)

def bricks(rng, Hh, Ww, th, joint, arris, glazed):
    """the coursed bricks of a tile: height (m), brick id, distance into the brick face (m), per-brick random table"""
    X, Z = coords(Hh, Ww, th)
    nc = int(round(th / COURSE)); c = np.clip(np.floor(Z / COURSE).astype(int), 0, nc - 1)
    off = (c % 2) * PITCH / 2
    xs = np.mod(X - off, TW); b = np.floor(xs / PITCH).astype(int) % 6
    lx, lz = xs - b * PITCH, Z - c * COURSE
    nb = nc * 6; R = rng.random((nb, 12)); bid = c * 6 + b
    j1 = joint / 2 + (R[bid, 0] - 0.5) * 0.004; j2 = joint / 2 + (R[bid, 1] - 0.5) * 0.004
    k1 = joint / 2 + (R[bid, 2] - 0.5) * 0.003; k2 = joint / 2 + (R[bid, 3] - 0.5) * 0.003
    ea = 0.35 if glazed else 1.0  # glazed bricks: moulded and glazed, cleaner arrises
    en = (ml.noise2(rng, Hh, Ww, 2, 12) * 0.0012 + ml.noise2(rng, Hh, Ww, 12, 60) * 0.0015) * ea  # irregular arrises
    d = np.minimum.reduce([lx - j1, PITCH - j2 - lx, lz - k1, COURSE - k2 - lz]) + en
    # the face: bow and tilt (moulded, dried and fired: never flat), pitting and grit
    u, v = lx / PITCH - 0.5, lz / COURSE - 0.5
    face = (R[bid, 4] - 0.5) * 0.0024 * u + (R[bid, 5] - 0.5) * 0.0016 * v + (R[bid, 6] - 0.5) * 0.0018 * (1 - 4 * u * u)
    if glazed:
        grain = ml.noise2(rng, Hh, Ww, 1.5, 20, 1.2) * 0.00015
        edge = -0.0022 * (1 - ml.smoothstep(0, arris, d)) ** 1.5  # the glaze runs round the arris and pools
    else:
        grain = ml.noise2(rng, Hh, Ww, 1.2, 8, 0.8) * 0.00035 + ml.noise2(rng, Hh, Ww, 8, 80) * 0.0005
        pits = np.clip(ml.noise2(rng, Hh, Ww, 1.0, 3.0, 0.2) - 2.2, 0, None) * 0.0012
        grain = grain - pits
        edge = -0.0035 * (1 - ml.smoothstep(0, arris, d)) ** 1.3
    hb = face + grain + edge
    # mortar: recessed, rough, some joints fuller than others
    full = ml.noise2(rng, Hh, Ww, 30, 300) * 0.5
    hm = -(0.0065 if not glazed else 0.0035) + full * 0.0015 + ml.noise2(rng, Hh, Ww, 1.2, 10, 0.6) * 0.0006
    w = np.clip(d / PX + 0.5, 0, 1)
    h = hb * w + hm * (1 - w)
    return dict(h=h, hb=hb, hm=hm, w=w, d=d, bid=bid, R=R, X=X, Z=Z, lx=lx, lz=lz, c=c)

def chips(rng, B, count, rmin, rmax, depth):
    """conical chips knocked off the arrises (handling, frost): lowers B['h'] inside the bricks; returns the chip mask"""
    Hh, Ww = B['h'].shape; mask = np.zeros_like(B['h'])
    for _ in range(count):
        cy, cx = rng.integers(0, Hh), rng.integers(0, Ww)
        # walk to the nearest arris: pick a texel near a joint
        for _t in range(20):
            if 0 < B['d'][cy, cx] < 0.006: break
            cy, cx = rng.integers(0, Hh), rng.integers(0, Ww)
        r = rng.uniform(rmin, rmax) / PX; D = rng.uniform(*depth); rr = int(r) + 2
        ys, xs = np.arange(cy - rr, cy + rr + 1) % Hh, np.arange(cx - rr, cx + rr + 1) % Ww
        yy, xx = np.meshgrid(np.arange(-rr, rr + 1), np.arange(-rr, rr + 1), indexing='ij')
        dist = np.hypot(yy, xx * rng.uniform(0.7, 1.4)) / r
        cut = np.clip(1 - dist, 0, 1) ** 0.6 * D
        sub = np.ix_(ys, xs); inb = B['w'][sub] > 0.5
        B['h'][sub] = np.where(inb, np.minimum(B['h'][sub], B['hb'][sub] - cut + 0.0), B['h'][sub])
        mask[sub] = np.maximum(mask[sub], (cut > 0.0003) * inb)
    return mask

# ---------------------------------------------------------------- the plain brick facing
def brick_tile(rng):
    B = bricks(rng, H, W, TH, 0.015, 0.006, False)
    ch = chips(rng, B, 55, 0.006, 0.028, (0.002, 0.008))
    # a few spalled faces (salt and frost at the foot of a 50-70-year-old wall: C)
    R, bid = B['R'], B['bid']; sp = (R[bid, 7] < 0.05) & (ml.noise2(rng, H, W, 10, 60) > -0.2) & (B['d'] > 0.01)
    B['h'] = np.where(sp, B['h'] - 0.004 + ml.noise2(rng, H, W, 1.5, 12) * 0.0008, B['h'])
    # the body's firing colour per brick (linear multipliers about 1: the surface keeps its measured mean tint)
    tones = np.array([[1.00, 1.00, 1.00], [1.07, 0.97, 0.92], [1.04, 1.03, 0.90], [0.90, 0.95, 0.92], [0.86, 0.84, 0.82], [1.10, 1.06, 1.00]])
    pick = np.minimum((R[:, 8] ** 1.6 * len(tones)).astype(int), len(tones) - 1)
    lum = 0.9 + 0.2 * R[:, 9]
    col = tones[pick][bid] * lum[bid][..., None]
    col = col * (1 + 0.05 * ml.noise2(rng, H, W, 3, 40)[..., None])            # mottling of the fired body
    col = np.where(sp[..., None], col * np.array([1.08, 1.05, 1.0]), col)       # fresh spalls paler
    col = np.where(ch[..., None] > 0, col * 1.06, col)
    mortar = np.array([1.12, 1.10, 1.06]) * (1 + 0.06 * ml.noise2(rng, H, W, 2, 30))[..., None]
    col = col * B['w'][..., None] + mortar * (1 - B['w'][..., None])
    rough = 0.82 * B['w'] + 0.95 * (1 - B['w'])
    return B['h'] - np.median(B['h']), col, rough

# ---------------------------------------------------------------- figures (canvas units: 512 x 256, facing +x, y down)
def bull_paths():
    # the aurochs of the Babylonian type (C drawing): massive forequarters, lowered head, horn curving forward, dewlap,
    # jointed legs (knee, hock), tufted tail; canvas 512 x 256, facing +x, ground line y 228
    P = ml.Path().M(135, 92).C(170, 78, 250, 82, 300, 76).C(325, 72, 345, 62, 365, 64).C(385, 66, 400, 74, 412, 84)         .C(424, 92, 436, 98, 446, 104).C(456, 112, 464, 126, 462, 138).C(460, 146, 450, 148, 442, 144).C(432, 140, 420, 140, 410, 146)         .C(398, 156, 386, 164, 372, 168).C(362, 172, 356, 178, 352, 184)         .L(356, 200).C(357, 208, 354, 214, 356, 220).L(358, 228).L(342, 228).L(343, 220).C(342, 212, 340, 204, 339, 196).L(336, 186)         .L(333, 194).L(332, 208).L(331, 228).L(316, 228).L(318, 212).L(318, 196).C(316, 186, 310, 180, 300, 178)         .C(270, 184, 230, 184, 205, 178).C(200, 186, 198, 196, 196, 204).L(194, 214).L(196, 228).L(181, 228).L(181, 214)         .C(180, 204, 174, 196, 170, 190).L(168, 202).L(166, 214).L(168, 228).L(153, 228).L(153, 214).C(152, 200, 146, 190, 142, 180)         .C(134, 166, 128, 146, 128, 128).C(128, 112, 130, 100, 135, 92)
    tail = ml.Path().M(132, 96).C(118, 110, 112, 140, 114, 176).L(120, 176).C(120, 142, 126, 112, 138, 100)
    tuft = ml.Path().M(110, 172).C(104, 182, 106, 196, 116, 198).C(126, 196, 128, 182, 122, 172)
    horn = ml.Path().M(420, 88).C(424, 66, 438, 50, 458, 44).C(446, 56, 436, 70, 432, 92)
    ear = ml.Path().M(412, 90).C(400, 80, 388, 80, 382, 84).C(392, 92, 402, 96, 410, 98)
    hooves = [ml.Path().M(x0, 220).L(x1, 220).L(x1 + 1, 228).L(x0 - 1, 228) for x0, x1 in ((342, 358), (316, 331), (181, 196), (153, 168))]
    return dict(body=P.polys + tail.polys, tuft=tuft.polys, horn=horn.polys, ear=ear.polys, hoof=sum([p.polys for p in hooves], []))

def dragon_paths():
    # the mušḫuššu (C drawing after the Babylonian type): slender scaly body, erect neck, snake's head with a horn and a forked
    # tongue, a curl on the head (greenish: B), feline forelegs, eagle's hind legs with talons, the tail raised with a sting
    P = ml.Path().M(150, 140).C(200, 128, 280, 126, 330, 130).C(350, 122, 362, 104, 370, 84).C(376, 68, 386, 56, 400, 52)         .C(418, 48, 436, 54, 452, 60).L(470, 66).L(452, 72).C(436, 74, 420, 76, 410, 84).C(400, 96, 396, 112, 392, 124)         .C(388, 136, 380, 146, 372, 152).L(374, 170).C(376, 186, 372, 200, 370, 212).L(376, 222).L(384, 228).L(358, 228).L(358, 214)         .C(356, 200, 356, 184, 354, 170).L(350, 178).L(346, 214).L(352, 228).L(330, 228).L(332, 212).C(334, 192, 334, 176, 330, 162)         .C(290, 166, 230, 168, 200, 164).C(204, 176, 204, 190, 198, 198).L(200, 212).L(214, 222).L(218, 228).L(204, 226).L(200, 228)         .L(188, 226).L(184, 228).L(180, 218).L(184, 212).L(182, 198).C(178, 188, 176, 178, 176, 170).L(170, 184).L(168, 198).L(170, 212)         .L(182, 224).L(174, 228).L(164, 224).L(158, 228).L(150, 220).L(154, 212).L(154, 196).C(150, 182, 148, 170, 150, 160)         .C(140, 156, 138, 146, 150, 140)
    tail = ml.Path().M(152, 140).C(120, 136, 104, 120, 104, 96).C(104, 76, 112, 62, 124, 52).C(128, 48, 134, 50, 132, 56)         .C(120, 68, 116, 84, 118, 100).C(120, 118, 134, 128, 156, 132)
    sting = ml.Path().M(122, 54).L(138, 36).L(131, 57)
    horn = ml.Path().M(404, 54).C(406, 36, 418, 26, 434, 22).C(424, 32, 418, 44, 416, 54)
    curl = ml.Path().M(394, 58).C(378, 50, 378, 32, 392, 30).C(404, 30, 406, 44, 396, 46).C(392, 48, 394, 54, 398, 54)
    tongue = ml.Path().M(466, 66).L(490, 58).L(482, 66).L(492, 72).L(464, 70)
    crest = ml.Path().M(388, 60).L(378, 58).L(382, 68).L(372, 70).L(376, 80).L(366, 84).L(371, 93).L(362, 98).L(368, 106).L(362, 112).L(372, 110).L(380, 78)
    return dict(body=P.polys + tail.polys + sting.polys, horn=horn.polys, curl=curl.polys, tongue=tongue.polys, crest=crest.polys)

GLAZE = {  # sRGB of the fresh glazes (C values; hues B: AMADORI2023)
    'blue': (40, 86, 156), 'blue2': (46, 108, 164), 'yellow': (214, 158, 64), 'white': (230, 226, 208), 'green': (112, 138, 92),
    'outline': (62, 54, 44), 'body': (214, 186, 142),
}
def glin(k): return ml.lin(np.array(GLAZE[k]) / 255.0)

def fig_masks(paths, Hh, Ww, S, ox, oy):
    return {k: ml.raster(v, Hh, Ww, S, S, ox, oy) for k, v in paths.items()}

def relief(m, depth, px_scale):
    """a moulded low-relief dome over a coverage mask: rounded edges, thin limbs lower than the body"""
    s = px_scale
    f = 0.35 * ml.blur(m, 3 * s) + 0.35 * ml.blur(m, 9 * s) + 0.30 * ml.blur(m, 22 * s)
    f = np.clip(f, 0, None) / max(np.percentile(f[m > 0.5], 99) if (m > 0.5).any() else 1, 1e-6)
    edge = np.clip(ml.blur(m, 1.2 * s), 0, 1)
    return depth * np.clip(f, 0, 1) ** 0.8 * edge

def outline(m, width_px):
    """the sunk dividing line along the border of a colour field: 0..1"""
    b = ml.blur(m, width_px * 0.6)
    return np.clip(1 - np.abs(b - 0.5) / 0.22, 0, 1)

def glaze_common(rng, Hh, Ww, th):
    B = bricks(rng, Hh, Ww, th, 0.006, 0.004, True)
    R, bid = B['R'], B['bid']
    tone = (0.93 + 0.14 * R[:, 10])[bid]
    craz = np.abs(ml.noise2(rng, Hh, Ww, 2, 18, 0.6)); craz = np.clip(1 - craz / 0.06, 0, 1) * 0.5   # crizzling network (faint)
    return B, tone, craz

def finish_glaze(rng, B, col, h_fig, tone, craz, glaze_rough=0.26):
    """joints, chips at the arrises exposing the body, crazing, per-brick glaze thickness; returns (h, colour lin, rough)"""
    h = B['hb'] + h_fig
    w = B['w']
    h = h * w + B['hm'] * (1 - w)
    B2 = dict(B); B2['h'] = h; B2['hb'] = B['hb'] + h_fig
    ch = chips(rng, B2, 18, 0.003, 0.012, (0.0012, 0.003)); h = B2['h']
    col = col * tone[..., None] * (1 - 0.04 * craz[..., None])
    col = np.where(ch[..., None] > 0, glin('body')[None, None, :] * 0.95, col)
    mortar = np.array([0.30, 0.28, 0.25]) * (1 + 0.08 * ml.noise2(rng, *h.shape, 2, 20))[..., None]
    col = col * w[..., None] + mortar * (1 - w[..., None])
    rough = (glaze_rough + 0.05 * craz + 0.04 * ml.noise2(rng, *h.shape, 4, 60)) * (1 - ch) + 0.8 * ch
    rough = rough * w + 0.92 * (1 - w)
    return h - np.median(h), col, np.clip(rough, 0.05, 1)

def animal_tile(rng, kind):
    S, ox, oy = 2.1, (W - 512 * 2.1) / 2, (H - 256 * 2.1) / 2
    B, tone, craz = glaze_common(rng, H, W, TH)
    P = bull_paths() if kind == 'bull' else dragon_paths()
    M = fig_masks(P, H, W, S, ox, oy)
    body = np.clip(M['body'] + sum(M[k] for k in M if k != 'body'), 0, 1)
    h_fig = relief(body, 0.028, 1.0)
    col = np.broadcast_to(glin('blue'), (H, W, 3)).copy()
    col = col * (1 + 0.08 * ml.noise2(rng, H, W, 20, 200)[..., None])
    if kind == 'bull':
        # muscles: shoulder, haunch, the neck's folds (C)
        X, Z = np.meshgrid(np.arange(W) + 0.5, np.arange(H) + 0.5)
        bump = lambda cx, cy, r, a: a * np.exp(-(((X - (ox + cx * S)) ** 2 + (Z - (oy + cy * S)) ** 2) / (2 * (r * S) ** 2)))
        h_fig += body * (bump(338, 118, 28, 0.007) + bump(168, 122, 26, 0.006) + bump(420, 118, 14, 0.003) + bump(265, 140, 40, 0.002))
        fields = [('body', 'yellow'), ('ear', 'yellow'), ('horn', 'blue2'), ('tuft', 'blue2'), ('hoof', 'green')]
        # the hair tufts along the dewlap and belly: blue crescents (the bulls' details in blue: B)
        tufts = np.zeros((H, W), np.float32)
        for (cx, cy) in [(392, 156), (380, 162), (368, 168), (290, 180), (262, 182), (234, 181), (208, 177)]:
            tufts = np.maximum(tufts, ml.disc(H, W, ox + cx * S, oy + (cy + 3) * S, 5.5 * S) - ml.disc(H, W, ox + cx * S, oy + (cy - 1) * S, 5 * S))
        tufts *= body; h_fig += tufts * 0.0015
        eye = ml.disc(H, W, ox + 440 * S, oy + 106 * S, 3.2 * S)
    else:
        X, Z = np.meshgrid(np.arange(W) + 0.5, np.arange(H) + 0.5)
        bump = lambda cx, cy, r, a: a * np.exp(-(((X - (ox + cx * S)) ** 2 + (Z - (oy + cy * S)) ** 2) / (2 * (r * S) ** 2)))
        h_fig += body * (bump(352, 150, 16, 0.004) + bump(180, 152, 18, 0.004) + bump(380, 96, 12, 0.003))
        fields = [('body', 'white'), ('horn', 'yellow'), ('crest', 'yellow'), ('tongue', 'yellow'), ('curl', 'green')]
        # scales: a lattice of small domes over the body and neck (incised between: C, after the Babylonian type)
        sc = (0.5 + 0.5 * np.cos(2 * math.pi * X / (7 * S)) * np.cos(2 * math.pi * (Z + (np.floor(X / (7 * S)) % 2) * 3.5 * S) / (7 * S)))
        body_core = np.clip(ml.blur(M['body'], 3) * 1.6 - 0.6, 0, 1)
        h_fig += body_core * (sc - 0.5) * 0.0012
        tufts = body_core * (sc > 0.8)
        eye = ml.disc(H, W, ox + 422 * S, oy + 62 * S, 3.0 * S)
    for part, g in fields:
        m = np.clip(M[part], 0, 1)
        col = col * (1 - m[..., None]) + glin(g)[None, None, :] * m[..., None]
    if kind == 'bull': col = col * (1 - tufts[..., None]) + glin('blue2') * tufts[..., None]
    else: col = col * (1 - 0.25 * tufts[..., None]) + glin('yellow') * 0.25 * tufts[..., None]
    col = col * (1 - eye[..., None]) + glin('outline') * eye[..., None]
    # the sunk outlines between the colour fields (and round the figure)
    ol = np.zeros((H, W), np.float32)
    for part, _ in fields: ol = np.maximum(ol, outline(np.clip(M[part], 0, 1), 3.0))
    col = col * (1 - 0.85 * ol[..., None]) + glin('outline') * 0.85 * ol[..., None]
    h_fig -= ol * 0.0011
    h, col, rough = finish_glaze(rng, B, col, h_fig, tone, craz)
    return h, col, rough, body

def rosette_tile(rng):
    B, tone, craz = glaze_common(rng, RH, RW, RH * PX)
    X, Z = np.meshgrid(np.arange(RW) + 0.5, np.arange(RH) + 0.5)
    col = np.broadcast_to(glin('blue'), (RH, RW, 3)).copy() * (1 + 0.08 * ml.noise2(rng, RH, RW, 20, 200)[..., None])
    petals = np.zeros((RH, RW)); centre = np.zeros((RH, RW)); h_fig = np.zeros((RH, RW))
    R0 = 0.13 / PX
    for k in range(6):
        cx, cy = (k + 0.5) * PITCH / PX, RH / 2
        dx, dy = X - cx, Z - cy; r = np.hypot(dx, dy); th = np.arctan2(dy, dx)
        prof = R0 * (0.52 + 0.48 * np.abs(np.cos(6 * th)) ** 0.6)
        p = np.clip(prof - r + 0.5, 0, 1) * (r > 0.3 * R0); c0 = np.clip(0.27 * R0 - r + 0.5, 0, 1)
        petals = np.maximum(petals, p); centre = np.maximum(centre, c0)
        h_fig += 0.006 * np.clip(1 - r / R0, 0, 1) ** 0.5 * np.maximum(p, c0)
    lines = ((np.abs(Z - 10) < 3.5) | (np.abs(Z - (RH - 10)) < 3.5)).astype(float)
    for m, g in ((petals, 'white'), (centre, 'yellow'), (lines, 'white')):
        col = col * (1 - m[..., None]) + glin(g) * m[..., None]
    ol = np.maximum.reduce([outline(petals, 2.5), outline(centre, 2.5), outline(lines, 2.0)])
    col = col * (1 - 0.8 * ol[..., None]) + glin('outline') * 0.8 * ol[..., None]; h_fig = h_fig - ol * 0.0009
    return finish_glaze(rng, B, col, h_fig, tone, craz)

def blue_tile(rng):
    B, tone, craz = glaze_common(rng, H, W, TH)
    col = np.broadcast_to(glin('blue'), (H, W, 3)).copy() * (1 + 0.08 * ml.noise2(rng, H, W, 20, 200)[..., None])
    return finish_glaze(rng, B, col, np.zeros((H, W)), tone, craz)
