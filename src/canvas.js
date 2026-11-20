// What this app reads from Canvas's page: the open conversation, its
// language and base path.

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
