// Outdoor sky visibility from the world as built (D-309b, session 12; the lead's item: indirect light where people walk,
// world-wide, no hand-placed probe list). The light-probe field (probes/) covers only the roofed halls; outdoors every point
// took the full hemisphere light, so a 2 m lane between 4 m house walls, a court's foot of wall and a doorway recess were
// lit by the whole sky (the flat, shadowless "CG" fill of the lanes and village houses), less only the SSGI's
// screen-space AO (it cannot see what is off screen or behind the camera).
//
// Method (C): a top-down height map of everything the scene draws (terrain, walls, roofs, the house kit, props, trees;
// whatever the other agents add is included automatically), rendered once with an override material that writes world
// height into a float target: SIZE² texels over EXTENT m round the player, re-rendered when the player has moved RECENTRE m
// and a few times while the world streams in. The post composite (pipeline.ts, high/ultra; no material gains a sampler,
// B122) marches it: for DIRS azimuths the highest elevation of the height map within 24 m (steps at 0.4 … 24 m), the sky
// visible in that azimuth ≈ 1 − sin(horizon), weighted by the surface normal's horizontal lean toward it; the occluded
// part of the sky is replaced by the occluders' own light (D-309c: B × the open sky's, bounceRatio). It multiplies the skylight
// the composite already removes where the SSGI's AO says occluded (min of the two), outside the probe volumes only.
// Overhangs (a portico's roof over its floor) read as walls from above: the probe volumes cover the roofed buildings.
import * as THREE from 'three/webgpu';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { vec4, vec3, vec2, float, positionWorld, uniform, texture, max, min, clamp, dot, normalize, Fn, interleavedGradientNoise, screenCoordinate } from 'three/tsl';

export const SKYVIS = { SIZE: 2048, EXTENT: 480, RECENTRE: 90, DIRS: 8, STEPS: [0.4, 1, 2, 3.5, 6, 10, 16, 24], OCC_ALBEDO: 0.35, SUNLIT: 0.5, B_MIN: 0.3, B_MAX: 1.6, EMPTY: -1e5 };
const _hide: THREE.Object3D[] = [];

