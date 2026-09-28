# D-334: the palaces' roof-edge kit: the pieces the eye reads along every roof edge of the Terrace (src/arch/roofedge.ts),
# modelled in Blender and their ambient occlusion baked by Cycles into the vertices against the wall they come out of, as the
# house kit (D-311, tools/blender/housekit.py). Written to src/data/palacekit.json (positions, normals, baked AO, a per-vertex
# shade; game axes: x along the wall, y up, z out of the wall face; the origin at the piece's foot on the wall face).
#  - dentil0..2: the end of a ceiling joist standing out of the portico's entablature (the dentil row of the Naqsh-e Rustam
#    facades, A as the palace portico's image in stone; here the cedar itself, C): a squared cedar joist 0.16 x 0.2 m, its
#    arrises eased by the adze, its end sawn a little off square and checked (one or two radial splits from the pith), the
#    end grain darker than the side grain, growth rings as a shade; 0.16 m proud of the fasciae (ROOFEDGE.dentil).
#  - dentilL: the far level (a 12-triangle block with the same end shade).
#  - spout0..1: a rain spout through the parapet's foot: a cedar half-log hollowed into a trough (0.22 x 0.14 m), its end
#    chopped, the channel and the lip darkened by the water (C: roof spouts of the region's flat-roofed building; at the
#    Terrace the rock-cut drains are attested, TERRACE-DRAINS, the spouts are not). Unit length out of the wall (the game
#    scales z by ROOFEDGE.spout.proj); spoutL its far level.
# Reproducible: blender -b --factory-startup --python tools/blender/palacekit.py -- <out.json>
import bpy, bmesh, json, math, sys, random
from mathutils import Vector, noise

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'src/data/palacekit.json'

def nz(p, s, seed, oct=3):
    return noise.fractal(Vector((p[0] * s + seed * 13.1, p[1] * s + seed * 7.7, p[2] * s + seed * 3.3)), 0.5, 2.0, oct, noise_basis='PERLIN_ORIGINAL')

def G(x, y, z):  # game (x along, y up, z out) -> Blender z-up (x, -z, y)
    return (x, -z, y)

def mesh_from(verts, faces, shade, name):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.to_mesh(me); bm.free(); me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    a = me.attributes.new('shade', 'FLOAT', 'POINT')
    for i, v in enumerate(shade): a.data[i].value = v
    return ob

def rrect(w, h, r, n_c=3):
    # a rounded rectangle (x, y), centred on (0, h/2), corners of radius r with n_c+1 points each, counter-clockwise
    pts = []
    for (cx, cy, a0) in [(w / 2 - r, r, -90), (w / 2 - r, h - r, 0), (-w / 2 + r, h - r, 90), (-w / 2 + r, r, 180)]:
        for k in range(n_c + 1):
            a = math.radians(a0 + 90 * k / n_c); pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts

