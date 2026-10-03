# The town kit (D-802; s18 cloud C15, lead 3: "replace the code-generated box buildings with modelled ones"): the modular
# pieces the town's and the villages' mud-brick houses are built from, modelled in Blender from the project's measures and
# eroded with seeded noise, their ambient occlusion baked by Cycles into the vertices. The same conventions as the house kit
# (tools/blender/housekit.py, D-311; src/world/settlement/kit.ts kitFrame): game axes, y up; each piece in a UNIT FRAME that
# kitFrame(b, piece, O, X, Y, Z) maps onto a wall of any length, height and thickness:
#   x 0..1 along the run (X = the run vector), y 0..1 up (Y = up x the height), z -0.5..0.5 across (Z = the normal x thickness)
# Pieces (tier C; analogues: the region's vernacular adobe, the excavated Iron Age / Achaemenid houses of Hasanlu, Nush-i Jan,
# Tall-i Malyan, the Persepolis plain survey; HOUSE_PARTS):
#   wall0..2      a 1 m run of plastered mud brick: the float's undulation, a bulge low where the render was thickest, rain
#                 runnels down the upper face, both faces; the seams (x = 0, 1) share one profile so runs and variants tile
#   wallworn0..1  the same with a patch where the plaster has fallen: the brick behind, 4 courses of ~0.1 m in mud mortar (k dark)
#   walllaced0..1 a run with a timber lacing band (y 0.58-0.64, proud of the face, split grain), the region's earthquake lacing
#   corner        the rounded arris that covers two runs meeting (x, z in -0.5..0.5 of the thickness), eroded
#   foot0..1      the wall's foot (y 0..1 = the lowest ~0.5 m): a damp, splashed skirt, its render thickened and fieldstones of
#                 the footing showing through
#   doorframe     a doorway (x 0..1 = the opening's width, y 0..1 = its height): plastered reveals, a timber lintel bedded in the
#                 wall above (y 1..1.1, x -0.18..1.18), a threshold stone
#   window0..1    a small high window (x, y 0..1 = its opening): reveals, a sill, a wooden grille (0: three bars; 1: a lattice)
#   parapet0..1   the roof edge (y 0 = the roof's top, y 1 = the parapet's top, ~0.4 m): a rounded mud lip, the drip edge
#                 thrown out over the outer face (+z) and the ends of the roof poles (vigas) through it below the roof line
#   roof0..1      a 1 x 1 m tile of the flat roof (x 0..1, z -0.5..0.5, y = 0 at the roof): packed mud, rolled, rain-rilled
#   hatch         the roof hatch: a 0.7 m opening framed in poles, its lid of planks set aside (unit = 1 m, not scaled)
#   (no ladder: the house kit's log and rung pieces build the ladders, houseplan.ts, and a round member does not survive a
#   non-uniform scale)
#   steps         three mud steps against a wall (x 0..1 the width, y 0..1 the rise, z 0..1 the going)
#   awning        an awning in metres (3 m along the wall, 2 m out, 2.3 m high; not scaled): two poles, the front beam, a cloth
#                 sagging between the beam and the wall
# Each piece in three levels of detail (<name>, <name>_l1, <name>_l2); per vertex p, n, ao (Cycles AO), k (shade: the
# surface's own tone, 1 = the material's colour, < 1 darker: timber, brick, damp). No texture maps: the town's world-space
# scanned plaster, brick and timber surfaces dress them (the T4's 16-sampler cap).
# Run: tools/blender/bpy_cli.sh -b --factory-startup --python tools/blender/kit_town.py -- <out_dir>   (node tools/blender/kit_town.mjs)
import bpy, bmesh, json, math, sys, random, os
from mathutils import Vector, noise

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = argv[0] if argv else 'public/models/kit/town'
SAMPLES = 24

def nz(p, s, seed, oct=3):
    return noise.fractal(Vector((p[0] * s + seed * 13.1, p[1] * s + seed * 7.7, p[2] * s + seed * 3.3)), 0.5, 2.0, oct, noise_basis='PERLIN_ORIGINAL')

def G(x, y, z):  # game (x, y up, z) -> Blender (x, -z, y)
    return (x, -z, y)

