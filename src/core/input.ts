import { DEFAULT_KEYS } from './settings';
// Keyboard + pointer-lock mouse, and a gamepad (standard mapping), remappable keys (Settings.keys).
// s17 C9 (D-630): the look is raw mouse (pointer lock asks for unadjusted movement where the browser has it: no OS
// acceleration), with the browsers' spurious pointer-lock jumps dropped (a single event many times larger than the
// recent motion, measured in Chrome on Windows: 300-1,000 px in one event); the careful pace (held) and crouching
// (toggled); a gamepad: left stick walks (analog: the pace by how far it is pushed), right stick looks (dead zone,
// response curve, eased so it starts and stops like a head turning), L3 walks faster, B crouches, A acts, Start pauses.
import type { Settings } from './settings';
/** the gamepad's look: full deflection turns this fast (rad/s), yaw and pitch; stick dead zone; response exponent */
export const PAD_LOOK = { yaw: 2.4, pitch: 1.6, dead: 0.14, curve: 2, ease: 0.07 };
export class Input {
  private down = new Set<string>();
  yaw = 0; pitch = 0; locked = false;
  /** crouching (toggled by the crouch key or the pad's B) */
  crouch = false;
  /** a gamepad moved a stick or pressed a button in the last 10 s */
  get padActive() { return this.padSeen > 0 && performance.now() - this.padSeen < 10_000; }
  /** mouse events dropped as pointer-lock jumps (dev) */
  spikes = 0;
  private padSeen = 0; private padPrev: boolean[] = []; private padLook = { x: 0, y: 0 }; private padT = 0; private recent = 8;
  onPauseRequest: () => void = () => {};
  onOverlayToggle: () => void = () => {};
  onInteract: () => void = () => {};
  onAction: (action: 'map' | 'mapZoom' | 'chronicle' | 'nowView') => void = () => {};
  constructor(private canvas: HTMLCanvasElement, private settings: () => Settings) {
    addEventListener('keydown', e => {
      this.down.add(e.code);
      if (e.code === this.settings().keys.overlay) { this.onOverlayToggle(); e.preventDefault(); }
      if (e.code === this.settings().keys.interact && !e.repeat) this.onInteract();
      if (e.code === this.keyOf('crouch') && !e.repeat) this.crouch = !this.crouch;
      if (e.code === this.keyOf('slow') && this.locked) e.preventDefault(); // Alt would open the browser's menu
      for (const a of ['map', 'mapZoom', 'chronicle', 'nowView'] as const) if (e.code === (this.settings().keys[a] ?? DEFAULT_KEYS[a]) && !e.repeat) this.onAction(a);
    });
    addEventListener('keyup', e => { this.down.delete(e.code); if (e.code === this.keyOf('slow') && this.locked) e.preventDefault(); });
    addEventListener('blur', () => this.down.clear());
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked; this.locked = document.pointerLockElement === this.canvas;
      if (was && !this.locked) this.onPauseRequest();
    });
    addEventListener('mousemove', e => {
      if (!this.locked) return;
      const mx = e.movementX, my = e.movementY, m = Math.hypot(mx, my);
      // a pointer-lock jump: far beyond anything the hand did a moment ago (the recent scale decays toward 8 px)
      if (m > 200 && m > 12 * this.recent) { this.spikes++; return; }
      this.recent = Math.max(8, this.recent * 0.9 + m * 0.1, m);
      const s = this.settings(), k = 0.0022 * s.mouseSensitivity;
      this.yaw -= mx * k;
      this.pitch -= my * k * (s.invertY ? -1 : 1);
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
    });
  }
  lock() {
    const c = this.canvas as any; if (!c.requestPointerLock) return;
    // raw mouse where the browser offers it; the plain request otherwise (and where the option is refused)
    try { const r = c.requestPointerLock({ unadjustedMovement: true }); if (r?.catch) r.catch(() => c.requestPointerLock()); } catch { c.requestPointerLock(); }
  }
  private keyOf(action: string) { return this.settings().keys[action] ?? DEFAULT_KEYS[action]; }
  /** the player is driven by this input (pointer locked, or a gamepad in use) rather than by the bots' channel */
  active() { if (this.locked) return true; this.pad(); return this.padActive; }
  key(action: string) { return this.down.has(this.keyOf(action)); }
  /** the pad's state this moment (standard mapping), and its look applied to yaw and pitch; null without a pad */
  private pad(): { lx: number; ly: number; run: boolean } | null {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const g = [...pads].find(p => p && p.connected && p.mapping === 'standard') ?? [...pads].find(p => p && p.connected);
    const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - (this.padT || now)) / 1000)); this.padT = now;
    if (!g) return null;
    const dz = (v: number) => { const a = Math.abs(v); return a < PAD_LOOK.dead ? 0 : Math.sign(v) * ((a - PAD_LOOK.dead) / (1 - PAD_LOOK.dead)); };
    const ax = (i: number) => dz(g.axes[i] ?? 0), btn = (i: number) => !!g.buttons[i]?.pressed;
    const lx = ax(0), ly = ax(1), rx = ax(2), ry = ax(3), b = g.buttons.map(x => !!x?.pressed);
    if (lx || ly || rx || ry || b.some(Boolean)) this.padSeen = now;
    const edge = (i: number) => b[i] && !this.padPrev[i];
    if (edge(1)) this.crouch = !this.crouch;
    if (edge(0)) this.onInteract();
    if (edge(9)) this.onPauseRequest();
    this.padPrev = b;
    // look: the response curve, eased (a head turns, it does not snap to a rate)
    const s = this.settings(), c = (v: number) => Math.sign(v) * Math.abs(v) ** PAD_LOOK.curve, k = Math.min(1, dt / PAD_LOOK.ease);
    this.padLook.x += (c(rx) - this.padLook.x) * k; this.padLook.y += (c(ry) - this.padLook.y) * k;
    this.yaw -= this.padLook.x * PAD_LOOK.yaw * s.mouseSensitivity * dt;
    this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch - this.padLook.y * PAD_LOOK.pitch * s.mouseSensitivity * dt * (s.invertY ? -1 : 1)));
    return { lx, ly, run: btn(10) };
  }
  axes() {
    const p = this.pad();
    let forward = (this.key('forward') ? 1 : 0) - (this.key('back') ? 1 : 0), right = (this.key('right') ? 1 : 0) - (this.key('left') ? 1 : 0);
    if (p && !forward && !right) { forward = -p.ly; right = p.lx; } // analog: the pace by how far the stick is pushed
    return { forward, right, run: this.key('run') || !!p?.run, slow: this.key('slow'), crouch: this.crouch };
  }
}
