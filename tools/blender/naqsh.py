# PARSA (D-329): Naqsh-e Rustam in Blender (BLENDER_PLAN row 16). Headless:
#   blender -b --factory-startup --python tools/blender/naqsh.py -- <job.json>
# job: { out_dir, device, stages: ["cliff", "facade", "kaba"], cliff/facade/kaba: the numbers of tools/blender/naqsh_src.ts }
# 1. cliff: the game's cliff sheet (cliff_low.bin, its own UVs) receives a Cycles bake from a dense surface (every 8 cm) made of
#    the game's base surface (faceDepth: buttresses, bays, the joint-bounded blocks) plus the limestone's structure, carved in
#    numpy (all C, from the character of the Fars limestone cliffs, no survey of this face): open vertical joints along the
#    blocks' own joints (fissures 4-14 cm wide, 15-50 cm deep), bedding joints with a sharp upper lip and a weathered lower
#    slope, laminations every ~0.45 m, fracture traces, solution flutes (karren) under the crest, conchoidal spall scars,
#    pitting and fine roughness; nothing within the dressed margin round the façades. Maps: normal (8192 x 1024) and an aux
#    map (4096 x 512: R occlusion over 2 m, G albedo x2: run-off varnish below ledges and joints, darker fissures, paler spalls).
# 2. facade (naqsh_facade.py): the tomb façade's carved architecture, one model for both tombs.
# 3. kaba (naqsh_kaba.py): the Ka'ba-ye Zardosht.
import bpy, bmesh, sys, os, json, math, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mon_lib as ml

argv = sys.argv[sys.argv.index('--') + 1:]
job = json.load(open(argv[0])); OUT = job['out_dir']; os.makedirs(OUT, exist_ok=True)
stages = job.get('stages', ['cliff', 'facade', 'kaba']); t0 = time.time()
bpy.ops.wm.read_factory_settings(use_empty=True)
DEV = ml.cycles(job.get('device', 'CPU'))
stats_path = f'{OUT}/model_stats.json'
stats = json.load(open(stats_path)) if os.path.exists(stats_path) else {}
stats.update({'blender': bpy.app.version_string, 'device': DEV})
sc = bpy.context.scene
HERE = os.path.dirname(os.path.abspath(__file__))

def clear():
    for o in list(sc.objects): bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        if m.users == 0: bpy.data.meshes.remove(m)

