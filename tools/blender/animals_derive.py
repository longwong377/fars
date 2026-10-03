# PARSA animals, derived from a library body (s18 C14, D-790): a species with no licensed library model of its own is built from
# the nearest real one already in the game (its processed lod0 and baked maps, public/models/animals/<from>.*), reshaped and
# recoloured in Blender, and then goes through the library route like any source (animals_real.py: frame, landmarks, lod0/lod1,
# Cycles bakes). The library itself (Objaverse / Sketchfab on huggingface.co) is not reachable from the cloud (B820).
#   blender -b --factory-startup --python tools/blender/animals_derive.py -- <job.json>
# job.json: { "recipe": "bactrian" | "zebu", "glb": <from>.glb, "albedo": png, "nrm": png, "out": derived.glb, "rig": the donor's
#             manifest rig (landmarks in the game's frame) }
# Recipes (every number C, from the common picture of the breeds; the shapes in the reliefs: the Bactrian camels of the Apadana's
# delegations, B for the species at Persepolis):
#   bactrian (and bactrian_pack: the humps a fifth lower under the load) — from the dromedary: one hump made two (fore and hind, a saddle between, both lower than the dromedary's), the long
#              dark winter hair under the throat, on the upper fore legs and on the humps' tops, the coat darker and browner;
#   boar     — from the hyena (the nearest build: the high forehand and sloping back): the snout drawn out into the long wedge,
#              the legs a fifth shorter, the bristled crest along the spine, the hide dark grey-brown grizzle;
#   zebu     — from the cow: the hump over the withers, the deep dewlap under the throat and brisket, the coat grey-white with
#              the bull's darker forehand (the cow's ears kept: a drooping ear is a later breed's mark, and the mesh's ears are thin).
import bpy, sys, json, math
import numpy as np

job = json.load(open(sys.argv[sys.argv.index('--') + 1]))
log = lambda *a: print('[animals_derive]', *a, flush=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=job['glb'])
objs = [o for o in bpy.data.objects if o.type == 'MESH']
lod0 = next(o for o in objs if o.name.startswith('lod0'))
for o in objs:
    if o is not lod0: bpy.data.objects.remove(o, do_unlink=True)