export class SkyVisField {
  readonly rt = new THREE.RenderTarget(SKYVIS.SIZE, SKYVIS.SIZE, { type: THREE.FloatType, format: THREE.RGBAFormat, depthBuffer: true });
  readonly cam = new THREE.OrthographicCamera(-SKYVIS.EXTENT / 2, SKYVIS.EXTENT / 2, SKYVIS.EXTENT / 2, -SKYVIS.EXTENT / 2, 1, 20000);
  private mat = new MeshBasicNodeMaterial();
  private centre = new THREE.Vector3(1e9, 0, 1e9);
  private uVP = uniform(new THREE.Matrix4());
  private renders = 0; private t0 = -1;
  /** the texture node the composite samples (nearest: float32 targets need not be filterable) */
  readonly tex: any;
  constructor() {
    this.rt.texture.minFilter = this.rt.texture.magFilter = THREE.NearestFilter; this.rt.texture.generateMipmaps = false;
    this.rt.texture.name = 'SkyVisHeight';
    this.mat.colorNode = vec4(positionWorld.y, 0, 0, 1); this.mat.side = THREE.DoubleSide; this.mat.fog = false;
    this.cam.up.set(0, 0, -1);
    this.tex = texture(this.rt.texture);
  }
  /** re-render when the player has moved RECENTRE m, and at 3, 12 and 40 s (models and the house kit stream in) */
  update(renderer: THREE.WebGPURenderer, scene: THREE.Scene, eye: THREE.Vector3) {
    const now = performance.now() / 1000; if (this.t0 < 0) this.t0 = now;
    const dt = now - this.t0, due = (this.renders === 1 && dt > 3) || (this.renders === 2 && dt > 12) || (this.renders === 3 && dt > 40);
    const dx = eye.x - this.centre.x, dz = eye.z - this.centre.z;
    if (!due && dx * dx + dz * dz < SKYVIS.RECENTRE * SKYVIS.RECENTRE) return;
    this.centre.set(Math.round(eye.x), 0, Math.round(eye.z));
    this.cam.position.set(this.centre.x, 9000, this.centre.z); this.cam.lookAt(this.centre.x, 0, this.centre.z); this.cam.updateMatrixWorld(); this.cam.updateProjectionMatrix();
    this.uVP.value.multiplyMatrices(this.cam.projectionMatrix, this.cam.matrixWorldInverse);
    // only what stands as geometry: no sky, clouds, stars, particles, lines, sprites, transparent effects, or meshes whose
    // vertices the material moves (the people's GPU skinning: drawn at rest they would be misplaced occluders)
    _hide.length = 0;
    scene.traverseVisible((o: any) => {
      const m = o.material, mm = Array.isArray(m) ? m[0] : m;
      if (o.isSkyMesh || o.isPoints || o.isLine || o.isSprite || (o.isMesh && (!mm || mm.transparent || mm.depthWrite === false || mm.positionNode || o.isSkinnedMesh))
        || /sky|cloud|star|moon|rain|dust|smoke|fire|flame|haze|water/i.test(o.name ?? '')) { if (o.isMesh || o.isPoints || o.isLine || o.isSprite) { o.visible = false; _hide.push(o); } }
    });
    const prevRT = renderer.getRenderTarget(), prevOv = scene.overrideMaterial, prevBg = scene.background, cc = new THREE.Color(); renderer.getClearColor(cc); const ca = renderer.getClearAlpha();
    const prevFog = (scene as any).fogNode;
    scene.overrideMaterial = this.mat; scene.background = null; (scene as any).fogNode = null;
    renderer.setRenderTarget(this.rt); renderer.setClearColor(new THREE.Color(SKYVIS.EMPTY, 0, 0), 1); renderer.clear();
    renderer.render(scene, this.cam);
    renderer.setRenderTarget(prevRT); renderer.setClearColor(cc, ca);
    scene.overrideMaterial = prevOv; scene.background = prevBg; (scene as any).fogNode = prevFog;
    for (const o of _hide) o.visible = true;
    this.renders++;
  }
  /** TSL: the sky's visibility (0-1) at world point p with world normal n, from the height map */
  visibility(p: any, n: any): any {
    const self = this;
    return Fn(() => {
      const hn = vec2(n.x, n.z), up = clamp(n.y, 0, 1);
      const p0 = p.add(n.mul(0.6)); // (0.6 m: past the surface's own texels, 0.23 m, so a wall never occludes itself: D-309c)
      let acc: any = float(0), wsum: any = float(0);
      const jit = interleavedGradientNoise(screenCoordinate.xy).mul(0.6).add(0.7); // step distances jittered per pixel (TRAA averages the bands away)
      for (let i = 0; i < SKYVIS.DIRS; i++) {
        const a = (i + 0.5) * 2 * Math.PI / SKYVIS.DIRS, dx = Math.cos(a), dz = Math.sin(a);
        let tanMax: any = float(0);
        for (const d of SKYVIS.STEPS) {
          const dj = jit.mul(d), q = self.uVP.mul(vec4(p0.x.add(dj.mul(dx)), 0, p0.z.add(dj.mul(dz)), 1)); // (ortho: w = 1)
          const uvq = vec2(q.x.mul(0.5).add(0.5), float(1).sub(q.y.mul(0.5).add(0.5)));
          const h = self.tex.sample(uvq).r;
          tanMax = max(tanMax, h.sub(p0.y).div(dj));
        }
        const sinH = tanMax.div(tanMax.mul(tanMax).add(1).sqrt());
        const w = max(float(0.05), dot(hn, vec2(dx, dz)).mul(0.5).add(0.5).mul(float(1).sub(up)).add(up)); // lean toward the azimuth
        acc = acc.add(float(1).sub(sinH).mul(w)); wsum = wsum.add(w);
      }
      const c = self.uVP.mul(vec4(p0.x, 0, p0.z, 1)), inside = float(1).sub(max(c.x.abs(), c.y.abs()).sub(0.8).div(0.2).clamp(0, 1)); // fades to open sky at the map's edge
      const v = clamp(acc.div(wsum), 0, 1).mul(inside).add(float(1).sub(inside));
      return v;
    })();
  }
}
/** D-309c: the occluders' radiance relative to the open sky's (C): walls and ground of albedo OCC_ALBEDO, SUNLIT of them in
 *  the sun, the rest under the sky: B = a · (SUNLIT · E_sun/E_sky + (1 − SUNLIT)), in [B_MIN, B_MAX]. At midday (E_sun/E_sky
 *  ~ 5-8) the walls of a lane are brighter than the sky they hide (B > 1: the shade gains light, as a sunlit lane's does);
 *  under overcast or at dusk (ratio ~ 0) they are darker (B = 0.3). CPU mirror for the tests */
export function bounceRatio(sunOverSky: number) { const { OCC_ALBEDO: a, SUNLIT: f, B_MIN, B_MAX } = SKYVIS; return Math.min(B_MAX, Math.max(B_MIN, a * (f * sunOverSky + (1 - f)))); }
void vec3; void min; void normalize;
