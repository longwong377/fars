# PARSA asset pipeline (D-331; BLENDER_PLAN row 19): the far people's impostor atlas rendered in Cycles.
# Input: tools/blender/sources/people_imp_src.ts's arrays (every impostor dress at full detail, posed in every frame of the
# atlas, in Blender's axes) and the strand atlas (people_hair_atlas.ktx2 transcoded to PNG) for the cards' coverage.
# Each dress is one scene: per frame one mesh, per view a linked duplicate turned about the vertical by -view angle (the
# CPU bake's views: view k looks from direction (sin a, 0, cos a) in the person's frame, a = 2 pi k / views), laid out in a
# grid with 0.5 m / 0.25 m gaps (a pose reaching past its cell is cut at the cell's edge, as before, never drawn into a
# neighbour's), seen by one orthographic camera at 40 px/m. Four emission renders (film transparent, box filter, the same
# seed: the coverage is the same in each), each premultiplied by coverage:
#   0: the colour-slot weights main, second, trim      1: skin, hair, leather/felt (the fixed colour = coverage - the rest)
#   2: the normal in the view's frame (right, up, toward the viewer) * 0.5 + 0.5
#   3: ambient occlusion (Cycles AO, the figure's own geometry, 0.25 m), depth toward the viewer (0.5 + d / 1.6 m), 0
# The cells are cut out, resampled by area from 64 x 80 px to 64 x 64 texels (the cell's 1.6 x 2.0 m), rows from the feet
# up, and saved per dress as float16 (frames, views, 64, 64, 16) for the node post-step (impostors.mjs).
#   blender -b --factory-startup --python tools/blender/people_impostors.py -- <src dir> <out dir> [spp=64] [device=CPU] [dresses]
import bpy, sys, os, json, math, time, numpy as np
a = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = a[0], a[1]; SPP = int(a[2]) if len(a) > 2 else 64; DEVICE = a[3] if len(a) > 3 else 'CPU'
ONLY = a[4].split(',') if len(a) > 4 and a[4] else None
os.makedirs(OUT, exist_ok=True)
meta = json.load(open(os.path.join(SRC, 'meta.json')))
IMP = meta['IMP']; VIEWS = IMP['views']; CW, CH, Y0 = IMP['width'], IMP['height'], IMP['y0']
PXM = 40  # px per metre across (64 px over the 1.6 m cell); vertically 80 px over 2.0 m, resampled to 64
CELL = 64; GX, GY = 0.5, 0.25  # gaps (m) each side of a cell
SW, SH = CW + 2 * GX, CH + 2 * GY  # slot (m)
SPX, SPY = round(SW * PXM), round(SH * PXM); CPX, CPY = round(CW * PXM), round(CH * PXM); GPX, GPY = round(GX * PXM), round(GY * PXM)
t0 = time.time()
def log(*x): print(f'[people_impostors {time.time() - t0:.0f}s]', *x, flush=True)

def scene_setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; cy = sc.cycles
    cy.samples = SPP; cy.seed = 0; cy.use_denoising = False; cy.use_adaptive_sampling = False
    cy.pixel_filter_type = 'BOX'; cy.filter_width = 1.0
    cy.max_bounces = 0; cy.diffuse_bounces = 0; cy.glossy_bounces = 0; cy.transmission_bounces = 0; cy.volume_bounces = 0; cy.transparent_max_bounces = 32
    sc.render.film_transparent = True; sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'; sc.view_settings.exposure = 0; sc.view_settings.gamma = 1
    sc.render.use_compositing = False; sc.render.use_sequencer = False
    im = sc.render.image_settings; im.file_format = 'OPEN_EXR'; im.color_mode = 'RGBA'; im.color_depth = '32'; im.exr_codec = 'ZIP'
    used = 'CPU'
    if DEVICE == 'GPU':
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for t in ('OPTIX', 'CUDA'):
            try:
                prefs.compute_device_type = t; prefs.get_devices(); ds = [d for d in prefs.devices if d.type == t]
                if ds:
                    for d in prefs.devices: d.use = d.type == t
                    cy.device = 'GPU'; used = t; break
            except Exception as e: log('device', t, 'unavailable', e)
    else: sc.render.threads_mode = 'AUTO'
    log('device', used)
    return sc

