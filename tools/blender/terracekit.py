# D-803: the Terrace kit, batch 1: the palaces' wall-head cornice and wall-foot plinth, modelled in Blender and their ambient
# occlusion baked by Cycles into the vertices against the wall they stand on (the palace kit's method, palacekit.py, D-334).
# Written to src/arch/terracekit.json (positions, normals, baked AO, the paint as a per-vertex colour (sRGB) and a shade; game
# axes: x along the wall (0..1 m: the game scales x to the run), y up, z out of the wall face; the origin at the piece's foot on
# the wall face, x = 0).
#  - cornice0..2 (near) / corniceL (far): the Egyptian-gorge cornice of the Persepolis stone frames and the Naqsh-e Rustam
#    facades (A for the form in stone; here in plaster over the mud brick at every palace wall head, C): a torus roll at the
#    foot, the cavetto flaring 0.36 m out with its vertical tongues (8 per metre, each a shallow rib), a fillet on top; painted
#    (D-755's palette): the roll red ochre, the tongues Egyptian blue and white by turns, the fillet white. 0.72 m tall.
#  - plinth0..1 / plinthL: the wall foot's torus base over a low fillet (0.24 m, 0.14 m proud), red ochre (the dado's paint).
# Reproducible: blender -b --factory-startup --python tools/blender/terracekit.py -- <out.json>  (or bpy: bpy_cli.sh)
import bpy, bmesh, json, math, sys, random
from mathutils import Vector, noise

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'src/arch/terracekit.json'
RED, BLUE, WHITE, OCHRE = (0.58, 0.24, 0.17), (0.2, 0.36, 0.62), (0.92, 0.9, 0.84), (0.78, 0.6, 0.32)

def G(x, y, z):  # game (x along, y up, z out) -> Blender z-up (x, -z, y)
    return (x, -z, y)

def nz(p, s, seed):
    return noise.noise(Vector((p[0] * s + seed * 13.1, p[1] * s + seed * 7.7, p[2] * s + seed * 3.3)))

def sweep(profile, cols, nx, rib, seed, name, wobble=0.004):
    """a profile (list of (z, y) from the wall up, with a colour per point) swept along x 0..1 in nx steps; rib(x, i) adds
    out-of-plane relief (m, along the profile's normal) at profile point i; the ends capped"""
    r = random.Random(seed); verts, faces, col, shade = [], [], [], []
    n = len(profile)
    # the profile's outward normals (in the z-y plane)
    nrm = []
    for i in range(n):
        a = profile[max(0, i - 1)]; b = profile[min(n - 1, i + 1)]; dz, dy = b[0] - a[0], b[1] - a[1]; l = math.hypot(dz, dy) or 1
        nrm.append((dy / l, -dz / l))
    for k in range(nx + 1):
        x = k / nx
        for i, (z, y) in enumerate(profile):
            d = rib(x, i) + wobble * nz((x * 3, y * 3, z * 3), 1.0, seed) * (1 if 0 < i < n - 1 else 0)
            verts.append(G(x, y + nrm[i][1] * d, z + nrm[i][0] * d))
            c = cols(x, i); col.append(c); shade.append(0.94 + 0.08 * nz((x * 9, y * 9, z * 9), 1.0, seed + 1))
    for k in range(nx):
        for i in range(n - 1):
            a = k * n + i; b = a + 1; c = a + n + 1; d = a + n
            faces.append((a, d, c, b))
    # end caps (the profile closed against the wall)
    faces.append(tuple(range(n))); faces.append(tuple(nx * n + i for i in range(n))[::-1])
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free(); me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    a = me.attributes.new('shade', 'FLOAT', 'POINT'); p = me.attributes.new('paint', 'FLOAT_COLOR', 'POINT')
    for i, v in enumerate(shade): a.data[i].value = v
    for i, c in enumerate(col): p.data[i].color = (c[0], c[1], c[2], 1)
    return ob

def cornice_profile(fine):
    pts = [(0.0, 0.0)]
    # the torus roll: a half circle out from the wall, centre (0.0, 0.09), radius 0.09 (8 or 3 segments)
    m = 6 if fine else 3
    for j in range(1, m):
        a = -math.pi / 2 + math.pi * j / m; pts.append((0.09 * math.cos(a) + 0.0, 0.09 + 0.09 * math.sin(a)))
    pts.append((0.02, 0.18))
    # the cavetto: a quarter-ellipse hollow from (0.02, 0.18) out to (0.34, 0.62) (concave: its centre outside, at (0.34, 0.18))
    m = 7 if fine else 3
    for j in range(1, m + 1):
        a = math.pi - (math.pi / 2) * j / m; pts.append((0.34 + 0.32 * math.cos(a), 0.18 + 0.44 * math.sin(a)))
    pts += [(0.36, 0.62), (0.36, 0.72), (0.0, 0.72)]
    return pts