if 'cliff' in stages:
    C = job['cliff']; nx, nh, st = C['nx'], C['nh'], C['step']; rng = np.random.default_rng(6124)
    raw = open(f'{OUT}/cliff_grid.bin', 'rb').read(); N = nx * nh; o = 0
    def take(dt, n):
        global o; a = np.frombuffer(raw, dt, n, o); o += a.nbytes; return a
    D = take(np.float32, N).reshape(nh, nx).astype(np.float64); Hh = take(np.float32, N).reshape(nh, nx).astype(np.float64)
    Mdr = take(np.uint8, N).reshape(nh, nx) / 255.0; COL = take(np.int16, N).reshape(nh, nx); BED = take(np.int16, N).reshape(nh, nx)
    HOLE = take(np.uint8, N).reshape(nh, nx) > 0; CREST = take(np.float32, nx).astype(np.float64)
    X = C['x0'] + np.arange(nx)[None, :] * st + 0 * Hh
    free = 1 - Mdr
    tl = time.time()
    def dist_to_change(idarr, axis):
        """distance (m) along an axis to the nearest change of the id (a joint), and the id on the far side's sign"""
        a = idarr if axis == 1 else idarr.T
        R, Cn = a.shape; b = np.zeros_like(a, bool); b[:, 1:] = a[:, 1:] != a[:, :-1]
        ii = np.broadcast_to(np.arange(Cn), (R, Cn))
        left = np.maximum.accumulate(np.where(b, ii, -10 ** 6), axis=1)
        right = np.flip(np.minimum.accumulate(np.flip(np.where(b, ii, 10 ** 6), axis=1), axis=1), axis=1)
        dl, dr = ii - left + 0.5, right - ii - 0.5
        d = np.minimum(dl, dr) * st; s = np.where(dl < dr, 1.0, -1.0)   # s: +1 the joint is below/left
        return (d, s) if axis == 1 else (d.T, s.T)
    det = np.zeros((nh, nx)); alb = np.ones((nh, nx)); src = np.zeros((nh, nx))
    # 1. open vertical joints along the blocks' columns
    dj, _ = dist_to_change(COL, 1)
    hcol = (np.sin(COL * 12.9898 + 78.233) * 43758.5453) % 1.0
    wj = (0.02 + 0.05 * hcol) * (1 + 0.6 * np.clip(ml.noise2(rng, nh, nx, 60, 600, 1.0, (1.0, 0.2)), -1, 1))
    Dj = (0.15 + 0.35 * hcol) * np.clip(0.6 + 0.5 * ml.noise2(rng, nh, nx, 80, 900, 1.0, (1.0, 0.1)), 0, 1)
    fis = np.exp(-(dj / np.maximum(wj, 0.01)) ** 2)
    det += Dj * fis; alb *= 1 - 0.28 * fis; src = np.maximum(src, fis * 0.8)
    # 2. bedding joints: sharp upper lip, weathered slope below
    db, sb = dist_to_change(BED, 0)
    hb = (np.sin(BED * 7.13 + COL * 3.7) * 43758.5453) % 1.0
    prof = np.where(sb > 0, np.exp(-(db / 0.03) ** 2), np.exp(-(db / 0.14) ** 2))
    det += (0.05 + 0.13 * hb) * prof * np.clip(0.5 + 0.6 * ml.noise2(rng, nh, nx, 40, 500, 1.0, (0.2, 1.0)), 0, 1)
    src = np.maximum(src, np.exp(-(db / 0.08) ** 2) * (sb > 0))
    # 3. laminations within the beds (steps of 1-2 cm every ~0.45 m, dipping with the beds)
    ph = (Hh + 0.035 * X + 0.25 * ml.noise2(rng, nh, nx, 30, 400, 1.0, (0.3, 1.0)) + 0.9 * ml.noise2(rng, nh, nx, 200, 2000, 1.0, (0.3, 1.0))) / (0.38 + 0.25 * np.clip(0.5 + 0.4 * ml.noise2(rng, nh, nx, 300, 3000), 0, 1))
    det += 0.008 * (ph - np.floor(ph) - 0.5) * np.clip(ml.noise2(rng, nh, nx, 40, 500) * 0.8 + 0.1, 0, 1)   # in patches, not everywhere
    # 4. fracture traces (joints of the second order): short, mostly steep, a few oblique
    fr = np.zeros((nh, nx))
    for _ in range(1400):
        cx, cy = rng.uniform(0, nx), rng.uniform(0, nh); Lm = rng.uniform(0.8, 7.0); ang = math.pi / 2 + rng.normal(0, 0.35) if rng.random() < 0.8 else rng.uniform(0, math.pi)
        w = rng.uniform(0.012, 0.04); dep = rng.uniform(0.02, 0.09)
        hw = int(Lm / 2 / st) + 3; ys, xs = np.arange(int(cy) - hw, int(cy) + hw + 1), np.arange(int(cx) - hw, int(cx) + hw + 1)
        ys, xs = ys[(ys >= 0) & (ys < nh)], xs[(xs >= 0) & (xs < nx)]
        if len(ys) == 0 or len(xs) == 0: continue
        yy, xx = np.meshgrid((ys - cy) * st, (xs - cx) * st, indexing='ij'); c, s = math.cos(ang), math.sin(ang)
        a, b = xx * c + yy * s, -xx * s + yy * c
        taper = np.clip(1 - (np.abs(a) / (Lm / 2)) ** 2, 0, 1)
        prof = np.exp(-(b / max(w, st * 0.6)) ** 2) * taper * dep
        fr[np.ix_(ys, xs)] = np.maximum(fr[np.ix_(ys, xs)], prof)
    det += fr; alb *= 1 - 1.6 * fr
    # 5. solution flutes (karren) in the upper face, below the crest
    xw = X + 0.4 * ml.noise2(rng, nh, nx, 20, 200, 1.0, (0.1, 1.0)) * 1.0
    lam = 0.28 + 0.2 * np.clip(0.5 + 0.5 * ml.noise2(rng, nh, nx, 200, 2000, 1.0, (0.05, 1.0)), 0, 1)
    flute = 0.5 - 0.5 * np.cos(2 * math.pi * xw / lam)
    below = CREST[None, :] - Hh
    fmask = ml.smoothstep(16.0, 3.0, below) * np.clip(0.4 + 0.7 * ml.noise2(rng, nh, nx, 60, 800, 1.0, (0.2, 1.0)), 0, 1)
    det += 0.045 * flute * fmask; src = np.maximum(src, fmask * 0.3)
    # 6. conchoidal spall scars (flat-bottomed, a sharp rim at the top)
    spall = np.zeros((nh, nx))
    for _ in range(700):
        cx, cy = rng.uniform(0, nx), rng.uniform(0, nh); ra, rb = rng.uniform(0.3, 2.6), rng.uniform(0.25, 1.6); dep = rng.uniform(0.03, 0.16)
        ang = rng.uniform(0, math.pi); hw = int(max(ra, rb) / st) + 3
        ys, xs = np.arange(int(cy) - hw, int(cy) + hw + 1), np.arange(int(cx) - hw, int(cx) + hw + 1)
        ys, xs = ys[(ys >= 0) & (ys < nh)], xs[(xs >= 0) & (xs < nx)]
        if len(ys) == 0 or len(xs) == 0: continue
        yy, xx = np.meshgrid((ys - cy) * st, (xs - cx) * st, indexing='ij'); c, s = math.cos(ang), math.sin(ang)
        r2 = ((xx * c + yy * s) / ra) ** 2 + ((-xx * s + yy * c) / rb) ** 2
        cut = dep * np.clip(1 - r2, 0, 1) ** 0.25 * (1 + 0.3 * yy / max(rb, 0.1))
        spall[np.ix_(ys, xs)] = np.maximum(spall[np.ix_(ys, xs)], np.clip(cut, 0, None))
    det += spall; alb *= 1 + 0.06 * np.clip(spall / 0.02, 0, 1)
    # 7. pitting and 8. the fine roughness
    pits = np.clip(ml.noise2(rng, nh, nx, 1.2, 5, 0.3) - 2.0, 0, None) * 0.05
    det += pits + 0.018 * ml.noise2(rng, nh, nx, 1.5, 25, 1.0) + 0.03 * ml.noise2(rng, nh, nx, 25, 250, 1.0)
    det *= free; alb = 1 + (alb - 1) * free
    # run-off varnish: from the ledges, joints and flutes downward, decaying over ~4 m, in streaks
    wet = np.zeros((nh, nx)); acc = np.zeros(nx); k = math.exp(-st / 6.0)
    for j in range(nh - 1, -1, -1):
        acc = np.maximum(acc * k, src[j]); wet[j] = acc
    streak = np.clip(0.5 + 0.8 * ml.noise2(rng, nh, nx, 3, 25, 1.0, (0.02, 1.0)), 0, 1)
    alb *= 1 - 0.45 * wet * streak * free
    alb *= 1 + 0.04 * ml.noise2(rng, nh, nx, 50, 700)
    stats['cliff_detail'] = {'sd_m': float(det.std()), 'p99_m': float(np.percentile(det, 99)), 'alb_mean': float(alb.mean()), 'wet_mean': float(wet.mean()), 'secs': round(time.time() - tl, 1)}
    ml.log('cliff detail', stats['cliff_detail'])
    np.save(f'{OUT}/cliff_alb.npy', alb.astype(np.float32))
    # ---- the high surface: X = x, Y = depth (+ into the rock), Z = h; the holes of the façades cut out
    Yd = D + det
    keep = ~(HOLE[:-1, :-1] & HOLE[1:, :-1] & HOLE[:-1, 1:] & HOLE[1:, 1:])
    high = ml.mesh_from_grid('high', X, Yd, Hh, keep)
    # ---- the low sheet (the game's), and its copy for the parts the high surface does not cover (top, returns)
    lowv = np.frombuffer(open(f'{OUT}/cliff_low.bin', 'rb').read(), np.float32).reshape(-1, 5)
    nv = len(lowv); me = bpy.data.meshes.new('low'); me.vertices.add(nv); me.vertices.foreach_set('co', lowv[:, :3].ravel())
    nt = nv // 3; me.loops.add(nv); me.loops.foreach_set('vertex_index', np.arange(nv, dtype=np.int32))
    me.polygons.add(nt); me.polygons.foreach_set('loop_start', np.arange(0, nv, 3, dtype=np.int32)); me.update(); me.validate(verbose=False)
    uvl = me.uv_layers.new(name='UVMap'); uvl.data.foreach_set('uv', lowv[:, 3:5].ravel())
    low = bpy.data.objects.new('low', me); sc.collection.objects.link(low)
    # the low sheet's normals must face out of the rock (-Y); flip if the export wound them in
    me.update(); nrm = np.empty(nt * 3, np.float32); me.polygons.foreach_get('normal', nrm); ny = nrm.reshape(-1, 3)[:, 1]
    flipped = float((ny > 0.3).mean()); stats['cliff_low_inward_share'] = flipped
    if flipped > 0.5:
        bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.reverse_faces(bm, faces=bm.faces[:]); bm.to_mesh(me); bm.free()
    top = low.copy(); top.data = me.copy(); sc.collection.objects.link(top)
    bm = bmesh.new(); bm.from_mesh(top.data); uvk = bm.loops.layers.uv.active
    dead = [f for f in bm.faces if f.loops[0][uvk].uv.y > 1 - 0.8]    # keep only the top and returns (three's v > 0.8)
    bmesh.ops.delete(bm, geom=dead, context='FACES'); bm.to_mesh(top.data); bm.free()
    for x in list(sc.objects): x.select_set(False)
    high.select_set(True); top.select_set(True); bpy.context.view_layer.objects.active = high; bpy.ops.object.join()
    mat = bpy.data.materials.new('low'); mat.use_nodes = True; me.materials.append(mat); mat.node_tree.nodes.new('ShaderNodeTexImage')
    for k2 in ('visible_camera', 'visible_diffuse', 'visible_glossy', 'visible_transmission', 'visible_volume_scatter', 'visible_shadow'): setattr(low, k2, False)
    W2, H2 = job.get('cliff_w', 8192), job.get('cliff_h', 1024)
    nrmI = ml.bake_image('NORMAL', high, low, W2, H2, 1, cage=0.9, ray=1.8, margin=8)
    aoI = ml.bake_image('AO', high, low, W2 // 2, H2 // 2, job.get('ao_samples', 48), cage=0.9, ray=1.8, ao_dist=2.0, margin=4)
    # coverage: texels no triangle reached (the returns' one texel, gaps) -> a flat normal and no occlusion
    cov = (np.abs(nrmI[..., :3]).sum(-1) > 0.05)
    nrmI[~cov, 0:3] = (0.5, 0.5, 1.0); stats['cliff_cover'] = float(cov.mean())
    ao2 = aoI[..., 0]; ao2 = np.where(np.abs(aoI[..., :3]).sum(-1) > 0.01, ao2, 1.0)
    # albedo: the grid's field resampled onto the face region of the aux map (u along x, v by height: CLIFF_UV)
    Wa, Ha = W2 // 2, H2 // 2; FV0, FV1, HLO, PAD = 0.0, 0.86, -1.5, 11.0
    uu = (np.arange(Wa) + 0.5) / Wa; vv = (np.arange(Ha) + 0.5) / Ha   # rows top-down = three's v
    xq = C['xa'] + uu * (C['xb'] - C['xa']); hq = HLO + (vv - FV0) / (FV1 - FV0) * (C['H'] + PAD - HLO)
    ii = np.clip(np.round((xq - C['x0']) / st).astype(int), 0, nx - 1); jj = np.clip(np.round((hq - C['h0']) / st).astype(int), 0, nh - 1)
    A2 = alb[np.ix_(jj, ii)]; A2 = np.where((vv <= FV1)[:, None], A2, 1.0)
    A2 = ml.blur(A2, 0.7)
    ml.write_png(f'{OUT}/cliff_n.png', ml.q8(nrmI[..., :3]))
    ml.write_png(f'{OUT}/cliff_a.png', ml.q8(np.stack([ao2, np.clip(A2 / 2, 0, 1), np.full_like(ao2, 0.5)], -1)))
    ml.write_png(f'{OUT}/cliff_rake.png', ml.rake(nrmI[:, 3000:5200, :3], np.repeat(np.repeat(ao2, 2, 0), 2, 1)[:, 3000:5200], sun=(-0.7, 0.4, 0.35)))
    stats['cliff_maps'] = {'ao_mean': float(ao2.mean()), 'alb_mean': float(A2.mean()), 'normal_slope_sd': float(np.sqrt(((nrmI[..., :2] * 2 - 1) ** 2).sum(-1).mean()))}
    ml.log('cliff maps', stats['cliff_maps'], 'cover', stats['cliff_cover'], 'low inward', flipped)
    clear()

if 'facade' in stages: exec(open(os.path.join(HERE, 'naqsh_facade.py')).read())
if 'kaba' in stages: exec(open(os.path.join(HERE, 'naqsh_kaba.py')).read())
if 'facade' in stages and 'kaba' in stages:
    for x in list(sc.objects): x.select_set(False)
    names = ('facade', 'kaba_white', 'kaba_dark'); objs = [sc.objects[nm] for nm in names if nm in sc.objects]
    assert len(objs) == 3, [o.name for o in sc.objects]
    for o in objs:
        o.select_set(True); o.data.uv_layers.active = o.data.uv_layers[0]
        if not o.data.materials: o.data.materials.append(bpy.data.materials.new(o.name))
    bpy.ops.export_scene.gltf(filepath=f'{OUT}/naqsh.glb', export_format='GLB', use_selection=True, export_texcoords=True, export_normals=True,
                              export_materials='PLACEHOLDER', export_apply=True, export_yup=True, export_extras=False)
json.dump(stats, open(stats_path, 'w'), indent=1)
ml.log('done', f'{time.time() - t0:.0f} s')
