# The project's modelled props (session 12, D-325): every prop, furnishing, door fitting, fire object and held or worked
# object of the world that no CC0 scan covers, modelled in Blender from the numbers of the builders that place them (SITE_SPEC
# rows, the builders' own dimensions) and written to public/models/props/<id>.glb as levels lod0 / lod1 of named parts
# (lod<i>__<part>): each builder draws each part with its own surface or vertex colour, as it drew its procedural stand-in.
# Headless: blender -b --factory-startup --python tools/blender/model_props.py -- <jobs.json>
#   jobs.json: { "out_dir": ..., "ids": [...] }  -> <out_dir>/<id>.glb and <out_dir>/model_props.out.json (triangles per
#   level and part, the model's box in the game's axes)
# Every form is C (reconstruction) unless its builder's note says otherwise; the sources of each form are in its docstring.
# Axes: Blender's, z up; the game's +z (front) is Blender's -y (see lib/mp_lib.py).
import bpy, sys, os, json, math, random, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'lib'))
from mp_lib import *  # noqa
from mathutils import Vector, Matrix

ASSETS = {}
def asset(ao=True, ground=True, lod1=0.35):
    """register a modelling function: it returns {part: object} at lod0 detail and optionally per-part lod1 targets"""
    def reg(f): ASSETS[f.__name__[2:]] = dict(fn=f, ao=ao, ground=ground, lod1=lod1); return f
    return reg

# ======================================================================================================== palace furnishings
F = dict(couch=dict(len=2.0, w=0.85, h=0.55, head=0.9, leg_r=0.045, mattress=0.12), table=dict(len=0.9, w=0.55, h=0.6), stool=dict(w=0.45, h=0.45),
         footstool=dict(len=0.55, w=0.35, h=0.12), burner=dict(h=0.95, r=0.18), lamp=dict(h=1.3, r=0.16), chest=dict(len=1.0, w=0.55, h=0.55),
         carpet=dict(thick=0.012), roll=dict(r=0.13, len=2.0), hanging=dict(w=2.0, h=3.0, rod_r=0.025, thick=0.006), canopy=dict(w=4.0, d=4.4, h=3.4, fringe=0.3, pole_r=0.06),
         mat=dict(size=(2.0, 1.2), thick=0.01))  # SITE_SPEC global.r_palace_furnishings (the same numbers; the builder fits to its own)

def couch_legs(L, W, top, r, paws=False):
    legs = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            if paws:
                p = lion_paw(r * 1.25, 'paw'); leg = turned_leg(top - 0.07, r, 14, 'leg'); xform(leg, (0, 0, 0.07))
                legs.append(join([p, leg]))
            else:  # the Assyrian couch leg: an inverted pine-cone foot, rings, a volute capital under the rail (analogy, C)
                p = [(0.0, 0), (r * 0.55, 0), (r * 1.25, 0.12 * top), (r * 1.4, 0.2 * top), (r * 0.9, 0.24 * top), (r * 1.15, 0.28 * top), (r * 0.75, 0.32 * top),
                     (r * 0.72, 0.62 * top), (r * 1.1, 0.66 * top), (r * 0.8, 0.7 * top), (r * 0.8, 0.8 * top), (r * 1.5, 0.9 * top), (r * 1.45, top), (0.0, top)]
                leg = lathe(p, 14, 'leg')
            xform(leg, (sx * (L / 2 - 0.06), sy * (W / 2 - 0.06), 0))
            legs.append(leg)
    return legs

@asset()
def a_couch():
    """a couch 'richly covered' (Herodotus 9.80/9.82: gilded or silvered couches): after the high couch of the Assurbanipal
    garden relief (analogy): turned legs with inverted pine-cone feet, a rail frame with slats, a raised head end with a
    scrolled top at +x, a soft mattress and a bolster at the head (C)"""
    C = F['couch']; L, W, H, head = C['len'], C['w'], C['h'], C['head']; fy = H - C['mattress'] - 0.1
    metal = couch_legs(L, W, fy, C['leg_r'])
    for sy in (-1, 1): metal.append(box(L, 0.05, 0.1, (0, sy * (W / 2 - 0.025), fy), bevel=0.008))
    for sx in (-1, 1): metal.append(box(0.05, W - 0.1, 0.1, (sx * (L / 2 - 0.025), 0, fy), bevel=0.008))
    for i in range(7): metal.append(box(0.06, W - 0.1, 0.02, (-L / 2 + 0.15 + i * (L - 0.3) / 6, 0, fy + 0.07), bevel=0.004))
    # the head end: a board rising from the rail, leaning outward a little, with a rounded roll along its top
    hb = box(0.05, W - 0.04, head - fy - 0.04, (L / 2 - 0.035, 0, fy + 0.02), 'head', bevel=0.01)
    for v in hb.data.vertices: v.co.x += 0.06 * ((v.co.z - fy) / (head - fy)) ** 2
    metal.append(hb)
    metal.append(sweep([(L / 2 + 0.03, -W / 2 + 0.01, head - 0.03), (L / 2 + 0.03, W / 2 - 0.01, head - 0.03)], 0.035, 14, 'scroll'))
    mat = box(L - 0.1, W - 0.04, C['mattress'], (-0.04, 0, fy + 0.1), 'mattress', bevel=0.045, segs=4)
    subdiv(mat, 1); displace(mat, 0.012, 0.25, seed=3)
    # the mattress sags a little in the middle and is buttoned (tufts) in two rows
    for v in mat.data.vertices:
        if v.co.z > fy + 0.1 + C['mattress'] * 0.6: v.co.z -= 0.015 * math.cos(math.pi * v.co.x / (L - 0.1)) * math.cos(math.pi * v.co.y / (W - 0.04))
    bol = lathe([(0.0, -W / 2 + 0.06), (0.05, -W / 2 + 0.05), (0.09, -W / 2 + 0.1), (0.1, -W / 2 + 0.2), (0.1, W / 2 - 0.2), (0.09, W / 2 - 0.1), (0.05, W / 2 - 0.05), (0.0, W / 2 - 0.06)], 16, 'bolster')
    xform(bol, (L / 2 - 0.2, 0, H + 0.08), (math.pi / 2, 0, 0))
    displace(bol, 0.006, 0.1, seed=4)
    return dict(metal=join(metal, 'metal'), mattress=mat, bolster=bol)

@asset()
def a_couch_covered():
    """a couch under a linen cover while the court is away: the cover draped by Blender's cloth solver over the couch's
    body and head end, hanging to a hand's breadth off the floor (C)"""
    C = F['couch']; L, W, H, head = C['len'], C['w'], C['h'], C['head']; fy = H - C['mattress'] - 0.1
    legs = couch_legs(L, W, fy, C['leg_r'])
    body = box(L, W, H - fy, (0, 0, fy), 'body', bevel=0.03)
    hd = box(0.12, W, head - fy, (L / 2 - 0.06, 0, fy), 'hd', bevel=0.03)
    cl = grid(L + 0.6, W + 0.6, 70, 34, 'cover', z=head + 0.08)
    drape(cl, [body, hd] + legs, frames=70, mass=0.25, bending=0.2, thickness=0.006)
    bpy.data.objects.remove(body, do_unlink=True); bpy.data.objects.remove(hd, do_unlink=True)
    solidify(cl, 0.004, 1)
    return dict(metal=join(legs, 'metal'), cover=cl)

