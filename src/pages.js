// The settings page and the switches it shows.

import { el, HAS_FOCUS_RING, pageHeader, pageSection, textButton } from './dom.js';
import { customizeLayout } from './customize.js';
import { STORAGE_KEY } from './storage.js';
import { settings, SWITCH_GROUPS, SWITCHES } from './settings.js';
import { speechProblem } from './audio.js';
import { recognitionStatus } from './recognition.js';
import { canvasProblems } from './compat.js';
import { automaticDetails, loadVoices, previewVoice, unlistedVoice, voiceGroups } from './speech.js';

// Class strings mirror Canvas's ToggleSwitchVisual (src/ui/toggle-switch.tsx)
// so the switch picks up the same compiled Tailwind styles. The checkbox it
// stands for says it's a switch, as Canvas's own do, and its hint is read out
// when it changes, e.g. to say why a switch turned itself back off.
const TRACK_CLASS =
  'relative inline-flex shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out motion-reduce:transition-none h-5.5 w-10 border';
const TRACK_ON_CLASS = 'border-contrast bg-contrast';
const TRACK_OFF_CLASS = 'border-border bg-surface-raised';
const THUMB_CLASS =
  'inline-block rounded-full transition-transform duration-200 ease-in-out motion-reduce:transition-none size-4';
const THUMB_ON_CLASS = 'translate-x-5.25 rtl:-translate-x-5.25 bg-base-secondary';
const THUMB_OFF_CLASS = 'translate-x-0.5 rtl:-translate-x-0.5 bg-muted';

// Canvas's formControlFieldClassName (form-control-classes.ts), as its
// settings fields look.
const SELECT_CLASS =
  'h-9 min-h-9 rounded-lg border border-control bg-base-secondary transition-control-shell duration-75 motion-reduce:transition-none focus:border-contrast/40 dark:focus:border-contrast/40 focus:ring-1 focus:ring-contrast/20 focus:outline-none w-full max-w-xs min-w-0 px-3 text-sm text-contrast cursor-pointer';

// A choice as a dropdown under its label.
function buildChoice(item, onChange) {
  const id = `voice-${item.key}`;
  const select = el(
    'select',
    SELECT_CLASS,
    ...item.options.map(([value, text]) => {
      const option = el('option', '', text);
      option.value = value;
      return option;
    }),
  );
  select.id = id;
  select.dataset.testid = `${id}-select`;
  select.value = settings[item.key];
  select.setAttribute('aria-describedby', `${id}-hint`);
  select.addEventListener('change', () => onChange({ ...settings, [item.key]: select.value }));
  const label = el('label', 'w-fit text-sm', item.label);
  label.htmlFor = id;
  const hint = el('p', 'text-xs leading-relaxed text-tertiary-light', item.description);
  hint.id = `${id}-hint`;
  return el('div', 'flex min-w-0 flex-col gap-2', label, select, hint);
}

// The browser's voices as a list to pick from, each with its quality and
// whether it's online underneath, under their region, with Automatic first
// and a saved voice this device doesn't have kept as it is. Picking one
// reads a sample in it, as does the button below.
function buildVoiceChoice(item, onChange) {
  const id = `voice-${item.key}`;
  const options = [];
  const option = (value, label, details) => {
    const input = el('input', 'mt-1 shrink-0 cursor-pointer');
    input.type = 'radio';
    input.name = id;
    input.value = value;
    input.checked = value === settings.voice;
    options.push(input);
    const row = el(
      'label',
      `flex min-w-0 cursor-pointer items-start gap-3 rounded-md px-3 py-2 hover:bg-surface-raised ${HAS_FOCUS_RING}`,
      input,
      el(
        'span',
        'flex min-w-0 flex-col',
        el('span', 'truncate text-sm text-contrast', label),
        el('span', 'text-xs text-tertiary-light', details),
      ),
    );
    row.dataset.testid = `${id}-option`;
    return row;
  };
  const group = (title, ...rows) =>
    el(
      'fieldset',
      'flex min-w-0 flex-col gap-0.5',
      el('legend', 'px-3 pt-3 pb-1 text-xs font-semibold uppercase text-tertiary-light', title),
      ...rows,
    );
  const unlisted = (name) => {
    const { label, details } = unlistedVoice(name);
    return option(name, label, details);
  };
  const groups = voiceGroups();
  const known = groups.some(([, voices]) => voices.some(({ name }) => name === settings.voice));
  // Long lists scroll, as voices can number in the dozens.
  const box = el(
    'div',
    'flex min-w-0 max-w-2xl flex-col rounded-lg border border-control bg-base-secondary p-1',
    option('', 'Automatic', automaticDetails()),
    ...(settings.voice && !known ? [unlisted(settings.voice)] : []),
    ...groups.map(([title, voices]) =>
      group(title, ...voices.map(({ name, label, details }) => option(name, label, details))),
    ),
  );
  box.style.maxHeight = '22rem';
  box.style.overflowY = 'auto';
  const list = el('fieldset', 'flex min-w-0 flex-col gap-2', el('legend', 'mb-2 text-sm', item.label), box);
  list.dataset.testid = `${id}-list`;
  list.setAttribute('aria-describedby', `${id}-hint`);
  const picked = () => options.find((input) => input.checked)?.value ?? settings.voice;
  const highlight = () => {
    for (const input of options) input.closest('label').classList.toggle('bg-tertiary', input.checked);
  };
  highlight();
  list.addEventListener('change', () => {
    highlight();
    onChange({ ...settings, [item.key]: picked() });
    previewVoice(picked());
  });
  const hint = el('p', 'text-xs leading-relaxed text-tertiary-light', item.description);
  hint.id = `${id}-hint`;
  const preview = textButton('voice-preview', 'Preview', () => previewVoice(picked()));
  // Without speech, there's nothing to pick or hear.
  const problem = speechProblem();
  if (problem) {
    list.disabled = true;
    preview.hidden = true;
    hint.textContent = problem;
  }
  return el('div', 'flex min-w-0 flex-col gap-2', list, preview, hint);
}

