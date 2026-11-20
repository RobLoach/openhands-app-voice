// The settings: each feature's switch, kept in localStorage.

import { readJson, STORAGE_KEY, writeJson } from './storage.js';
import { requestMic, speechProblem } from './audio.js';

// A switch with options is a choice between them instead, starting at its
// default, and one with voices a choice of the browser's voices, by name.
// check() says why a switch can't work, e.g. after a permission was revoked;
// enable(), which defaults to check(), may also ask the browser for what it
// needs. The settings page lists them under their group, in this order.
export const SWITCH_GROUPS = ['Talking', 'Reading aloud'];
export const SWITCHES = [
  {
    key: 'voiceChat',
    group: 'Talking',
    label: 'Voice chat',
    description:
      "After you use the mic, send your message, read the agent's reply aloud, then listen again.",
    check: speechProblem,
  },
  {
    key: 'handsFree',
    group: 'Talking',
    label: 'Hands-free',
    description: 'Stop the mic once you stop talking, so you never have to tap it.',
    enable: requestMic,
  },
  {
    key: 'listeningChime',
    group: 'Talking',
    label: 'Listening chime',
    description: 'Play a short chime when Voice chat turns the mic back on, so you know when to talk.',
  },
  {
    key: 'keyboardShortcut',
    group: 'Talking',
    label: 'Keyboard shortcut',
    description: "Press Alt+V to start or stop Canvas's mic, from the message box too.",
  },
  {
    key: 'readAloud',
    group: 'Reading aloud',
    label: 'Read aloud buttons',
    description: "Add a button to the agent's messages that reads them aloud.",
    check: speechProblem,
  },
  {
    key: 'onDeviceOnly',
    group: 'Reading aloud',
    label: 'On-device voices only',
    description:
      "Only use voices that run on this device, so what's read aloud never goes to Google or Microsoft.",
    default: true,
  },
  {
    key: 'voice',
    group: 'Reading aloud',
    label: 'Voice',
    description:
      "Which of your browser's English voices reads aloud. Voices marked online send what they read to Google or Microsoft.",
    voices: true,
    default: '',
  },
  {
    key: 'readingSpeed',
    group: 'Reading aloud',
    label: 'Reading speed',
    description: 'How fast replies and messages are read.',
    // Choices as [value, label, the speech rate].
    options: [
      ['0.75', '0.75×', 0.75],
      ['1', '1×', 1],
      ['1.25', '1.25×', 1.25],
      ['1.5', '1.5×', 1.5],
      ['1.75', '1.75×', 1.75],
      ['2', '2×', 2],
    ],
    default: '1',
  },
  {
    key: 'volume',
    group: 'Reading aloud',
    label: 'Volume',
    description: "How loud replies, messages and the listening chime are, as part of your device's volume.",
    // Choices as [value, label, the volume].
    options: [
      ['0.25', '25%', 0.25],
      ['0.5', '50%', 0.5],
      ['0.75', '75%', 0.75],
      ['1', '100%', 1],
    ],
    default: '1',
  },
];
const DEFAULT_SETTINGS = Object.fromEntries(
  SWITCHES.map((item) => [item.key, item.default ?? false]),
);

export let settings = DEFAULT_SETTINGS;

// Each switch's stored value, or its default where there's none, or it's
// not one of its choices.
export function loadSettings() {
  const stored = readJson(STORAGE_KEY, {});
  settings = Object.fromEntries(
    SWITCHES.map((item) => {
      const value = stored?.[item.key];
      const valid = item.options
        ? item.options.some(([option]) => option === value)
        : typeof value === (item.voices ? 'string' : 'boolean');
      return [item.key, valid ? value : DEFAULT_SETTINGS[item.key]];
    }),
  );
}

// Saves the settings, or with none, removes them, turning every feature off.
export function saveSettings(next) {
  settings = next ?? DEFAULT_SETTINGS;
  writeJson(STORAGE_KEY, next ?? null);
}
