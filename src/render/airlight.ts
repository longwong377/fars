// Light in the air of the halls (session 4, D-156; triage item 15; brief §8 "Air: volumetric light and haze"): where the
// sun enters a roofed hall through its doorways and porticoes, the dust in the hall's air scatters it into visible shafts.
// A screen-space pass (half resolution) marches each view ray from the eye to the surface (at most 48 m) against the sun's
// cascaded shadow maps (cascades 0–1: the nearest ~150 m) and adds the in-scattered sunlight:
//   L_air = E_sun · p_HG(θ; g) · σ_s · ∫ V_sun(s) ds
// σ_s = 2·10⁻⁴ m⁻¹ (C; the brief's 1–5·10⁻⁴ for halls), g = 0.7 (C; mineral dust scatters forward: its asymmetry at 550 nm
// is ~0.7), E_sun the sun's light with the terrain horizon at the eye (D-156). It acts only while the eye is inside a
// light-probe volume (the roofed buildings: the probe field's weight at the eye, D-113); outdoors the aerial perspective
// (sky.air, the scene's fog node) is the air, and this pass renders nothing. Composed before TRAA (pipeline.ts, one line),
// which averages the march's per-pixel jitter. Tier C (a single-scattering model with chosen dust; no hearth or workshop
// smoke yet).
// Why not three's GodraysNode: it needs a DirectionalLight with its own shadow map at construction; at high and ultra the
// sun's shadow is the CSM's cascades, whose lights are plain objects created when the scene's materials first build.
import * as THREE from 'three/webgpu';
import { TempNode, NodeUpdateType, RenderTarget, QuadMesh, NodeMaterial, RendererUtils } from 'three/webgpu';
import { Fn, uv, vec2, vec4, float, uniform, texture, passTexture, getViewPosition, Loop, int, max, min, dot, length, step, pow, interleavedGradientNoise, screenCoordinate, logarithmicDepthToViewZ, viewZToPerspectiveDepth, clamp } from 'three/tsl';
import { probeEyeVisibility } from './probes/runtime';
import { EYE_SKY } from '../sky/aerial';

/** dust scattering in the halls (1/m) and its asymmetry (C) */
export const HALL_DUST_SIGMA = 2e-4, HALL_DUST_G = 0.7;
/** march length (m) and steps */
export const AIR_LIGHT_RANGE = 48, AIR_LIGHT_STEPS = 16;

const _quad = /*@__PURE__*/ new (QuadMesh as any)() as THREE.QuadMesh;
const _size = /*@__PURE__*/ new THREE.Vector2();
let _state: any;

/** Henyey–Greenstein phase (1/sr) */
export const hgPhase = (c: number, g: number) => (1 - g * g) / (4 * Math.PI * Math.pow(1 + g * g - 2 * g * c, 1.5));
/** CPU mirror (tests): radiance scattered toward the eye by a sunlit stretch of `lit` metres of hall air */
export const airLightRadiance = (sunE: number, cosT: number, lit: number) => sunE * hgPhase(cosT, HALL_DUST_G) * HALL_DUST_SIGMA * lit;

