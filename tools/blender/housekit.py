# The mud-brick house kit (D-311; session 12, UD-19): the pieces every house of the town and the villages is dressed
# from, modelled in Blender from the project's own measures (houses.ts ROOF / DOOR_H / DOOR_W; SITE_SPEC via site.ts) and
# eroded with seeded noise, their ambient occlusion baked by Cycles into the vertices from the dense mesh. Written to
# src/data/housekit.json (positions, normals, baked AO, a per-vertex shade), which houses.ts, build.ts and towndoors.ts
# place along every wall top, every roof and ceiling pole, every oven and every street door, driven by the plot data.
# Reproducible: `blender -b --factory-startup --python tools/blender/housekit.py -- <out.json>` (node tools/blender/housekit.mjs).
# Pieces (all tier C; analogues: Iranian vernacular adobe, excavated Iron Age / Achaemenid-period houses, HOUSE_PARTS):
#  crest0..2  an exposed wall top's slumped mud cap (D-324c: three stations, 38 triangles), 2 m module, unit thickness across (z in [-0.5, 0.5]), the cap
#             drooping 12 cm down both faces over the arris (rain-rounded, never a sharp edge), top at y = 0
#  log0..1    a poplar pole, unit radius and length along +y, knotty, slightly bent and tapered, checked end grain
#  tannur0..1 a bread oven: a clay cone 0.84 m across at the foot, 0.8 m high, a rolled lip round a 0.36 m mouth, the
#             mud collar banked round its foot and a draught hole at the base
#  beam0..1   an adzed timber lintel: unit box (x along, y up from 0, z across), faceted, sagging, knots
#  leaf0..2   a street door leaf of 3/4/5 poplar planks (unit width 1 across the opening, height 1), two battens behind,
#             the pivot post at x = 0 (its own piece post: unit length), a wooden pull
import bpy, bmesh, json, math, sys, random
from mathutils import Vector, noise

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'src/data/housekit.json'

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def nz(p, s, seed, oct=3):
    return noise.fractal(Vector((p[0] * s + seed * 13.1, p[1] * s + seed * 7.7, p[2] * s + seed * 3.3)), 0.5, 2.0, oct, noise_basis='PERLIN_ORIGINAL')

def mesh_from(verts, faces, shade=None, name='piece', recalc=True):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    if recalc:
        bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free(); me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    if shade is not None:
        a = me.attributes.new('shade', 'FLOAT', 'POINT')
        for i, v in enumerate(shade): a.data[i].value = v
    return ob

def smooth(ob):
    for p in ob.data.polygons: p.use_smooth = True

def bake_ao(obs, ground=None):
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 64
    try:
        sc.cycles.device = 'CPU'
    except Exception:
        pass
    sc.render.bake.target = 'VERTEX_COLORS'
    sc.world = bpy.data.worlds.new('w') if sc.world is None else sc.world
    for ob in obs:
        me = ob.data
        ca = me.color_attributes.new('ao', 'FLOAT_COLOR', 'POINT'); me.color_attributes.active_color = ca
        if not me.materials:
            m = bpy.data.materials.new('m'); me.materials.append(m)
        bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
        bpy.ops.object.bake(type='AO')

