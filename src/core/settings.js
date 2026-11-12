import { bus } from './events.js';

const KEY = 'destiny-gate.settings.v1';

export const DEFAULT_BINDINGS = {
  forward: 'KeyW', back: 'KeyS', left: 'KeyA', right: 'KeyD',
  sprint: 'ShiftLeft', interact: 'KeyE', watch: 'KeyQ', objective: 'Tab',
  wrench: 'Mouse0', lantern: 'Mouse2',
};

export const DEFAULTS = {
  graphics: { preset: 'auto', backend: 'webgl', renderScale: 1, filmGrain: true, adaptive: true },
  audio: { master: 0.8, music: 0.7, sfx: 0.9, dialogue: 1.0, reducedRange: false },
  controls: { sensitivity: 1, invertY: false, toggleLantern: false, toggleSprint: false, bindings: { ...DEFAULT_BINDINGS } },
  access: {
    subtitles: true, outlines: false, persistentHints: false, reducedMotion: false,
    reducedIntensity: false, brightness: 1, uiScale: 1, threatWedges: false,
  },
  seenNotice: false,
};

function merge(base, over) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  for (const k of Object.keys(over || {})) {
    if (!(k in base)) continue;
    out[k] = base[k] && typeof base[k] === 'object' ? merge(base[k], over[k]) : over[k];
  }
  return out;
}

function load() {
  try { return merge(DEFAULTS, JSON.parse(localStorage.getItem(KEY) || '{}')); }
  catch { return merge(DEFAULTS, {}); }
}

export const settings = load();

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* private mode */ }
}

/** Set a dotted path, persist, and notify. */
export function setSetting(path, value) {
  const keys = path.split('.');
  let o = settings;
  for (let i = 0; i < keys.length - 1; i++) o = o[keys[i]];
  o[keys.at(-1)] = value;
  saveSettings();
  bus.emit('settings.changed', { path, value });
}

export function resetSettings(section) {
  settings[section] = merge(DEFAULTS[section], {});
  saveSettings();
  bus.emit('settings.changed', { path: section, value: settings[section] });
}
