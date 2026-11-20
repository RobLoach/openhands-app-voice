// Keyboard shortcut: Alt+V presses Canvas's mic, from the message box too, on
// any keyboard layout, unless one of Canvas's dialogs is open.

import { MIC } from './canvas.js';
import { settings } from './settings.js';

export function keyboardShortcut() {
  function onKeyDown(event) {
    if (!settings.keyboardShortcut || event.defaultPrevented || event.isComposing) return;
    if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.code !== 'KeyV' || document.querySelector('[aria-modal="true"]')) return;
    const mic = document.querySelector(MIC);
    if (!mic || mic.disabled) return;
    event.preventDefault();
    mic.click();
  }

  window.addEventListener('keydown', onKeyDown, true);
  return {
    dispose: () => window.removeEventListener('keydown', onKeyDown, true),
  };
}
