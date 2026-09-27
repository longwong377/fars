# The mud-brick house kit (D-311; session 12, UD-19): the pieces every house of the town and the villages is dressed
# from, modelled in Blender from the project's own measures (houses.ts ROOF / DOOR_H / DOOR_W; SITE_SPEC via site.ts) and
# eroded with seeded noise, their ambient occlusion baked by Cycles into the vertices from the dense mesh. Written to
# src/data/housekit.json (positions, normals, baked AO, a per-vertex shade), which houses.ts, build.ts and towndoors.ts
# place along every wall top, every roof and ceiling pole, every oven and every street door, driven by the plot data.
# Reproducible: `blender -b --factory-startup --python tools/blender/housekit.py -- <out.json>` (node tools/blender/housekit.mjs).
# Pieces (all tier C; analogues: Iranian vernacular adobe, excavated Iron Age / Achaemenid-period houses, HOUSE_PARTS):
#  crest0..2  an exposed wall top's slumped mud cap, 2 m module, unit thickness across (z in [-0.5, 0.5]), the cap
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

def mesh_from(verts, faces, shade=None, name='piece'):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
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
    return {'p': P, 'n': N, 'ao': A, 'k': S, 'i': I, 'tris': len(I) // 3}

# ---- pieces (built in Blender's z-up frame: game (x, y, z) = Blender (x, -z?..) -> we build directly as (x, -zg, yg))
def G(x, y, z):  # game coordinates -> Blender
    return (x, -z, y)

def crest(seed):
    r = random.Random(seed)
    prof = [(-0.5, -0.14), (-0.51, -0.05), (-0.42, 0.03), (0.0, 0.06), (0.42, 0.03), (0.51, -0.05), (0.5, -0.14)]
    NX = 4; X0, X1 = -1.02, 1.02
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
            rr = taper * (1 + 0.1 * nz((math.cos(a), y * 3, math.sin(a)), 1.7, seed) + 0.05 * nz((math.cos(a), y * 9, math.sin(a)), 3.1, seed + 1))
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

def main():
    clear()
    obs = {}
    for s in range(3): obs[f'crest{s}'] = crest(s + 1)
    for s in range(2): obs[f'log{s}'] = log(s + 11)
    for s in range(2): obs[f'tannur{s}'] = tannur(s + 21)
    for v in range(3): obs[f'leaf{v}'] = leaf(v)
    for v in range(2): obs[f'beam{v}'] = beam(31 + v)
    # AO baked with each piece alone, on a ground plane where it stands on the ground (tannur) or against its wall (crest)
    for name, ob in obs.items():
        others = []
        if name.startswith('tannur'):
            bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0, -0.06)); others.append(bpy.context.active_object)
        if name.startswith('crest'):
            # the wall under the cap: a box 1 wide, 1 m down
            bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, -0.6)); c = bpy.context.active_object; c.scale = (2.2, 0.98, 1.0); others.append(c)
        for o in bpy.context.scene.objects: o.hide_render = (o is not ob and o not in others)
        bake_ao([ob])
        for o in others: bpy.data.objects.remove(o)
    out = {'about': 'D-311 house kit (tools/blender/housekit.py): pieces modelled and AO-baked in Blender 5 (Cycles, vertex AO), game axes y-up; tier C', 'pieces': {}}
    for name, ob in obs.items(): out['pieces'][name] = export(ob, name.startswith('leaf') or name.startswith('beam'))
    with open(OUT, 'w') as f: json.dump(out, f, separators=(',', ':'))
    print('[housekit] wrote', OUT, {k: v['tris'] for k, v in out['pieces'].items()})

main()
