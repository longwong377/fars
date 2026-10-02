# The fill's modelled props (session 15, agent fill, D-367): the things that make a lane, a market, a court and a building
# site full. Run by tools/blender/fill_props.mjs (Blender headless): it imports model_props.py's library and driver (the same
# levels lod0/lod1/lod2, triangle targets, weld + collapse and the ambient-occlusion bake into a vertex colour) and adds the
# assets below as fill_<id>. Coordinates: the game's (x, y up, z) through model_props.G / pathG / log; every form is C (no
# market stall, awning, standard cloth or laundry line of the period survives; reliefs, the tablets and the analogues are cited
# where they constrain the form).
import bpy, sys, os, json, math, random, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
import model_props as mp  # noqa: E402  (its ASSETS registry and helpers; its driver runs only as __main__)
from mp_lib import *  # noqa
from mathutils import Vector

G, pathG, log, heap, stone_lump = mp.G, mp.pathG, mp.log, mp.heap, mp.stone_lump
FILL = {}
def fill(ao=True, ground=True, lod1=0.35):
    def reg(f): FILL[f.__name__[2:]] = dict(fn=f, ao=ao, ground=ground, lod1=lod1); return f
    return reg

def sheet(w, d, nx, ny, shape, name='cloth', t=0.004):
    """a cloth sheet: a grid w x d (game x, z) whose vertices are placed by shape(u, s) -> game (x, y, z), u in -w/2..w/2,
    s in -d/2..d/2; solidified to t"""
    c = grid(w, d, nx, ny, name)
    for v in c.data.vertices:
        u, s = v.co.x, v.co.y; v.co = G(shape(u, s))
    solidify(c, t, 0); return c

def ties(pts, r=0.006):
    return [pathG(p, r, 4, 'cord') for p in pts]

# ------------------------------------------------------------------------------------------------------------- the market
@fill()
def a_stall():
    """a market stall (C): four forked poles (front 2.15 m, back 1.95 m), two side bars lashed on, a cloth awning stretched
    over them sagging between the bars, its front edge hanging in a short valance; a plank laid on two mud-brick piers as the
    counter (0.45 m) at the front. 2.4 m wide (x), 1.6 m deep (z: the front toward +z, the seller's side -z)"""
    W, D, hf, hb = 2.4, 1.6, 2.15, 1.95
    wood = []
    for i, (x, z, h) in enumerate(((-W / 2, D / 2, hf), (W / 2, D / 2, hf), (-W / 2, -D / 2, hb), (W / 2, -D / 2, hb))):
        wood.append(log((x, -0.25, z), (x, h + 0.05, z), 0.035, 0.03, 7, 'pole', seed=700 + i))
    for x in (-W / 2, W / 2): wood.append(log((x, hb - 0.04, -D / 2 - 0.08), (x, hf - 0.04, D / 2 + 0.08), 0.028, 0.026, 6, 'bar', seed=710 + int(x * 10)))
    for z, h in ((D / 2, hf), (-D / 2, hb)): wood.append(log((-W / 2 - 0.1, h - 0.02, z), (W / 2 + 0.1, h - 0.02, z), 0.026, 0.024, 6, 'rail', seed=720 + int(z * 10)))
    # the counter: a split plank on two piers of mud brick
    plank = box(W - 0.2, 0.36, 0.05, G((0, 0.42, D / 2 - 0.25)), 'plank', bevel=0.01); displace(plank, 0.004, 0.08, seed=731)
    wood.append(plank)
    mud = [box(0.36, 0.3, 0.42, G((x, 0.0, D / 2 - 0.25)), 'pier', bevel=0.02) for x in (-W / 2 + 0.35, W / 2 - 0.35)]
    for m in mud: displace(m, 0.01, 0.1, seed=733)
    def roof(u, s):
        t = (s + D / 2) / D; y = hb + (hf - hb) * t + 0.03
        sag = 0.11 * math.cos(math.pi * u / (W + 0.3)) * math.sin(math.pi * min(1, max(0, t)))
        return (u, y - sag + 0.006 * math.sin(u * 13 + s * 7), s)
    cl = sheet(W + 0.3, D + 0.25, 36, 22, roof, 'cloth')
    val = sheet(W + 0.3, 0.32, 36, 5, lambda u, s: (u + 0.01 * math.sin(u * 9), hf + 0.02 - (s + 0.16) * (1 + 0.04 * math.sin(u * 5)), D / 2 + 0.14 + 0.03 * (s + 0.16) + 0.012 * math.sin(u * 11)), 'val')
    cord = ties([[(x * W / 2, hf - 0.02, D / 2), (x * (W / 2 + 0.6), 0.0, D / 2 + 1.1)] for x in (-1, 1)])
    return dict(wood=join(wood, 'wood'), mud=join(mud, 'mud'), cloth=join([cl, val], 'cloth'), cord=join(cord, 'cord'))

