// Read aloud buttons: a button beside the copy button on the agent's
// messages that reads the message aloud, or stops reading it, as Esc does.
// Anything else read aloud, such as a Voice chat reply, stops it too.

import { el, OWN_ATTR } from './dom.js';
import { AGENT_MESSAGE } from './canvas.js';
import { settings } from './settings.js';
import { messageSentences } from './sentences.js';
import { read, stopSpeaking } from './speech.js';

const READ_ALOUD_ATTR = 'data-voice-read-aloud';

// A speaker, as Canvas draws its message actions' icons.
const SPEAKER_ICON =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M19 5a10 10 0 0 1 0 14"/></svg>';

const buttons = () => document.querySelectorAll(`[${READ_ALOUD_ATTR}]`);

export function readAloudButtons() {
  // The message being read.
  let reading = null;
  let listening = false;

  // Shows which message is being read on its button.
  function setReading(article) {
    for (const button of buttons()) {
      const on = button.closest(AGENT_MESSAGE) === article;
      button.setAttribute('aria-label', on ? 'Stop reading' : 'Read aloud');
      button.classList.toggle('text-contrast', on);
    }
    reading = article;
  }

  function onReadAloud(article) {
    if (reading === article) {
      stopSpeaking();
      return;
    }
    const done = () => {
      if (reading === article) setReading(null);
    };
    setReading(article);
    read(messageSentences(article), { onDone: done, onStopped: done });
  }

  function add() {
    for (const article of document.querySelectorAll(AGENT_MESSAGE)) {
      const actions = article.querySelector(':scope > div.absolute');
      if (!actions || actions.querySelector(`[${READ_ALOUD_ATTR}]`)) continue;
      const button = el('button', 'button-base p-1 cursor-pointer');
      button.type = 'button';
      button.setAttribute(OWN_ATTR, '');
      button.setAttribute(READ_ALOUD_ATTR, '');
      button.setAttribute('aria-label', reading === article ? 'Stop reading' : 'Read aloud');
      button.innerHTML = SPEAKER_ICON;
      button.addEventListener('click', () => onReadAloud(article));
      actions.prepend(button);
    }
  }

  function remove() {
    if (reading) stopSpeaking();
    for (const button of buttons()) button.remove();
  }

  function onKeyDown(event) {
    if (reading && event.key === 'Escape') stopSpeaking();
  }

  function listen(next) {
    if (next === listening) return;
    listening = next;
    if (next) window.addEventListener('keydown', onKeyDown, true);
    else window.removeEventListener('keydown', onKeyDown, true);
  }

  return {
    refresh() {
      listen(settings.readAloud);
      if (settings.readAloud) add();
      else remove();
    },
    onDomChange() {
      if (settings.readAloud) add();
    },
    dispose() {
      listen(false);
      remove();
    },
  };
}