@asset()
def a_table():
    """a small table, gilded or silvered ('tables of gold and silver', Herodotus 9.82): a top with a moulded edge on four
    turned legs with lion's-paw feet and stretchers (the table beside the couch on the Assurbanipal relief: analogy; C)"""
    T = F['table']; L, W, H = T['len'], T['w'], T['h']
    parts = [box(L, W, 0.04, (0, 0, H - 0.04), bevel=0.012, segs=3)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * (L / 2 - 0.06), sy * (W / 2 - 0.06)
            p = lion_paw(0.035); leg = turned_leg(H - 0.04 - 0.045, 0.022, 12); xform(leg, (0, 0, 0.045))
            parts.append(xform(join([p, leg]), (x, y, 0)))
    for sy in (-1, 1): parts.append(sweep([(-L / 2 + 0.06, sy * (W / 2 - 0.06), 0.16), (L / 2 - 0.06, sy * (W / 2 - 0.06), 0.16)], 0.012, 8))
    parts.append(sweep([(0, -W / 2 + 0.06, 0.16), (0, W / 2 - 0.06, 0.16)], 0.011, 8))
    return dict(metal=join(parts, 'metal'))

@asset()
def a_stool():
    """a wooden stool: a slightly dished seat on four turned legs with stretchers (C)"""
    S = F['stool']; w, h = S['w'], S['h']
    seat = box(w, w, 0.05, (0, 0, h - 0.05), bevel=0.01, segs=3)
    for v in seat.data.vertices:
        if v.co.z > h - 0.01: v.co.z -= 0.012 * (1 - (2 * v.co.x / w) ** 2) * (1 - (2 * v.co.y / w) ** 2)
    parts = [seat]
    for sx in (-1, 1):
        for sy in (-1, 1):
            leg = lathe([(0.0, 0), (0.022, 0), (0.02, 0.1), (0.026, 0.14), (0.018, 0.2), (0.017, h - 0.12), (0.024, h - 0.09), (0.02, h - 0.05), (0.0, h - 0.05)], 10, 'leg')
            parts.append(xform(leg, (sx * (w / 2 - 0.04), sy * (w / 2 - 0.04), 0)))
    for sx in (-1, 1): parts.append(sweep([(sx * (w / 2 - 0.04), -w / 2 + 0.04, 0.14), (sx * (w / 2 - 0.04), w / 2 - 0.04, 0.14)], 0.011, 6))
    for sy in (-1, 1): parts.append(sweep([(-w / 2 + 0.04, sy * (w / 2 - 0.04), 0.2), (w / 2 - 0.04, sy * (w / 2 - 0.04), 0.2)], 0.011, 6))
    return dict(wood=join(parts, 'wood'))

@asset()
def a_footstool():
    """a footstool (the audience reliefs' footstool before the throne, TREAS-AUD: B; C form): a board with a moulded edge
    on four short bull's legs ending in hooves"""
    S = F['footstool']; L, W, h = S['len'], S['w'], S['h']
    parts = [box(L, W, 0.06, (0, 0, h - 0.06), bevel=0.012, segs=3)]
    for sx in (-1, 1):
        for sy in (-1, 1):
            hf = hoof(0.026); leg = lathe([(0.0, 0.03), (0.018, 0.03), (0.02, h - 0.06), (0.0, h - 0.06)], 8)
            parts.append(xform(join([hf, leg]), (sx * (L / 2 - 0.05), sy * (W / 2 - 0.05), 0)))
    return dict(frame=join(parts, 'frame'))

@asset()
def a_burner():
    """an incense burner as before the king on the audience reliefs (TREAS-AUD: B): a tall bronze stand on three lion's
    paws, a slender shaft with collars, a bowl, and a stepped conical lid with crenellated tiers and a knob; size C"""
    B = F['burner']; h, r = B['h'], B['r']
    parts = []
    for k in range(3):
        a = TAU * k / 3 + math.pi / 2; p = lion_paw(r * 0.28, 'paw')
        xform(p, (math.cos(a) * r * 0.62, math.sin(a) * r * 0.62, 0), (0, 0, a + math.pi / 2)); parts.append(p)
    prof = [(0.0, 0.05), (r * 0.9, 0.05), (r * 0.95, 0.07), (r * 0.7, 0.09), (r * 0.45, 0.12), (r * 0.2, h * 0.17), (r * 0.16, h * 0.2), (r * 0.24, h * 0.22), (r * 0.14, h * 0.24),
            (r * 0.12, h * 0.42), (r * 0.2, h * 0.44), (r * 0.12, h * 0.46), (r * 0.11, h * 0.6), (r * 0.22, h * 0.63), (r * 0.5, h * 0.66), (r * 0.9, h * 0.7), (r * 1.0, h * 0.73), (r * 0.96, h * 0.745),
            (r * 0.82, h * 0.75), (r * 0.82, h * 0.775), (r * 0.62, h * 0.79), (r * 0.62, h * 0.83), (r * 0.44, h * 0.845), (r * 0.44, h * 0.885), (r * 0.27, h * 0.9), (r * 0.27, h * 0.93),
            (r * 0.1, h * 0.95), (r * 0.12, h * 0.975), (r * 0.08, h * 0.995), (0.0, h)]
    parts.append(lathe(prof, 28, 'stand'))
    # crenellated tiers: stepped merlons round each tier's rim (the Persian stepped crenellation, as on the parapets; C)
    for zr, rr, n in ((h * 0.775, r * 0.82, 16), (h * 0.83, r * 0.62, 12), (h * 0.885, r * 0.44, 9)):
        for k in range(n):
            a = TAU * (k + 0.5) / n
            m = box(0.018, 0.012, 0.02, (0, 0, 0), bevel=0.002); m2 = box(0.01, 0.012, 0.012, (0, 0, 0.02), bevel=0.001)
            parts.append(xform(join([m, m2]), (math.cos(a) * rr, math.sin(a) * rr, zr), (0, 0, a + math.pi / 2)))
    return dict(bronze=join(parts, 'bronze'))

@asset()
def a_lamp_stand():
    """a bronze lamp stand: three legs curving out to lion's paws, a shaft with collars, a dish at the top, and a clay oil
    lamp (an open saucer with a pinched spout) on it; unlit (C; candles are blocklisted)"""
    Ls = F['lamp']; h, r = Ls['h'], Ls['r']
    parts = []
    for k in range(3):
        a = TAU * k / 3
        pts = [(math.cos(a) * r * (0.1 + 0.9 * t), math.sin(a) * r * (0.1 + 0.9 * t), 0.3 - 0.26 * t ** 0.8) for t in (0, 0.25, 0.5, 0.75, 1.0)]
        parts.append(sweep(pts, [0.016, 0.014, 0.012, 0.012, 0.013], 8, 'legk'))
        p = lion_paw(0.022); parts.append(xform(p, (math.cos(a) * r, math.sin(a) * r, 0), (0, 0, a + math.pi / 2)))
    prof = [(0.0, 0.26), (0.03, 0.26), (0.034, 0.3), (0.018, 0.33), (0.015, h * 0.5), (0.026, h * 0.52), (0.015, h * 0.54), (0.013, h - 0.06), (0.024, h - 0.04), (0.02, h - 0.02),
            (r * 0.7, h - 0.005), (r * 0.75, h + 0.012), (r * 0.7, h + 0.014), (r * 0.66, h + 0.004), (0.0, h + 0.004)]
    parts.append(lathe(prof, 20, 'shaft'))
    lamp = vessel([(0.02, 0), (0.05, 0.004), (0.065, 0.02), (0.068, 0.03)], 0.005, 20, 'lamp', 0.02, seed=5)
    for v in lamp.data.vertices:  # the pinched spout toward +x: the rim drawn out and in
        a = math.atan2(v.co.y, v.co.x)
        if abs(a) < 0.7 and v.co.z > 0.012:
            k = (1 - abs(a) / 0.7) ** 2; v.co.x += 0.035 * k; v.co.y *= 1 - 0.7 * k
    xform(lamp, (0, 0, h + 0.004))
    return dict(bronze=join(parts, 'bronze'), clay=lamp)

@asset()
def a_chest():
    """a wooden chest of boards with bronze bands: the sides of three boards each, corner posts running down to short feet, a
    lid of boards overhanging a little, two bronze bands round body and lid with round-headed studs (C)"""
    C = F['chest']; L, W, H = C['len'], C['w'], C['h']; lid = 0.06; body_h = H - lid
    wood = []
    nb = 3; bh = (body_h - 0.04) / nb
    for i in range(nb):
        z = 0.04 + i * bh
        for sy in (-1, 1): wood.append(box(L - 0.08, 0.022, bh - 0.004, (0, sy * (W / 2 - 0.011), z + 0.002), bevel=0.004))
        for sx in (-1, 1): wood.append(box(0.022, W - 0.08, bh - 0.004, (sx * (L / 2 - 0.011), 0, z + 0.002), bevel=0.004))
    for sx in (-1, 1):
        for sy in (-1, 1): wood.append(box(0.05, 0.05, body_h, (sx * (L / 2 - 0.025), sy * (W / 2 - 0.025), 0), bevel=0.006))
    wood.append(box(L - 0.06, W - 0.06, 0.02, (0, 0, 0.05), bevel=0.003))
    lidp = []
    for i in range(4): lidp.append(box((L + 0.04), (W + 0.04) / 4 - 0.004, lid, (0, -(W + 0.04) / 2 + (i + 0.5) * (W + 0.04) / 4, body_h), bevel=0.006, segs=2))
    br = []
    for x in (-0.3 * L, 0.3 * L):
        br.append(box(0.04, W + 0.012, body_h - 0.01, (x, 0, 0.01), bevel=0.003))
        br.append(box(0.04, W + 0.052, 0.012, (x, 0, H - 0.004), bevel=0.003))
        for sy in (-1, 1):
            for z in (0.12, 0.3, 0.44):
                s = lathe([(0.0, 0), (0.012, 0), (0.011, 0.004), (0.006, 0.008), (0.0, 0.009)], 8, 'stud')
                br.append(xform(s, (x, sy * (W / 2 + 0.006), z), (sy * -math.pi / 2, 0, 0)))
    return dict(wood=join(wood, 'wood'), lid=join(lidp, 'lid'), bronze=join(br, 'bronze'))

@asset(ao=False, ground=False)
def a_carpet():
    """a knotted-pile carpet (after the Pazyryk carpet, c. 400 BCE, B for the craft): the pile slab a unit square (the
    builder scales it to each carpet) with rounded, slightly rolled edges, and the warp ends knotted into a fringe of
    tassels beyond the two short ends. The pile itself is the carpet's normal map (carpet_pile_n.png)"""
    t = F['carpet']['thick']
    s = box(1.0, 1.0, t, (0, 0, 0), 'pile', bevel=t * 0.45, segs=3)
    fr = []
    n = 44
    for sx in (-1, 1):
        for k in range(n):
            y = -0.49 + 0.98 * (k + 0.5) / n; ln = 0.05 + 0.012 * math.sin(k * 2.3 + sx)
            pts = [(sx * 0.498, y, t * 0.4), (sx * (0.5 + ln * 0.5), y + 0.002 * math.sin(k), t * 0.25), (sx * (0.5 + ln), y + 0.004 * math.sin(k * 1.7), 0.0015)]
            fr.append(sweep(pts, [0.0035, 0.0028, 0.0022], 4, 'tassel', scale=(1.0, 0.6)))
    return dict(pile=s, fringe=join(fr, 'fringe'))

@asset(ground=True)
def a_roll():
    """a carpet or hanging rolled for store: the cloth wound in a spiral (visible at both ends), the roll a little flattened
    by its own weight and sagging; length along x, 1 m long and 1 m across (the builder fits it to r and len) (C)"""
    turns, r0, r1, th = 3.2, 0.12, 0.5, 0.06
    N = int(turns * 24)
    ph = -math.pi / 2 - 0.35 - TAU * turns  # the outer end comes to rest under the roll, a little to the front
    outer = [((r0 + (r1 - r0) * i / N) * math.cos(TAU * turns * i / N + ph), (r0 + (r1 - r0) * i / N) * math.sin(TAU * turns * i / N + ph)) for i in range(N + 1)]
    inner = [((r0 - th + (r1 - r0) * i / N) * math.cos(TAU * turns * i / N + ph), (r0 - th + (r1 - r0) * i / N) * math.sin(TAU * turns * i / N + ph)) for i in range(N + 1)]
    poly = outer + list(reversed(inner))
    import bmesh
    bm = bmesh.new(); segs = 6; rings = []
    for j in range(segs + 1):
        x = -0.5 + j / segs; sag = 0.02 * math.sin(math.pi * j / segs)
        rings.append([bm.verts.new((x, py * 0.5, pz * 0.44 + 0.5 * 0.44 - sag + 0.02)) for (py, pz) in poly])
    M = len(poly)
    for j in range(segs):
        for k in range(M):
            bm.faces.new((rings[j][k], rings[j][(k + 1) % M], rings[j + 1][(k + 1) % M], rings[j + 1][k]))
    for ring in (rings[0], rings[-1]):
        f = bm.faces.new(ring)
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4], quad_method='BEAUTY', ngon_method='EAR_CLIP')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = from_bm(bm, 'roll'); sharp(ob, 50)
    return dict(textile=ob)

@asset()
def a_hanging():
    """a woven wall hanging on a gilded rod ('gaily coloured hangings', Herodotus 9.82): the cloth falling in soft vertical
    folds from rings on the rod, three woven bands, a knotted fringe at the foot; the cloth's top at z = h (the builder sets
    its height), its back 5 cm off the wall (y = 0 is the cloth's mean plane; the room is toward -y) (C)"""
    H = F['hanging']; w, h = H['w'], H['h']
    nx, nz = 60, 30
    def fold(x, z):  # folds deepen toward the foot; the top gathered at the rings
        k = 0.35 + 0.65 * (1 - z / h)
        return -(0.018 * math.sin(TAU * 6.5 * x / w) + 0.008 * math.sin(TAU * 13 * x / w + 1.3)) * k
    cl = grid(w, h, nx, nz, 'cloth');
    for v in cl.data.vertices:
        x, z0 = v.co.x, v.co.y + h / 2; v.co = Vector((x, fold(x, z0), z0 - 0.012 * (1 - z0 / h) * math.cos(TAU * 3 * x / w)))
    solidify(cl, H['thick'], 0)
    bands = []
    for f in (0.12, 0.5, 0.88):
        zc = h * (1 - f); b = grid(w, h * 0.06, nx, 2, 'band')
        for v in b.data.vertices:
            x, z0 = v.co.x, v.co.y + zc; v.co = Vector((x, fold(x, z0) - H['thick'] * 0.5 - 0.0015, z0 - 0.012 * (1 - z0 / h) * math.cos(TAU * 3 * x / w)))
        bands.append(b)
    for k in range(70):  # the fringe
        x = -w / 2 + w * (k + 0.5) / 70; z0 = 0.0 - 0.012 * math.cos(TAU * 3 * x / w)
        bands.append(sweep([(x, fold(x, 0), z0), (x + 0.004 * math.sin(k), fold(x, 0) - 0.004, z0 - 0.045), (x + 0.006 * math.sin(k * 1.3), fold(x, 0) - 0.006, z0 - 0.085)], [0.004, 0.0035, 0.003], 4, 'fr'))
    rod = [sweep([(-w / 2 - 0.1, 0, h + 0.03), (w / 2 + 0.1, 0, h + 0.03)], H['rod_r'], 12, 'rod')]
    for sx in (-1, 1):
        rod.append(xform(lathe([(0.0, 0), (0.03, 0.004), (0.04, 0.03), (0.02, 0.05), (0.028, 0.065), (0.0, 0.08)], 12, 'fin'), (sx * (w / 2 + 0.1), 0, h + 0.03), (0, sx * math.pi / 2, 0)))
    for k in range(8):
        x = -w / 2 + 0.1 + (w - 0.2) * k / 7
        tor = sweep([(x + 0.03 * math.cos(a), 0.03 * math.sin(a) * 0.3, h + 0.03 + 0.035 * math.sin(a) - 0.01) for a in [TAU * i / 12 for i in range(13)]], 0.004, 5, 'ring', caps=False)
        rod.append(tor)
    return dict(cloth=cl, band=join(bands, 'band'), rod=join(rod, 'rod'))