@fill()
def a_awning():
    """a cloth awning over a doorway or a stretch of wall (C): the cloth's back edge nailed under the eave (2.35 m) on the
    wall (the game's -z), its front on a rail between two poles 1.7 m out (2.05 m), sagging; guy ropes to pegs. 2.6 m wide"""
    W, D, hw, hp = 2.6, 1.7, 2.35, 2.05
    wood = [log((x, -0.2, D), (x, hp + 0.06, D), 0.032, 0.028, 7, 'pole', seed=740 + i) for i, x in enumerate((-W / 2 + 0.1, W / 2 - 0.1))]
    wood.append(log((-W / 2, hp, D), (W / 2, hp, D), 0.024, 0.022, 6, 'rail', seed=745))
    wood.append(log((-W / 2, hw, 0.04), (W / 2, hw, 0.04), 0.02, 0.02, 6, 'batten', seed=746))
    def roof(u, s):
        t = (s + D / 2) / D; y = hw + (hp - hw) * t
        sag = 0.12 * math.sin(math.pi * t) * (0.6 + 0.4 * math.cos(math.pi * u / W))
        return (u, y - sag + 0.005 * math.sin(u * 11 + t * 6), 0.04 + t * (D - 0.04))
    cl = sheet(W, D, 34, 20, lambda u, s: roof(u, -s), 'cloth')
    val = sheet(W, 0.25, 34, 4, lambda u, s: (u, hp - (s + 0.125) * (1 + 0.05 * math.sin(u * 6)), D + 0.03 + 0.01 * math.sin(u * 9)), 'val')
    cord = ties([[(x * (W / 2 - 0.1), hp, D), (x * (W / 2 + 0.3), 0.0, D + 0.9)] for x in (-1, 1)])
    return dict(wood=join(wood, 'wood'), cloth=join([cl, val], 'cloth'), cord=join(cord, 'cord'))

@fill()
def a_produce():
    """a shallow basket heaped with fruit for sale (pomegranates, apples, quinces: the PF fruit, B; the heap C): 0.55 m across"""
    o = [(0.17, 0.0), (0.22, 0.03), (0.26, 0.09), (0.275, 0.13)]
    b = vessel(o, 0.012, 30, 'b', 0.02, seed=760)
    for v in b.data.vertices:
        rr = math.hypot(v.co.x, v.co.y)
        if rr > 0.05: k = 1 + 0.025 * math.sin(v.co.z * 230); v.co.x *= k; v.co.y *= k
    rim = sweep([(0.278 * math.cos(a), 0.278 * math.sin(a), 0.132) for a in [TAU * i / 36 for i in range(37)]], 0.011, 6, 'rim', caps=False)
    rnd = random.Random(761); fr = []
    pts = []
    for layer, (n, rr, z) in enumerate(((9, 0.17, 0.09), (6, 0.11, 0.15), (3, 0.05, 0.2), (1, 0.0, 0.245))):
        for k in range(n):
            a = TAU * k / max(1, n) + layer * 0.5 + rnd.uniform(-0.1, 0.1); pts.append((rr * math.cos(a), rr * math.sin(a), z + rnd.uniform(-0.01, 0.01)))
    for i, p in enumerate(pts):
        r = rnd.uniform(0.042, 0.052)
        f = lathe([(0.0, -r), (r * 0.7, -r * 0.8), (r, -r * 0.1), (r * 0.95, r * 0.5), (r * 0.5, r * 0.88), (r * 0.25, r * 0.95), (r * 0.18, r * 1.12), (r * 0.1, r * 1.05), (0.0, r * 0.95)], 12, 'f', wobble=0.05, seed=770 + i)
        fr.append(xform(f, p, (rnd.uniform(-0.6, 0.6), rnd.uniform(-0.6, 0.6), rnd.uniform(0, TAU))))
    return dict(wicker=join([b, rim], 'wicker'), fruit=join(fr, 'fruit'))

@fill()
def a_grain():
    """an open sack of grain for sale, its mouth rolled down into a thick collar, the grain heaped above it, a wooden measure
    (a bowl-shaped scoop) stuck in it (C); 0.5 m across, 0.6 m high"""
    body = lathe([(0.0, 0.0), (0.2, 0.0), (0.24, 0.04), (0.25, 0.2), (0.24, 0.38), (0.22, 0.46), (0.235, 0.5), (0.25, 0.53), (0.22, 0.56), (0.19, 0.53), (0.0, 0.5)], 24, 'body', wobble=0.05, seed=780)
    displace(body, 0.008, 0.06, seed=781)
    g = heap(0.19, 0.12, 0, 0, seed=782, lump=0.08, name='grain'); xform(g, (0, 0, 0.5))
    displace(g, 0.003, 0.012, seed=783)
    sc = lathe([(0.0, 0.0), (0.05, 0.005), (0.07, 0.04), (0.072, 0.06), (0.066, 0.062), (0.0, 0.01)], 14, 'scoop')
    xform(sc, (0.06, -0.02, 0.56), (0.5, 0.2, 0))
    return dict(cloth=body, grain=g, wood=sc)

