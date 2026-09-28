# PARSA (D-329): the tomb façade of Naqsh-e Rustam (exec'd by tools/blender/naqsh.py: job, OUT, ml, np, bpy, bmesh, sc, stats,
# clear are in scope). One model serves both tombs (the Xerxes façade repeats the design, D-033; its inscription panels are the
# builder's). Frame: X along the face from the tomb's axis, Y into the rock from the recess back (Y 0), Z height above the
# ancient foot; glTF (y-up) gives the game (x, h, out). Everything the game drew as boxes (naqsh.ts tombFacade) is modelled:
#  - the cross-shaped recess (its back with the door opening, its walls; the dressed margin round it stays the cliff's);
#  - four engaged columns: square plinth and torus base (C), a smooth half-engaged shaft tapering 0.38 -> 0.35 m (C), an
#    astragal, and the double-bull protome capital: the project's own protome model (tools/blender/sources/protome.ts, the
#    Apadana carving) at the tomb's shaft diameter (0.76 m: C), engaged in the back wall;
#  - the entablature: architrave of three fasciae, dentils, cornice (programme B; sizes naqsh.ts, C);
#  - the doorway: three receding bands round the opening and the cavetto ("Egyptian") cornice over a torus roll (C, the
#    Persepolis doorways' form), the sealing slab set back in the reveal;
#  - the upper register's throne: the dais's two stretchers and its top slab with bead mouldings, the two legs with turned
#    rings and lion's-paw feet (C, the reliefs' throne type), the ground line and the king's three-stepped podium.
# The high version for the bake: the architecture itself (its bevelled arrises and occlusion), the protomes at their carved source. Maps: normal + AO (0.6 m), 2048^2, one Smart-UV atlas.
from mathutils import Vector, Matrix
Fd = job['facade']
h0, hL, hM, hU = Fd['foot_above_ground_m'], Fd['lower_arm_h_m'], Fd['median_register_h_m'], Fd['upper_arm_h_m']
aw, mw, R = Fd['arm_w_m'] / 2, Fd['median_register_w_m'] / 2, Fd['recess_m']
hMid, hTop = h0 + hL, h0 + hL + hM; hEnd = hTop + hU
ch, dw, dh, r0 = Fd['column_h_m'], Fd['door_w_m'], Fd['door_h_m'], Fd['col_r']
span, bearerH = Fd['span'], Fd['bearer_h']
rng = np.random.default_rng(33)
clear()
parts = []

def obj(me, name='p'):
    o = bpy.data.objects.new(name, me); sc.collection.objects.link(o); parts.append(o); return o
def box(x0, x1, y0, y1, z0, z1, bev=0.01):
    """an axis box; y is OUT of the wall here (out 0 = the back plane): Blender Y = -out"""
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector(((x0 + x1) / 2 + v.co.x * (x1 - x0), -((y0 + y1) / 2 + v.co.y * (y1 - y0)), (z0 + z1) / 2 + v.co.z * (z1 - z0)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])   # (the y -> -out mirror turned the cube inside out)
    if bev > 0: bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bev, segments=1, affect='EDGES', profile=0.5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new('b'); bm.to_mesh(me); bm.free(); return obj(me)