@asset()
def a_canopy():
    """the canopy over the king's place (the canopy over the king on the audience reliefs: B): four gilded poles on bell bases
    with knob finials, the cloth roof sagging between them, a deep fringed band all round with tassels (C)"""
    C = F['canopy']; w, d, h, fr, pr = C['w'], C['d'], C['h'], C['fringe'], C['pole_r']
    gilt = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            p = lathe([(0.0, 0), (pr * 2.6, 0), (pr * 2.4, 0.04), (pr * 1.6, 0.1), (pr * 1.2, 0.18), (pr * 1.0, 0.3), (pr * 0.95, h - 0.1), (pr * 1.5, h - 0.05), (pr * 1.5, h + 0.02),
                       (pr * 1.1, h + 0.05), (pr * 1.6, h + 0.12), (pr * 0.6, h + 0.2), (0.0, h + 0.22)], 14, 'pole')
            gilt.append(xform(p, (sx * w / 2, sy * d / 2, 0)))
    roof = grid(w + 0.1, d + 0.1, 40, 44, 'roof', z=h)
    for v in roof.data.vertices:
        v.co.z = h + 0.01 - 0.09 * math.cos(math.pi * v.co.x / (w + 0.1)) * math.cos(math.pi * v.co.y / (d + 0.1))
    solidify(roof, 0.006, 0)
    band = []
    for (x0, y0, x1, y1) in ((-1, -1, 1, -1), (1, -1, 1, 1), (1, 1, -1, 1), (-1, 1, -1, -1)):
        ax, ay = x0 * (w / 2 + 0.05), y0 * (d / 2 + 0.05); bx, by = x1 * (w / 2 + 0.05), y1 * (d / 2 + 0.05)
        L = math.hypot(bx - ax, by - ay); n = int(L / 0.04)
        b = grid(L, fr * 0.7, n, 3, 'b')
        ang = math.atan2(by - ay, bx - ax)
        for v in b.data.vertices:
            u, z = v.co.x, v.co.y
            v.co = Vector(((ax + bx) / 2 + u * math.cos(ang), (ay + by) / 2 + u * math.sin(ang), h + 0.01 - fr * 0.35 + z))
            nx_, ny_ = math.sin(ang), -math.cos(ang); off = 0.006 * math.sin(TAU * u / 0.3)
            v.co.x += nx_ * off; v.co.y += ny_ * off
        band.append(b)
        for k in range(int(L / 0.08)):
            u = -L / 2 + (k + 0.5) * 0.08; px, py = (ax + bx) / 2 + u * math.cos(ang), (ay + by) / 2 + u * math.sin(ang)
            band.append(xform(lathe([(0.0, 0), (0.012, 0.01), (0.009, 0.06), (0.004, fr * 0.3), (0.006, fr * 0.33), (0.0, fr * 0.36)], 6, 'tas'), (px, py, h + 0.01 - fr)))
    return dict(gilt=join(gilt, 'gilt'), cloth=roof, band=join(band, 'band'))

@asset(ground=True)
def a_mat():
    """a reed mat: split reeds side by side along x, twined across with five cords (C); 2.0 x 1.2 m, 1 cm thick"""
    Sx, Sy = F['mat']['size']; t = F['mat']['thick']
    reeds = []; n = int(Sy / 0.012)
    for i in range(n):
        y = -Sy / 2 + (i + 0.5) * Sy / n; wob = 0.004 * math.sin(i * 1.7)
        reeds.append(sweep([(-Sx / 2 + wob, y, t * 0.45), (0, y + 0.001 * math.sin(i), t * 0.5), (Sx / 2 - wob, y, t * 0.45)], 0.0055, 5, 'reed', scale=(1.0, 0.8)))
    for k in range(5):
        x = -Sx / 2 + 0.12 + k * (Sx - 0.24) / 4
        reeds.append(sweep([(x, -Sy / 2, t * 0.95), (x, Sy / 2, t * 0.95)], 0.0022, 4, 'cord'))
    return dict(matting=join(reeds, 'matting'))

@asset()
def a_throne():
    """the king's throne and footstool at an audience (court setting; the Treasury audience relief, TREAS-AUD: B): a
    high-backed chair on turned legs with rings, lion's-paw feet on low drums, stretchers between the legs, the back upright
    with knob finials; the footstool before it on four bull's legs with hooves; a cushion on the seat. In the performer's
    frame (origin under the seated king's root, the seat behind, the footstool in front); the sizes the builder's (seat top
    0.525 m, footstool 0.105 m: fitted to the enthroned pose, C)"""
    seatY = 0.525; g = []
    g.append(box(0.62, 0.46, 0.05, (0, 0, seatY - 0.09 - 0.025 + 0.025), bevel=0.01, segs=3))
    g.append(box(0.6, 0.045, 0.82, (0, 0.245, seatY - 0.04), bevel=0.012, segs=3))
    for x in (-0.29, 0.29):
        g.append(xform(lathe([(0.0, 0), (0.022, 0), (0.026, 0.03), (0.014, 0.05), (0.03, 0.08), (0.0, 0.1)], 12, 'fin'), (x, 0.245, seatY + 0.78)))
    for x in (-0.27, 0.27):
        for y in (-0.2, 0.2):
            drum = lathe([(0.0, 0), (0.05, 0), (0.052, 0.012), (0.044, 0.02), (0.0, 0.02)], 14, 'drum')
            paw = lion_paw(0.034); xform(paw, (0, 0, 0.02))
            leg = turned_leg(seatY - 0.09 - 0.07, 0.024, 14); xform(leg, (0, 0, 0.07))
            g.append(xform(join([drum, paw, leg]), (x, y, 0)))
    for y in (-0.2, 0.2): g.append(sweep([(-0.27, y, 0.2), (0.27, y, 0.2)], 0.014, 8))
    for x in (-0.27, 0.27): g.append(sweep([(x, -0.2, 0.24), (x, 0.2, 0.24)], 0.013, 8))
    # the footstool
    g.append(box(0.56, 0.36, 0.05, (0, -0.37, 0.055), bevel=0.01, segs=3))
    for x in (-0.24, 0.24):
        for y in (-0.23, -0.51):
            hf = hoof(0.024); leg = lathe([(0.0, 0.028), (0.016, 0.028), (0.018, 0.058), (0.0, 0.058)], 8)
            g.append(xform(join([hf, leg]), (x, y, 0)))
    cush = box(0.6, 0.43, 0.05, (0, 0, seatY - 0.045), 'cushion', bevel=0.02, segs=3); subdiv(cush, 1); displace(cush, 0.006, 0.15, seed=9)
    return dict(gilt=join(g, 'gilt'), cushion=cush)

# ======================================================================================================== doors (unit forms)
@asset(ao=True, ground=False, lod1=0.5)
def a_door_leaf():
    """a door leaf as a unit box (the instanced leaf is scaled to each doorway's length, height and thickness): five
    vertical planks with V-joints on both faces, each plank's face a little proud or sunk, the arrises chamfered, the end
    grain at top and bottom (C; timber species unknown)"""
    n = 5; parts = []
    for i in range(n):
        x0 = -0.5 + i / n; wdt = 1 / n
        off = 0.03 * math.sin(i * 2.7 + 0.4)
        p = box(wdt - 0.004, 1.0 + off * 0.2, 1.0, (x0 + wdt / 2, 0, -0.5), bevel=0.025, segs=1, base=True)
        for v in p.data.vertices: v.co.y *= 1.0  # thickness along y
        parts.append(p)
    ob = join(parts, 'leaf')
    # unit box: x = length, y = thickness, z = height (three: x, -z, y -> the instanced box's x, y(height), z(thickness))
    for v in ob.data.vertices: v.co.y = max(-0.5, min(0.5, v.co.y))
    return dict(leaf=ob)

@asset(ao=False, ground=False)
def a_door_band():
    """a bronze band across a leaf as a unit box: a strap with rounded edges and a raised rib along each edge (C)"""
    b = box(1.0, 1.0, 1.0, (0, 0, -0.5), 'band', bevel=0.12, segs=3)
    return dict(band=b)

@asset(ao=False, ground=False)
def a_door_boss():
    """a bronze boss (a nail head) as a unit: a dome on a flat collar, facing the game's +z (Blender -y), base at 0 (C)"""
    ob = lathe([(0.0, 0), (1.0, 0), (1.0, 0.12), (0.86, 0.2), (0.8, 0.42), (0.66, 0.7), (0.42, 0.9), (0.14, 0.99), (0.0, 1.0)], 14, 'boss')
    xform(ob, (0, 0, 0), (math.pi / 2, 0, 0))
    return dict(boss=ob)

@asset(ao=False, ground=False)
def a_door_shoe():
    """the bronze shoe of a pivot post as a unit cylinder (r 1, height 1, centred): a sleeve with a lip at each end and a
    ring of rivets (C)"""
    ob = lathe([(0.0, -0.5), (1.0, -0.5), (1.08, -0.46), (1.08, -0.36), (1.0, -0.32), (1.0, 0.32), (1.08, 0.36), (1.08, 0.46), (1.0, 0.5), (0.0, 0.5)], 20, 'shoe')
    parts = [ob]
    for k in range(8):
        a = TAU * k / 8; r = lathe([(0.0, 0), (0.1, 0), (0.08, 0.05), (0.0, 0.07)], 6, 'riv')
        parts.append(xform(r, (math.cos(a) * 0.99, math.sin(a) * 0.99, 0), (0, math.pi / 2, a)))
    return dict(shoe=join(parts, 'shoe'))

@asset(ao=False, ground=False)
def a_door_post():
    """a pivot post as a unit cylinder: hewn, its sides dressed in long adze facets, the top rounded (C)"""
    seg = 10; prof = [(0.0, -0.5), (1.0, -0.5), (1.0, 0.49), (0.9, 0.5), (0.0, 0.5)]
    ob = lathe(prof, seg, 'post')
    for v in ob.data.vertices:
        a = math.atan2(v.co.y, v.co.x); k = 1 + 0.035 * math.sin(a * 3 + 1.1) + 0.02 * math.sin(a * 7)
        v.co.x *= k; v.co.y *= k
    return dict(post=sharp(ob, 30))

# ======================================================================================================== fire objects
def gv(x, y, z):
    """a point given in the game's axes (x, y up, z front) in Blender's"""
    return (x, -z, y)

def stone_lump(r, seed, name='stone', flat=0.7):
    """a field stone: an irregular lump (metaballs, then displaced), r its half size"""
    rnd = random.Random(seed); e = []
    for k in range(4):
        e.append(('ELLIPSOID', (rnd.uniform(-0.35, 0.35) * r, rnd.uniform(-0.35, 0.35) * r, rnd.uniform(0.1, 0.4) * r * flat), r * rnd.uniform(0.55, 0.8), (rnd.uniform(0.8, 1.3), rnd.uniform(0.8, 1.2), flat * rnd.uniform(0.8, 1.1)), 2))
    ob = meta(e, res=r / 6, name=name)
    displace(ob, r * 0.12, r * 0.6, seed=seed)
    for v in ob.data.vertices:
        if v.co.z < 0: v.co.z *= 0.3
    return ob

