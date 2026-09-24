// Dev overlay (F3): evidence tier of what you look at, placeholders, performance and memory HUD (brief §3.2, §6).
import * as THREE from 'three/webgpu';
export class DevOverlay {
  visible = false; private el = document.getElementById('overlay')!; private ray = new THREE.Raycaster(); private frames: number[] = [];
  toggle() { this.visible = !this.visible; this.el.hidden = !this.visible; }
  frame(dt: number) { this.frames.push(dt); if (this.frames.length > 120) this.frames.shift(); }
  update(renderer: THREE.WebGPURenderer, scene: THREE.Scene, camera: THREE.Camera, lines: string[]) {
    if (!this.visible) return;
    const f = [...this.frames].sort((a, b) => a - b);
    const med = f[Math.floor(f.length / 2)] ?? 0, p99 = f[Math.floor(f.length * 0.99)] ?? 0;
    const info = renderer.info;
    const mem = (performance as any).memory ? `${((performance as any).memory.usedJSHeapSize / 1048576).toFixed(0)} MB JS heap` : 'n/a';
    this.ray.setFromCamera(new THREE.Vector2(0, 0), camera); this.ray.far = 400;
    // what is drawn: the object and every ancestor visible (the Now view hides whole groups, D-201)
    const shown = (o: THREE.Object3D | null) => { for (; o; o = o.parent) if (!o.visible) return false; return true; };
    const hits = this.ray.intersectObjects(scene.children, true).filter(h => shown(h.object) && (h.object as any).isMesh);
    let tierLine = 'looking at: (nothing within 400 m)';
    if (hits[0]) {
      let o: THREE.Object3D | null = hits[0].object; while (o && !o.userData?.tier) o = o.parent;
      // merged meshes (the settlement) describe the face that was hit: its plot or object, tier and basis
      const u = typeof o?.userData?.describe === 'function' ? { ...o.userData, ...(o.userData.describe(hits[0]) ?? {}) } : (o?.userData ?? {});
      tierLine = `looking at: ${o?.name || hits[0].object.name || '?'} @ ${hits[0].distance.toFixed(1)} m\n  tier <span class="t${u.tier?.[0] ?? 'C'}">${u.tier ?? '??'}</span> src ${u.src ?? '??'}${u.placeholder ? '  [PLACEHOLDER]' : ''}${u.writing ? `\n  text ${u.text ?? '—'} · seal ${u.seal ?? '—'}` : ''}\n  ${u.note ?? ''}`;
    }
    const backend = (renderer.backend as any).isWebGPUBackend ? 'WebGPU' : 'WebGL2';
    this.el.innerHTML = [
      `${backend} · ${(1000 / Math.max(1e-3, med * 1000)).toFixed(0)} fps (median ${(med * 1000).toFixed(1)} ms, p99 ${(p99 * 1000).toFixed(1)} ms)`,
      `draw calls ${info.render.drawCalls} · triangles ${(info.render.triangles / 1e6).toFixed(2)} M · geometries ${info.memory.geometries} · textures ${info.memory.textures} · ${mem}`,
      ...lines, tierLine,
    ].join('\n');
  }
}