me = lod0.data; me.transform(lod0.matrix_world); lod0.matrix_world.identity()
lod0.name = 'derived'; me.name = 'derived'  # (the library route names its own levels lod0 and lod1)
# twice as fine before reshaping (the donor's lod0 is ~6 k triangles: a hump drawn on it came out a pyramid); the library route
# decimates it back to its budget, following the new shape
bpy.context.view_layer.objects.active = lod0; lod0.select_set(True)
sub = lod0.modifiers.new('sub', 'SUBSURF'); sub.subdivision_type = 'SIMPLE'; sub.levels = 1; sub.uv_smooth = 'PRESERVE_BOUNDARIES'
bpy.ops.object.modifier_apply(modifier=sub.name); me = lod0.data
n = len(me.vertices)
co = np.empty(n * 3, np.float32); me.vertices.foreach_get('co', co); co = co.reshape(-1, 3)
# the game's frame: x, y up, z forward  (glTF import: Blender (X, Y, Z) = (x, -z, y))
G = np.stack([co[:, 0], co[:, 2], -co[:, 1]], 1).astype(np.float64)
R = job['rig']
rng = np.random.default_rng(7)
def sstep(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def gauss(x, s): return np.exp(-(x / s) ** 2)
# a hair fringe: a jagged edge by position (strands in clumps), deterministic
def fringe(x, z, k=1.0): return 0.65 + 0.35 * np.sin(53 * x + 37 * z) * np.sin(29 * z - 17 * x + 1.3) * k
dark = np.ones(n)  # the coat's darkening per vertex (multiplied into the albedo through a colour attribute)
halfW = R['halfW']; base = np.array(R['base']); top = np.array(R['top'])

def neck_frame():
    # the neck's axis from its base to the poll, and each vertex's place along it (0..1), distance and side below it
    a = base[1:]; b = top[1:]; d = b - a; L2 = float(d @ d)
    p = G[:, 1:]; t = np.clip(((p - a) @ d) / L2, 0, 1); q = a + t[:, None] * d
    off = p - q; nrm = np.array([d[1], -d[0]]) / math.sqrt(L2)  # the normal below the axis (y down for a forward neck)
    below = off @ nrm
    return t, np.hypot(off[:, 0], off[:, 1]), below

if job['recipe'] in ('bactrian', 'bactrian_pack'):
    x, y, z = G[:, 0], G[:, 1], G[:, 2]
    mid = np.abs(x) < 0.12
    zs = np.arange(z.min(), z.max() + 0.05, 0.05); prof = np.full(len(zs), np.nan)
    for i, zz in enumerate(zs):
        m = mid & (np.abs(z - zz) < 0.04)
        if m.any(): prof[i] = y[m].max()
    ok = ~np.isnan(prof); prof = np.interp(zs, zs[ok], prof[ok])
    h0 = np.interp(z, zs, prof)
    # the back line under the hump: from the withers in front of it (over the fore legs) to the croup over the hind legs
    zf_leg = np.mean([l['z'] for l in R['legs'] if l['fore'] > 0]); zh_leg = np.mean([l['z'] for l in R['legs'] if l['fore'] < 0])
    yw = float(np.interp(zf_leg + 0.12, zs, prof)); yc = float(np.interp(zh_leg - 0.05, zs, prof))
    # the dromedary's hump stands above that line between the legs
    def baseline(zz): return yc + (yw - yc) * np.clip((zz - zh_leg) / (zf_leg - zh_leg), 0, 1)
    e0 = np.maximum(h0 - baseline(z), 0)
    hump = (z > zh_leg - 0.1) & (z < zf_leg + 0.15)
    peak = float(e0[hump & mid].max()); span = zf_leg - zh_leg
    zF, zH = zh_leg + 0.86 * span, zh_leg + 0.34 * span; sg = 0.17 * span  # (the fore hump over the withers, the hind over the loins: the saddle where the pack rides)
    e1 = 0.82 * peak * np.maximum(gauss(z - zF, sg), gauss(z - zH, sg * 1.1)) + 0.12 * peak * gauss(z - (zF + zH) / 2, 0.5 * span)
    # the saddle between them dips to the back's own line and a little under it (the humps stand up from the back: C)
    e1 = e1 - 0.22 * peak * gauss(z - (zF + zH) / 2, 0.14 * span)
    if job['recipe'] == 'bactrian_pack': e1 *= 0.8  # (a working camel under its load: the humps lower, pressed by the saddle's pads)
    # each vertex of the upper body moves by the change of the hump's height, fading down the flanks (the barrel stays)
    lo = baseline(z) - 0.32
    t = np.clip((y - lo) / np.maximum(h0 - lo, 1e-3), 0, 1) ** 1.6 * hump
    dy = t * (e1 - e0)
    # the humps are narrower at the top: draw the upper sides in a little where the saddle drops
    G[:, 1] += dy
    G[:, 0] *= 1 - 0.08 * t * np.clip(-dy / max(peak, 1e-3), 0, 1)
    log('humps: peak', round(peak, 3), 'fore/hind at', round(zF, 2), round(zH, 2), 'moved', int((np.abs(dy) > 0.005).sum()))
    # the long hair: under the throat (a beard down the neck's underside), on the upper fore legs, on the humps' tops
    tn, dn, below = neck_frame()
    throat = (tn > 0.12) & (tn < 0.85) & (below > 0) & (dn < 0.32) & (G[:, 2] > base[2] - 0.05)
    hair = gauss(tn - 0.45, 0.28) * fringe(G[:, 0], G[:, 2]) * throat * sstep(0.0, 0.08, below)
    G[:, 1] -= 0.26 * hair; G[:, 2] -= 0.05 * hair
    dark *= 1 - 0.6 * np.clip(hair * 1.6, 0, 1)
    fore = (G[:, 2] > zf_leg - 0.25) & (G[:, 2] < zf_leg + 0.3) & (G[:, 1] > R['kneeY'] + 0.25) & (G[:, 1] < R['bellyY'] + 0.05) & (np.abs(G[:, 0]) > 0.08)
    sleeve = fore * sstep(R['kneeY'] + 0.25, R['kneeY'] + 0.45, G[:, 1]) * fringe(G[:, 1], G[:, 2], 0.6)
    lc = np.array([[l['x'], l['z']] for l in R['legs'] if l['fore'] > 0]).mean(0)
    rad = np.stack([G[:, 0] - np.sign(G[:, 0]) * abs(lc[0]), G[:, 2] - lc[1]], 1); rn = np.linalg.norm(rad, axis=1) + 1e-6
    G[:, 0] += 0.06 * sleeve * rad[:, 0] / rn; G[:, 2] += 0.06 * sleeve * rad[:, 1] / rn
    dark *= 1 - 0.45 * np.clip(sleeve, 0, 1)
    tops = hump & (t > 0.75) & (np.maximum(gauss(G[:, 2] - zF, sg), gauss(G[:, 2] - zH, sg)) > 0.4)
    G[tops, 1] += 0.035 * fringe(G[tops, 0], G[tops, 2]); dark[tops] *= 0.5
    coat = np.array([0.66, 0.50, 0.39])  # browner and darker than the dromedary's sand (linear factor)
    log('hair: throat', int((hair > 0.05).sum()), 'sleeves', int((sleeve > 0.05).sum()), 'hump tops', int(tops.sum()))
elif job['recipe'] == 'zebu':
    x, y, z = G[:, 0], G[:, 1], G[:, 2]
    zf_leg = np.mean([l['z'] for l in R['legs'] if l['fore'] > 0])
    H = R['backY']; zw = zf_leg - 0.02
    # the hump: over the withers, a little forward of the fore legs' tops, leaning back (C: ~14 % of the withers height in a bull)
    upper = sstep(R['bodyY'] + 0.05, H - 0.02, y)
    # (a dome, not a peak: the hump is a rounded lump of muscle and fat over the withers)
    hump = np.sqrt(np.clip(1 - ((z - zw) / 0.22) ** 2 - (x / 0.15) ** 2, 0, 1)) ** 1.5 * upper
    G[:, 1] += 0.19 * hump; G[:, 2] -= 0.04 * hump * sstep(zw - 0.1, zw + 0.1, z)
    # the dewlap: the skin under the throat and the brisket hangs in a deep fold, thin from side to side
    tn, dn, below = neck_frame()
    zthroat = base[2] + 0.62 * (top[2] - base[2])
    dz = (z > zf_leg - 0.05) & (z < zthroat + 0.05) & (np.abs(x) < 0.13) & (y < base[1] + 0.12) & (y > R['bellyY'] - 0.05)
    under = dz & ((below > -0.01) | (z < base[2] + 0.05))
    w = under * gauss((z - (zf_leg + zthroat) / 2) / max(zthroat - zf_leg, 0.1), 0.6) * np.clip(1 - np.abs(x) / 0.15, 0, 1)
    G[:, 1] -= 0.17 * w; G[:, 0] *= 1 - 0.35 * np.clip(w * 2, 0, 1)
    dark *= 1 - 0.38 * np.clip(hump * 2 + gauss(z - zw, 0.35) * upper * 0.6 + w, 0, 1)
    coat = None
    log('hump', int((hump > 0.05).sum()), 'dewlap', int((w > 0.05).sum()))
elif job['recipe'] == 'boar':
    x, y, z = G[:, 0], G[:, 1], G[:, 2]
    # the long wedge of the snout: the head ahead of the eyes drawn out along its axis and narrowed to the disc (C: a boar's
    # head is a third of its body length, the snout most of it)
    hdv = np.array(R['muzzle']) - top; hl = float(np.linalg.norm(hdv)); hd = hdv / hl
    s_ = (G - top) @ hd; s_eye = 0.32 * hl
    fwd = np.clip((s_ - s_eye) / (hl - s_eye), 0, 1) * (s_ > s_eye)
    near_head = np.linalg.norm(G - (top + np.outer(np.clip(s_, 0, hl), hd)), axis=1) < 0.16
    w = fwd * near_head
    radial = (G - top) - np.outer(s_, hd)
    G += np.outer(w * (s_ - s_eye) * 0.55, hd) - radial * (0.28 * w)[:, None]
    # the shorter legs: the body lowered toward its feet (legs a fifth shorter; the barrel kept)
    bel = R['bellyY']; k = 0.8
    G[:, 1] = np.where(G[:, 1] < bel, G[:, 1] * k, G[:, 1] - bel * (1 - k))
    # the bristled crest along the spine from the nape to the croup
    tn, dn, below = neck_frame()
    back = (np.abs(G[:, 0]) < 0.05) & (G[:, 2] > R['tailRoot'][2] + 0.1) & (G[:, 2] < top[2] - 0.12)
    prof_y = np.interp(G[:, 2], *zip(*sorted({round(float(zz), 2): float(G[(np.abs(G[:, 2] - zz) < 0.03) & (np.abs(G[:, 0]) < 0.05), 1].max(initial=-1)) for zz in np.arange(G[:, 2].min(), G[:, 2].max(), 0.02)}.items())))
    crest = back & (G[:, 1] > prof_y - 0.035)
    G[crest, 1] += 0.045 * fringe(G[crest, 0], G[crest, 2]) * (1 - np.abs(G[crest, 0]) / 0.05)
    dark[crest] *= 0.55
    dark *= 1 - 0.35 * np.clip(w * 2, 0, 1) * (s_ > 0.85 * hl)  # (the snout's disc darker)
    coat = None
    log('snout', int((w > 0.05).sum()), 'crest', int(crest.sum()))
else:
    raise SystemExit('unknown recipe ' + job['recipe'])

co = np.stack([G[:, 0], -G[:, 2], G[:, 1]], 1).astype(np.float32)
me.vertices.foreach_set('co', co.ravel()); me.update()
# ---- the coat: the donor's albedo recoloured (linear), times the per-vertex darkening
img = bpy.data.images.load(job['albedo']); img.colorspace_settings.name = 'sRGB'
W_, H_ = img.size; px = np.empty(W_ * H_ * 4, np.float32); img.pixels.foreach_get(px); px = px.reshape(-1, 4)
lin = np.where(px[:, :3] <= 0.04045, px[:, :3] / 12.92, ((px[:, :3] + 0.055) / 1.055) ** 2.4)
if job['recipe'] == 'boar':
    # the spotted hide to a boar's dark grizzled bristles: the luminance's contrast halved (the spots fade into grizzle), on
    # a grey-brown (C: Sus scrofa's winter coat)
    lum = lin @ np.array([0.2126, 0.7152, 0.0722]); fg = px[:, 3] > 0.5; mu = float(lum[fg].mean()) if fg.any() else 0.1
    l2 = mu + (lum - mu) * 0.45
    lin = np.clip(np.outer(l2 / max(mu, 1e-4), [0.085, 0.07, 0.058]), 0, 1)
elif job['recipe'] == 'zebu':
    lum = lin @ np.array([0.2126, 0.7152, 0.0722])
    # grey-white: the red-brown's luminance lifted toward a pale warm grey, its grain kept
    lin = np.clip(np.stack([lum, lum, lum], 1) * 1.75 * np.array([1.0, 0.96, 0.9]) + 0.02, 0, 1) * 0.9 + 0.1 * lin
else:
    lin = np.clip(lin * coat, 0, 1)
# the per-vertex darkening painted into the coat through the donor's UVs (a glTF round trip drops a colour attribute in the
# material): each triangle's UV footprint filled with its vertices' values, interpolated
uvl = me.uv_layers.active.data; me.calc_loop_triangles()
shade = np.ones((H_, W_), np.float32)
for tri in me.loop_triangles:
    uv = np.array([uvl[l].uv[:] for l in tri.loops]) * [W_, H_]; dv = dark[list(tri.vertices)]
    if np.all(dv > 0.999): continue
    x0, y0 = np.floor(uv.min(0)).astype(int); x1, y1 = np.ceil(uv.max(0)).astype(int)
    x0, y0 = max(x0 - 1, 0), max(y0 - 1, 0); x1, y1 = min(x1 + 1, W_ - 1), min(y1 + 1, H_ - 1)
    if x1 < x0 or y1 < y0: continue
    xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
    (ax, ay), (bx, by), (cx, cy) = uv; den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
    if abs(den) < 1e-9: continue
    l1 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / den; l2 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / den; l3 = 1 - l1 - l2
    inside = (l1 > -0.02) & (l2 > -0.02) & (l3 > -0.02)
    val = l1 * dv[0] + l2 * dv[1] + l3 * dv[2]
    blk = shade[y0:y1 + 1, x0:x1 + 1]; blk[inside] = np.minimum(blk[inside], val[inside])
lin = lin * shade.reshape(-1)[:, None]
srgb = np.where(lin <= 0.0031308, lin * 12.92, 1.055 * np.power(lin, 1 / 2.4) - 0.055)
out = bpy.data.images.new('coat', W_, H_, alpha=True); out.colorspace_settings.name = 'sRGB'
out.pixels.foreach_set(np.concatenate([srgb, np.ones((len(srgb), 1), np.float32)], 1).astype(np.float32).ravel())
out.filepath_raw = job['out'].replace('.glb', '_coat.png'); out.file_format = 'PNG'; out.save(); out.pack()
nimg = bpy.data.images.load(job['nrm']); nimg.colorspace_settings.name = 'Non-Color'; nimg.pack()
mat = bpy.data.materials.new('coat'); mat.use_nodes = True; nt = mat.node_tree; bsdf = nt.nodes.get('Principled BSDF')
ti = nt.nodes.new('ShaderNodeTexImage'); ti.image = out; nt.links.new(ti.outputs['Color'], bsdf.inputs['Base Color'])
tn_ = nt.nodes.new('ShaderNodeTexImage'); tn_.image = nimg; nm = nt.nodes.new('ShaderNodeNormalMap')
nt.links.new(tn_.outputs['Color'], nm.inputs['Color']); nt.links.new(nm.outputs['Normal'], bsdf.inputs['Normal'])
bsdf.inputs['Roughness'].default_value = 0.85
me.materials.clear(); me.materials.append(mat)
for p in me.polygons: p.use_smooth = True
bpy.ops.export_scene.gltf(filepath=job['out'], export_format='GLB', export_yup=True, export_normals=True, export_materials='EXPORT', export_image_format='AUTO',
                          export_extras=False, export_animations=False, export_skins=False, export_morph=False)
log('wrote', job['out'], n, 'vertices')