@fill()
def a_bolts():
    """cloth for sale: a pile of folded lengths and two rolled bolts on a reed mat (C), 1.0 x 0.6 m"""
    mat = box(1.0, 0.62, 0.012, (0, 0, 0), 'mat', bevel=0.004)
    rnd = random.Random(790); a, b = [], []
    for k in range(5):
        f = box(0.42, 0.3, 0.06, (0, 0, 0), 'fold', bevel=0.022, segs=3); displace(f, 0.006, 0.08, seed=791 + k)
        xform(f, (-0.22 + rnd.uniform(-0.02, 0.02), rnd.uniform(-0.03, 0.03), 0.012 + 0.058 * k), (0, 0, rnd.uniform(-0.12, 0.12))); (a if k % 2 else b).append(f)
    for k in range(2):
        r = lathe([(0.0, -0.3), (0.06, -0.3), (0.065, -0.28), (0.065, 0.28), (0.06, 0.3), (0.0, 0.3)], 18, 'roll', wobble=0.03, seed=797 + k)
        xform(r, (0.2 + 0.13 * k, 0.0, 0.075), (0, math.pi / 2, 0.1 * k)); (a if k else b).append(r)
    return dict(reed=mat, textile_a=join(a, 'textile_a'), textile_b=join(b, 'textile_b'))

@fill()
def a_pots():
    """a potter's goods set out for sale (C): bowls nested in stacks, cups, and two small jars on a mat, 1.0 x 0.7 m"""
    mat = box(1.0, 0.7, 0.01, (0, 0, 0), 'mat', bevel=0.003)
    rnd = random.Random(800); c = []
    for s, (x, y) in enumerate(((-0.3, 0.12), (-0.05, -0.15), (0.2, 0.15))):
        for k in range(3 + s % 2):
            bw = vessel([(0.04, 0.0), (0.09, 0.02), (0.13, 0.06), (0.14, 0.075)], 0.006, 22, 'bowl', 0.015, seed=801 + s * 5 + k)
            c.append(xform(bw, (x, y, 0.01 + 0.035 * k), (0, 0, rnd.uniform(0, TAU))))
    for k, (x, y) in enumerate(((0.38, -0.12), (0.4, 0.18))):
        j = vessel([(0.04, 0.0), (0.08, 0.04), (0.1, 0.12), (0.085, 0.2), (0.045, 0.25), (0.04, 0.29), (0.05, 0.3)], 0.007, 22, 'jar', 0.02, seed=820 + k)
        c.append(xform(j, (x, y, 0.01)))
    for k in range(4):
        cp = vessel([(0.025, 0.0), (0.04, 0.01), (0.045, 0.06), (0.048, 0.08)], 0.004, 16, 'cup', 0.02, seed=830 + k)
        c.append(xform(cp, (-0.38 + 0.09 * k, -0.25, 0.01)))
    return dict(reed=mat, clay=join(c, 'clay'))

# ------------------------------------------------------------------------------------------------------------- the lanes
@fill(ground=False)
def a_line():
    """a washing line across a lane (C): a cord between two pegs driven into the facing walls at 2.4 m, 3 m apart (the
    builder stretches it to the lane), sagging 0.18 m, with five washed cloths of different sizes hung over it"""
    L, h, sag = 3.0, 2.4, 0.18
    cy = lambda x: h - sag * (1 - (2 * x / L) ** 2)
    cord = pathG([(x, cy(x), 0) for x in [-L / 2 + L * i / 16 for i in range(17)]], 0.005, 5, 'cord')
    pegs = [pathG([(s * L / 2, h, 0), (s * (L / 2 - 0.12), h + 0.01, 0)], 0.012, 6, 'peg') for s in (-1, 1)]
    rnd = random.Random(840); A, B = [], []
    x = -L / 2 + 0.25
    for k in range(5):
        w = rnd.uniform(0.3, 0.6); d = rnd.uniform(0.45, 1.0)
        if x + w > L / 2 - 0.2: break
        x0 = x
        Lc = d * 1.55
        def hang(u, s, x0=x0, w=w, Lc=Lc, k=k):
            p = s + Lc / 2; pf = Lc * 0.36; side = 1 if p < pf else -1; dd = abs(p - pf)
            xx = x0 + w / 2 + u
            return (xx + 0.015 * math.sin(dd * 6 + u * 4 + k), cy(xx) + 0.01 - dd * (1 - 0.04 * math.sin(u * 11 + side)), side * (0.01 + 0.015 * dd) * min(1.0, dd / 0.04) + 0.01 * math.sin(u * 15) * dd)
        c = sheet(w, Lc, 10, 22, hang, 'c'); (A if k % 2 == 0 else B).append(c)
        x += w + rnd.uniform(0.08, 0.2)
    return dict(cord=cord, wood=join(pegs, 'wood'), cloth_a=join(A, 'cloth_a'), cloth_b=join(B, 'cloth_b'))

