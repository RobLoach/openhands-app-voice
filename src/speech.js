// Reading aloud with the browser's voices: the Voice and Reading speed
// settings, with Readium Speech finding, rating and ranking the voices.

import { WebSpeechVoiceManager } from '@readium/speech';
import { speechProblem } from './audio.js';
import { canvasLanguage } from './canvas.js';
import { settings, SWITCHES } from './settings.js';

// Only English voices so far.
const LANGUAGE = 'en';
const QUALITY_LABELS = {
  veryLow: 'Very low quality',
  low: 'Low quality',
  normal: 'Normal quality',
  high: 'High quality',
  veryHigh: 'Very high quality',
};

// A choice's value, e.g. Reading speed's rate.
const chosen = (key) =>
  SWITCHES.find((item) => item.key === key).options.find(([value]) => value === settings[key])?.[2] ?? 1;
export const volume = () => chosen('volume');

// What Readium found, once it has: the voices, best first, the one it
// picks for your region among them all and among those on this device, and
// its sample sentence. Until then, the browser picks.
let loading = null;
let manager = null;
let ranked = [];
let automatics = { all: null, onDevice: null };
let sample = 'Hello, my name is {name} and I am an English voice.';

// Readium reads the browser's voices once, as soon as it has some, which
// Chrome only gives after the page loads.
export function loadVoices() {
  loading ??= WebSpeechVoiceManager.initialize({ languages: [LANGUAGE] })
    .then(async (found) => {
      const voices = found.getVoices({
        languages: LANGUAGE,
        excludeNovelty: true,
        excludeVeryLowQuality: true,
        removeDuplicates: true,
      });
      ranked = await found.sortVoicesByQuality(voices);
      const region = /^en-/i.test(window.navigator.language) ? window.navigator.language : 'en-US';
      const pick = (voices) => found.getDefaultVoice([region, LANGUAGE], voices);
      automatics = { all: await pick(ranked), onDevice: await pick(ranked.filter(onDevice)) };
      sample = found.getTestUtterance(LANGUAGE) || sample;
      manager = found;
    })
    // Try again next time, e.g. as the settings page opens.
    .catch(() => {
      loading = null;
    });
  return loading;
}

// Online voices send what they read to Google or Microsoft, which On-device
// voices only leaves out.
const onDevice = (voice) => voice.offlineAvailability !== false;
const usable = () => (settings.onDeviceOnly ? ranked.filter(onDevice) : ranked);
const automatic = () => automatics[settings.onDeviceOnly ? 'onDevice' : 'all'];

// The browser's own voice for one of Readium's, by its name there.
const nameOf = (voice) => voice.originalName ?? voice.name;
const browserVoice = (name) =>
  (window.speechSynthesis?.getVoices?.() ?? []).find((voice) => voice.name === name) ?? null;

const regionName = (language) => {
  try {
    return new Intl.DisplayNames(['en'], { type: 'language', languageDisplay: 'standard' }).of(
      language,
    );
  } catch {
    return language;
  }
};

// A voice as the Voice setting lists it: Readium's label for a voice it
// rates, or else the browser's name, which Readium shortens, e.g. espeak's
// "English (America)" to "English", and its quality and whether it's online.
const describe = (voice) => ({
  name: nameOf(voice),
  label: voice.quality ? voice.label : nameOf(voice),
  details: [
    QUALITY_LABELS[voice.quality] ?? 'Not rated',
    voice.offlineAvailability === false && 'Online',
  ]
    .filter(Boolean)
    .join(' · '),
});

// The Voice setting's choices: rated voices by region, the best region
// first, then the rest.
export function voiceGroups() {
  const groups = new Map();
  for (const voice of usable()) {
    const group = voice.quality ? regionName(voice.language) : 'Other voices';
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(describe(voice));
  }
  const other = groups.get('Other voices');
  groups.delete('Other voices');
  if (other) groups.set('Other voices', other);
  return [...groups];
}

// The voice Automatic reads with, by its label, if Readium has picked one.
export const automaticLabel = () => (automatic() ? describe(automatic()).label : null);

// The Voice setting's voice, but an online one while On-device voices only
// is on, or else the one Readium picks, or none, for the browser to choose.
export function chosenVoice(name = settings.voice) {
  const saved = name && browserVoice(name);
  return (
    (saved && (saved.localService !== false || !settings.onDeviceOnly) && saved) ||
    (automatic() && manager?.convertToSpeechSynthesisVoice(automatic())) ||
    null
  );
}

// What's queued to be read. Chrome forgets to say an utterance ended once
// nothing refers to it, so they're kept until the next read.
let queued = [];

// Queues the sentences to be read with the chosen voice and speed, then runs
// onDone once the last is read or fails, at once for none. Cancelling the
// queue skips onDone.
export function read(sentences, onDone, name) {
  if (speechProblem()) {
    onDone?.();
    return;
  }
  const synth = window.speechSynthesis;
  const voice = chosenVoice(name);
  synth.cancel();
  queued = sentences.map((sentence) => {
    const utterance = new window.SpeechSynthesisUtterance(sentence);
    utterance.lang = voice?.lang ?? canvasLanguage();
    if (voice) utterance.voice = voice;
    utterance.rate = chosen('readingSpeed');
    utterance.volume = volume();
    return utterance;
  });
  const last = queued.at(-1);
  if (!last) {
    onDone?.();
    return;
  }
  last.onend = () => onDone?.();
  last.onerror = (event) => {
    if (event?.error !== 'canceled' && event?.error !== 'interrupted') onDone?.();
  };
  for (const utterance of queued) synth.speak(utterance);
}

// Readium's sample sentence in a voice, by its name, or the chosen one.
export function previewVoice(name) {
  const voice = chosenVoice(name);
  const label = voice
    ? (ranked.find((item) => nameOf(item) === voice.name)?.label ?? voice.name)
    : 'your browser';
  read([sample.replace('{name}', label)], null, name);
}