@asset()
def a_brazier():
    """a brazier after the incense stands of the audience reliefs (B type): a bronze tripod on lion's paws, a shaft with
    collars and a wide shallow bowl with a rolled rim, its top at 1.02 m (fire.ts LIFT), charcoal heaped in it (C)"""
    top = 1.02; parts = []
    for k in range(3):
        a = TAU * k / 3 + 0.3
        pts = [(math.cos(a) * 0.04, math.sin(a) * 0.04, 0.32), (math.cos(a) * 0.12, math.sin(a) * 0.12, 0.2), (math.cos(a) * 0.19, math.sin(a) * 0.19, 0.08)]
        parts.append(sweep(pts, [0.018, 0.016, 0.015], 8, 'leg'))
        parts.append(xform(lion_paw(0.028), (math.cos(a) * 0.2, math.sin(a) * 0.2, 0), (0, 0, a + math.pi / 2)))
    prof = [(0.0, 0.3), (0.05, 0.3), (0.06, 0.34), (0.035, 0.37), (0.03, 0.6), (0.05, 0.62), (0.03, 0.64), (0.028, 0.82), (0.06, 0.85), (0.2, 0.9), (0.33, 0.96), (0.37, top - 0.02),
            (0.375, top), (0.35, top + 0.005), (0.33, top - 0.015), (0.2, 0.93), (0.0, 0.91)]
    parts.append(lathe(prof, 28, 'bowl'))
    coal = meta([('ELLIPSOID', (0, 0, 0.93), 0.26, (1.0, 1.0, 0.25), 2)] + [('BALL', (0.18 * math.cos(k * 2.4), 0.18 * math.sin(k * 2.4), 0.96), 0.05, None, 2) for k in range(7)], res=0.02, name='coal')
    displace(coal, 0.015, 0.05, seed=11)
    return dict(bronze=join(parts, 'bronze'), coal=coal)

@asset(ground=False)
def a_torch():
    """a torch in its wall bracket, in fire.ts's frame (the base the bracket point on the wall, the shaft leaning out 0.25
    rad): a wooden shaft, its head wrapped in pitch-soaked tow bound with cord, an iron ring and arm to a wall plate (C)"""
    a = -0.25
    def rot(x, y, z): return gv(x, y * math.cos(a) - z * math.sin(a), y * math.sin(a) + z * math.cos(a))
    shaft = sweep([rot(0, -0.25, 0.1), rot(0, 0.05, 0.1), rot(0, 0.3, 0.1)], [0.022, 0.026, 0.028], 10, 'shaft')
    head = meta([('ELLIPSOID', rot(0, 0.3 + 0.02 * k, 0.1), 0.05 - 0.006 * abs(k - 2), (1.0, 1.0, 0.9), 2) for k in range(5)], res=0.008, name='head')
    displace(head, 0.006, 0.03, seed=12)
    br = [sweep([rot(0.036 * math.cos(t), 0.0, 0.1 + 0.036 * math.sin(t)) for t in [TAU * i / 14 for i in range(15)]], 0.006, 6, 'ring', caps=False),
          sweep([rot(0, 0.0, 0.064), rot(0, -0.02, 0.0)], 0.008, 6, 'arm'), box(0.09, 0.012, 0.14, gv(0, -0.07, -0.006), 'plate', bevel=0.003)]
    return dict(wood=shaft, head=head, bracket=join(br, 'bracket'))

@asset(ground=True)
def a_hearth():
    """a hearth: a ring of eleven field stones of their own sizes and tilts round a bed of ash with charcoal (C; fire.ts's
    ring of 0.45 m radius)"""
    st = []
    for i in range(11):
        a = TAU * i / 11 + 0.2 * math.sin(i * 7.1); h = lambda k: 0.5 + 0.5 * math.sin(i * 12.9898 + k * 78.233)
        s = stone_lump(0.15 * (0.9 + 0.4 * h(1)), 20 + i, flat=0.8)
        st.append(xform(s, (math.cos(a) * (0.45 + 0.04 * h(6)), math.sin(a) * (0.45 + 0.04 * h(6)), 0), (0.2 * (h(5) - 0.5), 0, a + h(4))))
    ash = lathe([(0.0, 0.035), (0.2, 0.03), (0.36, 0.015), (0.42, 0.0)], 20, 'ash', wobble=0.06, seed=3)
    displace(ash, 0.01, 0.08, seed=13)
    return dict(stone=join(st, 'stone'), ash=ash)

@asset(ground=True)
def a_oven():
    """a domed clay bread oven (fire.ts: 0.6 m radius): a thick dome of clay built up in coils, a mouth arched at the front
    (game +z), a vent at the top, the surface uneven and cracked (C)"""
    dome = lathe([(0.0, 0.0), (0.6, 0.0), (0.61, 0.08), (0.58, 0.25), (0.5, 0.42), (0.36, 0.54), (0.16, 0.6), (0.09, 0.61), (0.09, 0.64), (0.0, 0.64)], 36, 'dome', wobble=0.025, seed=4)
    subdiv(dome, 1); displace(dome, 0.012, 0.12, seed=14)
    for v in dome.data.vertices:  # coil courses: faint horizontal ridges
        v.co.x *= 1 + 0.006 * math.sin(v.co.z * 70); v.co.y *= 1 + 0.006 * math.sin(v.co.z * 70)
    # the mouth: an arched opening at the front (Blender -y), cut through the wall
    cut = sweep([(0, -0.8, 0.0), (0, -0.3, 0.0)], 0.2, 16, 'cut'); xform(cut, (0, 0, 0.0))
    for v in cut.data.vertices: v.co.z = max(v.co.z, -0.02) * 1.3 + 0.0
    boolean(dome, cut)
    return dict(mud=dome)

@asset(ground=True)
def a_lamp():
    """a clay oil lamp: an open saucer, its rim pinched into a spout for the wick (the ordinary lamp of the period: B type;
    C form), 0.13 m long"""
    lamp = vessel([(0.02, 0), (0.05, 0.004), (0.065, 0.02), (0.068, 0.03)], 0.005, 22, 'lamp', 0.02, seed=5)
    for v in lamp.data.vertices:
        a = math.atan2(v.co.y, v.co.x)
        if abs(a) < 0.7 and v.co.z > 0.012:
            k = (1 - abs(a) / 0.7) ** 2; v.co.x += 0.035 * k; v.co.y *= 1 - 0.7 * k
    return dict(clay=lamp)

# ======================================================================================================== vessels
def handle(p0, p1, bulge, r=0.009, seg=6, name='handle'):
    """a loop handle from p0 to p1 bowing out by `bulge` (a vector)"""
    P0, P1, B = Vector(p0), Vector(p1), Vector(bulge)
    pts = [P0.lerp(P1, t) + B * math.sin(math.pi * t) for t in [i / 8 for i in range(9)]]
    return sweep(pts, r, seg, name, scale=(1.0, 0.7))

@asset()
def a_jar_store():
    """a storage jar of the period's plain buff ware (MATERIAL_CULTURE storage jars: C): an ovoid body on a small flat base,
    a short neck and a thickened rolled rim, thrown by hand (the wobble), 0.9 m (the palace's jar; builders fit it)"""
    h = 0.9; r = 0.28
    o = [(0.1, 0.0), (0.16, 0.03), (0.24, 0.14), (0.28, 0.34), (0.275, 0.5), (0.24, 0.64), (0.17, 0.74), (0.11, 0.8), (0.1, 0.84), (0.115, 0.87), (0.12, 0.89), (0.11, h)]
    j = vessel(o, 0.014, 32, 'body', 0.012, seed=21)
    for v in j.data.vertices:  # faint throwing ridges on the shoulder
        rr = math.hypot(v.co.x, v.co.y)
        if 0.5 < v.co.z < 0.78 and rr > 0.12: k = 1 + 0.004 * math.sin(v.co.z * 90); v.co.x *= k; v.co.y *= k
    return dict(clay=j)

@asset()
def a_jar_water():
    """a water jar with two loop handles on the shoulder (C form), 0.46 m"""
    o = [(0.06, 0.0), (0.1, 0.02), (0.155, 0.12), (0.16, 0.22), (0.14, 0.31), (0.09, 0.37), (0.055, 0.4), (0.05, 0.43), (0.06, 0.45), (0.058, 0.46)]
    j = vessel(o, 0.008, 28, 'body', 0.012, seed=22)
    hs = [handle((s * 0.13, 0, 0.3), (s * 0.06, 0, 0.405), (s * 0.05, 0, 0.01), 0.011) for s in (-1, 1)]
    return dict(clay=join([j] + hs, 'clay'))

@asset()
def a_jar_neck():
    """a narrow-necked jar for oil or wine (C form), 0.43 m"""
    o = [(0.04, 0.0), (0.09, 0.02), (0.135, 0.12), (0.14, 0.2), (0.11, 0.3), (0.05, 0.36), (0.035, 0.39), (0.04, 0.42), (0.045, 0.43)]
    return dict(clay=vessel(o, 0.007, 26, 'body', 0.01, seed=23))

@asset()
def a_bowl():
    """a carinated bowl of the Achaemenid ware (the bowl type: B; C size): a small ring foot, a sharp carination, a flaring
    rim; 0.2 m across"""
    o = [(0.03, 0.0), (0.035, 0.006), (0.04, 0.008), (0.075, 0.03), (0.09, 0.045), (0.087, 0.055), (0.095, 0.075), (0.1, 0.085)]
    return dict(clay=vessel(o, 0.005, 32, 'bowl', 0.008, seed=24))

@asset(ao=True)
def a_phiale():
    """a lobed phiale of silver (Achaemenid phialai, B type): a shallow bowl, its wall pushed out in 16 tear-drop lobes round a
    raised omphalos, the rim plain; 0.2 m across (C size)"""
    o = [(0.0, 0.0), (0.03, 0.003), (0.07, 0.012), (0.095, 0.03), (0.1, 0.04)]
    b = vessel(o, 0.003, 64, 'phiale', 0.0, seed=25)
    for v in b.data.vertices:
        rr = math.hypot(v.co.x, v.co.y); a = math.atan2(v.co.y, v.co.x)
        if 0.025 < rr < 0.092: k = math.sin(math.pi * (rr - 0.025) / 0.067) * 0.007 * max(0, math.cos(a * 16)) ** 0.6; v.co.x *= 1 + k / rr; v.co.y *= 1 + k / rr; v.co.z -= k * 0.5
        if rr < 0.022: v.co.z += 0.012 * (1 - rr / 0.022) ** 1.5
    return dict(metal=b)

@asset()
def a_cookpot():
    """a globular cooking pot with a hole mouth and two lug handles, its lower body blackened (the soot is the builder's
    colour; C), 0.25 m"""
    o = [(0.04, 0.0), (0.1, 0.03), (0.155, 0.1), (0.17, 0.15), (0.155, 0.2), (0.12, 0.235), (0.105, 0.245), (0.11, 0.252)]
    p = vessel(o, 0.007, 28, 'pot', 0.015, seed=26)
    lugs = [xform(meta([('ELLIPSOID', (0, 0, 0), 0.028, (1.0, 0.6, 0.45), 2)], res=0.006, name='lug'), (s * 0.165, 0, 0.18)) for s in (-1, 1)]
    return dict(clay=join([p] + lugs, 'clay'))

@asset()
def a_milkpot():
    """a round-bellied clay pot with a short neck for the milk (C), 0.29 m"""
    o = [(0.05, 0.0), (0.09, 0.02), (0.135, 0.09), (0.14, 0.13), (0.125, 0.2), (0.09, 0.25), (0.078, 0.265), (0.085, 0.28), (0.09, 0.29)]
    return dict(clay=vessel(o, 0.007, 28, 'pot', 0.012, seed=27))

