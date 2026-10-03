# PARSA animals, the library route (V5, D-520): a species' body from a ready-made, realistically textured animal model (Objaverse /
# Sketchfab, CC-BY or CC-BY-NC; ASSET_LEDGER.md) instead of the procedural anatomy (animals.py). Headless:
#   blender -b --factory-startup --python tools/blender/animals_real.py -- <job.json>
# job.json: { "sp", "glb", "out_dir", "tris": [lod0, lod1], "tex", "len", "h", "girth", "rot" (deg about up, optional: else the
#             head end is found), "kz" (optional height factor), "drop": [object-name substrings to leave out], "tint" (linear RGB factor on the
#             albedo: the species' own coat where the library's animal is another breed), "device" }
#  1. import; armatures to their rest pose; every mesh evaluated and joined (ground discs, cameras and lights left out);
#  2. the frame of the game's rig (animals.ts animalFrame: y up, +z forward, the body centred on z = 0): the head end found
#     (the higher end of the long horizontal axis) and turned to Blender -Y (glTF +Z); the four leg columns found under a
#     fifth of the height; one scale that puts the fore and hind legs where the rig's pivots are (0.34 L and -0.36 L), the
#     height nudged toward the species' withers (+-12 % at most); feet on the ground, legs centred;
#  3. the rig's landmarks measured on that body (rig.json: legs, belly, back, neck base, poll, muzzle, tail root): the game's
#     rig weights are computed from them at load (animalRig.ts realForm);
#  4. lod0 = the body decimated to its target, Smart-UV-unwrapped, and Cycles selected-to-active bakes from the source with its
#     own textures: base colour, tangent-space normal (the source's normal maps included), ambient occlusion;
#  5. <sp>_albedo.png (RGB sRGB, A = 1: the model's own colours lead) and <sp>_nrm.png (RGB normal, A occlusion); lod1 = lod0
#     decimated again; one Draco GLB with lod0 and lod1 (as animals.py).
import bpy, sys, json, math, os, time
import numpy as np
from mathutils import Matrix, Vector