class M:
    """a mesh being built: vertices (game coords), faces, shade"""
    def __init__(self): self.v, self.f, self.k = [], [], []
    def add(self, p, k=1.0): self.v.append(p); self.k.append(k); return len(self.v) - 1
    def quad(self, a, b, c, d): self.f.append((a, b, c, d))
    def tri(self, a, b, c): self.f.append((a, b, c))
    def grid(self, nx, ny, fn, flip=False):
        """a surface of (nx+1) x (ny+1) vertices: fn(i/nx, j/ny) -> (p, k)"""
        base = len(self.v)
        for j in range(ny + 1):
            for i in range(nx + 1):
                p, k = fn(i / nx, j / ny); self.add(p, k)
        for j in range(ny):
            for i in range(nx):
                a = base + j * (nx + 1) + i; b = a + 1; c = a + nx + 2; d = a + nx + 1
                self.quad(a, d, c, b) if flip else self.quad(a, b, c, d)
        return base
    def box(self, x0, x1, y0, y1, z0, z1, k=1.0, rough=0.0, seed=0):
        """a closed box (6 quads), corners jittered by `rough`"""
        r = random.Random(seed); idx = {}
        for ix, x in enumerate((x0, x1)):
            for iy, y in enumerate((y0, y1)):
                for iz, z in enumerate((z0, z1)):
                    j = lambda: (r.random() - 0.5) * rough
                    idx[(ix, iy, iz)] = self.add((x + j(), y + j(), z + j()), k)
        F = [((0, 0, 0), (0, 1, 0), (1, 1, 0), (1, 0, 0)), ((0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)), ((0, 0, 0), (0, 0, 1), (0, 1, 1), (0, 1, 0)),
             ((1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1)), ((0, 1, 0), (0, 1, 1), (1, 1, 1), (1, 1, 0)), ((0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1))]
        for q in F: self.quad(*[idx[c] for c in q])
    def cyl(self, a, b, r, n=6, k=1.0, cap=True):
        """a round member from a to b (game coords)"""
        A, B = Vector(a), Vector(b); d = (B - A).normalized(); u = d.orthogonal().normalized(); w = d.cross(u)
        ia, ib = [], []
        for s in range(n):
            t = s / n * math.tau; o = u * math.cos(t) * r + w * math.sin(t) * r
            ia.append(self.add(tuple(A + o), k)); ib.append(self.add(tuple(B + o), k))
        for s in range(n): self.quad(ia[s], ia[(s + 1) % n], ib[(s + 1) % n], ib[s])
        if cap: self.f.append(tuple(reversed(ia))); self.f.append(tuple(ib))
    def obj(self, name):
        me = bpy.data.meshes.new(name); me.from_pydata([G(*p) for p in self.v], [], self.f); me.update()
        bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bmesh.ops.triangulate(bm, faces=bm.faces); bm.to_mesh(me); bm.free(); me.update()
        ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
        a = me.attributes.new('shade', 'FLOAT', 'POINT')
        for i, k in enumerate(self.k): a.data[i].value = k
        for p in me.polygons: p.use_smooth = True
        return ob

# ---- the wall's face: one displacement for every run, the seams shared --------------------------------------------------
def seam(y, s):  # the profile at x = 0 and x = 1 (every variant): the batter (the face leaning back ~1.5 %: thicker at the foot),
    # a gentle bulge low where the render was laid thickest, the top rounded back by the rain
    return s * (0.07 * (1 - y) + 0.025 * math.sin(y * 2.4 + 0.3) - 0.04 * max(0.0, y - 0.9) / 0.1)

def face_d(x, y, side, seed):
    """the plaster's offset out of the face (unit z) at (x, y): the float's undulation, a low bulge, rain runnels high"""
    ex = math.sin(math.pi * x)  # 0 at the seams
    und = 0.06 * nz((x * 1.0, y * 2.5, side), 1.6, seed) + 0.018 * nz((x, y, side), 6.0, seed + 1)
    run = -0.012 * max(0.0, nz((x * 3.0, 0, side), 2.2, seed + 2)) * max(0.0, y - 0.45) * 2  # runnels down from the top
    return seam(y, 1) + ex * (und + run)