def export(ob, flat=False):
    me = ob.data; me.calc_loop_triangles()
    P, N, A, S, I = [], [], [], [], []
    ao = me.color_attributes.get('ao'); sh = me.attributes.get('shade')
    # split normals per vertex (smooth shading): use vertex normals
    for v in me.vertices:
        P += [round(v.co.x, 4), round(v.co.z, 4), round(-v.co.y, 4)]  # Blender z-up -> game y-up (x, z, -y)
        N += [round(v.normal.x, 3), round(v.normal.z, 3), round(-v.normal.y, 3)]
        A.append(round(ao.data[v.index].color[0], 3) if ao else 1.0)
        S.append(round(sh.data[v.index].value, 3) if sh else 1.0)
    if flat:  # planks: hard edges, each triangle its own corners with the face normal
        P, N, A, S, I = [], [], [], [], []
        for t in me.loop_triangles:
            fn = t.normal
            for vi in t.vertices:
                v = me.vertices[vi]; I.append(len(A))
                P += [round(v.co.x, 4), round(v.co.z, 4), round(-v.co.y, 4)]; N += [round(fn.x, 3), round(fn.z, 3), round(-fn.y, 3)]
                A.append(round(ao.data[vi].color[0], 3) if ao else 1.0); S.append(round(sh.data[vi].value, 3) if sh else 1.0)
    else:
        for t in me.loop_triangles: I += [t.vertices[0], t.vertices[1], t.vertices[2]]
    out = {'p': P, 'n': N, 'ao': A, 'k': S, 'i': I, 'tris': len(I) // 3}
    yf = me.attributes.get('yf')
    if yf is not None and not flat:  # D-324: a pole whose end keeps its shape whatever its length: p.y = yf, the end's own relief in yr
        YF = [yf.data[v.index].value for v in me.vertices]; YR = [round(v.co.z - YF[v.index] * POLE_LG, 4) for v in me.vertices]
        for k in range(len(me.vertices)): P[k * 3 + 1] = YF[k]
        out['yr'] = YR
    return out

# ---- pieces (built in Blender's z-up frame: game (x, y, z) = Blender (x, -z?..) -> we build directly as (x, -zg, yg))
def G(x, y, z):  # game coordinates -> Blender
    return (x, -z, y)

def crest(seed):
    r = random.Random(seed)
    prof = [(-0.5, -0.12), (-0.525, -0.055), (-0.455, 0.015), (0.0, 0.035), (0.455, 0.015), (0.525, -0.055), (0.5, -0.12)]  # a flat top, the sides slumped
    NX = 3; X0, X1 = -1.02, 1.02
    verts, faces, shade = [], [], []
    for ix in range(NX):
        x = X0 + (X1 - X0) * ix / (NX - 1)
        for (z, y) in prof:
            face = abs(z) > 0.45
            p = (x, y, z)
            d = 0.035 * nz(p, 1.3, seed) + 0.016 * nz(p, 3.5, seed + 1) + 0.006 * nz(p, 9.0, seed + 2)
            # rain has cut the crest: broad dips along the module
            dip = -0.035 * max(0.0, nz((x, 0, 0), 0.9, seed + 3)) * 2
            if face and y < -0.1: yy0 = y + 0.05 * nz((x, 0, z), 1.6, seed + 6)  # the droop's lower edge, ragged
            else: yy0 = y
            yy = yy0 + (d * 0.6 + dip if not face else d * 0.3)
            zz = z + (math.copysign(d * 0.5, z) if face else 0)
            if ix in (0, NX - 1): zz = z; yy = y  # module ends: the bare profile, so modules and mirrored modules meet without a step
            verts.append(G(x, yy, zz)); shade.append(0.94 + 0.12 * (0.5 + nz(p, 3.0, seed + 5)))
    n = len(prof)
    for ix in range(NX - 1):
        for k in range(n - 1):
            a = ix * n + k; b = a + 1; c = a + n + 1; d = a + n
            faces.append((a, d, c, b))
    # the ends closed (a crest seen end-on at a wall's end or a doorway shows mud, not a hollow)
    faces.append(tuple(range(n)))
    faces.append(tuple((NX - 1) * n + k for k in range(n))[::-1])
    ob = mesh_from(verts, faces, shade, f'crest{seed}'); smooth(ob); return ob

def log(seed):
    SIDES, RINGS = 5, 2
    verts, faces, shade = [], [], []
    bend = 0.35 * (random.Random(seed).random() - 0.5)
    for j in range(RINGS):
        y = j / (RINGS - 1)
        taper = 1.06 - 0.12 * y
        cx = bend * math.sin(math.pi * y)
        for s in range(SIDES):
            a = 2 * math.pi * (s + 0.5 * (j % 2) * 0.3) / SIDES
            # D-324: the bark's relief at a third of D-311's (+-15 % of the radius read as lumpy rock on the eave ends)
            rr = taper * (1 + 0.035 * nz((math.cos(a), y * 3, math.sin(a)), 1.7, seed) + 0.015 * nz((math.cos(a), y * 9, math.sin(a)), 3.1, seed + 1))
            verts.append(G(cx + math.cos(a) * rr, y, math.sin(a) * rr)); shade.append(0.9 + 0.2 * (0.5 + nz((a, y * 5, 0), 2.0, seed + 4)))
    for j in range(RINGS - 1):
        for s in range(SIDES):
            a = j * SIDES + s; b = j * SIDES + (s + 1) % SIDES
            faces.append((a, b, b + SIDES, a + SIDES))
    # end grain: a flat fan (the shade darkens it where the pole's own rings meet it)
    for (j, sgn) in ((RINGS - 1, 1), (0, -1)):
        ring = [j * SIDES + s for s in range(SIDES)]
        for s in range(1, SIDES - 1):
            tri = (ring[0], ring[s], ring[s + 1])
            faces.append(tri if sgn > 0 else tri[::-1])
    ob = mesh_from(verts, faces, shade, f'log{seed}'); smooth(ob); return ob

def tannur(seed):
    SIDES = 12
    # (radius, height) from the banked foot to the lip and down into the mouth
    prof = [(0.62, -0.08), (0.5, 0.06), (0.43, 0.22), (0.36, 0.5), (0.26, 0.72), (0.2, 0.8), (0.175, 0.78), (0.17, 0.62)]
    verts, faces, shade = [], [], []
    for j, (r0, y) in enumerate(prof):
        for s in range(SIDES):
            a = 2 * math.pi * s / SIDES
            p = (math.cos(a), y * 2, math.sin(a))
            rr = r0 * (1 + 0.035 * nz(p, 1.5, seed) + 0.012 * nz(p, 5.0, seed + 1))
            # the draught hole at the foot (a dent, darker)
            dh = math.exp(-((a - 0.4) ** 2) / 0.04 - ((y - 0.12) ** 2) / 0.004)
            rr -= 0.06 * dh
            verts.append(G(math.cos(a) * rr, y, math.sin(a) * rr)); shade.append((0.62 if j >= 6 else 0.96 + 0.1 * nz(p, 3.0, seed + 2)) * (1 - 0.6 * dh))
    for j in range(len(prof) - 1):
        for s in range(SIDES):
            a = j * SIDES + s; b = j * SIDES + (s + 1) % SIDES
            faces.append((a, b, b + SIDES, a + SIDES))
    c = len(verts); verts.append(G(0, 0.6, 0)); shade.append(0.35)
    j = len(prof) - 1
    for s in range(SIDES):
        a = j * SIDES + s; b = j * SIDES + (s + 1) % SIDES; faces.append((a, b, c))
    ob = mesh_from(verts, faces, shade, f'tannur{seed}'); smooth(ob)
    return ob

def plank_box(verts, faces, shade, x0, x1, y0, y1, z0, z1, seed, k, NY=5):
    # a plank as a box with NY rows along its height, edges eased, warped by the grain
    base = len(verts)
    ring = [(x0, z0), (x1, z0), (x1, z1), (x0, z1)]
    for j in range(NY):
        y = y0 + (y1 - y0) * j / (NY - 1)
        for (x, z) in ring:
            p = (x * 3, y, z * 3)
            w = 0.004 * nz(p, 2.0, seed) + 0.002 * nz(p, 7.0, seed + 1)
            ease = 0.004
            xx = x + (ease if x == x0 else -ease) * 0 + w
            verts.append(G(xx, y, z + w * 0.5)); shade.append(k * (0.92 + 0.14 * (0.5 + nz((x * 40, y * 0.6, 0), 1.0, seed + 3))))
    for j in range(NY - 1):
        for s in range(4):
            a = base + j * 4 + s; b = base + j * 4 + (s + 1) % 4
            faces.append((a, b, b + 4, a + 4))
    faces.append((base + 3, base + 2, base + 1, base)); t = base + (NY - 1) * 4; faces.append((t, t + 1, t + 2, t + 3))

def leaf(variant):
    r = random.Random(100 + variant)
    n = (3, 4, 5)[variant]; W = 1.0; x0 = 0.05; w = (W - 0.06 - x0 + 0.05) / n
    verts, faces, shade = [], [], []
    for k in range(n):
        a = x0 + k * w + 0.003 + 0.004 * r.random(); b = x0 + (k + 1) * w - 0.003 - 0.004 * r.random()
        kk = (0.95, 1.03, 0.9, 1.0, 0.97)[k % 5] * (0.95 + 0.1 * r.random())
        plank_box(verts, faces, shade, a, b, 0.005 + 0.006 * (k % 2), 0.975 - 0.005 * (k % 3), -0.028, 0.028, variant * 10 + k, kk)
    for y in (0.16, 0.8):
        plank_box(verts, faces, shade, 0.08, W - 0.04, y, y + 0.055, 0.028, 0.055, variant * 10 + 7 + int(y * 10), 0.86, NY=2)
    plank_box(verts, faces, shade, W - 0.2, W - 0.14, 0.5, 0.57, 0.055, 0.09, variant * 10 + 9, 0.86, NY=2)
    ob = mesh_from(verts, faces, shade, f'leaf{variant}'); return ob

def beam(seed):
    # an adzed timber lintel: a rounded-rectangle section (unit box, x along), sagging a little, the arrises eased and the
    # faces faceted by the adze (flat-shaded), knots as dents
    prof = [(-0.5, 0.1), (-0.42, 0.97), (0.42, 0.97), (0.5, 0.1), (0.4, 0.0), (-0.4, 0.0)]  # (z, y)
    NX = 2
    verts, faces, shade = [], [], []
    for ix in range(NX):
        x = -0.5 + ix / (NX - 1)
        sag = -0.04 * (1 - (2 * x) ** 2)
        for (z, y) in prof:
            p = (x * 4, y, z)
            d = 0.05 * nz(p, 1.2, seed) + 0.025 * nz(p, 3.0, seed + 1)
            verts.append(G(x, y + sag + d * 0.5, z * (1 + d))); shade.append(0.88 + 0.2 * (0.5 + nz((x * 9, y, z), 1.0, seed + 2)))
    n = len(prof)
    for ix in range(NX - 1):
        for k in range(n):
            a = ix * n + k; b = ix * n + (k + 1) % n
            faces.append((a, b, b + n, a + n))
    faces.append(tuple(range(n))[::-1]); faces.append(tuple((NX - 1) * n + k for k in range(n)))
    ob = mesh_from(verts, faces, shade, f'beam{seed}'); return ob

# ---- D-324 (session 12, second wave): the finished kit ------------------------------------------------------------------
def crest_lod(seed):
    # the crest of the middle ring (NEAR0..NEAR_R): the same slumped cap on 5 profile points and one span (14 triangles)
    prof = [(-0.5, -0.12), (-0.47, 0.012), (0.0, 0.035), (0.47, 0.012), (0.5, -0.12)]
    verts, faces, shade = [], [], []
    for ix, x in enumerate((-1.02, 1.02)):
        for (z, y) in prof:
            verts.append(G(x, y, z)); shade.append(0.97 + 0.08 * (0.5 + nz((x, y, z), 3.0, seed + 5)))
    n = len(prof)
    for k in range(n - 1): faces.append((k, k + n, k + n + 1, k + 1))
    faces.append(tuple(range(n))); faces.append(tuple(n + k for k in range(n))[::-1])
    ob = mesh_from(verts, faces, shade, f'crestL{seed}'); smooth(ob); return ob

def orient(verts, faces, want):
    # wind each face so that its normal agrees with want(centroid) (Blender coordinates): for open pieces, where
    # recalc_face_normals has no inside to go by
    out = []
    for f in faces:
        P = [Vector(verts[i]) for i in f]; c = sum(P, Vector()) / len(P)
        n = Vector()
        for i in range(len(P)): n += P[i].cross(P[(i + 1) % len(P)])
        out.append(tuple(f) if n.dot(want(c)) >= 0 else tuple(f)[::-1])
    return out

POLE_LG = 8.0  # the plog's modelled length in radii (the bake's geometry; the game stretches the body only)
def plog(seed):
    # an eave pole with its exposed end (D-324): unit radius; the body from y = 0 to the end at POLE_LG radii, eight sides of
    # smooth bark (+-3 %), slightly bent; the end chopped by the axe from two sides into a shallow ridge (in radius units: it keeps
    # its shape whatever the pole's length) and drawn with its own normals (a crisp arris); the end grain a fan from the pale
    # weathered rim to the dark heart, one or two radial checks as dark notches in the rim. The game lays the body along the
    # pole (yf 0..1) and the end's relief in radii (yr). 24 triangles
    r = random.Random(seed); S = 8; Lg = POLE_LG
    verts, faces, shade, yfs = [], [], [], []
    cd = r.random() * math.pi; ca, sa = math.cos(cd), math.sin(cd); bend = 0.3 * (r.random() - 0.5)
    chk = {r.randrange(S)}
    if r.random() < 0.7: chk.add((min(chk) + 3 + r.randrange(3)) % S)
    def yend(x, z): return Lg - 0.34 * abs(x * ca + z * sa) + 0.04 * nz((x, 0, z), 2.5, seed + 9)
    rimp = []
    for j in range(2):
        for s in range(S):
            a = 2 * math.pi * (s + 0.13 * j) / S
            rr = (1.04 - 0.08 * j) * (1 + 0.03 * nz((math.cos(a), j * 2, math.sin(a)), 1.9, seed) + 0.012 * nz((math.cos(a), j * 7, math.sin(a)), 4.1, seed + 1))
            if j == 1 and s in chk: rr *= 0.84
            x, z = math.cos(a) * rr + (bend if j else 0), math.sin(a) * rr
            y = yend(x - (bend if j else 0), z) if j else 0.0
            verts.append(G(x, y, z)); shade.append(0.86 + 0.16 * (0.5 + nz((a, j * 4, 0), 2.0, seed + 4))); yfs.append(float(j))
            if j: rimp.append((x, y, z, s in chk))
    re = len(verts)
    for (x, y, z, c) in rimp: verts.append(G(x, y, z)); shade.append(0.34 if c else 1.0 + 0.1 * nz((x * 3, 0, z * 3), 1.0, seed + 7)); yfs.append(1.0)
    pc = len(verts); verts.append(G(bend + 0.08 * (r.random() - 0.5), yend(0, 0) + 0.02, 0.08 * (r.random() - 0.5))); shade.append(0.58); yfs.append(1.0)
    tube = orient(verts, [(s, (s + 1) % S, S + (s + 1) % S, S + s) for s in range(S)], lambda c: Vector((c.x - bend * 0.5, c.y, 0)))
    end = orient(verts, [(re + s, re + (s + 1) % S, pc) for s in range(S)], lambda c: Vector((0, 0, 1)))
    ob = mesh_from(verts, tube + end, shade, f'plog{seed}', recalc=False); smooth(ob)
    a = ob.data.attributes.new('yf', 'FLOAT', 'POINT')
    for i, v in enumerate(yfs): a.data[i].value = v
    return ob

def pebble(seed):
    # a small fieldstone (a pivot stone, the drip stone under a spout): the slab's form on six sides, 30 triangles
    return slab(seed, S=6, name='pebble')

def bench(seed):
    # a mud-brick bench plastered with the wall: unit box (x along, y up from 0, z across: -0.5 against the wall, +0.5 the
    # front), the front arris slumped round, the ends rounded, the top worn hollow where people sit, the foot splashed
    r = random.Random(seed)
    prof = [(-0.5, 0.0), (-0.5, 0.97), (-0.3, 1.0), (0.3, 0.99), (0.45, 0.96), (0.5, 0.86), (0.507, 0.4), (0.5, 0.0)]
    xs = [-0.5, -0.46, -0.2, 0.2, 0.46, 0.5]
    seats = [r.uniform(-0.3, -0.05), r.uniform(0.08, 0.32)]
    verts, faces, shade = [], [], []
    for ix, x in enumerate(xs):
        end = ix in (0, len(xs) - 1)
        for (z, y) in prof:
            p = (x * 3, y, z)
            d = 0.012 * nz(p, 1.6, seed) + 0.006 * nz(p, 4.0, seed + 1)
            zz, yy = z, y
            if end: zz = z * 0.9 + 0.02; yy = y * 0.93 if y > 0.05 else y  # the ends worn round
            if y > 0.9: yy -= sum(0.035 * math.exp(-((x - s) ** 2) / 0.012) * max(0.0, 1 - abs(z) * 1.6) for s in seats)
            verts.append(G(x + (d if end else 0), yy + d * (1 if y > 0.05 else 0), zz + d))
            shade.append((1.05 if y > 0.9 else 0.97 if z > 0.4 else 0.94) * (0.86 if y < 0.12 else 1) * (0.96 + 0.08 * (0.5 + nz(p, 3.0, seed + 2))))
    n = len(prof)
    for ix in range(len(xs) - 1):
        for k in range(n - 1):
            a = ix * n + k; faces.append((a, a + n, a + n + 1, a + 1))
    faces.append(tuple(range(n))); faces.append(tuple((len(xs) - 1) * n + k for k in range(n))[::-1])
    ob = mesh_from(verts, faces, shade, f'bench{seed}'); smooth(ob); return ob

def rung(seed):
    # a ladder rung: a poplar stick, unit radius and length along +y, four-sided and rounded by the smoothing, the ends bound
    # to the rails with rawhide (a darker collar) (24 triangles; open ends inside the rails)
    S = 4; verts, faces, shade = [], [], []
    rings = [(0.0, 1.35, 0.62), (0.1, 1.0, 0.95), (0.9, 1.0, 0.95), (1.0, 1.35, 0.62)]
    bend = 0.25 * (random.Random(seed).random() - 0.5)
    for j, (y, rr, k) in enumerate(rings):
        for s in range(S):
            a = 2 * math.pi * (s + 0.5) / S + 0.2 * j
            q = rr * (1 + 0.05 * nz((math.cos(a), y * 5, math.sin(a)), 2.0, seed))
            verts.append(G(math.cos(a) * q + bend * math.sin(math.pi * y), y, math.sin(a) * q)); shade.append(k * (0.92 + 0.12 * (0.5 + nz((a, y * 6, 0), 1.5, seed + 3))))
    for j in range(len(rings) - 1):
        for s in range(S):
            a = j * S + s; b = j * S + (s + 1) % S; faces.append((a, b, b + S, a + S))
    ob = mesh_from(verts, orient(verts, faces, lambda c: Vector((c.x, c.y, 0))), shade, f'rung{seed}', recalc=False); smooth(ob); return ob

def jamb(seed):
    # a timber jamb board beside a street door: unit box (x across the board, y up from 0, z its thickness, +0.5 the face on
    # the lane), the face adzed in three facets, the arrises eased, the foot eaten back by the splash and rot, a split near
    # the top (flat-shaded)
    r = random.Random(seed)
    sec = [(-0.5, -0.5), (-0.5, 0.4), (-0.46, 0.5), (-0.16, 0.5 + 0.025 * r.random()), (0.16, 0.5 - 0.02 * r.random()), (0.46, 0.5), (0.5, 0.4), (0.5, -0.5)]
    ys = [0.0, 0.07, 0.5, 0.965, 1.0]
    verts, faces, shade = [], [], []
    for j, y in enumerate(ys):
        k = 0.88 if j == 0 else 1.0
        for (x, z) in sec:
            xx, zz = x, z
            if j == 0: xx *= 0.9; zz = z * 0.8 - 0.05  # the rotted foot
            if j == len(ys) - 1: xx *= 0.94; zz = min(z, 0.38)
            p = (x, y * 6, z)
            verts.append(G(xx + 0.01 * nz(p, 2.0, seed), y, zz + 0.012 * nz(p, 1.7, seed + 1)))
            split = 0.55 if (abs(x - 0.16) < 0.01 and y > 0.8) else 1.0
            shade.append(k * split * (0.9 + 0.2 * (0.5 + nz((x * 20, y * 1.5, 0), 1.0, seed + 3))))
    n = len(sec)
    for j in range(len(ys) - 1):
        for s in range(n - 1):
            a = j * n + s; faces.append((a, a + 1, a + n + 1, a + n))
    faces.append(tuple((len(ys) - 1) * n + k for k in range(n)))
    ob = mesh_from(verts, faces, shade, f'jamb{seed}'); return ob

def slab(seed, dip=0.0, name='stone', S=8):
    # a flat fieldstone (a doorstep, a pivot stone, a post base, the drip stone under a spout) or, with `dip`, the threshold
    # slab worn hollow in the middle by feet: unit box (x, z in [-0.5, 0.5], y from 0 to 1), an irregular rounded outline,
    # the sides bellied and the top arris eased, the top domed a little (the dip sinks it) (56 triangles)
    r = random.Random(seed)
    verts, faces, shade = [], [], []
    p4 = 3.2 + 1.5 * r.random()
    def rim(a, k):
        c, s = math.cos(a), math.sin(a); m = (abs(c) ** p4 + abs(s) ** p4) ** (-1 / p4)
        q = m * 0.5 * k * (1 + 0.07 * nz((c, 0, s), 1.4, seed))
        return c * q, s * q
    def top(x, z): return 1.0 + 0.04 * (1 - 4 * (x * x + z * z)) - dip * max(0.0, 1 - (2 * x) ** 2) * max(0.0, 1 - (1.6 * z) ** 2) + 0.03 * nz((x * 2, 0, z * 2), 1.0, seed + 3)
    RINGS = [(0.0, 0.97), (0.62, 1.02), (0.9, 0.9)] if S > 6 else [(0.0, 1.0), (0.88, 0.92)]
    for j, (y, k) in enumerate(RINGS):
        for s in range(S):
            a = 2 * math.pi * (s + 0.3 * j) / S; x, z = rim(a, k)
            verts.append(G(x, min(y, top(x, z) - 0.08) if j == len(RINGS) - 1 else y, z)); shade.append((0.86 if j == 0 else 0.97) * (0.93 + 0.14 * (0.5 + nz((x * 3, y, z * 3), 1.0, seed + 5))))
    ri = len(verts)
    for s in range(S):
        a = 2 * math.pi * (s + 0.95) / S; x, z = rim(a, 0.5)
        verts.append(G(x, top(x, z), z)); shade.append(1.05 + 0.1 * nz((x * 4, 0, z * 4), 1.0, seed + 6))
    pc = len(verts); verts.append(G(0, top(0, 0), 0)); shade.append(1.08 if dip else 1.02)
    for j in range(len(RINGS) - 1):
        for s in range(S):
            a = j * S + s; b = j * S + (s + 1) % S; faces.append((a, b, b + S, a + S))
    ar = (len(RINGS) - 1) * S
    for s in range(S):
        if S > 6: faces.append((ar + s, ar + (s + 1) % S, ri + (s + 1) % S, ri + s)); faces.append((ri + s, ri + (s + 1) % S, pc))
        else: faces.append((ar + s, ar + (s + 1) % S, pc))
    ob = mesh_from(verts, faces, shade, f'{name}{seed}'); smooth(ob); return ob

BRICK = {'len': 0.33, 'course': 0.115, 'joint': 0.016, 'plaster': 0.018}  # Achaemenid mud brick ~33 cm square (Iranica, B); the course and joint C
def brick_patch(seed, W=0.9, H=0.38):
    # exposed mud brick where the plaster has fallen off (the damp band above the footing): two pieces in metres, laid on the
    # wall face (x along it from 0 to W, y up from 0 to H, z out of the wall: 0 the plaster's face). 'bpl': the plaster round
    # the loss, flush with the face on the rectangle's edge and broken back to the brick along an irregular outline (the
    # caller colours it as the wall); 'bbr': the bricks behind it in stretcher bond, their faces eroded and eased, the joints
    # sunk (the brick material)
    r = random.Random(seed); cx, cy = W / 2, H / 2
    # the angles: the rectangle's four corners among them (so the ring's outer edge is the rectangle the wall's face leaves open)
    ac = math.atan2(H / 2, W / 2); ANG = sorted([ac, math.pi - ac, math.pi + ac, 2 * math.pi - ac] + [2 * math.pi * (s + 0.5) / 12 for s in range(12)]); N = len(ANG)
    # the loss's outline: an irregular blob within the rectangle (margins 4-10 cm)
    outl = []
    for a in ANG:
        c, sn = math.cos(a), math.sin(a)
        m = min((W / 2 - 0.05) / max(1e-6, abs(c)), (H / 2 - 0.04) / max(1e-6, abs(sn)))
        q = m * (0.72 + 0.26 * (0.5 + nz((c, sn, 0), 1.3, seed)) + 0.08 * r.random())
        q = min(q, m); outl.append((cx + c * q, cy + sn * q))
    rect = []
    for a in ANG:
        c, sn = math.cos(a), math.sin(a)
        m = min((W / 2) / max(1e-6, abs(c)), (H / 2) / max(1e-6, abs(sn))); rect.append((cx + c * m, cy + sn * m))
    # the plaster piece: the ring on the face (z = 0) and the broken edge down to the brick (z = -plaster), crumbled outward
    V, F, K = [], [], []
    pl = BRICK['plaster']
    for (x, y) in rect: V.append(G(x, y, 0.0)); K.append(1.0)
    for (x, y) in outl: V.append(G(x, y, 0.0)); K.append(0.97)
    for (x, y) in outl:
        dx, dy = x - cx, y - cy; L = math.hypot(dx, dy) or 1
        V.append(G(x - dx / L * 0.012, y - dy / L * 0.012, -pl)); K.append(0.8)  # broken back at a slope (the loss narrower at the brick)
    for s in range(N):
        t = (s + 1) % N
        F.append((s, t, N + t, N + s))                 # ring (normal +z: counter-clockwise from the lane)
        F.append((N + s, N + t, 2 * N + t, 2 * N + s))  # the broken edge, falling inward
    ring = mesh_from(V, F, K, f'bpl{seed}', recalc=False); smooth(ring)
    # the bricks: stretcher bond, courses from the bottom, each course offset by half a brick
    V, F, K = [], [], []
    def quad(a, b, c, d): F.append((a, b, c, d))
    back = -pl - 0.024
    b0 = len(V)
    for (x, y) in [(0, 0), (W, 0), (W, H), (0, H)]: V.append(G(x, y, back)); K.append(0.62)
    F.append((b0, b0 + 1, b0 + 2, b0 + 3))
    pitch_y, pitch_x = BRICK['course'] + BRICK['joint'], BRICK['len'] + BRICK['joint']
    j = 0; y = 0.006
    while y < H - 0.02:
        off = (0.5 * pitch_x if j % 2 else 0.0) - pitch_x * r.random() * 0.3
        x = off - pitch_x
        while x < W:
            x0, x1, y0, y1 = max(0.0, x), min(W, x + BRICK['len']), y, min(H, y + BRICK['course'])
            if x1 - x0 > 0.03 and y1 - y0 > 0.03:
                ez = -pl - 0.002 - 0.008 * r.random(); k = 0.9 + 0.2 * r.random(); e = 0.009
                i0 = len(V)
                for (px, py) in [(x0 + e, y0 + e), (x1 - e, y0 + e), (x1 - e, y1 - e), (x0 + e, y1 - e)]:
                    V.append(G(px + 0.004 * nz((px * 9, py * 9, 0), 1.0, seed), py, ez + 0.003 * nz((px * 7, py * 7, 1), 1.0, seed + 1))); K.append(k)
                for (px, py) in [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]:
                    V.append(G(px, py, back + 0.004)); K.append(k * 0.7)
                quad(i0, i0 + 1, i0 + 2, i0 + 3)
                for s in range(4):
                    t = (s + 1) % 4; quad(i0 + 4 + s, i0 + 4 + t, i0 + t, i0 + s)
            x += pitch_x
        y += pitch_y; j += 1
    br = mesh_from(V, F, K, f'bbr{seed}', recalc=False); smooth(br)
    return ring, br

# ---- D-364 (session 15): the wall bodies' weathering, on every face of the town and the villages ---------------------------
def repair_patch(seed, N=12):
    # a repair: a handful of fresh mud plaster smeared over a worn place by hand and float. Unit footprint (x along the face
    # 0..1, y up 0..1; the caller scales it to the patch), z out of the face in metres: ~6-10 mm proud in its body, lumpy
    # with the float's arcs, the smeared rim standing a little higher, then a ragged edge feathered to the old face (z 0)
    r = random.Random(seed); cx, cy = 0.5, 0.5
    RINGS = [(0.0, 0.0085, 1.05), (0.6, 0.0078, 1.03), (0.88, 0.0085, 0.97), (1.0, 0.0, 0.9)]
    edge = []
    for s in range(N):
        a = 2 * math.pi * s / N
        q = 0.5 * (0.8 + 0.2 * (0.5 + nz((math.cos(a), math.sin(a), 0), 1.4, seed)) + 0.08 * (r.random() - 0.5))
        edge.append(min(0.5, q))
    V, F, K = [], [], []
    V.append(G(cx, cy, RINGS[0][1] + 0.002 * nz((cx, cy, 0), 6, seed))); K.append(RINGS[0][2])
    for (f, z0, k) in RINGS[1:]:
        for s in range(N):
            a = 2 * math.pi * s / N; R = edge[s] * f
            x, y = cx + math.cos(a) * R, cy + math.sin(a) * R
            z = z0 + (0.0025 * nz((x * 3, y * 3, 0), 2.0, seed + 1) + 0.0015 * math.sin((x * 9 + y * 4) + seed) if f < 1 else 0.0)
            V.append(G(x, y, max(0.0, z))); K.append(k * (0.97 + 0.06 * (0.5 + nz((x, y, 2), 3.0, seed + 2))))
    for s in range(N):
        t = (s + 1) % N; F.append((0, 1 + s, 1 + t))
    for ri in range(len(RINGS) - 2):
        b0, b1 = 1 + ri * N, 1 + (ri + 1) * N
        for s in range(N):
            t = (s + 1) % N; F.append((b0 + s, b1 + s, b1 + t, b0 + t))
    ob = mesh_from(V, F, K, f'rpatch{seed}', recalc=False); smooth(ob); return ob

def rain_rill(seed, NX=5, NY=4):
    # a rain gully down an exposed wall from a notch in its top: x across (-0.5..0.5, the caller scales it to 12-30 cm), y
    # down the face (0 the bottom, 1 the top; the caller scales it to 0.6-1.6 m), z out of the face in metres. The water has
    # washed the coat thin in the channel and left the silt in two soft lips beside it; the channel darker (wet, then dirt),
    # narrowing to nothing at its foot
    r = random.Random(seed); V, F, K = [], [], []
    XS = [-0.5, -0.3, 0.0, 0.3, 0.5]; ZS = [0.0, 0.005, 0.001, 0.005, 0.0]; KS = [1.0, 1.05, 0.74, 1.05, 1.0]
    for j in range(NY):
        y = j / (NY - 1); w = 0.35 + 0.65 * y ** 0.6  # wider at the top
        mx = 0.06 * nz((0, y * 2.5, 0), 1.0, seed)    # the channel wanders
        for i in range(NX):
            x = XS[i] * w + mx * (1 - abs(XS[i]))
            z = ZS[i] * (0.4 + 0.6 * y) + (0.0008 * nz((x * 5, y * 7, 0), 1.0, seed + 1) if 0 < i < NX - 1 else 0.0)
            V.append(G(x, y, z)); K.append(1.0 + (KS[i] - 1.0) * (0.35 + 0.65 * y) * (0.9 + 0.2 * r.random()))
    for j in range(NY - 1):
        for i in range(NX - 1):
            a = j * NX + i; F.append((a, a + 1, a + NX + 1, a + NX))
    ob = mesh_from(V, F, K, f'rill{seed}', recalc=False); smooth(ob); return ob

def check_normals(name, ob):
    # the share of vertex normals pointing away from the piece's centre (an outward-wound closed piece: most of them)
    me = ob.data; c = sum((v.co for v in me.vertices), Vector()) / max(1, len(me.vertices))
    out = sum(1 for v in me.vertices if v.normal.dot(v.co - c) > 0) / max(1, len(me.vertices))
    return out

def main():
    clear()
    obs = {}
    for s in range(3): obs[f'crest{s}'] = crest(s + 1)
    for s in range(2): obs[f'log{s}'] = log(s + 11)
    for s in range(2): obs[f'tannur{s}'] = tannur(s + 21)
    for v in range(3): obs[f'leaf{v}'] = leaf(v)
    for v in range(2): obs[f'beam{v}'] = beam(31 + v)
    # D-324: the finished kit
    for s in range(3): obs[f'crestL{s}'] = crest_lod(s + 1)
    for s in range(3): obs[f'plog{s}'] = plog(41 + s)
    for s in range(3): obs[f'pebble{s}'] = pebble(111 + s)
    for s in range(2): obs[f'bench{s}'] = bench(51 + s)
    for s in range(2): obs[f'rung{s}'] = rung(61 + s)
    for s in range(2): obs[f'jamb{s}'] = jamb(71 + s)
    for s in range(4): obs[f'stone{s}'] = slab(81 + s)
    for s in range(2): obs[f'sill{s}'] = slab(91 + s, dip=0.3, name='sill')
    for s in range(4): obs[f'rpatch{s}'] = repair_patch(141 + s)  # D-364
    for s in range(3): obs[f'rill{s}'] = rain_rill(151 + s)
    pairs = {}
    for s in range(3): ring, br = brick_patch(101 + s); obs[f'bpl{s}'] = ring; obs[f'bbr{s}'] = br; pairs[f'bpl{s}'] = br; pairs[f'bbr{s}'] = ring
    # AO baked with each piece alone, on a ground plane where it stands on the ground (tannur) or against its wall (crest)
    for name, ob in obs.items():
        others = []
        if name in pairs: others.append(pairs[name])
        if name.startswith('bench') or name.startswith('stone') or name.startswith('sill') or name.startswith('pebble'):
            bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0.0)); others.append(bpy.context.active_object)
        if name.startswith('bench'):  # the court wall behind it
            bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 1.0, 1.0)); c = bpy.context.active_object; c.scale = (3, 1.0, 2.0); others.append(c)
        if name.startswith('plog'):  # the wall it comes out of (Blender z < POLE_LG - 5: the exposed end is ~5 radii)
            bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, POLE_LG - 5 - 20)); c = bpy.context.active_object; c.scale = (40, 40, 40); others.append(c)
        if name.startswith('rpatch') or name.startswith('rill'):  # D-364: the wall face they lie on (game z = 0: Blender y = 0)
            bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0.0005, 0.5), rotation=(math.pi / 2, 0, 0)); others.append(bpy.context.active_object)
        if name.startswith('tannur'):
            bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0, -0.06)); others.append(bpy.context.active_object)
        if name.startswith('crest'):
            # the wall under the cap: a box 1 wide, 1 m down
            bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -0.6)); c = bpy.context.active_object; c.scale = (2.2, 0.98, 1.0); others.append(c)
        for o in bpy.context.scene.objects: o.hide_render = (o is not ob and o not in others)
        bake_ao([ob])
        for o in others:
            if o.name in obs or any(o is q for q in obs.values()): continue
            bpy.data.objects.remove(o)
    out = {'about': 'D-311 house kit (tools/blender/housekit.py): pieces modelled and AO-baked in Blender 5 (Cycles, vertex AO), game axes y-up; tier C', 'pieces': {}}
    for name, ob in obs.items(): out['pieces'][name] = export(ob, name.startswith('leaf') or name.startswith('beam') or name.startswith('jamb'))
    print('[housekit] outward normals', {k: round(check_normals(k, ob), 2) for k, ob in obs.items() if not k.startswith('bpl') and not k.startswith('bbr') and not k.startswith('rpatch') and not k.startswith('rill')})
    with open(OUT, 'w') as f: json.dump(out, f, separators=(',', ':'))
    print('[housekit] wrote', OUT, {k: v['tris'] for k, v in out['pieces'].items()})

main()