@fill()
def a_bundle():
    """a bundle of brushwood fuel tied with a cord, brought in from the hills on a donkey and set down by a door (C), 1.1 m"""
    rnd = random.Random(850); st = []
    for k in range(26):
        a = rnd.uniform(0, TAU); r = 0.11 * math.sqrt(rnd.random())
        y, z = 0.13 + r * math.sin(a), r * math.cos(a); L = rnd.uniform(0.9, 1.15); x0 = -0.55 + rnd.uniform(-0.05, 0.05)
        st.append(pathG([(x0, y, z), (x0 + L * 0.5, y + rnd.uniform(-0.02, 0.02), z), (x0 + L, y + rnd.uniform(-0.05, 0.05), z + rnd.uniform(-0.06, 0.06))], [0.014, 0.011, 0.006], 4, 'st'))
        if k % 4 == 0: st.append(pathG([(x0 + L * 0.8, y, z), (x0 + L + 0.12, y + rnd.uniform(-0.08, 0.08), z + rnd.uniform(-0.1, 0.1))], [0.005, 0.002], 3, 'tw'))
    cord = [pathG([(x, 0.13 + 0.125 * math.sin(a), 0.125 * math.cos(a)) for a in [TAU * i / 12 for i in range(13)]], 0.006, 4, 'cord', caps=False) for x in (-0.25, 0.2)]
    w = join(st, 'wood'); displace(w, 0.003, 0.04, seed=851)
    return dict(wood=w, cord=join(cord, 'cord'))

# ------------------------------------------------------------------------------------------------------------- the Terrace
@fill()
def a_standard():
    """a standard on a pole (C): the Achaemenid royal standard was a golden eagle with spread wings on a shaft (Xenophon,
    Cyropaedia 7.1.4; Anabasis 1.10.12: B); here a cloth hung from a crossbar beneath a gilt bird finial, the pole stepped
    in a stone socket. 5.2 m high"""
    H = 5.2
    pole = log((0, 0.0, 0), (0, H, 0), 0.04, 0.034, 8, 'pole', seed=860)
    bar = log((-0.55, H - 0.55, 0.0), (0.55, H - 0.55, 0.0), 0.016, 0.016, 6, 'bar', seed=861)
    sock = box(0.5, 0.5, 0.32, (0, 0, 0), 'socket', bevel=0.03); displace(sock, 0.008, 0.08, seed=862)
    def hang(u, s):
        t = s / 1.5 + 0.5; d = (1 - t) * 1.5
        return (u + 0.02 * math.sin(d * 3), H - 0.56 - d, 0.02 * math.sin(u * 4 + d * 2.5) + 0.03 * d * d)
    cl = sheet(1.0, 1.5, 18, 26, hang, 'cloth', 0.004)
    fringe = []
    for k in range(13):
        x = -0.48 + 0.08 * k; d = 1.5; y0 = H - 0.56 - d
        fringe.append(pathG([(x, y0, 0.03 * d * d), (x + 0.01, y0 - 0.12, 0.03 * d * d + 0.01)], [0.008, 0.004], 4, 'fr'))
    # the finial: a disc and a bird with spread wings (a flat cut-out form, the wings bent forward a little)
    bird = []
    bird.append(xform(lathe([(0.0, 0.0), (0.05, 0.0), (0.06, 0.03), (0.03, 0.05), (0.0, 0.06)], 14, 'knob'), G((0, H, 0))))
    body = meta([('ELLIPSOID', (0, 0, H + 0.2), 0.07, (0.6, 0.6, 1.6), 2), ('BALL', (0, -0.02, H + 0.33), 0.05, None, 2)], res=0.012, name='body')
    bird.append(body)
    for s in (-1, 1):
        wing = []
        for i in range(7):
            t = i / 6; wing.append((s * (0.04 + 0.32 * t), 0.02 * t * t, H + 0.22 + 0.16 * math.sin(math.pi * t * 0.8)))
        bird.append(sweep(wing, [0.06, 0.07, 0.07, 0.06, 0.05, 0.035, 0.015], 6, 'wing', scale=(1.0, 0.18)))
    return dict(wood=join([pole, bar], 'wood'), stone=sock, cloth=join([cl] + fringe, 'cloth'), gilt=join(bird, 'gilt'))

@fill()
def a_chips():
    """a heap of limestone chips and spalls knocked off by the masons dressing blocks (the waste of dressing: the Terrace's
    fills hold it, B; the heap C): a low heap of fines with angular spalls on and around it, 1.8 x 1.4 m"""
    h = heap(0.75, 0.35, 0, 0, seed=870, lump=0.25, name='fines'); xform(h, scale=(1.15, 0.9, 1.0))
    rnd = random.Random(871); sp = []
    for k in range(34):
        a = rnd.uniform(0, TAU); d = rnd.uniform(0.0, 1.0); r = rnd.uniform(0.03, 0.09)
        x, y = 0.95 * d * math.cos(a), 0.75 * d * math.sin(a); z = max(0.0, 0.33 * (1 - d * d)) - r * 0.2
        s = stone_lump(r, 872 + k, 'spall', flat=0.45); sp.append(xform(s, (x, y, z), (rnd.uniform(-0.4, 0.4), rnd.uniform(-0.4, 0.4), rnd.uniform(0, TAU))))
    return dict(fines=h, stone=join(sp, 'stone'))