def cornice(seed, fine=True):
    prof = cornice_profile(fine); n = len(prof); m_t = (6 if fine else 3) + 1
    def cols(x, i):
        if i < m_t: return RED
        if i >= n - 3: return WHITE
        return BLUE if int(x * 8) % 2 == 0 else WHITE
    def rib(x, i):  # the tongues: a shallow rib per 1/8 m across the cavetto, strongest at its middle
        if not fine or i < m_t or i >= n - 3: return 0.0
        t = (i - m_t) / max(1, n - 3 - m_t); f = (x * 8) % 1.0
        return 0.018 * math.sin(math.pi * t) * (0.5 + 0.5 * math.cos(2 * math.pi * (f - 0.5)))
    return sweep(prof, cols, 16 if fine else 1, rib, seed, f'cornice{seed}' if fine else 'corniceL', 0.003 if fine else 0)

def plinth(seed, fine=True):
    m = 7 if fine else 2
    pts = [(0.0, 0.0), (0.14, 0.0), (0.14, 0.05)]
    for j in range(1, m):
        a = -math.pi / 2 + math.pi * j / m; pts.append((0.06 + 0.08 * math.cos(a), 0.13 + 0.08 * math.sin(a)))
    pts += [(0.02, 0.22), (0.02, 0.24), (0.0, 0.24)]
    return sweep(pts, lambda x, i: RED, 2 if fine else 1, lambda x, i: 0.0, seed, f'plinth{seed}' if fine else 'plinthL', 0.004 if fine else 0)

COAT, DARK = (0.82, 0.8, 0.74), (0.1, 0.085, 0.07)

def window(seed, fine=True, W=1.5, H=3.0, D=0.35):
    """a Persepolis stone window frame round a blind opening W x H, origin at the opening's foot centre on the wall face: the
    recess D deep (dark), three stepped fasciae round it (the rock-tomb doorways' frame, A for the form), a sill, and over the
    lintel a torus and the Egyptian gorge with its tongues (painted blue and white), all under the whitish coat (D-752)"""
    r = random.Random(seed); verts, faces, col, shade = [], [], [], []
    def box(x0, x1, y0, y1, z0, z1, c, skip_back=True):
        b = len(verts)
        for (x, y, z) in [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]:
            verts.append(G(x, y, z)); col.append(c); shade.append(0.95 + 0.06 * r.random())
        for f in [(4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)] + ([] if skip_back else [(3, 2, 1, 0)]):
            faces.append(tuple(b + i for i in f))
    hw = W / 2
    # the recess: its back and reveals (dark), as a box set into the wall
    b = len(verts)
    for (x, y, z) in [(-hw, 0, -D), (hw, 0, -D), (hw, H, -D), (-hw, H, -D), (-hw, 0, 0), (hw, 0, 0), (hw, H, 0), (-hw, H, 0)]:
        verts.append(G(x, y, z)); col.append(DARK); shade.append(1.0)
    for f in [(0, 1, 2, 3), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]: faces.append(tuple(b + i for i in f))
    # the three fasciae: each a frame band a little wider and less proud than the one inside it
    for k, (w, p) in enumerate([(0.14, 0.12), (0.12, 0.08), (0.12, 0.04)]):
        o = sum(x[0] for x in [(0.14, 0), (0.12, 0), (0.12, 0)][:k]); a0, a1 = hw + o, hw + o + w
        box(-a1, -a0, -o - w if fine else -a1 + hw, H + o, 0, p, COAT); box(a0, a1, -o - w if fine else -a1 + hw, H + o, 0, p, COAT)
        box(-a1, a1, H + o, H + o + w, 0, p, COAT)
    T = hw + 0.38
    box(-T, T, -0.5, -0.38, 0, 0.14, COAT)  # the sill
    # the head: a torus band and the gorge over it, swept across the frame
    yH = H + 0.38
    box(-T - 0.04, T + 0.04, yH, yH + 0.09, 0, 0.16, COAT)
    m = 6 if fine else 2; nx = 18 if fine else 1; base = len(verts); prof = []
    for j in range(m + 1):
        a = math.pi - (math.pi / 2) * j / m; prof.append((0.3 + 0.28 * math.cos(a), yH + 0.09 + 0.36 * math.sin(a)))
    prof += [(0.32, yH + 0.45), (0.32, yH + 0.53), (0.0, yH + 0.53)]
    n = len(prof)
    for kx in range(nx + 1):
        x = -T - 0.08 + (2 * T + 0.16) * kx / nx
        for i, (z, y) in enumerate(prof):
            tongue = 0.012 * (0.5 + 0.5 * math.cos(2 * math.pi * ((x * 8) % 1.0 - 0.5))) if fine and 0 < i < m else 0
            verts.append(G(x, y, z + tongue)); col.append((BLUE if int((x + 10) * 8) % 2 == 0 else WHITE) if i <= m else COAT); shade.append(1.0)
    for kx in range(nx):
        for i in range(n - 1):
            a = base + kx * n + i; faces.append((a, a + n, a + n + 1, a + 1))
    faces.append(tuple(base + i for i in range(n))); faces.append(tuple(base + nx * n + i for i in range(n))[::-1])
    name = f'window{seed}' if fine else 'windowL'
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free(); me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    a = me.attributes.new('shade', 'FLOAT', 'POINT'); pc = me.attributes.new('paint', 'FLOAT_COLOR', 'POINT')
    for i, v in enumerate(shade): a.data[i].value = v
    for i, c in enumerate(col): pc.data[i].color = (c[0], c[1], c[2], 1)
    return ob

