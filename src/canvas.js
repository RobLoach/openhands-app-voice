// What this app reads from Canvas's page: the open conversation, its
// language and base path, and the parts of Canvas it works with.

const CONVERSATION_PATH = /\/conversations\/([0-9a-f-]{32,36})(?:\/|$)/i;

// The Agent Server's ids drop the dashes Canvas's links may have, so ids are
// kept that way, one per conversation.
export const conversationKey = (id) => id.replaceAll('-', '').toLowerCase();
export const openConversationId = () => {
  const id = location.pathname.match(CONVERSATION_PATH)?.[1];
  return id ? conversationKey(id) : null;
};

// Canvas keeps its UI language on <html lang>.
export const canvasLanguage = () => document.documentElement.lang || 'en';

// Canvas's mount point, as React Router has it, e.g. "/" or "/canvas/".
export function canvasBase() {
  const basename = window.__reactRouterContext?.basename ?? '/';
  return new URL(basename.endsWith('/') ? basename : `${basename}/`, location.origin)
    .href;
}

// Canvas's parts this app works with, by their test ids, which an OpenHands
// update may change, so they're all here, and compat.js checks the ones that
// should always be there are. Its mic says it's recording with aria-pressed
// and starting or transcribing with aria-busy, and puts what you said in the
// message box, beside its send and stop buttons.
export const MIC = '[data-testid="chat-dictation-button"]';
export const COMPOSER = '[data-testid="chat-input"]';
export const SEND = '[data-testid="submit-button"]';
export const STOP = '[data-testid="stop-button"]';
export const AGENT_MESSAGE = 'article[data-testid="agent-message"]';
// Apps in Customize's menu, in its desktop sidebar and its compact menu, and
// the pages that have that menu.
export const CUSTOMIZE_APPS = '[data-testid="sidebar-extensions-/apps"]';
export const CUSTOMIZE_PAGE = /\/(?:customize|mcp|skills|plugins|apps)\/?$/;

// Canvas's Voice input settings, which send what you say to your own server
// instead of the browser's speech recognition when they have a URL.
const VOICE_INPUT_KEY = 'openhands-transcription-endpoint';

export function voiceInputServer() {
  try {
    return !!JSON.parse(localStorage.getItem(VOICE_INPUT_KEY))?.baseUrl?.trim();
  } catch {
    return false;
  }
}