@fill()
def a_block():
    """a quarry block brought up for dressing (C): rough pitched faces with the quarry's wedge marks, 1.3 x 0.75 x 0.8 m,
    on two wooden skids"""
    b = box(1.3, 0.8, 0.72, (0, 0, 0.08), 'block', bevel=0.015, segs=1); remesh(b, 0.025, smooth=False)
    displace(b, 0.05, 0.35, seed=880); displace(b, 0.015, 0.07, seed=881); sharp(b, 30)  # (pitched faces: broad hollows and bosses, then the point's pecking)
    for k in range(4):  # wedge holes along the top arris
        c = box(0.04, 0.08, 0.06, (-0.45 + 0.3 * k, 0.4, 0.78), 'w', base=False); boolean(b, c)
    sk = [log((-0.75, 0.04, z), (0.75, 0.04, z), 0.05, 0.05, 7, 'skid', seed=882 + int(z * 10)) for z in (-0.25, 0.25)]
    return dict(stone=b, wood=join(sk, 'wood'))

@fill()
def a_scaffold():
    """a timber scaffold bay against a wall or a column (C; no evidence of the method was retrieved, D-022): four poles in
    a 2.4 x 1.4 m bay, 6 m high, ledgers lashed every 2 m, a deck of rough planks at 4 m, a ladder of poles and rungs"""
    W, D, H = 2.4, 1.4, 6.0
    w = []
    for i, (x, z) in enumerate(((-W / 2, -D / 2), (W / 2, -D / 2), (-W / 2, D / 2), (W / 2, D / 2))):
        w.append(log((x, -0.3, z), (x, H, z), 0.055, 0.045, 7, 'pole', seed=890 + i))
    cords = []
    for k, y in enumerate((2.0, 4.0)):
        for z in (-D / 2, D / 2): w.append(log((-W / 2 - 0.15, y, z + 0.06), (W / 2 + 0.15, y, z + 0.06), 0.04, 0.04, 6, 'ledger', seed=900 + k * 2 + int(z > 0)))
        for x in (-W / 2, W / 2): w.append(log((x + 0.06, y + 0.08, -D / 2 - 0.15), (x + 0.06, y + 0.08, D / 2 + 0.15), 0.035, 0.035, 6, 'putlog', seed=910 + k * 2 + int(x > 0)))
        for x in (-W / 2, W / 2):
            for z in (-D / 2, D / 2):
                cords.append(pathG([(x + 0.07 * math.cos(a), y + 0.04 * math.sin(3 * a), z + 0.07 * math.sin(a)) for a in [TAU * i / 10 for i in range(11)]], 0.008, 4, 'lash', caps=False))
    rnd = random.Random(920)
    for k in range(5):
        z = -D / 2 + 0.15 + k * (D - 0.3) / 4
        p = box(W + 0.4, 0.26, 0.05, G((rnd.uniform(-0.05, 0.05), 4.16, z)), 'plank', bevel=0.008); xform(p, rot=(0, 0, rnd.uniform(-0.02, 0.02))); displace(p, 0.004, 0.1, seed=921 + k); w.append(p)
    for s in (-1, 1): w.append(log((W / 2 + 0.35 + s * 0.22, 0.0, D / 2 + 0.6), (W / 2 + 0.35 + s * 0.22, 4.6, D / 2 - 0.1), 0.03, 0.026, 6, 'stile', seed=930 + s))
    for k in range(13):
        t = (k + 0.5) / 13; w.append(log((W / 2 + 0.11, 4.6 * t, D / 2 + 0.6 - 0.7 * t), (W / 2 + 0.59, 4.6 * t, D / 2 + 0.6 - 0.7 * t), 0.016, 0.016, 5, 'rung', seed=940 + k, bark=0))
    return dict(wood=join(w, 'wood'), cord=join(cords, 'cord'))

@fill()
def a_rubble():
    """building debris (C): broken mud brick, lumps of mortar and fallen plaster swept into a low heap by a wall, 1.4 x 0.9 m"""
    h = heap(0.55, 0.22, 0, 0, seed=950, lump=0.3, name='mud'); xform(h, scale=(1.25, 0.8, 1.0))
    rnd = random.Random(951); br = []
    for k in range(16):
        a = rnd.uniform(0, TAU); d = rnd.uniform(0.1, 1.0); x, y = 0.7 * d * math.cos(a), 0.45 * d * math.sin(a); z = max(0.0, 0.18 * (1 - d * d))
        b = box(rnd.uniform(0.12, 0.33), rnd.uniform(0.1, 0.25), 0.1, (0, 0, 0), 'br', bevel=0.012); displace(b, 0.01, 0.06, seed=952 + k)
        br.append(xform(b, (x, y, z), (rnd.uniform(-0.5, 0.5), rnd.uniform(-0.5, 0.5), rnd.uniform(0, TAU))))
    return dict(mud=h, brick=join(br, 'brick'))