@asset()
def a_basin():
    """a wide shallow clay basin with a thickened rim (plain wide bowls and basins are ordinary finds: B; C), 0.46 m across"""
    o = [(0.09, 0.0), (0.12, 0.005), (0.18, 0.035), (0.215, 0.075), (0.23, 0.098), (0.235, 0.105)]
    return dict(clay=vessel(o, 0.01, 36, 'basin', 0.01, seed=28))

@asset()
def a_jug():
    """a small jug with a handle from rim to shoulder (C), 0.17 m"""
    o = [(0.03, 0.0), (0.05, 0.01), (0.072, 0.06), (0.07, 0.09), (0.045, 0.125), (0.033, 0.145), (0.037, 0.165), (0.04, 0.17)]
    j = vessel(o, 0.004, 22, 'jug', 0.012, seed=29)
    return dict(clay=join([j, handle((-0.036, 0, 0.16), (-0.066, 0, 0.08), (-0.035, 0, 0.01), 0.0065)], 'clay'))

@asset()
def a_vat():
    """a large wide-mouthed vat (pithos) for brewing and storage: a heavy rolled rim, rope-impressed bands round the body,
    0.75 m, 0.72 m across (C form)"""
    o = [(0.17, 0.0), (0.24, 0.05), (0.31, 0.15), (0.35, 0.3), (0.36, 0.42), (0.34, 0.56), (0.3, 0.66), (0.26, 0.7), (0.26, 0.72), (0.285, 0.735), (0.285, 0.75)]
    v_ = vessel(o, 0.022, 36, 'vat', 0.012, seed=30)
    bands = []
    for z in (0.3, 0.45, 0.58):
        R = [rr for rr, zz in o]; zs = [zz for rr, zz in o]
        k = next(i for i in range(len(zs) - 1) if zs[i] <= z <= zs[i + 1]); t = (z - zs[k]) / (zs[k + 1] - zs[k]); rz = R[k] + (R[k + 1] - R[k]) * t
        bands.append(sweep([((rz + 0.004) * math.cos(a), (rz + 0.004) * math.sin(a), z + 0.004 * math.sin(a * 40)) for a in [TAU * i / 96 for i in range(97)]], 0.009, 6, 'rope', caps=False))
    return dict(clay=join([v_] + bands, 'clay'))

@asset(ao=False, ground=False)
def a_sherds():
    """four sherds of a broken jar: curved pieces of a 1 cm wall with jagged broken edges, each lying on its convex side or
    its concave side, 6-14 cm across (C); parts s0..s3 (roadLitter.ts draws one per sherd)"""
    out = {}
    for k in range(4):
        rnd = random.Random(40 + k); R = rnd.uniform(0.14, 0.24); th = 0.009
        n = 9; sz = rnd.uniform(0.035, 0.07)
        outline = [(math.cos(TAU * i / n) * sz * rnd.uniform(0.6, 1.2), math.sin(TAU * i / n) * sz * rnd.uniform(0.6, 1.2)) for i in range(n)]
        import bmesh as _bm
        bm = _bm.new(); top = []; bot = []
        for (u, w) in outline:  # u along the circumference, w up the jar: on a cylinder of radius R
            a = u / R
            for (lst, rr) in ((top, R), (bot, R - th)):
                lst.append(bm.verts.new((rr * math.sin(a), -(rr * math.cos(a) - R), w)))
        ft = bm.faces.new(top); fb = bm.faces.new(list(reversed(bot)))
        for i in range(n): bm.faces.new((top[i], bot[i], bot[(i + 1) % n], top[(i + 1) % n]))
        _bm.ops.triangulate(bm, faces=[ft, fb]); _bm.ops.recalc_face_normals(bm, faces=bm.faces)
        ob = from_bm(bm, 's%d' % k, smooth=False); sharp(ob, 35)
        # lie it on the ground: the piece's w axis flat (rotate so the wall lies down), convex up or down
        xform(ob, (0, 0, 0), (math.pi / 2 if k % 2 else -math.pi / 2, 0, rnd.uniform(0, TAU)))
        zs = [v.co.z for v in ob.data.vertices]; z0 = min(zs)
        for v in ob.data.vertices: v.co.z -= z0
        out['s%d' % k] = ob
    return out

@asset(ground=True)
def a_sack():
    """a grain sack standing, filled and tied at the neck: a sewn tube of coarse cloth, filled (the cloth solver's pressure),
    settled on the ground under its own weight so that it slumps and creases, the gathered neck bound with a cord and the
    ears of the tie standing up (C), ~0.6 m"""
    prof = [(0.0, 0.0), (0.17, 0.0), (0.2, 0.03), (0.21, 0.12), (0.21, 0.3), (0.2, 0.4), (0.15, 0.47), (0.07, 0.52), (0.045, 0.55), (0.05, 0.6), (0.0, 0.62)]
    s = lathe(prof, 24, 'sack', wobble=0.03, seed=31); subdiv(s, 1)
    g = box(3, 3, 0.1, (0, 0, -0.1), 'floor')
    drape(s, [g], frames=36, mass=0.6, bending=2.0, thickness=0.004, pressure=6.0, pin=lambda p: 1.0 if p.z > 0.5 else 0.0)
    bpy.data.objects.remove(g, do_unlink=True)
    for v in s.data.vertices: v.co.z = max(0.0, v.co.z)
    tex = bpy.data.textures.new('crease', 'STUCCI'); tex.noise_scale = 0.08
    m = s.modifiers.new('d', 'DISPLACE'); m.texture = tex; m.strength = 0.006; m.mid_level = 0.5; apply_mods(s)
    cord = sweep([(0.052 * math.cos(a), 0.052 * math.sin(a), 0.545) for a in [TAU * i / 16 for i in range(17)]], 0.006, 5, 'cord', caps=False)
    return dict(cloth=s, cord=cord)

@asset(ground=True)
def a_sack_lying():
    """a filled grain sack lying on its side (the piles of the depot and the store, the cart's load, a sack on the shoulder):
    the standing sack's sewn tube laid along x, settled by the cloth solver so it flattens under its weight, the tied end at
    +x (C), ~0.62 m long"""
    prof = [(0.0, 0.0), (0.17, 0.0), (0.2, 0.03), (0.21, 0.12), (0.21, 0.3), (0.2, 0.4), (0.15, 0.47), (0.07, 0.52), (0.045, 0.55), (0.05, 0.6), (0.0, 0.62)]
    s = lathe(prof, 24, 'sack', wobble=0.03, seed=32); subdiv(s, 1)
    xform(s, (-0.3, 0, 0.22), (0, math.pi / 2, 0))
    g = box(3, 3, 0.1, (0, 0, -0.1), 'floor')
    drape(s, [g], frames=36, mass=0.6, bending=2.0, thickness=0.004, pressure=5.0)
    bpy.data.objects.remove(g, do_unlink=True)
    zs = [v.co.z for v in s.data.vertices]; z0 = min(zs)
    for v in s.data.vertices: v.co.z -= z0
    tex = bpy.data.textures.new('crease', 'STUCCI'); tex.noise_scale = 0.08
    m = s.modifiers.new('d', 'DISPLACE'); m.texture = tex; m.strength = 0.006; m.mid_level = 0.5; apply_mods(s)
    # the cord round the neck: find the neck's centre (x ~ 0.245 along the laid tube) from the settled surface
    nk = [v.co for v in s.data.vertices if 0.23 < v.co.x < 0.26]
    cz = sum(p.z for p in nk) / max(1, len(nk)); cy = sum(p.y for p in nk) / max(1, len(nk))
    cord = sweep([(0.245, cy + 0.05 * math.cos(a), cz + 0.05 * math.sin(a)) for a in [TAU * i / 16 for i in range(17)]], 0.006, 5, 'cord', caps=False)
    return dict(cloth=s, cord=cord)

# ======================================================================================================== held props (people/props.ts)
# In the props' own frames (props.ts): the Phase 3 kinds keep their origins (the spear at its butt, +Y up the shaft; the
# mallet at the grip, its handle down -Y); the tools of the work cycles are in a grip frame: origin at the grip, +Z (game)
# toward the working end, +Y the tool's roll reference. Sizes are the procedural forms' (so the placements hold); the
# forms are C unless props.ts's note says otherwise. Parts are named by what they are made of (props.ts TOOL_PAINT colours
# them): wood, wood_d, iron, bronze, silver, gold, straw, cloth, wool, bone, clay, cord, leather, reed, cane, linen, hair.
def G(p): return Vector((p[0], -p[2], p[1]))
def rodG(a, b, r0, r1=None, seg=6, name='rod', caps=True, scale=None):
    return sweep([G(a), G(b)], [r0, r0 if r1 is None else r1], seg, name, caps, scale=scale)
def pathG(pts, radii, seg=6, name='path', caps=True, scale=None, up=(0, 0, 1)):
    return sweep([G(p) for p in pts], radii, seg, name, caps, scale=scale, up=up)
def alongZ(ob, z0=0.0):
    """a lathe built along Blender z turned to run along the game's +Z from z0"""
    return xform(ob, (0, -z0, 0), (math.pi / 2, 0, 0))
def atG(ob, p):
    q = G(p); return xform(ob, (q.x, q.y, q.z))
def leaf_blade(y0, L, w, t, seg=4, name='blade', axis='y'):
    """a leaf-shaped blade with a midrib (a diamond section) from y0 along game +Y (axis 'y') or +Z (axis 'z'), length L,
    greatest width w at 30 %"""
    ts = [i / 8 for i in range(9)]
    wf = lambda s: w * (math.sin(math.pi * min(1, s / 0.3) / 2) if s < 0.3 else (1 - (s - 0.3) / 0.7) ** 0.8) + 0.0015
    pts = [(0, y0 + L * s, 0) if axis == 'y' else (0, 0, y0 + L * s) for s in ts]
    return pathG(pts, lambda s: wf(s), seg, name, scale=(1.0, t / w), up=(0, 1, 0) if axis == 'y' else (0, 0, 1))

def spear_common(butt):
    wood = [pathG([(0, 0.08, 0), (0.002, 1.1, 0), (0, 2.18, 0)], [0.016, 0.015, 0.014], 7, 'shaft')]
    br = [rodG((0, 2.16, 0), (0, 2.25, 0), 0.0175, 0.0145, 8, 'socket'), rodG((0, 2.165, 0), (0, 2.18, 0), 0.0195, 0.0195, 8, 'ring'),
          leaf_blade(2.24, 0.27, 0.029, 0.009, 4, 'blade')]
    b = []
    if butt == 'apple':
        b.append(atG(lathe([(0.0, -0.043), (0.03, -0.04), (0.047, -0.015), (0.047, 0.012), (0.035, 0.035), (0.012, 0.042), (0.0, 0.036)], 12, 'apple'), (0, 0.045, 0)))
        b.append(rodG((0, 0.08, 0), (0, 0.1, 0), 0.004, 0.006, 5, 'stalk'))
    else:
        b.append(atG(lathe([(0.0, -0.045), (0.03, -0.04), (0.046, -0.01), (0.044, 0.02), (0.03, 0.038), (0.016, 0.045), (0.014, 0.05)], 12, 'pom'), (0, 0.05, 0)))
        for k in range(6):  # the crown of sepals toward the shaft
            a = TAU * k / 6; b.append(rodG((0.012 * math.cos(a), 0.095, 0.012 * math.sin(a)), (0.02 * math.cos(a), 0.118, 0.02 * math.sin(a)), 0.005, 0.002, 4, 'sepal'))
    return wood, br, b

