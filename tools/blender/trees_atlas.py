# PARSA tree assets (D-327), the leaf atlas: every tile of the game's leaf-cluster atlas (src/world/trees/atlas.ts: leaf,
# blossom and bare-twig sprays, 22 tiles) modelled in 3-D from the primitives the game's own drawing records
# (tools/blender/sources/trees_src.ts -> atlas.ts recordTiles) and rendered in Cycles, orthographic, from the card's front:
#  - leaves are blades with their species' outline (the half-width profile, or the palmate polar outline), folded along
#    the midrib, arched and tipped, facing their own way (the recorded tilt), with midrib, secondary or palmate veins and
#    a paler margin in the albedo; twigs are tapered round shoots; flowers are cupped five-petalled corollas; the
#    scale-leaf sprays (cypress, tamarisk) are flattened shoots;
#  - pass 'shade': the spray under a uniform white sky, grey albedo (the leaf's own shade and veins): the radiance is the
#    albedo times the sky each texel sees, so leaves under leaves and twigs inside the spray are darker (the occlusion a
#    procedural tile cannot draw). The game multiplies it by the season's leaf colour (render.ts, atlas.shade);
#  - pass 'cls': the petal and bark shares (G, B) of each texel (antialiased);
#  - pass 'nrm': the camera-facing normal, turned into the tilt the game's leaf shader adds to a card's lighting normal.
# Layout and orientation as the game's atlas (tile i at column i % cols, row i // cols, v up), PNG rows top-down.
#   blender -b --factory-startup --python tools/blender/trees_atlas.py -- <src.json> <out_dir> <tile px> <samples> [GPU|CPU]
import bpy, sys, json, math, os, time
import numpy as np

