// Helpers for the elements this app adds to Canvas's page, and the classes
// it borrows from Canvas's own components.

// Marks the elements this app adds to Canvas's page.
export const OWN_ATTR = 'data-voice-own';

// An element with these classes, holding text or other nodes.
export function el(tag, className, ...children) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.append(...children);
  return element;
}

// Class strings from Canvas's own components, so they're compiled.
export const FOCUS_RING = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus';
export const HAS_FOCUS_RING =
  'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus';

export function textButton(testid, text, onClick, look = 'underline') {
  const button = el('button', `w-fit cursor-pointer rounded-sm text-sm ${look} ${FOCUS_RING}`, text);
  button.type = 'button';
  button.dataset.testid = testid;
  button.addEventListener('click', onClick);
  return button;
}

// The parts of this app's pages, as Canvas lays out its settings pages.
export const pageHeader = (title, description) =>
  el(
    'div',
    'min-w-0 space-y-1',
    el('h2', 'text-xl font-semibold leading-6 text-foreground', title),
    el('p', 'max-w-2xl text-sm text-tertiary-light', description),
  );
export const pageSection = (title, ...children) =>
  el('section', 'flex min-w-0 flex-col gap-3', el('h3', 'text-base font-semibold text-foreground', title), ...children);
