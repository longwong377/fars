// Frame profiler (D-337, session 12; B125): CPU time per named section of the frame (performance.now, accumulated per
// frame) and, with ?prof, the GPU time of every render and compute pass (WebGPU timestamp queries, three's pool), each
// pass named from its camera and target, with its draws and triangles. Off (one boolean test per section) unless enabled.
// Out-of-world: read by __parsa.profile() (main.ts) and tests/e2e/dbg_perf.spec.ts.
export const PROF = { on: false };
const acc = new Map<string, number>();
/** start a section: returns the start time (0 when off) */
export function pt(): number { return PROF.on ? performance.now() : 0; }
/** end a section begun with pt() */
export function pa(name: string, t0: number) { if (PROF.on && t0) acc.set(name, (acc.get(name) ?? 0) + performance.now() - t0); }
/** this frame's sections, cleared */
export function takeSections(): Record<string, number> { const o: Record<string, number> = {}; for (const [k, v] of acc) o[k] = v; acc.clear(); return o; }

export interface PassOut { label: string; gpu: number; cpu: number; draws: number; tris: number; cls: Record<string, [number, number]> }
interface PassRec { label: string; draws: number; tris: number; cpu: number; cls: Map<string, [number, number]> }
/** GPU passes by timestamp uid (three: `prefix:id:f<frame>`): what each one drew, recorded by the renderer's inspector hooks */
export class PassLog {
  recs = new Map<string, PassRec>();
  private open = new Map<string, { t: number; d: number; tr: number }>();
  constructor(private renderer: any) {
    const ins = renderer.inspector, self = this;
    const br = ins.beginRender.bind(ins), fr = ins.finishRender.bind(ins), bc = ins.beginCompute.bind(ins), fc = ins.finishCompute.bind(ins);
    ins.beginRender = (uid: string, scene: any, camera: any, rt: any) => { if (PROF.on) self.begin(uid, self.labelOf(scene, camera, rt)); return br(uid, scene, camera, rt); };
    ins.finishRender = (uid: string) => { if (PROF.on) self.end(uid); return fr(uid); };
    ins.beginCompute = (uid: string, nodes: any) => { if (PROF.on) self.begin(uid, 'compute:' + ((Array.isArray(nodes) ? nodes[0] : nodes)?.name || (Array.isArray(nodes) ? nodes[0] : nodes)?.constructor?.name || '?')); return bc(uid, nodes); };
    ins.finishCompute = (uid: string) => { if (PROF.on) self.end(uid); return fc(uid); };
    // what each pass draws, by object class (the top-level group under the scene / world root, and the object's own name prefix)
    const rod = renderer._renderObjectDirect.bind(renderer);
    renderer._renderObjectDirect = (object: any, material: any, ...rest: any[]) => { if (PROF.on && self.cur) { const r = self.recs.get(self.cur); if (r) { const k = self.classOf(object), g = object.geometry;
      const n = g ? (g.index ? g.index.count : g.attributes?.position?.count ?? 0) : 0, dr = g?.drawRange?.count, tri = (Number.isFinite(dr) ? Math.min(n, dr) : n) / 3 * (object.isInstancedMesh || object.isBatchedMesh ? object.count ?? 1 : g?.isInstancedBufferGeometry ? g.instanceCount ?? 1 : 1);
      const c = r.cls.get(k) ?? [0, 0]; c[0]++; c[1] += tri; r.cls.set(k, c); } } return rod(object, material, ...rest); };
  }
  cur: string | null = null;
  private clsCache = new WeakMap<object, string>();
  classOf(o: any): string { let k = this.clsCache.get(o); if (k) return k; let top = o, path: string[] = [];
    for (let p = o; p && p.parent; p = p.parent) { if (p.parent.isScene || p.parent.name === 'world') { top = p; break; } if (p.name) path.push(p.name); top = p; }
    const own = String(o.name || o.type).split(/[:#]/)[0];
    k = `${top.name || top.type}/${own}`; this.clsCache.set(o, k); void path; return k; }
  labelOf(scene: any, camera: any, rt: any): string {
    const cam = camera?.isOrthographicCamera ? 'ortho' : camera?.isPerspectiveCamera ? `persp${Math.round(camera.fov)}` : camera?.type ?? '?';
    const size = rt ? `${rt.width}x${rt.height}${rt.depth > 1 ? 'x' + rt.depth : ''}` : 'canvas';
    const tn = rt?.texture?.name || rt?.textures?.[0]?.name || '';
    const sn = scene?.isQuadMesh || scene?.isMesh ? `quad:${scene.material?.name || scene.material?.type || ''}` : scene?.isScene ? `scene${scene.name ? ':' + scene.name : ''}` : scene?.name || scene?.type || '?';
    return `${sn}|${cam}|${size}${tn ? '|' + tn : ''}`;
  }
  private begin(uid: string, label: string) { const i = this.renderer.info.render; this.open.set(uid, { t: performance.now(), d: i.drawCalls, tr: i.triangles }); if (!this.recs.has(uid)) this.recs.set(uid, { label, draws: 0, tris: 0, cpu: 0, cls: new Map() }); this.stack.push(uid); this.cur = uid; }
  private stack: string[] = [];
  private end(uid: string) { const o = this.open.get(uid), r = this.recs.get(uid); if (!o || !r) return; const i = this.renderer.info.render;
    r.draws += i.drawCalls - o.d; r.tris += i.triangles - o.tr; r.cpu += performance.now() - o.t; this.open.delete(uid); this.stack.pop(); this.cur = this.stack[this.stack.length - 1] ?? null; }
  /** resolve the timestamps of the frames since the last call; returns the passes of the LAST frame with their GPU ms */
  async resolve(): Promise<{ gpuMs: number; passes: PassOut[] } | null> {
    const be = this.renderer.backend; if (!be?.trackTimestamp) return null;
    const pools = be.timestampQueryPool ?? {}; const out: PassOut[] = [];
    let lastFrame = -1;
    for (const type of ['render', 'compute']) { const pool = pools[type]; if (!pool) continue; await pool.resolveQueriesAsync();
      for (const [uid] of pool.timestamps) { const f = +(uid.match(/:f(\d+)$/)?.[1] ?? -1); if (f > lastFrame) lastFrame = f; } }
    for (const type of ['render', 'compute']) { const pool = pools[type]; if (!pool) continue;
      for (const [uid, ms] of pool.timestamps) { const f = +(uid.match(/:f(\d+)$/)?.[1] ?? -1); if (f !== lastFrame) continue;
        const r = this.recs.get(uid); out.push({ label: r?.label ?? uid, gpu: ms, cpu: r?.cpu ?? 0, draws: r?.draws ?? 0, tris: r?.tris ?? 0, cls: r ? Object.fromEntries(r.cls) : {} }); } }
    this.recs.clear();
    return { gpuMs: out.reduce((a, p) => a + p.gpu, 0), passes: out };
  }
}