a = sys.argv[sys.argv.index('--') + 1:]
src, out_dir, T, SPP = a[0], a[1], int(a[2]), int(a[3]); dev = a[4] if len(a) > 4 else 'CPU'
os.makedirs(out_dir, exist_ok=True)
J = json.load(open(src)); A = J['atlas']; COLS, ROWS = A['cols'], A['rows']
t0 = time.time(); log = lambda *x: print('[trees_atlas]', f'{time.time() - t0:6.1f}s', *x, flush=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; cy = sc.cycles
cy.seed = 0; cy.use_animated_seed = False
dev_used = 'CPU'
if dev == 'GPU':
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for t in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = t; prefs.get_devices(); ds = [d for d in prefs.devices if d.type == t]
            if ds:
                for d in prefs.devices: d.use = d.type == t
                cy.device = 'GPU'; dev_used = t; break
        except Exception as e: log('device', t, 'unavailable', e)
log('device', dev_used)
sc.render.film_transparent = True; sc.render.use_persistent_data = True
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'; sc.view_settings.exposure = 0; sc.view_settings.gamma = 1
sc.render.resolution_x = sc.render.resolution_y = T; sc.render.resolution_percentage = 100
sc.render.image_settings.file_format = 'OPEN_EXR'; sc.render.image_settings.color_depth = '32'; sc.render.image_settings.color_mode = 'RGBA'
cy.pixel_filter_type = 'BLACKMAN_HARRIS'; cy.filter_width = 1.5
cy.max_bounces = 4; cy.diffuse_bounces = 3; cy.transparent_max_bounces = 4
# the sky: uniform white all round (the spray's own occlusion only; no sun, no ground)
w = bpy.data.worlds.new('sky'); sc.world = w; w.use_nodes = True
bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (1, 1, 1, 1); bg.inputs['Strength'].default_value = 1.0

GAP = 1.5  # tiles sit GAP apart in the scene (no tile shades another), each rendered on its own
ZS = 0.05  # depth of a spray (tile units): the primitives stack in drawing order through it (a later one lies over)

verts, faces, attrs = [], [], {k: [] for k in ('shade', 'cls', 'kind', 'su', 'sv', 'l1', 'l2')}
nv = [0]
def add(P, F, shade, cls, kind, su, sv, l1=0.0, l2=0.0):
    """P: (n, 3) vertices, F: faces as index tuples into P, per-vertex su, sv (the primitive's own coordinates)"""
    b = nv[0]; verts.append(P); nv[0] += len(P)
    for f in F: faces.append(tuple(b + i for i in f))
    n = len(P)
    attrs['shade'].append(np.full(n, shade, np.float32)); attrs['cls'].append(np.full(n, cls, np.float32)); attrs['kind'].append(np.full(n, kind, np.float32))
    attrs['su'].append(np.asarray(su, np.float32)); attrs['sv'].append(np.asarray(sv, np.float32))
    attrs['l1'].append(np.full(n, l1, np.float32)); attrs['l2'].append(np.full(n, l2, np.float32))

def grid_faces(nu, nw, closed=False):
    """quads of an nu x nw vertex grid (u major); closed: the w direction wraps"""
    F = []; W = nw if closed else nw - 1
    for i in range(nu - 1):
        for j in range(W):
            j1 = (j + 1) % nw
            F.append((i * nw + j, (i + 1) * nw + j, (i + 1) * nw + j1, i * nw + j1))
    return F

def tube(p, q, w0, w1, z, flat, shade, cls, kind, ox, oy, sides=6):
    p = np.array(p); q = np.array(q); d = q - p; L = float(np.hypot(*d))
    if L < 1e-5: return
    d = d / L; e = np.array([-d[1], d[0]])
    # a little past both ends (the rasteriser's round caps join the strokes of a curved shoot)
    r0, r1 = w0 / 2, w1 / 2; p = p - d * r0 * 0.6; q = q + d * r1 * 0.6
    P = []; su = []; sv = []
    for i, (c, r) in enumerate(((p, r0), (q, r1))):
        for k in range(sides):
            an = 2 * math.pi * k / sides; x = c + e * math.cos(an) * r
            P.append((x[0] + ox, x[1] + oy, z + math.sin(an) * r * flat)); su.append(i); sv.append(math.cos(an))
    add(np.array(P), grid_faces(2, sides, True), shade, cls, kind, su, sv)

def tiltz(dx, dy, tilt):
    # the recorded tilt is the leaf normal ~ (tx, ty, 1): the blade's plane z = -tx dx - ty dy
    return -tilt[0] * dx - tilt[1] * dy

NA_DEF, NT = 16, 5
def blade(pr, z, ox, oy, name):
    hw = np.array(pr['hw']); n = len(hw) - 1
    NA = 48 if name == 'oblong_oak' else NA_DEF
    s = np.linspace(0, 1, NA + 1); h = np.interp(s, np.linspace(0, 1, n + 1), hw)
    if h.max() <= 0: return
    L, ang, x0, y0 = pr['L'], pr['ang'], pr['x'], pr['y']
    d = np.array([math.sin(ang), math.cos(ang)]); e = np.array([math.cos(ang), -math.sin(ang)])
    tn = np.linspace(-1, 1, NT)
    S, TN = np.meshgrid(s, tn, indexing='ij'); H = np.interp(S, s, h)
    X = x0 + d[0] * S * L + e[0] * TN * H * L; Y = y0 + d[1] * S * L + e[1] * TN * H * L
    # fold along the midrib (the halves rise), arch along it and a drooping tip, then the leaf's own facing
    Z = z + 0.5 * np.abs(TN) * H * L + L * (0.1 * np.sin(np.pi * S) - 0.08 * S * S) + tiltz(X - x0, Y - y0, pr['tilt'])
    P = np.stack([X.ravel() + ox, Y.ravel() + oy, Z.ravel()], 1)
    add(P, grid_faces(NA + 1, NT), pr['shade'], pr['cls'], 3 if pr['cls'] == 1 else 0, S.ravel(), TN.ravel())

def palm(pr, z, ox, oy):
    R = np.array(pr['R']); n = len(R) - 1; NTH = 49
    th = np.linspace(-2.3, 2.3, NTH); r = np.interp(th, np.linspace(-2.3, 2.3, n + 1), R)
    L, ang, x0, y0 = pr['L'], pr['ang'], pr['x'], pr['y']
    d = np.array([math.sin(ang), math.cos(ang)]); e = np.array([math.cos(ang), -math.sin(ang)])
    rr = np.linspace(0.04, 1, 5)
    RR, TH = np.meshgrid(rr, th, indexing='ij'); RAD = RR * np.interp(TH, th, r)
    al, ac = RAD * np.cos(TH), RAD * np.sin(TH)
    X = x0 + (d[0] * al + e[0] * ac) * L; Y = y0 + (d[1] * al + e[1] * ac) * L
    # cupped: the lobes turn down and out from the petiole (their faces look outward), then the leaf's own facing
    Z = z - 0.3 * L * RAD * RAD + 0.06 * L * np.cos(TH * 6) * RAD + tiltz(X - x0, Y - y0, pr['tilt'])
    P = np.stack([X.ravel() + ox, Y.ravel() + oy, Z.ravel()], 1)
    F = grid_faces(len(rr), NTH)
    # the centre: a small fan closing the ring at rr[0]
    c = len(P); P = np.vstack([P, [[x0 + ox, y0 + oy, z + tiltz(0, 0, pr['tilt'])]]])
    for j in range(NTH - 1): F.append((c, j + 1, j))
    lob = sorted(abs(v) for v in pr['lobes'] if abs(v) > 1e-3)
    add(P, F, pr['shade'], 0, 1, np.append(RR.ravel(), 0), np.append(TH.ravel(), 0), lob[0] if lob else 9, lob[-1] if len(lob) > 1 else 9)

def flower(pr, z, ox, oy):
    NTH = 40; th = np.linspace(0, 2 * math.pi, NTH, endpoint=False); ph = pr['ph']; p = pr['petals']
    rmax = 0.55 + 0.45 * np.abs(np.cos((th + ph) * p / 2))
    rr = np.linspace(0.05, 1, 4); RR, TH = np.meshgrid(rr, th, indexing='ij'); RAD = RR * np.interp(TH, th, rmax, period=2 * math.pi)
    X = pr['x'] + np.cos(TH) * RAD * pr['r']; Y = pr['y'] + np.sin(TH) * RAD * pr['r']
    Z = z + 0.35 * pr['r'] * RAD * RAD + tiltz(X - pr['x'], Y - pr['y'], pr['tilt'])
    P = np.stack([X.ravel() + ox, Y.ravel() + oy, Z.ravel()], 1)
    F = grid_faces(len(rr), NTH, True)
    c = len(P); P = np.vstack([P, [[pr['x'] + ox, pr['y'] + oy, z]]])
    for j in range(NTH): F.append((c, (j + 1) % NTH, j))
    add(P, F, pr['shade'], 1, 3, np.append(RAD.ravel(), 0), np.append(TH.ravel(), 0))

tiles = J['tiles']
for ti, t in enumerate(tiles):
    ox, oy = (ti % COLS) * GAP, (ti // COLS) * GAP
    N = max(1, len(t['prims']) - 1); cyp = t['name'] in ('spray_cypress', 'spray_tamarisk', 'twig_tamarisk')
    for k, pr in enumerate(t['prims']):
        z = ZS * k / N
        if pr['k'] == 'line':
            # the scale-leaf shoots of cypress and tamarisk are flat sprays; twigs are round
            flat = 0.45 if (pr['cls'] == 0 and cyp) else 1.0
            tube(pr['p'], pr['q'], pr['w0'], pr['w1'], z, flat, pr['shade'], pr['cls'], 4 if pr['cls'] == 0 else 2, ox, oy)
        elif pr['k'] == 'leaf': blade(pr, z, ox, oy, t['name'])
        elif pr['k'] == 'palm': palm(pr, z, ox, oy)
        elif pr['k'] == 'flower': flower(pr, z, ox, oy)
V = np.vstack(verts).astype(np.float32)
log('geometry', len(V), 'vertices', len(faces), 'faces')
me = bpy.data.meshes.new('sprays')
me.vertices.add(len(V)); me.vertices.foreach_set('co', V.ravel())
lens = np.array([len(f) for f in faces], np.int32); starts = np.concatenate([[0], np.cumsum(lens)[:-1]]).astype(np.int32)
me.loops.add(int(lens.sum())); me.loops.foreach_set('vertex_index', np.concatenate([np.array(f, np.int32) for f in faces]))
me.polygons.add(len(faces)); me.polygons.foreach_set('loop_start', starts); me.polygons.foreach_set('loop_total', lens)
me.update(calc_edges=True); me.validate(clean_customdata=False)
for k, v in attrs.items():
    at = me.attributes.new(k, 'FLOAT', 'POINT'); at.data.foreach_set('value', np.concatenate(v))
ob = bpy.data.objects.new('sprays', me); sc.collection.objects.link(ob)
for p in me.polygons: p.use_smooth = True
log('mesh built')

# ---- materials (one per pass)
def attr(nt, name):
    n = nt.nodes.new('ShaderNodeAttribute'); n.attribute_name = name; n.attribute_type = 'GEOMETRY'; return n.outputs['Fac']
def math_(nt, op, x, y=None, clamp=False):
    n = nt.nodes.new('ShaderNodeMath'); n.operation = op; n.use_clamp = clamp
    for i, v in enumerate((x, y)):
        if v is None: continue
        if isinstance(v, (int, float)): n.inputs[i].default_value = v
        else: nt.links.new(v, n.inputs[i])
    return n.outputs[0]
def smooth(nt, e0, e1, x):
    n = nt.nodes.new('ShaderNodeMapRange'); n.interpolation_type = 'SMOOTHSTEP'; n.inputs['From Min'].default_value = e0; n.inputs['From Max'].default_value = e1
    nt.links.new(x, n.inputs['Value']); return n.outputs['Result']

def shade_value(nt):
    """grey albedo: the leaf's recorded shade x veins x margin and base-to-tip gradient; twigs: bark streaks"""
    sh, kind, su, sv, l1, l2 = attr(nt, 'shade'), attr(nt, 'kind'), attr(nt, 'su'), attr(nt, 'sv'), attr(nt, 'l1'), attr(nt, 'l2')
    # blades (kind 0, 3): midrib |sv| < 0.06, secondary veins along 1 - |sv| running out from it at ~45 deg, a paler margin
    asv = math_(nt, 'ABSOLUTE', sv)
    mid = smooth(nt, 0.03, 0.09, asv)                       # 0 on the midrib .. 1 off it
    sec_phase = math_(nt, 'FRACT', math_(nt, 'MULTIPLY', math_(nt, 'SUBTRACT', su, math_(nt, 'MULTIPLY', asv, 0.35)), 9.0))
    sec = smooth(nt, 0.0, 0.12, math_(nt, 'MINIMUM', sec_phase, math_(nt, 'SUBTRACT', 1.0, sec_phase)))  # 0 on a vein
    vein_b = math_(nt, 'MULTIPLY', math_(nt, 'ADD', math_(nt, 'MULTIPLY', mid, 0.2), 0.8), math_(nt, 'ADD', math_(nt, 'MULTIPLY', sec, 0.1), 0.9))
    grad_b = math_(nt, 'ADD', math_(nt, 'MULTIPLY', su, 0.16), 0.84)
    marg_b = math_(nt, 'ADD', math_(nt, 'MULTIPLY', smooth(nt, 0.75, 1.0, asv), 0.08), 1.0)
    blade_v = math_(nt, 'MULTIPLY', math_(nt, 'MULTIPLY', vein_b, grad_b), marg_b)
    # palmate (kind 1): su = radius (0..1 of the outline), sv = angle; veins along the midrib and the lobes' axes
    ath = math_(nt, 'ABSOLUTE', sv)
    dv = math_(nt, 'MINIMUM', ath, math_(nt, 'MINIMUM', math_(nt, 'ABSOLUTE', math_(nt, 'SUBTRACT', ath, l1)), math_(nt, 'ABSOLUTE', math_(nt, 'SUBTRACT', ath, l2))))
    pv = math_(nt, 'ADD', math_(nt, 'MULTIPLY', smooth(nt, 0.015, 0.05, dv), 0.2), 0.8)
    palm_v = math_(nt, 'MULTIPLY', pv, math_(nt, 'ADD', math_(nt, 'MULTIPLY', su, 0.14), 0.86))
    # twigs (kind 2): the side facing the viewer (sv) a little lighter, fine lengthwise streaks
    tw_v = math_(nt, 'ADD', math_(nt, 'MULTIPLY', sv, 0.08), 0.92)
    # petals (kind 3 with a flower's su = radius): a darker heart
    heart = math_(nt, 'ADD', math_(nt, 'MULTIPLY', smooth(nt, 0.15, 0.3, su), 0.45), 0.55)
    # scale-leaf shoots (kind 4): as twigs
    is1 = math_(nt, 'COMPARE', kind, 1.0); math_node = is1.node; math_node.inputs[2].default_value = 0.5
    is2 = math_(nt, 'COMPARE', kind, 2.0); is2.node.inputs[2].default_value = 0.5
    is3 = math_(nt, 'COMPARE', kind, 3.0); is3.node.inputs[2].default_value = 0.5
    is4 = math_(nt, 'COMPARE', kind, 4.0); is4.node.inputs[2].default_value = 0.5
    is0 = math_(nt, 'COMPARE', kind, 0.0); is0.node.inputs[2].default_value = 0.5
    # a petal blade (pomegranate calyx: kind 3 with sv across) takes the blade veins; a flower (sv = angle > 1 somewhere) the heart
    v = math_(nt, 'ADD', math_(nt, 'MULTIPLY', is0, blade_v), math_(nt, 'MULTIPLY', is1, palm_v))
    v = math_(nt, 'ADD', v, math_(nt, 'MULTIPLY', math_(nt, 'ADD', is2, is4), tw_v))
    v = math_(nt, 'ADD', v, math_(nt, 'MULTIPLY', is3, heart))
    return math_(nt, 'MULTIPLY', v, sh)

def material():
    """one material, all passes in one render: the Combined pass is the shade (diffuse under the white sky); AOV 'cls' the
    petal and bark shares (0, petal, bark); AOV 'nrm' the shading normal turned to face the camera (the card is two-sided),
    0.5 + 0.5 n (a material switch between renders re-synced the 2 M-vertex scene each time: 10 s a tile)"""
    m = bpy.data.materials.new('spray'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    d = nt.nodes.new('ShaderNodeBsdfDiffuse'); c = nt.nodes.new('ShaderNodeCombineColor')
    v = shade_value(nt)
    for i in range(3): nt.links.new(v, c.inputs[i])
    nt.links.new(c.outputs[0], d.inputs['Color']); nt.links.new(d.outputs[0], out.inputs['Surface'])
    cl = attr(nt, 'cls'); cc = nt.nodes.new('ShaderNodeCombineColor')
    p = math_(nt, 'COMPARE', cl, 1.0); p.node.inputs[2].default_value = 0.5
    b = math_(nt, 'COMPARE', cl, 2.0); b.node.inputs[2].default_value = 0.5
    nt.links.new(p, cc.inputs[1]); nt.links.new(b, cc.inputs[2])
    ao = nt.nodes.new('ShaderNodeOutputAOV'); ao.aov_name = 'cls'; nt.links.new(cc.outputs[0], ao.inputs['Color'])
    g = nt.nodes.new('ShaderNodeNewGeometry'); vm = nt.nodes.new('ShaderNodeVectorMath'); vm.operation = 'MULTIPLY'
    sgn = math_(nt, 'SUBTRACT', 1.0, math_(nt, 'MULTIPLY', g.outputs['Backfacing'], 2.0))
    cv = nt.nodes.new('ShaderNodeCombineXYZ')
    for i in range(3): nt.links.new(sgn, cv.inputs[i])
    nt.links.new(g.outputs['Normal'], vm.inputs[0]); nt.links.new(cv.outputs[0], vm.inputs[1])
    ma = nt.nodes.new('ShaderNodeVectorMath'); ma.operation = 'MULTIPLY_ADD'; ma.inputs[1].default_value = (0.5, 0.5, 0.5); ma.inputs[2].default_value = (0.5, 0.5, 0.5)
    nt.links.new(vm.outputs[0], ma.inputs[0])
    an = nt.nodes.new('ShaderNodeOutputAOV'); an.aov_name = 'nrm'; nt.links.new(ma.outputs[0], an.inputs['Color'])
    return m

import OpenImageIO as oiio
vl = sc.view_layers[0]
for nm in ('cls', 'nrm'):
    av = vl.aovs.add(); av.name = nm; av.type = 'COLOR'
sc.render.use_compositing = False; sc.render.use_sequencer = False  # the saved EXR is the render result with every pass
sc.render.image_settings.media_type = 'MULTI_LAYER_IMAGE'  # Blender 5: every pass in one EXR
sc.render.image_settings.file_format = 'OPEN_EXR_MULTILAYER'; sc.render.image_settings.color_depth = '32'
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 1.0; cam.data.clip_start = 0.01; cam.data.clip_end = 20
me.materials.clear(); me.materials.append(material())
cy.samples = SPP; cy.use_denoising = False; cy.use_adaptive_sampling = False
res = {k: np.zeros((ROWS * T, COLS * T, 4), np.float32) for k in ('shade', 'cls', 'nrm')}
for ti in range(len(tiles)):
    cx, cyy = (ti % COLS) * GAP + 0.5, (ti // COLS) * GAP + 0.5
    cam.location = (cx, cyy, 5.0); cam.rotation_euler = (0, 0, 0)
    f = os.path.join(out_dir, '_tile.exr'); sc.render.filepath = f
    bpy.ops.render.render(write_still=True)
    # Blender 5 writes a multilayer EXR as one part per pass
    inp = oiio.ImageInput.open(f); chans = {}; k = 0
    while inp.seek_subimage(k, 0):
        spec = inp.spec(); px = np.asarray(inp.read_image(k, 0, 0, spec.nchannels, 'float'), np.float32).reshape(T, T, spec.nchannels)[::-1]  # rows top-down -> v up
        for j, nm in enumerate(spec.channelnames): chans[nm] = px[..., j]
        k += 1
    inp.close(); names = list(chans)
    ch = lambda nm: chans[nm]
    if ti == 0: log('channels', names)
    pre = [n for n in names if n.endswith('Combined.R')][0][:-len('Combined.R')]
    r0, c0 = (ti // COLS) * T, (ti % COLS) * T
    A = ch(pre + 'Combined.A')
    for k, nm in (('shade', 'Combined'), ('cls', 'cls'), ('nrm', 'nrm')):
        for j, cn in enumerate('RGB'): res[k][r0:r0 + T, c0:c0 + T, j] = ch(f'{pre}{nm}.{cn}')
        res[k][r0:r0 + T, c0:c0 + T, 3] = A
    log('tile', ti, tiles[ti]['name'])
for k in res: np.save(os.path.join(out_dir, f'{k}.npy'), res[k])
json.dump({ 'tile': T, 'samples': SPP, 'device': dev_used, 'vertices': int(len(V)), 'faces': len(faces), 'blender': bpy.app.version_string, 'seconds': round(time.time() - t0, 1) }, open(os.path.join(out_dir, 'atlas_render.json'), 'w'))
log('written', out_dir)