# ------------------------------------------------------------------------------------------------------------- s17 C1 (D-550)
# The lanes' and doorways' lesser things, made so that no lane, door or wall of the town stands bare (all C: the region's
# vernacular, RECOLLECTION, NOT SEEN; reed matting and baskets: Hasanlu and the Babylonian houses' matting impressions, B
# analogues; the water skin: the reliefs' and the tablets' skins for water and wine, B).
@fill()
def a_litter():
    """the litter of a lane that people and animals use every day (C): spilled straw and chaff, a scatter of donkey droppings,
    two sherds of a broken jar and a few twigs, flat on the ground over 1.4 x 1.0 m, nothing higher than 4 cm"""
    rnd = random.Random(1500); st = []
    for i, (cx, cz, r) in enumerate([(-0.25, 0.05, 0.13), (0.2, -0.15, 0.1), (-0.5, -0.2, 0.08)]): st.append(heap(r, 0.022, cx, cz, seed=1501 + i, lump=0.6, name='chaff'))
    # (s17: the straws in three clumps where they were dropped and trodden, thick enough to read at 5-10 m, a few lying loose)
    clumps = [(-0.25, 0.05, 0.3), (0.2, -0.15, 0.22), (-0.5, -0.2, 0.18)]
    for k in range(90):
        cx, cz, cr = clumps[k % 3] if k < 75 else (0.0, 0.0, 0.6)
        a = rnd.uniform(0, TAU); d = cr * math.sqrt(rnd.random()); x, z = cx + d * math.cos(a), cz + 0.8 * d * math.sin(a); t = rnd.uniform(0, TAU); L = rnd.uniform(0.1, 0.26)
        y = 0.004 + rnd.uniform(0, 0.02 if k < 75 else 0.006)
        st.append(pathG([(x, y, z), (x + L * 0.5 * math.cos(t), y + 0.005, z + L * 0.5 * math.sin(t)), (x + L * math.cos(t + 0.25), y, z + L * math.sin(t + 0.25))], [0.0035, 0.003, 0.0015], 3, 'w', scale=(1.0, 0.5)))
    dung = []
    for k in range(9):
        a = rnd.uniform(0, TAU); d = rnd.uniform(0.05, 0.25); x, z = 0.35 + d * math.cos(a), -0.1 + d * math.sin(a); r = rnd.uniform(0.022, 0.035)
        b = stone_lump(r, 1510 + k, 'd', flat=0.55); displace(b, 0.004, 0.02, seed=1520 + k); q = G((x, 0, z)); dung.append(xform(b, (q.x, q.y, 0), (0, 0, rnd.uniform(0, TAU))))
    clay = []
    for k in range(2):
        sh = grid(0.11, 0.08, 5, 4, 'sh'); 
        for v in sh.data.vertices: v.co.z = 0.012 * (1 - (v.co.x / 0.06) ** 2)
        solidify(sh, 0.008, 0); q = G((-0.45 + 0.6 * k, 0.004, 0.28 - 0.5 * k)); clay.append(xform(sh, (q.x, q.y, 0.004), (0.15 * k, 0, rnd.uniform(0, TAU))))
    tw = [pathG([(-0.5 + 0.3 * k, 0.008, -0.3 + 0.2 * k), (-0.3 + 0.32 * k, 0.012, -0.22 + 0.15 * k), (-0.12 + 0.3 * k, 0.008, -0.27 + 0.2 * k)], [0.006, 0.005, 0.003], 4, 'tw') for k in range(3)]
    return dict(straw=join(st, 'straw'), dung=join(dung, 'dung'), clay=join(clay, 'clay'), wood=join(tw, 'wood'))

@fill()
def a_matlean():
    """reed mats leaned on a wall (C): one rolled and stood on end, one flat and tilted against the wall behind it; the mat's
    plain weave in ridges, its edges bound; the wall is the game's -z, the mats' feet 0.25-0.45 m out from it"""
    rnd = random.Random(1530)
    roll = lathe([(0.0, 0.0), (0.105, 0.0), (0.11, 0.02), (0.108, 0.8), (0.112, 1.55), (0.1, 1.58), (0.0, 1.58)], 20, 'roll', wobble=0.006, seed=1531)
    for v in roll.data.vertices:
        rr = math.hypot(v.co.x, v.co.y)
        if rr > 0.05: k = 1 + 0.035 * math.sin(math.atan2(v.co.y, v.co.x) * 18) + 0.02 * math.sin(v.co.z * 60); v.co.x *= k; v.co.y *= k
    q = G((0.35, 0, 0.3)); xform(roll, (q.x, q.y, 0), (math.radians(-9), 0, 0))
    W, Hh, lean = 1.0, 1.7, math.radians(14)
    flat = grid(W, Hh, 18, 30, 'flat')
    for v in flat.data.vertices:
        u, s = v.co.x, v.co.y + Hh / 2; ridge = 0.004 * math.sin(s * 140)
        v.co = G((u - 0.25, s * math.cos(lean), 0.06 + (Hh - s) * math.sin(lean) - 0.3 + ridge))
    solidify(flat, 0.006, 0)
    return dict(reed=join([roll, flat], 'reed'))

