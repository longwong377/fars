// Out-of-world settings (brief §6 Settings). Persisted per viewer in localStorage (try/catch; defaults otherwise).
export type Quality = 'test' | 'low' | 'medium' | 'high' | 'ultra';
export interface Settings {
  quality: Quality; forceWebGL: boolean;
  playerMode: 'observer' | 'visitor';
  courtCalendar: 'evidence' | 'seasonal';
  translation: boolean; fov: number; headBob: boolean; mouseSensitivity: number; invertY: boolean;
  keys: Record<string, string>;
  volume: { master: number; ambience: number; voices: number; music: number; effects: number };
  subtitleSize: number; lightningWarning: boolean; colourBlindUI: boolean; timeScale: number; devOverlay: boolean;
}
export const DEFAULT_KEYS: Record<string, string> = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD', run: 'ShiftLeft', interact: 'KeyE', pause: 'Escape', overlay: 'F3',
  map: 'KeyM', chronicle: 'KeyJ', // translation layer only (out-of-world)
};
export const DEFAULT_SETTINGS: Settings = {
  quality: 'high', forceWebGL: false, playerMode: 'observer', courtCalendar: 'evidence', translation: false, fov: 70, headBob: true,
  mouseSensitivity: 1, invertY: false, keys: { ...DEFAULT_KEYS },
  volume: { master: 0.9, ambience: 1, voices: 1, music: 1, effects: 1 }, subtitleSize: 1, lightningWarning: true, colourBlindUI: false,
  timeScale: 1, devOverlay: false,
};
const KEY = 'parsa.settings.v1';
export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const s = JSON.parse(raw); return { ...DEFAULT_SETTINGS, ...s, keys: { ...DEFAULT_KEYS, ...(s.keys ?? {}) }, volume: { ...DEFAULT_SETTINGS.volume, ...(s.volume ?? {}) } }; }
  } catch { /* storage unavailable */ }
  return structuredClone(DEFAULT_SETTINGS);
}
export function saveSettings(s: Settings) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* ignore */ } }

/** URL overrides for tests/bench: ?quality=test&webgl=1&seed=1&t=... */
export function urlParams() { return new URLSearchParams(location.search); }

export interface QualityProfile { pixelRatio: number; shadowMapSize: number; terrainLodBias: number; postFX: boolean; ao: boolean; maxFps?: number }
export const QUALITY: Record<Quality, QualityProfile> = {
  test: { pixelRatio: 1, shadowMapSize: 1024, terrainLodBias: 0.35, postFX: false, ao: false },
  low: { pixelRatio: 0.75, shadowMapSize: 1024, terrainLodBias: 0.5, postFX: false, ao: false },
  medium: { pixelRatio: 1, shadowMapSize: 2048, terrainLodBias: 0.75, postFX: true, ao: false },
  high: { pixelRatio: 1, shadowMapSize: 4096, terrainLodBias: 1, postFX: true, ao: true },
  ultra: { pixelRatio: 1, shadowMapSize: 4096, terrainLodBias: 1.5, postFX: true, ao: true },
};