class AirLightNode extends TempNode {
  static get type() { return 'AirLightNode'; }
  private rt = new RenderTarget(1, 1, { depthBuffer: false, type: THREE.HalfFloatType });
  private material = new NodeMaterial();
  private out = passTexture(this as any, this.rt.texture);
  private uCamPos = uniform(new THREE.Vector3()); private uCamWorld = uniform(new THREE.Matrix4()); private uProjInv = uniform(new THREE.Matrix4());
  private uM0 = uniform(new THREE.Matrix4()); private uM1 = uniform(new THREE.Matrix4());
  private uSunDir = uniform(new THREE.Vector3(0, 1, 0)); private uSun = uniform(new THREE.Color(0, 0, 0));
  private built = false; private cleared = false;
  constructor(private depthNode: any, private camera: THREE.PerspectiveCamera, private sun: THREE.DirectionalLight) {
    super('vec4');
    this.updateBeforeType = NodeUpdateType.FRAME;
    this.rt.texture.name = 'AirLight';
  }
  /** the sun's two nearest CSM cascades (their lights exist once the scene's materials have been built) */
  private cascades(): any[] | null {
    const n: any = (this.sun.shadow as any).shadowNode, L = n?.lights;
    if (!L || L.length < 2 || !L[0].shadow?.map?.depthTexture || !L[1].shadow?.map?.depthTexture) return null;
    return [L[0], L[1]];
  }
  getTextureNode() { return this.out; }
  updateBefore(frame: any): undefined {
    const { renderer } = frame, cam = this.camera;
    const size = renderer.getDrawingBufferSize(_size); this.rt.setSize(Math.max(1, Math.round(size.width / 2)), Math.max(1, Math.round(size.height / 2)));
    const casc = this.cascades(), w = probeEyeVisibility(cam.position).w, sunOn = this.sun.visible && this.sun.intensity > 0;
    _state = RendererUtils.resetRendererState(renderer, _state);
    renderer.setRenderTarget(this.rt);
    if (!casc || w <= 0.001 || !sunOn) { // outdoors, at night or before the shadow maps exist: nothing in the air
      if (!this.cleared) { renderer.setClearColor(0x000000, 0); renderer.clear(); this.cleared = true; }
      RendererUtils.restoreRendererState(renderer, _state); return undefined;
    }
    this.cleared = false;
    if (!this.built) { this.material.fragmentNode = this.march(casc, renderer); this.material.needsUpdate = true; this.built = true; }
    this.uCamPos.value.setFromMatrixPosition(cam.matrixWorld); this.uCamWorld.value.copy(cam.matrixWorld); this.uProjInv.value.copy(cam.projectionMatrixInverse);
    this.uM0.value.copy(casc[0].shadow.matrix); this.uM1.value.copy(casc[1].shadow.matrix);
    this.uSunDir.value.subVectors(this.sun.position, this.sun.target.position).normalize();
    this.uSun.value.copy(this.sun.color).multiplyScalar(this.sun.intensity * EYE_SKY.sunVisibility * w);
    _quad.material = this.material; _quad.name = 'AirLight';
    _quad.render(renderer);
    RendererUtils.restoreRendererState(renderer, _state);
    return undefined;
  }
  /** the march (built once the cascades exist) */
  private march(casc: any[], renderer: any) {
    const cam = this.camera;
    return Fn(() => {
      const st = uv();
      let d: any = clamp(this.depthNode.sample(st).r, 1e-7, 1 - 1e-7);
      if (renderer.logarithmicDepthBuffer) d = viewZToPerspectiveDepth(logarithmicDepthToViewZ(d, float(cam.near), float(cam.far)), float(cam.near), float(cam.far));
      const pW = this.uCamWorld.mul(vec4(getViewPosition(st, d, this.uProjInv), 1)).xyz;
      const toP = pW.sub(this.uCamPos), dist = length(toP), dir = toP.div(max(dist, 1e-4)), D = min(dist, AIR_LIGHT_RANGE);
      const jit = interleavedGradientNoise(screenCoordinate.xy);
      const lit = float(0).toVar();
      const rev = !!renderer.reversedDepthBuffer;
      const test = (M: any, tex: any, p: any) => {
        const sp = M.mul(vec4(p, 1)), c = sp.xyz.div(sp.w), y = float(1).sub(c.y);
        const inside = step(0, c.x).mul(step(c.x, 1)).mul(step(0, y)).mul(step(y, 1)).mul(rev ? step(0, c.z) : step(c.z, 1));
        return { inside, v: texture(tex, vec2(c.x, y)).compare(c.z) };
      };
      Loop({ start: int(0), end: int(AIR_LIGHT_STEPS), type: 'int', condition: '<', name: 'ai' } as any, ({ ai }: any) => {
        const s = float(ai).add(jit).div(AIR_LIGHT_STEPS).mul(D), p = this.uCamPos.add(dir.mul(s));
        const a = test(this.uM0, casc[0].shadow.map.depthTexture, p), b = test(this.uM1, casc[1].shadow.map.depthTexture, p);
        // cascade 0 where it holds the point, else cascade 1, else lit (arithmetic masks: no select(), D-012)
        lit.addAssign(a.inside.mul(a.v).add(float(1).sub(a.inside).mul(b.inside.mul(b.v).add(float(1).sub(b.inside)))));
      });
      const g = HALL_DUST_G, cosT = dot(dir, this.uSunDir);
      const phase = float((1 - g * g) / (4 * Math.PI)).div(pow(float(1 + g * g).sub(cosT.mul(2 * g)), 1.5)); // base > 0 for g < 1
      return vec4((this.uSun as any).mul(phase.mul(HALL_DUST_SIGMA).mul(lit.div(AIR_LIGHT_STEPS)).mul(D)), 1);
    })();
  }
  setup() { return this.out; }
  dispose() { this.rt.dispose(); this.material.dispose(); }
}

/** the composite plus the hall air's in-scattered sunlight (vec4 in, vec4 out): `depth` the scene pass's depth texture node */
export function addAirLight(composite: any, depth: any, camera: THREE.PerspectiveCamera, sun: THREE.DirectionalLight | undefined): any {
  if (!sun) return composite;
  const n = new AirLightNode(depth, camera, sun);
  return vec4(composite.rgb.add(n.getTextureNode().rgb), composite.a);
}