def lathe(profile, cx, z0, seg=24, out_only=True):
    """a solid of revolution about the vertical axis at (cx, back plane): profile [(r, z)] bottom to top; the half out of
    the wall (plus a sliver into it) when out_only"""
    bm = bmesh.new(); a0, a1 = (-0.05, math.pi + 0.05) if out_only else (0, 2 * math.pi)
    n = seg + 1 if out_only else seg; rings = []
    for (r, z) in profile:
        ring = []
        for k in range(n):
            a = a0 + (a1 - a0) * k / (n - 1 if out_only else n)
            ring.append(bm.verts.new((cx + r * math.cos(a), -r * math.sin(a), z0 + z)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        for k in range(n - 1 if out_only else n):
            k2 = (k + 1) % n; f = bm.faces.new((rings[i][k], rings[i][k2], rings[i + 1][k2], rings[i + 1][k])); f.normal_update(); c = f.calc_center_median()
            if f.normal.dot(Vector((c.x - cx, c.y, 0))) < 0: f.normal_flip()   # radially out
    me = bpy.data.meshes.new('l'); bm.to_mesh(me); bm.free(); me.polygons.foreach_set('use_smooth', np.ones(len(me.polygons), bool)); return obj(me)
def extrude_poly(pts, y_front, y_back):
    """a planar polygon [(x, z)] as a prism between out = y_front and out = y_back (y_front > y_back)"""
    bm = bmesh.new(); f = [bm.verts.new((x, -y_front, z)) for x, z in pts]; b = [bm.verts.new((x, -y_back, z)) for x, z in pts]
    bm.faces.new(f); bm.faces.new(list(reversed(b)))
    for i in range(len(pts)): j = (i + 1) % len(pts); bm.faces.new((f[j], f[i], b[i], b[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:]); me = bpy.data.meshes.new('e'); bm.to_mesh(me); bm.free(); return obj(me)

# ---- the recess: back (cross minus the door opening) and walls
cross = [(-aw, h0), (aw, h0), (aw, hMid), (mw, hMid), (mw, hTop), (aw, hTop), (aw, hEnd), (-aw, hEnd), (-aw, hTop), (-mw, hTop), (-mw, hMid), (-aw, hMid)]
bm = bmesh.new(); vs = [bm.verts.new((x, 0.0, z)) for x, z in cross]; face = bm.faces.new(vs)
# walls: from the back plane (out 0) to the face (out R)
vf = [bm.verts.new((x, -R, z)) for x, z in cross]
for i in range(len(cross)): j = (i + 1) % len(cross); bm.faces.new((vs[i], vs[j], vf[j], vf[i]))
def inside(poly, x, z):
    c = False
    for i in range(len(poly)):
        (x1, z1), (x2, z2) = poly[i], poly[(i + 1) % len(poly)]
        if (z1 > z) != (z2 > z) and x < x1 + (z - z1) * (x2 - x1) / (z2 - z1): c = not c
    return c
bm.normal_update()
for f in bm.faces:   # the back faces out of the rock (-Y); each wall faces into the cross
    c = f.calc_center_median()
    if abs(c.y) < 1e-6 and abs(f.normal.y) > 0.5:
        if f.normal.y > 0: f.normal_flip()
    elif not inside(cross, c.x + f.normal.x * 0.05, c.z + f.normal.z * 0.05): f.normal_flip()
me = bpy.data.meshes.new('recess'); bm.to_mesh(me); bm.free(); rec = obj(me, 'recess')
# door opening through the back (boolean): the reveal 0.08 deep, the sealing slab behind it
DZ0 = hMid + 0.2
cut = box(-dw / 2, dw / 2, -0.5, 0.2, DZ0, DZ0 + dh, bev=0); parts.remove(cut)
bo = rec.modifiers.new('door', 'BOOLEAN'); bo.operation = 'DIFFERENCE'; bo.object = cut; bo.solver = 'EXACT'
bpy.context.view_layer.objects.active = rec; bpy.ops.object.modifier_apply(modifier='door'); bpy.data.objects.remove(cut, do_unlink=True)
box(-dw / 2 - 0.02, dw / 2 + 0.02, -0.14, -0.08, DZ0 - 0.02, DZ0 + dh + 0.02, bev=0.004)      # the slab, set back 8 cm
bmr = bmesh.new(); rect = [(-dw / 2, DZ0), (dw / 2, DZ0), (dw / 2, DZ0 + dh), (-dw / 2, DZ0 + dh)]   # the reveal's four sides, facing into the opening
for i in range(4):
    (xa_, za_), (xb_, zb_) = rect[i], rect[(i + 1) % 4]
    f = bmr.faces.new((bmr.verts.new((xa_, 0.0, za_)), bmr.verts.new((xb_, 0.0, zb_)), bmr.verts.new((xb_, 0.08, zb_)), bmr.verts.new((xa_, 0.08, za_))))
    f.normal_update(); c = f.calc_center_median()
    if (Vector((0, 0.04, DZ0 + dh / 2)) - c).dot(f.normal) < 0: f.normal_flip()
mr = bpy.data.meshes.new('reveal'); bmr.to_mesh(mr); bmr.free(); obj(mr)
# ---- the doorway's frame: three receding bands, torus roll, cavetto cornice
for k in range(3):
    o = 0.12 * (k + 1); d = 0.10 - 0.035 * k
    box(-(dw / 2 + o), -(dw / 2 + o - 0.12), 0, d, DZ0, DZ0 + dh + o, bev=0.008); box(dw / 2 + o - 0.12, dw / 2 + o, 0, d, DZ0, DZ0 + dh + o, bev=0.008)
    box(-(dw / 2 + o), dw / 2 + o, 0, d, DZ0 + dh + o - 0.12, DZ0 + dh + o, bev=0.008)
zc = DZ0 + dh + 0.36; Wc = dw / 2 + 0.52
cyl = bpy.data.meshes.new('torus'); bmc = bmesh.new()
bmesh.ops.create_cone(bmc, cap_ends=True, segments=12, radius1=0.06, radius2=0.06, depth=2 * Wc); bmc.transform(Matrix.Rotation(math.pi / 2, 4, 'Y'))
bmc.transform(Matrix.Translation((0, -0.08, zc + 0.06))); bmc.to_mesh(cyl); bmc.free(); obj(cyl)
prof = [(0.0, 0.0), (0.02, 0.0)] + [(0.02 + 0.26 * (1 - math.cos(t * math.pi / 2)), 0.12 + 0.36 * math.sin(t * math.pi / 2)) for t in np.linspace(0, 1, 9)] + [(0.28, 0.56), (0.0, 0.56)]
bmv = bmesh.new(); L = []
for (y, z) in prof:   # a section (out y, up z) swept along x: the cavetto overhangs outward as it rises
    L.append((bmv.verts.new((-Wc - y * 0.3, -(y + 0.02), zc + 0.12 + z)), bmv.verts.new((Wc + y * 0.3, -(y + 0.02), zc + 0.12 + z))))
for i in range(len(L) - 1): bmv.faces.new((L[i][0], L[i][1], L[i + 1][1], L[i + 1][0]))
bmv.faces.new([p[0] for p in L]); bmv.faces.new([p[1] for p in reversed(L)])
bmesh.ops.recalc_face_normals(bmv, faces=bmv.faces[:]); mc = bpy.data.meshes.new('cav'); bmv.to_mesh(mc); bmv.free(); obj(mc)
# ---- the columns
PRO = job.get('protome_dir'); D = 2 * r0
def ply(path):
    bpy.ops.wm.ply_import(filepath=path, forward_axis='NEGATIVE_Z', up_axis='Y') if hasattr(bpy.ops.wm, 'ply_import') else bpy.ops.import_mesh.ply(filepath=path)
    return bpy.context.selected_objects[0]
cap_low = cap_high = None
if PRO and os.path.exists(f'{PRO}/lod0.ply'):
    cap_low = ply(f'{PRO}/lod0.ply'); cap_high = ply(f'{PRO}/high.ply')
    for o in (cap_low, cap_high):   # y-up source (x the beam, z depth) -> Blender (x, -z, y) done by the importer's axes
        o.scale = (D, D, D); bpy.context.view_layer.objects.active = o; o.select_set(True)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True); o.select_set(False)
    dm = cap_low.modifiers.new('dec', 'DECIMATE'); dm.ratio = job.get('protome_tris', 1100) / max(1, len(cap_low.data.polygons)); bpy.context.view_layer.objects.active = cap_low; bpy.ops.object.modifier_apply(modifier='dec')
capH = 2.08 * D if cap_low else 0.8
highs = []
for x in Fd['colX']:
    zb = hMid
    box(x - 0.49, x + 0.49, 0, 0.5, zb, zb + 0.16, bev=0.012)                                              # plinth
    lathe([(0.3, 0.0)] + [(0.36 + 0.10 * math.sin(a), 0.10 - 0.10 * math.cos(a)) for a in np.linspace(0, math.pi, 9)] + [(0.38, 0.2)], x, zb + 0.16, 18)   # torus
    zs0, zs1 = zb + 0.36, hMid + ch - capH - 0.1
    lathe([(0.38, 0.0), (0.365, (zs1 - zs0) * 0.5), (0.35, zs1 - zs0)], x, zs0, 18)                         # the shaft
    lathe([(0.35, 0.0), (0.39, 0.03), (0.39, 0.07), (0.35, 0.1)], x, zs1, 16)                                # astragal
    if cap_low:
        for src, lst in ((cap_low, parts), (cap_high, highs)):
            o = src.copy(); o.data = src.data.copy(); sc.collection.objects.link(o); o.location = (x, 0, hMid + ch - capH); lst.append(o)
    else: box(x - 1.05, x + 1.05, 0, 0.55, hMid + ch - 0.8, hMid + ch, bev=0.02)
if cap_low: bpy.data.objects.remove(cap_low, do_unlink=True); bpy.data.objects.remove(cap_high, do_unlink=True)
# ---- the entablature
z = hMid + ch
for hh, dd in ((0.28, 0.30), (0.30, 0.36), (0.32, 0.42)): box(-6.7, 6.7, 0, dd, z, z + hh, bev=0.012); z += hh
x = -6.6
while x < 6.6: box(x, x + 0.2, 0, 0.5, z, z + 0.3, bev=0); x += 0.34
box(-6.7, 6.7, 0, 0.3, z, z + 0.3, bev=0.005); z += 0.3
box(-6.9, 6.9, 0, 0.62, z, z + 0.45, bev=0.015)
# ---- the upper register's throne
u0 = hTop
box(-span / 2 - 0.2, span / 2 + 0.2, 0, 0.3, u0 + 0.05, u0 + 0.35, bev=0.012)            # ground line
for t in range(2):
    base = u0 + 0.35 + t * (bearerH + 0.3); zb = base + bearerH
    box(-span / 2, span / 2, 0, 0.22, zb, zb + 0.28, bev=0.012)                            # the stretcher the bearers lift
    for zz in (zb + 0.02, zb + 0.26):                                                      # bead mouldings
        c = bpy.data.meshes.new('bead'); bmc = bmesh.new(); bmesh.ops.create_cone(bmc, cap_ends=True, segments=8, radius1=0.035, radius2=0.035, depth=span)
        bmc.transform(Matrix.Rotation(math.pi / 2, 4, 'Y')); bmc.transform(Matrix.Translation((0, -0.235, zz))); bmc.to_mesh(c); bmc.free(); obj(c)
top = u0 + 0.35 + 2 * (bearerH + 0.3)
box(-span / 2 - 0.3, span / 2 + 0.3, 0, 0.3, top, top + 0.35, bev=0.015)
for s in (-1, 1):   # the throne's legs: turned rings, lion's-paw feet on a small base
    xl = s * (span / 2 + 0.1)
    lathe([(0.11, 0.0), (0.11, top - u0 - 0.35)], xl, u0 + 0.35, 16)
    for zz in (u0 + 0.9, u0 + 0.35 + bearerH - 0.1, u0 + 0.35 + bearerH + 0.3 + 0.55, top - 0.25):
        lathe([(0.11, 0.0), (0.16, 0.04), (0.17, 0.09), (0.16, 0.14), (0.11, 0.18)], xl, zz, 16)
    box(xl - 0.2, xl + 0.2, 0, 0.3, u0 + 0.35, u0 + 0.45, bev=0.012)
    for k in range(3):   # the paw: three toes and the pad
        bmp = bmesh.new(); bmesh.ops.create_uvsphere(bmp, u_segments=10, v_segments=6, radius=0.055)
        bmp.transform(Matrix.Translation((xl + (k - 1) * 0.07, -0.2, u0 + 0.5))); mp = bpy.data.meshes.new('toe'); bmp.to_mesh(mp); bmp.free(); obj(mp)
    lathe([(0.08, 0.0), (0.15, 0.05), (0.16, 0.12), (0.11, 0.2)], xl, u0 + 0.45, 16)
for k, w in enumerate((1.9, 1.5, 1.1)): box(-2.5 - w / 2, -2.5 + w / 2, 0, 0.18, top + 0.35 + k * 0.2, top + 0.55 + k * 0.2, bev=0.01)   # the podium
# ---- join the low model, UVs, the high copy, bake
for o in list(parts):
    if o.name not in sc.objects: parts.remove(o)
for x in list(sc.objects): x.select_set(False)
for o in parts: o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]; bpy.ops.object.join(); low = parts[0]; low.name = 'facade'; low.data.name = 'facade'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# the faces no one sees: inside the rock behind the recess back (the engaged protomes' and shafts' back halves, the boxes'
# backs against the back plane): cut, so the triangles and the atlas go to what is visible
bm = bmesh.new(); bm.from_mesh(low.data); bm.normal_update()
dead = [f for f in bm.faces if not (abs(f.calc_center_median().x) < dw / 2 + 0.05 and DZ0 - 0.05 < f.calc_center_median().z < DZ0 + dh + 0.05) and all(v.co.y > 0.004 for v in f.verts) or (all(abs(v.co.y) < 0.004 for v in f.verts) and f.normal.y > 0.5 and f.calc_area() < 20)]
stats['facade_hidden_cut'] = len(dead); bmesh.ops.delete(bm, geom=dead, context='FACES'); bm.to_mesh(low.data); bm.free(); low.data.update()
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.remove_doubles(threshold=0.0005)
bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.003, scale_to_bounds=True); bpy.ops.object.mode_set(mode='OBJECT')
# weld the protome copies too; now the high: a copy of the architecture (no protomes) voxel-remeshed and displaced, + the carved protomes
arch = low.copy(); arch.data = low.data.copy(); sc.collection.objects.link(arch)
# (a voxel remesh of the open sheets made thin double shells that the bake's rays hit from behind: the architecture's high is
# the model itself, its bevels and occlusion baked; the stone's grain is the nr_dressed scan's in the game)
for x in list(sc.objects): x.select_set(False)
for o in [arch] + highs: o.select_set(True)
bpy.context.view_layer.objects.active = arch; bpy.ops.object.join(); high = arch; high.name = 'facade_high'
stats['facade_high_tris'] = len(high.data.polygons)
mat = bpy.data.materials.new('facade'); mat.use_nodes = True; low.data.materials.clear(); low.data.materials.append(mat); mat.node_tree.nodes.new('ShaderNodeTexImage')
FW = job.get('facade_tex', 2048)
nI = ml.bake_image('NORMAL', high, low, FW, FW, 1, cage=0.05, ray=0.1, margin=8)
aI = ml.bake_image('AO', high, low, FW, FW, job.get('ao_samples_facade', 96), cage=0.05, ray=0.1, ao_dist=0.6, margin=8)
cov = np.abs(nI[..., :3]).sum(-1) > 0.05; nI[~cov, :3] = (0.5, 0.5, 1.0); aoF = np.where(cov, aI[..., 0], 1.0)
ml.write_png(f'{OUT}/facade_n.png', ml.q8(nI[..., :3])); ml.write_png(f'{OUT}/facade_a.png', ml.q8(np.stack([aoF, np.full_like(aoF, 0.5), np.full_like(aoF, 0.5)], -1)))
ml.write_png(f'{OUT}/facade_rake.png', ml.rake(nI[..., :3], aoF))
bpy.data.objects.remove(high, do_unlink=True)
tm = low.evaluated_get(bpy.context.evaluated_depsgraph_get()).to_mesh(); tm.calc_loop_triangles(); stats['tris_facade'] = len(tm.loop_triangles)
stats['facade'] = {'cover': float(cov.mean()), 'ao_mean': float(aoF[cov].mean())}
ml.log('facade', stats['tris_facade'], 'tris; high', stats['facade_high_tris'], stats['facade'])
if job.get('preview'):
    ml.preview_material(low, f'{OUT}/facade_n.png', f'{OUT}/facade_a.png')
    ml.preview_render(f'{OUT}/preview_facade', [('ground', (6, -32, 1.6), (0, 0, 24)), ('median', (4, -14, 20), (-1, 0, 24.5)), ('upper', (3, -12, 30), (0, 0, 32))], sun_rot=(60, 0, -150))