job = json.load(open(sys.argv[sys.argv.index('--') + 1]))
t0 = time.time()
log = lambda *a: print('[animals_real]', *a, flush=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.engine = 'CYCLES'
cy = sc.cycles; cy.seed = 0; cy.use_animated_seed = False; cy.use_denoising = False
dev = 'CPU'
if job.get('device', 'GPU') == 'GPU':
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for t in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = t; prefs.get_devices()
            if [d for d in prefs.devices if d.type == t]:
                for d in prefs.devices: d.use = d.type == t
                cy.device = 'GPU'; dev = t; break
        except Exception as e: log('device', t, e)
log('device', dev)

bpy.ops.import_scene.gltf(filepath=job['glb'])
for o in bpy.data.objects:
    if o.type == 'ARMATURE': o.data.pose_position = 'REST'
for a in bpy.data.objects:
    if a.animation_data: a.animation_data.action = None
sc.frame_set(0)
dg = bpy.context.evaluated_depsgraph_get()
drop = job.get('drop', []) + ['Icosphere', 'WGT', 'widget']  # (rig controls shipped as meshes)
parts = []
for o in list(bpy.data.objects):
    if o.type != 'MESH' or any(d.lower() in o.name.lower() for d in drop): continue
    oe = o.evaluated_get(dg)
    me = bpy.data.meshes.new_from_object(oe, preserve_all_data_layers=True, depsgraph=dg)
    me.transform(o.matrix_world)
    n = bpy.data.objects.new('part_' + o.name, me); sc.collection.objects.link(n); parts.append(n)
for o in list(bpy.data.objects):
    if not o.name.startswith('part_'): bpy.data.objects.remove(o, do_unlink=True)
# ground discs and shadow planes: flat parts as wide as the animal
def vco(o):
    a = np.empty(len(o.data.vertices) * 3, np.float32); o.data.vertices.foreach_get('co', a); return a.reshape(-1, 3)
allv = np.concatenate([vco(p) for p in parts]); H = allv[:, 2].max() - allv[:, 2].min(); W = max(np.ptp(allv[:, 0]), np.ptp(allv[:, 1]))
for p in list(parts):
    v = vco(p)
    if len(v) and np.ptp(v[:, 2]) < 0.02 * H and max(np.ptp(v[:, 0]), np.ptp(v[:, 1])) > 0.5 * W:
        log('dropped flat part', p.name); parts.remove(p); bpy.data.objects.remove(p, do_unlink=True)
for x in bpy.data.objects: x.select_set(False)
for p in parts: p.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
if len(parts) > 1: bpy.ops.object.join()
src = bpy.context.active_object; src.name = 'src'
v = vco(src)
log('source', len(v), 'verts', sum(len(p.vertices) - 2 for p in src.data.polygons), 'tris', len(src.data.materials), 'materials')

# ---- 2. the frame
v = v - [0, 0, v[:, 2].min()]
H = v[:, 2].max()
if job.get('rot') is not None:
    ang = math.radians(job['rot'])
else:
    long_x = np.ptp(v[:, 0]) > np.ptp(v[:, 1])
    ax = 0 if long_x else 1
    lo, hi = v[:, ax].min(), v[:, ax].max(); span = hi - lo
    up = v[:, 2] > 0.25 * H
    endA = v[up & (v[:, ax] < lo + 0.2 * span)]; endB = v[up & (v[:, ax] > hi - 0.2 * span)]
    hA = endA[:, 2].max() if len(endA) else 0; hB = endB[:, 2].max() if len(endB) else 0
    # the head end goes to -Y
    head_neg = hA > hB
    if ax == 1: ang = 0 if head_neg else math.pi
    else: ang = (math.pi / 2) if head_neg else (-math.pi / 2)  # about Z: (-1, 0) -> (0, -1) at +90 deg
R = Matrix.Rotation(ang, 4, 'Z')
src.data.transform(R)
v = vco(src); v[:, 2] -= v[:, 2].min(); H = v[:, 2].max()
# leg columns: under a fifth of the height, split by side and by fore/hind
low = v[v[:, 2] < 0.2 * H]
# four clusters (k-means from the corners of the low vertices' box), each a leg
cx, cyy = (low[:, 0].min() + low[:, 0].max()) / 2, (low[:, 1].min() + low[:, 1].max()) / 2
hx, hy = np.ptp(low[:, 0]) / 2, np.ptp(low[:, 1]) / 2
BIPED = bool(job.get('biped'))
names = (('l', 1, 0), ('r', -1, 0)) if BIPED else (('fl', 1, -1), ('fr', -1, -1), ('hl', 1, 1), ('hr', -1, 1))
C = np.array([[cx + sx * hx * 0.6, cyy + sy * hy * 0.8] for _, sx, sy in names])
for it in range(30):
    d = ((low[:, None, :2] - C[None]) ** 2).sum(-1); lab = d.argmin(1)
    C = np.array([low[lab == k, :2].mean(0) if (lab == k).any() else C[k] for k in range(len(names))])
legs = {nm: C[k] for k, (nm, _, _) in enumerate(names)}
L = job['len']
if BIPED:
    # two legs: one scale that brings the back (the top of the body over the legs) to the species' height; the legs at the rig's z (-0.04 L)
    yl = (legs['l'][1] + legs['r'][1]) / 2; Lm = np.ptp(v[:, 1])
    band = v[np.abs(v[:, 1] - yl) < 0.12 * Lm]
    s = job['h'] / float(band[:, 2].max()); yf = yh = yl; span = 0.0
else:
    yf = (legs['fl'][1] + legs['fr'][1]) / 2; yh = (legs['hl'][1] + legs['hr'][1]) / 2
    span = yh - yf
    s = 0.70 * L / span
log('legs', {k: [round(float(a), 3) for a in vv] for k, vv in legs.items()}, 'span', round(float(span), 3), 'scale', round(s, 4))
# withers: the top of the back over and just behind the fore legs
vs = (v - [cx, (yf + yh) / 2, 0]) * s
yf2, yh2 = -0.35 * L, 0.35 * L
wmask = (vs[:, 1] > yf2 + 0.06 * L) & (vs[:, 1] < yf2 + 0.22 * L) & (np.abs(vs[:, 0]) < 0.25 * job['girth'])
hw = vs[wmask][:, 2].max() if wmask.any() else vs[:, 2].max()
kz = job.get('kz') or (1.0 if BIPED else float(np.clip(job['h'] / hw, 0.88, 1.12)))
log('withers', round(float(hw), 3), 'species h', job['h'], 'kz', round(kz, 3))
# the whole transform: centre the legs, scale, nudge the height; then the rig's own z offset (legs' mid at game z -0.01 L = Blender y +0.01 L)
cx = float(np.mean([legs[k][0] for k in legs]))
M = Matrix.Translation((0, (0.04 if BIPED else 0.01) * L, 0)) @ Matrix.Diagonal((s, s, s * kz, 1)) @ Matrix.Translation((-cx, -(yf + yh) / 2, 0))
src.data.transform(M)
v = vco(src); v[:, 2] -= v[:, 2].min()
src.data.transform(Matrix.Translation((0, 0, -vco(src)[:, 2].min())))
v = vco(src)

# ---- 2b. the gear (pack saddle and panniers, saddle cloth: tools/blender/sources/animal_gear.ts), set on this body's back:
# lifted to its back line where the gear rides, widened to its barrel
gear_dy = 0.0
if job.get('gear'):
    gj = json.load(open(job['gear'].replace('.ply', '.json')))
    near = v[(np.abs(v[:, 1] + gj['z']) < 0.06 * L) & (np.abs(v[:, 0]) < 0.15 * job['girth'])]
    real_back = float(near[:, 2].max()) if len(near) else gj['back']
    mid = v[(np.abs(v[:, 1] + gj['z']) < 0.08 * L)]
    hw = float(np.percentile(np.abs(mid[:, 0]), 97)) if len(mid) else 0.5 * job['girth']
    kx = float(np.clip(hw / (0.5 * job['girth']), 0.85, 1.3))
    gear_dy = real_back - gj['back']
    bpy.ops.wm.ply_import(filepath=job['gear'])
    go = bpy.context.selected_objects[0]; go.name = 'gear'
    go.data.transform(Matrix.Translation((0, 0, gear_dy)) @ Matrix.Diagonal((kx, 1, 1, 1)))
    gm = bpy.data.materials.new('gear'); gm.use_nodes = True; nt = gm.node_tree; bsdf = nt.nodes.get('Principled BSDF')
    at = nt.nodes.new('ShaderNodeAttribute'); at.attribute_type = 'GEOMETRY'; at.attribute_name = go.data.color_attributes[0].name
    nt.links.new(at.outputs['Color'], bsdf.inputs['Base Color']); bsdf.inputs['Roughness'].default_value = 0.9
    go.data.materials.append(gm)
    for p in go.data.polygons: p.use_smooth = True
    for x in bpy.data.objects: x.select_set(False)
    go.select_set(True); src.select_set(True); bpy.context.view_layer.objects.active = src; bpy.ops.object.join()
    v = vco(src)
    log('gear', gj['tris'], 'tris; dy', round(gear_dy, 3), 'kx', round(kx, 3))

# ---- 3. landmarks, in the game's frame (x, y up, z forward = -Blender y)
G = np.stack([v[:, 0], v[:, 2], -v[:, 1]], axis=1)
g = job['girth']
def leg_at(name, sx, sf):
    pts = G[((G[:, 0]) * sx > 0.02 * g) & ((G[:, 2]) * sf > 0.12 * L)]
    return pts
torso = G[(np.abs(G[:, 2]) < 0.12 * L) & (np.abs(G[:, 0]) < 0.7 * g)]
halfW = float(np.percentile(np.abs(torso[:, 0]), 98)) if len(torso) else 0.5 * g
mid_t = torso[(np.abs(torso[:, 0]) < 0.5 * halfW) & (torso[:, 1] > 0.25 * G[:, 1].max())]  # (the midline: a striding leg can cross z = 0 at the side)
bellyY = float(mid_t[:, 1].min()) if len(mid_t) else 0.5
backY = float(torso[:, 1].max()) if len(torso) else 1
by = (bellyY + backY) / 2
hipY = bellyY + 0.385 * (backY - bellyY); kneeY = hipY * 0.45
rig_legs = []
LEGS = (('l', 1, 0, 0.25, -1), ('r', -1, 0, 0.75, -1)) if BIPED else (('fl', 1, 1, 0.25, 1), ('fr', -1, 1, 0.75, 1), ('hl', 1, -1, 0.0, -1), ('hr', -1, -1, 0.5, -1))
for name, sx, sf, ph, fore in LEGS:
    P = G[(G[:, 0] * sx > 0.02 * g) & (np.abs(G[:, 2] + 0.04 * L) < 0.3 * L)] if BIPED else leg_at(name, sx, sf)
    def ring(y0, dy):
        q = P[np.abs(P[:, 1] - y0) < dy]
        return q
    qk = ring(kneeY, 0.04 * job['h']); qh = ring(bellyY - 0.03 * job['h'], 0.04 * job['h']); qf = ring(0.06 * job['h'], 0.04 * job['h'])
    ck = qk.mean(axis=0) if len(qk) else np.array([sx * 0.3 * g, kneeY, sf * 0.35 * L])
    ch = qh.mean(axis=0) if len(qh) else ck
    rk = float(np.median(np.hypot(qk[:, 0] - ck[0], qk[:, 2] - ck[2]))) if len(qk) else 0.03
    rig_legs.append({'x': float(ck[0]), 'z': float(ch[2]), 'zk': float(ck[2]), 'xh': float(ch[0]), 'phase': ph * 2 * math.pi, 'fore': fore, 'r': rk,
                     'foot': [float(a) for a in (qf.mean(axis=0) if len(qf) else ck)]})
front = G[G[:, 2] > 0.3 * L]
# the muzzle: the foremost point above the hips (a fore paw stretched in a stride reaches further forward, lower down)
high = np.where(G[:, 1] > hipY)[0]
mi = int(high[np.argmax(G[high, 2])]) if len(high) else int(np.argmax(G[:, 2])); muzzle = G[mi]
base = np.array([0.0, bellyY + 0.35 * (backY - bellyY), 0.38 * L])
ahead = G[(G[:, 2] > base[2]) & (np.abs(G[:, 0]) < 0.6 * g)]
ti = int(np.argmax(ahead[:, 1])) if len(ahead) else mi
top = ahead[ti] if len(ahead) else muzzle
# the poll: under the highest point of the head (horns and ears stand above it), a little back from the muzzle's line
top = np.array([0.0, float(top[1]) - 0.06 * job['h'], float(top[2])])
# (long horns stand far above the poll: the poll no higher above the muzzle, nor further back from it, than the species' head is long)
hd_len = job.get('head') or 0.3 * L
top[1] = min(top[1], float(muzzle[1]) + 0.9 * hd_len); top[2] = max(top[2], float(muzzle[2]) - 1.1 * hd_len)
# the tail's root: the rearmost point of the body above the hips (the dock), a little inside it
hi_i = np.where((G[:, 1] > hipY) & (np.abs(G[:, 0]) < 0.5 * halfW))[0]
ri = int(hi_i[np.argmin(G[hi_i, 2])]) if len(hi_i) else int(np.argmin(G[:, 2]))
tail_root = np.array([0.0, float(G[ri, 1]), float(G[ri, 2]) + 0.03])
# its tip: the lowest point on the midline behind the hind legs and under the root (a hanging tail), else none
tt = G[(G[:, 2] < tail_root[2] + 0.08) & (np.abs(G[:, 0]) < 0.3 * halfW) & (G[:, 1] < tail_root[1])]
tail_tip = [0.0, float(tt[np.argmin(tt[:, 1]), 1]), float(tt[np.argmin(tt[:, 1]), 2])] if len(tt) > 3 else None
rig = {'halfW': halfW, 'bodyY': by, 'bellyY': bellyY, 'backY': backY, 'hipY': hipY, 'kneeY': kneeY, 'legs': rig_legs,
       'base': [float(a) for a in base], 'top': [float(a) for a in top], 'muzzle': [0.0, float(muzzle[1]), float(muzzle[2])], 'tailRoot': [float(a) for a in tail_root], 'tailTip': tail_tip, 'tailR': job.get('tail_r'),
       'min': [float(a) for a in G.min(axis=0)], 'max': [float(a) for a in G.max(axis=0)], 'scale': s, 'kz': kz, 'gearDy': (gear_dy if job.get('gear') else None), 'gearKx': (kx if job.get('gear') else None), 'rot': math.degrees(ang)}
json.dump(rig, open(os.path.join(job['out_dir'], 'rig.json'), 'w'), indent=1)
log('rig', json.dumps({k: rig[k] for k in ('bodyY', 'bellyY', 'backY', 'base', 'top', 'muzzle', 'tailRoot', 'min', 'max')}))

# ---- 3b. no udder (job 'no_udder': an ox drawn from a cow model): what hangs below the belly between the hind legs and the
# navel is pressed up to the belly line (game y = Blender z); the hide's colour there is darkened to the belly's in the bake below
if job.get('no_udder'):
    vv = vco(src); gx, gy, gz = vv[:, 0], vv[:, 2], -vv[:, 1]
    fr = (np.abs(gx) < 0.3 * halfW) & (gz > 0.1 * L) & (gz < 0.3 * L) & (gy > 0.25 * gy.max())
    bref = float(gy[fr].min()) if fr.any() else bellyY  # the belly line in front of the navel
    m = (np.abs(gx) < 0.4 * halfW) & (gz > -0.5 * L) & (gz < 0.1 * L) & (gy < bref)
    vv[m, 2] = bref - 0.03 * (bref - vv[m, 2]) / max(1e-3, float((bref - gy[m]).max()) if m.any() else 1)
    src.data.vertices.foreach_set('co', vv.ravel()); src.data.update()
    log('udder pressed up:', int(m.sum()), 'vertices')

# ---- 4. lod0 and the bakes
def activate(o):
    for x in bpy.data.objects: x.select_set(False)
    o.select_set(True); bpy.context.view_layer.objects.active = o
def tris(o): return sum(len(p.vertices) - 2 for p in o.data.polygons)
def decimate(o, target):
    activate(o); n = tris(o)
    if n > target:
        m = o.modifiers.new('dec', 'DECIMATE'); m.decimate_type = 'COLLAPSE'; m.ratio = 0.98 * target / n; m.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=m.name)
    m = o.modifiers.new('tri', 'TRIANGULATE'); bpy.ops.object.modifier_apply(modifier=m.name)
    for _ in range(4):
        n = tris(o)
        if n <= target * 1.01: break
        m = o.modifiers.new('dec', 'DECIMATE'); m.decimate_type = 'COLLAPSE'; m.ratio = 0.97 * target / n; m.use_collapse_triangulate = True
        bpy.ops.object.modifier_apply(modifier=m.name)