def wall(seed, nx, ny, worn=False, laced=False):
    m = M(); r = random.Random(seed)
    patch = (0.12 + 0.3 * r.random(), 0.12 + 0.25 * r.random(), 0.45 + 0.2 * r.random(), 0.3 + 0.15 * r.random()) if worn else None  # x0, y0, w, h
    for side in (-1, 1):
        def fn(x, y, side=side):
            d = face_d(x, y, side, seed); k = 0.95 + 0.1 * (0.5 + nz((x, y, side), 3.0, seed + 5)); z = side * (0.5 + d)
            if y < 0.06: z += side * 0.012 * (1 - y / 0.06)  # the foot's slight flare
            if patch and side == 1:
                px, py, pw, ph = patch; inside = px < x < px + pw and py < y < py + ph
                if inside:
                    e = min(x - px, px + pw - x, (y - py) / 2.5, (py + ph - y) / 2.5) / 0.04
                    cut = min(1.0, e) * 0.07 + 0.012 * nz((x, y, 0), 9, seed + 7)
                    course = (y * 30) % 1.0; joint = 1.0 if course < 0.14 else 0.0  # mortar joints every ~0.1 m of a 3 m wall
                    head = 1.0 if ((x * 3 + (math.floor(y * 30) % 2) * 0.5) % 1.0) < 0.06 else 0.0
                    z = side * (0.5 + d - cut - 0.03 * max(joint, head)); k = (0.74 + 0.08 * nz((math.floor(x * 3), math.floor(y * 30), 0), 3, seed)) - 0.18 * max(joint, head)
            if laced and 0.58 <= y <= 0.64:
                z = side * (0.5 + seam(y, 1) + 0.02 + 0.004 * math.sin(math.pi * x) * nz((x * 4, y, side), 8, seed + 9)); k = 0.62 + 0.06 * nz((x * 6, 0, side), 3, seed)
            return (x, y, z), k
        if laced:  # rows at the band's edges so the band stands proud with crisp edges
            ys = sorted(set([j / ny for j in range(ny + 1)] + [0.575, 0.58, 0.64, 0.645]))
        else:
            ys = [j / ny for j in range(ny + 1)]
        if worn and side == 1:
            pr, pc = (28, 12) if nx >= 6 else (8, 4)  # the patch's own rows and columns (its courses at LOD0; a dark recess at LOD1)
            ys = sorted(set(ys + [patch[1] + patch[3] * t / pr for t in range(pr + 1)])); nxs = sorted(set([i / nx for i in range(nx + 1)] + [patch[0] + patch[2] * t / pc for t in range(pc + 1)]))
        else:
            nxs = [i / nx for i in range(nx + 1)]
        base = len(m.v)
        for y in ys:
            for x in nxs: p, k = fn(x, y); m.add(p, k)
        W = len(nxs)
        for j in range(len(ys) - 1):
            for i in range(W - 1):
                a = base + j * W + i; b = a + 1; c = a + W + 1; d = a + W
                m.quad(a, b, c, d) if side == 1 else m.quad(a, d, c, b)
    return m

def corner(seed, n):
    """the rounded arris post (x, z -0.5..0.5, y 0..1): a rounded square in plan, eroded"""
    m = M(); rings = []
    NY = n
    for j in range(NY + 1):
        y = j / NY; ring = []
        for s in range(16):
            t = s / 16 * math.tau; c, sn = math.cos(t), math.sin(t)
            sq = 1 / max(abs(c), abs(sn)); rr = 0.5 * (0.82 * sq + 0.18)  # a square with rounded corners
            e = 0.025 * nz((c, y * 3, sn), 2.0, seed)
            ring.append(m.add((c * rr * (1 + e), y, sn * rr * (1 + e)), 0.95 + 0.08 * nz((c, y, sn), 4, seed + 3)))
        rings.append(ring)
    for j in range(NY):
        for s in range(16): m.quad(rings[j][s], rings[j][(s + 1) % 16], rings[j + 1][(s + 1) % 16], rings[j + 1][s])
    m.f.append(tuple(rings[-1]))
    return m