def material(atlas_img):
    m = bpy.data.materials.new('imp'); m.use_nodes = True; nt = m.node_tree; nt.nodes.clear(); N = nt.nodes.new; L = nt.links.new
    def attr(name, kind='GEOMETRY'): n = N('ShaderNodeAttribute'); n.attribute_name = name; n.attribute_type = kind; return n
    def math(op, x, y=None, val=None):
        n = N('ShaderNodeMath'); n.operation = op
        if hasattr(x, 'bl_idname') or not isinstance(x, (int, float)): L(x, n.inputs[0])
        else: n.inputs[0].default_value = x
        if y is not None:
            if isinstance(y, (int, float)): n.inputs[1].default_value = y
            else: L(y, n.inputs[1])
        if val is not None: n.inputs[2].default_value = val
        return n.outputs[0]
    def comb(x, y, z):
        n = N('ShaderNodeCombineXYZ')
        for i, v in enumerate((x, y, z)):
            if isinstance(v, (int, float)): n.inputs[i].default_value = v
            else: L(v, n.inputs[i])
        return n.outputs[0]
    def vmath(op, x, y=None, s=None):
        n = N('ShaderNodeVectorMath'); n.operation = op; L(x, n.inputs[0])
        if y is not None:
            if isinstance(y, tuple): n.inputs[1].default_value = y
            else: L(y, n.inputs[1])
        if s is not None: n.inputs[3].default_value = s  # (SCALE's factor)
        return n.outputs['Vector' if op not in ('DOT_PRODUCT', 'LENGTH') else 'Value']
    slot = attr('fslot').outputs['Fac']; card = attr('fcard').outputs['Fac']
    w = [math('COMPARE', slot, float(k), 0.5) for k in range(6)]
    uv = N('ShaderNodeUVMap'); uv.uv_map = 'cuv'
    tex = N('ShaderNodeTexImage'); tex.image = atlas_img; tex.interpolation = 'Linear'; tex.extension = 'CLIP'; L(uv.outputs['UV'], tex.inputs['Vector'])
    alpha = math('ADD', math('SUBTRACT', 1.0, card), math('MULTIPLY', card, tex.outputs['Alpha']))
    # the normal: the vertex normal (object space, the skinned one) to world, flipped on back faces (two-sided cards)
    na = attr('nrm'); vt = N('ShaderNodeVectorTransform'); vt.vector_type = 'NORMAL'; vt.convert_from = 'OBJECT'; vt.convert_to = 'WORLD'
    L(na.outputs['Vector'], vt.inputs['Vector']); nn = vmath('NORMALIZE', vt.outputs['Vector'])
    geo = N('ShaderNodeNewGeometry'); flip = math('SUBTRACT', 1.0, math('MULTIPLY', geo.outputs['Backfacing'], 2.0))
    nw = vmath('SCALE', nn, s=1.0); sc_node = nw.node; L(flip, sc_node.inputs['Scale'])
    sep = N('ShaderNodeSeparateXYZ'); L(nw, sep.inputs[0])
    nview = comb(math('MULTIPLY_ADD', sep.outputs[0], 0.5, 0.5), math('MULTIPLY_ADD', sep.outputs[2], 0.5, 0.5), math('MULTIPLY_ADD', math('MULTIPLY', sep.outputs[1], -1.0), 0.5, 0.5))
    ao = N('ShaderNodeAmbientOcclusion'); ao.only_local = True; ao.samples = 16; ao.inputs['Distance'].default_value = 0.25
    oi = N('ShaderNodeObjectInfo'); rel = vmath('SUBTRACT', geo.outputs['Position'], oi.outputs['Location']); sr = N('ShaderNodeSeparateXYZ'); L(rel, sr.inputs[0])
    depth = math('MULTIPLY_ADD', sr.outputs[1], -1.0 / 1.6, 0.5)
    cA = comb(w[0], w[1], w[2]); cB = comb(w[3], w[4], w[5]); cD = comb(ao.outputs['AO'], depth, 0.0)
    pv = N('ShaderNodeValue'); pv.name = 'pass'; pv.outputs[0].default_value = 0
    col = None
    for k, c in enumerate((cA, cB, nview, cD)):
        f = math('COMPARE', pv.outputs[0], float(k), 0.5); term = vmath('SCALE', c); L(f, term.node.inputs['Scale'])
        col = term if col is None else vmath('ADD', col, term)
    em = N('ShaderNodeEmission'); L(col, em.inputs['Color']); em.inputs['Strength'].default_value = 1.0
    tr = N('ShaderNodeBsdfTransparent'); mx = N('ShaderNodeMixShader'); L(alpha, mx.inputs[0]); L(tr.outputs[0], mx.inputs[1]); L(em.outputs[0], mx.inputs[2])
    o = N('ShaderNodeOutputMaterial'); L(mx.outputs[0], o.inputs['Surface'])
    return m, pv