@fill()
def a_basket_tall():
    """a tall coiled carrying basket for grain or dung (C): flared, 0.55 m high, 0.42 across the mouth, two rope handles"""
    o = [(0.15, 0.0), (0.17, 0.02), (0.19, 0.18), (0.205, 0.38), (0.215, 0.55)]
    b = vessel(o, 0.014, 32, 'b', 0.008, seed=1540)
    for v in b.data.vertices: k = 1 + 0.012 * math.sin(v.co.z * 140); v.co.x *= k; v.co.y *= k
    cord = [pathG([(x * 0.2, 0.5, 0.0), (x * 0.25, 0.43, 0.06), (x * 0.25, 0.43, -0.06), (x * 0.2, 0.5, 0.0)], 0.009, 5, 'h') for x in (-1, 1)]
    return dict(wicker=b, cord=join(cord, 'cord'))

@fill()
def a_winnow():
    """a round winnowing tray of coiled reed leaned on a wall (C): 0.62 m across, a low rim, its back to the wall (-z)"""
    o = [(0.0, 0.0), (0.24, 0.0), (0.29, 0.025), (0.31, 0.06)]
    t = vessel(o, 0.01, 36, 't', 0.006, seed=1550)
    for v in t.data.vertices: k = 1 + 0.01 * math.sin(math.hypot(v.co.x, v.co.y) * 150); v.co.z *= k
    # stood on its edge, leaning back 15 degrees onto the wall behind it
    xform(t, (0, 0, 0), (math.radians(90 - 15), 0, 0)); q = G((0, 0.3, 0.12)); xform(t, (q.x, q.y, q.z))
    return dict(wicker=t)

@fill()
def a_reed_awning():
    """a shade of reed matting on poles before a door (C): the mat's back edge on pegs under the eave at 2.3 m, its front on a
    pole frame 1.6 m out at 2.0 m, sagging a little; 2.2 m wide; poles lashed with cord"""
    W, D, hw, hp = 2.2, 1.6, 2.3, 2.0
    wood = [log((x, -0.2, D), (x, hp + 0.05, D), 0.04, 0.034, 7, 'pole', seed=1560 + i) for i, x in enumerate((-W / 2 + 0.08, W / 2 - 0.08))]
    wood.append(log((-W / 2 - 0.05, hp, D), (W / 2 + 0.05, hp, D), 0.03, 0.028, 6, 'rail', seed=1565))
    wood += [log((x, hw - 0.04, 0.05), (x, hp + 0.02, D + 0.05), 0.022, 0.02, 6, 'rafter', seed=1566 + i) for i, x in enumerate((-W / 2 + 0.25, 0.0, W / 2 - 0.25))]
    def roof(u, s):
        t = (s + D / 2) / D; y = hw + (hp - hw) * t + 0.03
        sag = 0.05 * math.sin(math.pi * t) * math.cos(math.pi * u / (W + 0.3)); ridge = 0.004 * math.sin(u * 120)
        return (u, y - sag + ridge, 0.05 + t * D)
    mat = sheet(W + 0.2, D + 0.15, 40, 18, lambda u, s: roof(u, -s), 'mat', t=0.012)
    cord = ties([[(x, hp, D), (x, hp + 0.03, D - 0.05)] for x in (-W / 2 + 0.08, W / 2 - 0.08)])
    return dict(wood=join(wood, 'wood'), reed=mat, cord=join(cord, 'cord'))

@fill()
def a_stall_reed():
    """a market stall of the poorer kind (C): a reed-mat shade on four crooked poles (front 2.0 m, back 1.8 m), the mat's
    ends hanging loose, a low mud-brick bench as the counter (0.4 m) with a plank on it; 2.2 m wide (x), 1.5 m deep (z: the
    front toward +z)"""
    W, D, hf, hb = 2.2, 1.5, 2.0, 1.8
    wood = []
    for i, (x, z, h) in enumerate(((-W / 2, D / 2, hf), (W / 2, D / 2, hf), (-W / 2, -D / 2, hb), (W / 2, -D / 2, hb))):
        wood.append(log((x, -0.2, z), (x + 0.03 * (i % 2 * 2 - 1), h + 0.04, z), 0.04, 0.033, 7, 'pole', seed=1580 + i))
    for z, h in ((D / 2, hf), (-D / 2, hb)): wood.append(log((-W / 2 - 0.12, h - 0.03, z), (W / 2 + 0.12, h - 0.03, z), 0.03, 0.028, 6, 'rail', seed=1586 + int(z * 10)))
    plank = box(W - 0.35, 0.34, 0.045, G((0, 0.4, D / 2 - 0.3)), 'plank', bevel=0.008); displace(plank, 0.004, 0.08, seed=1589); wood.append(plank)
    bench = box(W - 0.3, 0.38, 0.38, G((0, 0.0, D / 2 - 0.3)), 'bench', bevel=0.03); displace(bench, 0.012, 0.12, seed=1590)
    def roof(u, s):
        t = (s + D / 2) / D; y = hb + (hf - hb) * t + 0.02
        sag = 0.06 * math.sin(math.pi * min(1, max(0, t))) * math.cos(math.pi * u / (W + 0.4)); ridge = 0.004 * math.sin(u * 120)
        return (u, y - sag + ridge, s)
    mat = sheet(W + 0.4, D + 0.3, 40, 18, roof, 'mat', t=0.012)
    # (the mat's loose front end: short, its frayed lower edge ragged, swung a little out)
    hang = sheet(W + 0.4, 0.22, 40, 4, lambda u, s: (u, hf + 0.01 - (s + 0.11) * (1 + 0.35 * (0.5 + 0.5 * math.sin(u * 17 + 1.3)) * (s + 0.11) / 0.22), D / 2 + 0.16 + 0.12 * (s + 0.11)), 'hang', t=0.012)
    cord = ties([[(x, hf - 0.03, D / 2), (x + 0.02, hf + 0.02, D / 2 - 0.05)] for x in (-W / 2, W / 2)])
    return dict(wood=join(wood, 'wood'), mud=bench, reed=join([mat, hang], 'reed'), cord=join(cord, 'cord'))