def dentil(seed, W=0.16, H=0.2, P=0.16, back=0.06):
    r = random.Random(seed); ring = rrect(W, H, 0.012 + 0.006 * r.random())
    # the adze's facets on the sides: each section point pushed in or out a little (flat-ish facets along the length)
    verts, faces, shade = [], [], []
    tilt_x, tilt_y = r.uniform(-0.05, 0.05), r.uniform(-0.08, 0.02)  # the saw cut a little off square
    zs = [-back, 0.0, P * 0.5, P]
    n = len(ring)
    for zi, z in enumerate(zs):
        for k, (x, y) in enumerate(ring):
            d = 0.004 * nz((x * 8, y * 8, z * 3), 1.0, seed) + 0.002 * nz((x, y, z), 20, seed + 1)
            l = math.hypot(x, y - H / 2) or 1
            zz = z + (tilt_x * x + tilt_y * (y - H / 2) if zi == len(zs) - 1 else 0)
            verts.append(G(x + d * x / l, y + d * (y - H / 2) / l, zz)); shade.append(0.95 + 0.1 * nz((x * 30, y * 30, z * 4), 1.0, seed + 2))
    for zi in range(len(zs) - 1):
        for k in range(n):
            a = zi * n + k; b = zi * n + (k + 1) % n; faces.append((a, b, b + n, a + n))
    # the end face: concentric rings toward the pith (off centre: the joist was cut from a quarter of the log), growth-ring shade,
    # and one or two checks: radial splits 4-8 mm deep
    pith = (r.uniform(-0.06, 0.06), H / 2 + r.uniform(-0.08, 0.08))
    checks = [r.uniform(0, 2 * math.pi) for _ in range(r.choice([1, 2]))]
    last = (len(zs) - 1) * n; rings = 5
    prev = list(range(last, last + n))
    for ri in range(1, rings + 1):
        f = 1 - ri / (rings + 0.6); cur = []
        for k, (x, y) in enumerate(ring):
            px, py = pith[0] + (x - pith[0]) * f, pith[1] + (y - pith[1]) * f
            ang = math.atan2(py - pith[1], px - pith[0])
            split = max(math.exp(-((math.remainder(ang - c, 2 * math.pi)) / 0.12) ** 2) for c in checks)
            zz = P + tilt_x * px + tilt_y * (py - H / 2) - 0.006 * split * (1 - f * 0.3) + 0.0015 * nz((px * 40, py * 40, 0), 1.0, seed + 5)
            verts.append(G(px, py, zz)); cur.append(len(verts) - 1)
            shade.append((0.74 if ri % 2 else 0.82) * (1 - 0.35 * split))  # end grain darker than the side; the latewood rings
        for k in range(n): faces.append((prev[k], prev[(k + 1) % n], cur[(k + 1) % n], cur[k]))
        prev = cur
    for k in range(n): shade[last + k] = 0.78  # the end face's rim
    cx, cy = pith; verts.append(G(cx, cy, P + tilt_x * cx + tilt_y * (cy - H / 2) - 0.002)); shade.append(0.6); c = len(verts) - 1
    for k in range(n): faces.append((prev[k], prev[(k + 1) % n], c))
    faces.append(tuple(range(n))[::-1])  # the back (in the wall)
    return mesh_from(verts, faces, shade, f'dentil{seed}')

def box_piece(W, H, P, back, end_shade, name):
    x0, x1, y0, y1, z0, z1 = -W / 2, W / 2, 0, H, -back, P
    verts = [G(x0, y0, z0), G(x1, y0, z0), G(x1, y1, z0), G(x0, y1, z0), G(x0, y0, z1), G(x1, y0, z1), G(x1, y1, z1), G(x0, y1, z1)]
    faces = [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    return mesh_from(verts, faces, [0.95] * 4 + [end_shade] * 4, name)

def spout(seed, W=0.22, H=0.14, back=0.35, n_out=11):
    # the trough's section: a half-log's round underside, flat top edges, the channel hollowed (x, y); extruded along z (unit
    # length out of the wall, the channel open at the top)
    r = random.Random(seed)
    outer = [(W / 2 * math.cos(a), H * 0.5 + H * 0.5 * math.sin(a)) for a in [math.radians(-t) for t in [0, 30, 60, 90, 120, 150, 180]]]
    outer = [(W / 2, H)] + outer + [(-W / 2, H)]
    ci = 0.07; inner = [(-ci, H), (-ci * 0.9, H * 0.62), (-ci * 0.5, H * 0.45), (0, H * 0.42), (ci * 0.5, H * 0.45), (ci * 0.9, H * 0.62), (ci, H)]
    sec = outer + inner  # a closed ring: round the outside from +x to -x, then back along the channel
    zs = [-back, 0.0, 0.35, 0.7, 1.0]
    verts, faces, shade = [], [], []
    n = len(sec)
    for zi, z in enumerate(zs):
        droop = -0.02 * (max(0, z) ** 2)  # a slight droop and a chop at the end
        for k, (x, y) in enumerate(sec):
            d = 0.005 * nz((x * 6, y * 6, z * 2), 1.0, seed)
            zz = z - (0.04 * (y / H) if zi == len(zs) - 1 else 0) + (0.01 * nz((x * 20, y, 0), 1.0, seed + 3) if zi == len(zs) - 1 else 0)
            verts.append(G(x * (1 + d * 4), y + droop + d, zz))
            wet = (k > len(outer) - 1) * (0.25 + 0.35 * max(0, z)) + (0.3 * max(0, z) ** 3 if y < H * 0.4 else 0)  # the channel and the underside of the tip
            shade.append((0.9 + 0.1 * nz((x * 30, y * 30, z * 5), 1.0, seed + 2)) * (1 - 0.45 * min(1, wet)))
    for zi in range(len(zs) - 1):
        for k in range(n):
            a = zi * n + k; b = zi * n + (k + 1) % n; faces.append((a, b, b + n, a + n))
    last = (len(zs) - 1) * n
    # the end: a fan from the end section's centre, the end grain darker
    for k in range(n): shade[last + k] *= 0.8
    verts.append(G(0, H * 0.2, 1.0 - 0.05)); shade.append(0.7); c = len(verts) - 1
    for k in range(n): faces.append((last + k, last + (k + 1) % n, c))
    faces.append(tuple(range(n))[::-1])
    return mesh_from(verts, faces, shade, f'spout{seed}')

def bake_ao(ob, wall_back):
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = 128; sc.cycles.device = 'CPU'; sc.cycles.seed = 0
    sc.render.bake.target = 'VERTEX_COLORS'
    if sc.world is None: sc.world = bpy.data.worlds.new('w')
    sc.world.light_settings.distance = 0.3
    # the wall the piece comes out of: a slab behind z = 0 (game), Blender y > 0
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0.5 + 0.0005, 0)); wall = bpy.context.active_object; wall.scale = (4, 1, 4)
    for o in bpy.context.scene.objects: o.hide_render = (o is not ob and o is not wall)
    me = ob.data; ca = me.color_attributes.new('ao', 'FLOAT_COLOR', 'POINT'); me.color_attributes.active_color = ca
    if not me.materials: me.materials.append(bpy.data.materials.new('m'))
    bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.bake(type='AO'); bpy.data.objects.remove(wall)

