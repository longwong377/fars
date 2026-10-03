// D-680: the comet of 467 (comet.ts): 75 days from mid-July, east of the sun, its tail away from the sun, up in the evening
import { describe, it, expect } from 'vitest';
import * as THREE from 'three/webgpu';
import { cometAt, cometDirs, COMET } from '../src/sky/comet';
import { SkySystem } from '../src/sky/skySystem';
import { WorldClock } from '../src/core/clock';

describe('D-680 the comet', () => {
  it('shows for 75 days, brightest at mid-window', () => {
    expect(cometAt(COMET.day0 - 1)).toBeNull(); expect(cometAt(COMET.day0 + COMET.days + 1)).toBeNull();
    const mid = cometAt(COMET.day0 + COMET.days / 2)!, early = cometAt(COMET.day0 + 5)!;
    expect(mid.mag).toBeLessThan(early.mag); expect(mid.mag).toBeLessThan(0.5); expect(mid.tail).toBeGreaterThan(20);
  });
  it('in the evening of mid-window it stands in the W sky after dusk, east of the sun, its tail pointing away from the sun', () => {
    const d = COMET.day0 + Math.round(COMET.days / 2), sky: any = new SkySystem(new THREE.Scene(), 256, 'test');
    const c = new WorldClock(d, 20.0); sky.update(c.jdUT, new THREE.Vector3(), 0, 0.2, { ms: 2, fromDeg: 270, tSeconds: 0 }, new THREE.Vector3(-1, 0, 0));
    expect(sky.state.sunAlt).toBeLessThan(-12);
    expect(sky.comet.group.visible).toBe(true);
    const { H, T } = cometDirs(c.jdUT, sky.state.sunDir, sky.comet.state);
    expect(H.y).toBeGreaterThan(Math.sin((8 * Math.PI) / 180)); // above 8 deg
    expect(T.dot(sky.state.sunDir)).toBeLessThan(0);            // the tail leads away from the (set) sun
    expect(Math.acos(H.dot(sky.state.sunDir.clone().normalize())) * 180 / Math.PI).toBeGreaterThan(50);
  });
  it('the comet builds (WGSL)', () => {
    const canvas: any = { style: {}, width: 960, height: 540, getContext: () => null, addEventListener() {}, removeEventListener() {} };
    const r: any = new (THREE as any).WebGPURenderer({ canvas }); r.hasFeature = () => true; const sky: any = new SkySystem(new THREE.Scene(), 256, 'test');
    for (const o of [sky.comet.group.children[0], sky.comet.group.children[1]]) { const b = new (THREE as any).WGSLNodeBuilder(o, r); b.scene = new THREE.Scene(); b.camera = new THREE.PerspectiveCamera(); b.material = o.material; b.build(); expect(b.fragmentShader.length).toBeGreaterThan(100); }
  });
});