@fill(ground=False)
def a_skin():
    """a goatskin water bag hung on a wooden peg driven into the wall by a door (C): the peg at 1.55 m, the skin's legs tied,
    its belly full and sagging to 0.95 m; the wall is the game's -z"""
    peg = log((0, 1.55, -0.05), (0, 1.6, 0.14), 0.022, 0.018, 6, 'peg', seed=1570)
    # the body hangs from the tied neck: a full belly low and wide, the four leg stumps tied off and sticking out at the
    # shoulders and the haunches, flattened against the wall
    E = [('ELLIPSOID', (0, 0.0, -0.06), 0.2, (1.15, 0.55, 1.0), 2), ('ELLIPSOID', (0, 0.0, 0.12), 0.1, (0.8, 0.5, 1.2), 2)]
    for sx in (-1, 1): E += [('ELLIPSOID', (sx * 0.1, 0.0, 0.06), 0.065, (1.0, 0.65, 0.8), 2), ('ELLIPSOID', (sx * 0.15, 0.0, -0.16), 0.07, (1.0, 0.65, 0.8), 2)]
    sk = meta(E, res=0.012, name='skin')
    displace(sk, 0.007, 0.05, seed=1571); q = G((0, 1.2, 0.08)); xform(sk, (q.x, q.y, q.z), (0, 0, 0), (1.0, 1.0, 1.1))
    cord = [pathG([(0, 1.58, 0.1), (0.03, 1.48, 0.1), (0, 1.4, 0.09)], 0.008, 5, 'c'), pathG([(0, 1.58, 0.1), (-0.04, 1.47, 0.08), (-0.02, 1.38, 0.08)], 0.008, 5, 'c')]
    return dict(wood=peg, hide=sk, cord=join(cord, 'cord'))

# ======================================================================================================== driver
if __name__ == '__main__':
    job = json.load(open(sys.argv[sys.argv.index('--') + 1]))
    outd = job['out_dir']; os.makedirs(outd, exist_ok=True); report = {}
    for id_ in job['ids']:
        t0 = time.time(); A = FILL[id_]
        clear()
        parts = A['fn']()
        lod0 = {}; lod1 = {}; lod2 = {}
        tgt = job.get('targets', {}).get(id_, {})
        for p, ob in parts.items():
            triangulate(ob); weld(ob)
            t = tgt.get(p)
            if t: decimate(ob, t[0])
            lod0[p] = ob
            o1 = copy(ob, ob.name + '_1'); decimate(o1, t[1] if t else max(8, int(tris(ob) * A['lod1']))); lod1[p] = o1
            o2 = copy(o1, ob.name + '_2'); decimate(o2, t[2] if t and len(t) > 2 else (tris(o1) if tris(o1) < 300 else max(100, int(tris(o1) * 0.3)))); lod2[p] = o2
        if A['ao']:
            levels = [lod0, lod1, lod2]
            for i, L in enumerate(levels):
                for j, M in enumerate(levels):
                    for o in M.values(): o.hide_render = j != i
                bake_ao(list(L.values()), ground=A['ground'])
            for L in levels:
                for o in L.values(): o.hide_render = False
        pts = [o.matrix_world @ Vector(c) for o in lod0.values() for c in o.bound_box]
        box_ = [[min(p.x for p in pts), min(p.z for p in pts), min(-p.y for p in pts)], [max(p.x for p in pts), max(p.z for p in pts), max(-p.y for p in pts)]]
        tr = export(os.path.join(outd, 'fill_' + id_ + '.glb'), [lod0, lod1, lod2], ao=A['ao'])
        report['fill_' + id_] = dict(tris=tr, box=box_, seconds=round(time.time() - t0, 1), ao=A['ao'])
        print('[fill_props]', id_, json.dumps(report['fill_' + id_]), flush=True)
    json.dump(report, open(os.path.join(outd, 'fill_props.out.json'), 'w'), indent=1)