def export(ob, flat):
    me = ob.data; me.calc_loop_triangles(); ao = me.color_attributes.get('ao'); sh = me.attributes.get('shade')
    P, N, A, S, I = [], [], [], [], []
    if flat:
        for t in me.loop_triangles:
            fn = t.normal
            for vi in t.vertices:
                v = me.vertices[vi]; I.append(len(A))
                P += [round(v.co.x, 4), round(v.co.z, 4), round(-v.co.y, 4)]; N += [round(fn.x, 3), round(fn.z, 3), round(-fn.y, 3)]
                A.append(round(ao.data[vi].color[0], 3)); S.append(round(sh.data[vi].value, 3))
    else:
        for v in me.vertices:
            P += [round(v.co.x, 4), round(v.co.z, 4), round(-v.co.y, 4)]; N += [round(v.normal.x, 3), round(v.normal.z, 3), round(-v.normal.y, 3)]
            A.append(round(ao.data[v.index].color[0], 3)); S.append(round(sh.data[v.index].value, 3))
        for t in me.loop_triangles: I += list(t.vertices)
    return {'p': P, 'n': N, 'ao': A, 'k': S, 'i': I, 'tris': len(I) // 3}

def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    obs = {}
    for s in range(3): obs[f'dentil{s}'] = dentil(201 + s)
    obs['dentilL'] = box_piece(0.16, 0.2, 0.16, 0.0, 0.76, 'dentilL')
    for s in range(2): obs[f'spout{s}'] = spout(211 + s)
    obs['spoutL'] = box_piece(0.22, 0.14, 1.0, 0.0, 0.7, 'spoutL')
    for name, ob in obs.items(): bake_ao(ob, 0)
    out = {'about': 'D-334 palace roof-edge kit (tools/blender/palacekit.py): pieces modelled and AO-baked in Blender 5 (Cycles, vertex AO), game axes (x along the wall, y up, z out of its face); tier C', 'blender': bpy.app.version_string, 'pieces': {}}
    # the adzed and sawn pieces flat-shaded (their facets read), the far levels too
    for name, ob in obs.items(): out['pieces'][name] = export(ob, True)
    with open(OUT, 'w') as f: json.dump(out, f, separators=(',', ':'))
    print('[palacekit] wrote', OUT, {k: v['tris'] for k, v in out['pieces'].items()})

main()