activate(src); bpy.ops.object.duplicate(); lod0 = bpy.context.active_object; lod0.name = 'lod0'; lod0.data.name = 'lod0'
# merge the seams' split vertices before decimating (game models are split at every UV seam); UVs are remade anyway
activate(lod0); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.remove_doubles(threshold=0.0005 * L); bpy.ops.object.mode_set(mode='OBJECT')
for p in lod0.data.polygons: p.use_smooth = True
while len(lod0.data.uv_layers): lod0.data.uv_layers.remove(lod0.data.uv_layers[0])
lod0.data.uv_layers.new(name='UVMap')
decimate(lod0, job['tris'][0])
activate(lod0); bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
bpy.ops.uv.pack_islands(udim_source='CLOSEST_UDIM', rotate=True, margin=0.004)
bpy.ops.object.mode_set(mode='OBJECT')
log('lod0', tris(lod0), 'tris')
n = job['tex']
imgs = {k: bpy.data.images.new(f'{job["sp"]}_{k}', n, n, alpha=False, float_buffer=True) for k in ('nrm', 'ao', 'col')}
for im in imgs.values(): im.colorspace_settings.name = 'Non-Color'
tm = bpy.data.materials.new('target'); tm.use_nodes = True; tn = tm.node_tree.nodes.new('ShaderNodeTexImage')
lod0.data.materials.clear(); lod0.data.materials.append(tm)
# the source's materials: opaque (alpha-blended cards would let the bake rays through), no metal
for m in src.data.materials:
    if not m or not m.use_nodes: continue
    for nd in m.node_tree.nodes:
        if nd.type == 'BSDF_PRINCIPLED':
            nd.inputs['Metallic'].default_value = 0.0
            for l in list(nd.inputs['Metallic'].links): m.node_tree.links.remove(l)