def foot(seed, nx, ny):
    """the wall's foot: a thickened, splashed skirt with fieldstones through it"""
    m = M(); r = random.Random(seed); stones = [(r.random(), 0.15 + 0.5 * r.random(), 0.06 + 0.06 * r.random()) for _ in range(5)]
    for side in (-1, 1):
        def fn(x, y, side=side):
            sk = 0.06 * (1 - y) ** 1.5  # the skirt's batter
            d = seam(y * 0.2, 1) + sk + math.sin(math.pi * x) * (0.02 * nz((x * 2, y * 2, side), 2.5, seed) + 0.012 * nz((x, y, side), 8, seed + 1))
            k = 0.82 + 0.12 * y + 0.05 * nz((x, y, side), 5, seed + 2)  # damp low
            for (sx, sy, sr) in stones:
                q = math.hypot((x - sx) * 1.0, (y - sy) * 0.5) / sr
                if q < 1: d += 0.03 * math.sqrt(1 - q * q); k = 0.9
            return (x, y, side * (0.5 + d)), k
        m.grid(nx, ny, fn, flip=(side == -1))
    return m

def doorframe(seed, n):
    """reveals (x = 0 and 1 faces, z -0.5..0.5), the threshold, the timber lintel above"""
    m = M()
    for xs, flip in ((0.0, False), (1.0, True)):  # the reveals' plaster, facing into the opening
        m.grid(2, n, lambda a, b, xs=xs: ((xs + (0.012 if xs == 0 else -0.012) * (1 + nz((a, b, xs), 3, seed)), b, -0.5 + a), 0.97), flip=flip)
    m.grid(2, n, lambda a, b: ((a, 1.0 - 0.006 * nz((a, b, 0), 4, seed), b - 0.5), 0.9), flip=True)  # the soffit
    m.box(-0.18, 1.18, 1.0, 1.1, -0.52, 0.52, k=0.6, rough=0.01, seed=seed)  # the lintel
    for zz in (-0.52, 0.52):  # its adzed faces: two split poles side by side (a groove between)
        pass
    m.box(-0.04, 1.04, -0.02, 0.035, -0.5, 0.5, k=0.88, rough=0.006, seed=seed + 1)  # the threshold stone
    return m

def window(seed, lattice, n):
    m = M()
    for xs, flip in ((0.0, False), (1.0, True)):
        m.grid(1, n, lambda a, b, xs=xs: ((xs, b, -0.5 + a), 0.95), flip=flip)
    m.grid(1, 1, lambda a, b: ((a, 1.0, b - 0.5), 0.9), flip=True)
    m.box(-0.08, 1.08, -0.06, 0.0, -0.55, 0.55, k=0.85, rough=0.005, seed=seed)  # the sill
    for x in (0.25, 0.5, 0.75): m.cyl((x, 0.0, 0.0), (x, 1.0, 0.0), 0.035, 5, k=0.62, cap=False)
    if lattice:
        for y in (0.33, 0.66): m.cyl((0.0, y, 0.0), (1.0, y, 0.0), 0.03, 5, k=0.62, cap=False)
    return m

def parapet(seed, nx, viga=True):
    """the roof edge: the lip (y 0..1 over the roof), the drip edge on +z, the vigas below the roof line"""
    m = M()
    prof = [(-0.5, -0.05), (-0.5, 0.75), (-0.42, 0.97), (0.0, 1.0), (0.42, 0.97), (0.55, 0.8), (0.62, 0.62), (0.58, 0.5), (0.5, 0.45), (0.5, -0.05)]
    rows = []
    for i in range(nx + 1):
        x = i / nx; row = []
        for (z, y) in prof:
            e = math.sin(math.pi * x) * 0.03 * nz((x * 2, y, z), 2.5, seed); edge = 1.0 if z > 0.5 else 0.0
            row.append(m.add((x, y + (e if y > 0.7 else 0), z + (e * 0.5 if abs(z) >= 0.5 else 0)), 0.92 - 0.08 * edge + 0.05 * nz((x, y, z), 4, seed + 1)))
        rows.append(row)
    P = len(prof)
    for i in range(nx):
        for k in range(P - 1): m.quad(rows[i][k], rows[i][k + 1], rows[i + 1][k + 1], rows[i + 1][k])
    if viga:  # the roof poles' ends through the outer face, 0.5 m apart, below the roof line (y < 0), checked and grey
        for x in (0.25, 0.75):
            m.cyl((x, -0.32, 0.5), (x, -0.3, 0.78), 0.12, 7, k=0.55)
    return m