@asset(ground=False)
def a_tool_spear():
    """the long spear of the guards (props.ts: a pomegranate butt, silver for the ordinary guards: B; C form): a tapering
    ash shaft 2.1 m, a bronze socket with a ring and a leaf-shaped blade with a midrib, the pomegranate butt with its crown"""
    w, br, b = spear_common('pom'); return dict(wood=join(w, 'wood'), bronze=join(br, 'bronze'), silver=join(b, 'silver'))
@asset(ground=False)
def a_tool_spear_apple():
    """the spear with an apple of gold at the butt (Herodotus 7.41: B; C form)"""
    w, br, b = spear_common('apple'); return dict(wood=join(w, 'wood'), bronze=join(br, 'bronze'), gold=join(b, 'gold'))
@asset(ground=False)
def a_tool_spear_gpom():
    """the spear with a golden pomegranate at the butt (Herodotus 7.41: B; C form)"""
    w, br, b = spear_common('pom'); return dict(wood=join(w, 'wood'), bronze=join(br, 'bronze'), gold=join(b, 'gold'))

@asset(ground=False)
def a_tool_mallet():
    """a wooden mallet: a barrel head on a handle with a swelling at the grip end (legacy frame: the handle down -Y from the
    grip, the head across x at -0.3 m) (C)"""
    h = pathG([(0, 0.02, 0), (0, -0.14, 0), (0, -0.3, 0)], [0.017, 0.015, 0.014], 7, 'handle')
    k = atG(lathe([(0.0, 0), (0.019, 0), (0.021, 0.012), (0.0, 0.02)], 8, 'knob'), (0, 0.015, 0))
    head = lathe([(0.0, -0.06), (0.043, -0.06), (0.05, -0.045), (0.052, 0.0), (0.05, 0.045), (0.043, 0.06), (0.0, 0.06)], 12, 'head')
    xform(head, (0, 0, -0.3), (0, math.pi / 2, 0))
    return dict(wood=join([h, k], 'wood'), wood_d=head)

@asset(ground=False)
def a_tool_sickle():
    """an iron sickle (the sickle of the ancient Near East: B type; C form): the blade leaving the handle's thumb end and
    curving toward +Y in a flat crescent that narrows to the point, its inner edge toothed; a wooden handle with a pommel"""
    r = 0.13; pts = []
    for i in range(12):
        a = (i / 11) * math.pi * 1.05; pts.append((0, r - r * math.cos(a), 0.07 + r * math.sin(a)))
    blade = pathG(pts, lambda t: 0.013 * (1 - 0.75 * t) + 0.002, 4, 'blade', scale=(1.0, 0.18), up=(1, 0, 0))
    handle = pathG([(0, 0, -0.075), (0, 0.002, 0), (0, 0, 0.075)], [0.017, 0.015, 0.016], 7, 'handle')
    pom = atG(lathe([(0.0, 0), (0.02, 0.002), (0.022, 0.012), (0.0, 0.016)], 8, 'pom'), (0, 0, -0.078))
    alongZ(pom, 0.078)
    return dict(iron=blade, wood=join([handle, pom], 'wood'))

@asset(ground=False)
def a_tool_spindle():
    """a drop spindle hanging on its yarn (spindle whorls of the period: B): the yarn from the hand, the cop of spun wool on
    the shaft, a domed stone whorl low on a tapering wooden shaft (C); the parts below the hand are moved by the yarn's length"""
    yarn = rodG((0, 0, 0), (0, -0.012, 0), 0.0012, 0.0012, 4, 'yarn')
    shaft = pathG([(0, -0.01, 0), (0, -0.16, 0), (0, -0.3, 0)], [0.0035, 0.005, 0.003], 6, 'shaft')
    whorl = atG(lathe([(0.0, -0.006), (0.02, -0.006), (0.025, -0.002), (0.022, 0.004), (0.012, 0.009), (0.0, 0.01)], 12, 'whorl'), (0, -0.245, 0))
    cop = atG(lathe([(0.0, -0.03), (0.006, -0.03), (0.013, -0.018), (0.014, 0.01), (0.009, 0.026), (0.0, 0.03)], 8, 'cop'), (0, -0.07, 0))
    return dict(wood=shaft, stone=whorl, wool=join([cop, yarn], 'wool'))

@asset(ground=False)
def a_tool_distaff():
    """a distaff: a rod with a hank of combed wool bound round its head (C)"""
    rod = pathG([(0, 0, -0.1), (0, 0, 0.12), (0, 0, 0.42)], [0.008, 0.0085, 0.006], 6, 'rod')
    wool = meta([('ELLIPSOID', G((0, 0, 0.33 + 0.02 * k)), 0.05 - 0.004 * abs(k - 2), (1.0, 1.0, 1.1), 2) for k in range(5)], res=0.009, name='wool')
    displace(wool, 0.008, 0.02, seed=51)
    return dict(wood=rod, wool=wool)

@asset(ground=False)
def a_tool_trowel():
    """a small bronze trowel for mud mortar: a leaf blade on a cranked tang, a wooden handle (C)"""
    h = pathG([(0, 0, -0.065), (0, 0, 0.0), (0, 0, 0.06)], [0.013, 0.015, 0.012], 7, 'handle')
    tang = pathG([(0, 0, 0.055), (0, -0.004, 0.075), (0, -0.01, 0.085)], 0.004, 5, 'tang')
    bl = [(0, -0.011, 0.085 + 0.13 * t) for t in [i / 6 for i in range(7)]]
    blade = pathG(bl, lambda t: 0.04 * math.sin(math.pi * (0.25 + 0.75 * t)) ** 0.7 + 0.002, 4, 'blade', scale=(1.0, 0.06), up=(0, 0, 1))
    return dict(wood=h, bronze=join([tang, blade], 'bronze'))

@asset(ground=True)
def a_tool_brick():
    """a sun-dried mud brick 33 x 33 x 11 cm: the arrises worn round, the faces a little uneven, straw ends in them (C)"""
    b = box(0.33, 0.33, 0.11, (0, 0, -0.055), 'brick', bevel=0.012, segs=2)
    subdiv(b, 1); displace(b, 0.004, 0.05, seed=52)
    return dict(mud=b)

@asset(ground=False)
def a_tool_knife():
    """an iron knife: a curved back and straight edge, a bolster and a wooden handle with rivets (C)"""
    h = pathG([(0, 0, -0.06), (0, 0.001, 0), (0, 0, 0.05)], [0.012, 0.014, 0.013], 7, 'handle')
    pts = [(0, -0.004 + 0.012 * t * (1 - t), 0.05 + 0.15 * t) for t in [i / 7 for i in range(8)]]
    blade = pathG(pts, lambda t: 0.015 * (1 - t ** 1.5) + 0.0015, 4, 'blade', scale=(1.0, 0.18), up=(1, 0, 0))
    bol = rodG((0, 0, 0.046), (0, 0, 0.056), 0.014, 0.012, 7, 'bolster')
    return dict(wood_d=h, iron=join([blade, bol], 'iron'))

@asset(ground=False)
def a_tool_cloth():
    """a wet cloth or a hank of wool being washed, twisted between the hands (C)"""
    pts = [(-0.18 + 0.36 * t, 0.012 * math.sin(t * 9), 0.01 * math.cos(t * 7)) for t in [i / 12 for i in range(13)]]
    c = pathG(pts, [0.04, 0.046, 0.04, 0.047, 0.042, 0.048, 0.043, 0.047, 0.04, 0.046, 0.041, 0.045, 0.038], 7, 'cloth', scale=(1.0, 0.72))
    displace(c, 0.006, 0.02, seed=53)
    return dict(cloth=c)

@asset(ground=False)
def a_tool_wisp():
    """a twist of straw for rubbing down an animal: a bundle of stalks bound in the middle (C)"""
    parts = []
    for k in range(9):
        a = TAU * k / 9; r = 0.012 + 0.006 * (k % 2)
        parts.append(pathG([(r * math.cos(a) * 0.6, r * math.sin(a) * 0.6, -0.07), (r * math.cos(a) * 0.4, r * math.sin(a) * 0.4, 0.0), (r * math.cos(a) * 1.6, r * math.sin(a) * 1.6, 0.17)], 0.0035, 3, 'stalk'))
    return dict(straw=join(parts, 'straw'))

@asset(ground=False)
def a_tool_rag():
    """a crumpled polishing rag (C)"""
    r = meta([('ELLIPSOID', (0.008 * k - 0.012, 0.006 * (k % 2), 0.004 * k), 0.028, (1.0, 1.3, 0.75), 2) for k in range(4)], res=0.007, name='rag')
    displace(r, 0.008, 0.015, seed=54); alongZ(r, 0)
    return dict(cloth=r)

@asset(ground=False)
def a_tool_awl():
    """a bone awl: a knuckle-end handle and a polished point (C)"""
    h = meta([('ELLIPSOID', G((0, 0, -0.03)), 0.017, (1.0, 1.0, 2.2), 2), ('ELLIPSOID', G((0, 0, -0.055)), 0.014, (1.3, 1.0, 1.0), 2)], res=0.004, name='h')
    p = pathG([(0, 0, 0.0), (0, 0, 0.06), (0, 0, 0.125)], [0.008, 0.004, 0.0008], 5, 'pt')
    return dict(bone=join([h, p], 'bone'))

@asset(ground=False)
def a_tool_arrow():
    """a reed arrow with a bronze trilobate head and three fletchings (arrowheads by the hundred in the Treasury: B; C form)"""
    shaft = pathG([(0, 0, 0.0), (0, 0, 0.35), (0, 0, 0.7)], [0.0042, 0.0045, 0.004], 5, 'shaft')
    nock = rodG((0, 0, -0.004), (0, 0, 0.012), 0.005, 0.0045, 5, 'nock')
    head = []
    for k in range(3):
        a = TAU * k / 3; head.append(pathG([(0, 0, 0.7), (0.009 * math.cos(a), 0.009 * math.sin(a), 0.715), (0, 0, 0.745)], [0.0015, 0.0012, 0.0003], 3, 'lobe'))
    head.append(rodG((0, 0, 0.695), (0, 0, 0.745), 0.004, 0.0008, 5, 'core'))
    fl = []
    for k in range(3):
        a = TAU * k / 3 + 0.3
        v = [G((0.002 * math.cos(a), 0.002 * math.sin(a), 0.02)), G((0.011 * math.cos(a), 0.011 * math.sin(a), 0.035)), G((0.011 * math.cos(a), 0.011 * math.sin(a), 0.1)), G((0.002 * math.cos(a), 0.002 * math.sin(a), 0.11))]
        import bmesh as _b
        bm = _b.new(); vs = [bm.verts.new(p) for p in v]; bm.faces.new(vs); ob = from_bm(bm, 'vane'); solidify(ob, 0.0006, 0); fl.append(ob)
    return dict(reed=join([shaft, nock], 'reed'), bronze=join(head, 'bronze'), feather=join(fl, 'feather'))

@asset(ground=False)
def a_tool_lead():
    """a lead rope of twisted plant fibre, down from the hand to an animal (C)"""
    return dict(cord=pathG([(0, 0, 0), (0, -0.05, 0.3), (0, -0.1, 0.65)], 0.0075, 6, 'lead'))

@asset(ground=False)
def a_tool_ladle():
    """a wooden ladle: a deep bowl carved with its handle, the handle ending in a hook (C)"""
    h = pathG([(0, 0.012, -0.09), (0, 0, 0.0), (0, 0, 0.2), (0, 0.01, 0.36)], [0.009, 0.011, 0.01, 0.012], 6, 'handle')
    bowl = vessel([(0.0, 0.0), (0.03, 0.004), (0.045, 0.022), (0.048, 0.04)], 0.004, 14, 'bowl', 0.02, seed=55)
    xform(bowl, (0, -0.4, -0.01 + 0.0))
    return dict(wood=join([h, bowl], 'wood'))

