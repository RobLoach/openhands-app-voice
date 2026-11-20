// What this app keeps in the browser's localStorage.

export const STORAGE_KEY = 'openhands-voice:settings';
// The parts of Canvas this app couldn't find, for the settings page.
export const CANVAS_KEY = 'openhands-voice:canvas';

export function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

// Stores a value as JSON, or removes it for null. Storage that's full or
// blocked just doesn't remember it.
export function writeJson(key, value) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Nothing to keep then.
  }
}