def roof(seed, n):
    def fn(a, b):
        x, z = a, b - 0.5; e = 0.012 * nz((x, 0, z), 2.0, seed) + 0.005 * nz((x, 0, z), 7, seed + 1)
        rill = -0.006 * max(0.0, nz((x * 4, 0, z * 0.5), 1.5, seed + 2))
        return (x, e + rill, z), 0.96 + 0.08 * nz((x, 0, z), 3, seed + 3)
    m = M(); m.grid(n, n, fn); return m

def hatch(seed):
    m = M()
    for (x0, x1, z0, z1) in ((-0.42, 0.42, -0.42, -0.32), (-0.42, 0.42, 0.32, 0.42), (-0.42, -0.32, -0.32, 0.32), (0.32, 0.42, -0.32, 0.32)):
        m.box(x0, x1, 0.0, 0.12, z0, z1, k=0.62, rough=0.01, seed=seed)  # the pole frame
    m.box(-0.33, 0.33, -0.3, 0.0, -0.33, 0.33, k=0.25)  # the dark below
    for i in range(4): m.box(0.48 + i * 0.17, 0.63 + i * 0.17, 0.0, 0.04, -0.38, 0.38, k=0.66, rough=0.008, seed=seed + i)  # the lid's planks, set aside
    return m

def ladder(seed, n):
    m = M(); r = random.Random(seed)
    for x in (0.0, 1.0): m.cyl((x, 0.0, 0.0), (x + (r.random() - 0.5) * 0.04, 1.0, 0.0), 0.06, 6, k=0.6)
    for j in range(1, n + 1): m.cyl((0.0, j / (n + 1), 0.0), (1.0, j / (n + 1) + (r.random() - 0.5) * 0.01, 0.0), 0.04, 5, k=0.64)
    return m

def steps(seed):
    m = M()
    for s in range(3):
        y1 = (s + 1) / 3; z0 = s / 3
        m.box(0.0, 1.0, -0.05, y1, z0, 1.0, k=0.9 - 0.04 * s, rough=0.02, seed=seed + s)
    return m

def awning(seed, n):
    """in metres (not scaled): 3 m along the wall (x), 2 m out (z), the cloth from 2.3 m at the wall to 2.05 m at the beam"""
    m = M(); W, Dp, H = 3.0, 2.0, 2.3
    for x in (0.08, W - 0.08): m.cyl((x, 0.0, Dp), (x, H - 0.22, Dp), 0.055, 6, k=0.6)  # the poles
    m.cyl((0.0, H - 0.25, Dp), (W, H - 0.25, Dp), 0.05, 6, k=0.6)  # the front beam
    def fn(a, b):  # the cloth from the wall to the beam, sagging between, folds along x
        sag = 0.22 * math.sin(math.pi * b) * (0.7 + 0.3 * math.sin(math.pi * a)); fold = 0.03 * math.sin(a * math.pi * 9) * math.sin(math.pi * b)
        return (a * W, H - 0.2 * b - sag + fold, b * Dp), 1.0
    m.grid(n, n, fn)
    return m

# ---- bake, export ------------------------------------------------------------------------------------------------------
# the size each piece is baked at (game x, y, z in m): its occlusion is the real piece's, not the unit frame's; the export keeps
# the unit coordinates (the object's scale is not applied to the mesh)
BAKE_SIZE = {'wall': (1, 2.8, 0.5), 'corner': (0.5, 2.8, 0.5), 'foot': (1, 0.5, 0.55), 'doorframe': (1, 1.9, 0.5), 'window': (0.45, 0.35, 0.5),
             'parapet': (1, 0.4, 0.5), 'roof': (1, 1, 1), 'hatch': (1, 1, 1), 'ladder': (0.45, 3, 1), 'steps': (1, 0.6, 0.9), 'awning': (1, 1, 1)}
LIFT = {'window': 1.6, 'roof': 3.0, 'hatch': 3.0, 'parapet': 3.0}  # baked away from the ground (a roof is not on it)