function buildSwitch(item, onChange) {
  const block = document.createElement('div');
  block.className = 'flex min-w-0 flex-col gap-1';
  block.innerHTML = `
    <label class="relative flex items-center gap-2 rounded-sm ${HAS_FOCUS_RING} w-fit cursor-pointer">
      <input class="sr-only" type="checkbox" role="switch" data-testid="voice-${item.key}-switch" aria-describedby="voice-${item.key}-hint" />
      <span aria-hidden="true"><span></span></span>
      <span class="flex items-center gap-1">
        <span class="text-sm"></span>
      </span>
    </label>
    <p id="voice-${item.key}-hint" class="text-xs leading-relaxed text-tertiary-light" aria-live="polite"></p>`;

  const input = block.querySelector('input');
  const track = input.nextElementSibling;
  const hint = block.querySelector('p');
  const enable = item.enable ?? item.check;
  block.querySelector('.text-sm').textContent = item.label;
  const render = () => {
    track.className = `${TRACK_CLASS} ${input.checked ? TRACK_ON_CLASS : TRACK_OFF_CLASS}`;
    track.firstElementChild.className = `${THUMB_CLASS} ${input.checked ? THUMB_ON_CLASS : THUMB_OFF_CLASS}`;
  };
  input.checked = settings[item.key];
  hint.textContent = (input.checked && item.check?.()) || item.description;
  render();
  input.addEventListener('change', async () => {
    const problem = input.checked && enable ? await enable() : null;
    // Reset, or another tab, rebuilt the switches while the browser asked.
    if (!block.isConnected) return;
    if (problem) input.checked = false;
    hint.textContent = problem ?? item.description;
    render();
    onChange({ ...settings, [item.key]: input.checked });
  });
  return block;
}

// What happens to what you say to Canvas's mic while Keep voice on this
// device is on, found out after it's drawn, with a button to download the
// language when the browser can recognise it on this device once it has.
function recognitionNote() {
  const text = el('p', 'text-xs leading-relaxed text-tertiary-light');
  text.dataset.testid = 'voice-recognition-status';
  text.setAttribute('aria-live', 'polite');
  const note = el('div', 'flex min-w-0 flex-col gap-2', text);
  async function show() {
    const { text: status, install } = await recognitionStatus();
    text.textContent = status;
    note.querySelector('button')?.remove();
    if (!install) return;
    const button = textButton('voice-recognition-install', 'Download', async () => {
      button.disabled = true;
      text.textContent = 'Downloading…';
      await Promise.resolve(install()).catch(() => {});
      show();
    });
    note.append(button);
  }
  show();
  return note;
}

// A warning that this version of Canvas may not be supported, naming the
// parts of it the app couldn't find, when there are any.
function canvasWarning() {
  const missing = canvasProblems();
  if (!missing.length) return [];
  const names = new Intl.ListFormat('en', { type: 'conjunction' }).format(missing);
  const warning = el(
    'p',
    'rounded-lg border border-status-error/40 px-4 py-3 text-sm text-contrast',
    `This version of Canvas may not be supported: Voice couldn't find its ${names} the last time it looked, so features that need ${missing.length > 1 ? 'them' : 'it'} may not work.`,
  );
  warning.dataset.testid = 'voice-canvas-warning';
  warning.setAttribute('role', 'status');
  return [warning];
}

// The app's settings page, as declared in canvas-extension.json, which Canvas
// serves under /extensions/<app name>/ and the app links from Customize's
// menu: the switches under their groups, and a button putting every one
// back. Settings changed in another tab, and voices the browser finds,
// redraw it.
export function settingsPage(host, onChange) {
  let list = null;

  // The voices listed depend on Keep voice on this device, as last drawn.
  let onDeviceOnly = null;

  // Redraws the page, keeping focus where it was, e.g. on a switch just
  // turned.
  function render() {
    if (!list) return;
    onDeviceOnly = settings.onDeviceOnly;
    const focused = list.contains(document.activeElement) && document.activeElement.dataset.testid;
    const groups = SWITCH_GROUPS.map((group) =>
      pageSection(
        group,
        ...SWITCHES.filter((item) => item.group === group).flatMap((item) => [
          (item.voices ? buildVoiceChoice : item.options ? buildChoice : buildSwitch)(item, onChange),
          ...(item.key === 'onDeviceOnly' && settings.onDeviceOnly ? [recognitionNote()] : []),
        ]),
      ),
    );
    const reset = textButton('voice-reset-settings', 'Reset settings', () => {
      onChange(null);
      render();
    });
    list.replaceChildren(...canvasWarning(), ...groups, reset);
    if (focused) list.querySelector(`[data-testid="${focused}"]`)?.focus();
  }

  function mount({ container }) {
    const own = el('div', 'flex min-w-0 flex-col gap-8');
    const root = customizeLayout(
      host,
      pageHeader(
        'Voice',
        "Talk with the agent and hear its replies, with your browser's voices. Settings are kept in this browser.",
      ),
      own,
    );
    list = own;
    render();
    container.append(root);
    loadVoices().then(() => {
      if (list === own) render();
    });
    // Canvas may clean up a mount after the next one has started.
    return () => {
      if (list === own) list = null;
      root.remove();
    };
  }

  return {
    mount,
    refresh() {
      if (settings.onDeviceOnly !== onDeviceOnly) render();
    },
    onStorage(key) {
      if (key === STORAGE_KEY) render();
    },
  };
}