@asset(ground=False)
def a_tool_stick():
    """a brushwood stick for the fire: crooked, with a side twig and knots (C)"""
    s = pathG([(0, 0, -0.15), (0.01, 0.004, 0.1), (-0.006, 0.0, 0.3), (0.008, 0.006, 0.55)], [0.013, 0.011, 0.01, 0.007], 5, 'stick')
    t = pathG([(0.004, 0.003, 0.22), (0.05, 0.01, 0.33)], [0.005, 0.003], 4, 'twig')
    return dict(wood_d=join([s, t], 'wood_d'))

@asset(ground=False)
def a_tool_barsom():
    """the barsom: a bundle of thin twigs held upright, tied near the foot (OXUS-PLAQUE: B; C length and form)"""
    tw = []
    for k in range(7):
        a = TAU * k / 7; r = 0.008
        tw.append(pathG([(r * math.cos(a), r * math.sin(a), -0.1), (r * math.cos(a) * 0.8, r * math.sin(a) * 0.8, -0.04), (r * math.cos(a) * 1.8 + 0.002 * k, r * math.sin(a) * 1.8, 0.36 - 0.01 * (k % 3))], 0.0028, 3, 'twig'))
    tie = rodG((0, 0, -0.06), (0, 0, -0.045), 0.011, 0.011, 7, 'tie')
    return dict(wood=join(tw, 'wood'), cord=tie)

@asset(ground=False)
def a_tool_stylus():
    """a reed stylus cut to a wedge at the tip (C)"""
    s = pathG([(0, 0, -0.07), (0, 0, 0.05), (0, 0, 0.075)], [0.0045, 0.004, 0.0012], 4, 'stylus')
    return dict(reed=s)

@asset(ground=False)
def a_tool_hoe():
    """a hoe: an iron blade with a socket eye on a 1.25 m wooden handle (C)"""
    h = pathG([(0, 0, -0.45), (0, 0.003, 0.2), (0, 0, 0.8)], [0.016, 0.017, 0.018], 6, 'handle')
    eye = rodG((0, 0.03, 0.8), (0, -0.04, 0.82), 0.026, 0.024, 7, 'eye')
    bl = pathG([(0, -0.03, 0.81), (0, -0.12, 0.812), (0, -0.2, 0.815)], [0.06, 0.075, 0.085], 4, 'blade', scale=(1.0, 0.09), up=(0, 0, 1))
    return dict(wood=h, iron=join([eye, bl], 'iron'))

@asset(ground=False)
def a_tool_fork():
    """a wooden winnowing fork: a shaft, a crosspiece lashed on, four tines curving up (C)"""
    s = pathG([(0, 0, -0.55), (0, 0.004, 0.3), (0, 0, 1.15)], [0.015, 0.016, 0.017], 6, 'shaft')
    cp = rodG((-0.11, 0, 1.15), (0.11, 0, 1.15), 0.016, 0.016, 6, 'cross', scale=(1.0, 1.6))
    tines = [pathG([(x, 0, 1.15), (x * 1.1, 0.01, 1.3), (x * 1.2, 0.045, 1.48)], [0.008, 0.007, 0.004], 5, 'tine') for x in (-0.09, -0.03, 0.03, 0.09)]
    lash = rodG((0, 0, 1.13), (0, 0, 1.17), 0.021, 0.021, 7, 'lash')
    return dict(wood=s, wood_d=join([cp] + tines, 'wood_d'), cord=lash)

@asset(ground=False)
def a_tool_goad():
    """a goad stick with an iron point (C)"""
    return dict(wood_d=pathG([(0, 0, -0.25), (0.006, 0, 0.5), (0, 0.004, 1.12)], [0.011, 0.009, 0.007], 5, 'goad'), iron=rodG((0, 0.004, 1.11), (0, 0.004, 1.16), 0.006, 0.0008, 4, 'pt'))

@asset(ground=False)
def a_tool_staff():
    """a herder's staff: a natural stick, a little crooked, its top worn smooth (C)"""
    return dict(wood=pathG([(0, 0, -0.12), (0.01, 0.005, 0.4), (-0.006, 0, 1.0), (0.004, 0.006, 1.5)], [0.017, 0.018, 0.017, 0.016], 6, 'staff'))

@asset(ground=False)
def a_tool_broom():
    """a handleless broom: a bundle of twigs bound tight at one end, spreading at the other (C)"""
    tw = []
    for k in range(12):
        a = TAU * k / 12; r0 = 0.02 + 0.006 * (k % 2)
        tw.append(pathG([(r0 * math.cos(a), r0 * math.sin(a), -0.1), (r0 * 0.9 * math.cos(a), r0 * 0.9 * math.sin(a), 0.18), (r0 * 4.2 * math.cos(a), r0 * 3.0 * math.sin(a), 0.56)], [0.004, 0.004, 0.0025], 3, 'tw'))
    bind = rodG((0, 0, 0.1), (0, 0, 0.18), 0.03, 0.031, 8, 'bind')
    return dict(straw=join(tw, 'straw'), cord=bind)

@asset(ground=True)
def a_tool_mould():
    """a wooden brick mould: an open frame of four boards pegged at the corners, a handle at each end (for 33 cm bricks: C;
    the brick mould attested in Babylonia: B)"""
    w, h, t = 0.36, 0.11, 0.022; parts = []
    for s in (-1, 1):
        parts.append(box(t, w + 0.02, h, (s * (w / 2 - t / 2), 0, 0), bevel=0.003))
        parts.append(box(w, t, h, (0, s * (w / 2 - t / 2), 0), bevel=0.003))
        parts.append(pathG([(s * (w / 2 + 0.01), h * 0.7, -0.02), (s * (w / 2 + 0.07), h * 0.72, 0.0), (s * (w / 2 + 0.01), h * 0.7, 0.02)], 0.011, 6, 'handle'))
    return dict(wood=join(parts, 'wood'))

@asset(ground=False)
def a_tool_rope():
    """a hauling rope of plant fibre (the path the rope props.ts gives it), three-strand laid (C)"""
    pts = [(0, -0.55, -0.62), (0, -0.1, -0.42), (0, 0, -0.26), (0, 0, 0.3), (0, -0.06, 1.5), (0, -0.22, 3), (0, -0.5, 4.6)]
    fine = []
    for i in range(len(pts) - 1):
        for k in range(4): t = k / 4; fine.append(tuple(pts[i][j] + (pts[i + 1][j] - pts[i][j]) * t for j in range(3)))
    fine.append(pts[-1])
    return dict(cord=pathG(fine, lambda t: 0.013 * (1 + 0.08 * math.sin(t * 900)), 6, 'rope', caps=True))

@asset(ground=False)
def a_tool_adze():
    """a carpenter's adze: an iron blade across the haft's end, lashed to a crooked haft (C)"""
    h = pathG([(0, 0, -0.08), (0, 0.004, 0.2), (0, 0, 0.46)], [0.015, 0.016, 0.018], 6, 'haft')
    bl = pathG([(0, 0.035, 0.44), (0, -0.025, 0.46), (0, -0.085, 0.47)], [0.018, 0.024, 0.028], 4, 'blade', scale=(1.0, 0.12), up=(0, 0, 1))
    lash = rodG((0, 0, 0.42), (0, 0, 0.46), 0.02, 0.021, 7, 'lash')
    return dict(wood=h, iron=bl, cord=lash)

def bow_limbs(half, th, recurve=1.0):
    P = lambda u: (0, half * u, (0.06 * abs(u) ** 2 - 0.1 * abs(u) + (0.35 * (abs(u) - 0.8) if abs(u) > 0.8 else 0)) * recurve)
    us = [i / 10 for i in range(-10, 11)]
    limb = pathG([P(u) for u in us], lambda t: (0.016 - 0.009 * abs(2 * t - 1)) * th + 0.0015, 6, 'limb', scale=(1.0, 0.7), up=(0, 1, 0))
    grip = rodG(P(-0.1), P(0.1), 0.019 * th, 0.019 * th, 7, 'grip')
    return limb, grip, P

@asset(ground=False)
def a_tool_bow():
    """the composite bow, recurved (the guards' bows of the reliefs and the Susa bricks: B; C form): limbs of horn, wood
    and sinew tapering to stiff recurved ears, a leather-wrapped grip; the string is the builder's (drawn back per frame)"""
    limb, grip, P = bow_limbs(0.52, 1.0)
    return dict(wood=limb, leather=grip)
@asset(ground=False)
def a_tool_toy_bow():
    """a boy's small bow of the recurved form, 0.6 m (C)"""
    limb, grip, P = bow_limbs(0.3, 0.6)
    return dict(wood=limb, leather=grip)

@asset(ground=False)
def a_tool_beater():
    """a wooden weaving sword: a long flat blade thinning to one edge, rounded ends (C)"""
    b = box(0.62, 0.06, 0.012, (0, 0, -0.006), 'b', bevel=0.004)
    for v in b.data.vertices:
        if v.co.y < 0: v.co.z *= 0.35
        v.co.y *= 1 - 0.15 * (abs(v.co.x) / 0.31) ** 4
    return dict(wood=b)

@asset(ground=False)
def a_tool_paddle():
    """a wooden stirring paddle for the mash: a pole and a broad blade (C)"""
    s = pathG([(0, 0, -0.55), (0, 0.003, 0.2), (0, 0, 0.9)], [0.017, 0.017, 0.018], 6, 'pole')
    bl = pathG([(0, 0, 0.88), (0, 0, 1.0), (0, 0, 1.13)], [0.035, 0.06, 0.055], 6, 'blade', scale=(1.0, 0.16), up=(0, 0, 1))
    return dict(wood=s, wood_d=bl)

@asset(ground=False)
def a_tool_sceptre():
    """the king's long staff, gilded, with a knob (door-jamb and audience reliefs: B; C form)"""
    s = pathG([(0, 0, -0.75), (0, 0, 0.9)], [0.013, 0.012], 8, 'staff')
    knob = alongZ(lathe([(0.0, 0), (0.016, 0.004), (0.03, 0.025), (0.028, 0.045), (0.012, 0.06), (0.0, 0.062)], 12, 'knob'), 0.885)
    ferrule = rodG((0, 0, -0.76), (0, 0, -0.72), 0.015, 0.014, 8, 'ferrule')
    return dict(gold=join([s, knob, ferrule], 'gold'))

@asset(ground=False)
def a_tool_parasol():
    """the parasol held over the king (HADISH-JAMB: B): a 2 m pole, ribs under a cloth canopy 1.2 m across with a fringed
    edge, a finial (C)"""
    pole = pathG([(0, 0, -0.3), (0, 0, 1.78)], [0.016, 0.014], 7, 'pole')
    can = lathe([(0.0, 0.2), (0.08, 0.18), (0.3, 0.11), (0.52, 0.035), (0.6, 0.0), (0.59, -0.005), (0.3, 0.1), (0.0, 0.19)], 16, 'can')
    alongZ(can, 1.56)
    ribs = [pathG([(0, 0, 1.63), (0.55 * math.cos(TAU * k / 12), 0.55 * math.sin(TAU * k / 12), 1.57)], 0.004, 3, 'rib') for k in range(12)]
    fringe = alongZ(lathe([(0.6, 0.0), (0.605, -0.07), (0.59, -0.07), (0.585, 0.0)], 24, 'fr'), 1.56)
    fin = alongZ(lathe([(0.0, 0), (0.02, 0.01), (0.012, 0.05), (0.0, 0.06)], 8, 'fin'), 1.76)
    return dict(wood=pole, cloth=can, gold=join(ribs + [fin], 'gold'), band=fringe)