def mesh(name, P, I, nrm=None, fslot=None, fcard=None, cuv=None):
    me = bpy.data.meshes.new(name); nv, T = len(P), len(I)
    me.vertices.add(nv); me.vertices.foreach_set('co', P.astype(np.float32).ravel())
    me.loops.add(3 * T); me.loops.foreach_set('vertex_index', I.astype(np.int32).ravel())
    me.polygons.add(T); me.polygons.foreach_set('loop_start', np.arange(0, 3 * T, 3, dtype=np.int32))
    me.update(calc_edges=True)
    if nrm is None: vn = np.empty(nv * 3, np.float32); me.vertex_normals.foreach_get('vector', vn); nrm = vn.reshape(nv, 3)
    at = me.attributes.new('nrm', 'FLOAT_VECTOR', 'POINT'); at.data.foreach_set('vector', nrm.astype(np.float32).ravel())
    at = me.attributes.new('fslot', 'FLOAT', 'FACE'); at.data.foreach_set('value', (fslot if fslot is not None else np.full(T, 6)).astype(np.float32))
    at = me.attributes.new('fcard', 'FLOAT', 'FACE'); at.data.foreach_set('value', (fcard if fcard is not None else np.zeros(T)).astype(np.float32))
    uvl = me.uv_layers.new(name='cuv')
    if cuv is not None: uvl.data.foreach_set('uv', cuv[I.ravel()].astype(np.float32).ravel())
    return me

def resample_rows(img, n_out):
    """area resampling along axis 0 (rows) from img.shape[0] rows to n_out"""
    n_in = img.shape[0]; R = np.zeros((n_out, n_in), np.float64); s = n_in / n_out
    for r in range(n_out):
        a0, a1 = r * s, (r + 1) * s
        for i in range(int(math.floor(a0)), min(n_in, int(math.ceil(a1)))):
            R[r, i] = max(0.0, min(a1, i + 1) - max(a0, i)) / s
    return np.tensordot(R, img, axes=(1, 0))