def bake_ao(obs):
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.samples = SAMPLES; sc.cycles.device = 'CPU'
    sc.render.bake.target = 'VERTEX_COLORS'
    if sc.world is None: sc.world = bpy.data.worlds.new('w')
    sc.world.light_settings.distance = 0.8  # local occlusion only (creases, reveals, the ground at the foot), as the house kit's: the game lights the open faces
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0)); gnd = bpy.context.active_object
    for ob in obs: ob.hide_render = True
    for ob in obs:
        kind = next(k for k in sorted(BAKE_SIZE, key=len, reverse=True) if ob.name.startswith(k))
        sx, sy, sz = BAKE_SIZE[kind]; ob.scale = (sx, sz, sy); ob.location = (0, 0, LIFT.get(kind, 0)); ob.hide_render = False  # Blender (x, -z, y)
        me = ob.data; ca = me.color_attributes.new('ao', 'FLOAT_COLOR', 'POINT'); me.color_attributes.active_color = ca
        if not me.materials: me.materials.append(bpy.data.materials.new('m'))
        bpy.ops.object.select_all(action='DESELECT'); ob.select_set(True); bpy.context.view_layer.objects.active = ob
        bpy.ops.object.bake(type='AO')
        ob.hide_render = True; ob.scale = (1, 1, 1); ob.location = (0, 0, 0)
    bpy.data.objects.remove(gnd)
    for ob in obs: ob.hide_render = False

