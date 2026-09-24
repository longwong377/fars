import { DEFAULT_KEYS } from './settings';
// Keyboard + pointer-lock mouse, remappable (Settings.keys).
import type { Settings } from './settings';
export class Input {
  private down = new Set<string>();
  yaw = 0; pitch = 0; locked = false;
  onPauseRequest: () => void = () => {};
  onOverlayToggle: () => void = () => {};
  onInteract: () => void = () => {};
  onAction: (action: 'map' | 'mapZoom' | 'chronicle' | 'nowView') => void = () => {};
  constructor(private canvas: HTMLCanvasElement, private settings: () => Settings) {
    addEventListener('keydown', e => {
      this.down.add(e.code);
      if (e.code === this.settings().keys.overlay) { this.onOverlayToggle(); e.preventDefault(); }
      if (e.code === this.settings().keys.interact && !e.repeat) this.onInteract();
      for (const a of ['map', 'mapZoom', 'chronicle', 'nowView'] as const) if (e.code === (this.settings().keys[a] ?? DEFAULT_KEYS[a]) && !e.repeat) this.onAction(a);
    });
    addEventListener('keyup', e => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
    document.addEventListener('pointerlockchange', () => {
      const was = this.locked; this.locked = document.pointerLockElement === this.canvas;
      if (was && !this.locked) this.onPauseRequest();
    });
    addEventListener('mousemove', e => {
      if (!this.locked) return;
      const s = this.settings(), k = 0.0022 * s.mouseSensitivity;
      this.yaw -= e.movementX * k;
      this.pitch -= e.movementY * k * (s.invertY ? -1 : 1);
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
    });
  }
  lock() { this.canvas.requestPointerLock?.(); }
  key(action: string) { return this.down.has(this.settings().keys[action]); }
  axes() {
    return { forward: (this.key('forward') ? 1 : 0) - (this.key('back') ? 1 : 0), right: (this.key('right') ? 1 : 0) - (this.key('left') ? 1 : 0), run: this.key('run') };
  }
}
