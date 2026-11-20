// Telling when Canvas has changed: a while after you open a conversation, or
// a Customize page, it checks the parts of Canvas this app works with that
// should be there are. The settings page warns about any that weren't, until
// a later check finds them. The stop button and the agent's messages only
// show at times, so they aren't checked.

import {
  COMPOSER,
  CUSTOMIZE_APPS,
  CUSTOMIZE_PAGE,
  MIC,
  openConversationId,
  SEND,
  voiceInputServer,
} from './canvas.js';
import { CANVAS_KEY, readJson, writeJson } from './storage.js';

// How long Canvas has to draw a page before it's checked.
const CHECK_MS = 3000;

// Canvas only shows its mic when it can transcribe what you say: with the
// browser's speech recognition, or a Voice input server.
const micExpected = () =>
  !!(window.SpeechRecognition || window.webkitSpeechRecognition) || voiceInputServer();

const PARTS = [
  { key: 'composer', name: 'message box', selector: COMPOSER, page: 'conversation' },
  { key: 'send', name: 'send button', selector: SEND, page: 'conversation' },
  { key: 'mic', name: 'mic', selector: MIC, page: 'conversation', expected: micExpected },
  { key: 'menu', name: 'Customize menu', selector: CUSTOMIZE_APPS, page: 'customize' },
];

const pageKind = () =>
  openConversationId() ? 'conversation' : CUSTOMIZE_PAGE.test(location.pathname) ? 'customize' : null;

// The parts of Canvas the last checks didn't find, by name.
export function canvasProblems() {
  const missing = readJson(CANVAS_KEY, {});
  return PARTS.filter((part) => missing?.[part.key]).map((part) => part.name);
}

export function watchCanvas() {
  let checkedPath = null;
  let timer = 0;

  function check() {
    const page = pageKind();
    const missing = { ...readJson(CANVAS_KEY, {}) };
    for (const part of PARTS.filter((item) => item.page === page)) {
      const found = !!document.querySelector(part.selector) || (part.expected && !part.expected());
      if (found) delete missing[part.key];
      else missing[part.key] = true;
    }
    writeJson(CANVAS_KEY, Object.keys(missing).length ? missing : null);
  }

  // Once per page you open, as Canvas re-renders the chat as a run goes.
  function onPage() {
    if (location.pathname === checkedPath) return;
    checkedPath = location.pathname;
    clearTimeout(timer);
    timer = pageKind() ? setTimeout(check, CHECK_MS) : 0;
  }

  return {
    refresh: onPage,
    onDomChange: onPage,
    dispose: () => clearTimeout(timer),
  };
}