w = bpy.data.worlds.new('bake'); sc.world = w; w.light_settings.distance = 0.12 * L
for k in ('visible_camera', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter', 'visible_shadow'): setattr(lod0, k, False)
cage, ray = 0.012 * L, 0.03 * L
def bake(kind, key, samples, **extra):
    tn.image = imgs[key]; tm.node_tree.nodes.active = tn
    for x in bpy.data.objects: x.select_set(False)
    src.select_set(True); lod0.select_set(True); bpy.context.view_layer.objects.active = lod0
    cy.samples = samples
    kw = dict(type=kind, use_selected_to_active=True, cage_extrusion=cage, max_ray_distance=ray, margin=6, margin_type='EXTEND', use_clear=True, **extra)
    if kind == 'NORMAL': kw['normal_space'] = 'TANGENT'
    t = time.time(); bpy.ops.object.bake(**kw); log('baked', key, f'{time.time() - t:.1f} s')
    px = np.empty(n * n * 4, np.float32); imgs[key].pixels.foreach_get(px); return px.reshape(-1, 4)
nrm = bake('NORMAL', 'nrm', 4)
ao = bake('AO', 'ao', 48)
col = bake('DIFFUSE', 'col', 4, pass_filter={'COLOR'})
def save(name, arr):
    q = np.clip(np.floor(arr * 255.0 + 0.5), 0, 255).astype(np.uint8)
    im = bpy.data.images.new(name, n, n, alpha=True, float_buffer=False); im.colorspace_settings.name = 'Non-Color'; im.alpha_mode = 'CHANNEL_PACKED'
    im.pixels.foreach_set((q.astype(np.float32) / 255.0).ravel())
    p = os.path.join(job['out_dir'], name + '.png'); im.filepath_raw = p; im.file_format = 'PNG'; im.save(); return p, q
pk = nrm.copy(); pk[:, 3] = ao[:, 0]
_, qn = save(f'{job["sp"]}_nrm', pk)
lin = np.clip(col[:, :3] * np.array(job.get('tint') or [1, 1, 1], np.float32), 0, 1); s_ = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)
pa = np.concatenate([s_, np.ones((len(s_), 1), np.float32)], axis=1)
_, qa = save(f'{job["sp"]}_albedo', pa)