@asset(ground=False)
def a_tool_lotus():
    """a lotus flower on its stem in the king's left hand (the reliefs: B; C form): a stem, a calyx and a cup of petals"""
    stem = pathG([(0, 0, -0.04), (0.004, 0, 0.1), (0, 0, 0.2)], 0.004, 4, 'stem')
    pet = []
    for k in range(7):
        a = TAU * k / 7
        pet.append(pathG([(0, 0, 0.2), (0.012 * math.cos(a), 0.012 * math.sin(a), 0.225), (0.022 * math.cos(a), 0.022 * math.sin(a), 0.27)], [0.004, 0.009, 0.002], 4, 'p', scale=(1.0, 0.3), up=(math.cos(a), math.sin(a), 0)))
    return dict(green=stem, petal=join(pet, 'petal'))

@asset(ground=False)
def a_tool_whisk():
    """the fly-whisk (door-jamb reliefs: B): a gilded handle and a long horsehair tuft falling from it (C)"""
    h = pathG([(0, 0, -0.08), (0, 0, 0.26)], [0.012, 0.011], 7, 'h')
    cap = alongZ(lathe([(0.0, 0), (0.016, 0.0), (0.02, 0.02), (0.014, 0.03), (0.0, 0.03)], 8, 'c'), 0.25)
    hairs = [pathG([(0.004 * math.cos(TAU * k / 9), 0.004 * math.sin(TAU * k / 9), 0.27), (0.02 * math.cos(TAU * k / 9), 0.02 * math.sin(TAU * k / 9), 0.45), (0.04 * math.cos(TAU * k / 9), 0.035 * math.sin(TAU * k / 9) - 0.01, 0.62)], [0.006, 0.006, 0.003], 3, 'hr') for k in range(9)]
    return dict(gold=join([h, cap], 'gold'), hair=join(hairs, 'hair'))

@asset(ground=False)
def a_tool_towel():
    """the folded linen towel over the hand (door-jamb reliefs: B; C form)"""
    t = box(0.08, 0.34, 0.02, (0, 0, -0.01), 't', bevel=0.006, segs=2)
    xform(t, (0, 0.12, 0))
    for v in t.data.vertices: v.co.z += 0.02 * math.sin(v.co.y * 18)
    return dict(linen=t)

@asset(ground=False)
def a_tool_ball():
    """a child's stitched leather ball, 10 cm (C)"""
    b = lathe([(0.0, -0.05)] + [(0.05 * math.sin(math.pi * k / 8), -0.05 * math.cos(math.pi * k / 8)) for k in range(1, 8)] + [(0.0, 0.05)], 10, 'ball')
    displace(b, 0.002, 0.02, seed=56)
    return dict(leather=b)

@asset(ground=False)
def a_tool_rattle():
    """a hollow fired-clay rattle with a stub handle (C)"""
    body = alongZ(lathe([(0.0, 0.0), (0.02, 0.005), (0.034, 0.03), (0.032, 0.05), (0.018, 0.068), (0.0, 0.072)], 10, 'b'), 0.065)
    h = pathG([(0, 0, -0.03), (0, 0, 0.07)], [0.011, 0.014], 6, 'h')
    return dict(clay=join([body, h], 'clay'))

@asset(ground=False)
def a_tool_hammer():
    """a smith's hammer: an iron head with a flat face and a peen, wedged on a wooden haft (C)"""
    h = pathG([(0, 0, -0.06), (0, 0.002, 0.12), (0, 0, 0.3)], [0.013, 0.014, 0.016], 6, 'haft')
    head = pathG([(0, 0.05, 0.29), (0, 0.0, 0.29), (0, -0.07, 0.29)], [0.02, 0.022, 0.012], 6, 'head', scale=(1.0, 1.15), up=(1, 0, 0))
    return dict(wood=h, iron=head)

@asset(ground=False)
def a_tool_tongs():
    """a smith's iron tongs holding a bar at a red heat (C)"""
    arms = []
    for s in (-1, 1):
        arms.append(pathG([(0, 0.008 * s, -0.08), (0, 0.012 * s, 0.34), (0, 0.004 * s, 0.44)], [0.007, 0.006, 0.005], 5, 'arm'))
    piv = rodG((-0.012, 0, 0.34), (0.012, 0, 0.34), 0.008, 0.008, 6, 'pivot')
    bar = box(0.018, 0.16, 0.018, G((0, -0.009, 0.5)), 'bar', bevel=0.002)
    return dict(iron=join(arms + [piv], 'iron'), hot=bar)

@asset(ground=False)
def a_tool_hammer_s():
    """a goldsmith's small hammer (C)"""
    h = pathG([(0, 0, -0.04), (0, 0, 0.18)], [0.008, 0.009], 6, 'h')
    head = pathG([(0, 0.02, 0.18), (0, 0.0, 0.18), (0, -0.04, 0.18)], [0.01, 0.011, 0.006], 6, 'hd', up=(1, 0, 0))
    return dict(wood=h, bronze=head)

@asset(ground=False)
def a_tool_punch():
    """a bronze chasing punch (C)"""
    return dict(bronze=pathG([(0, 0, -0.04), (0, 0, 0.05), (0, 0, 0.07)], [0.0055, 0.0045, 0.002], 6, 'p'))

@asset(ground=False)
def a_tool_balance():
    """a hand balance: a bronze beam on a cord with knobbed ends, two pans on three cords each (B by analogy; C form); the
    pans rock with the builder's parameter"""
    cord = [rodG((0, 0, 0), (0, -0.1, 0), 0.0018, 0.0018, 4, 'c')]
    beam = [pathG([(-0.165, -0.1, 0), (0, -0.098, 0), (0.165, -0.1, 0)], [0.004, 0.005, 0.004], 6, 'beam')]
    for s in (-1, 1): beam.append(atG(lathe([(0.0, -0.006), (0.007, -0.004), (0.007, 0.004), (0.0, 0.006)], 6, 'k'), (0.168 * s, -0.1, 0)))
    pans = []
    for s in (-1, 1):
        for k in range(3):
            a = TAU * k / 3; cord.append(rodG((0.16 * s, -0.1, 0), (0.16 * s + 0.045 * math.cos(a), -0.265, 0.045 * math.sin(a)), 0.0012, 0.0012, 3, 'pc'))
        pans.append(atG(vessel([(0.0, 0.0), (0.03, 0.002), (0.052, 0.014), (0.058, 0.02)], 0.002, 14, 'pan', 0.0), (0.16 * s, -0.285, 0)))
    return dict(cord=join(cord, 'cord'), bronze=join(beam + pans, 'bronze'))

@asset(ground=False)
def a_tool_seal_cyl():
    """a stone cylinder seal, 3 cm, bored through, its surface cut in intaglio (the rolling's figures not modelled; C)"""
    s = lathe([(0.0035, -0.016), (0.009, -0.016), (0.0092, -0.012), (0.0092, 0.012), (0.009, 0.016), (0.0035, 0.016), (0.0035, -0.016)], 10, 's')
    xform(s, (0, 0, 0), (0, math.pi / 2, 0))
    return dict(stone=s)

@asset(ground=False)
def a_tool_drill_bow():
    """the seal cutter's bow for the drill: a bent stick and its thong (B by analogy; C)"""
    y = lambda a: 0.05 * math.sin(math.pi * a)
    stick = pathG([(0, y(i / 8), i / 8 * 0.46 - 0.02) for i in range(9)], [0.009, 0.008, 0.008, 0.008, 0.007, 0.007, 0.007, 0.006, 0.006], 5, 'stick')
    thong = rodG((0, 0, -0.02), (0, 0, 0.44), 0.002, 0.002, 3, 'thong')
    return dict(wood_d=stick, leather=thong)

@asset(ground=False)
def a_tool_scraper():
    """a tanner's two-handled scraper: a curved iron blade between two wooden handles (C)"""
    bl = pathG([(-0.13, -0.03, 0.03), (0, -0.03, 0.04), (0.13, -0.03, 0.03)], 0.025, 4, 'bl', scale=(0.12, 1.0), up=(0, 0, 1))
    hs = [pathG([(0.15 * s, -0.05, 0.02), (0.15 * s, 0.0, 0.01), (0.15 * s, 0.06, 0.0)], [0.013, 0.015, 0.014], 6, 'h') for s in (-1, 1)]
    return dict(iron=bl, wood=join(hs, 'wood'))

@asset(ground=False)
def a_tool_pestle():
    """a long wooden pestle, waisted for the hands, its pounding end broad and worn (C)"""
    return dict(wood=pathG([(0, 0, -0.62), (0, 0, -0.2), (0, 0, 0.2), (0, 0, 0.5), (0, 0, 0.6), (0, 0, 0.66)], [0.034, 0.028, 0.028, 0.034, 0.043, 0.04], 8, 'p'))

@asset(ground=False)
def a_tool_pen():
    """a reed pen for ink, its tip cut and inked (C)"""
    return dict(reed=pathG([(0, 0, -0.1), (0, 0, 0.07)], [0.0035, 0.003], 5, 'p'), ink=rodG((0, 0, 0.07), (0, 0, 0.085), 0.003, 0.0008, 5, 'ink'))

@asset(ground=False)
def a_tool_plectrum():
    """a plectrum stick (C)"""
    return dict(bone=pathG([(0, 0, -0.03), (0, 0, 0.1), (0, 0, 0.13)], [0.005, 0.004, 0.002], 5, 'p', scale=(1.0, 0.6)))

# ======================================================================================================== driver
if __name__ == '__main__':
    job = json.load(open(sys.argv[sys.argv.index('--') + 1]))
    outd = job['out_dir']; os.makedirs(outd, exist_ok=True); report = {}
    for id_ in job['ids']:
        t0 = time.time(); A = ASSETS[id_]
        clear()
        parts = A['fn']()
        lod0 = {}; lod1 = {}
        tgt = job.get('targets', {}).get(id_, {})
        for p, ob in parts.items():
            triangulate(ob); weld(ob)
            t = tgt.get(p)
            if t: decimate(ob, t[0])
            lod0[p] = ob
            o1 = copy(ob, ob.name + '_1'); decimate(o1, t[1] if t else max(8, int(tris(ob) * A['lod1']))); lod1[p] = o1
        if A['ao']:
            for o in lod1.values(): o.hide_render = True
            bake_ao(list(lod0.values()), ground=A['ground'])
            for o in lod1.values(): o.hide_render = False
            for o in lod0.values(): o.hide_render = True
            bake_ao(list(lod1.values()), ground=A['ground'])
            for o in lod0.values(): o.hide_render = False
        # the model's box (game axes: x, y up, z = -Blender y) over lod0
        pts = [o.matrix_world @ Vector(c) for o in lod0.values() for c in o.bound_box]
        box_ = [[min(p.x for p in pts), min(p.z for p in pts), min(-p.y for p in pts)], [max(p.x for p in pts), max(p.z for p in pts), max(-p.y for p in pts)]]
        tr = export(os.path.join(outd, id_ + '.glb'), [lod0, lod1], ao=A['ao'])
        report[id_] = dict(tris=tr, box=box_, seconds=round(time.time() - t0, 1), ao=A['ao'])
        print('[model_props]', id_, json.dumps(report[id_]), flush=True)
    json.dump(report, open(os.path.join(outd, 'model_props.out.json'), 'w'), indent=1)