stats = {'spp': SPP, 'device': DEVICE, 'px_per_m': PXM, 'cell': CELL, 'dresses': {}}
for D in meta['dresses']:
    dress = D['dress']
    if D.get('missing') or (ONLY and dress not in ONLY): continue
    sc = scene_setup(); td = time.time()
    img = bpy.data.images.load(os.path.join(SRC, 'hair_atlas.png')); img.colorspace_settings.name = 'Non-Color'; img.alpha_mode = 'CHANNEL_PACKED'
    mat, pv = material(img)
    ld = lambda k: np.load(os.path.join(SRC, f'{dress}_{k}.npy'))
    Pa, Na, I, fslot, fcard, cuv = ld('pos'), ld('nrm'), ld('idx'), ld('fslot'), ld('fcard'), ld('cuv')
    F = Pa.shape[0]; props = set(D.get('propFrames', []))
    W, H = VIEWS * SPX, F * SPY
    for f in range(F):
        me = mesh(f'{dress}_{f}', Pa[f], I, Na[f], fslot, fcard, cuv); me.materials.append(mat)
        pm = None
        if f in props:
            pp, pi = np.load(os.path.join(SRC, f'{dress}_prop{f}_pos.npy')), np.load(os.path.join(SRC, f'{dress}_prop{f}_idx.npy'))
            pm = mesh(f'{dress}_{f}_prop', pp, pi); pm.materials.append(mat)
        for v in range(VIEWS):
            al = v / VIEWS * 2 * math.pi
            # the person's origin: the cell's centre across, the cell's y0 at the cell's bottom (slot rows from the top)
            x = v * SW + GX + CW / 2 - W / PXM / 2
            zt = H / PXM / 2 - f * SH - GY  # the cell's top edge (world z), the image's centre at 0
            z = zt - CH - Y0
            for m_, nm in ((me, ''), (pm, 'p')):
                if m_ is None: continue
                ob = bpy.data.objects.new(f'{dress}_{f}_{v}{nm}', m_); sc.collection.objects.link(ob)
                ob.location = (x, 0.0, z); ob.rotation_euler = (0.0, 0.0, -al)
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = max(W, H) / PXM; cam.data.clip_start = 0.1; cam.data.clip_end = 20
    cam.location = (0.0, -10.0, 0.0); cam.rotation_euler = (math.pi / 2, 0.0, 0.0)
    sc.render.resolution_x = W; sc.render.resolution_y = H; sc.render.resolution_percentage = 100
    out = np.zeros((F, VIEWS, CELL, CELL, 16), np.float32)
    for p in range(4):
        pv.outputs[0].default_value = p
        path = os.path.join(OUT, f'{dress}_pass{p}.exr'); sc.render.filepath = path
        tr = time.time(); bpy.ops.render.render(write_still=True)
        im = bpy.data.images.load(path, check_existing=False); im.colorspace_settings.name = 'Non-Color'
        px = np.empty(W * H * 4, np.float32); im.pixels.foreach_get(px); bpy.data.images.remove(im)
        px = px.reshape(H, W, 4)[::-1]  # rows from the top
        for f in range(F):
            for v in range(VIEWS):
                y0, x0 = f * SPY + GPY, v * SPX + GPX
                cell = px[y0:y0 + CPY, x0:x0 + CPX]  # 80 x 64, head at the top
                out[f, v, :, :, p * 4:(p + 1) * 4] = resample_rows(cell, CELL)[::-1]  # rows from the feet up
        log(dress, 'pass', p, f'{time.time() - tr:.1f} s')
    np.save(os.path.join(OUT, f'{dress}.npy'), out.astype(np.float16))
    cov = out[..., 3]
    stats['dresses'][dress] = {'frames': F, 'objects': len(sc.objects) - 1, 'seconds': round(time.time() - td, 1), 'coverage': float((cov > 0.5).mean()),
        'edge_coverage': float(np.concatenate([cov[:, :, :, 0], cov[:, :, :, -1], cov[:, :, -1, :]]).max())}
    log(dress, stats['dresses'][dress])
stats['blender'] = bpy.app.version_string; stats['seconds'] = round(time.time() - t0, 1)
json.dump(stats, open(os.path.join(OUT, 'render_stats.json' if not ONLY else f'render_stats_{"_".join(ONLY)}.json'), 'w'), indent=1)
log('done')