activate(lod0); bpy.ops.object.duplicate(); lod1 = bpy.context.active_object; lod1.name = 'lod1'; lod1.data.name = 'lod1'
decimate(lod1, min(job['tris'][1], tris(lod0) // 4))
bpy.data.objects.remove(src, do_unlink=True)
for o in (lod0, lod1): o.data.materials.clear()
for o in list(bpy.data.objects): o.select_set(o.name in ('lod0', 'lod1'))
out_glb = os.path.join(job['out_dir'], job['sp'] + '.glb')
bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', use_selection=True, export_yup=True,
    export_normals=True, export_tangents=True, export_materials='NONE',
    export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6, export_draco_position_quantization=14,
    export_draco_normal_quantization=10, export_draco_texcoord_quantization=12, export_draco_generic_quantization=12,
    export_extras=False, export_animations=False, export_cameras=False, export_lights=False, export_skins=False, export_morph=False)
stats = {'sp': job['sp'], 'device': dev, 'lod0': tris(lod0), 'lod1': tris(lod1), 'tex': n, 'ao_mean': float(qn[:, 3].mean() / 255),
         'mask_mean': 1.0, 'seconds': round(time.time() - t0, 1), 'real': True}
json.dump(stats, open(os.path.join(job['out_dir'], 'stats.json'), 'w'), indent=1)
log('done', json.dumps(stats))