def bake_ao(ob):
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 64; sc.cycles.device = 'CPU'; sc.cycles.seed = 0
    sc.render.bake.target = 'VERTEX_COLORS'
    if sc.world is None: sc.world = bpy.data.worlds.new('w')
    sc.world.light_settings.distance = 0.4
    # the wall behind z = 0 (game) and the floor/roof it meets: a slab behind, Blender y > 0
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.5, 0.5 + 0.0005, 0.5)); wall = bpy.context.active_object; wall.scale = (8, 1, 12)
    for o in bpy.context.scene.objects: o.hide_render = (o is not ob and o is not wall)
    me = ob.data; ca = me.color_attributes.new('ao', 'FLOAT_COLOR', 'POINT'); me.color_attributes.active_color = ca
    if not me.materials: me.materials.append(bpy.data.materials.new('m'))
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type='AO'); bpy.data.objects.remove(wall)

def export(ob):
    me = ob.data; me.calc_loop_triangles(); ao = me.color_attributes.get('ao'); sh = me.attributes.get('shade'); pc = me.attributes.get('paint')
    P, N, A, S, C, I = [], [], [], [], [], []
    for v in me.vertices:
        P += [round(v.co.x, 4), round(v.co.z, 4), round(-v.co.y, 4)]; N += [round(v.normal.x, 3), round(v.normal.z, 3), round(-v.normal.y, 3)]
        A.append(round(ao.data[v.index].color[0], 3)); S.append(round(sh.data[v.index].value, 3)); C += [round(c, 3) for c in pc.data[v.index].color[:3]]
    for t in me.loop_triangles: I += list(t.vertices)
    return {'p': P, 'n': N, 'ao': A, 'k': S, 'c': C, 'i': I, 'tris': len(I) // 3}

def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    obs = {}
    for s in range(3): obs[f'cornice{s}'] = cornice(s)
    obs['corniceL'] = cornice(9, False)
    for s in range(2): obs[f'plinth{s}'] = plinth(s)
    obs['plinthL'] = plinth(9, False)
    obs['window0'] = window(0)
    obs['windowL'] = window(9, False)
    for ob in obs.values(): bake_ao(ob)
    out = {'about': 'D-803 Terrace kit (tools/blender/terracekit.py): batch 1 the palaces\' wall-head cornice and wall-foot plinth, batch 2 the stone window frame, modelled and AO-baked in Blender (Cycles, vertex AO); game axes (x along the wall 0..1 m, y up, z out of its face); c = paint (sRGB); tier C', 'blender': bpy.app.version_string, 'pieces': {}}
    for name, ob in obs.items(): out['pieces'][name] = export(ob)
    with open(OUT, 'w') as f: json.dump(out, f, separators=(',', ':'))
    print('[terracekit] wrote', OUT, {k: v['tris'] for k, v in out['pieces'].items()})

main()