def export(ob):
    me = ob.data; me.calc_loop_triangles(); ao = me.color_attributes.get('ao'); sh = me.attributes.get('shade')
    P, N, A, S, I = [], [], [], [], []
    for v in me.vertices:
        P += [round(v.co.x, 4), round(v.co.z, 4), round(-v.co.y, 4)]; N += [round(v.normal.x, 3), round(v.normal.z, 3), round(-v.normal.y, 3)]
        A.append(round(ao.data[v.index].color[0], 3) if ao else 1.0); S.append(round(sh.data[v.index].value, 3) if sh else 1.0)
    for t in me.loop_triangles: I += [t.vertices[0], t.vertices[1], t.vertices[2]]
    return {'p': P, 'n': N, 'ao': A, 'k': S, 'i': I, 'tris': len(I) // 3}

# the pieces: name -> (builder per level of detail, footprint, sockets, height rule)
PIECES = {}
def piece(name, lods, foot, sockets, height, note):
    PIECES[name] = (lods, foot, sockets, height, note)
RUN = {'start': [0, 0, 0], 'end': [1, 0, 0]}
for s in range(3): piece(f'wall{s}', [lambda s=s: wall(100 + s, 6, 10), lambda s=s: wall(100 + s, 3, 5), lambda s=s: wall(100 + s, 1, 1)], [1, 1], RUN, 'the wall', 'a plastered run')
for s in range(2): piece(f'wallworn{s}', [lambda s=s: wall(200 + s, 6, 10, worn=True), lambda s=s: wall(200 + s, 3, 5, worn=True), lambda s=s: wall(200 + s, 1, 1)], [1, 1], RUN, 'the wall', 'a run with the plaster fallen from a patch: the brick courses')
for s in range(2): piece(f'walllaced{s}', [lambda s=s: wall(300 + s, 6, 10, laced=True), lambda s=s: wall(300 + s, 3, 5, laced=True), lambda s=s: wall(300 + s, 1, 1)], [1, 1], RUN, 'the wall', 'a run with a timber lacing band at 0.58-0.64 of the height')
piece('corner', [lambda: corner(400, 8), lambda: corner(400, 3), lambda: corner(400, 1)], [1, 1], {'centre': [0, 0, 0]}, 'the wall', 'the rounded arris where two runs meet (x, z in thickness units)')
for s in range(2): piece(f'foot{s}', [lambda s=s: foot(500 + s, 6, 4), lambda s=s: foot(500 + s, 3, 2), lambda s=s: foot(500 + s, 1, 1)], [1, 1], RUN, '~0.5 m', 'the splashed foot with its fieldstones')
piece('doorframe', [lambda: doorframe(600, 4), lambda: doorframe(600, 2), lambda: doorframe(600, 1)], [1, 1], {'leafHinge': [0, 0, 0.1], 'lintelTop': [0.5, 1.1, 0]}, 'the opening (DOOR_H)', 'reveals, the timber lintel, the threshold')
for s in range(2): piece(f'window{s}', [lambda s=s: window(700 + s, s == 1, 2), lambda s=s: window(700 + s, s == 1, 1), lambda s=s: window(700 + s, False, 1)], [1, 1], {'sill': [0.5, 0, 0]}, 'the opening (~0.35 m)', 'a small high window with its grille')
for s in range(2): piece(f'parapet{s}', [lambda s=s: parapet(800 + s, 6), lambda s=s: parapet(800 + s, 2), lambda s=s: parapet(800 + s, 1, viga=False)], [1, 1], {'roofLine': [0, 0, 0]}, '~0.4 m', 'the roof edge, its drip edge (+z) and the vigas')
for s in range(2): piece(f'roof{s}', [lambda s=s: roof(900 + s, 6), lambda s=s: roof(900 + s, 2), lambda s=s: roof(900 + s, 1)], [1, 1], {'origin': [0, 0, 0]}, 'unscaled (y in m)', 'a 1 x 1 m tile of the packed-mud roof')
piece('hatch', [lambda: hatch(1000), lambda: hatch(1000), lambda: hatch(1000)], [1, 1], {'centre': [0, 0, 0]}, 'unscaled (m)', 'the roof hatch and its lid')
piece('steps', [lambda: steps(1200), lambda: steps(1200), lambda: steps(1200)], [1, 1], {'foot': [0, 0, 0]}, 'the rise', 'three mud steps')
piece('awning', [lambda: awning(1300, 8), lambda: awning(1300, 3), lambda: awning(1300, 1)], [3, 2], {'wall': [0, 2.3, 0]}, 'unscaled (m: 3 x 2 x 2.3)', 'two poles, the beam, a sagging cloth (its colour the caller\'s)')

def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    obs, meta = {}, {}
    for name, (lods, foot_, sockets, height, note) in PIECES.items():
        for li, fn in enumerate(lods):
            nm = name if li == 0 else f'{name}_l{li}'; obs[nm] = fn().obj(nm)
        meta[name] = {'footprint': foot_, 'sockets': sockets, 'height': height, 'note': note}
    bake_ao(list(obs.values()))
    out = {'about': 'D-802 town kit (tools/blender/kit_town.py): pieces modelled and AO-baked in Blender 5 (Cycles, vertex AO), game axes y-up, unit frames as the house kit (kit.ts kitFrame); tier C', 'pieces': {}}
    for nm, ob in obs.items(): out['pieces'][nm] = export(ob)
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'kit.json'), 'w') as f: json.dump(out, f, separators=(',', ':'))
    man = {'about': 'D-802 town kit manifest: per piece its unit frame footprint (x, z extent), sockets (unit coords), what scales its height, triangles per level of detail', 'frame': 'x 0..1 along the run, y 0..1 up, z -0.5..0.5 across (kit.ts kitFrame)', 'pieces': {}}
    for name, m in meta.items():
        m['tris'] = [out['pieces'][name if li == 0 else f'{name}_l{li}']['tris'] for li in range(3)]; man['pieces'][name] = m
    with open(os.path.join(OUT, 'manifest.json'), 'w') as f: json.dump(man, f, indent=1)
    # the same meshes as one GLB (for viewing and for a GLB-reading consumer): vertex colour = (ao, shade, 0, 1)
    for ob in obs.values():
        me = ob.data; ao = me.color_attributes.get('ao'); sh = me.attributes.get('shade')
        if ao is not None and sh is not None:
            for i, d in enumerate(ao.data): d.color = (d.color[0], sh.data[i].value, 0.0, 1.0)
    try:
        bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'town_kit.glb'), export_format='GLB', use_selection=False, export_vertex_color='ACTIVE', export_normals=True, export_materials='NONE')
    except Exception as e:
        print('[kit_town] GLB export failed:', e)
    print('[kit_town] wrote', OUT, {k: v['tris'] for k, v in man['pieces'].items()})

main()
